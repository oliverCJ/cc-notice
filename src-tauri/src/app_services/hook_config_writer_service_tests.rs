use super::*;
use crate::core::app_config::HookConfigTargetScope;
use serde_json::json;

fn codex_target() -> HookConfigTarget {
    HookConfigTarget {
        id: "global-codex".to_string(),
        scope: HookConfigTargetScope::Global,
        source: "codex".to_string(),
        label: "Codex 全局配置".to_string(),
        project_path: None,
        enabled: false,
    }
}

fn claude_target() -> HookConfigTarget {
    HookConfigTarget {
        id: "global-claude-code".to_string(),
        scope: HookConfigTargetScope::Global,
        source: "claude-code".to_string(),
        label: "Claude Code 全局配置".to_string(),
        project_path: None,
        enabled: false,
    }
}

fn selections() -> HookEventSelections {
    let mut selections = HookEventSelections::default();
    selections.set_events_for_source(
        "codex",
        vec!["SessionStart".to_string(), "Stop".to_string()],
    );
    selections.set_events_for_source("claude-code", vec!["SessionStart".to_string()]);
    selections
}

#[test]
fn previews_codex_empty_config_with_hooks_object() {
    let preview = HookConfigWriterService::preview_target(
        &codex_target(),
        &selections(),
        Path::new("/Users/alice"),
    )
    .expect("preview should build");

    let value: Value = serde_json::from_str(&preview.preview_json).expect("valid json");
    assert_eq!(
        "cc-notice-relay --source codex --event SessionStart",
        value["hooks"]["SessionStart"][0]["hooks"][0]["command"]
    );
    assert_eq!(2, preview.event_count);
    assert_eq!("/Users/alice/.codex/hooks.json", preview.config_path);
}

#[test]
fn preview_uses_installed_relay_absolute_path() {
    let dir = std::env::temp_dir().join(format!(
        "cc-notice-relay-absolute-path-{}",
        std::process::id()
    ));
    let relay_path = dir.join(".cc-notice").join("bin").join("cc-notice-relay");

    let preview = HookConfigWriterService::preview_target_with_relay(
        &codex_target(),
        &selections(),
        &dir,
        &relay_path,
    )
    .expect("preview should build");

    assert!(preview.preview_json.contains(&format!(
        "{} --source codex --event SessionStart",
        relay_path.to_string_lossy()
    )));
}

#[test]
fn preview_quotes_relay_path_with_spaces() {
    let dir = std::env::temp_dir().join(format!(
        "cc-notice relay absolute path {}",
        std::process::id()
    ));
    let relay_path = dir.join(".cc-notice").join("bin").join("cc-notice-relay");

    let preview = HookConfigWriterService::preview_target_with_relay(
        &codex_target(),
        &selections(),
        &dir,
        &relay_path,
    )
    .expect("preview should build");

    assert!(preview.preview_json.contains(&format!(
        "'{}' --source codex --event SessionStart",
        relay_path.to_string_lossy()
    )));
}

#[test]
fn preserves_user_handlers_and_replaces_managed_handlers() {
    let existing = json!({
        "hooks": {
            "SessionStart": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "echo user",
                            "statusMessage": "User hook"
                        },
                        {
                            "type": "command",
                            "command": "cc-notice-relay --source codex --event Old",
                            "statusMessage": "CC Notice: Old"
                        }
                    ]
                }
            ]
        }
    });

    let merged = HookConfigWriterService::merge_config_for_source(
        "codex",
        existing,
        &["SessionStart".to_string()],
    )
    .expect("merge should work");

    let handlers = merged["hooks"]["SessionStart"][0]["hooks"]
        .as_array()
        .expect("handlers should be array");
    assert!(handlers
        .iter()
        .any(|handler| handler["command"] == "echo user"));
    assert!(handlers.iter().any(|handler| {
        handler["command"] == "cc-notice-relay --source codex --event SessionStart"
    }));
    assert!(!handlers
        .iter()
        .any(|handler| handler["command"] == "cc-notice-relay --source codex --event Old"));
}

#[test]
fn preview_restore_removes_only_managed_handlers_for_target_source() {
    let dir =
        std::env::temp_dir().join(format!("cc-notice-preview-restore-{}", std::process::id()));
    let config_path = dir.join(".codex").join("hooks.json");
    file_config::write_string(
        &config_path,
        &serde_json::to_string_pretty(&json!({
            "hooks": {
                "SessionStart": [
                    {
                        "matcher": "",
                        "hooks": [
                            {
                                "type": "command",
                                "command": "echo user",
                                "statusMessage": "User hook"
                            },
                            {
                                "type": "command",
                                "command": "cc-notice-relay --source codex --event SessionStart",
                                "statusMessage": "CC Notice: SessionStart"
                            },
                            {
                                "type": "command",
                                "command": "cc-notice-relay --source claude-code --event SessionStart",
                                "statusMessage": "CC Notice: Claude"
                            }
                        ]
                    }
                ]
            }
        }))
        .expect("json should serialize"),
    )
    .expect("config should be written");

    let preview = HookConfigWriterService::preview_restore_target(&codex_target(), Path::new(&dir))
        .expect("restore preview should build");
    let value: Value = serde_json::from_str(&preview.preview_json).expect("valid json");
    let handlers = value["hooks"]["SessionStart"][0]["hooks"]
        .as_array()
        .expect("handlers should be array");

    assert_eq!(2, handlers.len());
    assert!(handlers
        .iter()
        .any(|handler| handler["command"] == "echo user"));
    assert!(handlers.iter().any(|handler| {
        handler["command"] == "cc-notice-relay --source claude-code --event SessionStart"
    }));
    assert!(!handlers.iter().any(|handler| {
        handler["command"] == "cc-notice-relay --source codex --event SessionStart"
    }));
    assert_eq!(1, preview.event_count);
}

#[test]
fn preview_with_debug_adds_debug_flag_to_managed_handlers() {
    let preview = HookConfigWriterService::preview_target_with_options(
        &codex_target(),
        &selections(),
        Path::new("/Users/alice"),
        Path::new("cc-notice-relay"),
        true,
    )
    .expect("preview should build");

    let value: Value = serde_json::from_str(&preview.preview_json).expect("valid json");

    assert_eq!(
        "cc-notice-relay --source codex --event SessionStart --debug",
        value["hooks"]["SessionStart"][0]["hooks"][0]["command"]
    );
}

#[test]
fn merge_without_debug_removes_existing_debug_flag_from_managed_handlers() {
    let existing = json!({
        "hooks": {
            "SessionStart": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "cc-notice-relay --source codex --event SessionStart --debug",
                            "statusMessage": "CC Notice: SessionStart"
                        }
                    ]
                }
            ]
        }
    });

    let merged = HookConfigWriterService::merge_config_for_source_with_relay_options(
        "codex",
        existing,
        &["SessionStart".to_string()],
        Path::new("cc-notice-relay"),
        false,
    )
    .expect("merge should work");

    assert_eq!(
        "cc-notice-relay --source codex --event SessionStart",
        merged["hooks"]["SessionStart"][0]["hooks"][0]["command"]
    );
}

#[test]
fn replaces_managed_handlers_written_with_absolute_relay_path() {
    let existing_relay = Path::new("/Users/alice/.cc-notice/bin/cc-notice-relay");
    let next_relay = Path::new("/Users/bob/.cc-notice/bin/cc-notice-relay");
    let existing = json!({
        "hooks": {
            "SessionStart": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "type": "command",
                            "command": format!(
                                "{} --source codex --event Old",
                                existing_relay.to_string_lossy()
                            ),
                            "statusMessage": "CC Notice: Old"
                        }
                    ]
                }
            ]
        }
    });

    let merged = HookConfigWriterService::merge_config_for_source_with_relay(
        "codex",
        existing,
        &["SessionStart".to_string()],
        next_relay,
    )
    .expect("merge should work");

    let handlers = merged["hooks"]["SessionStart"][0]["hooks"]
        .as_array()
        .expect("handlers should be array");
    assert_eq!(1, handlers.len());
    assert_eq!(
        format!(
            "{} --source codex --event SessionStart",
            next_relay.to_string_lossy()
        ),
        handlers[0]["command"]
    );
}

#[test]
fn replaces_legacy_managed_handlers_written_without_absolute_relay_path() {
    let next_relay = Path::new("/Users/bob/.cc-notice/bin/cc-notice-relay");
    let existing = json!({
        "hooks": {
            "Stop": [
                {
                    "matcher": "",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "cc-notice-relay --source codex --event Stop",
                            "statusMessage": "CC Notice: Stop"
                        }
                    ]
                }
            ]
        }
    });

    let merged = HookConfigWriterService::merge_config_for_source_with_relay(
        "codex",
        existing,
        &["Stop".to_string()],
        next_relay,
    )
    .expect("merge should work");

    let handlers = merged["hooks"]["Stop"][0]["hooks"]
        .as_array()
        .expect("handlers should be array");
    assert_eq!(1, handlers.len());
    assert_eq!(
        format!(
            "{} --source codex --event Stop",
            next_relay.to_string_lossy()
        ),
        handlers[0]["command"]
    );
}

#[test]
fn preserves_claude_settings_fields() {
    let existing = json!({
        "permissions": { "allow": ["Bash(ls)"] },
        "hooks": {}
    });

    let merged = HookConfigWriterService::merge_config_for_source(
        "claude-code",
        existing,
        &["SessionStart".to_string()],
    )
    .expect("merge should work");

    assert_eq!("Bash(ls)", merged["permissions"]["allow"][0]);
    assert_eq!(
        "cc-notice-relay --source claude-code --event SessionStart",
        merged["hooks"]["SessionStart"][0]["hooks"][0]["command"]
    );
}

#[test]
fn rejects_invalid_json_without_writing() {
    let dir = std::env::temp_dir().join(format!("cc-notice-invalid-json-{}", std::process::id()));
    let path = dir.join(".codex").join("hooks.json");
    file_config::write_string(&path, "{invalid").expect("invalid config should be written");

    let error = HookConfigWriterService::preview_target(&codex_target(), &selections(), &dir)
        .expect_err("invalid json should fail");

    assert!(error.contains("failed to parse hook config json"));
    assert_eq!(
        "{invalid",
        file_config::read_to_string(&path).expect("file should remain")
    );
}

#[test]
fn detects_codex_inline_hooks_warning() {
    let dir = std::env::temp_dir().join(format!("cc-notice-inline-hooks-{}", std::process::id()));
    let toml_path = dir.join(".codex").join("config.toml");
    file_config::write_string(
        &toml_path, "[hooks]
",
    )
    .expect("config toml should exist");

    let preview = HookConfigWriterService::preview_target(&codex_target(), &selections(), &dir)
        .expect("preview should succeed");

    assert_eq!(
        Some("检测到同作用域 Codex config.toml 中存在 inline hooks，Codex 会合并 hooks.json 和 config.toml hooks。".to_string()),
        preview.inline_hooks_warning
    );
}

#[test]
fn rejects_empty_selection() {
    let mut selections = selections();
    selections.set_events_for_source("codex", vec![]);

    let error = HookConfigWriterService::preview_target(
        &codex_target(),
        &selections,
        Path::new("/Users/alice"),
    )
    .expect_err("empty selection should fail");

    assert_eq!("hook event selection for codex cannot be empty", error);
}

#[test]
fn resolves_project_claude_target_path() {
    let target = HookConfigTarget {
        id: "project-claude".to_string(),
        scope: HookConfigTargetScope::Project,
        source: "claude-code".to_string(),
        label: "Project Claude".to_string(),
        project_path: Some("/workspace/project-a".to_string()),
        enabled: false,
    };

    let preview =
        HookConfigWriterService::preview_target(&target, &selections(), Path::new("/Users/alice"))
            .expect("preview should build");

    assert_eq!(
        "/workspace/project-a/.claude/settings.json",
        preview.config_path
    );
}

#[test]
fn writes_claude_settings_with_hooks_object() {
    let dir = std::env::temp_dir().join(format!(
        "cc-notice-write-claude-settings-{}",
        std::process::id()
    ));
    let result = HookConfigWriterService::write_target(
        &claude_target(),
        &selections(),
        &dir,
        "20260609T120000",
    )
    .expect("claude settings should be written");
    let config_path = dir.join(".claude").join("settings.json");
    let value: Value = serde_json::from_str(
        &file_config::read_to_string(&config_path).expect("written settings should be readable"),
    )
    .expect("written settings should be valid json");

    assert_eq!(config_path.to_string_lossy(), result.config_path);
    assert!(value["hooks"].is_object());
    assert_eq!(
        "cc-notice-relay --source claude-code --event SessionStart",
        value["hooks"]["SessionStart"][0]["hooks"][0]["command"]
    );
}

#[test]
fn claude_target_fixture_uses_claude_source() {
    assert_eq!("claude-code", claude_target().source);
}
