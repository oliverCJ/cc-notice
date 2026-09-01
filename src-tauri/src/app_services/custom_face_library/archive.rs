use std::path::Path;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::core::custom_faces::CustomFaceGroup;
use crate::infrastructure::file_config;

use super::archive_common::{
    build_archive, read_archive_entries, sha256_hex, unsafe_archive, MAX_ARCHIVE_BYTES,
};
use super::codec::{decode_stored_group, encode_stored_group};
use super::model::{
    CustomFaceImportMode, CustomFaceImportPreview, CustomFaceImportStatus, CustomFaceLibraryError,
    SaveCustomFaceGroupResult, StoredCustomFaceManifest,
};
use super::service::CustomFaceLibraryService;

const ARCHIVE_VERSION: &str = "ccface-archive-v1";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ArchiveChecksums {
    version: String,
    manifest_sha256: String,
    frames_sha256: String,
}

struct DecodedArchive {
    group: CustomFaceGroup,
    library_hash: String,
}

impl CustomFaceLibraryService {
    pub fn export_group(&self, group_id: &str, path: &Path) -> Result<(), CustomFaceLibraryError> {
        let group = self.load_group(group_id)?;
        let encoded = encode_stored_group(&group)?;
        let manifest = serde_json::to_vec_pretty(&encoded.manifest).map_err(json_error)?;
        let checksums = serde_json::to_vec_pretty(&ArchiveChecksums {
            version: ARCHIVE_VERSION.to_string(),
            manifest_sha256: sha256_hex(&manifest),
            frames_sha256: sha256_hex(&encoded.frames),
        })
        .map_err(json_error)?;
        let archive = build_archive(&manifest, &encoded.frames, &checksums)?;
        if archive.len() as u64 > MAX_ARCHIVE_BYTES {
            return Err(unsafe_archive("archive exceeds 32 MiB"));
        }
        file_config::write_bytes_atomic(path, &archive).map_err(CustomFaceLibraryError::Io)?;
        tracing::info!(group_id, path = %path.display(), "custom face group exported");
        Ok(())
    }

    pub fn preview_import(
        &self,
        path: &Path,
    ) -> Result<CustomFaceImportPreview, CustomFaceLibraryError> {
        let decoded = read_archive(path)?;
        let status = match self.load_group(&decoded.group.group_id) {
            Ok(current) => {
                let current_hash = encode_stored_group(&current)?.manifest.library_hash;
                if current_hash == decoded.library_hash {
                    CustomFaceImportStatus::Duplicate
                } else {
                    CustomFaceImportStatus::Conflict
                }
            }
            Err(CustomFaceLibraryError::NotFound(_)) => CustomFaceImportStatus::New,
            Err(error) => return Err(error),
        };
        Ok(CustomFaceImportPreview {
            group: decoded.group,
            library_hash: decoded.library_hash,
            status,
        })
    }

    pub fn import_group(
        &self,
        path: &Path,
        mode: CustomFaceImportMode,
    ) -> Result<SaveCustomFaceGroupResult, CustomFaceLibraryError> {
        let decoded = read_archive(path)?;
        let source_group_id = decoded.group.group_id.clone();
        let result = match mode {
            CustomFaceImportMode::Update => self.replace_group(decoded.group),
            CustomFaceImportMode::Copy => self.save_group(copy_group(decoded.group), None),
        }?;
        tracing::info!(
            source_group_id,
            imported_group_id = result.group.group_id,
            changed = result.changed,
            mode = ?mode,
            "custom face group imported"
        );
        Ok(result)
    }
}

fn read_archive(path: &Path) -> Result<DecodedArchive, CustomFaceLibraryError> {
    let entries = read_archive_entries(path)?;
    let checksums: ArchiveChecksums =
        serde_json::from_slice(&entries.checksums).map_err(json_error)?;
    if checksums.version != ARCHIVE_VERSION
        || checksums.manifest_sha256 != sha256_hex(&entries.manifest)
        || checksums.frames_sha256 != sha256_hex(&entries.frames)
    {
        return Err(unsafe_archive("archive checksum or version does not match"));
    }
    let stored: StoredCustomFaceManifest =
        serde_json::from_slice(&entries.manifest).map_err(json_error)?;
    let group = decode_stored_group(&stored, &entries.frames)?;
    Ok(DecodedArchive {
        group,
        library_hash: stored.library_hash,
    })
}

fn copy_group(mut group: CustomFaceGroup) -> CustomFaceGroup {
    let previous_default = group.default_face_id.clone();
    group.group_id = Uuid::new_v4().to_string();
    group.revision = 1;
    for face in &mut group.faces {
        let previous_face_id = face.face_id.clone();
        face.face_id = Uuid::new_v4().to_string();
        if previous_face_id == previous_default {
            group.default_face_id = face.face_id.clone();
        }
    }
    group
}

fn json_error(error: serde_json::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Json(error.to_string())
}
