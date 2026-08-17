use super::*;
use std::path::Path;

#[test]
fn parses_required_source_and_event() {
    let args = vec![
        "cc-notice-relay".to_string(),
        "--source".to_string(),
        "codex".to_string(),
        "--event".to_string(),
        "SessionStart".to_string(),
    ];

    let options = RelayCliOptions::parse(&args).expect("valid args should parse");

    assert_eq!("codex", options.source);
    assert_eq!("SessionStart", options.event);
    assert_eq!(None, options.endpoint);
    assert_eq!(None, options.port);
    assert_eq!(None, options.payload);
    assert_eq!(None, options.occurred_at);
    assert!(!options.debug);
}

#[test]
fn parses_debug_flag_without_value() {
    let args = vec![
        "cc-notice-relay".to_string(),
        "--source".to_string(),
        "codex".to_string(),
        "--event".to_string(),
        "SessionStart".to_string(),
        "--debug".to_string(),
    ];

    let options = RelayCliOptions::parse(&args).expect("debug args should parse");

    assert!(options.debug);
}

#[test]
fn rejects_missing_event() {
    let args = vec![
        "cc-notice-relay".to_string(),
        "--source".to_string(),
        "codex".to_string(),
    ];

    let error = RelayCliOptions::parse(&args).expect_err("missing event should fail");

    assert_eq!("missing required --event", error);
}

#[test]
fn endpoint_override_wins_over_port_and_settings() {
    let options = RelayCliOptions {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        endpoint: Some("http://127.0.0.1:19000/api/v1/events".to_string()),
        port: Some(18080),
        payload: None,
        occurred_at: None,
        debug: false,
    };

    let endpoint = resolve_endpoint(&options, Some(17777));

    assert_eq!("http://127.0.0.1:19000/api/v1/events", endpoint);
}

#[test]
fn port_override_wins_over_settings_port() {
    let options = RelayCliOptions {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        endpoint: None,
        port: Some(18080),
        payload: None,
        occurred_at: None,
        debug: false,
    };

    let endpoint = resolve_endpoint(&options, Some(17777));

    assert_eq!("http://127.0.0.1:18080/api/v1/events", endpoint);
}

#[test]
fn reads_port_from_settings_json() {
    let settings = r#"{"localHookServer":{"port":19001},"ui":{"language":"zh-CN"}}"#;

    let port = read_settings_port(settings).expect("settings port should parse");

    assert_eq!(19001, port);
}

#[test]
fn rejects_invalid_settings_port() {
    let settings = r#"{"localHookServer":{"port":80},"ui":{"language":"zh-CN"}}"#;

    let error = read_settings_port(settings).expect_err("invalid settings port should fail");

    assert_eq!(
        "local hook server port must be between 1024 and 65535",
        error
    );
}

#[test]
fn settings_path_uses_hidden_cc_notice_dir() {
    let path = settings_path_in_home(Path::new("/Users/alice"));

    assert_eq!(Path::new("/Users/alice/.cc-notice/settings.json"), path);
}

#[test]
fn codex_summary_limits_prompt_and_tool_payload_fields() {
    let raw = r#"{
            "session_id":"s1",
            "transcript_path":"/workspace/project/.codex/session.jsonl",
            "cwd":"/workspace/project",
            "hook_event_name":"PreToolUse",
            "model":"gpt-5",
            "turn_id":"t1",
            "tool_name":"Bash",
            "tool_use_id":"tool-1",
            "tool_input":{"command":"secret command"},
            "prompt":"secret prompt",
            "last_assistant_message":"secret answer"
        }"#;

    let summary = summarize_hook_payload("codex", "PreToolUse", raw).expect("summary should build");
    let value: serde_json::Value = serde_json::from_str(&summary).expect("summary should be json");

    assert_eq!(serde_json::json!(false), value["captured"]);
    assert_eq!("PreToolUse", value["hookEventName"]);
    assert_eq!("s1", value["sessionId"]);
    assert_eq!(
        "/workspace/project/.codex/session.jsonl",
        value["transcriptPath"]
    );
    assert_eq!("/workspace/project", value["cwd"]);
    assert_eq!("gpt-5", value["model"]);
    assert_eq!("t1", value["turnId"]);
    assert_eq!("Bash", value["toolName"]);
    assert_eq!("tool-1", value["toolUseId"]);
    assert_eq!(serde_json::json!(true), value["hasToolInput"]);
    assert_eq!(serde_json::json!(true), value["hasPrompt"]);
    assert_eq!(serde_json::json!(true), value["hasLastAssistantMessage"]);
    assert_eq!("secret prompt", value["prompt"]);
    assert_eq!("secret answer", value["last_assistant_message"]);
    assert!(!summary.contains("secret command"));
}

#[test]
fn codex_summary_truncates_large_prompt_and_tool_response_fields() {
    let raw = format!(
        r#"{{
            "hook_event_name":"PostToolUse",
            "prompt":"{}",
            "tool_response":"{}",
            "last_assistant_message":"{}"
        }}"#,
        "p".repeat(20_000),
        "t".repeat(20_000),
        "a".repeat(20_000)
    );

    let summary =
        summarize_hook_payload("codex", "PostToolUse", &raw).expect("summary should build");
    let value: serde_json::Value = serde_json::from_str(&summary).expect("summary should be json");

    assert_eq!(10_241, value["prompt"].as_str().unwrap().chars().count());
    assert!(value["prompt"].as_str().unwrap().ends_with('…'));
    assert_eq!(
        10_241,
        value["tool_response"].as_str().unwrap().chars().count()
    );
    assert!(value["tool_response"].as_str().unwrap().ends_with('…'));
    assert_eq!(
        10_241,
        value["last_assistant_message"]
            .as_str()
            .unwrap()
            .chars()
            .count()
    );
    assert!(value["last_assistant_message"]
        .as_str()
        .unwrap()
        .ends_with('…'));
}

#[test]
fn claude_summary_excludes_compact_summary_and_message_but_keeps_presence_flags() {
    let raw = r#"{
            "session_id":"s2",
            "cwd":"/workspace/project",
            "permission_mode":"default",
            "hook_event_name":"PostCompact",
            "trigger":"manual",
            "compact_summary":"large private summary",
            "message":"private notification"
        }"#;

    let summary =
        summarize_hook_payload("claude-code", "PostCompact", raw).expect("summary should build");
    let value: serde_json::Value = serde_json::from_str(&summary).expect("summary should be json");

    assert_eq!(serde_json::json!(false), value["captured"]);
    assert_eq!("PostCompact", value["hookEventName"]);
    assert_eq!("s2", value["sessionId"]);
    assert_eq!("default", value["permissionMode"]);
    assert_eq!("manual", value["trigger"]);
    assert_eq!(serde_json::json!(true), value["hasCompactSummary"]);
    assert_eq!(serde_json::json!(true), value["hasMessage"]);
    assert!(!summary.contains("large private summary"));
    assert!(!summary.contains("private notification"));
}

#[test]
fn claude_summary_keeps_core_variable_fields_with_limits() {
    let raw = format!(
        r#"{{
            "session_id":"claude-session",
            "cwd":"/workspace/claude",
            "permission_mode":"acceptEdits",
            "hook_event_name":"PostToolUse",
            "model":"claude-sonnet",
            "tool_name":"Bash",
            "tool_response":"{}",
            "prompt":"{}",
            "last_assistant_message":"{}"
        }}"#,
        "r".repeat(20_000),
        "p".repeat(20_000),
        "a".repeat(20_000)
    );

    let summary =
        summarize_hook_payload("claude-code", "PostToolUse", &raw).expect("summary should build");
    let value: serde_json::Value = serde_json::from_str(&summary).expect("summary should be json");

    assert_eq!("claude-session", value["sessionId"]);
    assert_eq!("/workspace/claude", value["cwd"]);
    assert_eq!("acceptEdits", value["permissionMode"]);
    assert_eq!("claude-sonnet", value["model"]);
    assert_eq!("Bash", value["toolName"]);
    assert_eq!(
        10_241,
        value["tool_response"].as_str().unwrap().chars().count()
    );
    assert_eq!(10_241, value["prompt"].as_str().unwrap().chars().count());
    assert_eq!(
        10_241,
        value["last_assistant_message"]
            .as_str()
            .unwrap()
            .chars()
            .count()
    );
}

#[test]
fn claude_summary_serializes_non_string_large_variable_fields_without_debug() {
    let raw = format!(
        r#"{{
            "hook_event_name":"PostToolUse",
            "tool_response":{{"stdout":"{}","exit_code":0}},
            "prompt":["first","second"],
            "last_assistant_message":{{"summary":"done"}}
        }}"#,
        "r".repeat(20_000)
    );

    let summary =
        summarize_hook_payload("claude-code", "PostToolUse", &raw).expect("summary should build");
    let value: serde_json::Value = serde_json::from_str(&summary).expect("summary should be json");

    assert_eq!(
        10_241,
        value["tool_response"].as_str().unwrap().chars().count()
    );
    assert!(value["tool_response"].as_str().unwrap().ends_with('…'));
    assert_eq!(r#"["first","second"]"#, value["prompt"]);
    assert_eq!(r#"{"summary":"done"}"#, value["last_assistant_message"]);
}

#[test]
fn non_debug_summary_keeps_public_variables_from_camel_case_payload_without_raw_payload() {
    let options = RelayCliOptions {
        source: "claude-code".to_string(),
        event: "PostToolUse".to_string(),
        endpoint: None,
        port: None,
        payload: None,
        occurred_at: Some("2026-06-18T10:00:00+08:00".to_string()),
        debug: false,
    };
    let raw = r#"{
        "hookEventName":"PostToolUse",
        "sessionId":"camel-session",
        "cwd":"/workspace/camel",
        "permissionMode":"acceptEdits",
        "model":"claude-sonnet",
        "toolName":"Bash",
        "toolResponse":"camel tool response",
        "prompt":"camel prompt",
        "lastAssistantMessage":"camel assistant summary"
    }"#;

    let body = build_submit_request_body(&options, raw)
        .expect("body should build")
        .expect("event should be forwarded");
    let value: serde_json::Value = serde_json::from_str(&body).expect("body should be json");
    let payload: serde_json::Value =
        serde_json::from_str(value["payload"].as_str().expect("payload should be string"))
            .expect("payload summary should be json");

    assert!(value.get("rawPayload").is_none());
    assert_eq!("PostToolUse", payload["hookEventName"]);
    assert_eq!("camel-session", payload["sessionId"]);
    assert_eq!("/workspace/camel", payload["cwd"]);
    assert_eq!("acceptEdits", payload["permissionMode"]);
    assert_eq!("claude-sonnet", payload["model"]);
    assert_eq!("Bash", payload["toolName"]);
    assert_eq!("camel tool response", payload["tool_response"]);
    assert_eq!("camel prompt", payload["prompt"]);
    assert_eq!("camel assistant summary", payload["last_assistant_message"]);
}

#[test]
fn summary_presence_flags_follow_payload_field_aliases() {
    let raw = r#"{
        "hookEventName":"PostToolUse",
        "toolResponse":"camel tool response",
        "lastAssistantMessage":"camel assistant summary"
    }"#;

    let summary =
        summarize_hook_payload("claude-code", "PostToolUse", raw).expect("summary should build");
    let value: serde_json::Value = serde_json::from_str(&summary).expect("summary should be json");

    assert_eq!(serde_json::json!(true), value["hasToolResponse"]);
    assert_eq!(serde_json::json!(true), value["hasLastAssistantMessage"]);
}

#[test]
fn unknown_source_does_not_use_default_payload_aliases() {
    let error = summarize_hook_payload("unknown", "PostToolUse", r#"{"toolResponse":"value"}"#)
        .expect_err("unknown source should fail before summary aliases are applied");

    assert_eq!("unknown ai tool source: unknown", error);
}

#[test]
fn unknown_hook_event_is_forwarded_to_software_side() {
    let options = RelayCliOptions {
        source: "codex".to_string(),
        event: "UnknownHook".to_string(),
        endpoint: None,
        port: None,
        payload: None,
        occurred_at: Some("2026-06-08T12:00:00Z".to_string()),
        debug: false,
    };

    let body = build_submit_request_body(&options, r#"{"hook_event_name":"UnknownHook"}"#)
        .expect("unknown event should still build")
        .expect("unknown event should be forwarded");
    let value: serde_json::Value = serde_json::from_str(&body).expect("body should be json");

    assert_eq!("codex", value["source"]);
    assert_eq!("UnknownHook", value["event"]);
    assert!(value.get("rawPayload").is_none());
}

#[test]
fn debug_mode_attaches_raw_payload_while_keeping_summary_payload() {
    let options = RelayCliOptions {
        source: "codex".to_string(),
        event: "UnknownHook".to_string(),
        endpoint: None,
        port: None,
        payload: None,
        occurred_at: Some("2026-06-08T12:00:00Z".to_string()),
        debug: true,
    };
    let raw =
        r#"{"hook_event_name":"UnknownHook","title":"原始标题","prompt":"large private prompt"}"#;

    let body = build_submit_request_body(&options, raw)
        .expect("debug body should build")
        .expect("debug event should be forwarded");
    let value: serde_json::Value = serde_json::from_str(&body).expect("body should be json");
    let payload: serde_json::Value =
        serde_json::from_str(value["payload"].as_str().expect("payload should be string"))
            .expect("payload summary should be json");

    assert_eq!("UnknownHook", payload["hookEventName"]);
    assert_eq!("原始标题", payload["title"]);
    assert_eq!("large private prompt", payload["prompt"]);
    assert_eq!(raw, value["rawPayload"]);
}

#[test]
fn relay_default_timestamp_uses_configured_local_offset() {
    let timestamp = crate::infrastructure::time_utils::format_rfc3339_for_offset(
        time::OffsetDateTime::new_utc(
            time::Date::from_calendar_date(2026, time::Month::June, 12).expect("valid date"),
            time::Time::from_hms(0, 30, 0).expect("valid time"),
        ),
        time::UtcOffset::from_hms(8, 0, 0).expect("valid offset"),
    );

    assert_eq!("2026-06-12T08:30:00+08:00", timestamp);
}

#[test]
fn builds_submit_request_with_raw_hook_event_and_summary_payload() {
    let options = RelayCliOptions {
        source: "codex".to_string(),
        event: "PreToolUse".to_string(),
        endpoint: None,
        port: None,
        payload: None,
        occurred_at: Some("2026-06-08T12:00:00Z".to_string()),
        debug: false,
    };
    let raw = r#"{"session_id":"s1","hook_event_name":"PreToolUse","tool_name":"Bash"}"#;

    let body = build_submit_request_body(&options, raw)
        .expect("body should build")
        .expect("known event should be forwarded");
    let value: serde_json::Value = serde_json::from_str(&body).expect("body should be json");
    let payload: serde_json::Value =
        serde_json::from_str(value["payload"].as_str().expect("payload should be string"))
            .expect("payload summary should be json");

    assert_eq!("codex", value["source"]);
    assert_eq!("PreToolUse", value["event"]);
    assert_eq!("2026-06-08T12:00:00Z", value["occurredAt"]);
    assert_eq!(serde_json::json!(false), payload["captured"]);
    assert_eq!("PreToolUse", payload["hookEventName"]);
    assert_eq!("Bash", payload["toolName"]);
    assert!(value.get("rawPayload").is_none());
}

#[test]
fn parses_local_http_endpoint() {
    let endpoint = LocalHttpEndpoint::parse("http://127.0.0.1:17321/api/v1/events")
        .expect("endpoint should parse");

    assert_eq!("127.0.0.1", endpoint.host);
    assert_eq!(17321, endpoint.port);
    assert_eq!("/api/v1/events", endpoint.path);
}

#[test]
fn builds_http_post_request() {
    let endpoint = LocalHttpEndpoint::parse("http://127.0.0.1:17321/api/v1/events")
        .expect("endpoint should parse");

    let request = build_http_post_request(&endpoint, "{\"ok\":true}", None);

    assert!(request.starts_with("POST /api/v1/events HTTP/1.1\r\n"));
    assert!(request.contains("Host: 127.0.0.1:17321\r\n"));
    assert!(request.contains("Content-Type: application/json\r\n"));
    assert!(request.contains("Content-Length: 11\r\n"));
    assert!(request.ends_with("\r\n\r\n{\"ok\":true}"));
}

#[test]
fn builds_http_post_request_with_auth_token() {
    let endpoint = LocalHttpEndpoint::parse("http://127.0.0.1:17321/api/v1/events")
        .expect("endpoint should parse");

    let request = build_http_post_request(&endpoint, "{\"ok\":true}", Some("test-token-123"));

    assert!(request.contains("X-CC-Notice-Token: test-token-123\r\n"));
    assert!(request.ends_with("\r\n\r\n{\"ok\":true}"));
}

#[test]
fn parses_http_status_code_from_response() {
    let status = parse_http_status_code("HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}")
        .expect("status should parse");

    assert_eq!(200, status);
}

#[test]
fn treats_non_2xx_status_as_error() {
    let error = ensure_success_status(400).expect_err("400 should fail");

    assert_eq!("请求失败：HTTP 400", error);
}

#[test]
fn reports_auth_failure_with_actionable_message() {
    let error = ensure_success_status(401).expect_err("401 should fail");

    assert_eq!(
        "认证失败：Token 无效或缺失，请重启应用重新生成 Token",
        error
    );
}

#[test]
fn default_network_timeout_is_short_for_ai_hooks() {
    assert_eq!(std::time::Duration::from_secs(2), DEFAULT_HTTP_TIMEOUT);
}

#[test]
fn builds_relay_commands_for_all_events() {
    let commands = relay_commands_for_events("cc-notice-relay", "codex", &["SessionStart", "Stop"]);

    assert_eq!(
        "cc-notice-relay --source codex --event SessionStart\ncc-notice-relay --source codex --event Stop",
        commands
    );
}
