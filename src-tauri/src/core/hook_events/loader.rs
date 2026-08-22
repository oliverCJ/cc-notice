use std::collections::HashSet;
use std::sync::OnceLock;

use crate::adapters::ai_tools::registry;
use crate::core::hook_events::schema::{HookEventCatalogConfig, HookEventSourceDefinition};
use crate::core::hook_events::HookEventDefinition;

const HOOK_EVENTS_YAML: &str = include_str!("../../../templates/hook_events.yaml");

#[derive(Debug, Clone)]
pub struct HookEventCatalog {
    sources: Vec<HookEventSource>,
}

#[derive(Debug, Clone)]
struct HookEventSource {
    id: String,
    events: Vec<HookEventDefinition>,
}

static HOOK_EVENT_CATALOG: OnceLock<Result<HookEventCatalog, String>> = OnceLock::new();
static EMPTY_HOOK_EVENTS: &[HookEventDefinition] = &[];

pub fn load_hook_event_config() -> Result<HookEventCatalogConfig, String> {
    serde_yaml::from_str(HOOK_EVENTS_YAML)
        .map_err(|err| format!("failed to parse hook event yaml: {err}"))
}

pub fn hook_events_for_source(source: &str) -> &'static [HookEventDefinition] {
    match cached_catalog() {
        Ok(catalog) => catalog
            .sources
            .iter()
            .find(|item| item.id == source)
            .map(|item| item.events.as_slice())
            .unwrap_or(EMPTY_HOOK_EVENTS),
        Err(_) => EMPTY_HOOK_EVENTS,
    }
}

fn cached_catalog() -> Result<&'static HookEventCatalog, &'static String> {
    HOOK_EVENT_CATALOG.get_or_init(load_catalog).as_ref()
}

fn load_catalog() -> Result<HookEventCatalog, String> {
    let config = load_hook_event_config()?;
    validate_config(&config)?;
    Ok(HookEventCatalog {
        sources: config
            .sources
            .into_iter()
            .map(|source| HookEventSource {
                id: source.id.clone(),
                events: source
                    .events
                    .into_iter()
                    .map(|event| HookEventDefinition {
                        source: source.id.clone(),
                        event: event.event,
                        title: event.title,
                        description: event.description,
                        scenario: event.scenario,
                        default_selected: event.default_selected,
                        mapped_notice_event: event.mapped_notice_event,
                    })
                    .collect(),
            })
            .collect(),
    })
}

fn validate_config(config: &HookEventCatalogConfig) -> Result<(), String> {
    let mut source_ids = HashSet::new();
    for source in &config.sources {
        validate_source(source)?;
        if !source_ids.insert(source.id.as_str()) {
            return Err(format!("duplicate hook event source: {}", source.id));
        }
    }
    for supported_source in registry::supported_ai_tool_sources() {
        if !source_ids.contains(supported_source) {
            return Err(format!("missing hook event source: {supported_source}"));
        }
    }
    Ok(())
}

fn validate_source(source: &HookEventSourceDefinition) -> Result<(), String> {
    if !registry::is_supported_ai_tool(&source.id) {
        return Err(format!("unsupported hook event source: {}", source.id));
    }
    let mut event_names = HashSet::new();
    for event in &source.events {
        validate_required(&event.event, "event", &source.id)?;
        validate_required(&event.title, "title", &source.id)?;
        validate_required(&event.description, "description", &source.id)?;
        validate_required(&event.scenario, "scenario", &source.id)?;
        validate_required(&event.mapped_notice_event, "mappedNoticeEvent", &source.id)?;
        if !event_names.insert(event.event.as_str()) {
            return Err(format!(
                "duplicate hook event for {}: {}",
                source.id, event.event
            ));
        }
    }
    Ok(())
}

fn validate_required(value: &str, field: &str, source: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("hook event {field} cannot be empty for {source}"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_hook_event_yaml_sources() {
        let config = load_hook_event_config().expect("hook event yaml should parse");

        assert_eq!(5, config.sources.len());
        assert!(config.sources.iter().any(|source| source.id == "codex"));
        assert!(config
            .sources
            .iter()
            .any(|source| source.id == "claude-code"));
        assert!(config
            .sources
            .iter()
            .any(|source| source.id == "gemini-cli"));
        assert!(config.sources.iter().any(|source| source.id == "cursor"));
        assert!(config
            .sources
            .iter()
            .any(|source| source.id == "github-copilot-cli"));
    }

    #[test]
    fn validates_embedded_hook_event_config() {
        let config = load_hook_event_config().expect("hook event yaml should parse");

        validate_config(&config).expect("hook event yaml should be valid");
    }

    #[test]
    fn codex_yaml_keeps_official_event_order() {
        let events = hook_events_for_source("codex");
        let names: Vec<&str> = events.iter().map(|event| event.event.as_str()).collect();

        assert_eq!(
            vec![
                "SessionStart",
                "SubagentStart",
                "PreToolUse",
                "PermissionRequest",
                "PostToolUse",
                "PreCompact",
                "PostCompact",
                "UserPromptSubmit",
                "SubagentStop",
                "Stop",
            ],
            names
        );
        assert!(!names.contains(&"Setup"));
        assert!(!names.contains(&"InstructionsLoaded"));
        assert!(!names.contains(&"UserPromptExpansion"));
        assert!(!names.contains(&"PermissionDenied"));
    }
}
