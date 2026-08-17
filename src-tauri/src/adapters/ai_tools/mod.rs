pub mod claude_code;
pub mod codex;
pub mod definition;
pub mod field_aliases;
pub mod registry;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookConfigSnippet {
    pub tool_id: String,
    pub description: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HookConfigCandidate {
    pub path: String,
    pub scope: HookConfigScope,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HookConfigScope {
    User,
    Workspace,
}

pub trait AiToolAdapter {
    fn tool_id(&self) -> &'static str;
    fn display_name(&self) -> &'static str;
    fn config_candidates(&self, workspace_path: Option<&str>) -> Vec<HookConfigCandidate>;
    fn hook_snippet(&self, relay_command: &str) -> HookConfigSnippet;
}
