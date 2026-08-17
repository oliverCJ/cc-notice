use serde_json::Value;

use crate::adapters::ai_tools::field_aliases::{first_payload_field_as_text, PayloadFieldAliases};
use crate::adapters::ai_tools::registry;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NormalizedTemplateFields {
    pub tool_name: String,
    pub model: String,
    pub prompt: String,
    pub tool_response: String,
    pub last_assistant_message: String,
    pub pwd: String,
    pub session_id: String,
    pub permission_mode: String,
}

pub(crate) fn normalize_template_fields(
    source: &str,
    summary_payload: &str,
    raw_payload: Option<&str>,
) -> NormalizedTemplateFields {
    let summary = parse_json(summary_payload);
    let raw = raw_payload.and_then(parse_json);
    let Ok(tool) = registry::ai_tool_definition(source) else {
        return NormalizedTemplateFields::default();
    };
    let aliases = tool.payload_aliases;

    NormalizedTemplateFields {
        tool_name: payload_string_aliases(&summary, raw.as_ref(), aliases.tool_name),
        model: payload_string_aliases(&summary, raw.as_ref(), aliases.model),
        prompt: payload_string_aliases(&summary, raw.as_ref(), aliases.prompt),
        tool_response: payload_string_aliases(&summary, raw.as_ref(), aliases.tool_response),
        last_assistant_message: payload_string_aliases(
            &summary,
            raw.as_ref(),
            aliases.last_assistant_message,
        ),
        pwd: payload_string_aliases(&summary, raw.as_ref(), aliases.pwd),
        session_id: payload_string_aliases(&summary, raw.as_ref(), aliases.session_id),
        permission_mode: payload_string_aliases(&summary, raw.as_ref(), aliases.permission_mode),
    }
}

impl Default for NormalizedTemplateFields {
    fn default() -> Self {
        Self {
            tool_name: String::new(),
            model: String::new(),
            prompt: String::new(),
            tool_response: String::new(),
            last_assistant_message: String::new(),
            pwd: String::new(),
            session_id: String::new(),
            permission_mode: String::new(),
        }
    }
}

fn parse_json(payload: &str) -> Option<Value> {
    serde_json::from_str::<Value>(payload).ok()
}

fn payload_string_aliases(
    summary: &Option<Value>,
    raw: Option<&Value>,
    aliases: PayloadFieldAliases,
) -> String {
    summary
        .as_ref()
        .and_then(|value| first_json_string_field(value, aliases.summary_aliases))
        .or_else(|| raw.and_then(|value| first_json_string_field(value, aliases.raw_aliases)))
        .unwrap_or_default()
}

fn first_json_string_field(value: &Value, keys: &[&str]) -> Option<String> {
    first_payload_field_as_text(value, keys)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_fields_take_precedence_over_raw_payload() {
        let fields = normalize_template_fields(
            "claude-code",
            r#"{"toolName":"summary-tool","sessionId":"summary-session","cwd":"/summary"}"#,
            Some(r#"{"tool_name":"raw-tool","session_id":"raw-session","cwd":"/raw"}"#),
        );

        assert_eq!("summary-tool", fields.tool_name);
        assert_eq!("summary-session", fields.session_id);
        assert_eq!("/summary", fields.pwd);
    }

    #[test]
    fn claude_raw_aliases_map_to_internal_fields() {
        let fields = normalize_template_fields(
            "claude-code",
            "{}",
            Some(
                r#"{"tool_name":"Bash","model":"claude-sonnet","prompt":"用户提示","tool_response":"工具返回","last_assistant_message":"完成","cwd":"/workspace","session_id":"s1","permission_mode":"acceptEdits"}"#,
            ),
        );

        assert_eq!("Bash", fields.tool_name);
        assert_eq!("claude-sonnet", fields.model);
        assert_eq!("用户提示", fields.prompt);
        assert_eq!("工具返回", fields.tool_response);
        assert_eq!("完成", fields.last_assistant_message);
        assert_eq!("/workspace", fields.pwd);
        assert_eq!("s1", fields.session_id);
        assert_eq!("acceptEdits", fields.permission_mode);
    }

    #[test]
    fn non_string_payload_fields_are_normalized_as_text() {
        let fields = normalize_template_fields(
            "claude-code",
            r#"{"tool_response":{"stdout":"ok","exit_code":0},"prompt":["one","two"],"last_assistant_message":true}"#,
            None,
        );

        assert_eq!(r#"{"exit_code":0,"stdout":"ok"}"#, fields.tool_response);
        assert_eq!(r#"["one","two"]"#, fields.prompt);
        assert_eq!("true", fields.last_assistant_message);
    }
}
