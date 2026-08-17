use super::*;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn app_home_is_hidden_cc_notice_dir_under_user_home() {
    let dir = app_home_dir(Path::new("/Users/test"));

    assert_eq!(Path::new("/Users/test/.cc-notice"), dir.as_path());
}

#[test]
fn user_logs_are_under_hidden_cc_notice_dir() {
    let dir = user_log_dir(Path::new("/Users/test"));

    assert_eq!(Path::new("/Users/test/.cc-notice/logs"), dir.as_path());
}

#[test]
fn user_log_file_is_cc_notice_log_under_hidden_logs_dir() {
    let file = user_log_file(Path::new("/Users/test"));

    assert_eq!(
        Path::new("/Users/test/.cc-notice/logs/cc-notice.log"),
        file.as_path()
    );
}

#[test]
fn relay_log_file_is_separated_from_app_log_file() {
    let file = relay_user_log_file(Path::new("/Users/test"));

    assert_eq!(
        Path::new("/Users/test/.cc-notice/logs/cc-notice-relay.log"),
        file.as_path()
    );
}

#[test]
fn development_log_dir_keeps_command_compatibility_but_uses_user_log_dir() {
    let dir = development_log_dir(Path::new("/workspace/cc_notice"));

    assert!(dir.ends_with(Path::new(".cc-notice/logs")));
}

#[test]
fn installed_log_dir_keeps_command_compatibility_but_uses_user_log_dir() {
    let dir = installed_log_dir(Path::new(
        "/Users/test/Library/Application Support/CC Notice",
    ));

    assert!(dir.ends_with(Path::new(".cc-notice/logs")));
}

#[test]
fn ensure_log_dir_creates_hidden_logs_dir() {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir()
        .join(format!("cc-notice-log-test-{unique}"))
        .join(".cc-notice")
        .join("logs");

    ensure_log_dir(&dir).expect("log dir should be created");

    assert!(dir.is_dir());
}

#[test]
fn fallback_user_log_dir_uses_temp_dir_when_home_is_missing() {
    let dir = fallback_user_log_dir();

    assert!(dir.starts_with(std::env::temp_dir()));
    assert!(dir.ends_with(Path::new(".cc-notice/logs")));
}

#[test]
fn writer_records_file_log_when_console_write_fails() {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let file_path = std::env::temp_dir()
        .join(format!("cc-notice-writer-test-{unique}"))
        .join("cc-notice.log");
    let file = open_log_file(&file_path).expect("log file should open");
    let console = FailingWriter;
    let mut writer = ConsoleAndFileWriter::with_console(file, console);
    let message = b"file log survives console failure";

    let written = writer
        .write(message)
        .expect("file write should not fail when console fails");

    writer.flush().expect("file flush should not fail");
    let content = std::fs::read_to_string(file_path).expect("log file should be readable");
    assert_eq!(message.len(), written);
    assert!(content.contains("file log survives console failure"));
}

#[test]
fn file_only_writer_records_file_log_without_console_sink() {
    let file_path = temp_log_dir("file-only-writer").join("cc-notice-relay.log");
    let file = open_log_file(&file_path).expect("log file should open");
    let mut writer = FileOnlyWriter::new(file);
    let message = b"relay error stays in file only";

    let written = writer.write(message).expect("file write should succeed");

    writer.flush().expect("file flush should succeed");
    let content = std::fs::read_to_string(file_path).expect("log file should be readable");
    assert_eq!(message.len(), written);
    assert!(content.contains("relay error stays in file only"));
}

#[test]
fn archive_lock_path_is_scoped_to_log_file_name() {
    let lock_path = archive_lock_path(Path::new("/tmp/logs/cc-notice-relay.log"))
        .expect("lock path should build");

    assert_eq!(
        Path::new("/tmp/logs/cc-notice-relay.log.archive.lock"),
        lock_path.as_path()
    );
}

#[test]
fn system_time_date_uses_given_local_offset() {
    let timestamp = time::OffsetDateTime::new_utc(
        date(2026, 6, 11),
        time::Time::from_hms(23, 30, 0).expect("valid time"),
    );

    let local_date = system_time_date_for_offset(
        timestamp.into(),
        time::UtcOffset::from_hms(8, 0, 0).expect("valid offset"),
    );

    assert_eq!(date(2026, 6, 12), local_date);
}

#[test]
fn archive_log_file_keeps_current_file_when_date_is_today() {
    let dir = temp_log_dir("same-day");
    let log_file = dir.join("cc-notice.log");
    std::fs::write(&log_file, "today log\n").expect("log should write");

    archive_log_file_for_dates(&log_file, date(2026, 6, 12), date(2026, 6, 12), 30)
        .expect("archive should succeed");

    assert!(log_file.exists());
    assert!(!dir.join("cc-notice.2026-06-12.log").exists());
}

#[test]
fn archive_log_file_moves_previous_day_content_to_dated_archive() {
    let dir = temp_log_dir("previous-day");
    let log_file = dir.join("cc-notice.log");
    std::fs::write(&log_file, "old log\n").expect("log should write");

    archive_log_file_for_dates(&log_file, date(2026, 6, 11), date(2026, 6, 12), 30)
        .expect("archive should succeed");

    assert!(!log_file.exists());
    assert_eq!(
        "old log\n",
        std::fs::read_to_string(dir.join("cc-notice.2026-06-11.log"))
            .expect("archive should be readable")
    );
}

#[test]
fn archive_log_file_appends_when_archive_already_exists() {
    let dir = temp_log_dir("append-archive");
    let log_file = dir.join("cc-notice-relay.log");
    std::fs::write(&log_file, "second\n").expect("log should write");
    std::fs::write(dir.join("cc-notice-relay.2026-06-11.log"), "first\n")
        .expect("archive should write");

    archive_log_file_for_dates(&log_file, date(2026, 6, 11), date(2026, 6, 12), 30)
        .expect("archive should succeed");

    assert_eq!(
        "first\nsecond\n",
        std::fs::read_to_string(dir.join("cc-notice-relay.2026-06-11.log"))
            .expect("archive should be readable")
    );
}

#[test]
fn archive_log_file_removes_archives_older_than_retention_days() {
    let dir = temp_log_dir("retention");
    let log_file = dir.join("cc-notice.log");
    std::fs::write(&log_file, "current\n").expect("log should write");
    std::fs::write(dir.join("cc-notice.2026-05-12.log"), "expired\n")
        .expect("expired archive should write");
    std::fs::write(dir.join("cc-notice.2026-05-13.log"), "kept\n")
        .expect("kept archive should write");

    archive_log_file_for_dates(&log_file, date(2026, 6, 12), date(2026, 6, 12), 30)
        .expect("archive should succeed");

    assert!(!dir.join("cc-notice.2026-05-12.log").exists());
    assert!(dir.join("cc-notice.2026-05-13.log").exists());
}

fn temp_log_dir(name: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time should be after unix epoch")
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("cc-notice-{name}-{unique}"));
    std::fs::create_dir_all(&dir).expect("temp log dir should be created");
    dir
}

fn date(year: i32, month: u8, day: u8) -> time::Date {
    time::Date::from_calendar_date(
        year,
        time::Month::try_from(month).expect("valid month"),
        day,
    )
    .expect("valid date")
}

struct FailingWriter;

impl Write for FailingWriter {
    fn write(&mut self, _buf: &[u8]) -> io::Result<usize> {
        Err(io::Error::new(
            io::ErrorKind::BrokenPipe,
            "console writer failed",
        ))
    }

    fn flush(&mut self) -> io::Result<()> {
        Err(io::Error::new(
            io::ErrorKind::BrokenPipe,
            "console writer failed",
        ))
    }
}
