use std::collections::HashSet;

use thiserror::Error;
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

use super::contract_generated::{
    custom_face_profile_by_id, CUSTOM_FACE_FRAME_DURATION_MAX_MS,
    CUSTOM_FACE_FRAME_DURATION_MIN_MS, CUSTOM_FACE_MAX_FACES_PER_GROUP,
};
use super::model::{CustomFace, CustomFaceGroup};

const CUSTOM_FACE_SCHEMA_VERSION: u16 = 1;
const CUSTOM_FACE_NAME_MAX_CHARS: usize = 40;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CustomFaceValidationError {
    #[error("unsupported custom face schema version: {0}")]
    UnsupportedSchemaVersion(u16),
    #[error("unknown custom face display profile: {0}")]
    UnknownProfile(String),
    #[error("invalid custom face group id: {0}")]
    InvalidGroupId(String),
    #[error("invalid custom face id: {0}")]
    InvalidFaceId(String),
    #[error("invalid custom face name: {0}")]
    InvalidName(String),
    #[error("duplicate custom face name: {0}")]
    DuplicateFaceName(String),
    #[error("duplicate custom face id: {0}")]
    DuplicateFaceId(String),
    #[error("custom face default id is missing: {0}")]
    DefaultFaceMissing(String),
    #[error("custom face group has too many faces: {actual} > {max}")]
    TooManyFaces { max: usize, actual: usize },
    #[error("custom face must contain at least one face")]
    NoFaces,
    #[error("custom face has too many frames: {actual} > {max}")]
    TooManyFrames { max: usize, actual: usize },
    #[error("custom face must contain at least one frame")]
    NoFrames,
    #[error("invalid custom face frame duration: {0}")]
    InvalidFrameDuration(u16),
    #[error("invalid framebuffer length: {actual}, expected {expected}")]
    InvalidFramebufferLength { expected: usize, actual: usize },
}

pub fn normalize_custom_face_name(value: &str) -> String {
    value.trim().nfkc().collect()
}

pub fn validate_group(group: &CustomFaceGroup) -> Result<(), CustomFaceValidationError> {
    if group.schema_version != CUSTOM_FACE_SCHEMA_VERSION {
        return Err(CustomFaceValidationError::UnsupportedSchemaVersion(
            group.schema_version,
        ));
    }
    Uuid::parse_str(&group.group_id)
        .map_err(|_| CustomFaceValidationError::InvalidGroupId(group.group_id.clone()))?;
    validate_name(&group.name)?;
    custom_face_profile_by_id(&group.display_profile_id).ok_or_else(|| {
        CustomFaceValidationError::UnknownProfile(group.display_profile_id.clone())
    })?;
    if group.faces.is_empty() {
        return Err(CustomFaceValidationError::NoFaces);
    }
    if group.faces.len() > CUSTOM_FACE_MAX_FACES_PER_GROUP {
        return Err(CustomFaceValidationError::TooManyFaces {
            max: CUSTOM_FACE_MAX_FACES_PER_GROUP,
            actual: group.faces.len(),
        });
    }

    let mut face_ids = HashSet::new();
    let mut face_names = HashSet::new();
    for face in &group.faces {
        validate_face_for_profile(&group.display_profile_id, face)?;
        if !face_ids.insert(face.face_id.clone()) {
            return Err(CustomFaceValidationError::DuplicateFaceId(
                face.face_id.clone(),
            ));
        }
        let normalized_name = normalize_custom_face_name(&face.name);
        let name_key = normalized_name.to_lowercase();
        if !face_names.insert(name_key.clone()) {
            return Err(CustomFaceValidationError::DuplicateFaceName(name_key));
        }
    }

    if !face_ids.contains(&group.default_face_id) {
        return Err(CustomFaceValidationError::DefaultFaceMissing(
            group.default_face_id.clone(),
        ));
    }
    Ok(())
}

pub fn validate_face_for_profile(
    profile_id: &str,
    face: &CustomFace,
) -> Result<(), CustomFaceValidationError> {
    Uuid::parse_str(&face.face_id)
        .map_err(|_| CustomFaceValidationError::InvalidFaceId(face.face_id.clone()))?;
    validate_name(&face.name)?;
    let profile = custom_face_profile_by_id(profile_id)
        .ok_or_else(|| CustomFaceValidationError::UnknownProfile(profile_id.to_string()))?;
    if face.frames.is_empty() {
        return Err(CustomFaceValidationError::NoFrames);
    }
    if face.frames.len() > usize::from(profile.max_frames) {
        return Err(CustomFaceValidationError::TooManyFrames {
            max: usize::from(profile.max_frames),
            actual: face.frames.len(),
        });
    }
    for frame in &face.frames {
        if !(CUSTOM_FACE_FRAME_DURATION_MIN_MS..=CUSTOM_FACE_FRAME_DURATION_MAX_MS)
            .contains(&frame.duration_ms)
        {
            return Err(CustomFaceValidationError::InvalidFrameDuration(
                frame.duration_ms,
            ));
        }
        if frame.packed_pixels.len() != profile.framebuffer_bytes {
            return Err(CustomFaceValidationError::InvalidFramebufferLength {
                expected: profile.framebuffer_bytes,
                actual: frame.packed_pixels.len(),
            });
        }
    }
    Ok(())
}

fn validate_name(value: &str) -> Result<String, CustomFaceValidationError> {
    let normalized = normalize_custom_face_name(value);
    let count = normalized.chars().count();
    if count == 0 || count > CUSTOM_FACE_NAME_MAX_CHARS {
        return Err(CustomFaceValidationError::InvalidName(value.to_string()));
    }
    Ok(normalized)
}
