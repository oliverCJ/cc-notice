use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::core::internal_events::{
    builtin_internal_event_catalog, internal_event_ids, InternalEventDefinition,
};
use crate::infrastructure::app_paths;
use crate::infrastructure::file_config;
use crate::infrastructure::time_utils::current_local_rfc3339_timestamp;

const CUSTOM_EVENTS_FILE: &str = "custom-events.json";
const CUSTOM_EVENT_SUFFIX: &str = ".userDefined";
const CUSTOM_EVENT_PREFIX_MIN_LEN: usize = 3;
const CUSTOM_EVENT_PREFIX_MAX_LEN: usize = 32;
const CUSTOM_EVENT_TITLE_MAX_CHARS: usize = 40;
const CUSTOM_EVENT_TEXT_MAX_CHARS: usize = 160;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomInternalEventRequest {
    pub id_prefix: String,
    pub title: String,
    pub description: String,
    pub scenario: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomInternalEventRequest {
    pub id: String,
    pub title: String,
    pub description: String,
    pub scenario: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomInternalEventReference {
    pub profile_id: String,
    pub profile_name: String,
    pub ai_mapping_count: usize,
    pub hardware_rule_count: usize,
}

#[derive(Debug, Clone)]
pub struct CustomInternalEventService {
    root: PathBuf,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomInternalEventStore {
    version: u32,
    events: Vec<CustomInternalEventRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomInternalEventRecord {
    id: String,
    title: String,
    description: String,
    scenario: String,
    built_in: bool,
    created_at: String,
    updated_at: String,
}

impl CustomInternalEventService {
    pub fn from_user_home() -> Result<Self, String> {
        Self::from_config_root(app_paths::app_home_dir()?)
    }

    pub fn from_config_root(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(root.join("events")).map_err(|error| error.to_string())?;
        Ok(Self { root })
    }

    pub fn merged_catalog(&self) -> Result<Vec<InternalEventDefinition>, String> {
        let mut events = builtin_internal_event_catalog();
        events.extend(
            self.load_store()?
                .events
                .into_iter()
                .map(custom_record_to_definition),
        );
        Ok(events)
    }

    pub fn valid_event_ids(&self) -> Result<HashSet<String>, String> {
        Ok(internal_event_ids(&self.merged_catalog()?))
    }

    pub fn create_custom_event(
        &mut self,
        request: CreateCustomInternalEventRequest,
    ) -> Result<InternalEventDefinition, String> {
        let mut store = self.load_store()?;
        let event_id = custom_event_id_from_prefix(&request.id_prefix)?;
        validate_custom_event_text(&request.title, &request.description, &request.scenario)?;
        ensure_event_id_available(&event_id, &store)?;

        let timestamp = current_local_rfc3339_timestamp();
        let record = CustomInternalEventRecord {
            id: event_id,
            title: request.title.trim().to_string(),
            description: request.description.trim().to_string(),
            scenario: request.scenario.trim().to_string(),
            built_in: false,
            created_at: timestamp.clone(),
            updated_at: timestamp,
        };
        store.events.push(record.clone());
        self.save_store(&store)?;
        tracing::info!("custom internal event created: {}", record.id);
        Ok(custom_record_to_definition(record))
    }

    pub fn update_custom_event(
        &mut self,
        request: UpdateCustomInternalEventRequest,
    ) -> Result<InternalEventDefinition, String> {
        let mut store = self.load_store()?;
        validate_custom_event_id(&request.id)?;
        validate_custom_event_text(&request.title, &request.description, &request.scenario)?;
        let Some(record) = store.events.iter_mut().find(|event| event.id == request.id) else {
            return Err(format!("custom internal event not found: {}", request.id));
        };
        record.title = request.title.trim().to_string();
        record.description = request.description.trim().to_string();
        record.scenario = request.scenario.trim().to_string();
        record.updated_at = current_local_rfc3339_timestamp();
        let updated = record.clone();
        self.save_store(&store)?;
        tracing::info!("custom internal event updated: {}", updated.id);
        Ok(custom_record_to_definition(updated))
    }

    pub fn delete_custom_event(&mut self, event_id: &str) -> Result<(), String> {
        validate_custom_event_id(event_id)?;
        let references = self.references_for_event(event_id)?;
        if !references.is_empty() {
            let profile_names = references
                .iter()
                .map(|reference| reference.profile_name.as_str())
                .collect::<Vec<_>>()
                .join(", ");
            tracing::warn!(
                event_id,
                profiles = profile_names.as_str(),
                "custom internal event delete rejected because it is referenced"
            );
            return Err(format!(
                "custom internal event {event_id} is referenced by profiles: {profile_names}"
            ));
        }

        let mut store = self.load_store()?;
        let original_len = store.events.len();
        store.events.retain(|event| event.id != event_id);
        if store.events.len() == original_len {
            return Err(format!("custom internal event not found: {event_id}"));
        }
        self.save_store(&store)?;
        tracing::info!("custom internal event deleted: {event_id}");
        Ok(())
    }

    pub fn references_for_event(
        &self,
        event_id: &str,
    ) -> Result<Vec<CustomInternalEventReference>, String> {
        let profiles_dir = self.root.join("profiles");
        if !profiles_dir.exists() {
            return Ok(Vec::new());
        }

        let mut references = Vec::new();
        for entry in fs::read_dir(&profiles_dir).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            match profile_reference_for_event(&path, event_id) {
                Ok(Some(reference)) => references.push(reference),
                Ok(None) => {}
                Err(error) => {
                    tracing::warn!(
                        path = path.to_string_lossy().as_ref(),
                        "ignored profile while checking custom internal event references: {error}"
                    );
                }
            }
        }
        Ok(references)
    }

    fn load_store(&self) -> Result<CustomInternalEventStore, String> {
        let path = self.events_path();
        if !path.exists() {
            return Ok(CustomInternalEventStore {
                version: 1,
                events: Vec::new(),
            });
        }
        let content = file_config::read_to_string(&path)?;
        let mut store = serde_json::from_str::<CustomInternalEventStore>(&content)
            .map_err(|error| error.to_string())?;
        store.version = 1;
        Ok(store)
    }

    fn save_store(&self, store: &CustomInternalEventStore) -> Result<(), String> {
        let content = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
        file_config::write_string(&self.events_path(), &content)
    }

    fn events_path(&self) -> PathBuf {
        self.root.join("events").join(CUSTOM_EVENTS_FILE)
    }
}

fn custom_event_id_from_prefix(raw_prefix: &str) -> Result<String, String> {
    let prefix = raw_prefix.trim();
    validate_custom_event_prefix(prefix)?;
    Ok(format!("{prefix}{CUSTOM_EVENT_SUFFIX}"))
}

fn validate_custom_event_prefix(prefix: &str) -> Result<(), String> {
    if prefix.ends_with(CUSTOM_EVENT_SUFFIX) {
        return Err("custom internal event id prefix must not include .userDefined".to_string());
    }
    let len = prefix.chars().count();
    if !(CUSTOM_EVENT_PREFIX_MIN_LEN..=CUSTOM_EVENT_PREFIX_MAX_LEN).contains(&len) {
        return Err(format!(
            "custom internal event id prefix length must be {}..={}",
            CUSTOM_EVENT_PREFIX_MIN_LEN, CUSTOM_EVENT_PREFIX_MAX_LEN
        ));
    }
    if prefix.starts_with('.') || prefix.ends_with('.') {
        return Err("custom internal event id prefix must not start or end with dot".to_string());
    }
    if prefix.contains("..") {
        return Err(
            "custom internal event id prefix must not contain consecutive dots".to_string(),
        );
    }
    if !prefix
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '.')
    {
        return Err(
            "custom internal event id prefix only allows ASCII letters, digits and dots"
                .to_string(),
        );
    }
    Ok(())
}

fn validate_custom_event_id(event_id: &str) -> Result<(), String> {
    let Some(prefix) = event_id.strip_suffix(CUSTOM_EVENT_SUFFIX) else {
        return Err(format!(
            "custom internal event id must end with {CUSTOM_EVENT_SUFFIX}: {event_id}"
        ));
    };
    validate_custom_event_prefix(prefix)
}

fn validate_custom_event_text(
    title: &str,
    description: &str,
    scenario: &str,
) -> Result<(), String> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > CUSTOM_EVENT_TITLE_MAX_CHARS {
        return Err(format!(
            "custom internal event title length must be 1..={CUSTOM_EVENT_TITLE_MAX_CHARS}"
        ));
    }
    validate_max_chars(
        description.trim(),
        CUSTOM_EVENT_TEXT_MAX_CHARS,
        "description",
    )?;
    validate_max_chars(scenario.trim(), CUSTOM_EVENT_TEXT_MAX_CHARS, "scenario")
}

fn validate_max_chars(value: &str, max_chars: usize, field: &str) -> Result<(), String> {
    if value.chars().count() > max_chars {
        return Err(format!(
            "custom internal event {field} length must be 0..={max_chars}"
        ));
    }
    Ok(())
}

fn ensure_event_id_available(
    event_id: &str,
    store: &CustomInternalEventStore,
) -> Result<(), String> {
    if builtin_internal_event_catalog()
        .iter()
        .any(|event| event.id == event_id)
        || store.events.iter().any(|event| event.id == event_id)
    {
        return Err(format!("duplicate internal event id: {event_id}"));
    }
    Ok(())
}

fn custom_record_to_definition(record: CustomInternalEventRecord) -> InternalEventDefinition {
    InternalEventDefinition {
        id: record.id,
        title: record.title,
        description: record.description,
        scenario: record.scenario,
        built_in: false,
    }
}

fn profile_reference_for_event(
    path: &Path,
    event_id: &str,
) -> Result<Option<CustomInternalEventReference>, String> {
    let content = file_config::read_to_string(path)?;
    let profile =
        serde_json::from_str::<serde_json::Value>(&content).map_err(|error| error.to_string())?;
    let profile_id = profile
        .get("id")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let profile_name = profile
        .get("name")
        .and_then(serde_json::Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(profile_id.as_str())
        .to_string();
    let ai_mapping_count =
        count_internal_event_references(profile.get("aiEventMappings"), event_id, "internalEvent");
    let hardware_rule_count =
        count_internal_event_references(profile.get("hardwareRules"), event_id, "internalEvent");
    if ai_mapping_count == 0 && hardware_rule_count == 0 {
        return Ok(None);
    }
    Ok(Some(CustomInternalEventReference {
        profile_id,
        profile_name,
        ai_mapping_count,
        hardware_rule_count,
    }))
}

fn count_internal_event_references(
    section: Option<&serde_json::Value>,
    event_id: &str,
    field: &str,
) -> usize {
    section
        .and_then(serde_json::Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| {
                    item.get(field).and_then(serde_json::Value::as_str) == Some(event_id)
                })
                .count()
        })
        .unwrap_or(0)
}
