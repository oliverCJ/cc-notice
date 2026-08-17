use serde::{Deserialize, Serialize};

use crate::core::profiles::{DeviceChannelRuleAction, HardwareOutputType};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateConfig {
    pub templates: Vec<TemplateDefinition>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub recommended: bool,
    pub ai_event_mappings: Vec<TemplateAiMapping>,
    pub hardware_rules: Vec<TemplateHardwareRule>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateAiMapping {
    pub id: String,
    pub source: String,
    pub event: String,
    pub internal_event: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateHardwareRule {
    pub id: String,
    pub internal_event: String,
    pub output: TemplateHardwareOutput,
    pub priority: u8,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateHardwareOutput {
    #[serde(rename = "type")]
    pub output_type: HardwareOutputType,
    #[serde(default)]
    pub channel_actions: Vec<DeviceChannelRuleAction>,
    pub duration_ms: Option<u32>,
    #[serde(default)]
    pub notification_level: Option<String>,
    #[serde(default)]
    pub notification_title: Option<String>,
    #[serde(default)]
    pub notification_body: Option<String>,
    #[serde(default)]
    pub notification_title_max_chars: Option<u32>,
    #[serde(default)]
    pub notification_body_max_chars: Option<u32>,
    #[serde(default)]
    pub notification_throttle_seconds: Option<u32>,
    #[serde(default)]
    pub notification_sound: Option<String>,
}
