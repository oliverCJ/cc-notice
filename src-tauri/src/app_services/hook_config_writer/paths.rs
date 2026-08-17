use std::path::{Path, PathBuf};

use crate::adapters::ai_tools::registry;
use crate::core::app_config::HookConfigTarget;
use crate::infrastructure::file_config;

pub(crate) fn config_path_for_target(
    target: &HookConfigTarget,
    home: &Path,
) -> Result<PathBuf, String> {
    let tool = registry::ai_tool_definition(&target.source)?;
    let project_path = target.project_path.as_deref().map(Path::new);
    tool.config_path(target.scope.clone(), home, project_path)
}

pub(crate) fn backup_path(config_path: &Path, timestamp: &str) -> PathBuf {
    let file_name = config_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("config");
    config_path.with_file_name(format!("{file_name}.{timestamp}.bak"))
}

pub(crate) fn inline_hooks_warning(
    target: &HookConfigTarget,
    config_path: &Path,
) -> Option<String> {
    let Ok(tool) = registry::ai_tool_definition(&target.source) else {
        return None;
    };
    if !tool.inline_hooks_warning {
        return None;
    }
    let toml_path = config_path.with_file_name("config.toml");
    let content = file_config::read_to_string(&toml_path).ok()?;
    if content.lines().any(|line| line.trim() == "[hooks]") {
        Some("检测到同作用域 Codex config.toml 中存在 inline hooks，Codex 会合并 hooks.json 和 config.toml hooks。".to_string())
    } else {
        None
    }
}
