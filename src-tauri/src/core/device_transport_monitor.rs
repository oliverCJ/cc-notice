use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};

pub const MAX_PAYLOAD_PREVIEW_BYTES: usize = 2_048;

static NEXT_MONITOR_EVENT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceTransportMonitorDirection {
    Outbound,
    Inbound,
    System,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceTransportMonitorCategory {
    Command,
    Ack,
    InputEvent,
    Heartbeat,
    Connection,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceTransportMonitorStatus {
    Pending,
    Sent,
    Ok,
    Timeout,
    Error,
    Skipped,
    Stopped,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTransportMonitorEvent {
    pub id: String,
    pub timestamp: String,
    pub device_id: String,
    pub board_id: Option<String>,
    pub transport_kind: Option<String>,
    pub transport_address: Option<String>,
    pub direction: DeviceTransportMonitorDirection,
    pub category: DeviceTransportMonitorCategory,
    pub command_type: Option<String>,
    pub channel_id: Option<String>,
    pub control: Option<String>,
    pub status: DeviceTransportMonitorStatus,
    pub error_code: Option<String>,
    pub summary: String,
    pub payload_preview: Option<String>,
}

impl DeviceTransportMonitorEvent {
    pub fn new(
        device_id: String,
        board_id: Option<String>,
        direction: DeviceTransportMonitorDirection,
        category: DeviceTransportMonitorCategory,
        status: DeviceTransportMonitorStatus,
    ) -> Self {
        let id = NEXT_MONITOR_EVENT_ID.fetch_add(1, Ordering::Relaxed);
        Self {
            id: format!("monitor-{id}"),
            timestamp: current_local_timestamp(),
            device_id,
            board_id,
            transport_kind: None,
            transport_address: None,
            direction,
            category,
            command_type: None,
            channel_id: None,
            control: None,
            status,
            error_code: None,
            summary: String::new(),
            payload_preview: None,
        }
    }

    pub fn with_transport(mut self, kind: impl Into<String>, address: Option<String>) -> Self {
        self.transport_kind = Some(kind.into());
        self.transport_address = address;
        self
    }

    pub fn with_command(
        mut self,
        command_type: impl Into<String>,
        channel_id: Option<String>,
    ) -> Self {
        self.command_type = Some(command_type.into());
        self.channel_id = channel_id;
        self
    }

    pub fn with_control(mut self, control: impl Into<String>, channel_id: Option<String>) -> Self {
        self.control = Some(control.into());
        self.channel_id = channel_id;
        self
    }

    pub fn with_summary(mut self, summary: impl Into<String>) -> Self {
        self.summary = summary.into();
        self
    }

    pub fn with_error_code(mut self, error_code: impl Into<String>) -> Self {
        self.error_code = Some(error_code.into());
        self
    }

    pub fn with_payload_preview(mut self, payload: impl Into<String>) -> Self {
        self.payload_preview = Some(truncate_payload_preview(payload.into()));
        self
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTransportMonitorSnapshot {
    pub device_id: String,
    pub active: bool,
    pub events: Vec<DeviceTransportMonitorEvent>,
}

fn truncate_payload_preview(payload: String) -> String {
    if payload.len() <= MAX_PAYLOAD_PREVIEW_BYTES {
        return payload;
    }
    let mut truncated = payload;
    let mut target_len = MAX_PAYLOAD_PREVIEW_BYTES.saturating_sub(3);
    while target_len > 0 && !truncated.is_char_boundary(target_len) {
        target_len -= 1;
    }
    truncated.truncate(target_len);
    truncated.push_str("...");
    truncated
}

fn current_local_timestamp() -> String {
    let now = time::OffsetDateTime::now_local().unwrap_or_else(|_| time::OffsetDateTime::now_utc());
    now.format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| now.unix_timestamp().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_payload_preview_is_truncated_to_limit() {
        let event = DeviceTransportMonitorEvent::new(
            "desk-pico".to_string(),
            Some("rp2040-pico".to_string()),
            DeviceTransportMonitorDirection::Outbound,
            DeviceTransportMonitorCategory::Command,
            DeviceTransportMonitorStatus::Pending,
        )
        .with_payload_preview("x".repeat(MAX_PAYLOAD_PREVIEW_BYTES + 64));

        assert!(event.payload_preview.unwrap().len() <= MAX_PAYLOAD_PREVIEW_BYTES);
    }

    #[test]
    fn event_has_stable_id_and_timestamp() {
        let event = DeviceTransportMonitorEvent::new(
            "desk-pico".to_string(),
            None,
            DeviceTransportMonitorDirection::Inbound,
            DeviceTransportMonitorCategory::InputEvent,
            DeviceTransportMonitorStatus::Ok,
        );

        assert!(event.id.starts_with("monitor-"));
        assert!(!event.timestamp.is_empty());
        assert_eq!("desk-pico", event.device_id);
    }

    #[test]
    fn event_payload_preview_truncates_on_char_boundary() {
        let event = DeviceTransportMonitorEvent::new(
            "desk-pico".to_string(),
            None,
            DeviceTransportMonitorDirection::Inbound,
            DeviceTransportMonitorCategory::Ack,
            DeviceTransportMonitorStatus::Ok,
        )
        .with_payload_preview("中".repeat(MAX_PAYLOAD_PREVIEW_BYTES));

        assert!(event.payload_preview.unwrap().ends_with("..."));
    }
}
