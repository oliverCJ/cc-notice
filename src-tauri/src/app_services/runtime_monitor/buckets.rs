use time::{OffsetDateTime, UtcOffset};

use crate::infrastructure::time_utils::system_local_offset;

pub const MAX_BUCKETS: usize = 240;

pub fn bucket_start_for(occurred_at: OffsetDateTime) -> String {
    bucket_start_for_offset(occurred_at, system_local_offset())
}

pub fn bucket_start_for_offset(occurred_at: OffsetDateTime, offset: UtcOffset) -> String {
    let unix = occurred_at.unix_timestamp();
    let floored = unix - unix.rem_euclid(60);
    OffsetDateTime::from_unix_timestamp(floored)
        .unwrap_or(occurred_at)
        .to_offset(offset)
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| occurred_at.to_string())
}

pub fn bucket_start_for_rfc3339(value: &str) -> String {
    OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339)
        .map(bucket_start_for)
        .unwrap_or_else(|_| value.to_string())
}

pub fn trim_old_buckets(mut keys: Vec<String>, max_buckets: usize) -> Vec<String> {
    keys.sort();
    keys.dedup();
    if keys.len() <= max_buckets {
        return keys;
    }
    keys.split_off(keys.len() - max_buckets)
}
