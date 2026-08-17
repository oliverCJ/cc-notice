use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::core::hook_events::is_known_hook_event;
use crate::core::profiles::{
    default_device_profile, AiEventMapping, DeviceProfile, EnabledHookEvent, HardwareOutputType,
    HardwareRule, NoticeProfile, DEFAULT_PROFILE_ID,
};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRepairReport {
    pub repaired_profile_identity: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub isolated_unrecoverable_profile_id: Option<String>,
    pub removed_enabled_hook_events: usize,
    pub removed_ai_event_mappings: usize,
    pub removed_hardware_rules: usize,
    pub reset_device: bool,
}

impl ProfileRepairReport {
    pub fn changed(&self) -> bool {
        self.removed_enabled_hook_events > 0
            || self.removed_ai_event_mappings > 0
            || self.removed_hardware_rules > 0
            || self.repaired_profile_identity
            || self.isolated_unrecoverable_profile_id.is_some()
            || self.reset_device
    }

    pub fn with_unrecoverable_profile(profile_id: &str) -> Self {
        Self {
            isolated_unrecoverable_profile_id: Some(profile_id.to_string()),
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfileRepairResult {
    pub content: String,
    pub report: ProfileRepairReport,
}

pub fn repair_profile_content(
    content: &str,
    fallback_profile_id: Option<&str>,
    valid_event_ids: &HashSet<String>,
) -> Result<ProfileRepairResult, String> {
    let mut value = serde_json::from_str::<Value>(content).map_err(|error| error.to_string())?;
    let Some(object) = value.as_object_mut() else {
        return Err("profile root must be a JSON object".to_string());
    };

    let mut report = ProfileRepairReport::default();
    repair_profile_identity(object, fallback_profile_id, &mut report);
    repair_enabled_hook_events(object, &mut report);
    repair_ai_event_mappings(object, valid_event_ids, &mut report);
    repair_hardware_rules(object, valid_event_ids, &mut report);
    repair_device_profile(object, &mut report);

    let profile =
        serde_json::from_value::<NoticeProfile>(value).map_err(|error| error.to_string())?;
    profile.validate_with_internal_events(valid_event_ids)?;
    let content = serde_json::to_string_pretty(&profile).map_err(|error| error.to_string())?;

    Ok(ProfileRepairResult { content, report })
}

fn repair_profile_identity(
    profile: &mut Map<String, Value>,
    fallback_profile_id: Option<&str>,
    report: &mut ProfileRepairReport,
) {
    let fallback_id = fallback_profile_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(DEFAULT_PROFILE_ID);
    let id_is_valid = profile
        .get("id")
        .and_then(Value::as_str)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    if !id_is_valid {
        profile.insert("id".to_string(), Value::String(fallback_id.to_string()));
        report.repaired_profile_identity = true;
    }

    let name_is_valid = profile
        .get("name")
        .and_then(Value::as_str)
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    if !name_is_valid {
        profile.insert("name".to_string(), Value::String(fallback_id.to_string()));
        report.repaired_profile_identity = true;
    }
}

fn repair_enabled_hook_events(
    profile: &mut Map<String, Value>,
    report: &mut ProfileRepairReport,
) -> HashSet<(String, String)> {
    let (raw_events, invalid_section) = take_array(profile, "enabledHookEvents");
    let original_len = raw_events.len() + usize::from(invalid_section);
    let mut event_keys = HashSet::new();
    let mut repaired_events = Vec::new();

    for raw_event in raw_events {
        let Ok(event) = serde_json::from_value::<EnabledHookEvent>(raw_event.clone()) else {
            continue;
        };
        let key = (event.source.clone(), event.event.clone());
        if is_known_hook_event(&event.source, &event.event) && event_keys.insert(key) {
            repaired_events.push(raw_event);
        }
    }

    report.removed_enabled_hook_events = original_len.saturating_sub(repaired_events.len());
    profile.insert(
        "enabledHookEvents".to_string(),
        Value::Array(repaired_events),
    );
    event_keys
}

fn repair_ai_event_mappings(
    profile: &mut Map<String, Value>,
    valid_event_ids: &HashSet<String>,
    report: &mut ProfileRepairReport,
) {
    let (raw_mappings, invalid_section) = take_array(profile, "aiEventMappings");
    let original_len = raw_mappings.len() + usize::from(invalid_section);
    let mut mapping_ids = HashSet::new();
    let mut mapping_keys = HashSet::new();
    let mut repaired_mappings = Vec::new();

    for mut raw_mapping in raw_mappings {
        migrate_legacy_internal_event_value(&mut raw_mapping);
        let Ok(mapping) = serde_json::from_value::<AiEventMapping>(raw_mapping.clone()) else {
            continue;
        };
        let mapping_key = (mapping.source.clone(), mapping.event.clone());
        if mapping.id.trim().is_empty()
            || !is_known_hook_event(&mapping.source, &mapping.event)
            || !valid_event_ids.contains(&mapping.internal_event)
        {
            continue;
        }
        if !mapping_ids.insert(mapping.id.clone()) || !mapping_keys.insert(mapping_key) {
            continue;
        }
        repaired_mappings.push(raw_mapping);
    }

    report.removed_ai_event_mappings = original_len.saturating_sub(repaired_mappings.len());
    profile.insert(
        "aiEventMappings".to_string(),
        Value::Array(repaired_mappings),
    );
}

fn repair_hardware_rules(
    profile: &mut Map<String, Value>,
    valid_event_ids: &HashSet<String>,
    report: &mut ProfileRepairReport,
) {
    let (raw_rules, invalid_section) = take_array(profile, "hardwareRules");
    let original_len = raw_rules.len() + usize::from(invalid_section);
    let mut rule_ids = HashSet::new();
    let mut rule_keys = HashSet::<(String, HardwareOutputType)>::new();
    let mut enabled_counts = HashMap::<String, usize>::new();
    let mut repaired_rules = Vec::new();

    for mut raw_rule in raw_rules {
        migrate_legacy_internal_event_value(&mut raw_rule);
        let Ok(rule) = serde_json::from_value::<HardwareRule>(raw_rule.clone()) else {
            continue;
        };
        let rule_key = (rule.internal_event.clone(), rule.output.output_type);
        if rule.id.trim().is_empty()
            || !valid_event_ids.contains(&rule.internal_event)
            || !hardware_rule_is_valid(&rule, valid_event_ids)
        {
            continue;
        }
        if !rule_ids.insert(rule.id.clone()) || !rule_keys.insert(rule_key) {
            continue;
        }
        if exceeds_enabled_hardware_rule_limit(&rule, &mut enabled_counts) {
            continue;
        }
        repaired_rules.push(raw_rule);
    }

    report.removed_hardware_rules = original_len.saturating_sub(repaired_rules.len());
    profile.insert("hardwareRules".to_string(), Value::Array(repaired_rules));
}

fn repair_device_profile(profile: &mut Map<String, Value>, report: &mut ProfileRepairReport) {
    let Some(device_value) = profile.get("device").cloned() else {
        return;
    };
    let Ok(device) = serde_json::from_value::<DeviceProfile>(device_value) else {
        set_default_device_profile(profile);
        report.reset_device = true;
        return;
    };
    if device.board_id.trim().is_empty() || device.transport.trim().is_empty() {
        set_default_device_profile(profile);
        report.reset_device = true;
    }
}

fn take_array(profile: &mut Map<String, Value>, key: &str) -> (Vec<Value>, bool) {
    match profile.remove(key) {
        Some(Value::Array(items)) => (items, false),
        Some(_) => (Vec::new(), true),
        None => (Vec::new(), false),
    }
}

fn migrate_legacy_internal_event_value(value: &mut Value) {
    let Some(object) = value.as_object_mut() else {
        return;
    };
    let Some(internal_event) = object
        .get("internalEvent")
        .and_then(Value::as_str)
        .and_then(migrated_internal_event)
    else {
        return;
    };
    object.insert(
        "internalEvent".to_string(),
        Value::String(internal_event.to_string()),
    );
}

fn migrated_internal_event(event: &str) -> Option<&'static str> {
    match event {
        "session.started" => Some("agent.started"),
        "agent.running" => Some("agent.working"),
        _ => None,
    }
}

fn exceeds_enabled_hardware_rule_limit(
    rule: &HardwareRule,
    enabled_counts: &mut HashMap<String, usize>,
) -> bool {
    if !rule.enabled {
        return false;
    }
    let count = enabled_counts
        .entry(rule.internal_event.clone())
        .and_modify(|value| *value += 1)
        .or_insert(1);
    *count > 3
}

fn hardware_rule_is_valid(rule: &HardwareRule, valid_event_ids: &HashSet<String>) -> bool {
    NoticeProfile {
        id: "repair-check".to_string(),
        name: "Repair Check".to_string(),
        enabled_hook_events: Vec::new(),
        ai_event_mappings: Vec::new(),
        hardware_rules: vec![rule.clone()],
        device: default_device_profile(),
    }
    .validate_with_internal_events(valid_event_ids)
    .is_ok()
}

fn set_default_device_profile(profile: &mut Map<String, Value>) {
    let value = serde_json::to_value(default_device_profile())
        .expect("default device profile should serialize");
    profile.insert("device".to_string(), value);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::internal_events::builtin_internal_event_ids;

    #[test]
    fn removes_invalid_hook_mapping_and_hardware_sections() {
        let content = serde_json::json!({
            "id": "broken-profile",
            "name": "Broken Profile",
            "enabledHookEvents": [
                { "source": "codex", "event": "UserPromptSubmit" },
                { "source": "codex", "event": "UnknownEvent" },
                { "source": "codex", "event": "UserPromptSubmit" }
            ],
            "aiEventMappings": [
                {
                    "id": "valid-mapping",
                    "source": "codex",
                    "event": "UserPromptSubmit",
                    "internalEvent": "agent.started",
                    "enabled": true
                },
                {
                    "id": "invalid-mapping",
                    "source": "codex",
                    "event": "UnknownEvent",
                    "internalEvent": "agent.started",
                    "enabled": true
                }
            ],
            "hardwareRules": [
                {
                    "id": "invalid-light-output",
                    "internalEvent": "agent.started",
                    "output": { "type": "light" },
                    "priority": 50,
                    "enabled": true
                },
                {
                    "id": "valid-notification-output",
                    "internalEvent": "agent.failed",
                    "output": {
                        "type": "system-notification",
                        "durationMs": null,
                        "notificationLevel": "error",
                        "notificationTitle": "{{source}} 任务异常",
                        "notificationBody": "事件：{{event}}",
                        "notificationTitleMaxChars": 80,
                        "notificationBodyMaxChars": 300,
                        "notificationThrottleSeconds": 30,
                        "notificationSound": "default"
                    },
                    "priority": 40,
                    "enabled": true
                }
            ],
            "device": { "boardId": "rp2040-pico", "transport": "serial" }
        });

        let result = repair_profile_content(
            &content.to_string(),
            Some("broken-profile"),
            &builtin_internal_event_ids(),
        )
        .expect("profile should repair");
        let profile =
            serde_json::from_str::<NoticeProfile>(&result.content).expect("profile should parse");

        assert_eq!(2, result.report.removed_enabled_hook_events);
        assert_eq!(1, result.report.removed_ai_event_mappings);
        assert_eq!(1, result.report.removed_hardware_rules);
        assert_eq!(1, profile.enabled_hook_events.len());
        assert_eq!("valid-mapping", profile.ai_event_mappings[0].id);
        assert_eq!(1, profile.hardware_rules.len());
        assert_eq!("valid-notification-output", profile.hardware_rules[0].id);
        assert!(profile.validate().is_ok());
    }

    #[test]
    fn preserves_custom_internal_event_when_catalog_contains_it() {
        let content = serde_json::json!({
            "id": "custom-profile",
            "name": "Custom Profile",
            "enabledHookEvents": [
                { "source": "codex", "event": "UserPromptSubmit" }
            ],
            "aiEventMappings": [
                {
                    "id": "custom-mapping",
                    "source": "codex",
                    "event": "UserPromptSubmit",
                    "internalEvent": "review.started.userDefined",
                    "enabled": true
                }
            ],
            "hardwareRules": [
                {
                    "id": "custom-notification-output",
                    "internalEvent": "review.started.userDefined",
                    "output": {
                        "type": "system-notification",
                        "durationMs": null,
                        "notificationLevel": "info",
                        "notificationTitle": "自定义事件",
                        "notificationBody": "{{internalEvent}}",
                        "notificationTitleMaxChars": 80,
                        "notificationBodyMaxChars": 300,
                        "notificationThrottleSeconds": 30,
                        "notificationSound": "default"
                    },
                    "priority": 40,
                    "enabled": true
                }
            ],
            "device": { "boardId": "rp2040-pico", "transport": "serial" }
        });
        let mut valid_event_ids = builtin_internal_event_ids();
        valid_event_ids.insert("review.started.userDefined".to_string());

        let result = repair_profile_content(
            &content.to_string(),
            Some("custom-profile"),
            &valid_event_ids,
        )
        .expect("profile should repair without removing custom events");
        let profile =
            serde_json::from_str::<NoticeProfile>(&result.content).expect("profile should parse");

        assert_eq!(0, result.report.removed_ai_event_mappings);
        assert_eq!(0, result.report.removed_hardware_rules);
        assert_eq!("custom-mapping", profile.ai_event_mappings[0].id);
        assert_eq!("custom-notification-output", profile.hardware_rules[0].id);
        assert!(profile
            .validate_with_internal_events(&valid_event_ids)
            .is_ok());
    }

    #[test]
    fn repairs_profile_identity_and_invalid_device_section() {
        let content = serde_json::json!({
            "id": 123,
            "name": "",
            "enabledHookEvents": [],
            "aiEventMappings": [],
            "hardwareRules": [],
            "device": { "boardId": "", "transport": 88 }
        });

        let result = repair_profile_content(
            &content.to_string(),
            Some("focus-mode"),
            &builtin_internal_event_ids(),
        )
        .expect("profile should repair");
        let profile =
            serde_json::from_str::<NoticeProfile>(&result.content).expect("profile should parse");

        assert!(result.report.repaired_profile_identity);
        assert!(result.report.reset_device);
        assert_eq!("focus-mode", profile.id);
        assert_eq!("focus-mode", profile.name);
        assert_eq!("rp2040-pico", profile.device.board_id);
        assert_eq!("serial", profile.device.transport);
        assert!(profile.validate().is_ok());
    }

    #[test]
    fn counts_non_array_sections_as_removed_configuration() {
        let content = serde_json::json!({
            "id": "broken-sections",
            "name": "Broken Sections",
            "enabledHookEvents": { "source": "codex", "event": "SessionStart" },
            "aiEventMappings": { "id": "bad" },
            "hardwareRules": { "id": "bad" },
            "device": { "boardId": "rp2040-pico", "transport": "serial" }
        });

        let result = repair_profile_content(
            &content.to_string(),
            Some("broken-sections"),
            &builtin_internal_event_ids(),
        )
        .expect("profile should repair");
        let profile =
            serde_json::from_str::<NoticeProfile>(&result.content).expect("profile should parse");

        assert_eq!(1, result.report.removed_enabled_hook_events);
        assert_eq!(1, result.report.removed_ai_event_mappings);
        assert_eq!(1, result.report.removed_hardware_rules);
        assert!(result.report.changed());
        assert!(profile.enabled_hook_events.is_empty());
        assert!(profile.ai_event_mappings.is_empty());
        assert!(profile.hardware_rules.is_empty());
        assert!(profile.validate().is_ok());
    }
}
