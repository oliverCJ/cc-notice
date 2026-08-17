use super::*;
use crate::adapters::boards::rp2040_pico::Rp2040PicoBoardAdapter;
use crate::adapters::boards::BoardAdapter;
use crate::commands::device::runtime::register_default_devices_impl;
use crate::core::app_config::{DeviceInputAction, DeviceInputBinding, DeviceInputTrigger};
use crate::core::device::{
    ActiveLevel, DeviceCandidateHandshakeInfo, DeviceCandidateResource, DeviceChannel,
    DeviceChannelActionType, DeviceChannelDirection, DeviceChannelKind, DeviceConnectionStatus,
    DeviceDiscoveryStatus, DeviceInputConfig, DeviceInputKind, DeviceOperationKind,
};
use crate::core::keyboard_shortcut::KeyboardShortcut;
use crate::core::profiles::DeviceChannelRuleAction;
use crate::test_support::minimal_app_state_for_root;

#[test]
fn default_device_registration_adds_disconnected_rp2040_device() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-default");
    let state = minimal_app_state_for_root(&root);

    register_default_devices_impl(&state).expect("default devices should register");

    let registry = state
        .device_runtime_registry
        .lock()
        .expect("registry lock should work");
    let device = registry
        .state(DEFAULT_RP2040_DEVICE_ID)
        .expect("default device should exist");
    assert_eq!(DeviceConnectionStatus::Disconnected, device.status);
    assert_eq!(Some("rp2040-pico".to_string()), device.board_id);
}

#[test]
fn scan_device_transports_does_not_expose_mock_descriptor() {
    let descriptors = scan_device_transports_impl().expect("transport scan should work");

    assert!(!descriptors
        .iter()
        .any(|descriptor| descriptor.address.starts_with("mock://")));
}

#[test]
fn register_identified_device_persists_device_and_runtime_state() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-register");
    let state = minimal_app_state_for_root(&root);
    let resource = identified_candidate("rp2040-pico:0011223344556677");

    let runtime = register_identified_device_impl(
        &state,
        RegisterIdentifiedDeviceRequest {
            resource,
            label: "Desk Pico".to_string(),
        },
    )
    .expect("identified device should register");

    assert_eq!(
        Some("rp2040-pico:0011223344556677".to_string()),
        runtime.device_uid
    );
    assert_eq!(Some("rp2040-pico".to_string()), runtime.board_id);

    let saved_config = state
        .app_config_service
        .lock()
        .expect("config lock")
        .config();
    assert!(saved_config
        .devices
        .iter()
        .any(|device| device.device_uid.as_deref() == Some("rp2040-pico:0011223344556677")));
}

#[test]
fn register_identified_stm32_blue_pill_uses_catalog_default_channels() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-register-stm32");
    let state = minimal_app_state_for_root(&root);
    let resource = identified_candidate_for_board(
        "stm32f103cx-blue-pill",
        "stm32f103cx-blue-pill:0011223344556677",
        "0.2.0",
    );

    let runtime = register_identified_device_impl(
        &state,
        RegisterIdentifiedDeviceRequest {
            resource,
            label: "Desk Blue Pill".to_string(),
        },
    )
    .expect("identified STM32 device should register");

    assert_eq!(Some("stm32f103cx-blue-pill".to_string()), runtime.board_id);
    assert_eq!(
        vec!["pin.pa0", "pin.pa1", "pin.pa2"],
        runtime
            .channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>()
    );
    assert!(runtime.channels.iter().all(|channel| !channel
        .supported_actions
        .contains(&crate::core::device::DeviceChannelActionType::Breathe)));
}

#[test]
fn unknown_device_state_returns_error() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-state");
    let state = minimal_app_state_for_root(&root);

    let error = device_runtime_state_impl(&state, "missing".to_string())
        .expect_err("missing device should fail");

    assert_eq!("device is not registered: missing", error);
}

#[test]
fn update_device_channels_persists_settings_and_runtime_state() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-channels");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);

    let channels = vec![
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp2")
            .expect("GP2 should exist"),
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp28")
            .expect("GP28 should exist"),
    ];

    update_device_channels_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string(), channels)
        .expect("device channels should update");

    let runtime = device_runtime_state_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string())
        .expect("default device should exist");
    assert_eq!(
        vec!["pin.gp2", "pin.gp28"],
        runtime
            .channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>()
    );
    let saved_config = state
        .app_config_service
        .lock()
        .expect("config lock")
        .config();
    assert_eq!(
        vec!["pin.gp2", "pin.gp28"],
        saved_config.devices[0]
            .channels
            .iter()
            .map(|channel| channel.id.as_str())
            .collect::<Vec<_>>()
    );
}

#[test]
fn update_device_channels_rejects_removing_channel_used_by_active_profile_rule() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-channel-reference");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);

    add_profile_device_channel_rule(&state, "agent-failed-device-channel-output", "pin.gp2");

    let channels = vec![Rp2040PicoBoardAdapter
        .available_channels()
        .into_iter()
        .find(|channel| channel.id == "pin.gp28")
        .expect("GP28 should exist")];

    let error = update_device_channels_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string(), channels)
        .expect_err("referenced channel removal should be rejected");

    assert_eq!(
        "device channel pin.gp2 is used by output rule agent-failed-device-channel-output",
        error
    );
}

#[test]
fn update_device_channels_allows_adding_channel_when_existing_channel_is_referenced() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-channel-add-reference");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);
    add_profile_device_channel_rule(&state, "agent-failed-device-channel-output", "pin.gp2");

    let channels = vec![
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp0")
            .expect("GP0 should exist"),
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp1")
            .expect("GP1 should exist"),
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp2")
            .expect("GP2 should exist"),
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp28")
            .expect("GP28 should exist"),
    ];

    update_device_channels_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string(), channels)
        .expect("adding a channel should not be treated as referenced removal");

    let runtime = device_runtime_state_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string())
        .expect("default device should exist");
    assert!(runtime
        .channels
        .iter()
        .any(|channel| channel.id == "pin.gp28"));
}

#[test]
fn update_device_channels_rejects_switching_referenced_output_channel_to_input() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-channel-input-reference");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);
    add_profile_device_channel_rule(&state, "agent-failed-device-channel-output", "pin.gp2");

    let channels = vec![
        Rp2040PicoBoardAdapter
            .available_channels()
            .into_iter()
            .find(|channel| channel.id == "pin.gp0")
            .expect("GP0 should exist"),
        gpio_input_channel("pin.gp2"),
    ];

    let error = update_device_channels_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string(), channels)
        .expect_err("referenced output channel cannot switch to input");

    assert_eq!(
        "device channel pin.gp2 is used by output rule agent-failed-device-channel-output",
        error
    );
}

#[test]
fn update_device_channels_cleans_binding_when_input_channel_switches_to_output() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-channel-input-clean");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);
    {
        let mut config_service = state.app_config_service.lock().expect("config lock");
        let mut config = config_service.config();
        config.devices[0].channels = vec![gpio_input_channel("pin.gp2")];
        config.device_input_bindings.push(DeviceInputBinding {
            id: "desk-pico:pin.gp2:press".to_string(),
            enabled: true,
            device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
            channel_id: "pin.gp2".to_string(),
            trigger: DeviceInputTrigger::Press,
            action: DeviceInputAction::KeyboardShortcut {
                shortcut: KeyboardShortcut {
                    keys: vec!["Escape".to_string()],
                },
            },
        });
        config_service
            .save_config(config)
            .expect("input config should save");
    }
    {
        let mut registry = state.device_runtime_registry.lock().expect("registry lock");
        registry
            .replace_device_channels(
                DEFAULT_RP2040_DEVICE_ID,
                vec![gpio_input_channel("pin.gp2")],
            )
            .expect("runtime channels should update");
    }

    let channels = vec![Rp2040PicoBoardAdapter
        .available_channels()
        .into_iter()
        .find(|channel| channel.id == "pin.gp2")
        .expect("GP2 should exist")];

    update_device_channels_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string(), channels)
        .expect("switching input channel back to output should save");

    let saved_config = state
        .app_config_service
        .lock()
        .expect("config lock")
        .config();
    assert!(saved_config.device_input_bindings.is_empty());
}

#[test]
fn remove_registered_device_persists_settings_and_runtime_state() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-remove");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);

    let states = remove_registered_device_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string())
        .expect("registered device should be removable");

    assert!(states.is_empty());
    let saved_config = state
        .app_config_service
        .lock()
        .expect("config lock")
        .config();
    assert!(saved_config.devices.is_empty());
}

#[test]
fn test_action_returns_skipped_when_device_is_disconnected() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-skipped");
    let state = minimal_app_state_for_root(&root);
    register_default_devices_impl(&state).expect("default devices should register");

    let result = send_device_test_action_impl(
        &state,
        SendDeviceTestActionRequest {
            device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
            channel_id: "pin.gp2".to_string(),
            action: DeviceChannelActionType::Activate,
            duration_ms: None,
            interval_ms: None,
            duty_percent: None,
            frequency_hz: None,
            color: None,
            brightness_percent: None,
            pattern: None,
        },
    )
    .expect("test action should return command result");

    assert_eq!("skipped", result.status);
    assert_eq!(Some("device is not connected".to_string()), result.error);
}

#[test]
fn cancel_device_operation_returns_cancelled_state() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-cancel-operation");
    let state = minimal_app_state_for_root(&root);
    register_default_devices_impl(&state).expect("default devices should register");
    let operation_id = {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .expect("registry lock should be available");
        registry
            .begin_operation(
                DEFAULT_RP2040_DEVICE_ID,
                DeviceOperationKind::ManualConnect,
                12_000,
                true,
            )
            .expect("operation should start")
            .operation_id
    };

    let next_state =
        cancel_device_operation_impl(&state, DEFAULT_RP2040_DEVICE_ID.to_string(), operation_id)
            .expect("operation should cancel");

    assert_eq!(
        Some("operation_cancelled".to_string()),
        next_state.last_error
    );
    assert!(next_state.active_operation.is_none());
    assert!(next_state.auto_reconnect_blocked_until.is_some());
}

#[test]
fn connect_device_starts_cancellable_operation_for_registered_device() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-connect");
    let state = minimal_app_state_for_root(&root);
    register_default_devices_impl(&state).expect("default devices should register");

    let connecting = connect_device_impl(
        &state,
        ConnectDeviceRequest {
            device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
            transport: None,
        },
    )
    .expect("device connection operation should start");

    assert_eq!(DeviceConnectionStatus::Connecting, connecting.status);
    assert_eq!(
        Some(DeviceOperationKind::ManualConnect),
        connecting
            .active_operation
            .as_ref()
            .map(|operation| operation.kind)
    );
    assert_eq!(
        Some(true),
        connecting
            .active_operation
            .map(|operation| operation.cancellable)
    );
}

#[test]
fn disconnected_device_test_action_is_skipped() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-send-disconnected");
    let state = minimal_app_state_for_root(&root);
    register_default_devices_impl(&state).expect("default devices should register");

    let result = send_device_test_action_impl(
        &state,
        SendDeviceTestActionRequest {
            device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
            channel_id: "pin.gp2".to_string(),
            action: DeviceChannelActionType::Activate,
            duration_ms: None,
            interval_ms: None,
            duty_percent: None,
            frequency_hz: None,
            color: None,
            brightness_percent: None,
            pattern: None,
        },
    )
    .expect("test action should return result");
    assert_eq!("skipped", result.status);
}

#[test]
fn pico_buzzer_pattern_test_action_uses_channelized_extension_command() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-test-buzzer-pattern");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);
    {
        let mut buzzer = DeviceChannel::buzzer(
            "buzzer.gp19",
            "GP19 Buzzer",
            19,
            ActiveLevel::High,
            2000,
            true,
        );
        buzzer
            .supported_actions
            .push(DeviceChannelActionType::Pattern);
        let mut registry = state
            .device_runtime_registry
            .lock()
            .expect("registry lock should work");
        registry
            .replace_device_channels(DEFAULT_RP2040_DEVICE_ID, vec![buzzer])
            .expect("buzzer channel should replace default channels");
        registry
            .connect_with_transport(
                DEFAULT_RP2040_DEVICE_ID,
                Box::new(crate::infrastructure::transports::mock::MockDeviceTransport::with_received_lines(vec![
                    r#"{"ok":true,"v":2,"type":"buzzer_pattern","channel":"buzzer.gp19"}"#.to_string(),
                ])),
            )
            .expect("device should connect");
    }

    let result = send_device_test_action_impl(
        &state,
        SendDeviceTestActionRequest {
            device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
            channel_id: "buzzer.gp19".to_string(),
            action: DeviceChannelActionType::Pattern,
            duration_ms: None,
            interval_ms: None,
            duty_percent: None,
            frequency_hz: None,
            color: None,
            brightness_percent: None,
            pattern: Some("success".to_string()),
        },
    )
    .expect("pattern test action should return result");

    assert_eq!("sent", result.status);
    assert_eq!(None, result.error);
    assert_eq!(
        Some(r#"{"ok":true,"v":2,"type":"buzzer_pattern","channel":"buzzer.gp19"}"#.to_string()),
        result.ack
    );
}

#[test]
fn connect_device_uses_selected_transport_without_replacing_runtime_or_persisted_port_before_success(
) {
    let root = crate::test_support::unique_temp_root("cc-notice-device-connect-override");
    let state = minimal_app_state_for_root(&root);
    setup_default_device(&state);

    let connecting = connect_device_impl(
        &state,
        ConnectDeviceRequest {
            device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
            transport: Some(crate::core::device::DeviceTransportConfig::serial(
                "mock://selected-pico",
                115200,
            )),
        },
    )
    .expect("device connection operation should start through selected transport");

    assert_eq!(DeviceConnectionStatus::Connecting, connecting.status);
    assert_eq!(
        Some("mock://rp2040-pico-default".to_string()),
        connecting
            .transport
            .and_then(|transport| transport.serial_port)
    );

    let saved_config = state
        .app_config_service
        .lock()
        .expect("config lock")
        .config();
    assert_eq!(
        Some("mock://rp2040-pico-default".to_string()),
        saved_config.devices[0].transport.serial_port.clone()
    );
}

#[test]
fn identify_candidate_returns_matched_when_transport_is_already_connected() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-identify-matched");
    let state = minimal_app_state_for_root(&root);
    register_default_devices_impl(&state).expect("default devices should register");
    {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .expect("registry lock should work");
        registry
            .connect_with_transport_config(
                DEFAULT_RP2040_DEVICE_ID,
                crate::core::device::DeviceTransportConfig::serial("mock://selected-pico", 115200),
                Box::new(crate::infrastructure::transports::mock::MockDeviceTransport::default()),
            )
            .expect("device should connect through selected transport");
    }

    let candidate = identify_device_candidate_impl(
        &state,
        IdentifyDeviceCandidateRequest {
            resource_id: "serial:mock://selected-pico".to_string(),
            display_name: "Selected Pico".to_string(),
            transport: crate::core::device::DeviceTransportConfig::serial(
                "mock://selected-pico",
                115200,
            ),
        },
    )
    .expect("connected resource should return matched candidate");

    assert_eq!(DeviceDiscoveryStatus::Matched, candidate.discovery_status);
    assert_eq!(
        Some(DEFAULT_RP2040_DEVICE_ID.to_string()),
        candidate.matched_device_id
    );
}

#[test]
fn disconnect_all_devices_returns_all_disconnected_states() {
    let root = crate::test_support::unique_temp_root("cc-notice-device-disconnect-all");
    let state = minimal_app_state_for_root(&root);
    register_default_devices_impl(&state).expect("default devices should register");
    {
        let mut registry = state
            .device_runtime_registry
            .lock()
            .expect("registry lock should work");
        registry
            .connect_with_transport(
                DEFAULT_RP2040_DEVICE_ID,
                Box::new(crate::infrastructure::transports::mock::MockDeviceTransport::default()),
            )
            .expect("device should connect");
    }

    let states = disconnect_all_devices_impl(&state).expect("devices should disconnect");

    assert!(states
        .iter()
        .all(|state| state.status == DeviceConnectionStatus::Disconnected));
}

fn setup_default_device(state: &AppState) {
    {
        let mut config_service = state.app_config_service.lock().expect("config lock");
        let mut config = config_service.config();
        config
            .devices
            .push(super::defaults::default_rp2040_device());
        config_service
            .save_config(config)
            .expect("default device should save to config");
    }
    register_default_devices_impl(state).expect("default devices should register");
}

fn gpio_input_channel(channel_id: &str) -> crate::core::device::DeviceChannel {
    let mut channel = Rp2040PicoBoardAdapter
        .available_channels()
        .into_iter()
        .find(|channel| channel.id == channel_id)
        .expect("Pico GPIO channel should exist");
    channel.kind = DeviceChannelKind::ButtonInput;
    channel.direction = DeviceChannelDirection::Input;
    channel.input = Some(DeviceInputConfig {
        control: channel.id.clone(),
        input_kind: DeviceInputKind::Gpio,
        fixed: false,
    });
    channel.supported_actions = Vec::new();
    channel.hardware_guide_id = None;
    channel
}

fn add_profile_device_channel_rule(state: &AppState, rule_id: &str, channel_id: &str) {
    let mut profile_service = state.profile_service.lock().expect("profile lock");
    let mut profile = profile_service.active_profile();
    profile
        .hardware_rules
        .push(crate::core::profiles::HardwareRule {
            id: rule_id.to_string(),
            internal_event: "agent.failed".to_string(),
            output: crate::core::profiles::HardwareOutput {
                output_type: crate::core::profiles::HardwareOutputType::DeviceChannel,
                channel_actions: vec![DeviceChannelRuleAction {
                    id: "a1".to_string(),
                    device_id: DEFAULT_RP2040_DEVICE_ID.to_string(),
                    channel_id: channel_id.to_string(),
                    channel_action: DeviceChannelActionType::Activate,
                    duration_ms: Some(5000),
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
                }],
                duration_ms: None,
                text: None,
                notification_level: None,
                notification_title: None,
                notification_body: None,
                notification_title_max_chars: None,
                notification_body_max_chars: None,
                notification_throttle_seconds: None,
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
            },
            priority: 80,
            enabled: true,
        });
    profile_service
        .save_profile(profile)
        .expect("profile should save with device channel rule");
}

fn identified_candidate(device_uid: &str) -> DeviceCandidateResource {
    identified_candidate_for_board("rp2040-pico", device_uid, "0.2.3")
}

fn identified_candidate_for_board(
    board_id: &str,
    device_uid: &str,
    firmware_version: &str,
) -> DeviceCandidateResource {
    DeviceCandidateResource {
        resource_id: "serial:/dev/cu.usbmodem1".to_string(),
        transport: crate::core::device::DeviceTransportConfig::serial("/dev/cu.usbmodem1", 115200),
        display_name: "cu.usbmodem1".to_string(),
        discovery_status: DeviceDiscoveryStatus::Identified,
        handshake_info: Some(DeviceCandidateHandshakeInfo {
            board_id: board_id.to_string(),
            device_uid: device_uid.to_string(),
            firmware_version: firmware_version.to_string(),
            protocol_version: 2,
            identity_persistence: crate::core::device::DeviceIdentityPersistence::Persisted,
        }),
        device_uid: Some(device_uid.to_string()),
        matched_device_id: None,
        error: None,
    }
}
