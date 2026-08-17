use crate::adapters::ai_tools::{
    AiToolAdapter, HookConfigCandidate, HookConfigScope, HookConfigSnippet,
};
use crate::core::hook_events::hook_events_for_source;
use crate::core::hook_relay::relay_commands_for_events;

pub struct ClaudeCodeAdapter;

impl AiToolAdapter for ClaudeCodeAdapter {
    fn tool_id(&self) -> &'static str {
        "claude-code"
    }

    fn display_name(&self) -> &'static str {
        "Claude Code"
    }

    fn config_candidates(&self, workspace_path: Option<&str>) -> Vec<HookConfigCandidate> {
        let mut candidates = vec![HookConfigCandidate {
            path: "~/.claude/settings.json".to_string(),
            scope: HookConfigScope::User,
        }];

        if let Some(workspace_path) = workspace_path {
            candidates.push(HookConfigCandidate {
                path: format!("{workspace_path}/.claude/settings.json"),
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
            description: "Claude Code hook relay configuration".to_string(),
            content: relay_commands_for_events(relay_command, self.tool_id(), &events),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_code_snippet_uses_minimal_relay_command() {
        let adapter = ClaudeCodeAdapter;

        let snippet = adapter.hook_snippet("cc-notice-relay");

        assert!(snippet
            .content
            .contains("cc-notice-relay --source claude-code --event SessionStart"));
        assert!(!snippet.content.contains("--payload"));
        assert!(!snippet.content.contains("--port"));
        assert!(!snippet.content.contains("--endpoint"));
    }

    #[test]
    fn claude_code_snippet_covers_documented_hook_events() {
        let adapter = ClaudeCodeAdapter;

        let snippet = adapter.hook_snippet("cc-notice-relay");

        for event in [
            "SessionStart",
            "UserPromptSubmit",
            "UserPromptExpansion",
            "PreToolUse",
            "PostToolUse",
            "PostToolUseFailure",
            "PostToolBatch",
            "Notification",
            "Stop",
            "StopFailure",
            "SubagentStart",
            "SubagentStop",
            "TaskCreated",
            "TaskCompleted",
            "PreCompact",
            "PostCompact",
            "SessionEnd",
            "ConfigChange",
            "CwdChanged",
            "FileChanged",
            "PermissionRequest",
            "PermissionDenied",
            "TeammateIdle",
            "WorktreeCreate",
            "WorktreeRemove",
            "MessageDisplay",
            "Elicitation",
            "ElicitationResult",
        ] {
            assert!(
                snippet.content.contains(&format!(
                    "cc-notice-relay --source claude-code --event {event}"
                )),
                "missing claude-code event {event}"
            );
        }
    }
}
