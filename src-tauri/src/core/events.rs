use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SourceTool {
    Codex,
    ClaudeCode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum NoticeEventType {
    AgentStarted,
    AgentWorking,
    AgentWaitingInput,
    ToolExecuting,
    AgentCompleted,
    AgentFailed,
    Notification,
    ContextCompacting,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoticeEvent {
    pub source_tool: SourceTool,
    pub event_type: NoticeEventType,
    pub workspace_path: Option<String>,
    pub session_id: Option<String>,
    pub message: Option<String>,
    pub occurred_at: String,
}
