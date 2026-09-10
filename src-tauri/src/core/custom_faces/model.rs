use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceGroup {
    pub schema_version: u16,
    pub group_id: String,
    pub name: String,
    pub display_profile_id: String,
    pub revision: u32,
    pub default_face_id: String,
    pub faces: Vec<CustomFace>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFace {
    pub face_id: String,
    pub name: String,
    pub color: CustomFaceColor,
    pub frames: Vec<CustomFaceFrame>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceColor {
    pub red: u8,
    pub green: u8,
    pub blue: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFaceFrame {
    pub duration_ms: u16,
    pub packed_pixels: Vec<u8>,
}
