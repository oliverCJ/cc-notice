use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use super::contract_generated::{custom_face_profile_by_code, CUSTOM_FACE_MAX_FACES_PER_GROUP};
use super::device_protocol_generated::{
    CUSTOM_FACE_DEVICE_ERROR_STORAGE, CUSTOM_FACE_DEVICE_MAX_RAW_CHUNK_BYTES,
    CUSTOM_FACE_DEVICE_PROTOCOL_VERSION,
};
use crate::core::device::{
    DeviceCustomFaceCapabilities, DeviceCustomFaceErrorCode, DeviceCustomFaceStatus,
    DeviceCustomFaceStatusState, DeviceInstalledCustomFaceGroup,
};

#[derive(Debug, Deserialize)]
struct WireCustomFaceCapabilities {
    protocol_version: u16,
    profile_code: u16,
    pixel_width: u16,
    pixel_height: u16,
    max_faces: u8,
    max_frames_per_face: u8,
    max_group_bytes: u32,
    chunk_bytes: u16,
    incremental_update: bool,
}

#[derive(Debug, Deserialize)]
struct WireCustomFaceStatus {
    ok: bool,
    v: u16,
    #[serde(rename = "type")]
    ack_type: Option<String>,
    state: Option<String>,
    profile_code: Option<u16>,
    group_id: Option<String>,
    group_runtime_hash: Option<String>,
    default_face_id: Option<String>,
    face_count: Option<u8>,
    encoded_bytes: Option<u32>,
    error: Option<String>,
}

pub fn parse_custom_face_capabilities(
    value: &Value,
) -> Result<DeviceCustomFaceCapabilities, DeviceCustomFaceErrorCode> {
    let wire: WireCustomFaceCapabilities = serde_json::from_value(value.clone())
        .map_err(|_| DeviceCustomFaceErrorCode::CustomFaceCapabilityInvalid)?;
    let profile = custom_face_profile_by_code(wire.profile_code)
        .filter(|profile| profile.deployment_enabled)
        .ok_or(DeviceCustomFaceErrorCode::CustomFaceCapabilityInvalid)?;
    let valid = wire.protocol_version == CUSTOM_FACE_DEVICE_PROTOCOL_VERSION
        && wire.pixel_width == profile.width
        && wire.pixel_height == profile.height
        && wire.max_faces > 0
        && usize::from(wire.max_faces) <= CUSTOM_FACE_MAX_FACES_PER_GROUP
        && wire.max_frames_per_face > 0
        && wire.max_frames_per_face <= profile.max_frames
        && wire.max_group_bytes > 0
        && usize::try_from(wire.max_group_bytes)
            .is_ok_and(|value| value <= profile.max_group_bytes)
        && wire.chunk_bytes > 0
        && usize::from(wire.chunk_bytes) <= CUSTOM_FACE_DEVICE_MAX_RAW_CHUNK_BYTES;
    if !valid {
        return Err(DeviceCustomFaceErrorCode::CustomFaceCapabilityInvalid);
    }
    Ok(DeviceCustomFaceCapabilities {
        protocol_version: wire.protocol_version,
        profile_code: wire.profile_code,
        pixel_width: wire.pixel_width,
        pixel_height: wire.pixel_height,
        max_faces: wire.max_faces,
        max_frames_per_face: wire.max_frames_per_face,
        max_group_bytes: wire.max_group_bytes,
        chunk_bytes: wire.chunk_bytes,
        incremental_update: wire.incremental_update,
    })
}

pub fn parse_custom_face_status(
    line: &str,
    capability: &DeviceCustomFaceCapabilities,
) -> Result<DeviceCustomFaceStatus, DeviceCustomFaceErrorCode> {
    let wire: WireCustomFaceStatus = serde_json::from_str(line)
        .map_err(|_| DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    if !wire.ok {
        return match wire.error.as_deref() {
            Some(CUSTOM_FACE_DEVICE_ERROR_STORAGE) => {
                Err(DeviceCustomFaceErrorCode::CustomFaceStorageError)
            }
            _ => Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid),
        };
    }
    if wire.v != 2 || wire.ack_type.as_deref() != Some("custom_face_status") {
        return Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid);
    }
    match wire.state.as_deref() {
        Some("empty") if installed_fields_are_empty(&wire) => Ok(DeviceCustomFaceStatus {
            state: DeviceCustomFaceStatusState::Empty,
            installed: None,
            error_code: None,
            last_confirmed_at: None,
        }),
        Some("installed") => parse_installed_status(wire, capability),
        _ => Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid),
    }
}

fn parse_installed_status(
    wire: WireCustomFaceStatus,
    capability: &DeviceCustomFaceCapabilities,
) -> Result<DeviceCustomFaceStatus, DeviceCustomFaceErrorCode> {
    let profile_code = wire
        .profile_code
        .filter(|value| *value == capability.profile_code)
        .ok_or(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    let group_id = canonical_uuid(wire.group_id)?;
    let group_runtime_hash = lowercase_sha256(wire.group_runtime_hash)?;
    let default_face_id = canonical_uuid(wire.default_face_id)?;
    let face_count = wire
        .face_count
        .filter(|value| *value > 0 && *value <= capability.max_faces)
        .ok_or(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    let encoded_bytes = wire
        .encoded_bytes
        .filter(|value| *value > 0 && *value <= capability.max_group_bytes)
        .ok_or(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    Ok(DeviceCustomFaceStatus {
        state: DeviceCustomFaceStatusState::Installed,
        installed: Some(DeviceInstalledCustomFaceGroup {
            profile_code,
            group_id,
            group_runtime_hash,
            default_face_id,
            face_count,
            encoded_bytes,
        }),
        error_code: None,
        last_confirmed_at: None,
    })
}

fn installed_fields_are_empty(wire: &WireCustomFaceStatus) -> bool {
    wire.profile_code.is_none()
        && wire.group_id.is_none()
        && wire.group_runtime_hash.is_none()
        && wire.default_face_id.is_none()
        && wire.face_count.is_none()
        && wire.encoded_bytes.is_none()
}

fn canonical_uuid(value: Option<String>) -> Result<String, DeviceCustomFaceErrorCode> {
    let value = value.ok_or(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    let parsed =
        Uuid::parse_str(&value).map_err(|_| DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    if parsed.hyphenated().to_string() != value {
        return Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid);
    }
    Ok(value)
}

fn lowercase_sha256(value: Option<String>) -> Result<String, DeviceCustomFaceErrorCode> {
    let value = value.ok_or(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid)?;
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid);
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_capability() -> DeviceCustomFaceCapabilities {
        DeviceCustomFaceCapabilities {
            protocol_version: 1,
            profile_code: 1,
            pixel_width: 128,
            pixel_height: 32,
            max_faces: 15,
            max_frames_per_face: 20,
            max_group_bytes: 131_072,
            chunk_bytes: 512,
            incremental_update: true,
        }
    }

    #[test]
    fn validates_empty_and_installed_status() {
        let capability = test_capability();
        let empty = parse_custom_face_status(
            r#"{"ok":true,"v":2,"type":"custom_face_status","state":"empty"}"#,
            &capability,
        )
        .unwrap();
        assert_eq!(DeviceCustomFaceStatusState::Empty, empty.state);

        let installed = parse_custom_face_status(
            r#"{"ok":true,"v":2,"type":"custom_face_status","state":"installed","profile_code":1,"group_id":"10000000-0000-4000-8000-000000000001","group_runtime_hash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","default_face_id":"20000000-0000-4000-8000-000000000001","face_count":12,"encoded_bytes":82416}"#,
            &capability,
        )
        .unwrap();
        assert_eq!(DeviceCustomFaceStatusState::Installed, installed.state);
        assert_eq!(
            Some(12),
            installed.installed.as_ref().map(|value| value.face_count)
        );
    }

    #[test]
    fn rejects_non_canonical_hashes_and_device_limit_overflow() {
        let capability = test_capability();
        assert_eq!(
            Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid),
            parse_custom_face_status(
                r#"{"ok":true,"v":2,"type":"custom_face_status","state":"installed","profile_code":1,"group_id":"10000000-0000-4000-8000-000000000001","group_runtime_hash":"ABCDEF0123456789abcdef0123456789abcdef0123456789abcdef0123456789","default_face_id":"20000000-0000-4000-8000-000000000001","face_count":12,"encoded_bytes":82416}"#,
                &capability,
            )
        );
        assert_eq!(
            Err(DeviceCustomFaceErrorCode::CustomFaceStatusInvalid),
            parse_custom_face_status(
                r#"{"ok":true,"v":2,"type":"custom_face_status","state":"installed","profile_code":1,"group_id":"10000000-0000-4000-8000-000000000001","group_runtime_hash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","default_face_id":"20000000-0000-4000-8000-000000000001","face_count":12,"encoded_bytes":131073}"#,
                &capability,
            )
        );
    }
}
