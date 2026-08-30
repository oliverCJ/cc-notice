use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::core::custom_faces::{CustomFaceColor, CustomFaceGroup, CustomFaceValidationError};

#[derive(Debug, Error, PartialEq, Eq)]
pub enum CustomFaceLibraryError {
    #[error(transparent)]
    Validation(#[from] CustomFaceValidationError),
    #[error("custom face frame layout is invalid")]
    InvalidFrameLayout,
    #[error("custom face frames file is invalid: {0}")]
    InvalidFramesFile(String),
    #[error("custom face library hash does not match")]
    HashMismatch,
    #[error("custom face library I/O failed: {0}")]
    Io(String),
    #[error("custom face library JSON failed: {0}")]
    Json(String),
    #[error("custom face group was not found: {0}")]
    NotFound(String),
    #[error("custom face group conflicts with current hash {current_library_hash}")]
    Conflict { current_library_hash: String },
    #[error("custom face archive is unsafe: {0}")]
    UnsafeArchive(String),
    #[error("custom face asset was not found: {0}")]
    AssetNotFound(String),
    #[error("custom face asset is invalid: {0}")]
    InvalidAsset(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceGroupSummary {
    pub group_id: String,
    pub name: String,
    pub display_profile_id: String,
    pub revision: u32,
    pub default_face_id: String,
    pub face_count: usize,
    pub library_hash: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCustomFaceGroupResult {
    pub group: CustomFaceGroup,
    pub library_hash: String,
    pub changed: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CustomFaceImportMode {
    Update,
    Copy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CustomFaceImportStatus {
    New,
    Duplicate,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceImportPreview {
    pub group: CustomFaceGroup,
    pub library_hash: String,
    pub status: CustomFaceImportStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodedStoredGroup {
    pub manifest: StoredCustomFaceManifest,
    pub frames: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredCustomFaceManifest {
    pub schema_version: u16,
    pub group_id: String,
    pub name: String,
    pub display_profile_id: String,
    pub revision: u32,
    pub default_face_id: String,
    pub library_hash: String,
    pub frames_file: String,
    pub faces: Vec<StoredCustomFace>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredCustomFace {
    pub face_id: String,
    pub name: String,
    pub color: CustomFaceColor,
    pub frames: Vec<StoredFrameRef>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredFrameRef {
    pub duration_ms: u16,
    pub offset: u64,
    pub length: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalCustomFaceAsset {
    pub asset_id: String,
    #[serde(default)]
    pub scope: CustomFaceAssetScope,
    #[serde(default)]
    pub group_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub profile_id: String,
    pub width: u16,
    pub height: u16,
    pub packed_pixels: Vec<u8>,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CustomFaceAssetScope {
    Public,
    Group,
}

impl Default for CustomFaceAssetScope {
    fn default() -> Self {
        Self::Public
    }
}
