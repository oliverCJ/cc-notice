use std::sync::{Arc, Mutex};

use super::{DeviceInputEventCallback, DeviceRuntimeService};
use crate::app_services::device_io_worker::{DeviceIoError, DeviceIoErrorCode};
use crate::core::device::{
    ActiveLevel, DeviceChannel, DeviceChannelAction, DeviceChannelActionType,
    DeviceConnectionStatus, DeviceExtensionAction, DeviceExtensionActionType, DeviceFirmwareStatus,
    DeviceHeartbeatStatus, DeviceInstance, DeviceOperationKind, DeviceRuntimeErrorCode,
    DeviceTransportConfig,
};
use crate::core::firmware::FirmwareArtifact;
use crate::infrastructure::transports::mock::MockDeviceTransport;

#[test]
fn send_action_returns_skipped_when_device_is_not_connected() {
    let device = test_device("desk-pico");
    let mut service = DeviceRuntimeService::new(device);
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("desk-pico", result.device_id);
    assert_eq!("pin.gp2", result.channel_id);
    assert_eq!("skipped", result.status);
    assert_eq!(Some("device is not connected".to_string()), result.error);
}

#[test]
fn connected_mock_transport_sends_protocol_v2_line_and_reads_ack() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec!["{\"ok\":true}".to_string()]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("sent", result.status);
    assert_eq!(Some("{\"ok\":true}".to_string()), result.ack);
    assert_eq!(None, result.error);
    assert_eq!(
        vec!["{\"v\":2,\"type\":\"digital_write\",\"channel\":\"pin.gp2\",\"state\":\"active\"}\n"],
        service.sent_lines()
    );
}

#[test]
fn connected_worker_dispatches_background_input_event_without_command() {
    let mut device = test_device("desk-wio");
    device.channels.push(DeviceChannel {
        id: "input.button.a".to_string(),
        label: "Button A".to_string(),
        kind: crate::core::device::DeviceChannelKind::ButtonInput,
        direction: crate::core::device::DeviceChannelDirection::Input,
        description: Some("Button A".to_string()),
        physical_pin: None,
        digital_output: None,
        pwm_output: None,
        buzzer: None,
        addressable_led: None,
        input: Some(crate::core::device::DeviceInputConfig {
            control: "button.a".to_string(),
            input_kind: crate::core::device::DeviceInputKind::Button,
            fixed: true,
        }),
        supported_actions: Vec::new(),
        hardware_guide_id: None,
    });
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"v":2,"type":"input_event","control":"button.a","action":"press","seq":18}"#
            .to_string(),
    ]);
    let received = Arc::new(Mutex::new(Vec::new()));
    let callback_received = Arc::clone(&received);
    let callback: DeviceInputEventCallback = Arc::new(move |event| {
        callback_received
            .lock()
            .expect("test input event lock should succeed")
            .push(event);
    });
    let mut service = DeviceRuntimeService::new(device);

    service.connect_with_transport_and_input_callback(Box::new(transport), Some(callback));

    std::thread::sleep(std::time::Duration::from_millis(80));
    let events = received
        .lock()
        .expect("test input event lock should succeed")
        .clone();
    assert_eq!(1, events.len());
    assert_eq!("desk-wio", events[0].device_id);
    assert_eq!("input.button.a", events[0].channel_id);
    assert_eq!("button.a", events[0].control);
    assert_eq!(18, events[0].seq);
}

#[test]
fn connected_transport_skips_stale_untyped_error_before_matching_action_ack() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
        r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("sent", result.status);
    assert_eq!(
        Some(r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string()),
        result.ack
    );
    assert_eq!(
        vec!["{\"v\":2,\"type\":\"digital_write\",\"channel\":\"pin.gp2\",\"state\":\"active\"}\n"],
        service.sent_lines()
    );
}

#[test]
fn connected_transport_accepts_channel_error_for_current_action() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"unsupported_command","channel":"pin.gp2"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some(r#"{"ok":false,"v":2,"error":"unsupported_command","channel":"pin.gp2"}"#.to_string()),
        result.ack
    );
    assert_eq!(Some("unsupported_command".to_string()), result.error);
    assert_eq!(DeviceConnectionStatus::Connected, service.state().status);
}

#[test]
fn connected_transport_ignores_stale_ack_for_different_channel_before_matching_action_ack() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp3"}"#.to_string(),
        r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("sent", result.status);
    assert_eq!(
        Some(r#"{"ok":true,"v":2,"type":"digital_write","channel":"pin.gp2"}"#.to_string()),
        result.ack
    );
    assert_eq!(
        vec!["{\"v\":2,\"type\":\"digital_write\",\"channel\":\"pin.gp2\",\"state\":\"active\"}\n"],
        service.sent_lines()
    );
}

#[test]
fn connected_transport_reports_failed_when_action_ack_is_error() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some(r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string()),
        result.ack
    );
    assert_eq!(
        Some(
            "device firmware does not support current output command; please rebuild and flash the latest firmware"
                .to_string()
        ),
        result.error
    );
    assert_eq!(DeviceConnectionStatus::Connected, service.state().status);
}

#[test]
fn display_card_falls_back_to_display_status_when_firmware_does_not_support_card() {
    let device = test_device("desk-wio");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
        r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_display_card_action("desk-wio");

    let result = service.send_extension_action(&action);

    assert_eq!("sent", result.status);
    assert_eq!(
        Some(r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string()),
        result.ack
    );
    assert_eq!(None, result.error);
    assert_eq!(
        vec![
            "{\"v\":2,\"type\":\"display_card\",\"status\":\"success\",\"title\":\"Task Done\",\"message\":\"Codex / Finished\",\"icon\":\"check\",\"lines\":[\"Codex\",\"Finished\"]}\n",
            "{\"v\":2,\"type\":\"display_status\",\"status\":\"success\",\"title\":\"Task Done\",\"message\":\"Codex / Finished\"}\n",
        ],
        service.sent_lines()
    );
}

#[test]
fn display_lines_falls_back_to_display_status_when_firmware_does_not_support_lines() {
    let device = test_device("desk-wio");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
        r#"{"ok":true,"v":2,"type":"display_status"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_display_lines_action("desk-wio");

    let result = service.send_extension_action(&action);

    assert_eq!("sent", result.status);
    assert_eq!(
        vec![
            "{\"v\":2,\"type\":\"display_lines\",\"lines\":[\"Codex\",\"Waiting\"]}\n",
            "{\"v\":2,\"type\":\"display_status\",\"status\":\"notice\",\"title\":\"CC Notice\",\"message\":\"Codex / Waiting\"}\n",
        ],
        service.sent_lines()
    );
}

#[test]
fn connected_transport_keeps_connection_when_action_ack_is_missing() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::default();
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some("device action response timed out".to_string()),
        result.error
    );
    assert_eq!(
        Some("device action response timed out".to_string()),
        service.state().last_error
    );
    assert_eq!(DeviceConnectionStatus::Connected, service.state().status);
}

#[test]
fn runtime_state_exposes_configured_channels() {
    let device = test_device("desk-pico");
    let service = DeviceRuntimeService::new(device);

    let state = service.state();

    assert_eq!(vec!["pin.gp2"], channel_ids(&state.channels));
}

#[test]
fn expired_auto_reconnect_cooldown_is_cleared() {
    let device = test_device("desk-pico");
    let mut service = DeviceRuntimeService::new(device);
    service
        .begin_operation(DeviceOperationKind::ManualConnect, 12_000, true)
        .expect("operation should start");
    let operation_id = service
        .state()
        .active_operation
        .expect("operation should be visible")
        .operation_id;
    service
        .cancel_operation(operation_id)
        .expect("operation should cancel");
    service.state.auto_reconnect_blocked_until = Some("2000-01-01T00:00:00Z".to_string());

    assert!(!service.auto_reconnect_blocked());
    assert!(service.state().auto_reconnect_blocked_until.is_none());
}

#[test]
fn send_action_rejects_channel_not_configured_on_device() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec!["{\"ok\":true}".to_string()]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp28", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some("device channel is not configured".to_string()),
        result.error
    );
    assert_eq!(
        Some(DeviceRuntimeErrorCode::DeviceChannelNotConfigured),
        result.error_code
    );
    assert!(service.sent_lines().is_empty());
}

#[test]
fn send_action_rejects_action_not_supported_by_configured_channel() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec!["{\"ok\":true}".to_string()]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Clear);

    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some("device channel action is not supported".to_string()),
        result.error
    );
    assert_eq!(
        Some(DeviceRuntimeErrorCode::DeviceChannelActionUnsupported),
        result.error_code
    );
    assert!(service.sent_lines().is_empty());
}

#[test]
fn send_failure_updates_last_error_and_returns_failed_result() {
    let device = test_device("desk-pico");
    let mut transport = MockDeviceTransport::default();
    transport.fail_send_with("serial write failed");
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);

    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(Some("serial write failed".to_string()), result.error);
    assert_eq!(
        Some(DeviceRuntimeErrorCode::DeviceTransportError),
        result.error_code
    );
    assert_eq!(
        Some("serial write failed".to_string()),
        service.state().last_error
    );
    assert_eq!(DeviceConnectionStatus::Error, service.state().status);
}

#[test]
fn disconnect_clears_transport_and_marks_state_disconnected() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::default();
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service.disconnect();

    assert_eq!(DeviceConnectionStatus::Disconnected, service.state().status);
    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);
    assert_eq!("skipped", service.send_action(&action).status);
}

#[test]
fn query_device_info_sends_protocol_v2_device_info_command() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.1","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.1", 2))
        .expect("device info should query");

    assert_eq!(
        vec!["{\"v\":2,\"type\":\"device_info\"}\n"],
        service.sent_lines()
    );
    assert_eq!(
        DeviceFirmwareStatus::UpToDate,
        service.state().firmware_status
    );
    assert_eq!(
        Some("0.2.1".to_string()),
        service
            .state()
            .firmware_info
            .map(|info| info.firmware_version)
    );
}

#[test]
fn query_device_info_retries_when_board_reboots_after_serial_open() {
    let device = test_device("desk-uno");
    let transport = MockDeviceTransport::with_received_attempts(vec![
        None,
        None,
        Some(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.1","protocol_version":2}"#
                .to_string(),
        ),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.1", 2))
        .expect("device info should query after retry");

    assert_eq!(
        vec![
            "{\"v\":2,\"type\":\"device_info\"}\n",
            "{\"v\":2,\"type\":\"device_info\"}\n",
            "{\"v\":2,\"type\":\"device_info\"}\n"
        ],
        service.sent_lines()
    );
    assert_eq!(
        DeviceFirmwareStatus::UpToDate,
        service.state().firmware_status
    );
}

#[test]
fn query_device_info_skips_empty_command_noise_from_serial_startup() {
    let device = test_device("desk-uno");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"empty_command"}"#.to_string(),
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.1","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.1", 2))
        .expect("device info should skip serial startup noise");

    assert_eq!(
        DeviceFirmwareStatus::UpToDate,
        service.state().firmware_status
    );
    assert_eq!(
        Some("rp2040-pico:0011223344556677".to_string()),
        service.state().device_uid
    );
}

#[test]
fn query_device_info_stores_device_uid() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.3","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.3", 2))
        .expect("device info should query");

    assert_eq!(
        Some("rp2040-pico:0011223344556677".to_string()),
        service.state().device_uid
    );
}

#[test]
fn query_device_info_uses_transport_fallback_uid_for_limited_identity_board() {
    let mut device = test_device("desk-uno");
    device.board_id = "arduino-uno".to_string();
    device.transport = DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200);
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"","firmware_version":"0.2.0","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact_for_board("arduino-uno", "0.2.0", 2))
        .expect("limited identity device info should query");

    assert_eq!(
        Some("arduino-uno:serial:dev-cu-usbserial-uno".to_string()),
        service.state().device_uid
    );
    assert_eq!(
        DeviceFirmwareStatus::UpToDate,
        service.state().firmware_status
    );
}

#[test]
fn query_device_info_rejects_empty_device_uid_for_required_identity_board() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"","firmware_version":"0.2.3","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.3", 2))
        .expect("query should convert firmware parse error into state");

    assert_eq!(
        DeviceFirmwareStatus::Unknown,
        service.state().firmware_status
    );
    assert_eq!(
        Some("device_info response empty device_uid".to_string()),
        service.state().firmware_check_error
    );
}

#[test]
fn query_device_info_uses_ack_version_when_limited_identity_board_omits_protocol_version() {
    let mut device = test_device("desk-uno");
    device.board_id = "arduino-uno".to_string();
    device.transport = DeviceTransportConfig::serial("/dev/cu.usbserial-uno", 115200);
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"arduino-uno","device_uid":"","firmware_version":"0.2.0"}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact_for_board("arduino-uno", "0.2.0", 2))
        .expect("limited identity device info should infer protocol version from ack version");

    assert_eq!(
        Some(2),
        service
            .state()
            .firmware_info
            .map(|info| info.protocol_version)
    );
    assert_eq!(
        DeviceFirmwareStatus::UpToDate,
        service.state().firmware_status
    );
}

#[test]
fn query_device_info_marks_update_available_when_device_firmware_is_older() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.0","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.1", 2))
        .expect("device info should query");

    assert_eq!(
        DeviceFirmwareStatus::UpdateAvailable,
        service.state().firmware_status
    );
    assert_eq!(
        Some("0.2.1".to_string()),
        service.state().bundled_firmware_version
    );
}

#[test]
fn query_device_info_treats_missing_patch_version_as_equivalent_zero() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2","protocol_version":2}"#
            .to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.0", 2))
        .expect("device info should query");

    assert_eq!(
        DeviceFirmwareStatus::UpToDate,
        service.state().firmware_status
    );
}

#[test]
fn query_device_info_marks_unsupported_when_old_firmware_rejects_command() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":false,"v":2,"error":"unsupported_command"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.1", 2))
        .expect("unsupported device info should be converted to runtime status");

    assert_eq!(
        DeviceFirmwareStatus::Unsupported,
        service.state().firmware_status
    );
    assert_eq!(
        Some("device_info is not supported by current firmware".to_string()),
        service.state().firmware_check_error
    );
}

#[test]
fn ping_updates_heartbeat_status_to_healthy() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::with_received_lines(vec![
        r#"{"ok":true,"v":2,"type":"pong"}"#.to_string(),
    ]);
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service.ping().expect("ping should send");

    let state = service.state();
    assert_eq!(DeviceHeartbeatStatus::Healthy, state.heartbeat_status);
    assert_eq!(0, state.heartbeat_failure_count);
    assert!(state.last_heartbeat_at.is_some());
}

#[test]
fn ping_transport_error_marks_device_disconnected_and_release_transport() {
    let device = test_device("desk-pico");
    let mut transport = MockDeviceTransport::default();
    transport.fail_send_with("device disconnected");
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .ping()
        .expect("transport failure should be recorded");

    let state = service.state();
    assert_eq!(DeviceHeartbeatStatus::Lost, state.heartbeat_status);
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert!(service.sent_lines().is_empty());
}

#[test]
fn ping_timeouts_mark_heartbeat_lost_without_stopping_worker() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::default();
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .ping()
        .expect("first ping timeout should be recorded");
    service
        .ping()
        .expect("second ping timeout should be recorded");
    service
        .ping()
        .expect("third ping timeout should mark heartbeat lost");

    let state = service.state();
    assert_eq!(DeviceHeartbeatStatus::Lost, state.heartbeat_status);
    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert_eq!(3, state.heartbeat_failure_count);

    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);
    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some("device action response timed out".to_string()),
        result.error
    );
}

#[test]
fn ping_timeout_uses_error_code_instead_of_message_text() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::default();
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let prepared = service
        .prepare_ping_command()
        .expect("connected device should prepare ping");

    service
        .complete_ping_command(
            prepared.session_id,
            Err(DeviceIoError::new(
                DeviceIoErrorCode::ActionTimeout,
                "localized timeout message",
            )),
        )
        .expect("ping timeout should be recorded");

    let state = service.state();
    assert_eq!(DeviceHeartbeatStatus::Stale, state.heartbeat_status);
    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert_eq!(1, state.heartbeat_failure_count);
    assert_eq!(
        Some("localized timeout message".to_string()),
        state.last_error
    );
}

#[test]
fn device_info_timeout_uses_error_code_instead_of_message_text() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::default();
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let prepared = service
        .prepare_device_info_query()
        .expect("connected device should prepare device info query");

    service
        .complete_device_info_query(
            prepared.session_id,
            &bundled_artifact("0.2.3", 2),
            Err(DeviceIoError::new(
                DeviceIoErrorCode::DeviceInfoTimeout,
                "localized device info timeout",
            )),
        )
        .expect("device info timeout should be recorded");

    let state = service.state();
    assert_eq!(DeviceConnectionStatus::Connected, state.status);
    assert_eq!(DeviceFirmwareStatus::Unknown, state.firmware_status);
    assert_eq!(
        Some("localized device info timeout".to_string()),
        state.firmware_check_error
    );
}

#[test]
fn background_read_error_stops_worker_without_retrying_forever() {
    let device = test_device("desk-pico");
    let mut transport = MockDeviceTransport::default();
    transport.fail_read_with("Broken pipe");
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    std::thread::sleep(std::time::Duration::from_millis(80));
    let state = service.state();
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert_eq!(DeviceHeartbeatStatus::Lost, state.heartbeat_status);

    let action = test_action("desk-pico", "pin.gp2", DeviceChannelActionType::Activate);
    let result = service.send_action(&action);

    assert_eq!("failed", result.status);
    assert_eq!(
        Some("device io worker is not running".to_string()),
        result.error
    );
}

#[test]
fn device_info_transport_error_marks_device_disconnected() {
    let device = test_device("desk-pico");
    let mut transport = MockDeviceTransport::default();
    transport.fail_send_with("Broken pipe");
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));

    service
        .query_device_info(&bundled_artifact("0.2.3", 2))
        .expect("device info transport error should be recorded");

    let state = service.state();
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert_eq!(Some("Broken pipe".to_string()), state.last_error);
    assert_eq!(Some("Broken pipe".to_string()), state.firmware_check_error);
}

#[test]
fn set_device_uid_transport_error_records_error_code() {
    let device = test_device("desk-pico");
    let transport = MockDeviceTransport::default();
    let mut service = DeviceRuntimeService::new(device);
    service.connect_with_transport(Box::new(transport));
    let prepared = service
        .prepare_set_device_uid_command("rp2040-pico:0011223344556677")
        .expect("connected device should prepare set_device_uid");

    let error = service
        .complete_set_device_uid_command(
            prepared.session_id,
            Err(DeviceIoError::new(
                DeviceIoErrorCode::TransportDisconnected,
                "localized transport disconnected",
            )),
        )
        .expect_err("transport error should be returned to caller");

    let state = service.state();
    assert_eq!("localized transport disconnected", error);
    assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
    assert_eq!(
        Some(DeviceRuntimeErrorCode::DeviceTransportDisconnected),
        state.last_error_code
    );
    assert_eq!(
        Some("localized transport disconnected".to_string()),
        state.last_error
    );
}

fn test_device(device_id: &str) -> DeviceInstance {
    DeviceInstance {
        id: device_id.to_string(),
        label: device_id.to_string(),
        board_id: "rp2040-pico".to_string(),
        device_uid: None,
        transport: DeviceTransportConfig::serial("/dev/tty.usbmodem-test", 115200),
        channels: vec![DeviceChannel::digital_output(
            "pin.gp2",
            "GP2",
            2,
            ActiveLevel::High,
            ActiveLevel::Low,
        )],
        enabled: true,
    }
}

fn bundled_artifact(firmware_version: &str, protocol_version: u16) -> FirmwareArtifact {
    bundled_artifact_for_board("rp2040-pico", firmware_version, protocol_version)
}

fn bundled_artifact_for_board(
    board_id: &str,
    firmware_version: &str,
    protocol_version: u16,
) -> FirmwareArtifact {
    FirmwareArtifact {
        target_id: None,
        board_id: board_id.to_string(),
        firmware_version: firmware_version.to_string(),
        protocol_version,
        visible: true,
        toolchain: None,
        artifact_name: format!("cc-notice-{board_id}.uf2"),
        artifact_type: "uf2".to_string(),
        flash_strategy: "uf2_mount_copy".to_string(),
        flash_volume_name: "RPI-RP2".to_string(),
        relative_path: format!("{board_id}/cc-notice-{board_id}.uf2"),
        upload: None,
    }
}

fn channel_ids(channels: &[DeviceChannel]) -> Vec<&str> {
    channels.iter().map(|channel| channel.id.as_str()).collect()
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

fn test_display_card_action(device_id: &str) -> DeviceExtensionAction {
    DeviceExtensionAction {
        device_id: device_id.to_string(),
        channel_id: None,
        action: DeviceExtensionActionType::DisplayCard,
        status: Some("success".to_string()),
        title: Some("Task Done".to_string()),
        message: Some("Codex / Finished".to_string()),
        icon: Some("check".to_string()),
        lines: Some(vec!["Codex".to_string(), "Finished".to_string()]),
        pattern: None,
        control: None,
        active: None,
    }
}

fn test_display_lines_action(device_id: &str) -> DeviceExtensionAction {
    DeviceExtensionAction {
        device_id: device_id.to_string(),
        channel_id: None,
        action: DeviceExtensionActionType::DisplayLines,
        status: None,
        title: None,
        message: None,
        icon: None,
        lines: Some(vec!["Codex".to_string(), "Waiting".to_string()]),
        pattern: None,
        control: None,
        active: None,
    }
}
