use super::DeviceRuntimeDisplayCoordinator;
use crate::app_services::runtime_monitor::{
    RuntimeEventRecord, RuntimeMonitorService, RuntimeOutputRecord, RuntimeRecordOutcome,
};
use crate::core::device::{DeviceConnectionStatus, DeviceExtensionActionType, DeviceRuntimeState};

#[test]
fn builds_display_runtime_action_for_connected_runtime_display_device() {
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-07-16T10:00:00+08:00");
    monitor.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "UserPromptSubmit".to_string(),
        internal_event: Some("agent.working".to_string()),
        outcome: RuntimeRecordOutcome::Success,
        occurred_at: "2026-07-16T10:01:00+08:00".to_string(),
    });
    monitor.record_output(RuntimeOutputRecord {
        output_type: "display".to_string(),
        outcome: RuntimeRecordOutcome::Success,
        occurred_at: "2026-07-16T10:01:01+08:00".to_string(),
    });
    let snapshot = monitor.snapshot_at("2026-07-16T10:02:00+08:00");

    let actions = DeviceRuntimeDisplayCoordinator::runtime_actions(
        &snapshot,
        &[
            runtime_state(
                "desk-wio",
                "seeed-wio-terminal",
                DeviceConnectionStatus::Connected,
            ),
            runtime_state(
                "offline-wio",
                "seeed-wio-terminal",
                DeviceConnectionStatus::Disconnected,
            ),
            runtime_state(
                "desk-pico",
                "rp2040-pico",
                DeviceConnectionStatus::Connected,
            ),
            runtime_state(
                "desk-oled",
                "rp2040-pico-oled-091",
                DeviceConnectionStatus::Connected,
            ),
        ],
    );

    assert_eq!(2, actions.len());
    let action = &actions[0];
    assert_eq!("desk-wio", action.device_id);
    assert_eq!(DeviceExtensionActionType::DisplayRuntime, action.action);
    assert_eq!(Some("working"), action.status.as_deref());
    assert_eq!(Some("Working"), action.title.as_deref());
    assert_eq!(Some("Events 1 / Outputs 1"), action.message.as_deref());
    assert_eq!(
        Some(vec![
            "Last codex UserPromptSub".to_string(),
            "OK 1 / Errors 0".to_string()
        ]),
        action.lines.clone()
    );
    assert_eq!("desk-oled", actions[1].device_id);
    assert_eq!(DeviceExtensionActionType::DisplayRuntime, actions[1].action);
    assert_eq!(Some("E/O 1/1"), actions[1].message.as_deref());
}

#[test]
fn runtime_display_uses_compact_message_for_small_oled_devices() {
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-07-16T10:00:00+08:00");
    for index in 0..111 {
        monitor.record_inbound_event(RuntimeEventRecord {
            source: "codex".to_string(),
            event: format!("PostToolUse{index}"),
            internal_event: Some("agent.working".to_string()),
            outcome: RuntimeRecordOutcome::Success,
            occurred_at: format!("2026-07-16T10:{:02}:00+08:00", index % 60),
        });
    }
    for index in 0..123 {
        monitor.record_output(RuntimeOutputRecord {
            output_type: "display".to_string(),
            outcome: RuntimeRecordOutcome::Success,
            occurred_at: format!("2026-07-16T10:{:02}:01+08:00", index % 60),
        });
    }
    let snapshot = monitor.snapshot_at("2026-07-16T11:00:00+08:00");

    let actions = DeviceRuntimeDisplayCoordinator::runtime_actions(
        &snapshot,
        &[runtime_state(
            "desk-oled",
            "rp2040-pico-oled-091",
            DeviceConnectionStatus::Connected,
        )],
    );

    assert_eq!(Some("E/O 111/123"), actions[0].message.as_deref());
}

#[test]
fn marks_runtime_display_as_error_when_snapshot_has_failures() {
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-07-16T10:00:00+08:00");
    monitor.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "StopFailure".to_string(),
        internal_event: Some("agent.failed".to_string()),
        outcome: RuntimeRecordOutcome::Failure,
        occurred_at: "2026-07-16T10:01:00+08:00".to_string(),
    });
    let snapshot = monitor.snapshot_at("2026-07-16T10:02:00+08:00");

    let actions = DeviceRuntimeDisplayCoordinator::runtime_actions(
        &snapshot,
        &[runtime_state(
            "desk-wio",
            "seeed-wio-terminal",
            DeviceConnectionStatus::Connected,
        )],
    );

    assert_eq!(Some("error"), actions[0].status.as_deref());
    assert_eq!(Some("Error"), actions[0].title.as_deref());
}

#[test]
fn runtime_display_status_follows_latest_event_after_previous_failure() {
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-07-16T10:00:00+08:00");
    monitor.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "StopFailure".to_string(),
        internal_event: Some("agent.failed".to_string()),
        outcome: RuntimeRecordOutcome::Failure,
        occurred_at: "2026-07-16T10:01:00+08:00".to_string(),
    });
    monitor.record_inbound_event(RuntimeEventRecord {
        source: "codex".to_string(),
        event: "UserPromptSubmit".to_string(),
        internal_event: Some("agent.working".to_string()),
        outcome: RuntimeRecordOutcome::Success,
        occurred_at: "2026-07-16T10:02:00+08:00".to_string(),
    });
    let snapshot = monitor.snapshot_at("2026-07-16T10:03:00+08:00");

    let actions = DeviceRuntimeDisplayCoordinator::runtime_actions(
        &snapshot,
        &[runtime_state(
            "desk-wio",
            "seeed-wio-terminal",
            DeviceConnectionStatus::Connected,
        )],
    );

    assert_eq!(1, snapshot.runtime_error_count);
    assert_eq!(Some("working"), actions[0].status.as_deref());
    assert_eq!(Some("Working"), actions[0].title.as_deref());
}

#[test]
fn runtime_display_status_uses_output_when_no_event_exists() {
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-07-16T10:00:00+08:00");
    monitor.record_output(RuntimeOutputRecord {
        output_type: "display".to_string(),
        outcome: RuntimeRecordOutcome::Success,
        occurred_at: "2026-07-16T10:01:00+08:00".to_string(),
    });
    let snapshot = monitor.snapshot_at("2026-07-16T10:02:00+08:00");

    let actions = DeviceRuntimeDisplayCoordinator::runtime_actions(
        &snapshot,
        &[runtime_state(
            "desk-wio",
            "seeed-wio-terminal",
            DeviceConnectionStatus::Connected,
        )],
    );

    assert_eq!(Some("success"), actions[0].status.as_deref());
    assert_eq!(Some("Ready"), actions[0].title.as_deref());
}

fn runtime_state(
    device_id: &str,
    board_id: &str,
    status: DeviceConnectionStatus,
) -> DeviceRuntimeState {
    DeviceRuntimeState {
        device_id: Some(device_id.to_string()),
        device_uid: Some(format!("{device_id}-uid")),
        status,
        board_id: Some(board_id.to_string()),
        transport: None,
        channels: Vec::new(),
        firmware_info: None,
        bundled_firmware_version: None,
        firmware_status: crate::core::device::DeviceFirmwareStatus::Unknown,
        firmware_check_error: None,
        heartbeat_status: crate::core::device::DeviceHeartbeatStatus::Unknown,
        last_heartbeat_at: None,
        heartbeat_failure_count: 0,
        manual_reconnect_suppressed: false,
        matched_resource_id: None,
        last_discovered_at: None,
        active_operation: None,
        auto_reconnect_blocked_until: None,
        last_ack: None,
        last_error_code: None,
        last_error: None,
        last_sent_at: None,
    }
}
