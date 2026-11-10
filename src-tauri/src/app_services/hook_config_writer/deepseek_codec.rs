use std::collections::HashSet;
use std::path::Path;

use serde_json::{json, Map, Value};

use crate::core::hook_events::is_known_hook_event;

use super::codec::{HookConfigCodec, ManagedHookState};
use super::handlers::{quote_relay_path, relay_event_from_command};

const SOURCE: &str = "deepseek-harness";
const VERSION: i64 = 1;
const DEFAULT_TIMEOUT_MS: i64 = 10_000;
const DEFAULT_MAX_CONCURRENT: i64 = 1;

pub struct DeepSeekHooksJsonCodec;

impl HookConfigCodec for DeepSeekHooksJsonCodec {
    fn merge(
        &self,
        source: &str,
        mut existing: Value,
        events: &[String],
        relay_path: &Path,
        debug: bool,
    ) -> Result<Value, String> {
        ensure_source(source)?;
        validate_events(events, source)?;
        if !existing.is_object() {
            existing = json!({});
        }

        let root = existing
            .as_object_mut()
            .ok_or_else(|| "deepseek hook config root must be an object".to_string())?;
        root.insert("version".to_string(), json!(VERSION));
        let hooks = root.entry("hooks".to_string()).or_insert_with(|| json!({}));
        let hooks = hooks
            .as_object_mut()
            .ok_or_else(|| "deepseek hook config hooks must be an object".to_string())?;

        remove_managed_hooks(hooks);
        for event in events {
            let id = managed_id(event);
            if contains_hook_id(hooks, &id) {
                return Err(format!(
                    "deepseek hook id is already owned by another hook: {id}"
                ));
            }
            let groups = hooks.entry(event.clone()).or_insert_with(|| json!([]));
            let groups = groups
                .as_array_mut()
                .ok_or_else(|| format!("deepseek event {event} must contain matcher groups"))?;
            let group = empty_matcher_group(groups, event)?;
            let command = format!(
                "{} --source {source} --event {event}{}",
                quote_relay_path(relay_path),
                if debug { " --debug" } else { "" }
            );
            group
                .get_mut("hooks")
                .and_then(Value::as_array_mut)
                .ok_or_else(|| {
                    format!("deepseek event {event} matcher group hooks must be an array")
                })?
                .push(json!({
                    "id": id,
                    "type": "command",
                    "command": command,
                    "enabled": true,
                    "timeoutMs": DEFAULT_TIMEOUT_MS,
                    "maxConcurrent": DEFAULT_MAX_CONCURRENT
                }));
        }

        Ok(existing)
    }

    fn restore(&self, source: &str, mut existing: Value) -> Result<Value, String> {
        ensure_source(source)?;
        if let Some(hooks) = existing.get_mut("hooks").and_then(Value::as_object_mut) {
            remove_managed_hooks(hooks);
        }
        Ok(existing)
    }

    fn inspect(
        &self,
        source: &str,
        existing: &Value,
        selected_events: &[String],
    ) -> Result<ManagedHookState, String> {
        ensure_source(source)?;
        let configured_events = existing
            .get("hooks")
            .and_then(Value::as_object)
            .map(|hooks| {
                hooks
                    .iter()
                    .filter_map(|(event, groups)| {
                        groups
                            .as_array()?
                            .iter()
                            .filter(|group| is_empty_matcher_group(group))
                            .any(|group| {
                                group
                                    .get("hooks")
                                    .and_then(Value::as_array)
                                    .map(|items| {
                                        items.iter().any(|hook| is_managed_hook(event, hook))
                                    })
                                    .unwrap_or(false)
                            })
                            .then_some(event.clone())
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let managed_commands = managed_commands(existing);
        let debug_enabled = !managed_commands.is_empty()
            && managed_commands
                .iter()
                .all(|command| command.split_whitespace().any(|part| part == "--debug"));
        Ok(ManagedHookState {
            has_managed_hooks: !configured_events.is_empty(),
            configured_events: configured_events.clone(),
            debug_enabled,
            matches_selection: same_events(selected_events, &configured_events),
            diagnostics: Vec::new(),
        })
    }

    fn validate(&self, source: &str, value: &Value) -> Result<(), String> {
        ensure_source(source)?;
        let root = value
            .as_object()
            .ok_or_else(|| "deepseek hook config root must be an object".to_string())?;
        if root.get("version").and_then(Value::as_i64) != Some(VERSION) {
            return Err("deepseek hook config version must be 1".to_string());
        }
        let hooks = root
            .get("hooks")
            .and_then(Value::as_object)
            .ok_or_else(|| "deepseek hook config hooks must be an object".to_string())?;
        let mut ids = HashSet::new();
        for (event, groups) in hooks {
            // Preserve extension events as opaque user configuration.
            if !is_known_hook_event(SOURCE, event) {
                continue;
            }
            let groups = groups
                .as_array()
                .ok_or_else(|| format!("deepseek event {event} must contain matcher groups"))?;
            for group in groups {
                let group = group.as_object().ok_or_else(|| {
                    format!("deepseek event {event} matcher group must be an object")
                })?;
                if let Some(matcher) = group.get("matcher") {
                    if !matcher.is_string() {
                        return Err(format!("deepseek event {event} matcher must be a string"));
                    }
                }
                let hooks = group
                    .get("hooks")
                    .and_then(Value::as_array)
                    .ok_or_else(|| {
                        format!(
                            "deepseek event {event} matcher group hooks must be a non-empty array"
                        )
                    })?;
                if hooks.is_empty() {
                    return Err(format!(
                        "deepseek event {event} matcher group hooks must be a non-empty array"
                    ));
                }
                for hook in hooks {
                    validate_hook(event, hook, &mut ids)?;
                }
            }
        }
        Ok(())
    }
}

fn validate_hook(event: &str, value: &Value, ids: &mut HashSet<String>) -> Result<(), String> {
    let hook = value
        .as_object()
        .ok_or_else(|| format!("deepseek event {event} hook must be an object"))?;
    if hook.get("type").and_then(Value::as_str) != Some("command") {
        return Ok(());
    }
    let id = hook
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .ok_or_else(|| format!("deepseek event {event} hook id must be non-empty"))?;
    if !ids.insert(id.to_string()) {
        return Err(format!("duplicate deepseek hook id: {id}"));
    }
    if hook
        .get("command")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|command| !command.is_empty())
        .is_none()
    {
        return Err(format!("deepseek hook {id} command must be non-empty"));
    }
    if let Some(enabled) = hook.get("enabled") {
        if !enabled.is_boolean() {
            return Err(format!("deepseek hook {id} enabled must be a boolean"));
        }
    }
    validate_integer(hook, "timeoutMs", 100, 60_000, id)?;
    validate_integer(hook, "maxConcurrent", 1, 4, id)
}

fn validate_integer(
    hook: &Map<String, Value>,
    field: &str,
    minimum: i64,
    maximum: i64,
    id: &str,
) -> Result<(), String> {
    let Some(value) = hook.get(field) else {
        return Ok(());
    };
    let number = value
        .as_i64()
        .ok_or_else(|| format!("deepseek hook {id} {field} must be an integer"))?;
    if !(minimum..=maximum).contains(&number) {
        return Err(format!(
            "deepseek hook {id} {field} must be between {minimum} and {maximum}"
        ));
    }
    Ok(())
}

fn empty_matcher_group<'a>(
    groups: &'a mut Vec<Value>,
    event: &str,
) -> Result<&'a mut Map<String, Value>, String> {
    let group_index = groups.iter().position(|group| {
        group
            .as_object()
            .map(|object| {
                object
                    .get("matcher")
                    .and_then(Value::as_str)
                    .map(str::is_empty)
                    .unwrap_or(true)
            })
            .unwrap_or(false)
    });
    let group_index = group_index.unwrap_or_else(|| {
        groups.push(json!({"matcher": "", "hooks": []}));
        groups.len() - 1
    });
    groups[group_index]
        .as_object_mut()
        .ok_or_else(|| format!("deepseek event {event} matcher group must be an object"))
}

fn is_empty_matcher_group(group: &Value) -> bool {
    group
        .get("matcher")
        .and_then(Value::as_str)
        .map(str::is_empty)
        .unwrap_or(true)
}

fn remove_managed_hooks(hooks: &mut Map<String, Value>) {
    for (event, groups) in hooks.iter_mut() {
        let Some(groups) = groups.as_array_mut() else {
            continue;
        };
        let mut retained_groups = Vec::with_capacity(groups.len());
        for mut group in groups.drain(..) {
            if is_empty_matcher_group(&group) {
                if let Some(items) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                    let had_managed_hook = items.iter().any(|hook| is_managed_hook(event, hook));
                    items.retain(|hook| !is_managed_hook(event, hook));
                    if had_managed_hook && items.is_empty() {
                        continue;
                    }
                }
            }
            retained_groups.push(group);
        }
        *groups = retained_groups;
    }
}

fn contains_hook_id(hooks: &Map<String, Value>, id: &str) -> bool {
    hooks.values().any(|groups| {
        groups
            .as_array()
            .map(|groups| {
                groups.iter().any(|group| {
                    group
                        .get("hooks")
                        .and_then(Value::as_array)
                        .map(|items| {
                            items
                                .iter()
                                .any(|hook| hook.get("id").and_then(Value::as_str) == Some(id))
                        })
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false)
    })
}

fn is_managed_hook(event: &str, hook: &Value) -> bool {
    let Some(id) = hook.get("id").and_then(Value::as_str) else {
        return false;
    };
    let Some(command) = hook.get("command").and_then(Value::as_str) else {
        return false;
    };
    id == managed_id(event)
        && hook.get("type").and_then(Value::as_str) == Some("command")
        && relay_event_from_command(command, SOURCE).as_deref() == Some(event)
}

fn managed_commands(existing: &Value) -> Vec<String> {
    let mut commands = Vec::new();
    let Some(hooks) = existing.get("hooks").and_then(Value::as_object) else {
        return commands;
    };
    for (event, groups) in hooks {
        let Some(groups) = groups.as_array() else {
            continue;
        };
        for group in groups.iter().filter(|group| is_empty_matcher_group(group)) {
            let Some(items) = group.get("hooks").and_then(Value::as_array) else {
                continue;
            };
            for hook in items {
                if is_managed_hook(event, hook) {
                    if let Some(command) = hook.get("command").and_then(Value::as_str) {
                        commands.push(command.to_string());
                    }
                }
            }
        }
    }
    commands
}

fn validate_events(events: &[String], source: &str) -> Result<(), String> {
    for event in events {
        if !is_known_hook_event(source, event) {
            return Err(format!("unknown hook event for {source}: {event}"));
        }
    }
    Ok(())
}

fn ensure_source(source: &str) -> Result<(), String> {
    if source == SOURCE {
        Ok(())
    } else {
        Err(format!("deepseek codec cannot handle source: {source}"))
    }
}

// IDs are deterministic so repeated settings writes update the same managed Hook.
fn managed_id(event: &str) -> String {
    format!("cc-notice-deepseek-{event}")
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

    #[test]
    fn merge_generates_stable_command_hook_and_preserves_user_hook() {
        let value = DeepSeekHooksJsonCodec
            .merge(
                SOURCE,
                json!({
                    "version": 1,
                    "userSetting": true,
                    "hooks": {
                        "Stop": [{"matcher": "", "hooks": [{"id": "user-stop", "type": "command", "command": "user-command"}]}]
                    }
                }),
                &["Stop".to_string()],
                Path::new("/Users/alice/.cc notice/cc-notice-relay"),
                false,
            )
            .expect("DeepSeek config should merge");

        assert_eq!(true, value["userSetting"]);
        assert_eq!(
            "user-command",
            value["hooks"]["Stop"][0]["hooks"][0]["command"]
        );
        assert_eq!(
            "cc-notice-deepseek-Stop",
            value["hooks"]["Stop"][0]["hooks"][1]["id"]
        );
        assert_eq!(
            "'/Users/alice/.cc notice/cc-notice-relay' --source deepseek-harness --event Stop",
            value["hooks"]["Stop"][0]["hooks"][1]["command"]
        );
    }

    #[test]
    fn merge_generates_compaction_event_hooks() {
        let events = [
            "PreCompact".to_string(),
            "PostCompact".to_string(),
            "PostCompactFailure".to_string(),
        ];
        let value = DeepSeekHooksJsonCodec
            .merge(
                SOURCE,
                json!({"hooks": {}}),
                &events,
                Path::new("cc-notice-relay"),
                false,
            )
            .expect("compaction events should be accepted");

        for event in ["PreCompact", "PostCompact", "PostCompactFailure"] {
            assert_eq!(
                format!("cc-notice-deepseek-{event}"),
                value["hooks"][event][0]["hooks"][0]["id"]
            );
            assert_eq!(
                format!("cc-notice-relay --source deepseek-harness --event {event}"),
                value["hooks"][event][0]["hooks"][0]["command"]
            );
        }
    }

    #[test]
    fn merge_rejects_user_owned_managed_id() {
        let error = DeepSeekHooksJsonCodec
            .merge(
                SOURCE,
                json!({
                    "hooks": {
                        "Stop": [{"hooks": [{"id": "cc-notice-deepseek-Stop", "type": "command", "command": "user-command"}]}]
                    }
                }),
                &["Stop".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect_err("user-owned managed id must not be overwritten");

        assert!(error.contains("already owned by another hook"));
    }

    #[test]
    fn validate_rejects_invalid_deepseek_hook_schema() {
        let value = json!({
            "version": 1,
            "hooks": {
                "Stop": [{"hooks": [{"id": "bad", "type": "command", "command": "run", "timeoutMs": 99}]}]
            }
        });

        let error = DeepSeekHooksJsonCodec
            .validate(SOURCE, &value)
            .expect_err("timeout below plugin minimum must fail");
        assert!(error.contains("timeoutMs must be between 100 and 60000"));
    }

    #[test]
    fn restore_removes_only_managed_hooks() {
        let value = DeepSeekHooksJsonCodec
            .restore(
                SOURCE,
                json!({
                    "hooks": {
                        "Stop": [{"hooks": [
                            {"id": "user-stop", "type": "command", "command": "user-command"},
                            {"id": "cc-notice-deepseek-Stop", "type": "command", "command": "cc-notice-relay --source deepseek-harness --event Stop"}
                        ]}]
                    }
                }),
            )
            .expect("restore should succeed");

        assert_eq!(
            1,
            value["hooks"]["Stop"][0]["hooks"].as_array().unwrap().len()
        );
        assert_eq!("user-stop", value["hooks"]["Stop"][0]["hooks"][0]["id"]);
    }

    #[test]
    fn restore_removes_compaction_hooks_and_preserves_other_configuration() {
        let value = DeepSeekHooksJsonCodec
            .restore(
                SOURCE,
                json!({
                    "hooks": {
                        "PreCompact": [{"matcher": "", "hooks": [
                            {"id": "user-pre", "type": "command", "command": "user-command"},
                            {"id": "cc-notice-deepseek-PreCompact", "type": "command", "command": "cc-notice-relay --source deepseek-harness --event PreCompact"}
                        ]}],
                        "PostCompactFailure": [{"matcher": "tool-a", "hooks": [
                            {"id": "cc-notice-deepseek-PostCompactFailure", "type": "command", "command": "cc-notice-relay --source deepseek-harness --event PostCompactFailure"}
                        ]}],
                        "FutureEvent": [{"hooks": [{"id": "future", "type": "script", "path": "future-script"}]}]
                    }
                }),
            )
            .expect("restore should succeed");

        assert_eq!(
            "user-pre",
            value["hooks"]["PreCompact"][0]["hooks"][0]["id"]
        );
        assert_eq!(
            "cc-notice-deepseek-PostCompactFailure",
            value["hooks"]["PostCompactFailure"][0]["hooks"][0]["id"]
        );
        assert_eq!(
            "future-script",
            value["hooks"]["FutureEvent"][0]["hooks"][0]["path"]
        );
    }

    #[test]
    fn restore_removes_empty_matcher_groups_after_managed_hook_cleanup() {
        let value = DeepSeekHooksJsonCodec
            .restore(
                SOURCE,
                json!({
                    "hooks": {
                        "Stop": [{"matcher": "", "hooks": [
                            {"id": "cc-notice-deepseek-Stop", "type": "command", "command": "cc-notice-relay --source deepseek-harness --event Stop"}
                        ]}]
                    }
                }),
            )
            .expect("restore should succeed");

        assert_eq!(0, value["hooks"]["Stop"].as_array().unwrap().len());
    }

    #[test]
    fn restore_preserves_preexisting_empty_user_matcher_groups() {
        let value = DeepSeekHooksJsonCodec
            .restore(
                SOURCE,
                json!({
                    "hooks": {
                        "Stop": [{"matcher": "", "hooks": []}]
                    }
                }),
            )
            .expect("restore should succeed");

        assert_eq!(1, value["hooks"]["Stop"].as_array().unwrap().len());
        assert!(value["hooks"]["Stop"][0]["hooks"]
            .as_array()
            .unwrap()
            .is_empty());
    }

    #[test]
    fn validate_preserves_unknown_events_and_non_command_user_hooks() {
        let value = json!({
            "version": 1,
            "hooks": {
                "FutureEvent": [{"hooks": [{"id": "user-future", "type": "script", "path": "user-script"}]}]
            }
        });

        DeepSeekHooksJsonCodec
            .validate(SOURCE, &value)
            .expect("opaque user hooks must remain writable");
    }

    #[test]
    fn restore_preserves_managed_id_in_non_empty_matcher_group() {
        let value = DeepSeekHooksJsonCodec
            .restore(
                SOURCE,
                json!({
                    "hooks": {
                        "Stop": [{"matcher": "tool-a", "hooks": [
                            {"id": "cc-notice-deepseek-Stop", "type": "command", "command": "cc-notice-relay --source deepseek-harness --event Stop"}
                        ]}]
                    }
                }),
            )
            .expect("restore should preserve non-empty matcher groups");

        assert_eq!(
            "cc-notice-deepseek-Stop",
            value["hooks"]["Stop"][0]["hooks"][0]["id"]
        );
    }

    #[test]
    fn inspect_disables_debug_when_no_managed_hooks_exist() {
        let state = DeepSeekHooksJsonCodec
            .inspect(SOURCE, &json!({"version": 1, "hooks": {}}), &[])
            .expect("inspect should succeed");

        assert!(!state.debug_enabled);
        assert!(!state.has_managed_hooks);
    }

    #[test]
    fn rejects_duplicate_ids() {
        let value = json!({
            "version": 1,
            "hooks": {
                "Stop": [{"hooks": [{"id": "same", "type": "command", "command": "a"}]}],
                "SessionEnd": [{"hooks": [{"id": "same", "type": "command", "command": "b"}]}]
            }
        });
        assert!(DeepSeekHooksJsonCodec.validate(SOURCE, &value).is_err());
    }
}
