use serde::{Deserialize, Serialize};

use crate::core::protocol::NoticeCommand;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareNoticeState {
    pub last_event: Option<String>,
    pub last_source: Option<String>,
}

impl SoftwareNoticeState {
    pub(crate) fn empty() -> Self {
        Self {
            last_event: None,
            last_source: None,
        }
    }
}

pub(crate) fn software_notice_state_for_command(
    _command: &NoticeCommand,
    last_event: String,
    last_source: String,
) -> SoftwareNoticeState {
    SoftwareNoticeState {
        last_event: Some(last_event),
        last_source: Some(last_source),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::protocol::NoticeCommandType;

    #[test]
    fn empty_notice_state_has_no_current_values() {
        let state = SoftwareNoticeState::empty();

        assert_eq!(None, state.last_event);
    }

    #[test]
    fn notice_state_captures_last_event_without_deprecated_output_fields() {
        let command = NoticeCommand {
            command_type: NoticeCommandType::ShowText,
            text: None,
            duration_ms: Some(1000),
            priority: 10,
        };

        let state = software_notice_state_for_command(
            &command,
            "agent.waiting_input".to_string(),
            "codex".to_string(),
        );

        assert_eq!(Some("agent.waiting_input".to_string()), state.last_event);
        assert_eq!(Some("codex".to_string()), state.last_source);
    }
}
