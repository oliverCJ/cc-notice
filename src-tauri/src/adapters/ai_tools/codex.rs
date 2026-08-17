use crate::adapters::ai_tools::{
    AiToolAdapter, HookConfigCandidate, HookConfigScope, HookConfigSnippet,
};
use crate::core::hook_events::hook_events_for_source;
use crate::core::hook_relay::relay_commands_for_events;

pub struct CodexAdapter;

impl AiToolAdapter for CodexAdapter {
    fn tool_id(&self) -> &'static str {
        "codex"
    }

    fn display_name(&self) -> &'static str {
        "Codex"
    }

    fn config_candidates(&self, workspace_path: Option<&str>) -> Vec<HookConfigCandidate> {
        let mut candidates = vec![
            HookConfigCandidate {
                path: "~/.codex/hooks.json".to_string(),
                scope: HookConfigScope::User,
            },
            HookConfigCandidate {
                path: "~/.codex/config.toml".to_string(),
                scope: HookConfigScope::User,
            },
        ];

        if let Some(workspace_path) = workspace_path {
            candidates.push(HookConfigCandidate {
                path: format!("{workspace_path}/.codex/hooks.json"),
                scope: HookConfigScope::Workspace,
            });
            candidates.push(HookConfigCandidate {
                path: format!("{workspace_path}/.codex/config.toml"),
                scope: HookConfigScope::Workspace,
            });
        }

        candidates
    }

    fn hook_snippet(&self, relay_command: &str) -> HookConfigSnippet {
        let events = hook_events_for_source(self.tool_id())
            .iter()
            .map(|definition| definition.event.as_str())
            .collect::<Vec<_>>();
        HookConfigSnippet {
            tool_id: self.tool_id().to_string(),
            description: "Codex hook relay configuration".to_string(),
            content: relay_commands_for_events(relay_command, self.tool_id(), &events),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_snippet_contains_relay_command_and_source() {
        let adapter = CodexAdapter;

        let snippet = adapter.hook_snippet("cc-notice-relay");

        assert_eq!("codex", snippet.tool_id);
        assert!(snippet.content.contains("cc-notice-relay"));
        assert!(snippet.content.contains("--source codex"));
    }

    #[test]
    fn codex_snippet_uses_minimal_relay_command() {
        let adapter = CodexAdapter;

        let snippet = adapter.hook_snippet("cc-notice-relay");

        assert!(snippet
            .content
            .contains("cc-notice-relay --source codex --event SessionStart"));
        assert!(!snippet.content.contains("--payload"));
        assert!(!snippet.content.contains("--port"));
        assert!(!snippet.content.contains("--endpoint"));
    }

    #[test]
    fn codex_snippet_covers_documented_hook_events() {
        let adapter = CodexAdapter;

        let snippet = adapter.hook_snippet("cc-notice-relay");

        for event in [
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
        ] {
            assert!(
                snippet
                    .content
                    .contains(&format!("cc-notice-relay --source codex --event {event}")),
                "missing codex event {event}"
            );
        }
        for event in [
            "Setup",
            "InstructionsLoaded",
            "UserPromptExpansion",
            "PermissionDenied",
        ] {
            assert!(
                !snippet
                    .content
                    .contains(&format!("cc-notice-relay --source codex --event {event}")),
                "unexpected non-official codex event {event}"
            );
        }
    }

    #[test]
    fn codex_candidates_include_user_and_workspace_config() {
        let adapter = CodexAdapter;

        let candidates = adapter.config_candidates(Some("/workspace/project"));

        assert_eq!("~/.codex/hooks.json", candidates[0].path);
        assert_eq!("~/.codex/config.toml", candidates[1].path);
        assert_eq!("/workspace/project/.codex/hooks.json", candidates[2].path);
        assert_eq!("/workspace/project/.codex/config.toml", candidates[3].path);
    }
}
