use std::collections::HashMap;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Component, Path};

use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, DateTime, ZipArchive, ZipWriter};

use super::model::CustomFaceLibraryError;

pub(crate) const MANIFEST_ENTRY: &str = "manifest.json";
pub(crate) const FRAMES_ENTRY: &str = "frames.bin";
pub(crate) const CHECKSUMS_ENTRY: &str = "checksums.json";
const EXPECTED_ENTRY_COUNT: usize = 3;
pub(crate) const MAX_ARCHIVE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_METADATA_BYTES: u64 = 256 * 1024;
const MAX_FRAMES_BYTES: u64 = 16 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES: u64 = 17 * 1024 * 1024;

pub(crate) struct ArchiveEntries {
    pub manifest: Vec<u8>,
    pub frames: Vec<u8>,
    pub checksums: Vec<u8>,
}

pub(crate) fn build_archive(
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

pub(crate) fn read_archive_entries(path: &Path) -> Result<ArchiveEntries, CustomFaceLibraryError> {
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

    Ok(ArchiveEntries {
        manifest: remove_entry(&mut entries, MANIFEST_ENTRY)?,
        frames: remove_entry(&mut entries, FRAMES_ENTRY)?,
        checksums: remove_entry(&mut entries, CHECKSUMS_ENTRY)?,
    })
}

pub(crate) fn sha256_hex(content: &[u8]) -> String {
    hex::encode(Sha256::digest(content))
}

pub(crate) fn unsafe_archive(message: &str) -> CustomFaceLibraryError {
    CustomFaceLibraryError::UnsafeArchive(message.to_string())
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

fn io_error(error: std::io::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Io(error.to_string())
}

fn zip_error(error: zip::result::ZipError) -> CustomFaceLibraryError {
    CustomFaceLibraryError::UnsafeArchive(error.to_string())
}
