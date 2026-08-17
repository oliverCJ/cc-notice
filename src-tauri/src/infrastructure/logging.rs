use std::env;
use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::infrastructure::app_paths;
pub use crate::infrastructure::time_utils::LocalRfc3339Timer;

pub const LOG_DIR_NAME: &str = "logs";
pub const LOG_FILE_NAME: &str = "cc-notice.log";
pub const RELAY_LOG_FILE_NAME: &str = "cc-notice-relay.log";
pub const DEFAULT_LOG_RETENTION_DAYS: i64 = 30;

pub fn app_home_dir(home: &Path) -> PathBuf {
    app_paths::app_home_dir_for_user(home)
}

pub fn user_log_dir(home: &Path) -> PathBuf {
    app_home_dir(home).join(LOG_DIR_NAME)
}

pub fn user_log_file(home: &Path) -> PathBuf {
    user_log_dir(home).join(LOG_FILE_NAME)
}

pub fn relay_user_log_file(home: &Path) -> PathBuf {
    user_log_dir(home).join(RELAY_LOG_FILE_NAME)
}

pub fn development_log_dir(_project_root: &Path) -> PathBuf {
    default_user_log_dir().unwrap_or_else(|_| fallback_user_log_dir())
}

pub fn installed_log_dir(_app_data_dir: &Path) -> PathBuf {
    default_user_log_dir().unwrap_or_else(|_| fallback_user_log_dir())
}

pub fn default_user_log_dir() -> Result<PathBuf, String> {
    Ok(app_paths::app_home_dir()?.join(LOG_DIR_NAME))
}

pub fn default_user_log_file() -> Result<PathBuf, String> {
    Ok(default_user_log_dir()?.join(LOG_FILE_NAME))
}

pub fn default_relay_user_log_file() -> Result<PathBuf, String> {
    Ok(default_user_log_dir()?.join(RELAY_LOG_FILE_NAME))
}

pub fn fallback_user_log_dir() -> PathBuf {
    user_log_dir(&env::temp_dir())
}

pub fn ensure_log_dir(log_dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(log_dir).map_err(|error| error.to_string())
}

pub fn open_log_file(log_file: &Path) -> Result<File, String> {
    if let Some(parent) = log_file.parent() {
        ensure_log_dir(parent)?;
    }
    archive_log_file(log_file, DEFAULT_LOG_RETENTION_DAYS)?;
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file)
        .map_err(|error| error.to_string())
}

pub fn archive_log_file(log_file: &Path, retention_days: i64) -> Result<(), String> {
    let _lock = ArchiveLock::acquire(log_file)?;
    let Some(modified_date) = log_file_modified_date(log_file)? else {
        cleanup_archived_logs(log_file, current_local_date(), retention_days)?;
        return Ok(());
    };
    archive_log_file_for_dates(
        log_file,
        modified_date,
        current_local_date(),
        retention_days,
    )
}

fn archive_log_file_for_dates(
    log_file: &Path,
    log_date: time::Date,
    today: time::Date,
    retention_days: i64,
) -> Result<(), String> {
    cleanup_archived_logs(log_file, today, retention_days)?;

    if log_date >= today || !log_file.exists() {
        return Ok(());
    }

    let archive_path = archive_path_for_date(log_file, log_date)?;
    if let Some(parent) = archive_path.parent() {
        ensure_log_dir(parent)?;
    }

    if !archive_path.exists() {
        return std::fs::rename(log_file, archive_path).map_err(|error| error.to_string());
    }

    append_file_then_remove(log_file, &archive_path)
}

fn cleanup_archived_logs(
    log_file: &Path,
    today: time::Date,
    retention_days: i64,
) -> Result<(), String> {
    let Some(parent) = log_file.parent() else {
        return Ok(());
    };
    if !parent.exists() {
        return Ok(());
    }
    let Some(prefix) = archive_prefix(log_file) else {
        return Ok(());
    };
    let cutoff = today - time::Duration::days(retention_days);

    for entry in std::fs::read_dir(parent).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        let Some(date) = archived_log_date(file_name, &prefix) else {
            continue;
        };
        if date < cutoff {
            std::fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

fn log_file_modified_date(log_file: &Path) -> Result<Option<time::Date>, String> {
    if !log_file.exists() {
        return Ok(None);
    }
    let modified = std::fs::metadata(log_file)
        .map_err(|error| error.to_string())?
        .modified()
        .map_err(|error| error.to_string())?;
    Ok(Some(system_time_local_date(modified)))
}

fn current_local_date() -> time::Date {
    let now = std::time::SystemTime::now();
    let offset = time::UtcOffset::current_local_offset().unwrap_or(time::UtcOffset::UTC);
    system_time_date_for_offset(now, offset)
}

fn system_time_local_date(system_time: std::time::SystemTime) -> time::Date {
    let offset = time::UtcOffset::current_local_offset().unwrap_or(time::UtcOffset::UTC);
    system_time_date_for_offset(system_time, offset)
}

fn system_time_date_for_offset(
    system_time: std::time::SystemTime,
    offset: time::UtcOffset,
) -> time::Date {
    let timestamp: time::OffsetDateTime = system_time.into();
    timestamp.to_offset(offset).date()
}

fn archive_path_for_date(log_file: &Path, date: time::Date) -> Result<PathBuf, String> {
    let parent = log_file.parent().unwrap_or_else(|| Path::new(""));
    let prefix = archive_prefix(log_file)
        .ok_or_else(|| format!("invalid log file name: {}", log_file.display()))?;
    Ok(parent.join(format!("{prefix}.{}.log", format_date(date))))
}

fn archive_prefix(log_file: &Path) -> Option<String> {
    log_file
        .file_name()
        .and_then(|value| value.to_str())
        .and_then(|file_name| file_name.strip_suffix(".log"))
        .map(ToString::to_string)
}

fn archived_log_date(file_name: &str, prefix: &str) -> Option<time::Date> {
    let date = file_name
        .strip_prefix(&format!("{prefix}."))
        .and_then(|value| value.strip_suffix(".log"))?;
    parse_date(date)
}

fn format_date(date: time::Date) -> String {
    date.format(&time::macros::format_description!("[year]-[month]-[day]"))
        .unwrap_or_else(|_| "1970-01-01".to_string())
}

fn parse_date(value: &str) -> Option<time::Date> {
    time::Date::parse(
        value,
        &time::macros::format_description!("[year]-[month]-[day]"),
    )
    .ok()
}

fn append_file_then_remove(source: &Path, destination: &Path) -> Result<(), String> {
    let mut source_file = File::open(source).map_err(|error| error.to_string())?;
    let mut destination_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(destination)
        .map_err(|error| error.to_string())?;
    std::io::copy(&mut source_file, &mut destination_file).map_err(|error| error.to_string())?;
    destination_file
        .flush()
        .map_err(|error| error.to_string())?;
    std::fs::remove_file(source).map_err(|error| error.to_string())
}

fn archive_lock_path(log_file: &Path) -> Result<PathBuf, String> {
    let file_name = log_file
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("invalid log file name: {}", log_file.display()))?;
    Ok(log_file.with_file_name(format!("{file_name}.archive.lock")))
}

struct ArchiveLock {
    path: PathBuf,
}

impl ArchiveLock {
    fn acquire(log_file: &Path) -> Result<Self, String> {
        let path = archive_lock_path(log_file)?;
        if let Some(parent) = path.parent() {
            ensure_log_dir(parent)?;
        }
        let started_at = std::time::Instant::now();
        loop {
            match OpenOptions::new().write(true).create_new(true).open(&path) {
                Ok(_) => break,
                Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                    if started_at.elapsed() >= std::time::Duration::from_secs(2) {
                        return Err(format!(
                            "timed out waiting for log archive lock: {}",
                            path.display()
                        ));
                    }
                    std::thread::sleep(std::time::Duration::from_millis(25));
                }
                Err(error) => return Err(error.to_string()),
            }
        }
        Ok(Self { path })
    }
}

impl Drop for ArchiveLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

#[derive(Clone)]
pub struct ConsoleAndFileWriter {
    console: Arc<Mutex<Box<dyn Write + Send>>>,
    file: Arc<Mutex<File>>,
}

#[derive(Clone)]
pub struct FileOnlyWriter {
    file: Arc<Mutex<File>>,
}

impl FileOnlyWriter {
    pub fn new(file: File) -> Self {
        Self {
            file: Arc::new(Mutex::new(file)),
        }
    }
}

impl Write for FileOnlyWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let mut file = self
            .file
            .lock()
            .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;
        file.write_all(buf)?;
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        let mut file = self
            .file
            .lock()
            .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;
        file.flush()
    }
}

impl ConsoleAndFileWriter {
    pub fn new(file: File) -> Self {
        Self::with_console(file, io::stdout())
    }

    pub fn with_console<W>(file: File, console: W) -> Self
    where
        W: Write + Send + 'static,
    {
        Self {
            console: Arc::new(Mutex::new(Box::new(console))),
            file: Arc::new(Mutex::new(file)),
        }
    }
}

impl Write for ConsoleAndFileWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let mut file = self
            .file
            .lock()
            .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;
        file.write_all(buf)?;
        if let Ok(mut console) = self.console.lock() {
            let _ = console.write_all(buf);
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        let mut file = self
            .file
            .lock()
            .map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))?;
        file.flush()?;
        if let Ok(mut console) = self.console.lock() {
            let _ = console.flush();
        }
        Ok(())
    }
}

#[cfg(test)]
#[path = "logging_tests.rs"]
mod tests;
