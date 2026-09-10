use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::core::custom_faces::contract_generated::custom_face_profile_by_id;
use crate::core::custom_faces::{
    normalize_custom_face_name, validate_face_for_profile, CustomFace, CustomFaceColor,
    CustomFaceFrame,
};
use crate::infrastructure::file_config;

use super::archive_common::{build_archive, read_archive_entries, sha256_hex, unsafe_archive};
use super::model::{CustomFaceItemImportPreview, CustomFaceLibraryError, StoredFrameRef};
use super::service::CustomFaceLibraryService;

const ARCHIVE_VERSION: &str = "ccface-item-archive-v1";
const PIXEL_FORMAT: &str = "mono-1bit-page-packed-v1";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ArchiveChecksums {
    version: String,
    manifest_sha256: String,
    frames_sha256: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredCustomFaceItemManifest {
    schema_version: u16,
    display_profile_id: String,
    width: u16,
    height: u16,
    pixel_format: String,
    source_face_id: String,
    name: String,
    color: CustomFaceColor,
    frames: Vec<StoredFrameRef>,
    content_hash: String,
}

impl CustomFaceLibraryService {
    pub fn export_face_item(
        &self,
        face: &CustomFace,
        display_profile_id: &str,
        path: &Path,
    ) -> Result<(), CustomFaceLibraryError> {
        validate_face_for_profile(display_profile_id, face)?;
        let profile = custom_face_profile_by_id(display_profile_id).ok_or_else(|| {
            CustomFaceLibraryError::InvalidFramesFile(display_profile_id.to_string())
        })?;
        let (frames, frame_refs) = encode_frames(face);
        let manifest = StoredCustomFaceItemManifest {
            schema_version: 1,
            display_profile_id: display_profile_id.to_string(),
            width: profile.width,
            height: profile.height,
            pixel_format: PIXEL_FORMAT.to_string(),
            source_face_id: face.face_id.clone(),
            name: normalize_custom_face_name(&face.name),
            color: face.color,
            frames: frame_refs,
            content_hash: content_hash(display_profile_id, face),
        };
        let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(json_error)?;
        let checksums = serde_json::to_vec_pretty(&ArchiveChecksums {
            version: ARCHIVE_VERSION.to_string(),
            manifest_sha256: sha256_hex(&manifest_bytes),
            frames_sha256: sha256_hex(&frames),
        })
        .map_err(json_error)?;
        let archive = build_archive(&manifest_bytes, &frames, &checksums)?;
        file_config::write_bytes_atomic(path, &archive).map_err(CustomFaceLibraryError::Io)?;
        tracing::info!(path = %path.display(), face_id = %face.face_id, "custom face item exported");
        Ok(())
    }

    pub fn preview_face_item_import(
        &self,
        path: &Path,
    ) -> Result<CustomFaceItemImportPreview, CustomFaceLibraryError> {
        let entries = read_archive_entries(path)?;
        let checksums: ArchiveChecksums =
            serde_json::from_slice(&entries.checksums).map_err(json_error)?;
        if checksums.version != ARCHIVE_VERSION
            || checksums.manifest_sha256 != sha256_hex(&entries.manifest)
            || checksums.frames_sha256 != sha256_hex(&entries.frames)
        {
            return Err(unsafe_archive("archive checksum or version does not match"));
        }
        let manifest: StoredCustomFaceItemManifest =
            serde_json::from_slice(&entries.manifest).map_err(json_error)?;
        let profile = custom_face_profile_by_id(&manifest.display_profile_id).ok_or_else(|| {
            CustomFaceLibraryError::InvalidFramesFile(manifest.display_profile_id.clone())
        })?;
        if manifest.schema_version != 1
            || manifest.pixel_format != PIXEL_FORMAT
            || manifest.width != profile.width
            || manifest.height != profile.height
        {
            return Err(unsafe_archive(
                "item manifest profile or pixel format is invalid",
            ));
        }
        let face = decode_face(&manifest, &entries.frames, profile.framebuffer_bytes)?;
        validate_face_for_profile(&manifest.display_profile_id, &face)?;
        let expected_hash = content_hash(&manifest.display_profile_id, &face);
        if manifest.content_hash != expected_hash {
            return Err(CustomFaceLibraryError::HashMismatch);
        }
        let total_duration_ms = face
            .frames
            .iter()
            .map(|frame| u32::from(frame.duration_ms))
            .sum();
        Ok(CustomFaceItemImportPreview {
            frame_count: face.frames.len(),
            face,
            display_profile_id: manifest.display_profile_id,
            width: manifest.width,
            height: manifest.height,
            total_duration_ms,
            content_hash: expected_hash,
            source_face_id: manifest.source_face_id,
        })
    }
}

fn encode_frames(face: &CustomFace) -> (Vec<u8>, Vec<StoredFrameRef>) {
    let mut frames = Vec::new();
    let refs = face
        .frames
        .iter()
        .map(|frame| {
            let offset = frames.len() as u64;
            frames.extend_from_slice(&frame.packed_pixels);
            StoredFrameRef {
                duration_ms: frame.duration_ms,
                offset,
                length: frame.packed_pixels.len() as u32,
            }
        })
        .collect();
    (frames, refs)
}

fn decode_face(
    manifest: &StoredCustomFaceItemManifest,
    frames: &[u8],
    framebuffer_bytes: usize,
) -> Result<CustomFace, CustomFaceLibraryError> {
    let mut expected_offset = 0usize;
    let mut decoded_frames = Vec::with_capacity(manifest.frames.len());
    for frame in &manifest.frames {
        let offset = usize::try_from(frame.offset)
            .map_err(|_| CustomFaceLibraryError::InvalidFrameLayout)?;
        let length = frame.length as usize;
        if offset != expected_offset || length != framebuffer_bytes {
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
    if expected_offset != frames.len() {
        return Err(CustomFaceLibraryError::InvalidFrameLayout);
    }
    Ok(CustomFace {
        face_id: manifest.source_face_id.clone(),
        name: manifest.name.clone(),
        color: manifest.color,
        frames: decoded_frames,
    })
}

fn content_hash(profile_id: &str, face: &CustomFace) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"CCFACEITEM1");
    write_bytes(&mut hasher, profile_id.as_bytes());
    write_bytes(
        &mut hasher,
        normalize_custom_face_name(&face.name).as_bytes(),
    );
    hasher.update([face.color.red, face.color.green, face.color.blue]);
    hasher.update((face.frames.len() as u32).to_le_bytes());
    for frame in &face.frames {
        hasher.update(frame.duration_ms.to_le_bytes());
        write_bytes(&mut hasher, &frame.packed_pixels);
    }
    hex::encode(hasher.finalize())
}

fn write_bytes(hasher: &mut Sha256, bytes: &[u8]) {
    hasher.update((bytes.len() as u32).to_le_bytes());
    hasher.update(bytes);
}

fn json_error(error: serde_json::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Json(error.to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::core::custom_faces::{CustomFaceColor, CustomFaceFrame};

    fn test_face() -> CustomFace {
        let mut first = vec![0; 512];
        first[4] = 1;
        let mut second = first.clone();
        second[5] = 2;
        CustomFace {
            face_id: "00000000-0000-4000-8000-000000000111".into(),
            name: "Ready".into(),
            color: CustomFaceColor {
                red: 0x12,
                green: 0x34,
                blue: 0x56,
            },
            frames: vec![
                CustomFaceFrame {
                    duration_ms: 205,
                    packed_pixels: first,
                },
                CustomFaceFrame {
                    duration_ms: 400,
                    packed_pixels: second,
                },
            ],
        }
    }

    #[test]
    fn item_archive_roundtrips_one_face_with_raw_frame_timing() {
        let root = std::env::temp_dir().join(format!("ccfaceitem-{}", uuid::Uuid::new_v4()));
        let path = root.join("ready.ccfaceitem");
        let service = CustomFaceLibraryService::new(root.clone());
        let face = test_face();

        service
            .export_face_item(&face, "custom-mono-128x32-v1", &path)
            .unwrap();
        let preview = service.preview_face_item_import(&path).unwrap();

        assert_eq!(preview.face, face);
        assert_eq!(preview.total_duration_ms, 605);
        assert_eq!(preview.width, 128);
        assert_eq!(preview.height, 32);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_item_archive_when_frames_change_without_checksum_update() {
        let root = std::env::temp_dir().join(format!("ccfaceitem-{}", uuid::Uuid::new_v4()));
        let path = root.join("ready.ccfaceitem");
        let service = CustomFaceLibraryService::new(root.clone());
        service
            .export_face_item(&test_face(), "custom-mono-128x32-v1", &path)
            .unwrap();
        let mut entries = read_archive_entries(&path).unwrap();
        entries.frames[0] ^= 1;
        let archive =
            build_archive(&entries.manifest, &entries.frames, &entries.checksums).unwrap();
        fs::write(&path, archive).unwrap();

        assert!(matches!(
            service.preview_face_item_import(&path),
            Err(CustomFaceLibraryError::UnsafeArchive(_))
        ));
        let _ = fs::remove_dir_all(root);
    }
}
