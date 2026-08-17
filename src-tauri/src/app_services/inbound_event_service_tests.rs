use super::*;
use crate::core::desktop_notice::{
    DesktopNoticeColorMode, DesktopNoticeColorStop, DesktopNoticeRestoreBehavior,
    DesktopNoticeRuleEffect,
};
use crate::core::events::NoticeEventType;
use crate::core::profiles::{
    AiEventMapping, DesktopNoticeRuleTarget, EnabledHookEvent, HardwareOutput, HardwareOutputType,
    HardwareRule, NoticeProfile,
};
use crate::core::protocol::NoticeCommandType;

fn current_occurred_at() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .expect("current time should format as RFC3339")
}

#[test]
fn submit_valid_raw_hook_event_records_internal_event_and_hardware_output() {
    let mut service = InboundEventService::with_profile(NoticeProfile::daily_coding());
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{\"captured\":false}".to_string(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    let result = service
        .submit_relay_event(request)
        .expect("known raw hook event should be accepted");

    assert_eq!("agent.started", result.internal_event);
    assert_eq!(NoticeEventType::AgentStarted, result.event.event_type);
    assert_eq!("accepted", service.debug_log_entries()[0].result);
    assert_eq!(
        Some("agent.started".to_string()),
        service.debug_log_entries()[0].internal_event
    );
    assert_eq!(
        Some("hardwareRule".to_string()),
        service.debug_log_entries()[0].mapping_stage
    );
}

#[test]
fn accepted_events_receive_distinct_debug_entry_ids_for_duplicate_requests() {
    let mut service = InboundEventService::with_profile(NoticeProfile::daily_coding());
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{\"captured\":false}".to_string(),
        raw_payload: None,
        occurred_at: "2026-07-17T12:00:00Z".to_string(),
    };

    let first = service
        .submit_relay_event(request.clone())
        .expect("first event should be accepted");
    let second = service
        .submit_relay_event(request)
        .expect("second event should be accepted");

    assert_ne!(first.debug_entry_id, second.debug_entry_id);
    assert_eq!(
        second.debug_entry_id,
        service.debug_log_entries()[0].debug_entry_id
    );
    assert_eq!(
        first.debug_entry_id,
        service.debug_log_entries()[1].debug_entry_id
    );
}

#[test]
fn processing_timing_updates_debug_entry_by_id() {
    let mut service = InboundEventService::with_profile(NoticeProfile::daily_coding());
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{\"captured\":false}".to_string(),
        raw_payload: None,
        occurred_at: "2026-07-17T12:00:00Z".to_string(),
    };
    let first = service
        .submit_relay_event(request.clone())
        .expect("first event should be accepted");
    let second = service
        .submit_relay_event(request)
        .expect("second event should be accepted");

    service.mark_debug_log_processing_timing(&first.debug_entry_id, 42);

    let newest = &service.debug_log_entries()[0];
    let oldest = &service.debug_log_entries()[1];
    assert_eq!(second.debug_entry_id, newest.debug_entry_id);
    assert_eq!(None, newest.processing_elapsed_ms);
    assert_eq!(first.debug_entry_id, oldest.debug_entry_id);
    assert_eq!(Some(42), oldest.processing_elapsed_ms);
    assert!(oldest.processing_completed_at.is_some());
}

#[test]
fn globally_disabled_hook_event_is_rejected_before_profile_mapping() {
    let profile = NoticeProfile::daily_coding();
    let mut service =
        InboundEventService::with_profile_and_enabled_hook_events(profile, Vec::new());

    let result = service.submit_relay_event(SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{\"captured\":false}".to_string(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    });

    assert_eq!(
        Err("hook event is not enabled for codex/SessionStart".to_string()),
        result
    );
    assert_eq!("error", service.debug_log_entries()[0].result);
    assert_eq!(
        Some("hookEventSelection".to_string()),
        service.debug_log_entries()[0].mapping_stage
    );
}

#[test]
fn configured_user_prompt_submit_maps_to_agent_started_system_notification() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .hardware_rules
        .retain(|rule| rule.internal_event != "agent.started");
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-notification-test".to_string(),
        internal_event: "agent.started".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::SystemNotification,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("AI 开始工作".to_string()),
            notification_body: Some("Codex 已收到新的提示。".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(30),
            notification_sound: None,
            webhook_method: None,
            webhook_url: None,
            webhook_headers: None,
            webhook_body: None,
            webhook_body_max_chars: None,
            sound_file_path: None,
            sound_volume_percent: None,
            sound_max_duration_ms: None,
            sound_throttle_seconds: None,
            display_device_id: None,
            display_template_id: None,
            display_accent: None,
            display_icon: None,
            display_lines_template: None,
            display_status: None,
            display_title_template: None,
            display_message_template: None,
            display_title_max_chars: None,
            display_message_max_chars: None,
            display_expire_behavior: None,
            desktop_notice_targets: Vec::new(),
        },
        priority: 80,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile(profile);

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "UserPromptSubmit".to_string(),
            payload: "{\"captured\":false}".to_string(),
            raw_payload: None,
            occurred_at: current_occurred_at(),
        })
        .expect("configured raw hook event should be accepted");

    assert_eq!("agent.started", result.internal_event);
    assert_eq!(NoticeEventType::AgentStarted, result.event.event_type);
    assert_eq!(NoticeCommandType::ShowText, result.command.command_type);
    assert_eq!("accepted", service.debug_log_entries()[0].result);
    assert_eq!(
        Some("hardwareRule".to_string()),
        service.debug_log_entries()[0].mapping_stage
    );
}

#[test]
fn relay_result_includes_desktop_notice_output_fields() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .hardware_rules
        .retain(|rule| rule.internal_event != "agent.started");
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output: desktop_notice_output_for_test("notice-main"),
        priority: 80,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile(profile);

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "SessionStart".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            occurred_at: current_occurred_at(),
        })
        .expect("configured hook event should be accepted");

    assert_eq!(1, result.outputs.len());
    assert_eq!(
        HardwareOutputType::DesktopNotice,
        result.outputs[0].output_type
    );
    assert_eq!(
        vec!["notice-main".to_string()],
        result.outputs[0]
            .desktop_notice_targets
            .iter()
            .map(|target| target.target_id.clone())
            .collect::<Vec<_>>()
    );
    assert_eq!(
        DesktopNoticeRuleEffect::Solid,
        result.outputs[0].desktop_notice_targets[0].effect
    );
    assert_eq!(
        3000,
        result.outputs[0].desktop_notice_targets[0].duration_ms
    );
}

#[test]
fn codex_stop_maps_to_agent_completed_outputs() {
    let mut service = InboundEventService::with_profile(NoticeProfile::daily_coding());

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "Stop".to_string(),
            payload: r#"{"hookEventName":"Stop","last_assistant_message":"完成总结"}"#.to_string(),
            raw_payload: Some(r#"{"hook_event_name":"Stop"}"#.to_string()),
            occurred_at: current_occurred_at(),
        })
        .expect("codex Stop hook should map to completion");

    assert_eq!("agent.completed", result.internal_event);
    assert_eq!(NoticeEventType::AgentCompleted, result.event.event_type);
    assert!(result.outputs.iter().any(|output| output.output_type
        == HardwareOutputType::SystemNotification
        && output.rule_id == "agent-completed-system-notification-output"));
    assert_eq!("accepted", service.debug_log_entries()[0].result);
}

fn desktop_notice_output_for_test(target_id: &str) -> HardwareOutput {
    HardwareOutput {
        output_type: HardwareOutputType::DesktopNotice,
        channel_actions: Vec::new(),
        duration_ms: None,
        text: None,
        notification_level: None,
        notification_title: None,
        notification_body: None,
        notification_title_max_chars: None,
        notification_body_max_chars: None,
        notification_throttle_seconds: None,
        notification_sound: None,
        webhook_method: None,
        webhook_url: None,
        webhook_headers: None,
        webhook_body: None,
        webhook_body_max_chars: None,
        sound_file_path: None,
        sound_volume_percent: None,
        sound_max_duration_ms: None,
        sound_throttle_seconds: None,
        display_device_id: None,
        display_template_id: None,
        display_accent: None,
        display_icon: None,
        display_lines_template: None,
        display_status: None,
        display_title_template: None,
        display_message_template: None,
        display_title_max_chars: None,
        display_message_max_chars: None,
        display_expire_behavior: None,
        desktop_notice_targets: vec![DesktopNoticeRuleTarget {
            target_id: target_id.to_string(),
            effect: DesktopNoticeRuleEffect::Solid,
            color_mode: DesktopNoticeColorMode::Solid,
            colors: vec![DesktopNoticeColorStop {
                color: "#22C55E".to_string(),
                position: 0,
            }],
            duration_ms: 3000,
            animation_period_ms: None,
            breathing_period_ms: None,
            opacity_percent: None,
            brightness_percent: None,
            restore_behavior: DesktopNoticeRestoreBehavior::RestoreDefault,
            edge: None,
            mascot_state: None,
            mascot_action_id: None,
            mascot_play_mode: None,
            mascot_playback_window_ms: None,
            mascot_bubble_template: None,
        }],
    }
}

#[test]
fn mapped_internal_event_returns_webhook_and_system_notification_outputs() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-webhook-template-sidecar-test".to_string(),
        internal_event: "agent.started".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Webhook,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: None,
            notification_title: None,
            notification_body: None,
            notification_title_max_chars: None,
            notification_body_max_chars: None,
            notification_throttle_seconds: None,
            notification_sound: None,
            webhook_method: Some("POST".to_string()),
            webhook_url: Some("https://example.test/hooks".to_string()),
            webhook_headers: Some(r#"{"Content-Type":"application/json"}"#.to_string()),
            webhook_body: Some(r#"{"event":{{internalEvent}}}"#.to_string()),
            webhook_body_max_chars: Some(8000),
            sound_file_path: None,
            sound_volume_percent: None,
            sound_max_duration_ms: None,
            sound_throttle_seconds: None,
            display_device_id: None,
            display_template_id: None,
            display_accent: None,
            display_icon: None,
            display_lines_template: None,
            display_status: None,
            display_title_template: None,
            display_message_template: None,
            display_title_max_chars: None,
            display_message_max_chars: None,
            display_expire_behavior: None,
            desktop_notice_targets: Vec::new(),
        },
        priority: 90,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile(profile);

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "UserPromptSubmit".to_string(),
            payload: r#"{"model":"gpt-5.5"}"#.to_string(),
            raw_payload: Some(
                r#"{"last_assistant_message":"任务完成任务完成任务完成任务完成任务完成"}"#
                    .to_string(),
            ),
            occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
        })
        .expect("event should map");

    assert!(result.outputs.len() >= 2);
    assert!(result
        .outputs
        .iter()
        .any(|output| output.output_type == HardwareOutputType::Webhook));
    let notification = result
        .outputs
        .iter()
        .find(|output| output.output_type == HardwareOutputType::SystemNotification)
        .expect("notification output should exist");
    assert_eq!(
        "codex 开始处理任务",
        notification.notification_title.as_deref().unwrap()
    );
    assert!(notification
        .notification_body
        .as_deref()
        .unwrap()
        .contains("gpt-5.5"));
}

#[test]
fn mapped_internal_event_renders_webhook_output_templates() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-webhook-template-test".to_string(),
        internal_event: "agent.started".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Webhook,
                channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: None,
            notification_title: None,
            notification_body: None,
            notification_title_max_chars: None,
            notification_body_max_chars: None,
            notification_throttle_seconds: None,
            notification_sound: None,
            webhook_method: Some("POST".to_string()),
            webhook_url: Some("https://example.test/hooks".to_string()),
            webhook_headers: Some(r#"{"X-Event":"{{internalEvent}}"}"#.to_string()),
            webhook_body: Some(
                r#"{"tool":"{{source}}","model":"{{model}}","summary":{{last_assistant_message}},"prompt":{{prompt}},"toolResponse":{{tool_response}}}"#.to_string(),
            ),
            webhook_body_max_chars: Some(200),
            sound_file_path: None,
            sound_volume_percent: None,
            sound_max_duration_ms: None,
            sound_throttle_seconds: None,
            display_device_id: None,
                display_template_id: None,
                display_accent: None,
                display_icon: None,
                display_lines_template: None,
            display_status: None,
            display_title_template: None,
            display_message_template: None,
            display_title_max_chars: None,
            display_message_max_chars: None,
            display_expire_behavior: None,
            desktop_notice_targets: Vec::new(),
        },
        priority: 70,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile(profile);

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "UserPromptSubmit".to_string(),
            payload: r#"{"model":"gpt-5.5","prompt":"请处理 \"复杂\" 输入","tool_response":"工具\n返回"}"#.to_string(),
            raw_payload: Some(
                r#"{"last_assistant_message":"已完成 \"主要\" 修改\n下一行"}"#.to_string(),
            ),
            occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
        })
        .expect("event should map");

    let webhook = result
        .outputs
        .iter()
        .find(|output| output.output_type == HardwareOutputType::Webhook)
        .expect("webhook output should exist");
    assert_eq!("POST", webhook.webhook_method.as_deref().unwrap());
    assert_eq!(
        "https://example.test/hooks",
        webhook.webhook_url.as_deref().unwrap()
    );
    assert_eq!(
        r#"{"X-Event":"agent.started"}"#,
        webhook.webhook_headers.as_deref().unwrap()
    );
    assert_eq!(
        "codex",
        serde_json::from_str::<serde_json::Value>(webhook.webhook_body.as_deref().unwrap())
            .expect("webhook body should be valid json")["tool"]
            .as_str()
            .unwrap()
    );
    let body = serde_json::from_str::<serde_json::Value>(webhook.webhook_body.as_deref().unwrap())
        .expect("webhook body should be valid json");
    assert_eq!(
        "已完成 \"主要\" 修改\n下一行",
        body["summary"].as_str().unwrap()
    );
    assert_eq!("请处理 \"复杂\" 输入", body["prompt"].as_str().unwrap());
    assert_eq!("工具\n返回", body["toolResponse"].as_str().unwrap());
}

#[test]
fn webhook_last_assistant_message_is_limited_to_10240_chars() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-completed-webhook-large-summary-test".to_string(),
        internal_event: "agent.completed".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Webhook,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: None,
            notification_title: None,
            notification_body: None,
            notification_title_max_chars: None,
            notification_body_max_chars: None,
            notification_throttle_seconds: None,
            notification_sound: None,
            webhook_method: Some("POST".to_string()),
            webhook_url: Some("https://example.test/hooks".to_string()),
            webhook_headers: Some(r#"{"Content-Type":"application/json"}"#.to_string()),
            webhook_body: Some(r#"{"summary":{{last_assistant_message}}}"#.to_string()),
            webhook_body_max_chars: Some(20_000),
            sound_file_path: None,
            sound_volume_percent: None,
            sound_max_duration_ms: None,
            sound_throttle_seconds: None,
            display_device_id: None,
            display_template_id: None,
            display_accent: None,
            display_icon: None,
            display_lines_template: None,
            display_status: None,
            display_title_template: None,
            display_message_template: None,
            display_title_max_chars: None,
            display_message_max_chars: None,
            display_expire_behavior: None,
            desktop_notice_targets: Vec::new(),
        },
        priority: 70,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile(profile);

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "Stop".to_string(),
            payload: "{}".to_string(),
            raw_payload: Some(format!(
                r#"{{"last_assistant_message":"{}"}}"#,
                "a".repeat(20_000)
            )),
            occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
        })
        .expect("event should map");

    let webhook = result
        .outputs
        .iter()
        .find(|output| output.rule_id == "agent-completed-webhook-large-summary-test")
        .expect("webhook output should exist");
    let body = serde_json::from_str::<serde_json::Value>(webhook.webhook_body.as_deref().unwrap())
        .expect("webhook body should be valid json");

    assert_eq!(10_241, body["summary"].as_str().unwrap().chars().count());
    assert!(body["summary"].as_str().unwrap().ends_with('…'));
}

#[test]
fn webhook_empty_body_remains_optional_after_template_rendering() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-webhook-empty-body-test".to_string(),
        internal_event: "agent.started".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Webhook,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: None,
            notification_title: None,
            notification_body: None,
            notification_title_max_chars: None,
            notification_body_max_chars: None,
            notification_throttle_seconds: None,
            notification_sound: None,
            webhook_method: Some("POST".to_string()),
            webhook_url: Some("https://example.test/hooks".to_string()),
            webhook_headers: Some(r#"{"Content-Type":"application/json"}"#.to_string()),
            webhook_body: Some("".to_string()),
            webhook_body_max_chars: Some(8000),
            sound_file_path: None,
            sound_volume_percent: None,
            sound_max_duration_ms: None,
            sound_throttle_seconds: None,
            display_device_id: None,
            display_template_id: None,
            display_accent: None,
            display_icon: None,
            display_lines_template: None,
            display_status: None,
            display_title_template: None,
            display_message_template: None,
            display_title_max_chars: None,
            display_message_max_chars: None,
            display_expire_behavior: None,
            desktop_notice_targets: Vec::new(),
        },
        priority: 70,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile(profile);

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "UserPromptSubmit".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            occurred_at: "2026-06-13T10:00:00+08:00".to_string(),
        })
        .expect("empty webhook body should remain optional");

    let webhook = result
        .outputs
        .iter()
        .find(|output| output.rule_id == "agent-started-webhook-empty-body-test")
        .expect("webhook output should exist");

    assert_eq!(Some(""), webhook.webhook_body.as_deref());
}

#[test]
fn unsupported_custom_rule_builds_summary_command_without_hardware_protocol() {
    let mut profile = NoticeProfile::daily_coding();
    profile.ai_event_mappings.push(AiEventMapping {
        id: "codex-subagent-stop-agent-completed-test".to_string(),
        source: "codex".to_string(),
        event: "SubagentStop".to_string(),
        internal_event: "agent.completed".to_string(),
        enabled: true,
    });
    // 清除现有的 agent.completed 规则，只保留我们测试的规则
    profile
        .hardware_rules
        .retain(|rule| rule.internal_event != "agent.completed");
    profile.hardware_rules.push(HardwareRule {
        id: "agent-completed-custom-test".to_string(),
        internal_event: "agent.completed".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Custom,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: None,
            notification_title: None,
            notification_body: None,
            notification_title_max_chars: None,
            notification_body_max_chars: None,
            notification_throttle_seconds: None,
            notification_sound: None,
            webhook_method: None,
            webhook_url: None,
            webhook_headers: None,
            webhook_body: None,
            webhook_body_max_chars: None,
            sound_file_path: None,
            sound_volume_percent: None,
            sound_max_duration_ms: None,
            sound_throttle_seconds: None,
            display_device_id: None,
            display_template_id: None,
            display_accent: None,
            display_icon: None,
            display_lines_template: None,
            display_status: None,
            display_title_template: None,
            display_message_template: None,
            display_title_max_chars: None,
            display_message_max_chars: None,
            display_expire_behavior: None,
            desktop_notice_targets: Vec::new(),
        },
        priority: 55,
        enabled: true,
    });
    let mut service = InboundEventService::with_profile_and_enabled_hook_events(
        profile,
        vec![EnabledHookEvent {
            source: "codex".to_string(),
            event: "SubagentStop".to_string(),
        }],
    );

    let result = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "SubagentStop".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            occurred_at: current_occurred_at(),
        })
        .expect("event should submit");

    assert_eq!("agent.completed", result.internal_event);
    assert_eq!(NoticeCommandType::ShowText, result.command.command_type);
    assert_eq!(
        Some("Unsupported output type: Custom".to_string()),
        result.command.text
    );
}

#[test]
fn raw_hook_event_without_ai_mapping_is_not_forwarded() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .ai_event_mappings
        .retain(|mapping| !(mapping.source == "codex" && mapping.event == "SessionStart"));
    let mut service = InboundEventService::with_profile(profile);
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{}".to_string(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    let error = service
        .submit_relay_event(request)
        .expect_err("unmapped event should not forward");

    assert_eq!("no ai event mapping for codex/SessionStart", error);
    assert_eq!("error", service.debug_log_entries()[0].result);
    assert_eq!(None, service.debug_log_entries()[0].notice_command);
    assert_eq!(
        Some("aiEventMapping".to_string()),
        service.debug_log_entries()[0].mapping_stage
    );
}

#[test]
fn submit_request_deserializes_from_camel_case_payload() {
    let request: SubmitRelayEventRequest = serde_json::from_str(
        r#"{"source":"codex","event":"agent.working","payload":"{}","occurredAt":"2026-06-08T18:50:00Z"}"#,
    )
    .expect("camelCase request from frontend should deserialize");

    assert_eq!("2026-06-08T18:50:00Z", request.occurred_at);
}

#[test]
fn submit_request_deserializes_optional_raw_payload() {
    let request: SubmitRelayEventRequest = serde_json::from_str(
        r#"{"source":"codex","event":"SessionStart","payload":"{}","rawPayload":"{\"prompt\":\"debug\"}","occurredAt":"2026-06-08T18:50:00Z"}"#,
    )
    .expect("debug raw payload request should deserialize");

    assert_eq!(
        Some(r#"{"prompt":"debug"}"#.to_string()),
        request.raw_payload
    );
}

#[test]
fn known_hook_event_without_ai_mapping_records_ai_mapping_error() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .ai_event_mappings
        .retain(|mapping| !(mapping.source == "codex" && mapping.event == "UserPromptSubmit"));
    let mut service = InboundEventService::with_profile(profile);

    let error = service
        .submit_relay_event(SubmitRelayEventRequest {
            source: "codex".to_string(),
            event: "UserPromptSubmit".to_string(),
            payload: "{}".to_string(),
            raw_payload: None,
            occurred_at: current_occurred_at(),
        })
        .expect_err("known event without mapping should fail");

    assert_eq!("no ai event mapping for codex/UserPromptSubmit", error);
    assert_eq!(
        Some("aiEventMapping".to_string()),
        service.debug_log_entries()[0].mapping_stage
    );
}

#[test]
fn internal_event_name_is_rejected_without_legacy_rule_fallback() {
    let mut service = InboundEventService::with_profile(NoticeProfile::daily_coding());
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "agent.started".to_string(),
        payload: "{}".to_string(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    let error = service
        .submit_relay_event(request)
        .expect_err("internal event names should not use relay entry");

    assert_eq!("unknown hook event for codex/agent.started", error);
    assert_eq!("error", service.debug_log_entries()[0].result);
    assert_eq!(
        Some("unknown hook event for codex/agent.started".to_string()),
        service.debug_log_entries()[0].error
    );
    assert_eq!(
        Some("hookEventCatalog".to_string()),
        service.debug_log_entries()[0].mapping_stage
    );
}

#[test]
fn debug_log_stores_full_payload_for_detail_view() {
    let mut service = InboundEventService::default();
    let payload = format!("{{\"message\":\"{}\"}}", "x".repeat(200));
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: payload.clone(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    service
        .submit_relay_event(request)
        .expect("valid hook event should be accepted");

    assert_eq!(payload, service.debug_log_entries()[0].payload);
}

#[test]
fn debug_log_stores_raw_payload_for_debug_detail_view() {
    let mut service = InboundEventService::default();
    let raw_payload = r#"{"prompt":"debug raw payload"}"#.to_string();
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{\"captured\":false}".to_string(),
        raw_payload: Some(raw_payload.clone()),
        occurred_at: current_occurred_at(),
    };

    service
        .submit_relay_event(request)
        .expect("valid hook event should be accepted");

    assert_eq!(
        Some(raw_payload),
        service.debug_log_entries()[0].raw_payload
    );
}

#[test]
fn debug_log_entry_serializes_frontend_contract_as_camel_case() {
    let mut service = InboundEventService::default();
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "{}".to_string(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    service
        .submit_relay_event(request)
        .expect("valid hook event should be accepted");

    let value = serde_json::to_value(&service.debug_log_entries()[0])
        .expect("debug log entry should serialize");

    assert!(value.get("occurredAt").is_some());
    assert!(value.get("rawPayload").is_some());
    assert!(value.get("noticeCommand").is_some());
    assert!(value.get("occurred_at").is_none());
    assert!(value.get("raw_payload").is_none());
    assert!(value.get("notice_command").is_none());
    assert!(value["noticeCommand"].get("commandType").is_some());
    assert!(value["noticeCommand"].get("durationMs").is_some());
    assert!(value["noticeCommand"].get("command_type").is_none());
    assert!(value["noticeCommand"].get("duration_ms").is_none());
}

#[test]
fn debug_log_payload_summary_handles_multibyte_text() {
    let mut service = InboundEventService::default();
    let request = SubmitRelayEventRequest {
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        payload: "中文".repeat(100),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    service
        .submit_relay_event(request)
        .expect("valid hook event should be accepted");

    assert_eq!("中文".repeat(100), service.debug_log_entries()[0].payload);
}

#[test]
fn submit_invalid_relay_event_records_error_log() {
    let mut service = InboundEventService::default();
    let request = SubmitRelayEventRequest {
        source: "unknown".to_string(),
        event: "SessionStart".to_string(),
        payload: "{}".to_string(),
        raw_payload: None,
        occurred_at: current_occurred_at(),
    };

    let error = service
        .submit_relay_event(request)
        .expect_err("unknown source should fail");

    assert_eq!("unknown hook event for unknown/SessionStart", error);
    assert_eq!("error", service.debug_log_entries()[0].result);
    assert_eq!(
        Some("unknown hook event for unknown/SessionStart".to_string()),
        service.debug_log_entries()[0].error
    );
}

#[test]
fn clear_debug_log_removes_existing_entries() {
    let mut service = InboundEventService::default();
    service.record_manual_log("accepted");

    service.clear_debug_log();

    assert!(service.debug_log_entries().is_empty());
}
