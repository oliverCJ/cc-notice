use std::path::{Path, PathBuf};

use crate::adapters::ai_tools::registry;
use crate::core::app_config::{AppConfig, HookConfigTarget, HookConfigTargetScope};

pub struct HookConfigTargetService;

impl HookConfigTargetService {
    pub fn add_project_target(
        mut config: AppConfig,
        source: &str,
        project_path: &str,
    ) -> Result<AppConfig, String> {
        registry::ai_tool_definition(source)?;
        let normalized_path = Self::normalize_project_path(project_path)?;
        let exists = config.hook_config_targets.iter().any(|target| {
            target.scope == HookConfigTargetScope::Project
                && target.source == source
                && target.project_path.as_deref() == Some(normalized_path.as_str())
        });
        if exists {
            return Err(format!(
                "hook config target already exists for {source} at {normalized_path}"
            ));
        }

        config.hook_config_targets.push(HookConfigTarget {
            id: Self::project_target_id(source, &normalized_path),
            scope: HookConfigTargetScope::Project,
            source: source.to_string(),
            label: Self::project_label(&normalized_path),
            project_path: Some(normalized_path),
            enabled: false,
        });
        config.sanitize();
        config.validate()?;
        Ok(config)
    }

    pub fn remove_target(mut config: AppConfig, target_id: &str) -> Result<AppConfig, String> {
        if let Some(target) = config
            .hook_config_targets
            .iter()
            .find(|target| target.id == target_id)
        {
            if target.scope == HookConfigTargetScope::Global {
                return Err("global hook config target cannot be removed".to_string());
            }
        }

        config
            .hook_config_targets
            .retain(|target| target.id != target_id);
        config.sanitize();
        config.validate()?;
        Ok(config)
    }

    pub fn apply_enablement(
        mut config: AppConfig,
        target_id: &str,
        enabled: bool,
    ) -> Result<AppConfig, String> {
        let target = config
            .hook_config_targets
            .iter()
            .find(|target| target.id == target_id)
            .cloned()
            .ok_or_else(|| format!("hook config target not found: {target_id}"))?;

        if enabled {
            for candidate in &mut config.hook_config_targets {
                if candidate.source != target.source {
                    continue;
                }
                match target.scope {
                    HookConfigTargetScope::Global => {
                        if candidate.scope == HookConfigTargetScope::Project {
                            candidate.enabled = false;
                        }
                    }
                    HookConfigTargetScope::Project => {
                        if candidate.scope == HookConfigTargetScope::Global {
                            candidate.enabled = false;
                        }
                    }
                }
            }
        }

        let Some(target) = config
            .hook_config_targets
            .iter_mut()
            .find(|target| target.id == target_id)
        else {
            return Err(format!("hook config target not found: {target_id}"));
        };
        target.enabled = enabled;
        config.sanitize();
        config.validate()?;
        Ok(config)
    }

    pub fn project_target_id(source: &str, project_path: &str) -> String {
        let slug = Self::project_label(project_path)
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() {
                    character.to_ascii_lowercase()
                } else {
                    '-'
                }
            })
            .collect::<String>()
            .split('-')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join("-");
        format!(
            "project-{source}-{slug}-{:016x}",
            stable_hash64(source, project_path)
        )
    }

    pub fn project_label(project_path: &str) -> String {
        Path::new(project_path)
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty())
            .unwrap_or(project_path)
            .to_string()
    }

    fn normalize_project_path(project_path: &str) -> Result<String, String> {
        let trimmed = project_path.trim();
        if trimmed.is_empty() {
            return Err("projectPath cannot be empty".to_string());
        }
        let normalized = PathBuf::from(trimmed).to_string_lossy().to_string();
        Ok(normalized
            .trim_end_matches(std::path::MAIN_SEPARATOR)
            .to_string())
    }
}

fn stable_hash64(source: &str, project_path: &str) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in source
        .as_bytes()
        .iter()
        .chain([0u8].iter())
        .chain(project_path.as_bytes().iter())
    {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_codex_project_target_with_stable_id_and_label() {
        let config = AppConfig::default();

        let updated =
            HookConfigTargetService::add_project_target(config, "codex", "/workspace/project-a")
                .expect("target should be added");

        let target = updated
            .hook_config_targets
            .iter()
            .find(|target| target.scope == HookConfigTargetScope::Project)
            .expect("project target should exist");
        assert!(target.id.starts_with("project-codex-"));
        assert_eq!("codex", target.source);
        assert_eq!("project-a", target.label);
        assert_eq!(
            Some("/workspace/project-a".to_string()),
            target.project_path
        );
    }

    #[test]
    fn duplicate_source_and_project_path_is_not_added_twice() {
        let config = AppConfig::default();
        let updated =
            HookConfigTargetService::add_project_target(config, "codex", "/workspace/project-a")
                .expect("first add should work");

        let error =
            HookConfigTargetService::add_project_target(updated, "codex", "/workspace/project-a")
                .expect_err("duplicate directory should be rejected");

        assert_eq!(
            "hook config target already exists for codex at /workspace/project-a",
            error
        );
    }

    #[test]
    fn duplicate_path_with_trailing_separator_is_not_added_twice() {
        let config = AppConfig::default();
        let updated =
            HookConfigTargetService::add_project_target(config, "codex", "/workspace/project-a/")
                .expect("first add should work");

        let error =
            HookConfigTargetService::add_project_target(updated, "codex", "/workspace/project-a")
                .expect_err("duplicate directory should be rejected");

        assert_eq!(
            "hook config target already exists for codex at /workspace/project-a",
            error
        );
    }

    #[test]
    fn enabling_global_target_disables_same_source_project_targets() {
        let config = HookConfigTargetService::add_project_target(
            AppConfig::default(),
            "codex",
            "/workspace/project-a",
        )
        .expect("project target should be added");
        let project_id = config
            .hook_config_targets
            .iter()
            .find(|target| target.scope == HookConfigTargetScope::Project)
            .expect("project target should exist")
            .id
            .clone();
        let config = HookConfigTargetService::apply_enablement(config, &project_id, true)
            .expect("project target should be enabled");

        let updated = HookConfigTargetService::apply_enablement(config, "global-codex", true)
            .expect("global target should be enabled");

        assert!(updated
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && target.enabled));
        assert!(updated.hook_config_targets.iter().all(|target| {
            target.source != "codex"
                || target.scope != HookConfigTargetScope::Project
                || !target.enabled
        }));
    }

    #[test]
    fn enabling_project_target_disables_same_source_global_target_only() {
        let config = HookConfigTargetService::add_project_target(
            AppConfig::default(),
            "codex",
            "/workspace/project-a",
        )
        .expect("project target should be added");
        let project_id = config
            .hook_config_targets
            .iter()
            .find(|target| target.scope == HookConfigTargetScope::Project)
            .expect("project target should exist")
            .id
            .clone();
        let config = HookConfigTargetService::apply_enablement(config, "global-codex", true)
            .expect("global target should be enabled");

        let updated = HookConfigTargetService::apply_enablement(config, &project_id, true)
            .expect("project target should be enabled");

        assert!(updated
            .hook_config_targets
            .iter()
            .any(|target| target.id == project_id && target.enabled));
        assert!(updated
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-codex" && !target.enabled));
        assert!(updated
            .hook_config_targets
            .iter()
            .any(|target| target.id == "global-claude-code" && !target.enabled));
    }

    #[test]
    fn project_target_id_uses_deterministic_path_slug_and_hash() {
        let first = HookConfigTargetService::project_target_id("codex", "/workspace/project-a");
        let second = HookConfigTargetService::project_target_id("codex", "/workspace/project-a");

        assert_eq!(first, second);
        assert!(first.starts_with("project-codex-project-a-"));
    }

    #[test]
    fn same_project_path_can_be_added_for_different_sources() {
        let config = AppConfig::default();
        let updated =
            HookConfigTargetService::add_project_target(config, "codex", "/workspace/project-a")
                .expect("codex target should be added");
        let updated = HookConfigTargetService::add_project_target(
            updated,
            "claude-code",
            "/workspace/project-a",
        )
        .expect("claude target should be added");

        let count = updated
            .hook_config_targets
            .iter()
            .filter(|target| target.project_path.as_deref() == Some("/workspace/project-a"))
            .count();
        assert_eq!(2, count);
    }

    #[test]
    fn remove_project_target_removes_only_settings_target() {
        let config = HookConfigTargetService::add_project_target(
            AppConfig::default(),
            "codex",
            "/workspace/project-a",
        )
        .expect("target should be added");
        let target_id = config
            .hook_config_targets
            .iter()
            .find(|target| target.scope == HookConfigTargetScope::Project)
            .expect("project target should exist")
            .id
            .clone();

        let updated = HookConfigTargetService::remove_target(config, &target_id)
            .expect("project target should be removable");

        assert!(!updated
            .hook_config_targets
            .iter()
            .any(|target| target.id == target_id));
    }

    #[test]
    fn refuses_to_remove_global_target() {
        let error = HookConfigTargetService::remove_target(AppConfig::default(), "global-codex")
            .expect_err("global target should be protected");

        assert_eq!("global hook config target cannot be removed", error);
    }

    #[test]
    fn removing_unknown_target_keeps_config_unchanged() {
        let config = AppConfig::default();
        let updated = HookConfigTargetService::remove_target(config.clone(), "missing-target")
            .expect("missing target should be ignored");

        assert_eq!(config.hook_config_targets, updated.hook_config_targets);
    }

    #[test]
    fn rejects_unknown_source() {
        let error = HookConfigTargetService::add_project_target(
            AppConfig::default(),
            "unknown",
            "/workspace/project-a",
        )
        .expect_err("unknown source should fail");

        assert_eq!("unknown ai tool source: unknown", error);
    }

    #[test]
    fn rejects_unknown_source_through_ai_tool_registry() {
        let error = HookConfigTargetService::add_project_target(
            AppConfig::default(),
            "unknown",
            "/workspace/project-a",
        )
        .expect_err("unknown source should fail");

        assert_eq!("unknown ai tool source: unknown", error);
    }

    #[test]
    fn rejects_empty_project_path() {
        let error = HookConfigTargetService::add_project_target(AppConfig::default(), "codex", " ")
            .expect_err("empty path should fail");

        assert_eq!("projectPath cannot be empty", error);
    }
}
