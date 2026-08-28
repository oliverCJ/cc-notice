use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use fs2::FileExt;
use uuid::Uuid;

use crate::core::custom_faces::CustomFaceGroup;
use crate::infrastructure::file_config;

use super::codec::{decode_stored_group, encode_stored_group, validate_stored_frames_file};
use super::model::{
    CustomFaceGroupSummary, CustomFaceLibraryError, SaveCustomFaceGroupResult,
    StoredCustomFaceManifest,
};

const MANIFEST_FILE: &str = "manifest.json";
const LOCKS_DIR: &str = "locks";
const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
const MAX_FRAMES_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Clone)]
pub struct CustomFaceLibraryService {
    root: PathBuf,
}

impl CustomFaceLibraryService {
    pub fn new(config_root: PathBuf) -> Self {
        Self {
            root: config_root.join("custom-faces"),
        }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn save_group(
        &self,
        group: CustomFaceGroup,
        expected_library_hash: Option<&str>,
    ) -> Result<SaveCustomFaceGroupResult, CustomFaceLibraryError> {
        let group_id = group.group_id.clone();
        self.with_group_lock(&group_id, || {
            self.save_group_locked(group, expected_library_hash)
        })
    }

    fn save_group_locked(
        &self,
        mut group: CustomFaceGroup,
        expected_library_hash: Option<&str>,
    ) -> Result<SaveCustomFaceGroupResult, CustomFaceLibraryError> {
        let group_dir = self.group_dir(&group.group_id)?;
        let current = self.load_group_if_exists(&group.group_id)?;
        if let Some((current_group, current_hash)) = current {
            if expected_library_hash != Some(current_hash.as_str()) {
                return Err(CustomFaceLibraryError::Conflict {
                    current_library_hash: current_hash,
                });
            }
            group.revision = current_group.revision;
            let candidate = encode_stored_group(&group)?;
            if candidate.manifest.library_hash == current_hash {
                return Ok(SaveCustomFaceGroupResult {
                    group: current_group,
                    library_hash: current_hash,
                    changed: false,
                });
            }
            group.revision = current_group.revision.checked_add(1).ok_or_else(|| {
                CustomFaceLibraryError::Io("custom face revision overflow".into())
            })?;
        } else {
            if expected_library_hash.is_some() {
                return Err(CustomFaceLibraryError::Conflict {
                    current_library_hash: String::new(),
                });
            }
            group.revision = 1;
        }

        let encoded = encode_stored_group(&group)?;
        fs::create_dir_all(&group_dir).map_err(io_error)?;
        let frames_path = group_dir.join(&encoded.manifest.frames_file);
        if !frames_path.exists() {
            file_config::write_bytes_atomic(&frames_path, &encoded.frames)
                .map_err(CustomFaceLibraryError::Io)?;
        }
        let manifest_content = serde_json::to_vec_pretty(&encoded.manifest).map_err(json_error)?;
        file_config::write_bytes_atomic(&group_dir.join(MANIFEST_FILE), &manifest_content)
            .map_err(CustomFaceLibraryError::Io)?;
        self.remove_unreferenced_frame_files(&group_dir, &encoded.manifest.frames_file)?;
        Ok(SaveCustomFaceGroupResult {
            group,
            library_hash: encoded.manifest.library_hash,
            changed: true,
        })
    }

    pub fn load_group(&self, group_id: &str) -> Result<CustomFaceGroup, CustomFaceLibraryError> {
        self.with_group_lock(group_id, || {
            self.load_group_if_exists(group_id)?
                .map(|(group, _)| group)
                .ok_or_else(|| CustomFaceLibraryError::NotFound(group_id.to_string()))
        })
    }

    pub fn list_groups(&self) -> Result<Vec<CustomFaceGroupSummary>, CustomFaceLibraryError> {
        let groups_dir = self.groups_dir();
        if !groups_dir.exists() {
            return Ok(Vec::new());
        }
        let mut summaries = Vec::new();
        for entry in fs::read_dir(&groups_dir).map_err(io_error)? {
            let entry = entry.map_err(io_error)?;
            if !entry.file_type().map_err(io_error)?.is_dir() {
                continue;
            }
            let group_id = entry.file_name().to_string_lossy().to_string();
            if canonical_group_id(&group_id).is_err() {
                continue;
            }
            let manifest_path = entry.path().join(MANIFEST_FILE);
            match fs::symlink_metadata(&manifest_path) {
                Ok(_) => {}
                Err(error) if error.kind() == ErrorKind::NotFound => continue,
                Err(error) => return Err(io_error(error)),
            }
            let Some((group, library_hash)) = self
                .with_group_lock(&group_id, || self.load_group_if_exists(&group_id))
                .map_err(|error| invalid_file(&entry.path(), &error.to_string()))?
            else {
                continue;
            };
            summaries.push(CustomFaceGroupSummary {
                group_id: group.group_id,
                name: group.name,
                display_profile_id: group.display_profile_id,
                revision: group.revision,
                default_face_id: group.default_face_id,
                face_count: group.faces.len(),
                library_hash,
            });
        }
        summaries.sort_by(|left, right| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.group_id.cmp(&right.group_id))
        });
        Ok(summaries)
    }

    pub fn delete_group(
        &self,
        group_id: &str,
        expected_library_hash: &str,
    ) -> Result<(), CustomFaceLibraryError> {
        self.with_group_lock(group_id, || {
            self.delete_group_locked(group_id, expected_library_hash)
        })
    }

    fn delete_group_locked(
        &self,
        group_id: &str,
        expected_library_hash: &str,
    ) -> Result<(), CustomFaceLibraryError> {
        let (_, current_hash) = self
            .load_group_if_exists(group_id)?
            .ok_or_else(|| CustomFaceLibraryError::NotFound(group_id.to_string()))?;
        if current_hash != expected_library_hash {
            return Err(CustomFaceLibraryError::Conflict {
                current_library_hash: current_hash,
            });
        }
        fs::remove_dir_all(self.group_dir(group_id)?).map_err(io_error)
    }

    pub(crate) fn replace_group(
        &self,
        group: CustomFaceGroup,
    ) -> Result<SaveCustomFaceGroupResult, CustomFaceLibraryError> {
        let current_hash = self
            .load_group_if_exists(&group.group_id)?
            .map(|(_, hash)| hash);
        self.save_group(group, current_hash.as_deref())
    }

    fn load_group_if_exists(
        &self,
        group_id: &str,
    ) -> Result<Option<(CustomFaceGroup, String)>, CustomFaceLibraryError> {
        let group_dir = self.group_dir(group_id)?;
        match fs::symlink_metadata(&group_dir) {
            Ok(metadata) if !metadata.file_type().is_dir() => {
                return Err(invalid_file(&group_dir, "group path is not a directory"));
            }
            Ok(_) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error(error)),
        }
        let manifest_path = group_dir.join(MANIFEST_FILE);
        let manifest_metadata = match fs::symlink_metadata(&manifest_path) {
            Ok(metadata) if metadata.file_type().is_file() => metadata,
            Ok(_) => {
                return Err(invalid_file(
                    &manifest_path,
                    "manifest is not a regular file",
                ))
            }
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(io_error(error)),
        };
        if manifest_metadata.len() > MAX_MANIFEST_BYTES {
            return Err(CustomFaceLibraryError::InvalidFramesFile(
                "manifest is too large".into(),
            ));
        }
        let manifest: StoredCustomFaceManifest =
            serde_json::from_slice(&fs::read(&manifest_path).map_err(io_error)?)
                .map_err(json_error)?;
        if canonical_group_id(&manifest.group_id)? != canonical_group_id(group_id)? {
            return Err(CustomFaceLibraryError::InvalidFramesFile(
                "manifest group id does not match directory".into(),
            ));
        }
        validate_stored_frames_file(&manifest)?;
        let frames_path = group_dir.join(&manifest.frames_file);
        let metadata = fs::symlink_metadata(&frames_path).map_err(io_error)?;
        if !metadata.file_type().is_file() {
            return Err(invalid_file(&frames_path, "frames is not a regular file"));
        }
        if metadata.len() > MAX_FRAMES_BYTES {
            return Err(CustomFaceLibraryError::InvalidFramesFile(
                "frames file is too large".into(),
            ));
        }
        let group = decode_stored_group(&manifest, &fs::read(frames_path).map_err(io_error)?)?;
        Ok(Some((group, manifest.library_hash)))
    }

    fn remove_unreferenced_frame_files(
        &self,
        group_dir: &Path,
        referenced_file: &str,
    ) -> Result<(), CustomFaceLibraryError> {
        for entry in fs::read_dir(group_dir).map_err(io_error)? {
            let entry = entry.map_err(io_error)?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name != referenced_file && is_content_addressed_frames_file(&name) {
                fs::remove_file(entry.path()).map_err(io_error)?;
            }
        }
        Ok(())
    }

    fn groups_dir(&self) -> PathBuf {
        self.root.join("groups")
    }

    fn with_group_lock<T>(
        &self,
        group_id: &str,
        operation: impl FnOnce() -> Result<T, CustomFaceLibraryError>,
    ) -> Result<T, CustomFaceLibraryError> {
        let group_id = canonical_group_id(group_id)?;
        let locks_dir = self.root.join(LOCKS_DIR);
        fs::create_dir_all(&locks_dir).map_err(io_error)?;
        let lock_path = locks_dir.join(format!("{group_id}.lock"));
        let lock_file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .open(&lock_path)
            .map_err(io_error)?;
        lock_file.lock_exclusive().map_err(io_error)?;
        operation()
    }

    pub(super) fn group_dir(&self, group_id: &str) -> Result<PathBuf, CustomFaceLibraryError> {
        Ok(self.groups_dir().join(canonical_group_id(group_id)?))
    }
}

fn canonical_group_id(value: &str) -> Result<String, CustomFaceLibraryError> {
    Uuid::parse_str(value)
        .map(|uuid| uuid.to_string())
        .map_err(|_| CustomFaceLibraryError::InvalidFramesFile("invalid group id".into()))
}

fn is_content_addressed_frames_file(value: &str) -> bool {
    value.len() == 75
        && value.starts_with("frames-")
        && value.ends_with(".bin")
        && value[7..71]
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn io_error(error: std::io::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Io(error.to_string())
}

fn invalid_file(path: &Path, reason: &str) -> CustomFaceLibraryError {
    CustomFaceLibraryError::InvalidFramesFile(format!("{}: {reason}", path.display()))
}

fn json_error(error: serde_json::Error) -> CustomFaceLibraryError {
    CustomFaceLibraryError::Json(error.to_string())
}
