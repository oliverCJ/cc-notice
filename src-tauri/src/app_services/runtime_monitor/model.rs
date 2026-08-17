use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeRecordOutcome {
    Success,
    Failure,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeEventRecord {
    pub source: String,
    pub event: String,
    pub internal_event: Option<String>,
    pub outcome: RuntimeRecordOutcome,
    pub occurred_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeOutputRecord {
    pub output_type: String,
    pub outcome: RuntimeRecordOutcome,
    pub occurred_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CountByKey {
    pub key: String,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEventBucket {
    pub bucket_start: String,
    pub source: String,
    pub total_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOutputBucket {
    pub bucket_start: String,
    pub output_type: String,
    pub total_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeMonitorSnapshot {
    pub started_at: String,
    pub uptime_seconds: u64,
    pub total_events: u64,
    pub total_outputs: u64,
    pub total_failures: u64,
    pub events_by_source: Vec<CountByKey>,
    pub events_by_result: Vec<CountByKey>,
    pub output_attempts_by_type: Vec<CountByKey>,
    pub output_failures_by_type: Vec<CountByKey>,
    pub event_series: Vec<RuntimeEventBucket>,
    pub output_series: Vec<RuntimeOutputBucket>,
    pub runtime_error_count: u64,
    pub last_event: Option<RuntimeEventSummary>,
    pub last_output: Option<RuntimeOutputSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeEventSummary {
    pub source: String,
    pub event: String,
    pub internal_event: Option<String>,
    pub result: String,
    pub occurred_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeOutputSummary {
    pub output_type: String,
    pub result: String,
    pub occurred_at: String,
}
