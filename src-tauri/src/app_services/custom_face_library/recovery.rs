use std::fs;

use crate::core::custom_faces::{validate_group, CustomFaceGroup};
use crate::infrastructure::file_config;

use super::model::CustomFaceLibraryError;
use super::service::CustomFaceLibraryService;

const RECOVERY_FILE: &str = "recovery.json";
const MAX_RECOVERY_BYTES: usize = 16 * 1024 * 1024;

impl CustomFaceLibraryService {
    pub fn save_recovery(&self, group: &CustomFaceGroup) -> Result<(), CustomFaceLibraryError> {
        validate_group(group)?;
        let content = serde_json::to_vec(group)
            .map_err(|error| CustomFaceLibraryError::Json(error.to_string()))?;
        if content.len() > MAX_RECOVERY_BYTES {
            return Err(CustomFaceLibraryError::InvalidFramesFile(
                "recovery file is too large".into(),
            ));
        }
        file_config::write_bytes_atomic(
            &self.group_dir(&group.group_id)?.join(RECOVERY_FILE),
            &content,
        )
        .map_err(CustomFaceLibraryError::Io)
    }

    pub fn load_recovery(
        &self,
        group_id: &str,
    ) -> Result<Option<CustomFaceGroup>, CustomFaceLibraryError> {
        let path = self.group_dir(group_id)?.join(RECOVERY_FILE);
        if !path.exists() {
            return Ok(None);
        }
        let metadata =
            fs::metadata(&path).map_err(|error| CustomFaceLibraryError::Io(error.to_string()))?;
        if metadata.len() > MAX_RECOVERY_BYTES as u64 {
            return Err(CustomFaceLibraryError::InvalidFramesFile(
                "recovery file is too large".into(),
            ));
        }
        let group: CustomFaceGroup = serde_json::from_slice(
            &fs::read(&path).map_err(|error| CustomFaceLibraryError::Io(error.to_string()))?,
        )
        .map_err(|error| CustomFaceLibraryError::Json(error.to_string()))?;
        if group.group_id != group_id {
            return Err(CustomFaceLibraryError::InvalidFramesFile(
                "recovery group id does not match directory".into(),
            ));
        }
        validate_group(&group)?;
        Ok(Some(group))
    }

    pub fn clear_recovery(&self, group_id: &str) -> Result<(), CustomFaceLibraryError> {
        let path = self.group_dir(group_id)?.join(RECOVERY_FILE);
        if !path.exists() {
            return Ok(());
        }
        fs::remove_file(path).map_err(|error| CustomFaceLibraryError::Io(error.to_string()))
    }
}
