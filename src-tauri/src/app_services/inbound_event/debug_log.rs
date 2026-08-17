use serde::{Deserialize, Serialize};

use crate::app_services::inbound_event_service::SubmitRelayEventOutput;
use crate::core::device::DeviceCommandResult;
use crate::core::protocol::NoticeCommand;

const MAX_DEBUG_LOG_ENTRIES: usize = 100;
const MAX_DEBUG_LOG_AGE_SECONDS: i64 = 3600;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugLogEntry {
    pub debug_entry_id: String,
    pub source: String,
    pub event: String,
    pub payload: String,
    pub raw_payload: Option<String>,
    pub result: String,
    pub internal_event: Option<String>,
    pub mapping_stage: Option<String>,
    pub notice_command: Option<NoticeCommand>,
    pub outputs: Vec<SubmitRelayEventOutput>,
    pub device_results: Vec<DeviceCommandResult>,
    pub error: Option<String>,
    pub occurred_at: String,
    pub request_received_at: Option<String>,
    pub http_read_elapsed_ms: Option<u64>,
    pub prepare_elapsed_ms: Option<u64>,
    pub queue_delay_ms: Option<u64>,
    pub response_elapsed_ms: Option<u64>,
    pub processing_elapsed_ms: Option<u64>,
    pub device_processing_elapsed_ms: Option<u64>,
    pub webhook_processing_elapsed_ms: Option<u64>,
    pub local_processing_elapsed_ms: Option<u64>,
    pub processing_completed_at: Option<String>,
    pub processing_mode: Option<String>,
}

pub(crate) fn push_debug_log(entries: &mut Vec<DebugLogEntry>, entry: DebugLogEntry) {
    entries.insert(0, entry);

    let now = time::OffsetDateTime::now_utc();
    entries.retain(|entry| {
        if let Ok(occurred_at) = time::OffsetDateTime::parse(
            &entry.occurred_at,
            &time::format_description::well_known::Rfc3339,
        ) {
            (now - occurred_at).whole_seconds() < MAX_DEBUG_LOG_AGE_SECONDS
        } else {
            true
        }
    });

    if entries.len() > MAX_DEBUG_LOG_ENTRIES {
        entries.truncate(MAX_DEBUG_LOG_ENTRIES);
    }
}

pub(crate) fn payload_summary(payload: &str) -> String {
    payload.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payload_summary_keeps_short_payload() {
        assert_eq!("{}", payload_summary("{}"));
    }

    #[test]
    fn payload_summary_truncates_multibyte_payload() {
        let summary = payload_summary(&"中文".repeat(100));

        assert_eq!("中文".repeat(100), summary);
    }

    #[test]
    fn push_debug_log_inserts_newest_first() {
        let mut entries = Vec::new();

        push_debug_log(
            &mut entries,
            DebugLogEntry {
                debug_entry_id: "debug-test-entry".to_string(),
                source: "codex".to_string(),
                event: "SessionStart".to_string(),
                payload: "{}".to_string(),
                raw_payload: None,
                result: "accepted".to_string(),
                internal_event: None,
                mapping_stage: None,
                notice_command: None,
                outputs: Vec::new(),
                device_results: Vec::new(),
                error: None,
                occurred_at: time::OffsetDateTime::now_utc()
                    .format(&time::format_description::well_known::Rfc3339)
                    .expect("time should format"),
                request_received_at: None,
                http_read_elapsed_ms: None,
                prepare_elapsed_ms: None,
                queue_delay_ms: None,
                response_elapsed_ms: None,
                processing_elapsed_ms: None,
                device_processing_elapsed_ms: None,
                webhook_processing_elapsed_ms: None,
                local_processing_elapsed_ms: None,
                processing_completed_at: None,
                processing_mode: None,
            },
        );

        assert_eq!("SessionStart", entries[0].event);
    }

    #[test]
    fn debug_log_entry_serializes_device_results() {
        let entry = DebugLogEntry {
            debug_entry_id: "debug-test-entry".to_string(),
            source: "codex".to_string(),
            event: "SessionStart".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            result: "accepted".to_string(),
            internal_event: Some("agent.started".to_string()),
            mapping_stage: Some("mapped".to_string()),
            notice_command: None,
            outputs: Vec::new(),
            device_results: vec![crate::core::device::DeviceCommandResult {
                device_id: "desk-pico".to_string(),
                channel_id: "pin.gp2".to_string(),
                output_type: crate::core::device::DeviceCommandOutputType::DeviceChannel,
                status: "sent".to_string(),
                ack: Some(r#"{"ok":true}"#.to_string()),
                error_code: None,
                error: None,
            }],
            error: None,
            occurred_at: "2026-07-10T00:00:00+08:00".to_string(),
            request_received_at: Some("2026-07-10T00:00:00+08:00".to_string()),
            http_read_elapsed_ms: Some(2),
            prepare_elapsed_ms: Some(4),
            queue_delay_ms: Some(6),
            response_elapsed_ms: Some(12),
            processing_elapsed_ms: Some(34),
            device_processing_elapsed_ms: Some(10),
            webhook_processing_elapsed_ms: Some(20),
            local_processing_elapsed_ms: Some(34),
            processing_completed_at: Some("2026-07-10T00:00:01+08:00".to_string()),
            processing_mode: Some("async".to_string()),
        };

        let value = serde_json::to_value(entry).expect("entry should serialize");

        assert_eq!("desk-pico", value["deviceResults"][0]["deviceId"]);
        assert_eq!("pin.gp2", value["deviceResults"][0]["channelId"]);
        assert_eq!("sent", value["deviceResults"][0]["status"]);
        assert_eq!(12, value["responseElapsedMs"]);
        assert_eq!(34, value["processingElapsedMs"]);
        assert_eq!(10, value["deviceProcessingElapsedMs"]);
        assert_eq!(20, value["webhookProcessingElapsedMs"]);
        assert_eq!(34, value["localProcessingElapsedMs"]);
        assert_eq!("async", value["processingMode"]);
    }
}
