use crate::core::events::{NoticeEvent, NoticeEventType, SourceTool};

pub(crate) fn source_tool_from_request(source: &str) -> SourceTool {
    match source {
        "codex" => SourceTool::Codex,
        "claude-code" => SourceTool::ClaudeCode,
        "gemini-cli" => SourceTool::GeminiCli,
        "cursor" => SourceTool::Cursor,
        "github-copilot-cli" => SourceTool::GithubCopilotCli,
        "deepseek-harness" => SourceTool::DeepSeekHarness,
        _ => SourceTool::Other,
    }
}

pub(crate) fn notice_event_type_for_internal_event(internal_event: &str) -> NoticeEventType {
    match internal_event {
        "agent.waiting_input" => NoticeEventType::AgentWaitingInput,
        "tool.executing" => NoticeEventType::ToolExecuting,
        "agent.working" => NoticeEventType::AgentWorking,
        "agent.failed" => NoticeEventType::AgentFailed,
        "agent.completed" => NoticeEventType::AgentCompleted,
        "agent.started" => NoticeEventType::AgentStarted,
        _ => NoticeEventType::AgentWorking,
    }
}

pub(crate) fn notice_event_for_internal_event(
    source: &str,
    internal_event: &str,
    occurred_at: String,
) -> NoticeEvent {
    NoticeEvent {
        source_tool: source_tool_from_request(source),
        event_type: notice_event_type_for_internal_event(internal_event),
        workspace_path: None,
        session_id: None,
        message: None,
        occurred_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_sources_map_to_independent_source_tools() {
        let cases = [
            ("codex", SourceTool::Codex),
            ("claude-code", SourceTool::ClaudeCode),
            ("gemini-cli", SourceTool::GeminiCli),
            ("cursor", SourceTool::Cursor),
            ("github-copilot-cli", SourceTool::GithubCopilotCli),
            ("deepseek-harness", SourceTool::DeepSeekHarness),
        ];

        for (source, expected) in cases {
            assert_eq!(expected, source_tool_from_request(source));
        }
    }

    #[test]
    fn unknown_source_maps_to_other() {
        assert_eq!(SourceTool::Other, source_tool_from_request("unknown-tool"));
    }

    #[test]
    fn internal_event_maps_to_notice_event_type() {
        assert_eq!(
            NoticeEventType::AgentWaitingInput,
            notice_event_type_for_internal_event("agent.waiting_input")
        );
    }

    #[test]
    fn unknown_internal_event_falls_back_to_agent_working() {
        assert_eq!(
            NoticeEventType::AgentWorking,
            notice_event_type_for_internal_event("custom.event")
        );
    }
}
