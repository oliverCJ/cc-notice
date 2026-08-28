use crate::core::custom_faces::contract_generated::custom_face_profile_by_id;
use crate::core::custom_faces::{
    library_hash, validate_group, CustomFace, CustomFaceFrame, CustomFaceGroup,
};

use super::model::{
    CustomFaceLibraryError, EncodedStoredGroup, StoredCustomFace, StoredCustomFaceManifest,
    StoredFrameRef,
};

pub fn encode_stored_group(
    group: &CustomFaceGroup,
) -> Result<EncodedStoredGroup, CustomFaceLibraryError> {
    validate_group(group)?;
    let hash = hex::encode(library_hash(group)?);
    let frames_file = format!("frames-{hash}.bin");
    let mut frames = Vec::new();
    let mut stored_faces = Vec::with_capacity(group.faces.len());
    for face in &group.faces {
        let mut stored_frames = Vec::with_capacity(face.frames.len());
        for frame in &face.frames {
            let offset = frames.len() as u64;
            frames.extend_from_slice(&frame.packed_pixels);
            stored_frames.push(StoredFrameRef {
                duration_ms: frame.duration_ms,
                offset,
                length: frame.packed_pixels.len() as u32,
            });
        }
        stored_faces.push(StoredCustomFace {
            face_id: face.face_id.clone(),
            name: face.name.clone(),
            color: face.color,
            frames: stored_frames,
        });
    }
    Ok(EncodedStoredGroup {
        manifest: StoredCustomFaceManifest {
            schema_version: group.schema_version,
            group_id: group.group_id.clone(),
            name: group.name.clone(),
            display_profile_id: group.display_profile_id.clone(),
            revision: group.revision,
            default_face_id: group.default_face_id.clone(),
            library_hash: hash,
            frames_file,
            faces: stored_faces,
        },
        frames,
    })
}

pub fn decode_stored_group(
    manifest: &StoredCustomFaceManifest,
    frames: &[u8],
) -> Result<CustomFaceGroup, CustomFaceLibraryError> {
    validate_stored_frames_file(manifest)?;
    let profile = custom_face_profile_by_id(&manifest.display_profile_id).ok_or_else(|| {
        CustomFaceLibraryError::InvalidFramesFile(manifest.display_profile_id.clone())
    })?;
    let mut expected_offset = 0usize;
    let mut faces = Vec::with_capacity(manifest.faces.len());
    for face in &manifest.faces {
        let mut decoded_frames = Vec::with_capacity(face.frames.len());
        for frame in &face.frames {
            let offset = usize::try_from(frame.offset)
                .map_err(|_| CustomFaceLibraryError::InvalidFrameLayout)?;
            let length = frame.length as usize;
            if offset != expected_offset || length != profile.framebuffer_bytes {
                return Err(CustomFaceLibraryError::InvalidFrameLayout);
            }
            let end = offset
                .checked_add(length)
                .filter(|end| *end <= frames.len())
                .ok_or(CustomFaceLibraryError::InvalidFrameLayout)?;
            decoded_frames.push(CustomFaceFrame {
                duration_ms: frame.duration_ms,
                packed_pixels: frames[offset..end].to_vec(),
            });
            expected_offset = end;
        }
        faces.push(CustomFace {
            face_id: face.face_id.clone(),
            name: face.name.clone(),
            color: face.color,
            frames: decoded_frames,
        });
    }
    if expected_offset != frames.len() {
        return Err(CustomFaceLibraryError::InvalidFrameLayout);
    }
    let group = CustomFaceGroup {
        schema_version: manifest.schema_version,
        group_id: manifest.group_id.clone(),
        name: manifest.name.clone(),
        display_profile_id: manifest.display_profile_id.clone(),
        revision: manifest.revision,
        default_face_id: manifest.default_face_id.clone(),
        faces,
    };
    validate_group(&group)?;
    if hex::encode(library_hash(&group)?) != manifest.library_hash {
        return Err(CustomFaceLibraryError::HashMismatch);
    }
    Ok(group)
}

pub(super) fn validate_stored_frames_file(
    manifest: &StoredCustomFaceManifest,
) -> Result<(), CustomFaceLibraryError> {
    validate_library_hash(&manifest.library_hash)?;
    let expected_file = format!("frames-{}.bin", manifest.library_hash);
    if manifest.frames_file != expected_file {
        return Err(CustomFaceLibraryError::InvalidFramesFile(
            manifest.frames_file.clone(),
        ));
    }
    Ok(())
}

fn validate_library_hash(value: &str) -> Result<(), CustomFaceLibraryError> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(CustomFaceLibraryError::InvalidFramesFile(value.to_string()));
    }
    Ok(())
}
