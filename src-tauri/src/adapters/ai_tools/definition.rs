use std::path::{Path, PathBuf};

use crate::core::app_config::HookConfigTargetScope;

use super::field_aliases::ToolPayloadAliases;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AiToolDefinition {
    pub source: &'static str,
    pub display_name: &'static str,
    pub user_config_dir: &'static str,
    pub config_file_name: &'static str,
    pub inline_hooks_warning: bool,
    pub hook_config_shape: HookConfigShape,
    pub payload_aliases: &'static ToolPayloadAliases,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookConfigShape {
    HooksObject,
    HooksArray,
}

impl AiToolDefinition {
    pub fn config_path(
        &self,
        scope: HookConfigTargetScope,
        home: &Path,
        project_path: Option<&Path>,
    ) -> Result<PathBuf, String> {
        let base = match scope {
            HookConfigTargetScope::Global => home.to_path_buf(),
            HookConfigTargetScope::Project => project_path
                .map(Path::to_path_buf)
                .ok_or_else(|| "project hook config target requires projectPath".to_string())?,
        };
        Ok(base.join(self.user_config_dir).join(self.config_file_name))
    }
}
