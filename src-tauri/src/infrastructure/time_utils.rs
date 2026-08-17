use std::fmt;

use time::format_description::well_known::Rfc3339;
use time::{OffsetDateTime, UtcOffset};
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::FormatTime;

#[derive(Clone, Debug)]
pub struct LocalRfc3339Timer {
    offset: UtcOffset,
}

impl LocalRfc3339Timer {
    pub fn system() -> Self {
        Self {
            offset: current_local_offset(),
        }
    }
}

impl FormatTime for LocalRfc3339Timer {
    fn format_time(&self, writer: &mut Writer<'_>) -> fmt::Result {
        let timestamp = format_rfc3339_for_offset(OffsetDateTime::now_utc(), self.offset);
        writer.write_str(&timestamp)
    }
}

pub fn current_local_rfc3339_timestamp() -> String {
    format_rfc3339_for_offset(OffsetDateTime::now_utc(), current_local_offset())
}

pub fn system_local_offset() -> UtcOffset {
    current_local_offset()
}

pub fn format_rfc3339_for_offset(timestamp: OffsetDateTime, offset: UtcOffset) -> String {
    timestamp
        .to_offset(offset)
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn current_local_offset() -> UtcOffset {
    // 读取系统时区失败时降级到 UTC，保证事件和日志仍可生成。
    UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_rfc3339_with_positive_local_offset() {
        let timestamp = OffsetDateTime::new_utc(
            time::Date::from_calendar_date(2026, time::Month::June, 12).expect("valid date"),
            time::Time::from_hms(0, 30, 0).expect("valid time"),
        );

        let formatted =
            format_rfc3339_for_offset(timestamp, UtcOffset::from_hms(8, 0, 0).expect("valid"));

        assert_eq!("2026-06-12T08:30:00+08:00", formatted);
    }

    #[test]
    fn formats_rfc3339_with_negative_local_offset() {
        let timestamp = OffsetDateTime::new_utc(
            time::Date::from_calendar_date(2026, time::Month::June, 12).expect("valid date"),
            time::Time::from_hms(0, 30, 0).expect("valid time"),
        );

        let formatted =
            format_rfc3339_for_offset(timestamp, UtcOffset::from_hms(-7, 0, 0).expect("valid"));

        assert_eq!("2026-06-11T17:30:00-07:00", formatted);
    }
}
