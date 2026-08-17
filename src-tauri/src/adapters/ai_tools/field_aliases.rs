#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PayloadFieldAliases {
    pub summary_aliases: &'static [&'static str],
    pub raw_aliases: &'static [&'static str],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ToolPayloadAliases {
    pub tool_name: PayloadFieldAliases,
    pub model: PayloadFieldAliases,
    pub prompt: PayloadFieldAliases,
    pub tool_response: PayloadFieldAliases,
    pub last_assistant_message: PayloadFieldAliases,
    pub pwd: PayloadFieldAliases,
    pub session_id: PayloadFieldAliases,
    pub permission_mode: PayloadFieldAliases,
}

pub const DEFAULT_PAYLOAD_ALIASES: ToolPayloadAliases = ToolPayloadAliases {
    tool_name: PayloadFieldAliases {
        summary_aliases: &["toolName", "tool_name"],
        raw_aliases: &["tool_name", "toolName"],
    },
    model: PayloadFieldAliases {
        summary_aliases: &["model"],
        raw_aliases: &["model"],
    },
    prompt: PayloadFieldAliases {
        summary_aliases: &["prompt"],
        raw_aliases: &["prompt"],
    },
    tool_response: PayloadFieldAliases {
        summary_aliases: &["tool_response", "toolResponse"],
        raw_aliases: &["tool_response", "toolResponse"],
    },
    last_assistant_message: PayloadFieldAliases {
        summary_aliases: &["last_assistant_message", "lastAssistantMessage"],
        raw_aliases: &["last_assistant_message", "lastAssistantMessage"],
    },
    pwd: PayloadFieldAliases {
        summary_aliases: &["cwd"],
        raw_aliases: &["cwd"],
    },
    session_id: PayloadFieldAliases {
        summary_aliases: &["sessionId", "session_id"],
        raw_aliases: &["session_id", "sessionId"],
    },
    permission_mode: PayloadFieldAliases {
        summary_aliases: &["permissionMode", "permission_mode"],
        raw_aliases: &["permission_mode", "permissionMode"],
    },
};

pub fn first_payload_field_as_text(value: &serde_json::Value, aliases: &[&str]) -> Option<String> {
    aliases
        .iter()
        .find_map(|key| value.get(key).and_then(payload_value_as_text))
}

pub fn payload_value_as_text(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => Some(text.to_string()),
        serde_json::Value::Bool(flag) => Some(flag.to_string()),
        serde_json::Value::Number(number) => Some(number.to_string()),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            serde_json::to_string(value).ok()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn payload_value_as_text_serializes_non_string_values() {
        assert_eq!(
            Some("text".to_string()),
            payload_value_as_text(&json!("text"))
        );
        assert_eq!(
            Some("true".to_string()),
            payload_value_as_text(&json!(true))
        );
        assert_eq!(Some("42".to_string()), payload_value_as_text(&json!(42)));
        assert_eq!(
            Some(r#"{"exit_code":0,"stdout":"ok"}"#.to_string()),
            payload_value_as_text(&json!({"exit_code":0,"stdout":"ok"}))
        );
        assert_eq!(None, payload_value_as_text(&serde_json::Value::Null));
    }
}
