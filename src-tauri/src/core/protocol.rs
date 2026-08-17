use serde::{Deserialize, Serialize};

use crate::core::device::{
    DeviceChannelAction, DeviceChannelActionType, DeviceExtensionAction, DeviceExtensionActionType,
    DeviceFirmwareInfo,
};

const SHARED_FIRMWARE_INPUT_LINE_MAX_BYTES: usize = 192;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NoticeCommandType {
    Clear,
    ShowText,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoticeCommand {
    pub command_type: NoticeCommandType,
    pub text: Option<String>,
    /// 持续时间（毫秒）
    /// - `None`: 永久有效，直到下一条指令覆盖
    /// - `Some(n)`: 持续 n 毫秒后硬件自动恢复初始状态
    /// - 固件实现需支持定时器，超时后恢复默认状态
    pub duration_ms: Option<u64>,
    pub priority: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct DeviceInputEventAck {
    pub v: u16,
    #[serde(rename = "type")]
    pub event_type: String,
    pub control: String,
    pub action: String,
    pub seq: u64,
}

impl DeviceInputEventAck {
    pub fn parse(line: &str) -> Result<Self, String> {
        let value: Self = serde_json::from_str(line).map_err(|error| error.to_string())?;
        if value.event_type != "input_event" {
            return Err("not an input_event".to_string());
        }
        Ok(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProtocolCommandV2 {
    v: u16,
    #[serde(rename = "type")]
    command_type: &'static str,
    #[serde(skip_serializing_if = "String::is_empty")]
    channel: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    state: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    interval_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duty_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_hz: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    brightness_percent: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_uid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    lines: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pattern: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mode: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pull: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    active_level: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    control: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    active: Option<bool>,
}

impl ProtocolCommandV2 {
    pub fn expected_ack_type(&self) -> &'static str {
        match self.command_type {
            "ping" => "pong",
            value => value,
        }
    }

    pub fn command_type(&self) -> &'static str {
        self.command_type
    }

    pub fn channel_id(&self) -> Option<&str> {
        (!self.channel.is_empty()).then_some(self.channel.as_str())
    }

    pub fn ping() -> Self {
        Self::base_command("ping")
    }

    pub fn device_info() -> Self {
        Self::base_command("device_info")
    }

    pub fn set_device_uid(device_uid: String) -> Self {
        Self {
            device_uid: Some(device_uid),
            ..Self::base_command("set_device_uid")
        }
    }

    pub fn configure_gpio_input(channel_id: String, enabled: bool) -> Self {
        if enabled {
            return Self {
                channel: channel_id,
                mode: Some("button"),
                pull: Some("up"),
                active_level: Some("low"),
                ..Self::base_command("configure_input")
            };
        }
        Self {
            channel: channel_id,
            mode: Some("disabled"),
            ..Self::base_command("configure_input")
        }
    }

    pub fn from_device_extension_action(action: &DeviceExtensionAction) -> Result<Self, String> {
        match action.action {
            DeviceExtensionActionType::DisplayStatus => {
                Ok(trim_display_command_to_firmware_budget(Self {
                    status: Some(required_non_blank_option(
                        action.status.as_deref(),
                        "status",
                    )?),
                    title: Some(required_non_blank_option(action.title.as_deref(), "title")?),
                    message: Some(required_non_blank_option(
                        action.message.as_deref(),
                        "message",
                    )?),
                    ..Self::base_command("display_status")
                }))
            }
            DeviceExtensionActionType::DisplayCard => {
                Ok(trim_display_command_to_firmware_budget(Self {
                    status: Some(required_non_blank_option(
                        action.status.as_deref(),
                        "status",
                    )?),
                    title: Some(required_non_blank_option(action.title.as_deref(), "title")?),
                    message: Some(required_non_blank_option(
                        action.message.as_deref(),
                        "message",
                    )?),
                    icon: optional_non_blank_string(action.icon.as_deref()),
                    lines: optional_non_blank_lines(action.lines.as_ref()),
                    ..Self::base_command("display_card")
                }))
            }
            DeviceExtensionActionType::DisplayLines => {
                Ok(trim_display_command_to_firmware_budget(Self {
                    lines: Some(required_non_blank_lines(action.lines.as_ref(), "lines")?),
                    ..Self::base_command("display_lines")
                }))
            }
            DeviceExtensionActionType::DisplayRuntime => {
                Ok(trim_display_command_to_firmware_budget(Self {
                    status: Some(required_non_blank_option(
                        action.status.as_deref(),
                        "status",
                    )?),
                    title: Some(required_non_blank_option(action.title.as_deref(), "title")?),
                    message: Some(required_non_blank_option(
                        action.message.as_deref(),
                        "message",
                    )?),
                    lines: optional_non_blank_lines(action.lines.as_ref()),
                    ..Self::base_command("display_runtime")
                }))
            }
            DeviceExtensionActionType::DisplayClear => Ok(Self::base_command("display_clear")),
            DeviceExtensionActionType::BuzzerPattern => Ok(Self {
                channel: action.channel_id.clone().unwrap_or_default(),
                pattern: Some(required_non_blank_option(
                    action.pattern.as_deref(),
                    "pattern",
                )?),
                ..Self::base_command("buzzer_pattern")
            }),
            DeviceExtensionActionType::DeviceControl => Ok(Self {
                control: Some(required_non_blank_option(
                    action.control.as_deref(),
                    "control",
                )?),
                active: Some(action.active.unwrap_or(false)),
                ..Self::base_command("device_control")
            }),
        }
    }

    pub fn from_device_channel_action(action: &DeviceChannelAction) -> Result<Self, String> {
        let command = match action.action {
            DeviceChannelActionType::Activate => Self::digital_write(action, "active"),
            DeviceChannelActionType::Deactivate => Self::digital_write(action, "inactive"),
            DeviceChannelActionType::Blink => Self {
                channel: action.channel_id.clone(),
                duration_ms: action.duration_ms,
                interval_ms: action.interval_ms,
                ..Self::base_command("digital_blink")
            },
            DeviceChannelActionType::Breathe => Self {
                channel: action.channel_id.clone(),
                duration_ms: action.duration_ms,
                interval_ms: action.interval_ms,
                ..Self::base_command("digital_breathe")
            },
            DeviceChannelActionType::Pulse => Self {
                channel: action.channel_id.clone(),
                duration_ms: action.duration_ms,
                ..Self::base_command("digital_pulse")
            },
            DeviceChannelActionType::Clear => Self {
                channel: action.channel_id.clone(),
                ..Self::base_command("clear_channel")
            },
            DeviceChannelActionType::SetDuty => Self::pwm_write(action)?,
            DeviceChannelActionType::Beep => Self::buzzer_command(action, "buzzer_beep")?,
            DeviceChannelActionType::Tone => Self::buzzer_command(action, "buzzer_tone")?,
            DeviceChannelActionType::Pattern => {
                return Err("pattern action must be sent as device extension action".to_string())
            }
            DeviceChannelActionType::DisplayStatus => {
                return Err(
                    "display-status action must be sent as device extension action".to_string(),
                )
            }
            DeviceChannelActionType::SetColor => Self::addressable_led_set(action)?,
        };

        Ok(command)
    }

    fn base_command(command_type: &'static str) -> Self {
        Self {
            v: 2,
            command_type,
            channel: String::new(),
            state: None,
            duration_ms: None,
            interval_ms: None,
            duty_percent: None,
            frequency_hz: None,
            color: None,
            brightness_percent: None,
            device_uid: None,
            status: None,
            title: None,
            message: None,
            icon: None,
            lines: None,
            pattern: None,
            mode: None,
            pull: None,
            active_level: None,
            control: None,
            active: None,
        }
    }

    pub fn to_json_line(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self).map(|mut value| {
            value.push('\n');
            value
        })
    }

    fn digital_write(action: &DeviceChannelAction, state: &'static str) -> Self {
        Self {
            channel: action.channel_id.clone(),
            state: Some(state),
            duration_ms: action.duration_ms,
            ..Self::base_command("digital_write")
        }
    }

    fn pwm_write(action: &DeviceChannelAction) -> Result<Self, String> {
        let duty_percent = action
            .duty_percent
            .ok_or_else(|| "set-duty action requires duty_percent".to_string())?;
        Ok(Self {
            channel: action.channel_id.clone(),
            duration_ms: action.duration_ms,
            duty_percent: Some(duty_percent),
            ..Self::base_command("pwm_write")
        })
    }

    fn buzzer_command(
        action: &DeviceChannelAction,
        command_type: &'static str,
    ) -> Result<Self, String> {
        let frequency_hz = action
            .frequency_hz
            .ok_or_else(|| format!("{} action requires frequency_hz", command_type))?;
        Ok(Self {
            command_type,
            channel: action.channel_id.clone(),
            duration_ms: action.duration_ms,
            frequency_hz: Some(frequency_hz),
            ..Self::base_command(command_type)
        })
    }

    fn addressable_led_set(action: &DeviceChannelAction) -> Result<Self, String> {
        let color = action
            .color
            .clone()
            .ok_or_else(|| "set-color action requires color".to_string())?;
        Ok(Self {
            channel: action.channel_id.clone(),
            duration_ms: action.duration_ms,
            color: Some(color),
            brightness_percent: action.brightness_percent,
            ..Self::base_command("addressable_led_set")
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct DeviceInfoAck {
    pub ok: bool,
    pub v: u16,
    #[serde(rename = "type")]
    pub ack_type: Option<String>,
    pub board_id: Option<String>,
    pub device_uid: Option<String>,
    pub firmware_version: Option<String>,
    pub protocol_version: Option<u16>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ProtocolAck {
    pub ok: bool,
    pub v: u16,
    #[serde(rename = "type")]
    pub ack_type: Option<String>,
    pub channel: Option<String>,
    pub error: Option<String>,
}

impl ProtocolAck {
    pub fn parse(line: &str) -> Result<Self, String> {
        serde_json::from_str(line).map_err(|error| error.to_string())
    }
}

impl DeviceInfoAck {
    pub fn parse(line: &str) -> Result<Self, String> {
        serde_json::from_str(line).map_err(|error| error.to_string())
    }

    pub fn into_firmware_info(self) -> Result<DeviceFirmwareInfo, String> {
        if !self.ok {
            return Err(self
                .error
                .unwrap_or_else(|| "device_info failed".to_string()));
        }

        if self.ack_type.as_deref() != Some("device_info") {
            return Err("unexpected device_info response type".to_string());
        }

        Ok(DeviceFirmwareInfo {
            board_id: self
                .board_id
                .ok_or_else(|| "device_info response missing board_id".to_string())?,
            device_uid: required_non_blank_field(self.device_uid, "device_uid")?,
            firmware_version: self
                .firmware_version
                .ok_or_else(|| "device_info response missing firmware_version".to_string())?,
            protocol_version: self
                .protocol_version
                .ok_or_else(|| "device_info response missing protocol_version".to_string())?,
        })
    }
}

fn required_non_blank_field(value: Option<String>, field_name: &str) -> Result<String, String> {
    let value = value.ok_or_else(|| format!("device_info response missing {}", field_name))?;
    if value.trim().is_empty() {
        return Err(format!("device_info response empty {}", field_name));
    }
    Ok(value)
}

fn required_non_blank_option(value: Option<&str>, field_name: &str) -> Result<String, String> {
    let value = value.ok_or_else(|| format!("device extension action missing {}", field_name))?;
    if value.trim().is_empty() {
        return Err(format!("device extension action empty {}", field_name));
    }
    Ok(value.to_string())
}

fn optional_non_blank_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn optional_non_blank_lines(lines: Option<&Vec<String>>) -> Option<Vec<String>> {
    lines
        .map(|values| {
            values
                .iter()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|values| !values.is_empty())
}

fn required_non_blank_lines(
    lines: Option<&Vec<String>>,
    field_name: &str,
) -> Result<Vec<String>, String> {
    optional_non_blank_lines(lines)
        .ok_or_else(|| format!("device extension action missing {}", field_name))
}

fn trim_display_command_to_firmware_budget(mut command: ProtocolCommandV2) -> ProtocolCommandV2 {
    while protocol_json_line_len(&command) > SHARED_FIRMWARE_INPUT_LINE_MAX_BYTES {
        if !trim_longest_display_field(&mut command) {
            break;
        }
    }
    command
}

fn protocol_json_line_len(command: &ProtocolCommandV2) -> usize {
    serde_json::to_string(command)
        .map(|value| value.len() + 1)
        .unwrap_or(usize::MAX)
}

enum DisplayTrimField {
    Title,
    Message,
    Icon,
    Line(usize),
}

fn trim_longest_display_field(command: &mut ProtocolCommandV2) -> bool {
    let mut selected: Option<(DisplayTrimField, usize)> = None;
    select_longer_field(
        &mut selected,
        DisplayTrimField::Title,
        command.title.as_ref(),
    );
    select_longer_field(
        &mut selected,
        DisplayTrimField::Message,
        command.message.as_ref(),
    );
    select_longer_field(&mut selected, DisplayTrimField::Icon, command.icon.as_ref());
    if let Some(lines) = &command.lines {
        for (index, line) in lines.iter().enumerate() {
            select_longer_field(&mut selected, DisplayTrimField::Line(index), Some(line));
        }
    }

    match selected.map(|(field, _)| field) {
        Some(DisplayTrimField::Title) => pop_last_char(command.title.as_mut()),
        Some(DisplayTrimField::Message) => pop_last_char(command.message.as_mut()),
        Some(DisplayTrimField::Icon) => pop_last_char(command.icon.as_mut()),
        Some(DisplayTrimField::Line(index)) => command
            .lines
            .as_mut()
            .and_then(|lines| lines.get_mut(index))
            .map(|line| line.pop().is_some())
            .unwrap_or(false),
        None => false,
    }
}

fn select_longer_field(
    selected: &mut Option<(DisplayTrimField, usize)>,
    field: DisplayTrimField,
    value: Option<&String>,
) {
    let Some(value) = value else {
        return;
    };
    let char_count = value.chars().count();
    if char_count == 0 {
        return;
    }
    if selected
        .as_ref()
        .map(|(_, selected_count)| char_count > *selected_count)
        .unwrap_or(true)
    {
        *selected = Some((field, char_count));
    }
}

fn pop_last_char(value: Option<&mut String>) -> bool {
    value.map(|value| value.pop().is_some()).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::{
        DeviceChannelAction, DeviceChannelActionType, DeviceExtensionAction,
        DeviceExtensionActionType,
    };

    fn test_action(action: DeviceChannelActionType) -> DeviceChannelAction {
        DeviceChannelAction {
            device_id: "desk-pico".to_string(),
            channel_id: "pin.gp2".to_string(),
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

    fn test_extension_action(action: DeviceExtensionActionType) -> DeviceExtensionAction {
        DeviceExtensionAction {
            device_id: "desk-wio".to_string(),
            channel_id: None,
            action,
            status: None,
            title: None,
            message: None,
            icon: None,
            lines: None,
            pattern: None,
            control: None,
            active: None,
        }
    }

    #[test]
    fn serializes_activate_action_as_protocol_v2_digital_write_active_line() {
        let line = ProtocolCommandV2::from_device_channel_action(&test_action(
            DeviceChannelActionType::Activate,
        ))
        .expect("activate action should convert")
        .to_json_line()
        .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"digital_write\",\"channel\":\"pin.gp2\",\"state\":\"active\"}\n",
            line
        );
    }

    #[test]
    fn serializes_device_info_query_as_protocol_v2_line() {
        let line = ProtocolCommandV2::device_info()
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!("{\"v\":2,\"type\":\"device_info\"}\n", line);
    }

    #[test]
    fn serializes_set_device_uid_as_protocol_v2_line() {
        let line = ProtocolCommandV2::set_device_uid("arduino-uno:abc123".to_string())
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"set_device_uid\",\"device_uid\":\"arduino-uno:abc123\"}\n",
            line
        );
    }

    #[test]
    fn serializes_display_status_extension_command() {
        let mut action = test_extension_action(DeviceExtensionActionType::DisplayStatus);
        action.status = Some("success".to_string());
        action.title = Some("Done".to_string());
        action.message = Some("Build passed".to_string());

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("display status should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"display_status\",\"status\":\"success\",\"title\":\"Done\",\"message\":\"Build passed\"}\n",
            line
        );
    }

    #[test]
    fn serializes_display_card_extension_command() {
        let mut action = test_extension_action(DeviceExtensionActionType::DisplayCard);
        action.status = Some("success".to_string());
        action.title = Some("Task Done".to_string());
        action.message = Some("Codex / Finished".to_string());
        action.icon = Some("check".to_string());
        action.lines = Some(vec!["Codex".to_string(), "Finished".to_string()]);

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("display card should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"display_card\",\"status\":\"success\",\"title\":\"Task Done\",\"message\":\"Codex / Finished\",\"icon\":\"check\",\"lines\":[\"Codex\",\"Finished\"]}\n",
            line
        );
    }

    #[test]
    fn serializes_display_lines_extension_command() {
        let mut action = test_extension_action(DeviceExtensionActionType::DisplayLines);
        action.lines = Some(vec!["Codex".to_string(), "Waiting".to_string()]);

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("display lines should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"display_lines\",\"lines\":[\"Codex\",\"Waiting\"]}\n",
            line
        );
    }

    #[test]
    fn serializes_display_runtime_extension_command() {
        let mut action = test_extension_action(DeviceExtensionActionType::DisplayRuntime);
        action.status = Some("working".to_string());
        action.title = Some("Working".to_string());
        action.message = Some("Events 3 / Errors 1".to_string());
        action.lines = Some(vec!["Last Codex".to_string(), "Outputs 2".to_string()]);

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("display runtime should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"display_runtime\",\"status\":\"working\",\"title\":\"Working\",\"message\":\"Events 3 / Errors 1\",\"lines\":[\"Last Codex\",\"Outputs 2\"]}\n",
            line
        );
    }

    #[test]
    fn display_extension_command_json_line_fits_shared_firmware_input_buffer() {
        let mut action = test_extension_action(DeviceExtensionActionType::DisplayCard);
        action.status = Some("success".to_string());
        action.title = Some("A".repeat(80));
        action.message = Some("B".repeat(160));
        action.icon = Some("check".to_string());
        action.lines = Some(vec!["C".repeat(80), "D".repeat(80)]);

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("display card should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert!(
            line.len() <= 192,
            "display command line should fit firmware input buffer, got {} bytes",
            line.len()
        );
    }

    #[test]
    fn serializes_device_control_extension_command_with_boolean_active() {
        let mut action = test_extension_action(DeviceExtensionActionType::DeviceControl);
        action.control = Some("mute".to_string());
        action.active = Some(true);

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("device control should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"device_control\",\"control\":\"mute\",\"active\":true}\n",
            line
        );
    }

    #[test]
    fn parses_protocol_ack_error() {
        let ack = ProtocolAck::parse(r#"{"ok":false,"v":2,"error":"unsupported_command"}"#)
            .expect("ack should parse");

        assert!(!ack.ok);
        assert_eq!(Some("unsupported_command".to_string()), ack.error);
    }

    #[test]
    fn parses_device_input_event() {
        let event = DeviceInputEventAck::parse(
            r#"{"v":2,"type":"input_event","control":"button.a","action":"press","seq":18}"#,
        )
        .expect("input event should parse");

        assert_eq!(2, event.v);
        assert_eq!("input_event", event.event_type);
        assert_eq!("button.a", event.control);
        assert_eq!("press", event.action);
        assert_eq!(18, event.seq);
    }

    #[test]
    fn builds_ping_command_json_line() {
        let line = ProtocolCommandV2::ping()
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!("{\"v\":2,\"type\":\"ping\"}\n", line);
    }

    #[test]
    fn parses_device_info_ack_with_device_uid() {
        let ack = DeviceInfoAck::parse(
            r#"{"ok":true,"v":2,"type":"device_info","board_id":"rp2040-pico","device_uid":"rp2040-pico:0011223344556677","firmware_version":"0.2.3","protocol_version":2}"#,
        )
        .expect("device_info ack should parse");

        let info = ack
            .into_firmware_info()
            .expect("device_info ack should become firmware info");

        assert_eq!("rp2040-pico", info.board_id);
        assert_eq!("rp2040-pico:0011223344556677", info.device_uid);
        assert_eq!("0.2.3", info.firmware_version);
        assert_eq!(2, info.protocol_version);
    }

    #[test]
    fn serializes_deactivate_action_as_protocol_v2_digital_write_inactive_line() {
        let line = ProtocolCommandV2::from_device_channel_action(&test_action(
            DeviceChannelActionType::Deactivate,
        ))
        .expect("deactivate action should convert")
        .to_json_line()
        .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"digital_write\",\"channel\":\"pin.gp2\",\"state\":\"inactive\"}\n",
            line
        );
    }

    #[test]
    fn serializes_gpio_input_config_commands() {
        let enable_line = ProtocolCommandV2::configure_gpio_input("pin.gp2".to_string(), true)
            .to_json_line()
            .expect("input config command should serialize");
        let disable_line = ProtocolCommandV2::configure_gpio_input("pin.gp2".to_string(), false)
            .to_json_line()
            .expect("input disable command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"configure_input\",\"channel\":\"pin.gp2\",\"mode\":\"button\",\"pull\":\"up\",\"active_level\":\"low\"}\n",
            enable_line
        );
        assert_eq!(
            "{\"v\":2,\"type\":\"configure_input\",\"channel\":\"pin.gp2\",\"mode\":\"disabled\"}\n",
            disable_line
        );
    }

    #[test]
    fn serializes_blink_action_as_protocol_v2_digital_blink_line() {
        let mut action = test_action(DeviceChannelActionType::Blink);
        action.duration_ms = Some(5000);
        action.interval_ms = Some(250);

        let line = ProtocolCommandV2::from_device_channel_action(&action)
            .expect("blink action should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"digital_blink\",\"channel\":\"pin.gp2\",\"duration_ms\":5000,\"interval_ms\":250}\n",
            line
        );
    }

    #[test]
    fn serializes_breathe_action_as_protocol_v2_digital_breathe_line() {
        let mut action = test_action(DeviceChannelActionType::Breathe);
        action.duration_ms = Some(5000);
        action.interval_ms = Some(1200);

        let line = ProtocolCommandV2::from_device_channel_action(&action)
            .expect("breathe action should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"digital_breathe\",\"channel\":\"pin.gp2\",\"duration_ms\":5000,\"interval_ms\":1200}\n",
            line
        );
    }

    #[test]
    fn serializes_pulse_action_as_protocol_v2_digital_pulse_line() {
        let mut action = test_action(DeviceChannelActionType::Pulse);
        action.duration_ms = Some(1000);

        let line = ProtocolCommandV2::from_device_channel_action(&action)
            .expect("pulse action should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"digital_pulse\",\"channel\":\"pin.gp2\",\"duration_ms\":1000}\n",
            line
        );
    }

    #[test]
    fn serializes_clear_action_as_protocol_v2_clear_channel_line() {
        let line = ProtocolCommandV2::from_device_channel_action(&test_action(
            DeviceChannelActionType::Clear,
        ))
        .expect("clear action should convert")
        .to_json_line()
        .expect("protocol command should serialize");

        assert_eq!(
            "{\"v\":2,\"type\":\"clear_channel\",\"channel\":\"pin.gp2\"}\n",
            line
        );
    }

    #[test]
    fn serializes_set_duty_action_as_protocol_v2_pwm_write_line() {
        let mut action = test_action(DeviceChannelActionType::SetDuty);
        action.channel_id = "pwm.gp14".to_string();
        action.duty_percent = Some(65);
        action.duration_ms = Some(2000);

        let line = ProtocolCommandV2::from_device_channel_action(&action)
            .expect("set-duty action should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        let value: serde_json::Value = serde_json::from_str(line.trim()).expect("json line");
        assert_eq!("pwm_write", value["type"]);
        assert_eq!("pwm.gp14", value["channel"]);
        assert_eq!(65, value["duty_percent"]);
        assert_eq!(2000, value["duration_ms"]);
    }

    #[test]
    fn serializes_beep_action_as_protocol_v2_buzzer_beep_line() {
        let mut action = test_action(DeviceChannelActionType::Beep);
        action.channel_id = "buzzer.gp18".to_string();
        action.frequency_hz = Some(2400);
        action.duration_ms = Some(500);

        let line = ProtocolCommandV2::from_device_channel_action(&action)
            .expect("beep action should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        let value: serde_json::Value = serde_json::from_str(line.trim()).expect("json line");
        assert_eq!("buzzer_beep", value["type"]);
        assert_eq!("buzzer.gp18", value["channel"]);
        assert_eq!(500, value["duration_ms"]);
        assert_eq!(2400, value["frequency_hz"]);
    }

    #[test]
    fn serializes_channelized_buzzer_pattern_extension_action() {
        let action = DeviceExtensionAction {
            device_id: "desk-pico".to_string(),
            channel_id: Some("buzzer.gp19".to_string()),
            action: DeviceExtensionActionType::BuzzerPattern,
            status: None,
            title: None,
            message: None,
            icon: None,
            lines: None,
            pattern: Some("success".to_string()),
            control: None,
            active: None,
        };

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("buzzer pattern extension should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        let value: serde_json::Value = serde_json::from_str(line.trim()).expect("json line");
        assert_eq!("buzzer_pattern", value["type"]);
        assert_eq!("buzzer.gp19", value["channel"]);
        assert_eq!("success", value["pattern"]);
    }

    #[test]
    fn serializes_board_level_buzzer_pattern_extension_action_without_channel() {
        let action = DeviceExtensionAction {
            device_id: "desk-wio".to_string(),
            channel_id: None,
            action: DeviceExtensionActionType::BuzzerPattern,
            status: None,
            title: None,
            message: None,
            icon: None,
            lines: None,
            pattern: Some("error".to_string()),
            control: None,
            active: None,
        };

        let line = ProtocolCommandV2::from_device_extension_action(&action)
            .expect("buzzer pattern extension should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        let value: serde_json::Value = serde_json::from_str(line.trim()).expect("json line");
        assert_eq!("buzzer_pattern", value["type"]);
        assert!(value.get("channel").is_none());
        assert_eq!("error", value["pattern"]);
    }

    #[test]
    fn serializes_set_color_action_as_protocol_v2_addressable_led_set_line() {
        let mut action = test_action(DeviceChannelActionType::SetColor);
        action.channel_id = "ws2812.gp16".to_string();
        action.color = Some("#33cc99".to_string());
        action.brightness_percent = Some(40);

        let line = ProtocolCommandV2::from_device_channel_action(&action)
            .expect("set-color action should convert")
            .to_json_line()
            .expect("protocol command should serialize");

        let value: serde_json::Value = serde_json::from_str(line.trim()).expect("json line");
        assert_eq!("addressable_led_set", value["type"]);
        assert_eq!("ws2812.gp16", value["channel"]);
        assert_eq!("#33cc99", value["color"]);
        assert_eq!(40, value["brightness_percent"]);
    }
}
