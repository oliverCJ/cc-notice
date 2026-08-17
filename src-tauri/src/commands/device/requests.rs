use serde::{Deserialize, Serialize};

use crate::core::device::{
    DeviceCandidateResource, DeviceChannel, DeviceChannelActionType, DeviceExtensionActionType,
    DeviceTransportConfig,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectDeviceRequest {
    pub device_id: String,
    pub transport: Option<DeviceTransportConfig>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendDeviceTestActionRequest {
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendDeviceExtensionActionRequest {
    pub device_id: String,
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
pub struct UpdateDeviceChannelsRequest {
    pub device_id: String,
    pub channels: Vec<DeviceChannel>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentifyDeviceCandidateRequest {
    pub resource_id: String,
    pub display_name: String,
    pub transport: DeviceTransportConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterIdentifiedDeviceRequest {
    pub resource: DeviceCandidateResource,
    pub label: String,
}
