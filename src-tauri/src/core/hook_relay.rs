use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Deserialize;
use serde_json::{Map, Value};

use crate::adapters::ai_tools::field_aliases::{first_payload_field_as_text, PayloadFieldAliases};
use crate::adapters::ai_tools::registry;
use crate::core::app_config::DEFAULT_LOCAL_HOOK_PORT;
use crate::infrastructure::time_utils;

pub const DEFAULT_HTTP_TIMEOUT: Duration = Duration::from_secs(2);
const MAX_LARGE_TEXT_SUMMARY_CHARS: usize = 10_240;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RelayCliOptions {
    pub source: String,
    pub event: String,
    pub endpoint: Option<String>,
    pub port: Option<u16>,
    pub payload: Option<String>,
    pub occurred_at: Option<String>,
    pub debug: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelaySettings {
    local_hook_server: RelayLocalHookServerSettings,
}

#[derive(Debug, Deserialize)]
struct RelayLocalHookServerSettings {
    port: u16,
}

impl RelayCliOptions {
    pub fn parse(args: &[String]) -> Result<Self, String> {
        let mut source = None;
        let mut event = None;
        let mut endpoint = None;
        let mut port = None;
        let mut payload = None;
        let mut occurred_at = None;
        let mut debug = false;
        let mut index = 1;

        while index < args.len() {
            let flag = args[index].as_str();
            match flag {
                "--debug" => {
                    debug = true;
                    index += 1;
                    continue;
                }
                "--source" | "--event" | "--endpoint" | "--port" | "--payload"
                | "--occurred-at" => {}
                unknown => return Err(format!("unknown argument {unknown}")),
            }
            let value = args
                .get(index + 1)
                .ok_or_else(|| format!("missing value for {flag}"))?;
            match flag {
                "--source" => source = Some(value.clone()),
                "--event" => event = Some(value.clone()),
                "--endpoint" => endpoint = Some(value.clone()),
                "--port" => {
                    port = Some(
                        value
                            .parse::<u16>()
                            .map_err(|_| "invalid --port".to_string())?,
                    );
                }
                "--payload" => payload = Some(value.clone()),
                "--occurred-at" => occurred_at = Some(value.clone()),
                _ => unreachable!("supported relay argument should be handled"),
            }
            index += 2;
        }

        Ok(Self {
            source: source.ok_or_else(|| "missing required --source".to_string())?,
            event: event.ok_or_else(|| "missing required --event".to_string())?,
            endpoint,
            port,
            payload,
            occurred_at,
            debug,
        })
    }
}

pub fn settings_path_in_home(home: &Path) -> PathBuf {
    home.join(".cc-notice").join("settings.json")
}

pub fn read_settings_port(content: &str) -> Result<u16, String> {
    let settings =
        serde_json::from_str::<RelaySettings>(content).map_err(|error| error.to_string())?;
    validate_port(settings.local_hook_server.port)?;
    Ok(settings.local_hook_server.port)
}

pub fn resolve_endpoint(options: &RelayCliOptions, settings_port: Option<u16>) -> String {
    if let Some(endpoint) = &options.endpoint {
        return endpoint.clone();
    }

    let port = options
        .port
        .or(settings_port)
        .unwrap_or(DEFAULT_LOCAL_HOOK_PORT);
    endpoint_for_port(port)
}

pub fn endpoint_for_port(port: u16) -> String {
    format!("http://127.0.0.1:{port}/api/v1/events")
}

pub fn validate_port(port: u16) -> Result<(), String> {
    if port < 1024 {
        Err("local hook server port must be between 1024 and 65535".to_string())
    } else {
        Ok(())
    }
}

pub fn relay_commands_for_events(relay_command: &str, source: &str, events: &[&str]) -> String {
    events
        .iter()
        .map(|event| format!("{relay_command} --source {source} --event {event}"))
        .collect::<Vec<_>>()
        .join(
            "
",
        )
}

pub fn summarize_hook_payload(
    source: &str,
    fallback_event: &str,
    raw_payload: &str,
) -> Result<String, String> {
    let tool = registry::ai_tool_definition(source)?;
    let aliases = tool.payload_aliases;
    let parsed = if raw_payload.trim().is_empty() {
        Value::Object(Map::new())
    } else {
        serde_json::from_str::<Value>(raw_payload).map_err(|error| error.to_string())?
    };

    let mut summary = Map::new();
    summary.insert("captured".to_string(), Value::Bool(false));

    let hook_event_name = string_field_aliases(&parsed, &["hook_event_name", "hookEventName"])
        .unwrap_or_else(|| fallback_event.to_string());
    insert_string(&mut summary, "hookEventName", Some(hook_event_name));
    insert_string(
        &mut summary,
        "sessionId",
        payload_string_field(&parsed, aliases.session_id),
    );
    insert_string(
        &mut summary,
        "transcriptPath",
        string_field_aliases(&parsed, &["transcript_path", "transcriptPath"]),
    );
    insert_string(
        &mut summary,
        "turnId",
        string_field_aliases(&parsed, &["turn_id", "turnId"]),
    );
    insert_string(
        &mut summary,
        "cwd",
        payload_string_field(&parsed, aliases.pwd),
    );
    insert_string(
        &mut summary,
        "model",
        payload_string_field(&parsed, aliases.model),
    );
    insert_string(
        &mut summary,
        "permissionMode",
        payload_string_field(&parsed, aliases.permission_mode),
    );
    insert_string(
        &mut summary,
        "agentId",
        string_field_aliases(&parsed, &["agent_id", "agentId"]),
    );
    insert_string(
        &mut summary,
        "agentType",
        string_field_aliases(&parsed, &["agent_type", "agentType"]),
    );
    insert_string(&mut summary, "source", string_field(&parsed, "source"));
    insert_string(
        &mut summary,
        "toolName",
        payload_string_field(&parsed, aliases.tool_name),
    );
    insert_string(
        &mut summary,
        "toolUseId",
        string_field_aliases(&parsed, &["tool_use_id", "toolUseId"]),
    );
    insert_string(
        &mut summary,
        "notificationType",
        string_field_aliases(&parsed, &["notification_type", "notificationType"]),
    );
    insert_string(&mut summary, "title", string_field(&parsed, "title"));
    insert_string(&mut summary, "reason", string_field(&parsed, "reason"));
    insert_string(&mut summary, "error", string_field(&parsed, "error"));
    insert_string(&mut summary, "trigger", string_field(&parsed, "trigger"));
    if let Some(value) = parsed.get("stop_hook_active").and_then(Value::as_bool) {
        summary.insert("stopHookActive".to_string(), Value::Bool(value));
    }
    insert_limited_string(
        &mut summary,
        "prompt",
        payload_string_field(&parsed, aliases.prompt),
        MAX_LARGE_TEXT_SUMMARY_CHARS,
    );
    insert_presence_aliases(&mut summary, &parsed, aliases.prompt, "hasPrompt");
    insert_presence(&mut summary, &parsed, "tool_input", "hasToolInput");
    insert_limited_string(
        &mut summary,
        "tool_response",
        payload_string_field(&parsed, aliases.tool_response),
        MAX_LARGE_TEXT_SUMMARY_CHARS,
    );
    insert_presence_aliases(
        &mut summary,
        &parsed,
        aliases.tool_response,
        "hasToolResponse",
    );
    insert_limited_string(
        &mut summary,
        "last_assistant_message",
        payload_string_field(&parsed, aliases.last_assistant_message),
        MAX_LARGE_TEXT_SUMMARY_CHARS,
    );
    insert_presence_aliases(
        &mut summary,
        &parsed,
        aliases.last_assistant_message,
        "hasLastAssistantMessage",
    );
    insert_presence(
        &mut summary,
        &parsed,
        "compact_summary",
        "hasCompactSummary",
    );
    insert_presence(&mut summary, &parsed, "message", "hasMessage");
    insert_presence(&mut summary, &parsed, "error_details", "hasErrorDetails");

    serde_json::to_string(&Value::Object(summary)).map_err(|error| error.to_string())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalHttpEndpoint {
    pub host: String,
    pub port: u16,
    pub path: String,
}

impl LocalHttpEndpoint {
    pub fn parse(endpoint: &str) -> Result<Self, String> {
        let rest = endpoint
            .strip_prefix("http://")
            .ok_or_else(|| "only http endpoint is supported".to_string())?;
        let (host_port, path) = rest
            .split_once('/')
            .ok_or_else(|| "endpoint path is required".to_string())?;
        let (host, port) = host_port
            .rsplit_once(':')
            .ok_or_else(|| "endpoint port is required".to_string())?;
        let port = port
            .parse::<u16>()
            .map_err(|_| "invalid endpoint port".to_string())?;

        Ok(Self {
            host: host.to_string(),
            port,
            path: format!("/{path}"),
        })
    }
}

pub fn build_submit_request_body(
    options: &RelayCliOptions,
    raw_payload: &str,
) -> Result<Option<String>, String> {
    let payload = summarize_hook_payload(&options.source, &options.event, raw_payload)?;
    let occurred_at = options
        .occurred_at
        .clone()
        .unwrap_or_else(time_utils::current_local_rfc3339_timestamp);

    let mut body = Map::new();
    body.insert("source".to_string(), Value::String(options.source.clone()));
    body.insert("event".to_string(), Value::String(options.event.clone()));
    body.insert("payload".to_string(), Value::String(payload));
    body.insert("occurredAt".to_string(), Value::String(occurred_at));
    if options.debug {
        body.insert(
            "rawPayload".to_string(),
            Value::String(raw_payload.to_string()),
        );
    }

    serde_json::to_string(&Value::Object(body))
        .map(Some)
        .map_err(|error| error.to_string())
}

pub fn build_http_post_request(
    endpoint: &LocalHttpEndpoint,
    body: &str,
    auth_token: Option<&str>,
) -> String {
    let mut headers = format!(
        "POST {} HTTP/1.1\r
Host: {}:{}\r
Content-Type: application/json\r
Content-Length: {}",
        endpoint.path,
        endpoint.host,
        endpoint.port,
        body.len()
    );

    // 添加 auth token header
    if let Some(token) = auth_token {
        headers.push_str(&format!(
            "\r
X-CC-Notice-Token: {}",
            token
        ));
    }

    headers.push_str(
        "\r
Connection: close\r
\r
",
    );
    headers.push_str(body);
    headers
}

pub fn parse_http_status_code(response: &str) -> Result<u16, String> {
    let status_line = response
        .lines()
        .next()
        .ok_or_else(|| "empty HTTP response".to_string())?;
    let status = status_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| "missing HTTP status code".to_string())?;
    status
        .parse::<u16>()
        .map_err(|_| "invalid HTTP status code".to_string())
}

pub fn ensure_success_status(status: u16) -> Result<(), String> {
    if (200..300).contains(&status) {
        Ok(())
    } else {
        let friendly_message = match status {
            401 => "认证失败：Token 无效或缺失，请重启应用重新生成 Token".to_string(),
            404 => "路径不存在：服务端接口路径错误".to_string(),
            500..=599 => format!("服务端错误：HTTP {status}，请查看应用日志"),
            _ => format!("请求失败：HTTP {status}"),
        };
        Err(friendly_message)
    }
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn string_field_aliases(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| string_field(value, key))
}

fn payload_string_field(value: &Value, aliases: PayloadFieldAliases) -> Option<String> {
    first_payload_field_as_text(value, aliases.raw_aliases)
}

fn insert_string(summary: &mut Map<String, Value>, key: &str, value: Option<String>) {
    if let Some(value) = value {
        summary.insert(key.to_string(), Value::String(value));
    }
}

fn insert_limited_string(
    summary: &mut Map<String, Value>,
    key: &str,
    value: Option<String>,
    max_chars: usize,
) {
    if let Some(value) = value {
        summary.insert(
            key.to_string(),
            Value::String(truncate_chars(&value, max_chars)),
        );
    }
}

fn insert_presence(summary: &mut Map<String, Value>, payload: &Value, raw_key: &str, key: &str) {
    if payload.get(raw_key).is_some() {
        summary.insert(key.to_string(), Value::Bool(true));
    }
}

fn insert_presence_aliases(
    summary: &mut Map<String, Value>,
    payload: &Value,
    aliases: PayloadFieldAliases,
    key: &str,
) {
    if aliases
        .raw_aliases
        .iter()
        .any(|raw_key| payload.get(raw_key).is_some())
    {
        summary.insert(key.to_string(), Value::Bool(true));
    }
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
#[path = "hook_relay_tests.rs"]
mod tests;
