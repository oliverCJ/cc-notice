use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::infrastructure::{app_paths, logging};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageUsageStatus {
    Ok,
    Missing,
    Unreadable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StorageCleanupStatus {
    Cleaned,
    Missing,
    Partial,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsageEntry {
    pub path: String,
    pub status: StorageUsageStatus,
    pub bytes: u64,
    pub file_count: u64,
    pub directory_count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsageSnapshot {
    pub cache: StorageUsageEntry,
    pub logs: StorageUsageEntry,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupEntry {
    pub path: String,
    pub status: StorageCleanupStatus,
    pub removed_bytes: u64,
    pub removed_files: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageCleanupResult {
    pub cache: StorageCleanupEntry,
    pub logs: StorageCleanupEntry,
}

#[tauri::command]
pub fn storage_usage_snapshot() -> Result<StorageUsageSnapshot, String> {
    let cache_root = app_paths::app_cache_dir()?;
    let logs_root = app_paths::app_home_dir()?.join(logging::LOG_DIR_NAME);
    Ok(storage_usage_snapshot_for_paths(&cache_root, &logs_root))
}

#[tauri::command]
pub fn clear_storage() -> Result<StorageCleanupResult, String> {
    let cache_root = app_paths::app_cache_dir()?;
    let logs_root = app_paths::app_home_dir()?.join(logging::LOG_DIR_NAME);
    Ok(clear_storage_for_paths(&cache_root, &logs_root))
}

pub(crate) fn storage_usage_snapshot_for_paths(
    cache_root: &Path,
    logs_root: &Path,
) -> StorageUsageSnapshot {
    StorageUsageSnapshot {
        cache: scan_storage_entry(cache_root),
        logs: scan_storage_entry(logs_root),
    }
}

pub(crate) fn clear_storage_for_paths(cache_root: &Path, logs_root: &Path) -> StorageCleanupResult {
    StorageCleanupResult {
        cache: clear_cache_tree(cache_root),
        logs: clear_logs_tree(logs_root),
    }
}

fn scan_storage_entry(path: &Path) -> StorageUsageEntry {
    let path_text = path.to_string_lossy().to_string();
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return empty_usage_entry(path_text, StorageUsageStatus::Missing);
        }
        Err(_) => {
            return empty_usage_entry(path_text, StorageUsageStatus::Unreadable);
        }
    };

    if metadata.file_type().is_symlink() {
        return empty_usage_entry(path_text, StorageUsageStatus::Unreadable);
    }
    if metadata.is_file() {
        return StorageUsageEntry {
            path: path_text,
            status: StorageUsageStatus::Ok,
            bytes: metadata.len(),
            file_count: 1,
            directory_count: 0,
        };
    }

    let mut entry = StorageUsageEntry {
        path: path_text,
        status: StorageUsageStatus::Ok,
        bytes: 0,
        file_count: 0,
        directory_count: 1,
    };
    let mut pending = vec![path.to_path_buf()];

    while let Some(current_dir) = pending.pop() {
        let directory = match fs::read_dir(&current_dir) {
            Ok(directory) => directory,
            Err(_) => {
                entry.status = StorageUsageStatus::Unreadable;
                continue;
            }
        };

        for child in directory {
            let Ok(child) = child else {
                entry.status = StorageUsageStatus::Unreadable;
                continue;
            };

            let child_path = child.path();
            let file_type = match child.file_type() {
                Ok(file_type) => file_type,
                Err(_) => {
                    entry.status = StorageUsageStatus::Unreadable;
                    continue;
                }
            };

            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                entry.directory_count += 1;
                pending.push(child_path);
                continue;
            }

            match child.metadata() {
                Ok(metadata) => {
                    entry.bytes += metadata.len();
                    entry.file_count += 1;
                }
                Err(_) => {
                    entry.status = StorageUsageStatus::Unreadable;
                }
            }
        }
    }

    entry
}

fn empty_usage_entry(path: String, status: StorageUsageStatus) -> StorageUsageEntry {
    StorageUsageEntry {
        path,
        status,
        bytes: 0,
        file_count: 0,
        directory_count: 0,
    }
}

fn clear_cache_tree(path: &Path) -> StorageCleanupEntry {
    clear_directory_tree(path, false, true)
}

fn clear_logs_tree(path: &Path) -> StorageCleanupEntry {
    clear_directory_tree(path, true, true)
}

fn clear_directory_tree(path: &Path, preserve_active_logs: bool, allow_recreate: bool) -> StorageCleanupEntry {
    let path_text = path.to_string_lossy().to_string();
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return empty_cleanup_entry(path_text, StorageCleanupStatus::Missing);
        }
        Err(error) => {
            return empty_cleanup_entry(
                path_text,
                StorageCleanupStatus::Failed,
            )
            .with_error(error.to_string());
        }
    };

    if metadata.file_type().is_symlink() {
        let mut entry = empty_cleanup_entry(path_text, StorageCleanupStatus::Cleaned);
        match fs::remove_file(path) {
            Ok(()) => {
                entry.removed_files = 1;
            }
            Err(error) => {
                return entry.with_status(StorageCleanupStatus::Failed).with_error(error.to_string());
            }
        }
        return entry;
    }

    if metadata.is_file() {
        let mut entry = empty_cleanup_entry(path_text, StorageCleanupStatus::Cleaned);
        entry.removed_bytes = metadata.len();
        entry.removed_files = 1;
        if let Err(error) = fs::remove_file(path) {
            return entry.with_status(StorageCleanupStatus::Failed).with_error(error.to_string());
        }
        if allow_recreate {
            if let Err(error) = fs::create_dir_all(path) {
                return entry
                    .with_status(StorageCleanupStatus::Partial)
                    .with_error(error.to_string());
            }
        }
        return entry;
    }

    let mut entry = empty_cleanup_entry(path_text.clone(), StorageCleanupStatus::Cleaned);
    let mut errors = Vec::new();
    let mut pending = vec![path.to_path_buf()];

    while let Some(current_dir) = pending.pop() {
        let directory = match fs::read_dir(&current_dir) {
            Ok(directory) => directory,
            Err(error) => {
                errors.push(error.to_string());
                continue;
            }
        };

        for child in directory {
            let Ok(child) = child else {
                errors.push("failed to read directory entry".to_string());
                continue;
            };

            let child_path = child.path();
            let file_type = match child.file_type() {
                Ok(file_type) => file_type,
                Err(error) => {
                    errors.push(error.to_string());
                    continue;
                }
            };

            if file_type.is_symlink() {
                match fs::metadata(&child_path) {
                    Ok(metadata) => {
                        entry.removed_bytes += metadata.len();
                    }
                    Err(_) => {}
                }
                match fs::remove_file(&child_path) {
                    Ok(()) => {
                        entry.removed_files += 1;
                    }
                    Err(error) => errors.push(error.to_string()),
                }
                continue;
            }

            if file_type.is_dir() {
                match remove_directory_tree(&child_path, &mut entry) {
                    Ok(()) => {}
                    Err(error) => errors.push(error),
                }
                continue;
            }

            if preserve_active_logs && is_active_log_file(&child_path) {
                match logging::truncate_log_file(&child_path) {
                    Ok(original_len) => {
                        entry.removed_bytes += original_len;
                        entry.removed_files += 1;
                    }
                    Err(error) => errors.push(error),
                }
                continue;
            }

            match child.metadata() {
                Ok(metadata) => {
                    entry.removed_bytes += metadata.len();
                }
                Err(error) => {
                    errors.push(error.to_string());
                }
            }
            match fs::remove_file(&child_path) {
                Ok(()) => {
                    entry.removed_files += 1;
                }
                Err(error) => errors.push(error.to_string()),
            }
        }
    }

    if allow_recreate {
        if let Err(error) = fs::create_dir_all(path) {
            errors.push(error.to_string());
        }
    }

    if errors.is_empty() {
        entry
    } else {
        entry
            .with_status(StorageCleanupStatus::Partial)
            .with_error(errors.join("; "))
    }
}

fn remove_directory_tree(path: &Path, entry: &mut StorageCleanupEntry) -> Result<(), String> {
    let directory = match fs::read_dir(path) {
        Ok(directory) => directory,
        Err(error) => {
            fs::remove_dir_all(path).map_err(|remove_error| {
                format!("{}; fallback remove failed: {}", error, remove_error)
            })?;
            return Ok(());
        }
    };

    for child in directory {
        let child = child.map_err(|error| error.to_string())?;
        let child_path = child.path();
        let file_type = child.file_type().map_err(|error| error.to_string())?;

        if file_type.is_symlink() {
            if let Ok(metadata) = fs::metadata(&child_path) {
                entry.removed_bytes += metadata.len();
            }
            fs::remove_file(&child_path).map_err(|error| error.to_string())?;
            entry.removed_files += 1;
            continue;
        }

        if file_type.is_dir() {
            remove_directory_tree(&child_path, entry)?;
            fs::remove_dir(&child_path).map_err(|error| error.to_string())?;
            continue;
        }

        if let Ok(metadata) = child.metadata() {
            entry.removed_bytes += metadata.len();
        }
        fs::remove_file(&child_path).map_err(|error| error.to_string())?;
        entry.removed_files += 1;
    }

    fs::remove_dir(path).map_err(|error| error.to_string())?;
    entry.removed_files += 1;
    Ok(())
}

fn is_active_log_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(|value| logging::active_log_file_names().contains(&value))
        .unwrap_or(false)
}

fn empty_cleanup_entry(path: String, status: StorageCleanupStatus) -> StorageCleanupEntry {
    StorageCleanupEntry {
        path,
        status,
        removed_bytes: 0,
        removed_files: 0,
        error: None,
    }
}

trait CleanupEntryExt {
    fn with_status(self, status: StorageCleanupStatus) -> Self;
    fn with_error(self, error: String) -> Self;
}

impl CleanupEntryExt for StorageCleanupEntry {
    fn with_status(mut self, status: StorageCleanupStatus) -> Self {
        self.status = status;
        self
    }

    fn with_error(mut self, error: String) -> Self {
        self.error = Some(error);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(unix)]
    use std::os::unix::fs::symlink;

    #[test]
    fn scan_directory_counts_bytes_files_and_directories_without_following_symlinks() {
        let root = temp_root("scan");
        let cache_root = root.join("cache");
        let logs_root = root.join("logs");
        fs::create_dir_all(cache_root.join("nested")).expect("cache dir should exist");
        fs::create_dir_all(&logs_root).expect("logs dir should exist");
        fs::write(cache_root.join("one.txt"), "1234").expect("file should write");
        fs::write(cache_root.join("nested").join("two.txt"), "123456").expect("file should write");
        #[cfg(unix)]
        symlink(root.join("outside"), cache_root.join("link")).expect("symlink should create");

        let snapshot = storage_usage_snapshot_for_paths(&cache_root, &logs_root);

        assert_eq!(StorageUsageStatus::Ok, snapshot.cache.status);
        assert_eq!(10, snapshot.cache.bytes);
        assert_eq!(2, snapshot.cache.file_count);
        assert_eq!(2, snapshot.cache.directory_count);
        assert_eq!(StorageUsageStatus::Ok, snapshot.logs.status);
    }

    #[test]
    fn scan_directory_returns_missing_for_absent_paths() {
        let root = temp_root("missing");
        let cache_root = root.join("cache");
        let logs_root = root.join("logs");

        let snapshot = storage_usage_snapshot_for_paths(&cache_root, &logs_root);

        assert_eq!(StorageUsageStatus::Missing, snapshot.cache.status);
        assert_eq!(StorageUsageStatus::Missing, snapshot.logs.status);
    }

    #[test]
    fn clear_storage_only_removes_app_cache_and_logs() {
        let root = temp_root("clear");
        let cache_root = root.join("Library").join("Caches").join("cc-notice");
        let logs_root = root.join(".cc-notice").join("logs");
        let settings_file = root.join(".cc-notice").join("settings.json");
        fs::create_dir_all(cache_root.join("nested")).expect("cache dir should exist");
        fs::create_dir_all(&logs_root).expect("logs dir should exist");
        fs::create_dir_all(settings_file.parent().expect("settings parent should exist"))
            .expect("settings parent should exist");
        fs::write(cache_root.join("one.txt"), "1234").expect("cache file should write");
        fs::write(cache_root.join("nested").join("two.txt"), "123456").expect("cache file should write");
        fs::write(logs_root.join(logging::LOG_FILE_NAME), "log entry").expect("log should write");
        fs::write(logs_root.join("cc-notice.2026-09-01.log"), "old log").expect("archive should write");
        fs::write(&settings_file, "settings remain").expect("settings should write");

        let result = clear_storage_for_paths(&cache_root, &logs_root);

        assert_eq!(StorageCleanupStatus::Cleaned, result.cache.status);
        assert_eq!(10, result.cache.removed_bytes);
        assert_eq!(3, result.cache.removed_files);
        assert!(cache_root.exists());
        assert!(settings_file.exists());
        assert_eq!(StorageCleanupStatus::Cleaned, result.logs.status);
        assert!(logs_root.join(logging::LOG_FILE_NAME).exists());
        assert_eq!(
            "",
            fs::read_to_string(logs_root.join(logging::LOG_FILE_NAME))
                .expect("active log should be truncated")
        );
        assert!(!logs_root.join("cc-notice.2026-09-01.log").exists());
    }

    #[test]
    fn clear_logs_keeps_non_log_files_outside_logs_directory() {
        let root = temp_root("logs");
        let cache_root = root.join("cache");
        let logs_root = root.join(".cc-notice").join("logs");
        let notes_file = root.join(".cc-notice").join("notes.txt");
        fs::create_dir_all(&cache_root).expect("cache dir should exist");
        fs::create_dir_all(&logs_root).expect("logs dir should exist");
        fs::create_dir_all(notes_file.parent().expect("notes parent should exist"))
            .expect("notes parent should exist");
        fs::write(&notes_file, "keep this file").expect("notes should write");
        fs::write(logs_root.join(logging::RELAY_LOG_FILE_NAME), "relay log").expect("relay log should write");

        let result = clear_storage_for_paths(&cache_root, &logs_root);

        assert_eq!(StorageCleanupStatus::Cleaned, result.cache.status);
        assert_eq!(StorageCleanupStatus::Cleaned, result.logs.status);
        assert!(notes_file.exists());
    }

    fn temp_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("cc-notice-{name}-{unique}"));
        fs::create_dir_all(&root).expect("temp root should exist");
        root
    }
}
