use std::path::Path;

use serde_json::Value;

use crate::adapters::ai_tools::definition::HookConfigCodecKind;

use super::copilot_codec::CopilotHooksJsonCodec;
use super::flat_codec::FlatHooksJsonCodec;
use super::{merge, validation};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ManagedHookState {
    pub has_managed_hooks: bool,
    pub configured_events: Vec<String>,
    pub debug_enabled: bool,
    pub matches_selection: bool,
    pub diagnostics: Vec<String>,
}

pub trait HookConfigCodec {
    fn merge(
        &self,
        source: &str,
        existing: Value,
        events: &[String],
        relay_path: &Path,
        debug: bool,
    ) -> Result<Value, String>;
    fn restore(&self, source: &str, existing: Value) -> Result<Value, String>;
    fn inspect(
        &self,
        source: &str,
        existing: &Value,
        selected_events: &[String],
    ) -> Result<ManagedHookState, String>;
    fn validate(&self, source: &str, value: &Value) -> Result<(), String>;
    fn delete_file_after_restore(&self, _value: &Value) -> bool {
        false
    }
}

pub struct MatcherGroupJsonCodec;

impl HookConfigCodec for MatcherGroupJsonCodec {
    fn merge(
        &self,
        source: &str,
        existing: Value,
        events: &[String],
        relay_path: &Path,
        debug: bool,
    ) -> Result<Value, String> {
        merge::merge_config_for_source_with_relay(source, existing, events, relay_path, debug)
    }

    fn restore(&self, source: &str, existing: Value) -> Result<Value, String> {
        merge::restore_config_for_source(source, existing)
    }

    fn inspect(
        &self,
        source: &str,
        existing: &Value,
        selected_events: &[String],
    ) -> Result<ManagedHookState, String> {
        let configured_events = merge::managed_events(source, existing);
        let debug_enabled = merge::managed_commands(source, existing)
            .iter()
            .all(|command| super::handlers::command_has_debug(command));
        Ok(ManagedHookState {
            has_managed_hooks: !configured_events.is_empty(),
            matches_selection: same_events(selected_events, &configured_events),
            configured_events,
            debug_enabled,
            diagnostics: Vec::new(),
        })
    }

    fn validate(&self, source: &str, value: &Value) -> Result<(), String> {
        validation::validate_written_config(value, source)
    }
}

pub fn codec_for_kind(kind: HookConfigCodecKind) -> &'static dyn HookConfigCodec {
    static MATCHER_GROUP: MatcherGroupJsonCodec = MatcherGroupJsonCodec;
    match kind {
        HookConfigCodecKind::MatcherGroupJson => &MATCHER_GROUP,
        HookConfigCodecKind::FlatHooksJson => {
            static FLAT: FlatHooksJsonCodec = FlatHooksJsonCodec;
            &FLAT
        }
        HookConfigCodecKind::CopilotHooksJson => {
            static COPILOT: CopilotHooksJsonCodec = CopilotHooksJsonCodec;
            &COPILOT
        }
        HookConfigCodecKind::DeepSeekJson => {
            static DEEPSEEK: super::deepseek_codec::DeepSeekHooksJsonCodec =
                super::deepseek_codec::DeepSeekHooksJsonCodec;
            &DEEPSEEK
        }
    }
}

fn same_events(left: &[String], right: &[String]) -> bool {
    let mut left = left.to_vec();
    let mut right = right.to_vec();
    left.sort();
    right.sort();
    left.dedup();
    right.dedup();
    left == right
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn matcher_group_codec_preserves_existing_contract() {
        let codec = MatcherGroupJsonCodec;
        let value = codec
            .merge(
                "codex",
                json!({"name":"user"}),
                &["SessionStart".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect("merge should work");
        let state = codec
            .inspect("codex", &value, &["SessionStart".to_string()])
            .expect("inspect should work");

        assert!(state.has_managed_hooks);
        assert!(state.matches_selection);
        assert_eq!(Some(&json!("user")), value.get("name"));
    }

    #[test]
    fn deepseek_codec_writes_versioned_command_hooks_and_preserves_user_hooks() {
        let codec = super::super::deepseek_codec::DeepSeekHooksJsonCodec;
        let value = codec
            .merge(
                "deepseek-harness",
                json!({
                    "custom": true,
                    "hooks": {
                        "Stop": [{"matcher": "special", "hooks": [{"id": "user-stop", "type": "command", "command": "user-hook"}]}]
                    }
                }),
                &["Stop".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect("deepseek merge should work");

        assert_eq!(Some(&json!(1)), value.get("version"));
        assert_eq!(Some(&json!(true)), value.get("custom"));
        assert_eq!(
            Some(&json!("user-stop")),
            value["hooks"]["Stop"][0]["hooks"][0].get("id")
        );
        let managed = &value["hooks"]["Stop"]
            .as_array()
            .expect("Stop groups should be an array")[1]["hooks"][0];
        assert_eq!("command", managed["type"]);
        assert_eq!("cc-notice-deepseek-Stop", managed["id"]);
        assert_eq!(10_000, managed["timeoutMs"]);
        assert_eq!(1, managed["maxConcurrent"]);

        codec
            .validate("deepseek-harness", &value)
            .expect("schema should validate");
    }

    #[test]
    fn deepseek_codec_restore_removes_only_managed_hooks() {
        let codec = super::super::deepseek_codec::DeepSeekHooksJsonCodec;
        let merged = codec
            .merge(
                "deepseek-harness",
                json!({}),
                &["SessionEnd".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect("deepseek merge should work");
        let restored = codec
            .restore("deepseek-harness", merged)
            .expect("deepseek restore should work");
        assert_eq!(
            0,
            restored["hooks"]["SessionEnd"]
                .as_array()
                .expect("SessionEnd groups should remain an array")
                .len()
        );
    }
}
