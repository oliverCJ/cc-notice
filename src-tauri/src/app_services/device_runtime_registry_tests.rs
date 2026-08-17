use super::DeviceRuntimeRegistry;
use crate::core::device::DeviceOperationKind;
use crate::core::device::{
    ActiveLevel, DeviceChannel, DeviceChannelAction, DeviceChannelActionType,
    DeviceConnectionStatus, DeviceHeartbeatStatus, DeviceInstance, DeviceTransportConfig,
};
use crate::infrastructure::transports::mock::MockDeviceTransport;

#[test]
fn registry_maintains_multiple_device_states() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);

    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    let states = registry.states();

    assert_eq!(2, states.len());
    assert_eq!(Some("desk-pico".to_string()), states[0].device_id);
    assert_eq!(DeviceConnectionStatus::Connected, states[0].status);
    assert_eq!(Some("lab-pico".to_string()), states[1].device_id);
    assert_eq!(DeviceConnectionStatus::Disconnected, states[1].status);
}

#[test]
fn connected_device_count_counts_only_connected_devices() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);

    assert_eq!(0, registry.connected_device_count());

    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    assert_eq!(1, registry.connected_device_count());
}

#[test]
fn registry_routes_action_by_device_id() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);
    registry
        .connect_with_transport(
            "lab-pico",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                "{\"ok\":true}".to_string(),
            ])),
        )
        .expect("device should connect");

    let result = registry.send_action(&test_action(
        "lab-pico",
        "pin.gp3",
        DeviceChannelActionType::Blink,
    ));

    assert_eq!("lab-pico", result.device_id);
    assert_eq!("pin.gp3", result.channel_id);
    assert_eq!("sent", result.status);
    assert_eq!(
        vec!["{\"v\":2,\"type\":\"digital_blink\",\"channel\":\"pin.gp3\"}\n"],
        registry.sent_lines("lab-pico")
    );
    assert!(registry.sent_lines("desk-pico").is_empty());
}

#[test]
fn registry_routes_ping_by_device_id() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);
    registry
        .connect_with_transport(
            "lab-pico",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"pong"}"#.to_string(),
            ])),
        )
        .expect("device should connect");

    let state = registry.ping("lab-pico").expect("ping should route");

    assert_eq!(DeviceHeartbeatStatus::Healthy, state.heartbeat_status);
    assert_eq!(
        vec!["{\"v\":2,\"type\":\"ping\"}\n"],
        registry.sent_lines("lab-pico")
    );
    assert!(registry.sent_lines("desk-pico").is_empty());
}

#[test]
fn ping_connected_devices_only_pings_connected_runtime_services() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);
    registry
        .connect_with_transport(
            "lab-pico",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                r#"{"ok":true,"v":2,"type":"pong"}"#.to_string(),
            ])),
        )
        .expect("device should connect");

    let states = registry.ping_connected_devices();

    let lab_state = states
        .iter()
        .find(|state| state.device_id.as_deref() == Some("lab-pico"))
        .expect("lab state should exist");
    assert_eq!(DeviceHeartbeatStatus::Healthy, lab_state.heartbeat_status);
    assert_eq!(
        vec!["{\"v\":2,\"type\":\"ping\"}\n"],
        registry.sent_lines("lab-pico")
    );
    assert!(registry.sent_lines("desk-pico").is_empty());
}

#[test]
fn begin_device_operation_marks_state_busy() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);

    let operation = registry
        .begin_operation(
            "desk-pico",
            DeviceOperationKind::ManualConnect,
            12_000,
            true,
        )
        .expect("operation should start");

    let state = registry.state("desk-pico").expect("state should exist");
    assert_eq!(
        Some(operation.operation_id),
        state.active_operation.map(|value| value.operation_id)
    );
}

#[test]
fn cancel_device_operation_sets_cooldown_and_clears_operation() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    let operation = registry
        .begin_operation(
            "desk-pico",
            DeviceOperationKind::ManualConnect,
            12_000,
            true,
        )
        .expect("operation should start");

    registry
        .cancel_operation("desk-pico", operation.operation_id)
        .expect("operation should cancel");

    let state = registry.state("desk-pico").expect("state should exist");
    assert!(state.active_operation.is_none());
    assert!(state.auto_reconnect_blocked_until.is_some());
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert_eq!(Some("operation_cancelled".to_string()), state.last_error);
}

#[test]
fn one_device_failure_does_not_affect_another_device_state() {
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

    let failed = registry.send_action(&test_action(
        "desk-pico",
        "pin.gp2",
        DeviceChannelActionType::Activate,
    ));
    let sent = registry.send_action(&test_action(
        "lab-pico",
        "pin.gp3",
        DeviceChannelActionType::Activate,
    ));

    assert_eq!("failed", failed.status);
    assert_eq!("sent", sent.status);
    assert_eq!(
        DeviceConnectionStatus::Error,
        registry.state("desk-pico").expect("desk state").status
    );
    assert_eq!(
        DeviceConnectionStatus::Connected,
        registry.state("lab-pico").expect("lab state").status
    );
}

#[test]
fn stale_prepared_action_result_is_discarded_after_reconnect() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport(
            "desk-pico",
            Box::new(MockDeviceTransport::with_received_lines(vec![
                "{\"ok\":true}".to_string(),
            ])),
        )
        .expect("device should connect");
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);
    let prepared = registry
        .prepare_action_command(&action)
        .expect("command should prepare on first connection");

    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should reconnect");

    let session_id = prepared.session_id;
    let result = prepared.worker.send_protocol_command(prepared.command);
    let completed = registry.complete_action_command(&action, session_id, result);

    assert_eq!("skipped", completed.status);
    assert_eq!(
        Some("device connection changed before command completed".to_string()),
        completed.error
    );
    let state = registry.state("desk-pico").expect("state should exist");
    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert!(state.last_sent_at.is_none());
}

#[test]
fn unknown_device_action_returns_skipped_result() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);

    let result = registry.send_action(&test_action(
        "missing-pico",
        "pin.gp2",
        DeviceChannelActionType::Activate,
    ));

    assert_eq!("missing-pico", result.device_id);
    assert_eq!("pin.gp2", result.channel_id);
    assert_eq!("skipped", result.status);
    assert_eq!(Some("device is not registered".to_string()), result.error);
}

#[test]
fn registry_can_register_new_device() {
    let mut registry = DeviceRuntimeRegistry::new(Vec::new());

    registry.register_device(test_device("desk-pico"));

    let state = registry.state("desk-pico").expect("device should register");
    assert_eq!(Some("desk-pico".to_string()), state.device_id);
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
}

#[test]
fn registry_can_remove_registered_device() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);

    registry
        .remove_device("desk-pico")
        .expect("registered device should be removable");

    assert!(registry.state("desk-pico").is_none());
    assert!(registry.state("lab-pico").is_some());
}

#[test]
fn registering_existing_device_replaces_runtime_state() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    registry.register_device(test_device_with_port("desk-pico", "/dev/tty.usbmodem-new"));

    let state = registry.state("desk-pico").expect("device should exist");
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert_eq!(
        Some("/dev/tty.usbmodem-new".to_string()),
        state.transport.and_then(|transport| transport.serial_port)
    );
}

#[test]
fn manual_disconnect_sets_reconnect_suppression() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    registry
        .disconnect_manually("desk-pico")
        .expect("manual disconnect should work");

    let state = registry.state("desk-pico").expect("device should exist");
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert!(state.manual_reconnect_suppressed);
}

#[test]
fn reconnect_suppression_is_not_persisted_across_registry_rebuild() {
    let device = test_device("desk-pico");
    let mut registry = DeviceRuntimeRegistry::new(vec![device.clone()]);
    registry
        .disconnect_manually("desk-pico")
        .expect("manual disconnect should work");
    assert!(
        registry
            .state("desk-pico")
            .expect("device should exist")
            .manual_reconnect_suppressed
    );

    let rebuilt_registry = DeviceRuntimeRegistry::new(vec![device]);

    assert!(
        !rebuilt_registry
            .state("desk-pico")
            .expect("device should exist")
            .manual_reconnect_suppressed
    );
}

#[test]
fn manual_disconnect_all_sets_reconnect_suppression() {
    let mut registry =
        DeviceRuntimeRegistry::new(vec![test_device("desk-pico"), test_device("lab-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");
    registry
        .connect_with_transport("lab-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    registry.disconnect_all_manually();

    assert!(registry
        .states()
        .iter()
        .all(|state| state.manual_reconnect_suppressed));
}

#[test]
fn manual_connect_clears_reconnect_suppression() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .disconnect_manually("desk-pico")
        .expect("manual disconnect should work");

    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("manual connect should work");

    let state = registry.state("desk-pico").expect("device should exist");
    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert!(!state.manual_reconnect_suppressed);
}

#[test]
fn register_device_if_absent_keeps_existing_runtime_state() {
    let mut registry = DeviceRuntimeRegistry::new(vec![test_device("desk-pico")]);
    registry
        .connect_with_transport("desk-pico", Box::new(MockDeviceTransport::default()))
        .expect("device should connect");

    registry.register_device_if_absent(test_device_with_port("desk-pico", "/dev/tty.usbmodem-new"));

    let state = registry.state("desk-pico").expect("device should exist");
    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert_eq!(
        Some("/dev/tty.usbmodem-test".to_string()),
        state.transport.and_then(|transport| transport.serial_port)
    );
}

#[test]
fn connecting_unknown_device_returns_error() {
    let mut registry = DeviceRuntimeRegistry::new(Vec::new());

    let error = registry
        .connect_with_transport("missing-pico", Box::new(MockDeviceTransport::default()))
        .expect_err("unknown device should fail");

    assert_eq!("device is not registered: missing-pico", error);
}

fn test_device(device_id: &str) -> DeviceInstance {
    test_device_with_port(device_id, "/dev/tty.usbmodem-test")
}

fn test_device_with_port(device_id: &str, serial_port: &str) -> DeviceInstance {
    DeviceInstance {
        id: device_id.to_string(),
        label: device_id.to_string(),
        board_id: "rp2040-pico".to_string(),
        device_uid: None,
        transport: DeviceTransportConfig::serial(serial_port, 115200),
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
