use std::collections::BTreeMap;

use super::buckets::{bucket_start_for_rfc3339, trim_old_buckets, MAX_BUCKETS};
use super::model::{
    CountByKey, RuntimeEventBucket, RuntimeEventRecord, RuntimeEventSummary, RuntimeOutputBucket,
    RuntimeOutputRecord, RuntimeOutputSummary, RuntimeRecordOutcome,
};

#[derive(Debug, Default)]
pub struct RuntimeCounters {
    total_events: u64,
    total_outputs: u64,
    total_failures: u64,
    runtime_error_count: u64,
    events_by_source: BTreeMap<String, u64>,
    events_by_result: BTreeMap<String, u64>,
    output_attempts_by_type: BTreeMap<String, u64>,
    output_failures_by_type: BTreeMap<String, u64>,
    event_buckets: BTreeMap<(String, String), BucketCounts>,
    output_buckets: BTreeMap<(String, String), BucketCounts>,
    last_event: Option<RuntimeEventSummary>,
    last_output: Option<RuntimeOutputSummary>,
}

#[derive(Debug, Default, Clone, Copy)]
struct BucketCounts {
    total: u64,
    success: u64,
    failure: u64,
}

impl RuntimeCounters {
    pub fn record_event(&mut self, record: RuntimeEventRecord) {
        let result = result_label(record.outcome);
        self.total_events += 1;
        *self
            .events_by_source
            .entry(record.source.clone())
            .or_default() += 1;
        *self.events_by_result.entry(result.to_string()).or_default() += 1;
        if record.outcome == RuntimeRecordOutcome::Failure {
            self.total_failures += 1;
            self.runtime_error_count += 1;
        }

        let bucket_key = (
            bucket_start_for_rfc3339(&record.occurred_at),
            record.source.clone(),
        );
        increment_bucket(
            self.event_buckets.entry(bucket_key).or_default(),
            record.outcome,
        );
        self.trim_event_buckets();

        self.last_event = Some(RuntimeEventSummary {
            source: record.source,
            event: record.event,
            internal_event: record.internal_event,
            result: result.to_string(),
            occurred_at: record.occurred_at,
        });
    }

    pub fn record_output(&mut self, record: RuntimeOutputRecord) {
        let result = result_label(record.outcome);
        self.total_outputs += 1;
        *self
            .output_attempts_by_type
            .entry(record.output_type.clone())
            .or_default() += 1;
        if record.outcome == RuntimeRecordOutcome::Failure {
            self.total_failures += 1;
            self.runtime_error_count += 1;
            *self
                .output_failures_by_type
                .entry(record.output_type.clone())
                .or_default() += 1;
        }

        let bucket_key = (
            bucket_start_for_rfc3339(&record.occurred_at),
            record.output_type.clone(),
        );
        increment_bucket(
            self.output_buckets.entry(bucket_key).or_default(),
            record.outcome,
        );
        self.trim_output_buckets();

        self.last_output = Some(RuntimeOutputSummary {
            output_type: record.output_type,
            result: result.to_string(),
            occurred_at: record.occurred_at,
        });
    }

    pub fn total_events(&self) -> u64 {
        self.total_events
    }

    pub fn total_outputs(&self) -> u64 {
        self.total_outputs
    }

    pub fn total_failures(&self) -> u64 {
        self.total_failures
    }

    pub fn runtime_error_count(&self) -> u64 {
        self.runtime_error_count
    }

    pub fn events_by_source(&self) -> Vec<CountByKey> {
        count_map_to_vec(&self.events_by_source)
    }

    pub fn events_by_result(&self) -> Vec<CountByKey> {
        count_map_to_vec(&self.events_by_result)
    }

    pub fn output_attempts_by_type(&self) -> Vec<CountByKey> {
        count_map_to_vec(&self.output_attempts_by_type)
    }

    pub fn output_failures_by_type(&self) -> Vec<CountByKey> {
        count_map_to_vec(&self.output_failures_by_type)
    }

    pub fn event_series(&self) -> Vec<RuntimeEventBucket> {
        self.event_buckets
            .iter()
            .map(|((bucket_start, source), counts)| RuntimeEventBucket {
                bucket_start: bucket_start.clone(),
                source: source.clone(),
                total_count: counts.total,
                success_count: counts.success,
                failure_count: counts.failure,
            })
            .collect()
    }

    pub fn output_series(&self) -> Vec<RuntimeOutputBucket> {
        self.output_buckets
            .iter()
            .map(
                |((bucket_start, output_type), counts)| RuntimeOutputBucket {
                    bucket_start: bucket_start.clone(),
                    output_type: output_type.clone(),
                    total_count: counts.total,
                    success_count: counts.success,
                    failure_count: counts.failure,
                },
            )
            .collect()
    }

    pub fn last_event(&self) -> Option<RuntimeEventSummary> {
        self.last_event.clone()
    }

    pub fn last_output(&self) -> Option<RuntimeOutputSummary> {
        self.last_output.clone()
    }

    fn trim_event_buckets(&mut self) {
        let kept = trim_old_buckets(
            self.event_buckets
                .keys()
                .map(|(bucket, _)| bucket.clone())
                .collect(),
            MAX_BUCKETS,
        );
        self.event_buckets
            .retain(|(bucket, _), _| kept.binary_search(bucket).is_ok());
    }

    fn trim_output_buckets(&mut self) {
        let kept = trim_old_buckets(
            self.output_buckets
                .keys()
                .map(|(bucket, _)| bucket.clone())
                .collect(),
            MAX_BUCKETS,
        );
        self.output_buckets
            .retain(|(bucket, _), _| kept.binary_search(bucket).is_ok());
    }
}

fn increment_bucket(counts: &mut BucketCounts, outcome: RuntimeRecordOutcome) {
    counts.total += 1;
    match outcome {
        RuntimeRecordOutcome::Success => counts.success += 1,
        RuntimeRecordOutcome::Failure => counts.failure += 1,
    }
}

fn count_map_to_vec(map: &BTreeMap<String, u64>) -> Vec<CountByKey> {
    map.iter()
        .map(|(key, count)| CountByKey {
            key: key.clone(),
            count: *count,
        })
        .collect()
}

fn result_label(outcome: RuntimeRecordOutcome) -> &'static str {
    match outcome {
        RuntimeRecordOutcome::Success => "success",
        RuntimeRecordOutcome::Failure => "error",
    }
}
