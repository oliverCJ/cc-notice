use std::path::Path;

use serde_json::{json, Value};

use crate::app_services::hook_config_writer::handlers::{
    is_managed_handler, managed_handler_with_relay,
};
use crate::core::hook_events::is_known_hook_event;

pub(crate) fn merge_config_for_source_with_relay(
    source: &str,
    mut existing: Value,
    events: &[String],
    relay_path: &Path,
    debug: bool,
) -> Result<Value, String> {
    for event in events {
        if !is_known_hook_event(source, event) {
            return Err(format!("unknown hook event for {source}: {event}"));
        }
    }

    if !existing.is_object() {
        existing = json!({});
    }
    let root = existing
        .as_object_mut()
        .ok_or_else(|| "hook config root must be a json object".to_string())?;
    let hooks_value = root.entry("hooks".to_string()).or_insert_with(|| json!({}));
    if !hooks_value.is_object() {
        return Err("hook config hooks field must be a json object".to_string());
    }
    let hooks = hooks_value
        .as_object_mut()
        .ok_or_else(|| "hook config hooks field must be a json object".to_string())?;

    remove_managed_handlers(source, hooks);
    for event in events {
        let groups_value = hooks.entry(event.clone()).or_insert_with(|| json!([]));
        if !groups_value.is_array() {
            return Err(format!("hook config event {event} must be an array"));
        }
        let groups = groups_value
            .as_array_mut()
            .ok_or_else(|| format!("hook config event {event} must be an array"))?;
        if groups.is_empty() {
            groups.push(json!({ "matcher": "", "hooks": [] }));
        }
        let first_group = groups
            .get_mut(0)
            .and_then(Value::as_object_mut)
            .ok_or_else(|| format!("hook config event {event} matcher group must be an object"))?;
        first_group
            .entry("matcher".to_string())
            .or_insert_with(|| json!(""));
        let handlers_value = first_group
            .entry("hooks".to_string())
            .or_insert_with(|| json!([]));
        if !handlers_value.is_array() {
            return Err(format!(
                "hook config event {event} hooks field must be an array"
            ));
        }
        handlers_value
            .as_array_mut()
            .ok_or_else(|| format!("hook config event {event} hooks field must be an array"))?
            .push(managed_handler_with_relay(source, event, relay_path, debug));
    }

    Ok(existing)
}

pub(crate) fn restore_config_for_source(
    source: &str,
    mut existing: Value,
) -> Result<Value, String> {
    if !existing.is_object() {
        existing = json!({});
    }
    let root = existing
        .as_object_mut()
        .ok_or_else(|| "hook config root must be a json object".to_string())?;
    let Some(hooks_value) = root.get_mut("hooks") else {
        return Ok(existing);
    };
    if !hooks_value.is_object() {
        return Err("hook config hooks field must be a json object".to_string());
    }
    let hooks = hooks_value
        .as_object_mut()
        .ok_or_else(|| "hook config hooks field must be a json object".to_string())?;
    remove_managed_handlers(source, hooks);
    Ok(existing)
}

pub(crate) fn managed_events(source: &str, existing: &Value) -> Vec<String> {
    existing
        .get("hooks")
        .and_then(Value::as_object)
        .map(|hooks| {
            hooks
                .iter()
                .filter_map(|(event, groups)| {
                    groups
                        .as_array()?
                        .iter()
                        .filter_map(Value::as_object)
                        .filter_map(|group| group.get("hooks").and_then(Value::as_array))
                        .flat_map(|handlers| handlers.iter())
                        .any(|handler| is_managed_handler(source, handler))
                        .then_some(event.clone())
                })
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn managed_commands(source: &str, existing: &Value) -> Vec<String> {
    existing
        .get("hooks")
        .and_then(Value::as_object)
        .map(|hooks| {
            hooks
                .values()
                .filter_map(Value::as_array)
                .flat_map(|groups| groups.iter())
                .filter_map(Value::as_object)
                .filter_map(|group| group.get("hooks").and_then(Value::as_array))
                .flat_map(|handlers| handlers.iter())
                .filter_map(|handler| {
                    if !is_managed_handler(source, handler) {
                        return None;
                    }
                    handler
                        .get("command")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
                .collect()
        })
        .unwrap_or_default()
}

fn remove_managed_handlers(source: &str, hooks: &mut serde_json::Map<String, Value>) {
    for groups_value in hooks.values_mut() {
        let Some(groups) = groups_value.as_array_mut() else {
            continue;
        };
        for group_value in groups {
            let Some(group) = group_value.as_object_mut() else {
                continue;
            };
            let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else {
                continue;
            };
            handlers.retain(|handler| !is_managed_handler(source, handler));
        }
    }
}
