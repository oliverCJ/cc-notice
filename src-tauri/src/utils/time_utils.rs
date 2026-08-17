pub fn timestamp_for_backup() -> String {
    let format = time::macros::format_description!("[year][month][day]T[hour][minute][second]");
    let local_timestamp = crate::infrastructure::time_utils::current_local_rfc3339_timestamp();
    let timestamp = time::OffsetDateTime::parse(
        &local_timestamp,
        &time::format_description::well_known::Rfc3339,
    )
    .unwrap_or_else(|_| time::OffsetDateTime::now_utc());
    timestamp
        .format(&format)
        .unwrap_or_else(|_| "19700101T000000".to_string())
}

#[cfg(test)]
mod tests {
    use super::timestamp_for_backup;

    #[test]
    fn timestamp_for_backup_is_filesystem_safe() {
        let timestamp = timestamp_for_backup();

        assert!(!timestamp.contains(':'));
        assert!(timestamp.contains('T'));
    }
}
