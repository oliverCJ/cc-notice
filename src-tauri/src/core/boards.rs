pub mod loader;

use crate::core::device::DeviceExtensionCapabilities;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardCatalog {
    pub boards: Vec<BoardDefinition>,
    #[serde(default)]
    pub pin_catalogs: Vec<PinCatalog>,
    #[serde(default)]
    pub channel_templates: Vec<DeviceChannelTemplate>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardDefinition {
    pub id: String,
    pub display_name: String,
    pub family: String,
    pub chip: String,
    pub mcu: String,
    pub protocol_version: u16,
    pub default_transport: String,
    pub default_baud_rate: Option<u32>,
    pub supported_transports: Vec<String>,
    pub supported_flash_strategies: Vec<String>,
    pub identity: BoardIdentityCapability,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_extensions: Option<DeviceExtensionCapabilities>,
    pub pin_catalog_id: String,
    pub default_channel_template_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardIdentityCapability {
    pub stable_uid: StableUidPolicy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StableUidPolicy {
    Required,
    Optional,
    Limited,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinCatalog {
    pub id: String,
    #[serde(default)]
    pub pins: Vec<PinDefinition>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinDefinition {
    pub id: String,
    pub label: String,
    pub physical_pin: Option<u8>,
    pub gpio: Option<String>,
    pub arduino_pin: Option<u8>,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub analog_channel: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub notes: Vec<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceChannelTemplate {
    pub id: String,
    pub channel_kind: String,
    #[serde(default)]
    pub compatible_pin_capabilities: Vec<String>,
    #[serde(default)]
    pub supported_actions: Vec<String>,
    pub hardware_guide_id: Option<String>,
    #[serde(default)]
    pub recommended_pin_ids: Vec<String>,
}
