use std::path::Path;

use serde_json::{json, Value};

use super::codec::{HookConfigCodec, ManagedHookState};
use super::handlers::quote_relay_path;

pub struct CopilotHooksJsonCodec;

impl HookConfigCodec for CopilotHooksJsonCodec {
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
        ensure_owned_or_empty(source, &existing)?;
        let root = existing.as_object_mut().expect("object checked");
        root.insert("version".to_string(), json!(1));
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
            let command = format!(
                "{} --source {source} --event {event}{debug_flag}",
                quote_relay_path(relay_path)
            );
            handlers.push(json!({
                "type": "command",
                "bash": command,
                "powershell": format!("{} --source {source} --event {event}{debug_flag}", quote_relay_path(relay_path)),
                "timeoutSec": 30
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
        let configured_events = existing
            .get("hooks")
            .and_then(Value::as_object)
            .into_iter()
            .flat_map(|hooks| hooks.iter())
            .filter_map(|(event, value)| {
                value
                    .as_array()?
                    .iter()
                    .any(|handler| is_managed(source, handler))
                    .then_some(event.clone())
            })
            .collect::<Vec<_>>();
        Ok(ManagedHookState {
            has_managed_hooks: !configured_events.is_empty(),
            matches_selection: same_events(selected_events, &configured_events),
            debug_enabled: false,
            configured_events,
            diagnostics: Vec::new(),
        })
    }

    fn validate(&self, _source: &str, value: &Value) -> Result<(), String> {
        if value.get("version").and_then(Value::as_i64) != Some(1) {
            return Err("copilot hook config version must be 1".to_string());
        }
        if value.get("hooks").and_then(Value::as_object).is_none() {
            return Err("copilot hook config hooks must be an object".to_string());
        }
        Ok(())
    }

    fn delete_file_after_restore(&self, value: &Value) -> bool {
        let Some(root) = value.as_object() else {
            return false;
        };
        root.keys().all(|key| key == "version" || key == "hooks")
            && root
                .get("hooks")
                .and_then(Value::as_object)
                .map(|hooks| {
                    hooks
                        .values()
                        .all(|handlers| handlers.as_array().map(Vec::is_empty).unwrap_or(false))
                })
                .unwrap_or(true)
    }
}

fn is_managed(source: &str, handler: &Value) -> bool {
    ["bash", "powershell", "command"]
        .iter()
        .filter_map(|key| handler.get(*key).and_then(Value::as_str))
        .any(|command| {
            command.contains("cc-notice-relay") && command.contains(&format!("--source {source}"))
        })
}

fn remove_managed(source: &str, hooks: &mut serde_json::Map<String, Value>) {
    for handlers in hooks.values_mut().filter_map(Value::as_array_mut) {
        handlers.retain(|handler| !is_managed(source, handler));
    }
}

fn ensure_owned_or_empty(source: &str, existing: &Value) -> Result<(), String> {
    let Some(root) = existing.as_object() else {
        return Err("copilot hook config must be a JSON object".to_string());
    };
    let has_user_root_fields = root.keys().any(|key| key != "version" && key != "hooks");
    let has_user_hooks = root
        .get("hooks")
        .and_then(Value::as_object)
        .map(|hooks| {
            hooks.values().any(|handlers| {
                handlers
                    .as_array()
                    .map(|items| items.iter().any(|item| !is_managed(source, item)))
                    .unwrap_or(true)
            })
        })
        .unwrap_or(false);
    if has_user_root_fields || has_user_hooks {
        return Err(
            "copilot hook file contains non-CC Notice hooks and cannot be taken over".to_string(),
        );
    }
    Ok(())
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
    fn writes_bash_and_powershell_commands() {
        let value = CopilotHooksJsonCodec
            .merge(
                "github-copilot-cli",
                json!({}),
                &["sessionStart".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect("merge should work");
        let handler = &value["hooks"]["sessionStart"][0];
        assert_eq!("command", handler["type"]);
        assert!(handler["bash"]
            .as_str()
            .unwrap()
            .contains("--source github-copilot-cli"));
        assert!(handler["powershell"]
            .as_str()
            .unwrap()
            .contains("--source github-copilot-cli"));
    }

    #[test]
    fn refuses_to_take_over_file_with_user_hook() {
        let error = CopilotHooksJsonCodec
            .merge(
                "github-copilot-cli",
                json!({"version": 1, "hooks": {"sessionStart": [{"bash": "user-hook"}]}}),
                &["sessionStart".to_string()],
                Path::new("cc-notice-relay"),
                false,
            )
            .expect_err("user hook file should not be taken over");
        assert!(error.contains("cannot be taken over"));
    }
}
