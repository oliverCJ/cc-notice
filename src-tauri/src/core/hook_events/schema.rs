use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventCatalogConfig {
    pub sources: Vec<HookEventSourceDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventSourceDefinition {
    pub id: String,
    pub events: Vec<HookEventEntryDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HookEventEntryDefinition {
    pub event: String,
    pub title: String,
    pub description: String,
    pub scenario: String,
    pub default_selected: bool,
    pub mapped_notice_event: String,
}
