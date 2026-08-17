use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

use crate::core::desktop_notice::{
    desktop_notice_animation_period_range, validate_desktop_notice_appearance,
    DesktopMascotPlayMode, DesktopMascotState, DesktopNoticeAppearance, DesktopNoticeColorMode,
    DesktopNoticeColorStop, DesktopNoticeEdge, DesktopNoticeRestoreBehavior,
    DesktopNoticeRuleEffect, DESKTOP_MASCOT_MAX_PLAYBACK_WINDOW_MS,
    DESKTOP_MASCOT_MIN_PLAYBACK_WINDOW_MS, DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT,
    DESKTOP_NOTICE_MAX_OPACITY_PERCENT, DESKTOP_NOTICE_MAX_RULE_DURATION_MS,
    DESKTOP_NOTICE_MIN_BRIGHTNESS_PERCENT, DESKTOP_NOTICE_MIN_OPACITY_PERCENT,
    DESKTOP_NOTICE_MIN_RULE_DURATION_MS,
};
use crate::core::device::DeviceChannelActionType;
use crate::core::hook_events::is_known_hook_event;
pub use crate::core::internal_events::InternalEventDefinition;
use crate::core::internal_events::{
    builtin_internal_event_catalog, builtin_internal_event_ids, is_known_internal_event,
};

const MAX_NOTIFICATION_THROTTLE_SECONDS: u32 = 3600;
const MAX_WEBHOOK_BODY_CHARS: u32 = 20_000;
const MAX_SOUND_THROTTLE_SECONDS: u32 = 3600;
const MAX_SOUND_DURATION_MS: u32 = 60_000;
const MAX_ENABLED_HARDWARE_OUTPUTS_PER_INTERNAL_EVENT: usize = 5;
pub const MAX_DEVICE_CHANNEL_ACTIONS_PER_RULE: usize = 10;
const DEVICE_CHANNEL_DURATION_MS_RANGE: std::ops::RangeInclusive<u32> = 100..=600_000;
const DEVICE_CHANNEL_INTERVAL_MS_RANGE: std::ops::RangeInclusive<u64> = 100..=10_000;
const DEVICE_CHANNEL_FREQUENCY_HZ_RANGE: std::ops::RangeInclusive<u32> = 20..=20_000;
const DEVICE_CHANNEL_PERCENT_RANGE: std::ops::RangeInclusive<u8> = 0..=100;

pub const DEFAULT_PROFILE_ID: &str = "daily-coding";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoticeProfile {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub enabled_hook_events: Vec<EnabledHookEvent>,
    #[serde(default)]
    pub ai_event_mappings: Vec<AiEventMapping>,
    #[serde(default)]
    pub hardware_rules: Vec<HardwareRule>,
    #[serde(default = "default_device_profile")]
    pub device: DeviceProfile,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnabledHookEvent {
    pub source: String,
    pub event: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEventMapping {
    pub id: String,
    pub source: String,
    pub event: String,
    pub internal_event: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareRule {
    pub id: String,
    pub internal_event: String,
    pub output: HardwareOutput,
    pub priority: u8,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareOutput {
    #[serde(rename = "type")]
    pub output_type: HardwareOutputType,
    // DeviceChannel 字段。device-channel 输出只通过动作组表达，禁止恢复旧单动作字段。
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub channel_actions: Vec<DeviceChannelRuleAction>,
    /// 持续时间（毫秒）
    /// - `None`: 永久有效，直到下一条指令覆盖
    /// - `Some(n)`: 持续 n 毫秒后自动恢复初始状态（如关闭灯光）
    /// - 不允许 `Some(0)`，应使用 `None` 表示永久或明确的正整数表示持续时间
    pub duration_ms: Option<u32>,
    // 通用字段
    pub text: Option<String>,
    // SystemNotification 字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_title_max_chars: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_body_max_chars: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notification_throttle_seconds: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notification_sound: Option<String>,
    // Webhook 字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_headers: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webhook_body_max_chars: Option<u32>,
    // Sound 字段
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_file_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_volume_percent: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_max_duration_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_throttle_seconds: Option<u32>,
    // Display 字段。屏幕输出属于设备级扩展能力，不绑定具体通道。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_device_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_accent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_lines_template: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_title_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_message_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_title_max_chars: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_message_max_chars: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_expire_behavior: Option<String>,
    // DesktopNotice 字段。桌面提示是本地软件输出，不属于设备屏幕 display。
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub desktop_notice_targets: Vec<DesktopNoticeRuleTarget>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNoticeRuleTarget {
    pub target_id: String,
    pub effect: DesktopNoticeRuleEffect,
    pub color_mode: DesktopNoticeColorMode,
    pub colors: Vec<DesktopNoticeColorStop>,
    pub duration_ms: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub animation_period_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breathing_period_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opacity_percent: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brightness_percent: Option<u8>,
    pub restore_behavior: DesktopNoticeRestoreBehavior,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge: Option<DesktopNoticeEdge>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mascot_state: Option<DesktopMascotState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mascot_action_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mascot_play_mode: Option<DesktopMascotPlayMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mascot_playback_window_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mascot_bubble_template: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceChannelRuleAction {
    pub id: String,
    pub device_id: String,
    pub channel_id: String,
    pub channel_action: DeviceChannelActionType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interval_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duty_percent: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency_hz: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brightness_percent: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_accent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_icon: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_lines_template: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_title_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_message_template: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_title_max_chars: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_message_max_chars: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HardwareOutputType {
    DeviceChannel,
    Display,
    Buzzer,
    SystemNotification,
    Webhook,
    Sound,
    DesktopNotice,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfile {
    pub board_id: String,
    pub transport: String,
}

impl NoticeProfile {
    pub fn daily_coding() -> Self {
        let mut profile = Self {
            id: DEFAULT_PROFILE_ID.to_string(),
            name: "Daily Coding".to_string(),
            enabled_hook_events: Vec::new(),
            ai_event_mappings: Vec::new(),
            hardware_rules: Vec::new(),
            device: default_device_profile(),
        };
        ProfileTemplate::Basic.apply_to_profile(&mut profile);
        profile
    }

    pub fn validate(&self) -> Result<(), String> {
        self.validate_with_internal_events(&builtin_internal_event_ids())
    }

    pub fn validate_with_internal_events(
        &self,
        valid_event_ids: &HashSet<String>,
    ) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("profile id cannot be empty".to_string());
        }
        if self.name.trim().is_empty() {
            return Err("profile name cannot be empty".to_string());
        }

        for event in &self.enabled_hook_events {
            validate_hook_event(&event.source, &event.event, "enabled hook event")?;
        }

        // 验证 AI 映射的唯一性和 ID 唯一性
        let mut ai_mapping_keys = HashSet::new();
        let mut ai_mapping_ids = HashSet::new();
        for mapping in &self.ai_event_mappings {
            validate_hook_event(&mapping.source, &mapping.event, "ai mapping")?;

            // 验证 ID 唯一性
            if !ai_mapping_ids.insert(&mapping.id) {
                return Err(format!("duplicate ai mapping id: {}", mapping.id));
            }

            // 验证 source/event 组合唯一性
            let key = (mapping.source.as_str(), mapping.event.as_str());
            if !ai_mapping_keys.insert(key) {
                return Err(format!(
                    "duplicate ai mapping event: {}/{}",
                    mapping.source, mapping.event
                ));
            }

            if !is_known_internal_event(&mapping.internal_event, valid_event_ids) {
                return Err(format!(
                    "unknown internal event in ai mapping: {}",
                    mapping.internal_event
                ));
            }
        }

        // 验证硬件规则的唯一性和 ID 唯一性
        let mut hardware_rule_keys = HashSet::new();
        let mut hardware_rule_ids = HashSet::new();
        let mut enabled_hardware_output_counts: HashMap<&str, usize> = HashMap::new();
        for rule in &self.hardware_rules {
            // 验证 ID 唯一性
            if !hardware_rule_ids.insert(&rule.id) {
                return Err(format!("duplicate hardware rule id: {}", rule.id));
            }

            if !is_known_internal_event(&rule.internal_event, valid_event_ids) {
                return Err(format!(
                    "unknown internal event in hardware rule: {}",
                    rule.internal_event
                ));
            }

            match hardware_rule_unique_key(rule) {
                Some(HardwareRuleUniqueKey::OutputType(internal_event, output_type)) => {
                    if !hardware_rule_keys.insert((internal_event, output_type)) {
                        return Err(format!(
                            "duplicate hardware output rule: {}/{}",
                            rule.internal_event,
                            hardware_output_type_id(rule.output.output_type)
                        ));
                    }
                }
                None => {}
            }

            // 验证 duration_ms
            if let Some(duration) = rule.output.duration_ms {
                if duration == 0 {
                    return Err(format!(
                        "hardware rule {} has duration_ms=0, use None for permanent or a positive value",
                        rule.id
                    ));
                }
            }

            // 验证各输出类型的必填字段
            if rule.enabled {
                let enabled_count = enabled_hardware_output_counts
                    .entry(rule.internal_event.as_str())
                    .and_modify(|count| *count += 1)
                    .or_insert(1);
                if *enabled_count > MAX_ENABLED_HARDWARE_OUTPUTS_PER_INTERNAL_EVENT {
                    return Err(format!(
                        "too many enabled hardware output rules for {}: {} > {}",
                        rule.internal_event,
                        enabled_count,
                        MAX_ENABLED_HARDWARE_OUTPUTS_PER_INTERNAL_EVENT
                    ));
                }

                match rule.output.output_type {
                    HardwareOutputType::DeviceChannel => {
                        validate_device_channel_output(&rule.output, &rule.id)?;
                    }
                    HardwareOutputType::SystemNotification => {
                        validate_notification_output(&rule.output, &rule.id)?;
                    }
                    HardwareOutputType::Webhook => {
                        validate_webhook_output(&rule.output, &rule.id)?;
                    }
                    HardwareOutputType::Sound => {
                        validate_sound_output(&rule.output, &rule.id)?;
                    }
                    HardwareOutputType::Display => {
                        validate_display_output(&rule.output, &rule.id)?;
                    }
                    HardwareOutputType::DesktopNotice => {
                        validate_desktop_notice_output(&rule.output, &rule.id)?;
                    }
                    _ => {
                        // 其他类型暂无特殊校验
                    }
                }
            }
        }

        Ok(())
    }

    pub fn map_ai_event(&self, source: &str, event: &str) -> Option<String> {
        self.ai_event_mappings
            .iter()
            .find(|mapping| mapping.enabled && mapping.source == source && mapping.event == event)
            .map(|mapping| mapping.internal_event.clone())
    }

    pub fn is_hook_event_enabled(&self, source: &str, event: &str) -> bool {
        self.enabled_hook_events
            .iter()
            .any(|enabled| enabled.source == source && enabled.event == event)
    }

    pub fn map_hardware_output(&self, internal_event: &str) -> Option<HardwareRule> {
        self.map_hardware_outputs(internal_event).into_iter().next()
    }

    pub fn map_hardware_outputs(&self, internal_event: &str) -> Vec<HardwareRule> {
        let mut rules = self
            .hardware_rules
            .iter()
            .filter(|rule| rule.enabled && rule.internal_event == internal_event)
            .cloned()
            .collect::<Vec<_>>();
        rules.sort_by(|left, right| right.priority.cmp(&left.priority));
        rules
    }
}

pub fn internal_event_catalog() -> Vec<InternalEventDefinition> {
    builtin_internal_event_catalog()
}

pub fn is_internal_event(event: &str) -> bool {
    is_known_internal_event(event, &builtin_internal_event_ids())
}

pub fn default_device_profile() -> DeviceProfile {
    DeviceProfile {
        board_id: "rp2040-pico".to_string(),
        transport: "serial".to_string(),
    }
}

fn validate_hook_event(source: &str, event: &str, label: &str) -> Result<(), String> {
    if !is_known_hook_event(source, event) {
        return Err(format!("unknown hook event in {label}: {source}/{event}"));
    }
    Ok(())
}

enum HardwareRuleUniqueKey<'a> {
    OutputType(&'a str, HardwareOutputType),
}

fn hardware_rule_unique_key(rule: &HardwareRule) -> Option<HardwareRuleUniqueKey<'_>> {
    Some(HardwareRuleUniqueKey::OutputType(
        rule.internal_event.as_str(),
        rule.output.output_type,
    ))
}

fn validate_device_channel_output(output: &HardwareOutput, rule_id: &str) -> Result<(), String> {
    if output.channel_actions.is_empty() {
        return Err(format!(
            "device-channel rule {} requires channel_actions",
            rule_id
        ));
    }
    if output.channel_actions.len() > MAX_DEVICE_CHANNEL_ACTIONS_PER_RULE {
        return Err(format!(
            "device-channel rule {} has too many device-channel actions: {} > {}",
            rule_id,
            output.channel_actions.len(),
            MAX_DEVICE_CHANNEL_ACTIONS_PER_RULE
        ));
    }

    let mut action_ids = HashSet::new();
    let mut action_targets = HashSet::new();
    for action in &output.channel_actions {
        validate_device_channel_rule_action(action, rule_id)?;
        if !action_ids.insert(action.id.as_str()) {
            return Err(format!(
                "device-channel rule {} has duplicate action id: {}",
                rule_id, action.id
            ));
        }
        let target = (action.device_id.as_str(), action.channel_id.as_str());
        if !action_targets.insert(target) {
            return Err(format!(
                "device-channel rule {} has duplicate device-channel action target: {}/{}",
                rule_id, action.device_id, action.channel_id
            ));
        }
    }
    Ok(())
}

fn validate_device_channel_rule_action(
    action: &DeviceChannelRuleAction,
    rule_id: &str,
) -> Result<(), String> {
    if action.id.trim().is_empty() {
        return Err(format!(
            "device-channel rule {} has empty action id",
            rule_id
        ));
    }
    if action.device_id.trim().is_empty() {
        return Err(format!(
            "device-channel rule {} requires device_id",
            rule_id
        ));
    }
    if action.channel_id.trim().is_empty() {
        return Err(format!(
            "device-channel rule {} requires channel_id",
            rule_id
        ));
    }

    validate_device_channel_action_parameters(action, action.channel_action, rule_id)?;
    validate_device_channel_duration_ms(action.duration_ms, rule_id)?;
    validate_device_channel_interval_ms(action.interval_ms, rule_id)?;
    validate_device_channel_frequency_hz(action.frequency_hz, rule_id)?;
    validate_device_channel_percent(action.duty_percent, rule_id, "duty_percent")?;
    validate_device_channel_percent(action.brightness_percent, rule_id, "brightness_percent")?;
    Ok(())
}

fn validate_device_channel_action_parameters(
    action: &DeviceChannelRuleAction,
    channel_action: DeviceChannelActionType,
    rule_id: &str,
) -> Result<(), String> {
    match channel_action {
        DeviceChannelActionType::SetDuty => require_device_channel_field(
            action.duty_percent.is_some(),
            rule_id,
            "set-duty action requires duty_percent",
        ),
        DeviceChannelActionType::Beep | DeviceChannelActionType::Tone => {
            require_device_channel_field(
                action.frequency_hz.is_some(),
                rule_id,
                "beep/tone action requires frequency_hz",
            )
        }
        DeviceChannelActionType::Pattern => {
            let pattern = action.pattern.as_deref().unwrap_or("").trim();
            if pattern.is_empty() {
                return Err(format!(
                    "device-channel rule {} pattern action requires pattern",
                    rule_id
                ));
            }
            if !matches!(
                pattern,
                "notice" | "success" | "warning" | "error" | "working"
            ) {
                return Err(format!(
                    "device-channel rule {} has unsupported pattern: {}",
                    rule_id, pattern
                ));
            }
            Ok(())
        }
        DeviceChannelActionType::DisplayStatus => {
            validate_display_template_id(action.display_template_id.as_deref(), rule_id)?;
            validate_display_status(action.display_status.as_deref(), rule_id)?;
            require_device_channel_text(
                action.display_title_template.as_deref(),
                rule_id,
                "display-status action requires display_title_template",
            )?;
            require_device_channel_text(
                action.display_message_template.as_deref(),
                rule_id,
                "display-status action requires display_message_template",
            )?;
            validate_optional_max_chars(
                action.display_title_max_chars,
                "display_title_max_chars",
                rule_id,
            )?;
            validate_optional_max_chars(
                action.display_message_max_chars,
                "display_message_max_chars",
                rule_id,
            )?;
            Ok(())
        }
        DeviceChannelActionType::SetColor => {
            require_device_channel_field(
                action
                    .color
                    .as_deref()
                    .map(|color| !color.trim().is_empty())
                    .unwrap_or(false),
                rule_id,
                "set-color action requires color",
            )?;
            require_device_channel_field(
                action.brightness_percent.is_some(),
                rule_id,
                "set-color action requires brightness_percent",
            )
        }
        DeviceChannelActionType::Blink | DeviceChannelActionType::Breathe => {
            require_device_channel_field(
                action.interval_ms.is_some(),
                rule_id,
                "blink/breathe action requires interval_ms",
            )
        }
        DeviceChannelActionType::Activate
        | DeviceChannelActionType::Deactivate
        | DeviceChannelActionType::Pulse
        | DeviceChannelActionType::Clear => Ok(()),
    }
}

fn validate_display_template_id(template_id: Option<&str>, rule_id: &str) -> Result<(), String> {
    let Some(template_id) = template_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(());
    };

    if matches!(
        template_id,
        "notice"
            | "task-started"
            | "task-running"
            | "task-success"
            | "task-warning"
            | "task-error"
            | "waiting-input"
    ) {
        Ok(())
    } else {
        Err(format!(
            "device-channel rule {} has unsupported display_template_id: {}",
            rule_id, template_id
        ))
    }
}

fn require_device_channel_field(valid: bool, rule_id: &str, message: &str) -> Result<(), String> {
    if valid {
        return Ok(());
    }
    Err(format!("device-channel rule {} {}", rule_id, message))
}

fn require_device_channel_text(
    value: Option<&str>,
    rule_id: &str,
    message: &str,
) -> Result<(), String> {
    require_device_channel_field(
        value.map(str::trim).is_some_and(|value| !value.is_empty()),
        rule_id,
        message,
    )
}

fn validate_device_channel_duration_ms(
    duration_ms: Option<u32>,
    rule_id: &str,
) -> Result<(), String> {
    if let Some(duration_ms) = duration_ms {
        if !DEVICE_CHANNEL_DURATION_MS_RANGE.contains(&duration_ms) {
            return Err(format!(
                "device-channel rule {} has duration_ms={}, expected {}..={}",
                rule_id,
                duration_ms,
                DEVICE_CHANNEL_DURATION_MS_RANGE.start(),
                DEVICE_CHANNEL_DURATION_MS_RANGE.end()
            ));
        }
    }
    Ok(())
}

fn validate_device_channel_interval_ms(
    interval_ms: Option<u64>,
    rule_id: &str,
) -> Result<(), String> {
    if let Some(interval_ms) = interval_ms {
        if !DEVICE_CHANNEL_INTERVAL_MS_RANGE.contains(&interval_ms) {
            return Err(format!(
                "device-channel rule {} has interval_ms={}, expected {}..={}",
                rule_id,
                interval_ms,
                DEVICE_CHANNEL_INTERVAL_MS_RANGE.start(),
                DEVICE_CHANNEL_INTERVAL_MS_RANGE.end()
            ));
        }
    }
    Ok(())
}

fn validate_device_channel_frequency_hz(
    frequency_hz: Option<u32>,
    rule_id: &str,
) -> Result<(), String> {
    if let Some(frequency_hz) = frequency_hz {
        if !DEVICE_CHANNEL_FREQUENCY_HZ_RANGE.contains(&frequency_hz) {
            return Err(format!(
                "device-channel rule {} has frequency_hz={}, expected {}..={}",
                rule_id,
                frequency_hz,
                DEVICE_CHANNEL_FREQUENCY_HZ_RANGE.start(),
                DEVICE_CHANNEL_FREQUENCY_HZ_RANGE.end()
            ));
        }
    }
    Ok(())
}

fn validate_device_channel_percent(
    percent: Option<u8>,
    rule_id: &str,
    field_name: &str,
) -> Result<(), String> {
    if let Some(percent) = percent {
        if !DEVICE_CHANNEL_PERCENT_RANGE.contains(&percent) {
            return Err(format!(
                "device-channel rule {} has {}={}, expected {}..={}",
                rule_id,
                field_name,
                percent,
                DEVICE_CHANNEL_PERCENT_RANGE.start(),
                DEVICE_CHANNEL_PERCENT_RANGE.end()
            ));
        }
    }
    Ok(())
}

fn validate_display_output(output: &HardwareOutput, rule_id: &str) -> Result<(), String> {
    require_non_blank_option(
        output.display_device_id.as_deref(),
        "display",
        rule_id,
        "display_device_id",
    )?;
    let status = require_non_blank_option(
        output.display_status.as_deref(),
        "display",
        rule_id,
        "display_status",
    )?;
    validate_display_status(Some(status), rule_id)?;
    validate_display_template_id(output.display_template_id.as_deref(), rule_id)?;
    require_non_blank_option(
        output.display_title_template.as_deref(),
        "display",
        rule_id,
        "display_title_template",
    )?;
    require_non_blank_option(
        output.display_message_template.as_deref(),
        "display",
        rule_id,
        "display_message_template",
    )?;
    validate_optional_max_chars(
        output.display_title_max_chars,
        "display_title_max_chars",
        rule_id,
    )?;
    validate_optional_max_chars(
        output.display_message_max_chars,
        "display_message_max_chars",
        rule_id,
    )?;
    if let Some(expire_behavior) = output.display_expire_behavior.as_deref() {
        if expire_behavior != "restore-status" {
            return Err(format!(
                "display rule {} has unsupported display_expire_behavior: {}",
                rule_id, expire_behavior
            ));
        }
    }
    Ok(())
}

fn validate_display_status(status: Option<&str>, rule_id: &str) -> Result<(), String> {
    let status = status.unwrap_or("").trim();
    if status.is_empty() {
        return Err(format!(
            "device-channel rule {} display-status action requires display_status",
            rule_id
        ));
    }
    if !matches!(
        status,
        "notice" | "working" | "success" | "warning" | "error"
    ) {
        return Err(format!(
            "display rule {} has unsupported display_status: {}",
            rule_id, status
        ));
    }
    Ok(())
}

fn validate_desktop_notice_output(output: &HardwareOutput, rule_id: &str) -> Result<(), String> {
    if output.desktop_notice_targets.is_empty() {
        return Err(format!(
            "desktop notice rule {} has empty desktop_notice_targets",
            rule_id
        ));
    }
    if output
        .desktop_notice_targets
        .iter()
        .any(|target| target.target_id.trim().is_empty())
    {
        return Err(format!(
            "desktop notice rule {} has blank desktop_notice_target",
            rule_id
        ));
    }
    for target in &output.desktop_notice_targets {
        if !(DESKTOP_NOTICE_MIN_RULE_DURATION_MS..=DESKTOP_NOTICE_MAX_RULE_DURATION_MS)
            .contains(&target.duration_ms)
        {
            return Err(format!(
                "desktop notice rule {} target {} has duration_ms={}, expected {}..={}",
                rule_id,
                target.target_id,
                target.duration_ms,
                DESKTOP_NOTICE_MIN_RULE_DURATION_MS,
                DESKTOP_NOTICE_MAX_RULE_DURATION_MS
            ));
        }
        if let Some(animation_period_ms) = target.animation_period_ms {
            validate_desktop_notice_animation_period(
                rule_id,
                &target.target_id,
                target.effect,
                "animation_period_ms",
                animation_period_ms,
            )?;
        }
        if let Some(breathing_period_ms) = target.breathing_period_ms {
            if !matches!(
                target.effect,
                DesktopNoticeRuleEffect::Breathing | DesktopNoticeRuleEffect::EdgeBreathing
            ) {
                return Err(format!(
                    "desktop notice rule {} target {} does not support breathing_period_ms",
                    rule_id, target.target_id
                ));
            }
            validate_desktop_notice_animation_period(
                rule_id,
                &target.target_id,
                target.effect,
                "breathing_period_ms",
                breathing_period_ms,
            )?;
        }
        if let Some(opacity_percent) = target.opacity_percent {
            if !(DESKTOP_NOTICE_MIN_OPACITY_PERCENT..=DESKTOP_NOTICE_MAX_OPACITY_PERCENT)
                .contains(&opacity_percent)
            {
                return Err(format!(
                    "desktop notice rule {} target {} has opacity_percent={}, expected {}..={}",
                    rule_id,
                    target.target_id,
                    opacity_percent,
                    DESKTOP_NOTICE_MIN_OPACITY_PERCENT,
                    DESKTOP_NOTICE_MAX_OPACITY_PERCENT
                ));
            }
        }
        if let Some(brightness_percent) = target.brightness_percent {
            if !(DESKTOP_NOTICE_MIN_BRIGHTNESS_PERCENT..=DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT)
                .contains(&brightness_percent)
            {
                return Err(format!(
                    "desktop notice rule {} target {} has brightness_percent={}, expected {}..={}",
                    rule_id,
                    target.target_id,
                    brightness_percent,
                    DESKTOP_NOTICE_MIN_BRIGHTNESS_PERCENT,
                    DESKTOP_NOTICE_MAX_BRIGHTNESS_PERCENT
                ));
            }
        }
        validate_desktop_notice_appearance(&DesktopNoticeAppearance {
            color_mode: target.color_mode,
            colors: target.colors.clone(),
        })
        .map_err(|error| {
            format!(
                "desktop notice rule {} target {} has invalid appearance: {}",
                rule_id,
                target.target_id,
                error.code_string()
            )
        })?;
        if let Some(template) = target.mascot_bubble_template.as_deref() {
            validate_desktop_mascot_bubble_template(template).map_err(|reason| {
                format!(
                    "desktop notice rule {} target {} has invalid mascot bubble template: {}",
                    rule_id, target.target_id, reason
                )
            })?;
        }
        if let Some(playback_window_ms) = target.mascot_playback_window_ms {
            if is_once_mascot_play_mode(target.mascot_play_mode)
                && !(DESKTOP_MASCOT_MIN_PLAYBACK_WINDOW_MS..=DESKTOP_MASCOT_MAX_PLAYBACK_WINDOW_MS)
                    .contains(&playback_window_ms)
            {
                return Err(format!(
                    "desktop notice rule {} target {} has invalid mascot_playback_window_ms={}, expected {}..={}",
                    rule_id,
                    target.target_id,
                    playback_window_ms,
                    DESKTOP_MASCOT_MIN_PLAYBACK_WINDOW_MS,
                    DESKTOP_MASCOT_MAX_PLAYBACK_WINDOW_MS
                ));
            }
        }
    }
    Ok(())
}

fn validate_desktop_notice_animation_period(
    rule_id: &str,
    target_id: &str,
    effect: DesktopNoticeRuleEffect,
    field_name: &str,
    value: u32,
) -> Result<(), String> {
    if let Some((min, max)) = desktop_notice_animation_period_range(effect) {
        if !(min..=max).contains(&value) {
            return Err(format!(
                "desktop notice rule {} target {} has {}={}, expected {}..={}",
                rule_id, target_id, field_name, value, min, max
            ));
        }
        return Ok(());
    }
    Err(format!(
        "desktop notice rule {} target {} does not support {}",
        rule_id, target_id, field_name
    ))
}

fn is_once_mascot_play_mode(play_mode: Option<DesktopMascotPlayMode>) -> bool {
    matches!(
        play_mode,
        Some(DesktopMascotPlayMode::OnceThenHold | DesktopMascotPlayMode::OnceThenIdle)
    )
}

fn validate_desktop_mascot_bubble_template(value: &str) -> Result<(), &'static str> {
    let lines: Vec<&str> = value.lines().collect();
    if lines.len() > 2 {
        return Err("too many lines");
    }
    if lines.iter().any(|line| line.chars().count() > 18) {
        return Err("line too long");
    }
    Ok(())
}

fn require_non_blank_option<'a>(
    value: Option<&'a str>,
    output_type: &str,
    rule_id: &str,
    field_name: &str,
) -> Result<&'a str, String> {
    let value =
        value.ok_or_else(|| format!("{} rule {} requires {}", output_type, rule_id, field_name))?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!(
            "{} rule {} has empty {}",
            output_type, rule_id, field_name
        ));
    }
    Ok(trimmed)
}

fn validate_optional_max_chars(
    value: Option<u32>,
    field_name: &str,
    rule_id: &str,
) -> Result<(), String> {
    if let Some(value) = value {
        if !(1..=300).contains(&value) {
            return Err(format!(
                "display rule {} has {}={}, expected 1..=300",
                rule_id, field_name, value
            ));
        }
    }
    Ok(())
}

fn validate_notification_output(output: &HardwareOutput, rule_id: &str) -> Result<(), String> {
    // 验证通知标题非空
    match &output.notification_title {
        None => {
            return Err(format!(
                "system-notification rule {} requires notification_title",
                rule_id
            ));
        }
        Some(title) if title.trim().is_empty() => {
            return Err(format!(
                "system-notification rule {} has empty notification_title",
                rule_id
            ));
        }
        _ => {}
    }

    // 验证通知内容非空
    match &output.notification_body {
        None => {
            return Err(format!(
                "system-notification rule {} requires notification_body",
                rule_id
            ));
        }
        Some(body) if body.trim().is_empty() => {
            return Err(format!(
                "system-notification rule {} has empty notification_body",
                rule_id
            ));
        }
        _ => {}
    }

    // 验证通知级别是预定义值之一
    if let Some(level) = &output.notification_level {
        let valid_levels = ["info", "warning", "error", "success"];
        if !valid_levels.contains(&level.as_str()) {
            return Err(format!(
                "system-notification rule {} has invalid notification_level: {}, expected one of: {}",
                rule_id,
                level,
                valid_levels.join(", ")
            ));
        }
    }

    validate_positive_text_limit(
        output.notification_title_max_chars,
        rule_id,
        "notification_title_max_chars",
    )?;
    validate_positive_text_limit(
        output.notification_body_max_chars,
        rule_id,
        "notification_body_max_chars",
    )?;
    validate_notification_throttle_seconds(output.notification_throttle_seconds, rule_id)?;

    Ok(())
}

fn validate_positive_text_limit(
    value: Option<u32>,
    rule_id: &str,
    field_name: &str,
) -> Result<(), String> {
    if value == Some(0) {
        return Err(format!(
            "system-notification rule {} has {}=0, use a positive value",
            rule_id, field_name
        ));
    }
    Ok(())
}

fn validate_notification_throttle_seconds(value: Option<u32>, rule_id: &str) -> Result<(), String> {
    if let Some(seconds) = value {
        if seconds > MAX_NOTIFICATION_THROTTLE_SECONDS {
            return Err(format!(
                "system-notification rule {} has notification_throttle_seconds={}, expected 0..={}",
                rule_id, seconds, MAX_NOTIFICATION_THROTTLE_SECONDS
            ));
        }
    }
    Ok(())
}

fn validate_webhook_output(output: &HardwareOutput, rule_id: &str) -> Result<(), String> {
    // 验证 Webhook URL 非空且格式正确
    match &output.webhook_url {
        None => {
            return Err(format!("webhook rule {} requires webhook_url", rule_id));
        }
        Some(url) if url.trim().is_empty() => {
            return Err(format!("webhook rule {} has empty webhook_url", rule_id));
        }
        Some(url) => {
            // 简单校验 URL 格式（必须以 http:// 或 https:// 开头）
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err(format!(
                    "webhook rule {} has invalid webhook_url: {}, must start with http:// or https://",
                    rule_id, url
                ));
            }
        }
    }

    // 验证 HTTP 方法是预定义值之一
    if let Some(method) = &output.webhook_method {
        let valid_methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
        if !valid_methods.contains(&method.as_str()) {
            return Err(format!(
                "webhook rule {} has invalid webhook_method: {}, expected one of: {}",
                rule_id,
                method,
                valid_methods.join(", ")
            ));
        }
    }

    // 验证请求头是有效的 JSON（如果非空）
    if let Some(headers) = &output.webhook_headers {
        if !headers.trim().is_empty() {
            serde_json::from_str::<serde_json::Value>(headers).map_err(|e| {
                format!(
                    "webhook rule {} has invalid webhook_headers JSON: {}",
                    rule_id, e
                )
            })?;
        }
    }

    // 验证请求体是有效的 JSON（如果非空）
    if let Some(body) = &output.webhook_body {
        if !body.trim().is_empty() {
            serde_json::from_str::<serde_json::Value>(body).map_err(|e| {
                format!(
                    "webhook rule {} has invalid webhook_body JSON: {}",
                    rule_id, e
                )
            })?;
        }
    }

    if let Some(max_chars) = output.webhook_body_max_chars {
        if max_chars == 0 || max_chars > MAX_WEBHOOK_BODY_CHARS {
            return Err(format!(
                "webhook rule {} has invalid webhook_body_max_chars: {}, expected 1..={}",
                rule_id, max_chars, MAX_WEBHOOK_BODY_CHARS
            ));
        }
    }

    Ok(())
}

fn validate_sound_output(output: &HardwareOutput, rule_id: &str) -> Result<(), String> {
    match &output.sound_file_path {
        None => {
            return Err(format!("sound rule {} requires sound_file_path", rule_id));
        }
        Some(path) if path.trim().is_empty() => {
            return Err(format!("sound rule {} has empty sound_file_path", rule_id));
        }
        Some(_) => {}
    }

    if let Some(volume) = output.sound_volume_percent {
        if volume > 100 {
            return Err(format!(
                "sound rule {} has sound_volume_percent={}, expected 0..=100",
                rule_id, volume
            ));
        }
    }

    if let Some(duration_ms) = output.sound_max_duration_ms {
        if duration_ms == 0 || duration_ms > MAX_SOUND_DURATION_MS {
            return Err(format!(
                "sound rule {} has sound_max_duration_ms={}, expected 1..={}",
                rule_id, duration_ms, MAX_SOUND_DURATION_MS
            ));
        }
    }

    if let Some(seconds) = output.sound_throttle_seconds {
        if seconds > MAX_SOUND_THROTTLE_SECONDS {
            return Err(format!(
                "sound rule {} has sound_throttle_seconds={}, expected 0..={}",
                rule_id, seconds, MAX_SOUND_THROTTLE_SECONDS
            ));
        }
    }

    Ok(())
}

fn hardware_output_type_id(output_type: HardwareOutputType) -> &'static str {
    match output_type {
        HardwareOutputType::DeviceChannel => "device-channel",
        HardwareOutputType::Display => "display",
        HardwareOutputType::Buzzer => "buzzer",
        HardwareOutputType::SystemNotification => "system-notification",
        HardwareOutputType::Webhook => "webhook",
        HardwareOutputType::Sound => "sound",
        HardwareOutputType::DesktopNotice => "desktop-notice",
        HardwareOutputType::Custom => "custom",
    }
}

// ============================================================================
// 配置模板
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProfileTemplate {
    #[serde(alias = "codex-basic", alias = "claude-code-basic")]
    Basic,
    #[serde(alias = "codex-advanced", alias = "claude-code-advanced")]
    Advanced,
    Blank,
}

impl ProfileTemplate {
    pub fn id(&self) -> &'static str {
        match self {
            Self::Basic => "basic",
            Self::Advanced => "advanced",
            Self::Blank => "blank",
        }
    }

    pub fn name(&self) -> String {
        crate::core::profile_templates::loader::get_template(*self)
            .map(|template| template.name)
            .unwrap_or_else(|error| {
                tracing::error!(
                    "failed to load profile template name {}: {}",
                    self.id(),
                    error
                );
                self.fallback_name().to_string()
            })
    }

    fn fallback_name(&self) -> &'static str {
        match self {
            Self::Basic => "Basic Mapping Profile",
            Self::Advanced => "Advanced Mapping Profile",
            Self::Blank => "Blank Profile",
        }
    }

    pub fn description(&self) -> String {
        crate::core::profile_templates::loader::get_template(*self)
            .map(|template| template.description)
            .unwrap_or_else(|error| {
                tracing::error!(
                    "failed to load profile template description {}: {}",
                    self.id(),
                    error
                );
                self.fallback_description().to_string()
            })
    }

    fn fallback_description(&self) -> &'static str {
        match self {
            Self::Basic => "Preset common AI Hook mappings and basic output rules without enabling any Hook event",
            Self::Advanced => "Preset extended AI Hook mappings and output rules without enabling any Hook event",
            Self::Blank => "Start from an empty custom profile",
        }
    }

    pub fn is_recommended(&self) -> bool {
        crate::core::profile_templates::loader::get_template(*self)
            .map(|template| template.recommended)
            .unwrap_or_else(|error| {
                tracing::error!(
                    "failed to load profile template recommended flag {}: {}",
                    self.id(),
                    error
                );
                matches!(self, Self::Basic)
            })
    }

    pub fn apply_to_profile(&self, profile: &mut NoticeProfile) {
        if let Err(error) =
            crate::core::profile_templates::loader::apply_template_to_profile(*self, profile)
        {
            tracing::error!("failed to apply profile template {}: {}", self.id(), error);
            profile.enabled_hook_events = Vec::new();
            profile.ai_event_mappings = Vec::new();
            profile.hardware_rules = Vec::new();
        }
    }

    pub fn all() -> Vec<Self> {
        vec![Self::Basic, Self::Advanced, Self::Blank]
    }
}

#[cfg(test)]
#[path = "profiles_tests.rs"]
mod tests;
