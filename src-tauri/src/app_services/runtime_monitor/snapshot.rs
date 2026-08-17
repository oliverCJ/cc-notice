use time::OffsetDateTime;

use super::counters::RuntimeCounters;
use super::model::RuntimeMonitorSnapshot;

pub fn build_snapshot(
    started_at: &str,
    now: &str,
    counters: &RuntimeCounters,
) -> RuntimeMonitorSnapshot {
    RuntimeMonitorSnapshot {
        started_at: started_at.to_string(),
        uptime_seconds: uptime_seconds(started_at, now),
        total_events: counters.total_events(),
        total_outputs: counters.total_outputs(),
        total_failures: counters.total_failures(),
        events_by_source: counters.events_by_source(),
        events_by_result: counters.events_by_result(),
        output_attempts_by_type: counters.output_attempts_by_type(),
        output_failures_by_type: counters.output_failures_by_type(),
        event_series: counters.event_series(),
        output_series: counters.output_series(),
        runtime_error_count: counters.runtime_error_count(),
        last_event: counters.last_event(),
        last_output: counters.last_output(),
    }
}

fn uptime_seconds(started_at: &str, now: &str) -> u64 {
    let started = OffsetDateTime::parse(started_at, &time::format_description::well_known::Rfc3339);
    let current = OffsetDateTime::parse(now, &time::format_description::well_known::Rfc3339);
    match (started, current) {
        (Ok(started), Ok(current)) => current
            .unix_timestamp()
            .saturating_sub(started.unix_timestamp())
            .max(0) as u64,
        _ => 0,
    }
}
