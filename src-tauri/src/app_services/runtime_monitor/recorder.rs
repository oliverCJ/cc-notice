use super::counters::RuntimeCounters;
use super::model::{RuntimeEventRecord, RuntimeMonitorSnapshot, RuntimeOutputRecord};
use super::snapshot::build_snapshot;
use crate::infrastructure::time_utils::current_local_rfc3339_timestamp;

#[derive(Debug)]
pub struct RuntimeMonitorService {
    started_at: String,
    counters: RuntimeCounters,
}

impl Default for RuntimeMonitorService {
    fn default() -> Self {
        Self::new()
    }
}

impl RuntimeMonitorService {
    pub fn new() -> Self {
        Self {
            started_at: current_rfc3339(),
            counters: RuntimeCounters::default(),
        }
    }

    pub fn record_inbound_event(&mut self, record: RuntimeEventRecord) {
        self.counters.record_event(record);
    }

    pub fn record_output(&mut self, record: RuntimeOutputRecord) {
        self.counters.record_output(record);
    }

    pub fn snapshot(&self) -> RuntimeMonitorSnapshot {
        self.snapshot_at(&current_rfc3339())
    }

    pub fn snapshot_at(&self, now: &str) -> RuntimeMonitorSnapshot {
        build_snapshot(&self.started_at, now, &self.counters)
    }

    #[cfg(test)]
    pub fn new_for_tests(started_at: &str) -> Self {
        Self {
            started_at: started_at.to_string(),
            counters: RuntimeCounters::default(),
        }
    }
}

fn current_rfc3339() -> String {
    current_local_rfc3339_timestamp()
}
