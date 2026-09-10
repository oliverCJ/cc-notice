use std::path::Path;

use serde_json::{json, Value};

use super::codec::{HookConfigCodec, ManagedHookState};
use super::handlers::{command_has_debug, quote_relay_path, relay_event_from_command};

pub struct FlatHooksJsonCodec;

impl HookConfigCodec for FlatHooksJsonCodec {
    fn merge(
        &self,
        source: &str,
        mut existing: Value,
        events: &[String],
        relay_path: &Path,
        debug: bool,
    ) -> Result<Value, String> {
        if !existing.is_object() {
            existing = json!({});
        }
        let root = existing.as_object_mut().expect("object checked");
        root.entry("version").or_insert_with(|| json!(1));
        let hooks = root.entry("hooks").or_insert_with(|| json!({}));
        let hooks = hooks
            .as_object_mut()
            .ok_or_else(|| "hook config hooks field must be an object".to_string())?;
        remove_managed(source, hooks);
        for event in events {
            let handlers = hooks.entry(event.clone()).or_insert_with(|| json!([]));
            let handlers = handlers
                .as_array_mut()
                .ok_or_else(|| format!("hook config event {event} must be an array"))?;
            let debug_flag = if debug { " --debug" } else { "" };
            handlers.push(json!({
                "command": format!("{} --source {source} --event {event}{debug_flag}", quote_relay_path(relay_path))
            }));
        }
        Ok(existing)
    }

    fn restore(&self, source: &str, mut existing: Value) -> Result<Value, String> {
        if let Some(hooks) = existing.get_mut("hooks").and_then(Value::as_object_mut) {
            remove_managed(source, hooks);
        }
        Ok(existing)
    }

    fn inspect(
        &self,
        source: &str,
        existing: &Value,
        selected_events: &[String],
    ) -> Result<ManagedHookState, String> {
        let commands = managed_commands(source, existing);
        let configured_events = commands
            .iter()
            .filter_map(|command| relay_event_from_command(command, source))
            .collect::<Vec<_>>();
        Ok(ManagedHookState {
            has_managed_hooks: !commands.is_empty(),
            matches_selection: same_events(selected_events, &configured_events),
            debug_enabled: !commands.is_empty()
                && commands.iter().all(|command| command_has_debug(command)),
            configured_events,
            diagnostics: Vec::new(),
        })
    }

    fn validate(&self, _source: &str, value: &Value) -> Result<(), String> {
        if value.get("hooks").and_then(Value::as_object).is_none() {
            return Err("hook config validation failed: 'hooks' must be an object".to_string());
        }
        Ok(())
    }
}

fn managed_commands(source: &str, existing: &Value) -> Vec<String> {
    existing
        .get("hooks")
        .and_then(Value::as_object)
        .into_iter()
        .flat_map(|hooks| hooks.values())
        .filter_map(Value::as_array)
        .flat_map(|handlers| handlers.iter())
        .filter_map(|handler| handler.get("command").and_then(Value::as_str))
        .filter(|command| {
            command.contains("cc-notice-relay") && command.contains(&format!("--source {source}"))
        })
        .map(str::to_string)
        .collect()
}

fn remove_managed(source: &str, hooks: &mut serde_json::Map<String, Value>) {
    for handlers in hooks.values_mut().filter_map(Value::as_array_mut) {
        handlers.retain(|handler| {
            handler
                .get("command")
                .and_then(Value::as_str)
                .map(|command| {
                    !(command.contains("cc-notice-relay")
                        && command.contains(&format!("--source {source}")))
                })
                .unwrap_or(true)
        });
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
    fn writes_cursor_flat_event_array() {
        let value = FlatHooksJsonCodec
            .merge(
                "cursor",
                json!({"version":1}),
                &["sessionStart".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect("cursor config should merge");
        assert_eq!(
            "cc-notice-relay --source cursor --event sessionStart",
            value["hooks"]["sessionStart"][0]["command"]
        );
    }

    #[test]
    fn quotes_cursor_relay_path_with_spaces() {
        let value = FlatHooksJsonCodec
            .merge(
                "cursor",
                json!({}),
                &["sessionStart".to_string()],
                Path::new("/Users/alice/CC Notice/cc-notice-relay"),
                false,
            )
            .expect("cursor config should merge");

        assert_eq!(
            "'/Users/alice/CC Notice/cc-notice-relay' --source cursor --event sessionStart",
            value["hooks"]["sessionStart"][0]["command"]
        );
    }
}
