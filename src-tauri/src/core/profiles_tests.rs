use super::*;
use crate::core::device::DeviceChannelActionType;
use crate::core::hook_events::mapped_notice_event;
use std::collections::HashSet;

#[test]
fn default_profile_contains_two_stage_rules() {
    let profile = NoticeProfile::daily_coding();

    assert_eq!("daily-coding", profile.id);
    assert_eq!("Daily Coding", profile.name);

    // SessionStart 现在映射到 agent.started
    assert!(profile
        .ai_event_mappings
        .iter()
        .any(|mapping| mapping.source == "codex"
            && mapping.event == "SessionStart"
            && mapping.internal_event == "agent.started"));
    assert!(profile
        .ai_event_mappings
        .iter()
        .any(|mapping| mapping.source == "codex"
            && mapping.event == "UserPromptSubmit"
            && mapping.internal_event == "agent.started"));

    // 验证有 agent.working 的默认系统通知规则
    assert!(profile
        .hardware_rules
        .iter()
        .any(|rule| rule.internal_event == "agent.working"
            && rule.output.output_type == HardwareOutputType::SystemNotification));
}

#[test]
fn claude_code_basic_template_covers_core_events_with_notification_outputs() {
    let mut profile = NoticeProfile {
        id: "claude-template-check".to_string(),
        name: "Claude Code Daily Coding".to_string(),
        enabled_hook_events: Vec::new(),
        ai_event_mappings: Vec::new(),
        hardware_rules: Vec::new(),
        device: default_device_profile(),
    };
    ProfileTemplate::Basic.apply_to_profile(&mut profile);
    assert!(profile.enabled_hook_events.is_empty());
    let core_events = claude_code_core_events();

    for event in core_events {
        let internal_event = mapped_notice_event("claude-code", event)
            .expect("claude-code core event should exist in hook catalog");
        assert_eq!(
            Some(internal_event.to_string()),
            profile.map_ai_event("claude-code", event),
            "missing claude-code ai mapping for {event}"
        );
    }

    for internal_event in [
        "agent.started",
        "agent.working",
        "tool.executing",
        "agent.waiting_input",
        "notification",
        "agent.completed",
        "agent.failed",
    ] {
        assert!(
            profile.hardware_rules.iter().any(|rule| {
                rule.internal_event == internal_event
                    && rule.output.output_type == HardwareOutputType::SystemNotification
                    && rule.enabled
            }),
            "missing system notification output for {internal_event}"
        );
    }
}

fn claude_code_core_events() -> [&'static str; 9] {
    [
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "PostToolUseFailure",
        "Notification",
        "PermissionRequest",
        "Stop",
        "StopFailure",
    ]
}

#[test]
fn internal_event_catalog_contains_core_events() {
    let catalog = internal_event_catalog();

    // 验证 8 个核心事件都存在
    assert!(catalog.iter().any(|e| e.id == "agent.started"));
    assert!(catalog.iter().any(|e| e.id == "agent.working"));
    assert!(catalog.iter().any(|e| e.id == "agent.waiting_input"));
    assert!(catalog.iter().any(|e| e.id == "tool.executing"));
    assert!(catalog.iter().any(|e| e.id == "agent.completed"));
    assert!(catalog.iter().any(|e| e.id == "agent.failed"));
    assert!(catalog.iter().any(|e| e.id == "notification"));
    assert!(catalog.iter().any(|e| e.id == "context.compacting"));

    // 验证事件总数是 8 个
    assert_eq!(8, catalog.len());
}

#[test]
fn profile_template_metadata_keeps_existing_contract() {
    let templates = ProfileTemplate::all();

    assert_eq!(
        vec![
            ProfileTemplate::Basic,
            ProfileTemplate::Advanced,
            ProfileTemplate::Blank
        ],
        templates
    );
    assert_eq!("basic", ProfileTemplate::Basic.id());
    assert_eq!("基础映射方案", ProfileTemplate::Basic.name());
    assert_eq!(
        "预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。",
        ProfileTemplate::Basic.description()
    );
    assert!(ProfileTemplate::Basic.is_recommended());
    assert!(!ProfileTemplate::Advanced.is_recommended());
    assert!(!ProfileTemplate::Blank.is_recommended());
}

#[test]
fn profile_template_fallback_metadata_uses_language_neutral_text() {
    let templates = [
        ProfileTemplate::Basic,
        ProfileTemplate::Advanced,
        ProfileTemplate::Blank,
    ];

    for template in templates {
        assert!(
            !contains_cjk(template.fallback_name()),
            "fallback name should not contain localized UI text: {}",
            template.fallback_name()
        );
        assert!(
            !contains_cjk(template.fallback_description()),
            "fallback description should not contain localized UI text: {}",
            template.fallback_description()
        );
    }
}

#[test]
fn profile_template_apply_uses_data_definition() {
    let mut profile = NoticeProfile {
        id: "template-check".to_string(),
        name: "模板校验".to_string(),
        enabled_hook_events: Vec::new(),
        ai_event_mappings: Vec::new(),
        hardware_rules: Vec::new(),
        device: default_device_profile(),
    };

    ProfileTemplate::Basic.apply_to_profile(&mut profile);

    assert!(profile.enabled_hook_events.is_empty());
    assert!(profile.ai_event_mappings.iter().any(|mapping| {
        mapping.source == "codex"
            && mapping.event == "SessionStart"
            && mapping.internal_event == "agent.started"
    }));
    assert!(profile.ai_event_mappings.iter().any(|mapping| {
        mapping.source == "codex"
            && mapping.event == "UserPromptSubmit"
            && mapping.internal_event == "agent.started"
    }));
    assert!(profile.hardware_rules.iter().any(|rule| {
        rule.id == "agent-waiting-input-system-notification-output"
            && rule.internal_event == "agent.waiting_input"
            && rule.output.output_type == HardwareOutputType::SystemNotification
            && rule.output.notification_title.is_some()
            && rule.output.notification_body.is_some()
    }));
    profile
        .validate()
        .expect("template profile should be valid");
}

fn contains_cjk(value: &str) -> bool {
    value
        .chars()
        .any(|character| ('\u{4e00}'..='\u{9fff}').contains(&character))
}

#[test]
fn default_profile_maps_stop_events_to_agent_completed() {
    let profile = NoticeProfile::daily_coding();

    // 验证 Stop 事件映射到 agent.completed
    assert!(profile.ai_event_mappings.iter().any(|mapping| {
        mapping.source == "codex"
            && mapping.event == "Stop"
            && mapping.internal_event == "agent.completed"
    }));

    // 验证有 agent.completed 的系统通知规则
    assert!(profile.hardware_rules.iter().any(|rule| {
        rule.internal_event == "agent.completed"
            && rule.output.output_type == HardwareOutputType::SystemNotification
            && rule.output.notification_title.is_some()
            && rule.output.notification_body.is_some()
    }));
}

#[test]
fn validate_accepts_custom_output_without_extra_fields() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-completed-custom-output-test".to_string(),
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
        priority: 50,
        enabled: true,
    });

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validates_desktop_notice_output_requires_target() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output: desktop_notice_output(Vec::new()),
        priority: 1,
        enabled: true,
    });

    let error = profile
        .validate()
        .expect_err("empty desktop notice target list should be rejected");

    assert_eq!(
        "desktop notice rule desktop-notice-rule has empty desktop_notice_targets",
        error
    );
}

#[test]
fn validates_desktop_notice_output_accepts_valid_rule() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output: desktop_notice_output(vec!["notice-main".to_string()]),
        priority: 1,
        enabled: true,
    });

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validates_desktop_notice_output_accepts_new_restore_behavior_and_breathing_period() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    let mut output = desktop_notice_output(vec!["notice-main".to_string()]);
    output.desktop_notice_targets[0].restore_behavior = DesktopNoticeRestoreBehavior::KeepLast;
    output.desktop_notice_targets[0].effect = DesktopNoticeRuleEffect::Breathing;
    output.desktop_notice_targets[0].breathing_period_ms = Some(1600);
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output,
        priority: 1,
        enabled: true,
    });

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validates_desktop_notice_output_rejects_invalid_mascot_bubble_template() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    let mut output = desktop_notice_output(vec!["mascot-main".to_string()]);
    output.desktop_notice_targets[0].mascot_bubble_template =
        Some("第一行\n第二行\n第三行".to_string());
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-mascot-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output,
        priority: 1,
        enabled: true,
    });

    let error = profile
        .validate()
        .expect_err("invalid mascot bubble template should be rejected");

    assert_eq!(
        "desktop notice rule desktop-notice-mascot-rule target mascot-main has invalid mascot bubble template: too many lines",
        error
    );
}

#[test]
fn validates_desktop_notice_output_rejects_invalid_breathing_period() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    let mut output = desktop_notice_output(vec!["notice-main".to_string()]);
    output.desktop_notice_targets[0].breathing_period_ms = Some(200);
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output,
        priority: 1,
        enabled: true,
    });

    let error = profile
        .validate()
        .expect_err("invalid desktop notice breathing period should be rejected");
    assert!(error.contains("breathing_period_ms"));
}

#[test]
fn default_profile_keeps_system_notification_as_default_output() {
    let profile = NoticeProfile::daily_coding();

    assert!(profile.hardware_rules.iter().any(|rule| {
        rule.output.output_type == HardwareOutputType::SystemNotification && rule.enabled
    }));
    assert!(!profile
        .hardware_rules
        .iter()
        .any(|rule| rule.output.output_type == HardwareOutputType::DeviceChannel));
}

fn desktop_notice_output(target_ids: Vec<String>) -> HardwareOutput {
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
        desktop_notice_targets: target_ids
            .into_iter()
            .map(|target_id| DesktopNoticeRuleTarget {
                target_id,
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
            })
            .collect(),
    }
}

#[test]
fn validates_desktop_notice_output_accepts_mascot_playback_window_for_once_mode() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    let mut output = desktop_notice_output(vec!["mascot-main".to_string()]);
    output.desktop_notice_targets[0].mascot_play_mode = Some(DesktopMascotPlayMode::OnceThenIdle);
    output.desktop_notice_targets[0].mascot_playback_window_ms = Some(2600);
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-mascot-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output,
        priority: 1,
        enabled: true,
    });

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validates_desktop_notice_output_rejects_invalid_mascot_playback_window() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    let mut output = desktop_notice_output(vec!["mascot-main".to_string()]);
    output.desktop_notice_targets[0].mascot_play_mode = Some(DesktopMascotPlayMode::OnceThenHold);
    output.desktop_notice_targets[0].mascot_playback_window_ms = Some(120);
    profile.hardware_rules.push(HardwareRule {
        id: "desktop-notice-mascot-rule".to_string(),
        internal_event: "agent.started".to_string(),
        output,
        priority: 1,
        enabled: true,
    });

    let error = profile
        .validate()
        .expect_err("invalid mascot playback window should be rejected");

    assert_eq!(
        "desktop notice rule desktop-notice-mascot-rule target mascot-main has invalid mascot_playback_window_ms=120, expected 500..=8000",
        error
    );
}

#[test]
fn validate_accepts_device_channel_rule_with_multiple_actions() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .hardware_rules
        .retain(|rule| rule.internal_event != "agent.failed");
    profile
        .hardware_rules
        .push(device_channel_rule_with_actions(
            "agent-failed-device-channel-output",
            "agent.failed",
            vec![
                device_channel_action("a1", "desk-pico", "pin.gp2", DeviceChannelActionType::Blink),
                device_channel_action(
                    "a2",
                    "lab-pico",
                    "pin.gp2",
                    DeviceChannelActionType::Activate,
                ),
                device_channel_action(
                    "a3",
                    "desk-pico",
                    "pin.gp3",
                    DeviceChannelActionType::Activate,
                ),
            ],
        ));

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validate_rejects_device_channel_action_without_device_id() {
    let mut profile = NoticeProfile::daily_coding();
    let mut rule = device_channel_rule(
        "agent-failed-missing-device",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    );
    rule.output.channel_actions[0].device_id = "  ".to_string();
    profile.hardware_rules.push(rule);

    assert_eq!(
        Err("device-channel rule agent-failed-missing-device requires device_id".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_device_channel_action_without_channel_id() {
    let mut profile = NoticeProfile::daily_coding();
    let mut rule = device_channel_rule(
        "agent-failed-missing-channel",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    );
    rule.output.channel_actions[0].channel_id.clear();
    profile.hardware_rules.push(rule);

    assert_eq!(
        Err("device-channel rule agent-failed-missing-channel requires channel_id".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_set_duty_device_channel_output_without_duty_percent() {
    let mut profile = profile_with_device_channel_rule(
        "agent-failed-missing-duty",
        "agent.failed",
        "desk-pico",
        "pwm.gp14",
    );
    profile.hardware_rules[0].output.channel_actions[0].channel_action =
        DeviceChannelActionType::SetDuty;
    profile.hardware_rules[0].output.channel_actions[0].duty_percent = None;

    assert_eq!(
        Err(
            "device-channel rule agent-failed-missing-duty set-duty action requires duty_percent"
                .to_string()
        ),
        profile.validate()
    );
}

#[test]
fn display_output_requires_device_status_title_and_message_templates() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-display-output".to_string(),
        internal_event: "agent.started".to_string(),
        priority: 50,
        enabled: true,
        output: HardwareOutput {
            output_type: HardwareOutputType::Display,
            channel_actions: vec![],
            duration_ms: Some(5000),
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
    });

    assert_eq!(
        Err("display rule agent-started-display-output requires display_device_id".to_string()),
        profile.validate()
    );

    let output = &mut profile.hardware_rules[0].output;
    output.display_device_id = Some("desk-wio".to_string());
    assert_eq!(
        Err("display rule agent-started-display-output requires display_status".to_string()),
        profile.validate()
    );

    let output = &mut profile.hardware_rules[0].output;
    output.display_status = Some("success".to_string());
    assert_eq!(
        Err(
            "display rule agent-started-display-output requires display_title_template".to_string()
        ),
        profile.validate()
    );

    let output = &mut profile.hardware_rules[0].output;
    output.display_title_template = Some("{{source}} done".to_string());
    assert_eq!(
        Err(
            "display rule agent-started-display-output requires display_message_template"
                .to_string()
        ),
        profile.validate()
    );

    let output = &mut profile.hardware_rules[0].output;
    output.display_message_template = Some("{{last_assistant_message}}".to_string());
    assert!(profile.validate().is_ok());
}

#[test]
fn validate_rejects_duplicate_device_channel_output_type_for_same_internal_event() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(device_channel_rule(
        "agent-failed-desk-pico-gp2-a",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    ));
    profile.hardware_rules.push(device_channel_rule(
        "agent-failed-desk-pico-gp2-b",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    ));

    assert_eq!(
        Err("duplicate hardware output rule: agent.failed/device-channel".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_duplicate_device_channel_action_target_in_same_rule() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .hardware_rules
        .push(device_channel_rule_with_actions(
            "agent-failed-duplicate-action-target",
            "agent.failed",
            vec![
                device_channel_action("a1", "desk-pico", "pin.gp2", DeviceChannelActionType::Blink),
                device_channel_action(
                    "a2",
                    "desk-pico",
                    "pin.gp2",
                    DeviceChannelActionType::Activate,
                ),
            ],
        ));

    assert_eq!(
        Err(
            "device-channel rule agent-failed-duplicate-action-target has duplicate device-channel action target: desk-pico/pin.gp2"
                .to_string()
        ),
        profile.validate()
    );
}

#[test]
fn validate_rejects_more_than_ten_device_channel_actions() {
    let mut profile = NoticeProfile::daily_coding();
    let actions = (0..11)
        .map(|index| {
            device_channel_action(
                &format!("a{index}"),
                "desk-pico",
                &format!("pin.gp{index}"),
                DeviceChannelActionType::Activate,
            )
        })
        .collect::<Vec<_>>();
    profile
        .hardware_rules
        .push(device_channel_rule_with_actions(
            "agent-failed-too-many-actions",
            "agent.failed",
            actions,
        ));

    assert_eq!(
        Err(
            "device-channel rule agent-failed-too-many-actions has too many device-channel actions: 11 > 10"
                .to_string()
        ),
        profile.validate()
    );
}

#[test]
fn validate_rejects_device_channel_interval_ms_zero() {
    let mut profile = NoticeProfile::daily_coding();
    let mut rule = device_channel_rule(
        "agent-failed-zero-interval",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    );
    rule.output.channel_actions[0].interval_ms = Some(0);
    profile.hardware_rules.push(rule);

    assert_eq!(
        Err(
            "device-channel rule agent-failed-zero-interval has interval_ms=0, expected 100..=10000"
                .to_string()
        ),
        profile.validate()
    );
}

#[test]
fn validate_rejects_device_channel_duration_ms_above_limit() {
    let mut profile = NoticeProfile::daily_coding();
    let mut rule = device_channel_rule(
        "agent-failed-too-long-duration",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    );
    rule.output.channel_actions[0].duration_ms = Some(600_001);
    profile.hardware_rules.push(rule);

    assert_eq!(
        Err(
            "device-channel rule agent-failed-too-long-duration has duration_ms=600001, expected 100..=600000"
                .to_string()
        ),
        profile.validate()
    );
}

#[test]
fn validate_rejects_device_channel_interval_ms_below_limit() {
    let mut profile = NoticeProfile::daily_coding();
    let mut rule = device_channel_rule(
        "agent-failed-too-fast-interval",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
    );
    rule.output.channel_actions[0].interval_ms = Some(99);
    profile.hardware_rules.push(rule);

    assert_eq!(
        Err(
            "device-channel rule agent-failed-too-fast-interval has interval_ms=99, expected 100..=10000"
                .to_string()
        ),
        profile.validate()
    );
}

#[test]
fn maps_ai_event_to_internal_event_when_enabled() {
    let profile = NoticeProfile::daily_coding();

    let internal_event = profile
        .map_ai_event("codex", "SessionStart")
        .expect("SessionStart should map");

    assert_eq!("agent.started", internal_event);

    let prompt_internal_event = profile
        .map_ai_event("codex", "UserPromptSubmit")
        .expect("UserPromptSubmit should map");

    assert_eq!("agent.started", prompt_internal_event);
}

#[test]
fn disabled_ai_mapping_does_not_map() {
    let mut profile = NoticeProfile::daily_coding();
    let mapping = profile
        .ai_event_mappings
        .iter_mut()
        .find(|mapping| mapping.source == "codex" && mapping.event == "SessionStart")
        .expect("default mapping should exist");
    mapping.enabled = false;

    assert_eq!(None, profile.map_ai_event("codex", "SessionStart"));
}

#[test]
fn profile_mapping_does_not_depend_on_profile_hook_event_snapshot() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .enabled_hook_events
        .retain(|event| !(event.source == "codex" && event.event == "SessionStart"));

    assert_eq!(
        Some("agent.started".to_string()),
        profile.map_ai_event("codex", "SessionStart")
    );
}

#[test]
fn maps_internal_event_to_hardware_output_when_enabled() {
    let profile = NoticeProfile::daily_coding();

    let rule = profile
        .map_hardware_output("agent.working")
        .expect("agent.running should map");

    assert_eq!(
        HardwareOutputType::SystemNotification,
        rule.output.output_type
    );
    assert_eq!(
        Some("{{source}} · {{internalEvent}}"),
        rule.output.notification_title.as_deref()
    );
}

#[test]
fn validate_rejects_mapping_to_unknown_internal_event() {
    let mut profile = NoticeProfile::daily_coding();
    profile.ai_event_mappings.push(AiEventMapping {
        id: "bad-mapping".to_string(),
        source: "codex".to_string(),
        event: "SubagentStart".to_string(),
        internal_event: "unknown.event".to_string(),
        enabled: true,
    });

    assert_eq!(
        Err("unknown internal event in ai mapping: unknown.event".to_string()),
        profile.validate()
    );
}

#[test]
fn profile_validation_accepts_custom_internal_event_from_catalog() {
    let mut profile = NoticeProfile::daily_coding();
    profile.enabled_hook_events.push(EnabledHookEvent {
        source: "codex".to_string(),
        event: "SubagentStart".to_string(),
    });
    profile.ai_event_mappings.push(AiEventMapping {
        id: "codex-subagent-start-review-started".to_string(),
        source: "codex".to_string(),
        event: "SubagentStart".to_string(),
        internal_event: "review.started.userDefined".to_string(),
        enabled: true,
    });
    profile
        .hardware_rules
        .push(system_notification_rule_for_event(
            "review-started-system-notification-output",
            "review.started.userDefined",
        ));

    let valid_events = internal_event_ids_with_custom(["review.started.userDefined"]);

    assert_eq!(Ok(()), profile.validate_with_internal_events(&valid_events));
}

#[test]
fn validate_rejects_duplicate_ai_mapping_source_event() {
    let mut profile = NoticeProfile::daily_coding();
    profile.ai_event_mappings.push(AiEventMapping {
        id: "duplicate-session-start".to_string(),
        source: "codex".to_string(),
        event: "SessionStart".to_string(),
        internal_event: "agent.started".to_string(),
        enabled: true,
    });

    assert_eq!(
        Err("duplicate ai mapping event: codex/SessionStart".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_duplicate_hardware_output_combination() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "duplicate-agent-working-system-notification".to_string(),
        internal_event: "agent.working".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::SystemNotification,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("重复通知".to_string()),
            notification_body: Some("重复输出类型".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(30),
            notification_sound: Some("default".to_string()),
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
        priority: 50,
        enabled: true,
    });

    assert_eq!(
        Err("duplicate hardware output rule: agent.working/system-notification".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_unknown_hook_event() {
    let mut profile = NoticeProfile::daily_coding();
    profile.ai_event_mappings.push(AiEventMapping {
        id: "bad-event".to_string(),
        source: "codex".to_string(),
        event: "Setup".to_string(),
        internal_event: "agent.working".to_string(),
        enabled: true,
    });

    assert_eq!(
        Err("unknown hook event in ai mapping: codex/Setup".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_duplicate_ai_mapping_id() {
    let mut profile = NoticeProfile::daily_coding();
    profile.ai_event_mappings.push(AiEventMapping {
        id: "codex-session-start".to_string(), // 重复的 ID
        source: "codex".to_string(),
        event: "SubagentStart".to_string(),
        internal_event: "agent.working".to_string(),
        enabled: true,
    });

    assert_eq!(
        Err("duplicate ai mapping id: codex-session-start".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_duplicate_hardware_rule_id() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-working-system-notification-output".to_string(), // 重复的 ID
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
        priority: 50,
        enabled: true,
    });

    assert_eq!(
        Err("duplicate hardware rule id: agent-working-system-notification-output".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_rejects_more_than_five_enabled_outputs_for_internal_event() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .hardware_rules
        .retain(|rule| rule.internal_event != "context.compacting");
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-custom-output".to_string(),
        internal_event: "context.compacting".to_string(),
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
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-system-notification-output".to_string(),
        internal_event: "context.compacting".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::SystemNotification,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("通知".to_string()),
            notification_body: Some("内容".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(30),
            notification_sound: Some("default".to_string()),
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
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-webhook-output".to_string(),
        internal_event: "context.compacting".to_string(),
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
            webhook_body: Some(r#"{"event":"{{internalEvent}}"}"#.to_string()),
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
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-sound-output".to_string(),
        internal_event: "context.compacting".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Sound,
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
            sound_file_path: Some("/tmp/notice.wav".to_string()),
            sound_volume_percent: Some(80),
            sound_max_duration_ms: Some(3000),
            sound_throttle_seconds: Some(30),
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
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-desktop-notice-output".to_string(),
        internal_event: "context.compacting".to_string(),
        output: desktop_notice_output(vec!["notice-main".to_string()]),
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-buzzer-output".to_string(),
        internal_event: "context.compacting".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Buzzer,
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
        priority: 50,
        enabled: true,
    });

    assert_eq!(
        Err("too many enabled hardware output rules for context.compacting: 6 > 5".to_string()),
        profile.validate()
    );
}

#[test]
fn validate_accepts_more_than_three_outputs_when_only_three_are_enabled() {
    let mut profile = NoticeProfile::daily_coding();
    profile
        .hardware_rules
        .retain(|rule| rule.internal_event != "context.compacting");
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-custom-output".to_string(),
        internal_event: "context.compacting".to_string(),
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
        priority: 50,
        enabled: false,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-system-notification-output".to_string(),
        internal_event: "context.compacting".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::SystemNotification,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("通知".to_string()),
            notification_body: Some("内容".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(30),
            notification_sound: Some("default".to_string()),
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
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-webhook-output".to_string(),
        internal_event: "context.compacting".to_string(),
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
            webhook_body: Some(r#"{"event":"{{internalEvent}}"}"#.to_string()),
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
        priority: 50,
        enabled: true,
    });
    profile.hardware_rules.push(HardwareRule {
        id: "context-compacting-sound-output".to_string(),
        internal_event: "context.compacting".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::Sound,
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
            sound_file_path: Some("/tmp/notice.wav".to_string()),
            sound_volume_percent: Some(80),
            sound_max_duration_ms: Some(3000),
            sound_throttle_seconds: Some(30),
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
        priority: 50,
        enabled: true,
    });

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validate_rejects_duration_ms_zero() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "bad-duration".to_string(),
        internal_event: "context.compacting".to_string(), // 使用不冲突的事件
        output: HardwareOutput {
            output_type: HardwareOutputType::Custom,
            channel_actions: Vec::new(),
            duration_ms: Some(0), // 不允许为 0
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
        priority: 50,
        enabled: true,
    });

    match profile.validate() {
        Ok(_) => panic!("duration_ms=0 should be rejected"),
        Err(error) => {
            assert!(
                error.contains("duration_ms=0") || error.contains("duration_ms"),
                "error should mention duration_ms, got: {}",
                error
            );
        }
    }
}

#[test]
fn validate_accepts_positive_duration_ms() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "good-duration".to_string(),
        internal_event: "context.compacting".to_string(), // 使用不冲突的事件
        output: HardwareOutput {
            output_type: HardwareOutputType::Custom,
            channel_actions: Vec::new(),
            duration_ms: Some(5000), // 正整数允许
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
        priority: 50,
        enabled: true,
    });

    assert_eq!(Ok(()), profile.validate());
}

#[test]
fn validate_rejects_notification_throttle_seconds_above_limit() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "bad-notification-throttle".to_string(),
        internal_event: "context.compacting".to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::SystemNotification,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("上下文压缩".to_string()),
            notification_body: Some("AI 正在压缩上下文。".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(3601),
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
        priority: 50,
        enabled: true,
    });

    match profile.validate() {
        Ok(_) => panic!("notification_throttle_seconds above limit should be rejected"),
        Err(error) => assert!(
            error.contains("notification_throttle_seconds"),
            "error should mention notification_throttle_seconds, got: {}",
            error
        ),
    }
}

#[test]
fn validate_accepts_webhook_body_json_with_template_variables() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-webhook-template-validate".to_string(),
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
            webhook_body: Some(
                r#"{"event":"{{internalEvent}}","summary":"{{last_assistant_message}}"}"#
                    .to_string(),
            ),
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
        priority: 50,
        enabled: true,
    });

    profile
        .validate()
        .expect("webhook json templates should validate before rendering");
}

#[test]
fn validate_rejects_webhook_body_max_chars_above_limit() {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.push(HardwareRule {
        id: "agent-started-webhook-body-limit".to_string(),
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
            webhook_body: Some(r#"{"event":"{{internalEvent}}"}"#.to_string()),
            webhook_body_max_chars: Some(20001),
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
        priority: 50,
        enabled: true,
    });

    let error = profile
        .validate()
        .expect_err("webhook body max chars above limit should fail");

    assert!(error.contains("webhook_body_max_chars"));
}

fn device_channel_rule(
    id: &str,
    internal_event: &str,
    device_id: &str,
    channel_id: &str,
) -> HardwareRule {
    device_channel_rule_with_actions(
        id,
        internal_event,
        vec![device_channel_action(
            "action-1",
            device_id,
            channel_id,
            DeviceChannelActionType::Blink,
        )],
    )
}

fn device_channel_rule_with_actions(
    id: &str,
    internal_event: &str,
    channel_actions: Vec<DeviceChannelRuleAction>,
) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::DeviceChannel,
            channel_actions,
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
        priority: 50,
        enabled: true,
    }
}

fn device_channel_action(
    id: &str,
    device_id: &str,
    channel_id: &str,
    action: DeviceChannelActionType,
) -> DeviceChannelRuleAction {
    DeviceChannelRuleAction {
        id: id.to_string(),
        device_id: device_id.to_string(),
        channel_id: channel_id.to_string(),
        channel_action: action,
        duration_ms: Some(5000),
        interval_ms: if matches!(
            action,
            DeviceChannelActionType::Blink | DeviceChannelActionType::Breathe
        ) {
            Some(500)
        } else {
            None
        },
        duty_percent: if action == DeviceChannelActionType::SetDuty {
            Some(50)
        } else {
            None
        },
        frequency_hz: if matches!(
            action,
            DeviceChannelActionType::Beep | DeviceChannelActionType::Tone
        ) {
            Some(1200)
        } else {
            None
        },
        color: if action == DeviceChannelActionType::SetColor {
            Some("#33ccff".to_string())
        } else {
            None
        },
        brightness_percent: if action == DeviceChannelActionType::SetColor {
            Some(35)
        } else {
            None
        },
        pattern: if action == DeviceChannelActionType::Pattern {
            Some("notice".to_string())
        } else {
            None
        },
        display_template_id: None,
        display_accent: None,
        display_icon: None,
        display_lines_template: None,
        display_status: None,
        display_title_template: None,
        display_message_template: None,
        display_title_max_chars: None,
        display_message_max_chars: None,
    }
}

fn profile_with_device_channel_rule(
    id: &str,
    internal_event: &str,
    device_id: &str,
    channel_id: &str,
) -> NoticeProfile {
    let mut profile = NoticeProfile::daily_coding();
    profile.hardware_rules.clear();
    profile.hardware_rules.push(device_channel_rule(
        id,
        internal_event,
        device_id,
        channel_id,
    ));
    profile
}

fn internal_event_ids_with_custom<const N: usize>(custom_events: [&str; N]) -> HashSet<String> {
    let mut event_ids = internal_event_catalog()
        .into_iter()
        .map(|event| event.id)
        .collect::<HashSet<_>>();
    for event in custom_events {
        event_ids.insert(event.to_string());
    }
    event_ids
}

fn system_notification_rule_for_event(id: &str, internal_event: &str) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output: HardwareOutput {
            output_type: HardwareOutputType::SystemNotification,
            channel_actions: Vec::new(),
            duration_ms: None,
            text: None,
            notification_level: Some("info".to_string()),
            notification_title: Some("自定义事件".to_string()),
            notification_body: Some("{{internalEvent}}".to_string()),
            notification_title_max_chars: Some(80),
            notification_body_max_chars: Some(300),
            notification_throttle_seconds: Some(30),
            notification_sound: Some("default".to_string()),
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
        priority: 50,
        enabled: true,
    }
}
