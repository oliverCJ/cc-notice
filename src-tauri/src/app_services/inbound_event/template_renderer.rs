use crate::app_services::inbound_event::normalized_fields::normalize_template_fields;

const MAX_LAST_ASSISTANT_MESSAGE_CHARS: usize = 10_240;
const MAX_LARGE_PAYLOAD_VARIABLE_CHARS: usize = 10_240;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TemplateRenderContext {
    pub source: String,
    pub event: String,
    pub internal_event: String,
    pub occurred_at: String,
    pub payload: String,
    pub raw_payload: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct RenderLimit {
    max_chars: usize,
}

impl RenderLimit {
    pub(crate) fn new(max_chars: usize) -> Self {
        Self { max_chars }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct RenderedTemplate {
    pub text: String,
}

pub(crate) fn render_template(
    template: &str,
    context: &TemplateRenderContext,
    limit: RenderLimit,
) -> RenderedTemplate {
    let variables = resolved_variables(context);
    let mut text = template.to_string();

    for variable in variables {
        text = text.replace(
            variable.token,
            &truncate_chars(&variable.value, variable_max_chars(variable.token, limit)),
        );
    }

    RenderedTemplate {
        text: truncate_chars(&text, limit.max_chars),
    }
}

pub(crate) fn render_json_template(
    template: &str,
    context: &TemplateRenderContext,
    limit: RenderLimit,
) -> RenderedTemplate {
    let mut text = template.to_string();

    for variable in resolved_variables(context) {
        let value = truncate_chars(&variable.value, variable_max_chars(variable.token, limit));
        let json_string = serde_json::to_string(&value).unwrap_or_else(|_| "\"\"".to_string());
        text = text.replace(&quoted_token(variable.token), &json_string);
        text = text.replace(variable.token, &json_string);
    }

    RenderedTemplate { text }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TemplateVariableValue {
    token: &'static str,
    value: String,
}

fn resolved_variables(context: &TemplateRenderContext) -> Vec<TemplateVariableValue> {
    let fields = normalize_template_fields(
        &context.source,
        &context.payload,
        context.raw_payload.as_deref(),
    );

    vec![
        template_variable("{{source}}", context.source.clone()),
        template_variable("{{event}}", context.event.clone()),
        template_variable("{{internalEvent}}", context.internal_event.clone()),
        template_variable("{{timestamp}}", context.occurred_at.clone()),
        template_variable("{{tool_name}}", fields.tool_name),
        template_variable("{{model}}", fields.model),
        template_variable("{{prompt}}", fields.prompt),
        template_variable("{{tool_response}}", fields.tool_response),
        template_variable("{{last_assistant_message}}", fields.last_assistant_message),
        template_variable("{{pwd}}", fields.pwd),
        template_variable("{{sessionId}}", fields.session_id),
        template_variable("{{permissionMode}}", fields.permission_mode),
    ]
}

fn template_variable(token: &'static str, value: String) -> TemplateVariableValue {
    TemplateVariableValue { token, value }
}

fn variable_max_chars(token: &str, limit: RenderLimit) -> usize {
    if matches!(
        token,
        "{{last_assistant_message}}" | "{{prompt}}" | "{{tool_response}}"
    ) {
        return limit
            .max_chars
            .min(MAX_LAST_ASSISTANT_MESSAGE_CHARS)
            .min(MAX_LARGE_PAYLOAD_VARIABLE_CHARS);
    }
    limit.max_chars
}

fn quoted_token(token: &str) -> String {
    format!("\"{token}\"")
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if max_chars == 0 || value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut truncated: String = value.chars().take(max_chars).collect();
    truncated.push('…');
    truncated
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn context(payload: &str, raw_payload: Option<&str>) -> TemplateRenderContext {
        TemplateRenderContext {
            source: "codex".to_string(),
            event: "Stop".to_string(),
            internal_event: "agent.completed".to_string(),
            occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
            payload: payload.to_string(),
            raw_payload: raw_payload.map(str::to_string),
        }
    }

    #[test]
    fn renders_stable_context_variables_and_ai_tool_display_name() {
        let rendered = render_template(
            "{{source}} {{event}} {{internalEvent}} {{timestamp}}",
            &context("{}", None),
            RenderLimit::new(200),
        );

        assert_eq!(
            "codex Stop agent.completed 2026-06-13T10:00:00+08:00",
            rendered.text
        );
    }

    #[test]
    fn renders_whitelisted_payload_fields_from_summary_payload() {
        let rendered = render_template(
            "{{tool_name}} {{model}} {{prompt}} {{tool_response}} {{pwd}} {{sessionId}} {{permissionMode}}",
            &context(
                r#"{"toolName":"shell","model":"gpt-5.5","prompt":"用户提示","tool_response":"工具返回","cwd":"/workspace/app","sessionId":"session-1","permissionMode":"default"}"#,
                None,
            ),
            RenderLimit::new(200),
        );

        assert_eq!(
            "shell gpt-5.5 用户提示 工具返回 /workspace/app session-1 default",
            rendered.text
        );
    }

    #[test]
    fn renders_public_payload_variables_without_debug_raw_payload() {
        let rendered = render_template(
            "{{tool_name}} {{model}} {{prompt}} {{tool_response}} {{last_assistant_message}} {{pwd}} {{sessionId}} {{permissionMode}}",
            &context(
                r#"{"toolName":"Bash","model":"claude-sonnet","prompt":"summary prompt","tool_response":"summary response","last_assistant_message":"summary done","cwd":"/workspace/summary","sessionId":"summary-session","permissionMode":"acceptEdits"}"#,
                None,
            ),
            RenderLimit::new(500),
        );

        assert_eq!(
            "Bash claude-sonnet summary prompt summary response summary done /workspace/summary summary-session acceptEdits",
            rendered.text
        );
    }

    #[test]
    fn renders_all_payload_variables_from_normalized_field_aliases() {
        let rendered = render_template(
            "{{tool_name}} {{model}} {{prompt}} {{tool_response}} {{last_assistant_message}} {{pwd}} {{sessionId}} {{permissionMode}}",
            &context(
                "{}",
                Some(
                    r#"{"tool_name":"Bash","toolName":"ignored","model":"claude-sonnet","prompt":"用户提示","toolResponse":"工具返回","lastAssistantMessage":"任务完成","cwd":"/workspace/claude","session_id":"session-raw","permission_mode":"acceptEdits"}"#,
                ),
            ),
            RenderLimit::new(500),
        );

        assert_eq!(
            "Bash claude-sonnet 用户提示 工具返回 任务完成 /workspace/claude session-raw acceptEdits",
            rendered.text
        );
    }

    #[test]
    fn summary_payload_takes_precedence_over_raw_payload_aliases() {
        let rendered = render_template(
            "{{tool_name}} {{model}} {{prompt}} {{tool_response}} {{last_assistant_message}} {{pwd}} {{sessionId}} {{permissionMode}}",
            &context(
                r#"{"toolName":"summary-tool","model":"summary-model","prompt":"summary-prompt","tool_response":"summary-response","last_assistant_message":"summary-message","cwd":"/summary","sessionId":"summary-session","permissionMode":"summary-mode"}"#,
                Some(
                    r#"{"tool_name":"raw-tool","model":"raw-model","prompt":"raw-prompt","tool_response":"raw-response","last_assistant_message":"raw-message","cwd":"/raw","session_id":"raw-session","permission_mode":"raw-mode"}"#,
                ),
            ),
            RenderLimit::new(500),
        );

        assert_eq!(
            "summary-tool summary-model summary-prompt summary-response summary-message /summary summary-session summary-mode",
            rendered.text
        );
    }

    #[test]
    fn renders_json_string_variables_with_escaping_for_webhook_body() {
        let rendered = render_json_template(
            r#"{"summary":{{last_assistant_message}},"toolResponse":{{tool_response}}}"#,
            &context(
                r#"{"tool_response":"line1\n\"quoted\""}"#,
                Some(r#"{"last_assistant_message":"完成 \"复杂\" 修改\n下一行"}"#),
            ),
            RenderLimit::new(10_240),
        );
        let value = serde_json::from_str::<Value>(&rendered.text)
            .expect("rendered webhook body should remain valid json");

        assert_eq!(
            "完成 \"复杂\" 修改\n下一行",
            value["summary"].as_str().unwrap()
        );
        assert_eq!("line1\n\"quoted\"", value["toolResponse"].as_str().unwrap());
    }

    #[test]
    fn json_last_assistant_message_is_limited_to_10240_chars() {
        let raw_payload = format!(r#"{{"last_assistant_message":"{}"}}"#, "a".repeat(20_000));

        let rendered = render_json_template(
            r#"{"summary":{{last_assistant_message}}}"#,
            &context("{}", Some(&raw_payload)),
            RenderLimit::new(20_000),
        );
        let value = serde_json::from_str::<Value>(&rendered.text)
            .expect("rendered webhook body should remain valid json");

        assert_eq!(10_241, value["summary"].as_str().unwrap().chars().count());
        assert!(value["summary"].as_str().unwrap().ends_with('…'));
    }

    #[test]
    fn json_prompt_and_tool_response_are_limited_to_10240_chars() {
        let payload = format!(
            r#"{{"prompt":"{}","tool_response":"{}"}}"#,
            "p".repeat(20_000),
            "t".repeat(20_000)
        );

        let rendered = render_json_template(
            r#"{"prompt":{{prompt}},"toolResponse":{{tool_response}}}"#,
            &context(&payload, None),
            RenderLimit::new(20_000),
        );
        let value = serde_json::from_str::<Value>(&rendered.text)
            .expect("rendered webhook body should remain valid json");

        assert_eq!(10_241, value["prompt"].as_str().unwrap().chars().count());
        assert!(value["prompt"].as_str().unwrap().ends_with('…'));
        assert_eq!(
            10_241,
            value["toolResponse"].as_str().unwrap().chars().count()
        );
        assert!(value["toolResponse"].as_str().unwrap().ends_with('…'));
    }

    #[test]
    fn renders_last_assistant_message_from_raw_payload_with_default_truncation() {
        let raw_payload = format!(r#"{{"last_assistant_message":"{}"}}"#, "完成".repeat(200));

        let rendered = render_template(
            "{{last_assistant_message}}",
            &context("{}", Some(&raw_payload)),
            RenderLimit::new(80),
        );

        assert!(rendered.text.chars().count() <= 81);
        assert!(rendered.text.ends_with('…'));
    }

    #[test]
    fn missing_payload_field_renders_empty_string_and_unknown_token_stays_visible() {
        let rendered = render_template(
            "model={{model}} title={{title}}",
            &context("{}", None),
            RenderLimit::new(200),
        );

        assert_eq!("model= title={{title}}", rendered.text);
    }
}
