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
}
