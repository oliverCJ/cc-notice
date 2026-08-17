use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceTransportKind {
    Serial,
    UsbHid,
    UsbBulk,
    Tcp,
    Websocket,
    Mqtt,
    BleGatt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DeviceConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceOperationKind {
    ManualConnect,
    AutoConnect,
    Disconnect,
    Ping,
    SendAction,
    SendExtensionAction,
    FirmwareCheck,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceOperationSummary {
    pub operation_id: u64,
    pub kind: DeviceOperationKind,
    pub started_at: String,
    pub deadline_ms: u64,
    pub cancellable: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceChannelKind {
    DigitalOutput,
    PwmOutput,
    AddressableLed,
    Display,
    Buzzer,
    Relay,
    ButtonInput,
}

impl DeviceChannelKind {
    pub fn current_supported_actions(self) -> Option<Vec<DeviceChannelActionType>> {
        match self {
            DeviceChannelKind::DigitalOutput => Some(vec![
                DeviceChannelActionType::Activate,
                DeviceChannelActionType::Deactivate,
                DeviceChannelActionType::Blink,
                DeviceChannelActionType::Breathe,
                DeviceChannelActionType::Pulse,
            ]),
            DeviceChannelKind::PwmOutput => Some(vec![
                DeviceChannelActionType::SetDuty,
                DeviceChannelActionType::Pulse,
                DeviceChannelActionType::Clear,
            ]),
            DeviceChannelKind::Buzzer => Some(vec![
                DeviceChannelActionType::Beep,
                DeviceChannelActionType::Tone,
                DeviceChannelActionType::Clear,
            ]),
            DeviceChannelKind::AddressableLed => Some(vec![
                DeviceChannelActionType::SetColor,
                DeviceChannelActionType::Clear,
            ]),
            DeviceChannelKind::Display
            | DeviceChannelKind::Relay
            | DeviceChannelKind::ButtonInput => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceChannelDirection {
    Output,
    Input,
}

impl Default for DeviceChannelDirection {
    fn default() -> Self {
        DeviceChannelDirection::Output
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ActiveLevel {
    High,
    Low,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DigitalOutputConfig {
    pub pin: u8,
    pub active_level: ActiveLevel,
    pub default_level: ActiveLevel,
    pub allow_blink: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PwmOutputConfig {
    pub pin: u8,
    pub frequency_hz: u32,
    pub default_duty_percent: u8,
    pub max_duty_percent: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuzzerConfig {
    pub pin: u8,
    pub active_level: ActiveLevel,
    pub default_frequency_hz: u32,
    pub supports_tone: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressableLedConfig {
    pub pin: u8,
    pub protocol: String,
    pub led_count: u16,
    pub color_order: String,
    pub default_brightness_percent: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceInputKind {
    Button,
    Gpio,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInputConfig {
    pub control: String,
    pub input_kind: DeviceInputKind,
    pub fixed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceChannel {
    pub id: String,
    pub label: String,
    pub kind: DeviceChannelKind,
    #[serde(default)]
    pub direction: DeviceChannelDirection,
    pub description: Option<String>,
    pub physical_pin: Option<u8>,
    pub digital_output: Option<DigitalOutputConfig>,
    pub pwm_output: Option<PwmOutputConfig>,
    pub buzzer: Option<BuzzerConfig>,
    pub addressable_led: Option<AddressableLedConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input: Option<DeviceInputConfig>,
    pub supported_actions: Vec<DeviceChannelActionType>,
    pub hardware_guide_id: Option<String>,
}

impl DeviceChannel {
    pub fn digital_output(
        id: &str,
        label: &str,
        pin: u8,
        active_level: ActiveLevel,
        default_level: ActiveLevel,
    ) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            kind: DeviceChannelKind::DigitalOutput,
            direction: DeviceChannelDirection::Output,
            description: None,
            physical_pin: None,
            digital_output: Some(DigitalOutputConfig {
                pin,
                active_level,
                default_level,
                allow_blink: true,
            }),
            pwm_output: None,
            buzzer: None,
            addressable_led: None,
            input: None,
            supported_actions: DeviceChannelKind::DigitalOutput
                .current_supported_actions()
                .expect("digital output actions are defined"),
            hardware_guide_id: Some("digital-output".to_string()),
        }
    }

    pub fn pwm_output(
        id: &str,
        label: &str,
        pin: u8,
        frequency_hz: u32,
        default_duty_percent: u8,
        max_duty_percent: u8,
    ) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            kind: DeviceChannelKind::PwmOutput,
            direction: DeviceChannelDirection::Output,
            description: None,
            physical_pin: None,
            digital_output: None,
            pwm_output: Some(PwmOutputConfig {
                pin,
                frequency_hz,
                default_duty_percent,
                max_duty_percent,
            }),
            buzzer: None,
            addressable_led: None,
            input: None,
            supported_actions: DeviceChannelKind::PwmOutput
                .current_supported_actions()
                .expect("pwm output actions are defined"),
            hardware_guide_id: Some("pwm-output".to_string()),
        }
    }

    pub fn buzzer(
        id: &str,
        label: &str,
        pin: u8,
        active_level: ActiveLevel,
        default_frequency_hz: u32,
        supports_tone: bool,
    ) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            kind: DeviceChannelKind::Buzzer,
            direction: DeviceChannelDirection::Output,
            description: None,
            physical_pin: None,
            digital_output: None,
            pwm_output: None,
            buzzer: Some(BuzzerConfig {
                pin,
                active_level,
                default_frequency_hz,
                supports_tone,
            }),
            addressable_led: None,
            input: None,
            supported_actions: DeviceChannelKind::Buzzer
                .current_supported_actions()
                .expect("buzzer actions are defined"),
            hardware_guide_id: Some("buzzer".to_string()),
        }
    }

    pub fn addressable_led(
        id: &str,
        label: &str,
        pin: u8,
        protocol: &str,
        led_count: u16,
        color_order: &str,
        default_brightness_percent: u8,
    ) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            kind: DeviceChannelKind::AddressableLed,
            direction: DeviceChannelDirection::Output,
            description: None,
            physical_pin: None,
            digital_output: None,
            pwm_output: None,
            buzzer: None,
            addressable_led: Some(AddressableLedConfig {
                pin,
                protocol: protocol.to_string(),
                led_count,
                color_order: color_order.to_string(),
                default_brightness_percent,
            }),
            input: None,
            supported_actions: DeviceChannelKind::AddressableLed
                .current_supported_actions()
                .expect("addressable led actions are defined"),
            hardware_guide_id: Some("addressable-led".to_string()),
        }
    }

    pub fn fixed_button_input(id: &str, label: &str, control: &str) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            kind: DeviceChannelKind::ButtonInput,
            direction: DeviceChannelDirection::Input,
            description: Some(label.to_string()),
            physical_pin: None,
            digital_output: None,
            pwm_output: None,
            buzzer: None,
            addressable_led: None,
            input: Some(DeviceInputConfig {
                control: control.to_string(),
                input_kind: DeviceInputKind::Button,
                fixed: true,
            }),
            supported_actions: Vec::new(),
            hardware_guide_id: None,
        }
    }

    pub fn supports_action(&self, action: DeviceChannelActionType) -> bool {
        self.supported_actions.contains(&action)
    }

    pub fn reset_supported_actions_to_kind_capability(&mut self) {
        if let Some(actions) = self.kind.current_supported_actions() {
            self.supported_actions = actions;
        }
    }

    pub fn with_physical_pin(mut self, physical_pin: u8) -> Self {
        self.physical_pin = Some(physical_pin);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTransportConfig {
    pub kind: DeviceTransportKind,
    pub serial_port: Option<String>,
    pub baud_rate: Option<u32>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub path: Option<String>,
    pub topic: Option<String>,
}

impl DeviceTransportConfig {
    pub fn serial(serial_port: &str, baud_rate: u32) -> Self {
        Self {
            kind: DeviceTransportKind::Serial,
            serial_port: Some(serial_port.to_string()),
            baud_rate: Some(baud_rate),
            host: None,
            port: None,
            path: None,
            topic: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInstance {
    pub id: String,
    pub label: String,
    pub board_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_uid: Option<String>,
    pub transport: DeviceTransportConfig,
    pub channels: Vec<DeviceChannel>,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceExtensionCapabilities {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display: Option<DeviceDisplayCapabilities>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buzzer: Option<DeviceBuzzerExtensionCapabilities>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inputs: Option<DeviceInputCapabilities>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDisplayCapabilities {
    pub status: bool,
    #[serde(default)]
    pub card: bool,
    #[serde(default)]
    pub lines: bool,
    #[serde(default)]
    pub runtime: bool,
    pub clear: bool,
    #[serde(default)]
    pub size_class: DeviceDisplaySizeClass,
    #[serde(default)]
    pub statuses: Vec<String>,
    pub title_max_chars: u32,
    pub message_max_chars: u32,
    #[serde(default)]
    pub text_encoding: DeviceDisplayTextEncoding,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceDisplaySizeClass {
    Compact,
    #[default]
    Small,
    Medium,
    Large,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceDisplayTextEncoding {
    #[default]
    Ascii,
    Unicode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBuzzerExtensionCapabilities {
    #[serde(default)]
    pub patterns: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInputCapabilities {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buttons: Option<DeviceButtonInputCapabilities>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceButtonInputCapabilities {
    pub status: String,
    #[serde(default)]
    pub controls: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCandidateResource {
    pub resource_id: String,
    pub transport: DeviceTransportConfig,
    pub display_name: String,
    pub discovery_status: DeviceDiscoveryStatus,
    pub handshake_info: Option<DeviceCandidateHandshakeInfo>,
    pub device_uid: Option<String>,
    pub matched_device_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCandidateHandshakeInfo {
    pub board_id: String,
    pub device_uid: String,
    pub firmware_version: String,
    pub protocol_version: u16,
    pub identity_persistence: DeviceIdentityPersistence,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceIdentityPersistence {
    Persisted,
    Fallback,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceDiscoveryStatus {
    Unidentified,
    Identifying,
    Identified,
    Matched,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceChannelActionType {
    Activate,
    Deactivate,
    Blink,
    Breathe,
    Pulse,
    Clear,
    SetDuty,
    Beep,
    Tone,
    Pattern,
    DisplayStatus,
    SetColor,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceChannelAction {
    pub device_id: String,
    pub channel_id: String,
    pub action: DeviceChannelActionType,
    pub duration_ms: Option<u64>,
    pub interval_ms: Option<u64>,
    pub duty_percent: Option<u8>,
    pub frequency_hz: Option<u32>,
    pub color: Option<String>,
    pub brightness_percent: Option<u8>,
    pub pattern: Option<String>,
    pub priority: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceExtensionActionType {
    DisplayStatus,
    DisplayCard,
    DisplayLines,
    DisplayRuntime,
    DisplayClear,
    BuzzerPattern,
    DeviceControl,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceExtensionAction {
    pub device_id: String,
    pub channel_id: Option<String>,
    pub action: DeviceExtensionActionType,
    pub status: Option<String>,
    pub title: Option<String>,
    pub message: Option<String>,
    pub icon: Option<String>,
    pub lines: Option<Vec<String>>,
    pub pattern: Option<String>,
    pub control: Option<String>,
    pub active: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInputEvent {
    pub device_id: String,
    pub channel_id: String,
    pub control: String,
    pub action: DeviceInputEventAction,
    pub seq: u64,
    pub received_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceInputEventAction {
    Press,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputExecutionPlan {
    pub internal_event: String,
    pub actions: Vec<OutputExecutionAction>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum OutputExecutionAction {
    DeviceChannel(DeviceChannelAction),
    DeviceExtension(DeviceExtensionAction),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceRuntimeState {
    pub device_id: Option<String>,
    pub device_uid: Option<String>,
    pub status: DeviceConnectionStatus,
    pub board_id: Option<String>,
    pub transport: Option<DeviceTransportConfig>,
    pub channels: Vec<DeviceChannel>,
    pub firmware_info: Option<DeviceFirmwareInfo>,
    pub bundled_firmware_version: Option<String>,
    pub firmware_status: DeviceFirmwareStatus,
    pub firmware_check_error: Option<String>,
    pub heartbeat_status: DeviceHeartbeatStatus,
    pub last_heartbeat_at: Option<String>,
    pub heartbeat_failure_count: u8,
    pub manual_reconnect_suppressed: bool,
    pub matched_resource_id: Option<String>,
    pub last_discovered_at: Option<String>,
    pub active_operation: Option<DeviceOperationSummary>,
    pub auto_reconnect_blocked_until: Option<String>,
    pub last_ack: Option<String>,
    pub last_error_code: Option<DeviceRuntimeErrorCode>,
    pub last_error: Option<String>,
    pub last_sent_at: Option<String>,
}

impl DeviceRuntimeState {
    pub fn disconnected() -> Self {
        Self {
            device_id: None,
            device_uid: None,
            status: DeviceConnectionStatus::Disconnected,
            board_id: None,
            transport: None,
            channels: Vec::new(),
            firmware_info: None,
            bundled_firmware_version: None,
            firmware_status: DeviceFirmwareStatus::Unknown,
            firmware_check_error: None,
            heartbeat_status: DeviceHeartbeatStatus::Unknown,
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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeviceRuntimeErrorCode {
    DeviceRuntimeUnavailable,
    DeviceNotRegistered,
    DeviceNotConnected,
    DeviceChannelNotConfigured,
    DeviceChannelActionUnsupported,
    DeviceIoWorkerStopped,
    DeviceActionTimeout,
    DeviceInfoTimeout,
    DeviceTransportBusy,
    DeviceTransportPermissionDenied,
    DeviceTransportDisconnected,
    DeviceTransportError,
    DeviceProtocolUnsupportedCommand,
    DeviceProtocolInvalidResponse,
    DeviceOperationCancelled,
    DeviceConnectionChanged,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceHeartbeatStatus {
    Unknown,
    Healthy,
    Stale,
    Lost,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFirmwareInfo {
    pub board_id: String,
    pub device_uid: String,
    pub firmware_version: String,
    pub protocol_version: u16,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceFirmwareStatus {
    Unknown,
    UpToDate,
    UpdateAvailable,
    Incompatible,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCommandResult {
    pub device_id: String,
    pub channel_id: String,
    pub output_type: DeviceCommandOutputType,
    pub status: String,
    pub ack: Option<String>,
    pub error_code: Option<DeviceRuntimeErrorCode>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceCommandOutputType {
    DeviceChannel,
    Display,
    Buzzer,
    DeviceControl,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_digital_channel_uses_stable_channel_id() {
        let channel =
            DeviceChannel::digital_output("pin.gp2", "GP2", 2, ActiveLevel::High, ActiveLevel::Low);

        assert_eq!("pin.gp2", channel.id);
        assert_eq!("GP2", channel.label);
        assert_eq!(DeviceChannelKind::DigitalOutput, channel.kind);
        assert_eq!(
            vec![
                DeviceChannelActionType::Activate,
                DeviceChannelActionType::Deactivate,
                DeviceChannelActionType::Blink,
                DeviceChannelActionType::Breathe,
                DeviceChannelActionType::Pulse,
            ],
            channel.supported_actions
        );
        assert!(channel.supports_action(DeviceChannelActionType::Breathe));
        assert!(!channel.supports_action(DeviceChannelActionType::Clear));
        assert_eq!(
            Some(2),
            channel.digital_output.as_ref().map(|config| config.pin)
        );
        assert_eq!(
            Some(ActiveLevel::High),
            channel
                .digital_output
                .as_ref()
                .map(|config| config.active_level)
        );
    }

    #[test]
    fn channel_capabilities_cover_pwm_buzzer_and_addressable_led() {
        let pwm = DeviceChannel::pwm_output("pwm.gp15", "GP15 PWM", 15, 1000, 0, 100);
        let buzzer = DeviceChannel::buzzer(
            "buzzer.gp14",
            "GP14 Buzzer",
            14,
            ActiveLevel::High,
            2000,
            true,
        );
        let led = DeviceChannel::addressable_led(
            "ws2812.gp16",
            "GP16 WS2812",
            16,
            "ws2812",
            8,
            "grb",
            30,
        );

        assert_eq!(DeviceChannelKind::PwmOutput, pwm.kind);
        assert_eq!(Some(15), pwm.pwm_output.as_ref().map(|config| config.pin));
        assert_eq!(
            vec![
                DeviceChannelActionType::SetDuty,
                DeviceChannelActionType::Pulse,
                DeviceChannelActionType::Clear,
            ],
            pwm.supported_actions
        );

        assert_eq!(DeviceChannelKind::Buzzer, buzzer.kind);
        assert_eq!(
            Some(2000),
            buzzer
                .buzzer
                .as_ref()
                .map(|config| config.default_frequency_hz)
        );
        assert!(buzzer.supports_action(DeviceChannelActionType::Tone));

        assert_eq!(DeviceChannelKind::AddressableLed, led.kind);
        assert_eq!(
            Some("ws2812"),
            led.addressable_led
                .as_ref()
                .map(|config| config.protocol.as_str())
        );
        assert!(led.supports_action(DeviceChannelActionType::SetColor));
        assert!(led.supports_action(DeviceChannelActionType::Clear));
        assert!(!led.supports_action(DeviceChannelActionType::Blink));
        assert!(!led.supports_action(DeviceChannelActionType::Deactivate));
    }

    #[test]
    fn device_channel_action_serializes_as_camel_case_contract() {
        let action = DeviceChannelAction {
            device_id: "desk-pico".to_string(),
            channel_id: "pin.gp3".to_string(),
            action: DeviceChannelActionType::Blink,
            duration_ms: Some(5000),
            interval_ms: Some(500),
            duty_percent: Some(60),
            frequency_hz: Some(2000),
            color: Some("#00ff88".to_string()),
            brightness_percent: Some(30),
            pattern: None,
            priority: 80,
        };

        let value = serde_json::to_value(action).expect("action should serialize");

        assert_eq!("desk-pico", value["deviceId"]);
        assert_eq!("pin.gp3", value["channelId"]);
        assert_eq!("blink", value["action"]);
        assert_eq!(5000, value["durationMs"]);
        assert_eq!(500, value["intervalMs"]);
        assert_eq!(60, value["dutyPercent"]);
        assert_eq!(2000, value["frequencyHz"]);
        assert_eq!("#00ff88", value["color"]);
        assert_eq!(30, value["brightnessPercent"]);
    }

    #[test]
    fn disconnected_runtime_state_is_safe_default() {
        let state = DeviceRuntimeState::disconnected();

        assert_eq!(DeviceConnectionStatus::Disconnected, state.status);
        assert_eq!(None, state.device_id);
        assert_eq!(None, state.last_error);
    }

    #[test]
    fn disconnected_runtime_state_has_no_active_operation_or_cooldown() {
        let state = DeviceRuntimeState::disconnected();

        assert!(state.active_operation.is_none());
        assert!(state.auto_reconnect_blocked_until.is_none());
    }
}
