use std::path::Path;

use serde_json::{json, Value};

use crate::infrastructure::file_config;

pub(crate) fn read_existing_json(config_path: &Path) -> Result<Value, String> {
    if !config_path.exists() {
        return Ok(json!({}));
    }
    let content = file_config::read_to_string(config_path)?;
    serde_json::from_str(&content)
        .map_err(|error| format!("failed to parse hook config json: {error}"))
}

pub(crate) fn formatted_original_json(config_path: &Path, config_exists: bool) -> Option<String> {
    if !config_exists {
        return None;
    }
    std::fs::read_to_string(config_path)
        .ok()
        .and_then(|content| {
            serde_json::from_str::<Value>(&content)
                .ok()
                .and_then(|value| serde_json::to_string_pretty(&value).ok())
        })
}
