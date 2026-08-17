use super::DeviceOutputDispatcher;
use crate::app_services::device_runtime_registry::DeviceRuntimeRegistry;
use crate::core::device::{
    ActiveLevel, DeviceChannel, DeviceChannelAction, DeviceChannelActionType,
    DeviceCommandOutputType, DeviceExtensionAction, DeviceExtensionActionType, DeviceInstance,
    DeviceTransportConfig, OutputExecutionAction, OutputExecutionPlan,
};
use crate::infrastructure::transports::mock::MockDeviceTransport;

#[test]
fn empty_plan_does_not_execute_any_action() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");
    let plan = OutputExecutionPlan {
        internal_event: "agent.started".to_string(),
        actions: Vec::new(),
    };

    let results = DeviceOutputDispatcher::dispatch(&plan, &mut registry);

    assert!(results.is_empty());
    assert!(registry.sent_lines("desk-pico").is_empty());
}

#[test]
fn dispatch_attempts_all_actions() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");
    registry
        .connect_with_transport("lab-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");
    let plan = OutputExecutionPlan {
        internal_event: "agent.failed".to_string(),
        actions: vec![
            test_plan_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate),
            test_plan_action("lab-pico", "pin.gp3", DeviceChannelActionType::Blink),
        ],
    };

    let results = DeviceOutputDispatcher::dispatch(&plan, &mut registry);

    assert_eq!(2, results.len());
    assert_eq!(vec!["sent", "sent"], result_statuses(&results));
    assert_eq!(1, registry.sent_lines("desk-pico").len());
    assert_eq!(1, registry.sent_lines("lab-pico").len());
}

#[test]
fn failed_action_does_not_block_later_actions() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);
    let mut failing_transport = MockDeviceTransport::default();
    failing_transport.fail_send_with("write failed");
    registry
        .connect_with_transport("desk-pico", Box::new(failing_transport))
        .expect("device should connect");
    registry
        .connect_with_transport("lab-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");
    let plan = OutputExecutionPlan {
        internal_event: "agent.failed".to_string(),
        actions: vec![
            test_plan_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate),
            test_plan_action("lab-pico", "pin.gp3", DeviceChannelActionType::Activate),
        ],
    };

    let results = DeviceOutputDispatcher::dispatch(&plan, &mut registry);

    assert_eq!(vec!["failed", "sent"], result_statuses(&results));
    assert_eq!(1, registry.sent_lines("lab-pico").len());
}

#[test]
fn disconnected_device_returns_skipped_result() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    let plan = OutputExecutionPlan {
        internal_event: "agent.started".to_string(),
        actions: vec![test_plan_action(
            "desk-pico",
            "pin.gp2",
            DeviceChannelActionType::Activate,
        )],
    };

    let results = DeviceOutputDispatcher::dispatch(&plan, &mut registry);

    assert_eq!(1, results.len());
    assert_eq!("skipped", results[0].status);
    assert_eq!(
        Some("device is not connected".to_string()),
        results[0].error
    );
}

#[test]
fn dispatch_sends_device_extension_actions() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-wio")]);
    registry
        .connect_with_transport(
            "desk-wio",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string(),
            ])),
        )
        .expect("device should connect");
    let plan = OutputExecutionPlan {
        internal_event: "agent.completed".to_string(),
        actions: vec![OutputExecutionAction::DeviceExtension(
            DeviceExtensionAction {
                device_id: "desk-wio".to_string(),
                channel_id: None,
                action: DeviceExtensionActionType::DisplayStatus,
                status: Some("success".to_string()),
                title: Some("Done".to_string()),
                message: Some("Build passed".to_string()),
                icon: None,
                lines: None,
                pattern: None,
                control: None,
                active: None,
            },
        )],
    };

    let results = DeviceOutputDispatcher::dispatch(&plan, &mut registry);

    assert_eq!(1, results.len());
    assert_eq!("desk-wio", results[0].device_id);
    assert_eq!("display", results[0].channel_id);
    assert_eq!(DeviceCommandOutputType::Display, results[0].output_type);
    assert_eq!("sent", results[0].status);
}

fn result_statuses(results: &[crate::core::device::DeviceCommandResult]) -> Vec<&str> {
    results
        .iter()
        .map(|result| result.status.as_str())
        .collect()
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

fn test_digital_channel(pin: u8) -> DeviceChannel {
    DeviceChannel::digital_output(
        &format!("pin.gp{pin}"),
        &format!("GP{pin}"),
        pin,
        ActiveLevel::High,
        ActiveLevel::Low,
    )
}

fn test_action(
    device_id: &str,
    channel_id: &str,
    action: DeviceChannelActionType,
) -> DeviceChannelAction {
    DeviceChannelAction {
        device_id: device_id.to_string(),
        channel_id: channel_id.to_string(),
        action,
        duration_ms: None,
        interval_ms: None,
        duty_percent: None,
        frequency_hz: None,
        color: None,
        brightness_percent: None,
        pattern: None,
        priority: 50,
    }
}

fn test_plan_action(
    device_id: &str,
    channel_id: &str,
    action: DeviceChannelActionType,
) -> OutputExecutionAction {
    OutputExecutionAction::DeviceChannel(test_action(device_id, channel_id, action))
}
