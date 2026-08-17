use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::app_services::hook_config_writer::{events, io, merge, paths, validation};
use crate::core::app_config::{HookConfigTarget, HookEventSelections};
use crate::infrastructure::file_config;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookConfigWritePreview {
    pub target_id: String,
    pub source: String,
    pub config_path: String,
    pub config_exists: bool,
    pub event_count: usize,
    pub preview_json: String,
    pub original_json: Option<String>,
    pub inline_hooks_warning: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookConfigWriteResult {
    pub target_id: String,
    pub source: String,
    pub config_path: String,
    pub backup_path: String,
    pub event_count: usize,
    pub inline_hooks_warning: Option<String>,
}

pub struct HookConfigWriterService;

impl HookConfigWriterService {
    pub fn preview_target(
        target: &HookConfigTarget,
        selections: &HookEventSelections,
        home: &Path,
    ) -> Result<HookConfigWritePreview, String> {
        Self::preview_target_with_relay(target, selections, home, Path::new("cc-notice-relay"))
    }

    pub fn preview_target_with_relay(
        target: &HookConfigTarget,
        selections: &HookEventSelections,
        home: &Path,
        relay_path: &Path,
    ) -> Result<HookConfigWritePreview, String> {
        Self::preview_target_with_options(target, selections, home, relay_path, false)
    }

    pub fn preview_target_with_options(
        target: &HookConfigTarget,
        selections: &HookEventSelections,
        home: &Path,
        relay_path: &Path,
        debug: bool,
    ) -> Result<HookConfigWritePreview, String> {
        let config_path = paths::config_path_for_target(target, home)?;
        let config_exists = config_path.exists();
        let events = events::events_for_source(&target.source, selections)?;
        let existing_config = io::read_existing_json(&config_path)?;

        let original_json = io::formatted_original_json(&config_path, config_exists);

        let merged = Self::merge_config_for_source_with_relay_options(
            &target.source,
            existing_config,
            events,
            relay_path,
            debug,
        )?;
        let preview_json =
            serde_json::to_string_pretty(&merged).map_err(|error| error.to_string())?;
        let inline_hooks_warning = paths::inline_hooks_warning(target, &config_path);

        Ok(HookConfigWritePreview {
            target_id: target.id.clone(),
            source: target.source.clone(),
            config_path: config_path.to_string_lossy().to_string(),
            config_exists,
            event_count: events.len(),
            preview_json,
            original_json,
            inline_hooks_warning,
        })
    }

    pub fn write_target(
        target: &HookConfigTarget,
        selections: &HookEventSelections,
        home: &Path,
        timestamp: &str,
    ) -> Result<HookConfigWriteResult, String> {
        Self::write_target_with_relay(
            target,
            selections,
            home,
            timestamp,
            Path::new("cc-notice-relay"),
        )
    }

    pub fn write_target_with_relay(
        target: &HookConfigTarget,
        selections: &HookEventSelections,
        home: &Path,
        timestamp: &str,
        relay_path: &Path,
    ) -> Result<HookConfigWriteResult, String> {
        Self::write_target_with_options(target, selections, home, timestamp, relay_path, false)
    }

    pub fn write_target_with_options(
        target: &HookConfigTarget,
        selections: &HookEventSelections,
        home: &Path,
        timestamp: &str,
        relay_path: &Path,
        debug: bool,
    ) -> Result<HookConfigWriteResult, String> {
        let preview =
            Self::preview_target_with_options(target, selections, home, relay_path, debug)?;
        let config_path = PathBuf::from(&preview.config_path);
        let existing_content = if config_path.exists() {
            file_config::read_to_string(&config_path)?
        } else {
            String::new()
        };
        let backup_path = paths::backup_path(&config_path, timestamp);

        file_config::write_string(&backup_path, &existing_content)?;
        file_config::write_string(&config_path, &preview.preview_json)?;
        tracing::info!("hook config written: {}", preview.config_path);

        // 写入后验证：读取并解析 JSON
        let written_content = file_config::read_to_string(&config_path)?;
        let parsed: Value = serde_json::from_str(&written_content)
            .map_err(|error| format!("hook config validation failed: invalid JSON: {error}"))?;

        // 验证关键字段存在
        validation::validate_written_config(&parsed, &target.source)?;

        Ok(HookConfigWriteResult {
            target_id: preview.target_id,
            source: preview.source,
            config_path: preview.config_path,
            backup_path: backup_path.to_string_lossy().to_string(),
            event_count: preview.event_count,
            inline_hooks_warning: preview.inline_hooks_warning,
        })
    }

    pub fn preview_restore_target(
        target: &HookConfigTarget,
        home: &Path,
    ) -> Result<HookConfigWritePreview, String> {
        let config_path = paths::config_path_for_target(target, home)?;
        let config_exists = config_path.exists();
        let existing_config = io::read_existing_json(&config_path)?;
        let event_count = merge::managed_handler_count(&target.source, &existing_config);
        let original_json = io::formatted_original_json(&config_path, config_exists);
        let restored = merge::restore_config_for_source(&target.source, existing_config)?;
        let preview_json =
            serde_json::to_string_pretty(&restored).map_err(|error| error.to_string())?;
        let inline_hooks_warning = paths::inline_hooks_warning(target, &config_path);

        Ok(HookConfigWritePreview {
            target_id: target.id.clone(),
            source: target.source.clone(),
            config_path: config_path.to_string_lossy().to_string(),
            config_exists,
            event_count,
            preview_json,
            original_json,
            inline_hooks_warning,
        })
    }

    pub fn restore_target(
        target: &HookConfigTarget,
        home: &Path,
        timestamp: &str,
    ) -> Result<HookConfigWriteResult, String> {
        let preview = Self::preview_restore_target(target, home)?;
        let config_path = PathBuf::from(&preview.config_path);
        let existing_content = if config_path.exists() {
            file_config::read_to_string(&config_path)?
        } else {
            String::new()
        };
        let backup_path = paths::backup_path(&config_path, timestamp);

        file_config::write_string(&backup_path, &existing_content)?;
        file_config::write_string(&config_path, &preview.preview_json)?;
        tracing::info!("managed hook config restored: {}", preview.config_path);

        Ok(HookConfigWriteResult {
            target_id: preview.target_id,
            source: preview.source,
            config_path: preview.config_path,
            backup_path: backup_path.to_string_lossy().to_string(),
            event_count: preview.event_count,
            inline_hooks_warning: preview.inline_hooks_warning,
        })
    }

    pub fn merge_config_for_source(
        source: &str,
        existing: Value,
        events: &[String],
    ) -> Result<Value, String> {
        Self::merge_config_for_source_with_relay(
            source,
            existing,
            events,
            Path::new("cc-notice-relay"),
        )
    }

    pub fn merge_config_for_source_with_relay(
        source: &str,
        existing: Value,
        events: &[String],
        relay_path: &Path,
    ) -> Result<Value, String> {
        Self::merge_config_for_source_with_relay_options(
            source, existing, events, relay_path, false,
        )
    }

    pub fn merge_config_for_source_with_relay_options(
        source: &str,
        existing: Value,
        events: &[String],
        relay_path: &Path,
        debug: bool,
    ) -> Result<Value, String> {
        merge::merge_config_for_source_with_relay(source, existing, events, relay_path, debug)
    }
}

#[cfg(test)]
#[path = "hook_config_writer_service_tests.rs"]
mod tests;
