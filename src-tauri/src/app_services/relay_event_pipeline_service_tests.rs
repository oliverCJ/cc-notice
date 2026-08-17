use super::RelayEventPipelineService;
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::app_services::inbound_event_service::{
    InboundEventOrigin, InboundEventService, SubmitRelayEventRequest, SubmitRelayEventResult,
};
use crate::app_services::output_executor::{OutputExecutionReport, OutputExecutor};
use crate::app_services::runtime_monitor::RuntimeMonitorService;
use crate::core::device::{
    ActiveLevel, DeviceChannel, DeviceChannelActionType, DeviceInstance, DeviceTransportConfig,
};
use crate::core::profiles::{
    default_device_profile, DeviceChannelRuleAction, EnabledHookEvent, HardwareOutput,
    HardwareOutputType, HardwareRule, NoticeProfile,
};
use crate::infrastructure::transports::mock::MockDeviceTransport;

#[test]
fn debug_test_origin_does_not_record_runtime_monitor() {
    let profile = profile_with_rules(vec![system_notification_rule(
        "agent-started-notification",
        "agent.started",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile.clone());
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(Vec::new());
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    let result = RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("debug event should submit");

    assert_eq!("agent.started", result.internal_event);
    assert_eq!(1, executor.executed_count);
    assert_eq!(
        0,
        monitor
            .snapshot_at("2026-06-18T10:01:00+08:00")
            .total_events
    );
    assert_eq!(
        0,
        monitor
            .snapshot_at("2026-06-18T10:01:00+08:00")
            .total_outputs
    );
}

#[test]
fn real_hook_origin_records_runtime_monitor() {
    let profile = profile_with_rules(vec![system_notification_rule(
        "agent-started-notification",
        "agent.started",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile.clone());
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(Vec::new());
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::RealHook),
    )
    .expect("real hook should submit");

    let snapshot = monitor.snapshot_at("2026-06-18T10:01:00+08:00");
    assert_eq!(1, snapshot.total_events);
    assert_eq!(1, snapshot.total_outputs);
    assert_eq!("codex", snapshot.last_event.expect("last event").source);
    assert_eq!(
        "system-notification",
        snapshot.last_output.expect("last output").output_type
    );
}

#[test]
fn successful_mapping_executes_software_and_device_outputs() {
    let profile = profile_with_rules(vec![
        system_notification_rule("agent-started-notification", "agent.started"),
        device_channel_rule(
            "agent-started-device",
            "agent.started",
            "desk-pico",
            "pin.gp2",
            DeviceChannelActionType::Activate,
        ),
    ]);
    let mut inbound_service = InboundEventService::with_profile(profile.clone());
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    let result = RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::RealHook),
    )
    .expect("event should submit");

    assert_eq!("agent.started", result.internal_event);
    assert_eq!(1, executor.executed_count);
    assert_eq!(1, registry.sent_lines("desk-pico").len());
    let snapshot = monitor.snapshot_at("2026-06-18T10:01:00+08:00");
    assert_eq!(1, snapshot.total_events);
    assert_eq!(2, snapshot.total_outputs);
    assert!(snapshot
        .output_attempts_by_type
        .iter()
        .any(|item| item.key == "device-channel" && item.count == 1));
}

#[test]
fn successful_device_output_is_returned_as_device_result() {
    let profile = profile_with_rules(vec![device_channel_rule(
        "agent-started-device",
        "agent.started",
        "desk-pico",
        "pin.gp2",
        DeviceChannelActionType::Activate,
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport(
            "desk-pico",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string(),
            ])),
        )
        .expect("device should connect");

    let result = RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        None,
        request("codex", "SessionStart").with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("event should submit");

    assert_eq!(1, result.device_results.len());
    assert_eq!("desk-pico", result.device_results[0].device_id);
    assert_eq!("pin.gp2", result.device_results[0].channel_id);
    assert_eq!("sent", result.device_results[0].status);
    assert_eq!(
        Some(r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string()),
        result.device_results[0].ack
    );
    assert_eq!(None, result.device_results[0].error);
}

#[test]
fn display_extension_uses_real_relay_template_context() {
    let profile = profile_with_rules(vec![display_rule(
        "agent-started-display",
        "agent.started",
        "desk-wio",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-wio")]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string(),
            ])),
        )
        .expect("display device should connect");
    let mut relay_request = request("codex", "SessionStart");
    relay_request.payload =
        r#"{"last_assistant_message":"screen content rendered","model":"gpt-5"}"#.to_string();

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        None,
        relay_request.with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("event should submit");

    let sent_line = registry
        .sent_lines("desk-wio")
        .first()
        .expect("display command should be sent")
        .clone();
    assert!(sent_line.contains(r#""title":"codex started""#));
    assert!(sent_line.contains(r#""message":"screen content rendered""#));
}

#[test]
fn display_extension_records_display_output_type_in_runtime_monitor() {
    let profile = profile_with_rules(vec![display_rule(
        "agent-started-display",
        "agent.started",
        "desk-wio",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-wio")]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string(),
            ])),
        )
        .expect("display device should connect");
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::RealHook),
    )
    .expect("event should submit");

    let snapshot = monitor.snapshot_at("2026-06-18T10:01:00+08:00");
    assert!(snapshot
        .output_attempts_by_type
        .iter()
        .any(|item| item.key == "display" && item.count == 1));
    assert!(!snapshot
        .output_attempts_by_type
        .iter()
        .any(|item| item.key == "device-channel"));
}

#[test]
fn device_channel_display_template_uses_registered_wio_display_card_capability() {
    let mut rule = device_channel_rule(
        "agent-started-device-display",
        "agent.started",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    rule.output.channel_actions[0].display_template_id = Some("task-started".to_string());
    rule.output.channel_actions[0].display_status = Some("working".to_string());
    rule.output.channel_actions[0].display_icon = Some("spinner".to_string());
    rule.output.channel_actions[0].display_title_template = Some("{{display.title}}".to_string());
    rule.output.channel_actions[0].display_message_template = Some("{{display.lines}}".to_string());
    rule.output.channel_actions[0].display_lines_template =
        Some(vec!["{{source}}".to_string(), "Task started".to_string()]);
    let profile = profile_with_rules(vec![rule]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut device = test_device("desk-wio");
    device.board_id = "seeed-wio-terminal".to_string();
    let mut registry = DeviceRuntimeRegistry::new(vec![device]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"display_card"}"#.to_string(),
            ])),
        )
        .expect("wio device should connect");

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        None,
        request("codex", "SessionStart").with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("event should submit");

    let sent_line = registry
        .sent_lines("desk-wio")
        .first()
        .expect("display command should be sent")
        .clone();
    assert!(sent_line.contains(r#""type":"display_card""#));
    assert!(sent_line.contains(r#""title":"Working""#));
    assert!(sent_line.contains(r#""lines":["codex","Task started"]"#));
}

#[test]
fn failed_device_output_is_returned_as_device_result() {
    let profile = profile_with_rules(vec![device_channel_rule(
        "agent-started-device",
        "agent.started",
        "desk-pico",
        "pin.gp2",
        DeviceChannelActionType::Activate,
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    let mut failing_transport = MockDeviceTransport::default();
    failing_transport.fail_send_with("write failed");
    registry
        .connect_with_transport("desk-pico", Box::new(failing_transport))
        .expect("device should connect");

    let result = RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        None,
        request("codex", "SessionStart").with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("device failure should not fail hook response");

    assert_eq!(1, result.device_results.len());
    assert_eq!("failed", result.device_results[0].status);
    assert_eq!(
        Some("write failed".to_string()),
        result.device_results[0].error
    );
}

#[test]
fn device_output_results_are_attached_to_debug_log_entry() {
    let profile = profile_with_rules(vec![device_channel_rule(
        "agent-started-device",
        "agent.started",
        "desk-pico",
        "pin.gp2",
        DeviceChannelActionType::Activate,
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport(
            "desk-pico",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string(),
            ])),
        )
        .expect("device should connect");
    let mut relay_request = request("codex", "SessionStart");
    relay_request.occurred_at = current_occurred_at();

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        None,
        relay_request.with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("event should submit");

    let entry = inbound_service
        .debug_log_entries()
        .first()
        .expect("debug log entry should exist");
    assert_eq!(1, entry.device_results.len());
    assert_eq!("desk-pico", entry.device_results[0].device_id);
    assert_eq!("pin.gp2", entry.device_results[0].channel_id);
    assert_eq!("sent", entry.device_results[0].status);
}

#[test]
fn device_plan_uses_inbound_service_profile_snapshot() {
    let inbound_profile = profile_with_rules(vec![system_notification_rule(
        "agent-started-notification",
        "agent.started",
    )]);
    let mut inbound_service = InboundEventService::with_profile(inbound_profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        None,
        request("codex", "SessionStart").with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("event should submit");

    assert!(registry.sent_lines("desk-pico").is_empty());
}

#[test]
fn failed_device_output_does_not_fail_pipeline_result() {
    let profile = profile_with_rules(vec![
        system_notification_rule("agent-started-notification", "agent.started"),
        device_channel_rule(
            "agent-started-device",
            "agent.started",
            "desk-pico",
            "pin.gp2",
            DeviceChannelActionType::Activate,
        ),
    ]);
    let mut inbound_service = InboundEventService::with_profile(profile.clone());
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    let mut failing_transport = MockDeviceTransport::default();
    failing_transport.fail_send_with("write failed");
    registry
        .connect_with_transport("desk-pico", Box::new(failing_transport))
        .expect("device should connect");
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    let result = RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::RealHook),
    )
    .expect("device failure should not fail hook response");

    assert_eq!("agent.started", result.internal_event);
    let snapshot = monitor.snapshot_at("2026-06-18T10:01:00+08:00");
    assert_eq!(1, snapshot.total_events);
    assert!(snapshot
        .output_failures_by_type
        .iter()
        .any(|item| item.key == "device-channel" && item.count == 1));
}

#[test]
fn real_hook_refreshes_connected_wio_runtime_display_after_monitor_updates() {
    let profile = profile_with_rules(vec![system_notification_rule(
        "agent-started-notification",
        "agent.started",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![wio_device("desk-wio")]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"display_runtime"}"#.to_string(),
            ])),
        )
        .expect("wio should connect");
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::RealHook),
    )
    .expect("real hook should submit");

    let sent_lines = registry.sent_lines("desk-wio");
    assert_eq!(1, sent_lines.len());
    assert!(sent_lines[0].contains(r#""type":"display_runtime""#));
    assert!(sent_lines[0].contains(r#""status":"working""#));
    assert!(sent_lines[0].contains(r#""message":"Events 1 / Outputs 1""#));
}

#[test]
fn debug_hook_does_not_refresh_wio_runtime_display() {
    let profile = profile_with_rules(vec![system_notification_rule(
        "agent-started-notification",
        "agent.started",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile);
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(vec![wio_device("desk-wio")]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"display_runtime"}"#.to_string(),
            ])),
        )
        .expect("wio should connect");
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "SessionStart").with_origin(InboundEventOrigin::DebugTest),
    )
    .expect("debug hook should submit");

    assert!(registry.sent_lines("desk-wio").is_empty());
}

#[test]
fn inbound_mapping_failure_returns_error_and_records_real_hook_failure() {
    let profile = profile_with_rules(vec![system_notification_rule(
        "agent-started-notification",
        "agent.started",
    )]);
    let mut inbound_service = InboundEventService::with_profile(profile.clone());
    let mut executor = RecordingOutputExecutor::default();
    let mut registry = DeviceRuntimeRegistry::new(Vec::new());
    let mut monitor = RuntimeMonitorService::new_for_tests("2026-06-18T10:00:00+08:00");

    let error = RelayEventPipelineService::submit(
        &mut inbound_service,
        &mut executor,
        &mut registry,
        Some(&mut monitor),
        request("codex", "Setup").with_origin(InboundEventOrigin::RealHook),
    )
    .expect_err("unknown event should fail");

    assert!(error.contains("unknown hook event"));
    assert_eq!(0, executor.executed_count);
    let snapshot = monitor.snapshot_at("2026-06-18T10:01:00+08:00");
    assert_eq!(1, snapshot.total_events);
    assert_eq!(1, snapshot.total_failures);
}

#[derive(Default)]
struct RecordingOutputExecutor {
    executed_count: usize,
}

impl OutputExecutor for RecordingOutputExecutor {
    fn execute(&mut self, _result: &SubmitRelayEventResult) -> Result<(), String> {
        self.executed_count += 1;
        Ok(())
    }

    fn execute_with_report(&mut self, result: &SubmitRelayEventResult) -> OutputExecutionReport {
        self.executed_count += 1;
        let mut report = OutputExecutionReport::default();
        for output in &result.outputs {
            if output.output_type == HardwareOutputType::SystemNotification {
                report.push(output.output_type, output.rule_id.clone(), true);
            }
        }
        report
    }
}

fn request(source: &str, event: &str) -> SubmitRelayEventRequest {
    SubmitRelayEventRequest {
        source: source.to_string(),
        event: event.to_string(),
        payload: "{}".to_string(),
        raw_payload: None,
        occurred_at: "2026-06-18T10:00:30+08:00".to_string(),
    }
}

fn current_occurred_at() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .expect("current time should format")
}

fn profile_with_rules(hardware_rules: Vec<HardwareRule>) -> NoticeProfile {
    NoticeProfile {
        id: "pipeline-test".to_string(),
        name: "Pipeline Test".to_string(),
        enabled_hook_events: vec![EnabledHookEvent {
            source: "codex".to_string(),
            event: "SessionStart".to_string(),
        }],
        ai_event_mappings: vec![crate::core::profiles::AiEventMapping {
            id: "codex-session-start".to_string(),
            source: "codex".to_string(),
            event: "SessionStart".to_string(),
            internal_event: "agent.started".to_string(),
            enabled: true,
        }],
        hardware_rules,
        device: default_device_profile(),
    }
}

fn system_notification_rule(id: &str, internal_event: &str) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output: output_with_type(HardwareOutputType::SystemNotification),
        priority: 90,
        enabled: true,
    }
}

fn device_channel_rule(
    id: &str,
    internal_event: &str,
    device_id: &str,
    channel_id: &str,
    action: DeviceChannelActionType,
) -> HardwareRule {
    let mut output = output_with_type(HardwareOutputType::DeviceChannel);
    output.channel_actions = vec![DeviceChannelRuleAction {
        id: "a1".to_string(),
        device_id: device_id.to_string(),
        channel_id: channel_id.to_string(),
        channel_action: action,
        duration_ms: None,
        interval_ms: None,
        duty_percent: None,
        frequency_hz: None,
        color: None,
        brightness_percent: None,
        pattern: None,
        display_template_id: None,
        display_accent: None,
        display_icon: None,
        display_lines_template: None,
        display_status: None,
        display_title_template: None,
        display_message_template: None,
        display_title_max_chars: None,
        display_message_max_chars: None,
    }];
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output,
        priority: 80,
        enabled: true,
    }
}

fn display_rule(id: &str, internal_event: &str, device_id: &str) -> HardwareRule {
    let mut output = output_with_type(HardwareOutputType::Display);
    output.display_device_id = Some(device_id.to_string());
    output.display_status = Some("success".to_string());
    output.display_title_template = Some("{{source}} started".to_string());
    output.display_message_template = Some("{{last_assistant_message}}".to_string());
    output.display_title_max_chars = Some(39);
    output.display_message_max_chars = Some(95);
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output,
        priority: 80,
        enabled: true,
    }
}

fn output_with_type(output_type: HardwareOutputType) -> HardwareOutput {
    HardwareOutput {
        output_type,
        channel_actions: Vec::new(),
        duration_ms: None,
        text: None,
        notification_level: Some("info".to_string()),
        notification_title: Some("{{source}}".to_string()),
        notification_body: Some("{{event}}".to_string()),
        notification_title_max_chars: Some(80),
        notification_body_max_chars: Some(300),
        notification_throttle_seconds: Some(30),
        notification_sound: None,
        webhook_method: None,
        webhook_url: None,
        webhook_headers: None,
        webhook_body: None,
        webhook_body_max_chars: None,
        sound_file_path: None,
        sound_volume_percent: None,
        sound_max_duration_ms: None,
        sound_throttle_seconds: None,
        display_device_id: None,
        display_template_id: None,
        display_accent: None,
        display_icon: None,
        display_lines_template: None,
        display_status: None,
        display_title_template: None,
        display_message_template: None,
        display_title_max_chars: None,
        display_message_max_chars: None,
        display_expire_behavior: None,
        desktop_notice_targets: Vec::new(),
    }
}

fn test_device(device_id: &str) -> DeviceInstance {
    DeviceInstance {
        id: device_id.to_string(),
        label: device_id.to_string(),
        board_id: "rp2040-pico".to_string(),
        device_uid: None,
        transport: DeviceTransportConfig::serial("/dev/tty.usbmodem-test", 115200),
        channels: vec![test_digital_channel(2), test_digital_channel(3)],
        enabled: true,
    }
}

fn wio_device(device_id: &str) -> DeviceInstance {
    DeviceInstance {
        id: device_id.to_string(),
        label: device_id.to_string(),
        board_id: "seeed-wio-terminal".to_string(),
        device_uid: Some(format!("{device_id}-uid")),
        transport: DeviceTransportConfig::serial("/dev/tty.usbmodem-wio-test", 115200),
        channels: Vec::new(),
        enabled: true,
    }
}

fn test_digital_channel(pin: u8) -> DeviceChannel {
    DeviceChannel::digital_output(
        &format!("pin.gp{pin}"),
        &format!("GP{pin}"),
        pin,
        ActiveLevel::High,
        ActiveLevel::Low,
    )
}
