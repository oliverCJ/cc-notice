use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::app_services::arduino_cli_service::ArduinoCliStatus;
use crate::core::device::DeviceTransportConfig;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FirmwareFlashContext {
    pub mount_roots: Vec<PathBuf>,
    pub tool_root: PathBuf,
    pub arduino_cli_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareFlashTarget {
    pub mount_path: String,
    pub volume_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareFlashStatus {
    pub artifact_id: String,
    pub board_id: String,
    pub artifact_name: String,
    pub artifact_type: String,
    pub flash_strategy: String,
    pub target: Option<FirmwareFlashTarget>,
    pub upload_tool: Option<FirmwareUploadToolStatus>,
    pub arduino_cli: Option<ArduinoCliStatus>,
    pub ready: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareFlashRequest {
    pub artifact_id: String,
    pub target_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareUploadToolStatus {
    pub tool_id: String,
    pub platform: String,
    pub path: String,
    pub available: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareFlashPortTarget {
    pub target_id: String,
    pub display_name: String,
    pub transport: DeviceTransportConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirmwareFlashResult {
    pub artifact_id: String,
    pub board_id: String,
    pub artifact_name: String,
    pub target: FirmwareFlashTarget,
    pub copied_bytes: u64,
}
