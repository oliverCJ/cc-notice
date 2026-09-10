use super::definition::{AiToolDefinition, HookConfigCodecKind, HookConfigShape, HookTargetKind};
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
        codec_kind: HookConfigCodecKind::MatcherGroupJson,
        target_kind: HookTargetKind::SharedFile,
        can_create_project_target: false,
        global_root_env: None,
        env_config_dir: None,
    },
    AiToolDefinition {
        source: "claude-code",
        display_name: "Claude Code",
        user_config_dir: ".claude",
        config_file_name: "settings.json",
        inline_hooks_warning: false,
        hook_config_shape: HookConfigShape::HooksObject,
        payload_aliases: &DEFAULT_PAYLOAD_ALIASES,
        codec_kind: HookConfigCodecKind::MatcherGroupJson,
        target_kind: HookTargetKind::SharedFile,
        can_create_project_target: false,
        global_root_env: None,
        env_config_dir: None,
    },
    AiToolDefinition {
        source: "gemini-cli",
        display_name: "Gemini CLI",
        user_config_dir: ".gemini",
        config_file_name: "settings.json",
        inline_hooks_warning: false,
        hook_config_shape: HookConfigShape::HooksObject,
        payload_aliases: &DEFAULT_PAYLOAD_ALIASES,
        codec_kind: HookConfigCodecKind::MatcherGroupJson,
        target_kind: HookTargetKind::SharedFile,
        can_create_project_target: false,
        global_root_env: None,
        env_config_dir: None,
    },
    AiToolDefinition {
        source: "cursor",
        display_name: "Cursor",
        user_config_dir: ".cursor",
        config_file_name: "hooks.json",
        inline_hooks_warning: false,
        hook_config_shape: HookConfigShape::HooksObject,
        payload_aliases: &DEFAULT_PAYLOAD_ALIASES,
        codec_kind: HookConfigCodecKind::FlatHooksJson,
        target_kind: HookTargetKind::SharedFile,
        can_create_project_target: false,
        global_root_env: None,
        env_config_dir: None,
    },
    AiToolDefinition {
        source: "github-copilot-cli",
        display_name: "GitHub Copilot CLI",
        user_config_dir: ".copilot/hooks",
        config_file_name: "cc-notice.json",
        inline_hooks_warning: false,
        hook_config_shape: HookConfigShape::HooksObject,
        payload_aliases: &DEFAULT_PAYLOAD_ALIASES,
        codec_kind: HookConfigCodecKind::CopilotHooksJson,
        target_kind: HookTargetKind::ManagedFile,
        can_create_project_target: false,
        global_root_env: Some("COPILOT_HOME"),
        env_config_dir: Some("hooks"),
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
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn registry_contains_codex_and_claude_code() {
        let ids = all_ai_tools()
            .iter()
            .map(|tool| tool.source)
            .collect::<Vec<_>>();

        assert!(ids.contains(&"codex"));
        assert!(ids.contains(&"claude-code"));
        assert!(ids.contains(&"gemini-cli"));
        assert!(ids.contains(&"cursor"));
        assert!(ids.contains(&"github-copilot-cli"));
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
            HookConfigCodecKind::MatcherGroupJson,
            ai_tool_definition("codex").unwrap().codec_kind
        );
        assert_eq!(
            HookTargetKind::SharedFile,
            ai_tool_definition("claude-code").unwrap().target_kind
        );
        assert!(
            !ai_tool_definition("codex")
                .unwrap()
                .can_create_project_target
        );
        assert_eq!(
            HookConfigShape::HooksObject,
            ai_tool_definition("claude-code").unwrap().hook_config_shape
        );
        assert_eq!(
            &[
                "tool_response",
                "toolResponse",
                "tool_output",
                "toolOutput",
                "toolResult"
            ],
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

    #[test]
    fn copilot_global_path_uses_copilot_home_when_set() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let copilot = ai_tool_definition("github-copilot-cli").unwrap();
        std::env::set_var("COPILOT_HOME", "/Users/alice/.custom-copilot");
        let path = copilot
            .config_path(
                HookConfigTargetScope::Global,
                Path::new("/Users/alice"),
                None,
            )
            .expect("copilot path should resolve");
        std::env::remove_var("COPILOT_HOME");

        assert_eq!(
            Path::new("/Users/alice/.custom-copilot/hooks/cc-notice.json"),
            path
        );
    }

    #[test]
    fn copilot_empty_home_falls_back_to_default_directory() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let copilot = ai_tool_definition("github-copilot-cli").unwrap();
        std::env::set_var("COPILOT_HOME", "");
        let path = copilot
            .config_path(
                HookConfigTargetScope::Global,
                Path::new("/Users/alice"),
                None,
            )
            .expect("copilot path should resolve");
        std::env::remove_var("COPILOT_HOME");

        assert_eq!(
            Path::new("/Users/alice/.copilot/hooks/cc-notice.json"),
            path
        );
    }
}
