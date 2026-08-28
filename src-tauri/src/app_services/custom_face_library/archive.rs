use std::collections::HashMap;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Component, Path};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, DateTime, ZipArchive, ZipWriter};

use crate::core::custom_faces::CustomFaceGroup;
use crate::infrastructure::file_config;

use super::codec::{decode_stored_group, encode_stored_group};
use super::model::{
    CustomFaceImportMode, CustomFaceImportPreview, CustomFaceImportStatus, CustomFaceLibraryError,
    SaveCustomFaceGroupResult, StoredCustomFaceManifest,
};
use super::service::CustomFaceLibraryService;

const ARCHIVE_VERSION: &str = "ccface-archive-v1";
const MANIFEST_ENTRY: &str = "manifest.json";
const FRAMES_ENTRY: &str = "frames.bin";
const CHECKSUMS_ENTRY: &str = "checksums.json";
const EXPECTED_ENTRY_COUNT: usize = 3;
const MAX_ARCHIVE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_METADATA_BYTES: u64 = 256 * 1024;
const MAX_FRAMES_BYTES: u64 = 16 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES: u64 = 17 * 1024 * 1024;

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

fn build_archive(
    manifest: &[u8],
    frames: &[u8],
    checksums: &[u8],
) -> Result<Vec<u8>, CustomFaceLibraryError> {
    let writer = Cursor::new(Vec::new());
    let mut archive = ZipWriter::new(writer);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(6))
        .last_modified_time(DateTime::default())
        .unix_permissions(0o644);
    for (name, content) in [
        (MANIFEST_ENTRY, manifest),
        (FRAMES_ENTRY, frames),
        (CHECKSUMS_ENTRY, checksums),
    ] {
        archive.start_file(name, options).map_err(zip_error)?;
        archive.write_all(content).map_err(io_error)?;
    }
    archive
        .finish()
        .map(|cursor| cursor.into_inner())
        .map_err(zip_error)
}

fn read_archive(path: &Path) -> Result<DecodedArchive, CustomFaceLibraryError> {
    let metadata = fs::metadata(path).map_err(io_error)?;
    if !metadata.is_file() || metadata.len() > MAX_ARCHIVE_BYTES {
        return Err(unsafe_archive("archive is not a file or exceeds 32 MiB"));
    }
    let file = fs::File::open(path).map_err(io_error)?;
    let mut archive = ZipArchive::new(file).map_err(zip_error)?;
    if archive.len() != EXPECTED_ENTRY_COUNT {
        return Err(unsafe_archive("archive must contain exactly three entries"));
    }

    let mut entries = HashMap::with_capacity(EXPECTED_ENTRY_COUNT);
    let mut uncompressed_bytes = 0u64;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(zip_error)?;
        let name = validate_entry(&entry)?;
        let limit = entry_limit(&name)?;
        uncompressed_bytes = uncompressed_bytes
            .checked_add(entry.size())
            .filter(|size| *size <= MAX_UNCOMPRESSED_BYTES)
            .ok_or_else(|| unsafe_archive("archive expands beyond 17 MiB"))?;
        if entry.size() > limit {
            return Err(unsafe_archive("archive entry exceeds its size limit"));
        }
        let entry_size = entry.size();
        let mut content = Vec::with_capacity(entry_size as usize);
        (&mut entry)
            .take(limit + 1)
            .read_to_end(&mut content)
            .map_err(io_error)?;
        if content.len() as u64 != entry_size || content.len() as u64 > limit {
            return Err(unsafe_archive("archive entry size is inconsistent"));
        }
        if entries.insert(name, content).is_some() {
            return Err(unsafe_archive("archive contains a duplicate entry"));
        }
    }
    if entries.len() != EXPECTED_ENTRY_COUNT {
        return Err(unsafe_archive("archive is missing a required entry"));
    }

    let manifest = remove_entry(&mut entries, MANIFEST_ENTRY)?;
    let frames = remove_entry(&mut entries, FRAMES_ENTRY)?;
    let checksums: ArchiveChecksums =
        serde_json::from_slice(&remove_entry(&mut entries, CHECKSUMS_ENTRY)?)
            .map_err(json_error)?;
    if checksums.version != ARCHIVE_VERSION
        || checksums.manifest_sha256 != sha256_hex(&manifest)
        || checksums.frames_sha256 != sha256_hex(&frames)
    {
        return Err(unsafe_archive("archive checksum or version does not match"));
    }
    let stored: StoredCustomFaceManifest = serde_json::from_slice(&manifest).map_err(json_error)?;
    let group = decode_stored_group(&stored, &frames)?;
    Ok(DecodedArchive {
        group,
        library_hash: stored.library_hash,
    })
}

fn validate_entry(entry: &zip::read::ZipFile<'_>) -> Result<String, CustomFaceLibraryError> {
    let name = entry.name().to_string();
    if entry.encrypted() || entry.is_dir() || entry.is_symlink() || !entry.is_file() {
        return Err(unsafe_archive(
            "archive entries must be unencrypted regular files",
        ));
    }
    if entry.enclosed_name().as_deref() != Some(Path::new(&name))
        || Path::new(&name).components().count() != 1
        || !matches!(
            Path::new(&name).components().next(),
            Some(Component::Normal(_))
        )
    {
        return Err(unsafe_archive("archive entry path is unsafe"));
    }
    if let Some(mode) = entry.unix_mode() {
        let file_type = mode & 0o170000;
        if file_type != 0 && file_type != 0o100000 {
            return Err(unsafe_archive("archive entry has a special Unix mode"));
        }
    }
    entry_limit(&name)?;
    Ok(name)
}

fn entry_limit(name: &str) -> Result<u64, CustomFaceLibraryError> {
    match name {
        MANIFEST_ENTRY | CHECKSUMS_ENTRY => Ok(MAX_METADATA_BYTES),
        FRAMES_ENTRY => Ok(MAX_FRAMES_BYTES),
        _ => Err(unsafe_archive("archive contains an unknown entry")),
    }
}

fn remove_entry(
    entries: &mut HashMap<String, Vec<u8>>,
    name: &str,
) -> Result<Vec<u8>, CustomFaceLibraryError> {
    entries
        .remove(name)
        .ok_or_else(|| unsafe_archive("archive is missing a required entry"))
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

fn sha256_hex(content: &[u8]) -> String {
    hex::encode(Sha256::digest(content))
}

fn unsafe_archive(message: &str) -> CustomFaceLibraryError {
    CustomFaceLibraryError::UnsafeArchive(message.to_string())
}

fn io_error(error: std::io::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Io(error.to_string())
}

fn json_error(error: serde_json::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Json(error.to_string())
}

fn zip_error(error: zip::result::ZipError) -> CustomFaceLibraryError {
    CustomFaceLibraryError::UnsafeArchive(error.to_string())
}
