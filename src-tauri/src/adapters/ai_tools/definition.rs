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
    pub codec_kind: HookConfigCodecKind,
    pub target_kind: HookTargetKind,
    pub can_create_project_target: bool,
    pub global_root_env: Option<&'static str>,
    pub env_config_dir: Option<&'static str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookConfigShape {
    HooksObject,
    HooksArray,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookConfigCodecKind {
    MatcherGroupJson,
    FlatHooksJson,
    CopilotHooksJson,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookTargetKind {
    SharedFile,
    ManagedFile,
}

impl AiToolDefinition {
    pub fn config_path(
        &self,
        scope: HookConfigTargetScope,
        home: &Path,
        project_path: Option<&Path>,
    ) -> Result<PathBuf, String> {
        let base = match scope {
            HookConfigTargetScope::Global => self
                .global_root_env
                .and_then(|name| std::env::var(name).ok())
                .filter(|value| !value.trim().is_empty())
                .map(PathBuf::from)
                .or_else(|| Some(home.to_path_buf()))
                .expect("home fallback should exist"),
            HookConfigTargetScope::Project => project_path
                .map(Path::to_path_buf)
                .ok_or_else(|| "project hook config target requires projectPath".to_string())?,
        };
        let config_dir = if scope == HookConfigTargetScope::Global
            && self
                .global_root_env
                .and_then(|name| std::env::var(name).ok())
                .filter(|value| !value.trim().is_empty())
                .is_some()
        {
            self.env_config_dir.unwrap_or(self.user_config_dir)
        } else {
            self.user_config_dir
        };
        Ok(base.join(config_dir).join(self.config_file_name))
    }
}
