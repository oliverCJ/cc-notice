use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::adapters::ai_tools::registry;
use crate::app_services::hook_config_writer::handlers::{
    command_has_debug, relay_event_from_command,
};
use crate::core::app_config::{
    AppConfig, HookConfigTarget, HookConfigTargetScope, HookEventSelections,
};
use crate::core::hook_events::{hook_events_for_source, HookEventDefinition};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookConfigTargetStatus {
    pub id: String,
    pub scope: String,
    pub source: String,
    pub label: String,
    pub project_path: Option<String>,
    pub enabled: bool,
    pub config_path: String,
    pub exists: bool,
    pub can_create: bool,
    pub matches_selected_events: bool,
    pub debug_enabled: bool,
}

pub struct HookEventService;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventFrontendState {
    pub catalog: Vec<HookEventDefinition>,
    pub selected: HookEventSelectionsView,
    pub targets: Vec<HookConfigTargetStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventSelectionsView {
    pub by_source: BTreeMap<String, Vec<String>>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub codex: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub claude_code: Vec<String>,
}

impl HookEventService {
    pub fn target_status_for_home(
        target: &HookConfigTarget,
        home: &Path,
    ) -> Result<HookConfigTargetStatus, String> {
        Self::target_status_for_home_with_selections(
            target,
            home,
            &HookEventSelectionsView::default(),
        )
    }

    pub fn target_status_for_home_with_selections(
        target: &HookConfigTarget,
        home: &Path,
        selections: &HookEventSelectionsView,
    ) -> Result<HookConfigTargetStatus, String> {
        let tool = registry::ai_tool_definition(&target.source)?;
        let project_path = target.project_path.as_deref().map(Path::new);
        let config_path = tool.config_path(target.scope.clone(), home, project_path)?;
        let exists = config_path.exists();
        let selected_events = selected_events_for_source(selections, &target.source);
        let config_state = hook_config_state(&config_path, &target.source, &selected_events);
        Ok(HookConfigTargetStatus {
            id: target.id.clone(),
            scope: match target.scope {
                HookConfigTargetScope::Global => "global".to_string(),
                HookConfigTargetScope::Project => "project".to_string(),
            },
            source: target.source.clone(),
            label: target.label.clone(),
            project_path: target.project_path.clone(),
            enabled: target.enabled,
            config_path: config_path.to_string_lossy().to_string(),
            exists,
            can_create: !exists,
            matches_selected_events: config_state.matches_selected_events,
            debug_enabled: config_state.debug_enabled,
        })
    }

    pub fn state_for_config(
        config: &AppConfig,
        home: &Path,
    ) -> Result<HookEventFrontendState, String> {
        let mut catalog = Vec::new();
        for tool in registry::all_ai_tools() {
            catalog.extend(hook_events_for_source(tool.source).iter().cloned());
        }
        let selected = selections_for_config(&config.hook_event_selections);
        let targets = config
            .hook_config_targets
            .iter()
            .map(|target| Self::target_status_for_home_with_selections(target, home, &selected))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(HookEventFrontendState {
            catalog,
            selected,
            targets,
        })
    }
}

fn selections_for_config(selections: &HookEventSelections) -> HookEventSelectionsView {
    let mut by_source = BTreeMap::new();
    for tool in registry::all_ai_tools() {
        by_source.insert(
            tool.source.to_string(),
            selections.events_for_source(tool.source),
        );
    }
    let codex = by_source.get("codex").cloned().unwrap_or_default();
    let claude_code = by_source.get("claude-code").cloned().unwrap_or_default();
    HookEventSelectionsView {
        by_source,
        codex,
        claude_code,
    }
}

impl Default for HookEventSelectionsView {
    fn default() -> Self {
        let mut by_source = BTreeMap::new();
        for tool in registry::all_ai_tools() {
            by_source.insert(tool.source.to_string(), Vec::new());
        }
        Self {
            by_source,
            codex: Vec::new(),
            claude_code: Vec::new(),
        }
    }
}

fn selected_events_for_source(selections: &HookEventSelectionsView, source: &str) -> Vec<String> {
    selections
        .by_source
        .get(source)
        .cloned()
        .unwrap_or_default()
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HookConfigState {
    matches_selected_events: bool,
    debug_enabled: bool,
}

fn hook_config_state(
    config_path: &Path,
    source: &str,
    selected_events: &[String],
) -> HookConfigState {
    if !config_path.exists() {
        return HookConfigState {
            matches_selected_events: selected_events.is_empty(),
            debug_enabled: false,
        };
    }
    let Ok(content) = crate::infrastructure::file_config::read_to_string(config_path) else {
        return HookConfigState {
            matches_selected_events: false,
            debug_enabled: false,
        };
    };
    let Ok(value) = serde_json::from_str::<Value>(&content) else {
        return HookConfigState {
            matches_selected_events: false,
            debug_enabled: false,
        };
    };
    let managed_commands = managed_relay_commands(&value, source);
    let configured_events = managed_commands
        .iter()
        .filter_map(|command| relay_event_from_command(command, source))
        .collect::<Vec<_>>();
    let debug_enabled = !managed_commands.is_empty()
        && managed_commands
            .iter()
            .all(|command| command_has_debug(command));

    HookConfigState {
        matches_selected_events: same_event_set(selected_events, &configured_events),
        debug_enabled,
    }
}

fn managed_relay_commands(config: &Value, source: &str) -> Vec<String> {
    let Some(hooks) = config.get("hooks").and_then(Value::as_object) else {
        return Vec::new();
    };
    let mut commands = Vec::new();
    for groups_value in hooks.values() {
        let Some(groups) = groups_value.as_array() else {
            continue;
        };
        for group in groups {
            let Some(handlers) = group.get("hooks").and_then(Value::as_array) else {
                continue;
            };
            for handler in handlers {
                let status_matches = handler
                    .get("statusMessage")
                    .and_then(Value::as_str)
                    .map(|status| status.starts_with("CC Notice:"))
                    .unwrap_or(false);
                let Some(command) = handler.get("command").and_then(Value::as_str) else {
                    continue;
                };
                if status_matches
                    && command.contains("cc-notice-relay")
                    && command.contains(&format!("--source {source}"))
                {
                    commands.push(command.to_string());
                }
            }
        }
    }
    commands
}

fn same_event_set(expected: &[String], actual: &[String]) -> bool {
    let mut expected = expected.to_vec();
    let mut actual = actual.to_vec();
    expected.sort();
    expected.dedup();
    actual.sort();
    actual.dedup();
    expected == actual
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::app_config::AppConfig;
    use crate::core::app_config::{HookConfigTarget, HookConfigTargetScope, HookEventSelections};
    use std::collections::BTreeMap;
    use std::path::Path;

    fn selections_view(source: &str, events: Vec<&str>) -> HookEventSelectionsView {
        let mut view = HookEventSelectionsView::default();
        let events = events.into_iter().map(str::to_string).collect::<Vec<_>>();
        view.by_source.insert(source.to_string(), events.clone());
        if source == "codex" {
            view.codex = events;
        } else if source == "claude-code" {
            view.claude_code = events;
        }
        view
    }

    #[test]
    fn resolves_global_codex_hooks_json_path() {
        let target = HookConfigTarget {
            id: "global-codex".to_string(),
            scope: HookConfigTargetScope::Global,
            source: "codex".to_string(),
            label: "Codex 全局配置".to_string(),
            project_path: None,
            enabled: false,
        };

        let status = HookEventService::target_status_for_home(&target, Path::new("/Users/alice"))
            .expect("target should resolve");

        assert_eq!("/Users/alice/.codex/hooks.json", status.config_path);
        assert_eq!("global", status.scope);
        assert_eq!("codex", status.source);
    }

    #[test]
    fn resolves_project_claude_settings_path() {
        let target = HookConfigTarget {
            id: "project-claude".to_string(),
            scope: HookConfigTargetScope::Project,
            source: "claude-code".to_string(),
            label: "Project Claude".to_string(),
            project_path: Some("/workspace/project-a".to_string()),
            enabled: false,
        };

        let status = HookEventService::target_status_for_home(&target, Path::new("/Users/alice"))
            .expect("target should resolve");

        assert_eq!(
            "/workspace/project-a/.claude/settings.json",
            status.config_path
        );
        assert_eq!("project", status.scope);
        assert_eq!("claude-code", status.source);
    }

    #[test]
    fn resolves_global_claude_settings_path_from_registry() {
        let target = HookConfigTarget {
            id: "global-claude-code".to_string(),
            scope: HookConfigTargetScope::Global,
            source: "claude-code".to_string(),
            label: "Claude Code 全局配置".to_string(),
            project_path: None,
            enabled: false,
        };

        let status = HookEventService::target_status_for_home(&target, Path::new("/Users/alice"))
            .expect("target should resolve");

        assert_eq!("/Users/alice/.claude/settings.json", status.config_path);
    }

    #[test]
    fn builds_frontend_state_from_config() {
        let config = AppConfig::default();

        let state = HookEventService::state_for_config(&config, Path::new("/Users/alice"))
            .expect("state should build");

        assert!(state
            .catalog
            .iter()
            .any(|event| event.event == "PermissionRequest"));
        assert!(state
            .selected
            .codex
            .contains(&"PermissionRequest".to_string()));
        assert!(state
            .targets
            .iter()
            .any(|target| target.id == "global-codex"));
    }

    #[test]
    fn builds_frontend_state_from_global_hook_event_selections() {
        let mut config = AppConfig::default();
        let mut by_source = BTreeMap::new();
        by_source.insert("codex".to_string(), vec!["Stop".to_string()]);
        config.hook_event_selections = HookEventSelections { by_source };
        let state = HookEventService::state_for_config(&config, Path::new("/Users/alice"))
            .expect("state should build from app config selections");

        assert_eq!(vec!["Stop".to_string()], state.selected.codex);
        assert!(state
            .targets
            .iter()
            .any(|target| target.id == "global-codex"));
    }

    #[test]
    fn target_status_reports_matching_events_and_debug_mode() {
        let home = std::env::temp_dir().join(format!(
            "cc-notice-hook-status-match-{}",
            std::process::id()
        ));
        let target = HookConfigTarget {
            id: "project-codex".to_string(),
            scope: HookConfigTargetScope::Project,
            source: "codex".to_string(),
            label: "Project Codex".to_string(),
            project_path: Some(home.join("project").to_string_lossy().to_string()),
            enabled: false,
        };
        let config_path = home.join("project").join(".codex").join("hooks.json");
        crate::infrastructure::file_config::write_string(
            &config_path,
            r#"{"hooks":{"SessionStart":[{"matcher":"","hooks":[{"type":"command","command":"cc-notice-relay --source codex --event SessionStart --debug","statusMessage":"CC Notice: SessionStart"}]}],"Stop":[{"matcher":"","hooks":[{"type":"command","command":"cc-notice-relay --source codex --event Stop --debug","statusMessage":"CC Notice: Stop"}]}]}}"#,
        )
        .expect("config should be written");
        let selections = selections_view("codex", vec!["SessionStart", "Stop"]);

        let status =
            HookEventService::target_status_for_home_with_selections(&target, &home, &selections)
                .expect("target status should build");

        assert!(status.matches_selected_events);
        assert!(status.debug_enabled);
    }

    #[test]
    fn target_status_reports_matching_claude_settings_and_debug_mode() {
        let home = std::env::temp_dir().join(format!(
            "cc-notice-claude-hook-status-match-{}",
            std::process::id()
        ));
        let target = HookConfigTarget {
            id: "project-claude".to_string(),
            scope: HookConfigTargetScope::Project,
            source: "claude-code".to_string(),
            label: "Project Claude".to_string(),
            project_path: Some(home.join("project").to_string_lossy().to_string()),
            enabled: false,
        };
        let config_path = home.join("project").join(".claude").join("settings.json");
        crate::infrastructure::file_config::write_string(
            &config_path,
            r#"{"hooks":{"SessionStart":[{"matcher":"","hooks":[{"type":"command","command":"cc-notice-relay --source claude-code --event SessionStart --debug","statusMessage":"CC Notice: SessionStart"}]}]}}"#,
        )
        .expect("config should be written");
        let selections = selections_view("claude-code", vec!["SessionStart"]);

        let status =
            HookEventService::target_status_for_home_with_selections(&target, &home, &selections)
                .expect("target status should build");

        assert!(status.matches_selected_events);
        assert!(status.debug_enabled);
    }

    #[test]
    fn target_status_reports_event_mismatch() {
        let home = std::env::temp_dir().join(format!(
            "cc-notice-hook-status-mismatch-{}",
            std::process::id()
        ));
        let target = HookConfigTarget {
            id: "project-codex".to_string(),
            scope: HookConfigTargetScope::Project,
            source: "codex".to_string(),
            label: "Project Codex".to_string(),
            project_path: Some(home.join("project").to_string_lossy().to_string()),
            enabled: false,
        };
        let config_path = home.join("project").join(".codex").join("hooks.json");
        crate::infrastructure::file_config::write_string(
            &config_path,
            r#"{"hooks":{"SessionStart":[{"matcher":"","hooks":[{"type":"command","command":"cc-notice-relay --source codex --event SessionStart","statusMessage":"CC Notice: SessionStart"}]}]}}"#,
        )
        .expect("config should be written");
        let selections = selections_view("codex", vec!["SessionStart", "Stop"]);

        let status =
            HookEventService::target_status_for_home_with_selections(&target, &home, &selections)
                .expect("target status should build");

        assert!(!status.matches_selected_events);
        assert!(!status.debug_enabled);
    }
}
