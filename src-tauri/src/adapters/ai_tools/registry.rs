use super::definition::{AiToolDefinition, HookConfigShape};
use super::field_aliases::DEFAULT_PAYLOAD_ALIASES;

const AI_TOOLS: &[AiToolDefinition] = &[
    AiToolDefinition {
        source: "codex",
        display_name: "Codex",
        user_config_dir: ".codex",
        config_file_name: "hooks.json",
        inline_hooks_warning: true,
        hook_config_shape: HookConfigShape::HooksObject,
        payload_aliases: &DEFAULT_PAYLOAD_ALIASES,
    },
    AiToolDefinition {
        source: "claude-code",
        display_name: "Claude Code",
        user_config_dir: ".claude",
        config_file_name: "settings.json",
        inline_hooks_warning: false,
        hook_config_shape: HookConfigShape::HooksObject,
        payload_aliases: &DEFAULT_PAYLOAD_ALIASES,
    },
];

pub fn all_ai_tools() -> &'static [AiToolDefinition] {
    AI_TOOLS
}

pub fn supported_ai_tool_sources() -> Vec<&'static str> {
    AI_TOOLS.iter().map(|tool| tool.source).collect()
}

pub fn is_supported_ai_tool(source: &str) -> bool {
    AI_TOOLS.iter().any(|tool| tool.source == source)
}

pub fn ai_tool_definition(source: &str) -> Result<&'static AiToolDefinition, String> {
    AI_TOOLS
        .iter()
        .find(|tool| tool.source == source)
        .ok_or_else(|| format!("unknown ai tool source: {source}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::app_config::HookConfigTargetScope;
    use std::path::Path;

    #[test]
    fn registry_contains_codex_and_claude_code() {
        let ids = all_ai_tools()
            .iter()
            .map(|tool| tool.source)
            .collect::<Vec<_>>();

        assert_eq!(vec!["codex", "claude-code"], ids);
        assert_eq!("Codex", ai_tool_definition("codex").unwrap().display_name);
        assert_eq!(
            HookConfigShape::HooksObject,
            ai_tool_definition("codex").unwrap().hook_config_shape
        );
        assert_eq!(
            "Claude Code",
            ai_tool_definition("claude-code").unwrap().display_name
        );
        assert_eq!(
            HookConfigShape::HooksObject,
            ai_tool_definition("claude-code").unwrap().hook_config_shape
        );
        assert_eq!(
            &["tool_response", "toolResponse"],
            ai_tool_definition("claude-code")
                .unwrap()
                .payload_aliases
                .tool_response
                .raw_aliases
        );
    }

    #[test]
    fn resolves_config_paths_from_tool_definition() {
        let codex = ai_tool_definition("codex").unwrap();
        let claude = ai_tool_definition("claude-code").unwrap();

        assert_eq!(
            Path::new("/Users/alice/.codex/hooks.json"),
            codex
                .config_path(
                    HookConfigTargetScope::Global,
                    Path::new("/Users/alice"),
                    None
                )
                .unwrap()
        );
        assert_eq!(
            Path::new("/workspace/app/.claude/settings.json"),
            claude
                .config_path(
                    HookConfigTargetScope::Project,
                    Path::new("/Users/alice"),
                    Some(Path::new("/workspace/app")),
                )
                .unwrap()
        );
    }

    #[test]
    fn unknown_tool_returns_clear_error() {
        let error = ai_tool_definition("unknown").expect_err("unknown tool should fail");

        assert_eq!("unknown ai tool source: unknown", error);
    }
}
