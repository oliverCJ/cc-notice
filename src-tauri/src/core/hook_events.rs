use serde::Serialize;

pub mod loader;
pub mod schema;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventDefinition {
    pub source: String,
    pub event: String,
    pub title: String,
    pub description: String,
    pub scenario: String,
    pub default_selected: bool,
    pub mapped_notice_event: String,
}

pub fn hook_events_for_source(source: &str) -> &'static [HookEventDefinition] {
    loader::hook_events_for_source(source)
}

pub fn default_selected_events(source: &str) -> Vec<String> {
    hook_events_for_source(source)
        .iter()
        .filter(|event| event.default_selected)
        .map(|event| event.event.clone())
        .collect()
}

pub fn is_known_hook_event(source: &str, event: &str) -> bool {
    hook_events_for_source(source)
        .iter()
        .any(|definition| definition.event == event)
}

pub fn mapped_notice_event(source: &str, event: &str) -> Option<&'static str> {
    hook_events_for_source(source)
        .iter()
        .find(|definition| definition.event == event)
        .map(|definition| definition.mapped_notice_event.as_str())
}

pub fn relay_commands_for_selected_events(
    relay_command: &str,
    source: &str,
    events: &[&str],
) -> Result<String, String> {
    let mut lines = Vec::new();
    for event in events {
        if !is_known_hook_event(source, event) {
            return Err(format!("unknown hook event for {source}: {event}"));
        }
        lines.push(format!("{relay_command} --source {source} --event {event}"));
    }
    Ok(lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_catalog_contains_official_events_only() {
        let events = hook_events_for_source("codex");
        let names: Vec<&str> = events.iter().map(|event| event.event.as_str()).collect();

        assert_eq!(
            vec![
                "SessionStart",
                "SubagentStart",
                "PreToolUse",
                "PermissionRequest",
                "PostToolUse",
                "PreCompact",
                "PostCompact",
                "UserPromptSubmit",
                "SubagentStop",
                "Stop",
            ],
            names
        );
        assert!(!names.contains(&"Setup"));
        assert!(!names.contains(&"InstructionsLoaded"));
        assert!(!names.contains(&"UserPromptExpansion"));
        assert!(!names.contains(&"PermissionDenied"));
    }

    #[test]
    fn default_codex_selection_uses_core_events() {
        assert_eq!(
            vec![
                "SessionStart",
                "PreToolUse",
                "PermissionRequest",
                "PostToolUse",
                "UserPromptSubmit",
                "Stop",
            ],
            default_selected_events("codex")
        );
    }

    #[test]
    fn default_claude_code_selection_uses_core_events() {
        assert_eq!(
            vec![
                "SessionStart",
                "UserPromptSubmit",
                "PreToolUse",
                "PostToolUse",
                "PostToolUseFailure",
                "Notification",
                "PermissionRequest",
                "Stop",
                "StopFailure",
            ],
            default_selected_events("claude-code")
        );
    }

    #[test]
    fn validates_source_events() {
        assert!(is_known_hook_event("codex", "SessionStart"));
        assert!(!is_known_hook_event("codex", "Setup"));
        assert!(is_known_hook_event("claude-code", "StopFailure"));
        assert!(!is_known_hook_event("unknown-tool", "SessionStart"));
    }

    #[test]
    fn builds_relay_commands_from_selected_events() {
        let snippet = relay_commands_for_selected_events(
            "cc-notice-relay",
            "codex",
            &["SessionStart", "Stop"],
        )
        .expect("valid snippet should build");

        assert_eq!(
            "cc-notice-relay --source codex --event SessionStart
cc-notice-relay --source codex --event Stop",
            snippet
        );
    }

    #[test]
    fn rejects_unknown_events_when_building_snippet() {
        let error = relay_commands_for_selected_events(
            "cc-notice-relay",
            "codex",
            &["SessionStart", "Setup"],
        )
        .expect_err("unknown event should fail");

        assert_eq!("unknown hook event for codex: Setup", error);
    }
}
