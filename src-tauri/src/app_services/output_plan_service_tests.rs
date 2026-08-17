use super::{OutputPlanService, OutputTemplateContext};
use crate::core::device::{
    DeviceChannelAction, DeviceChannelActionType, DeviceExtensionActionType, OutputExecutionAction,
};
use crate::core::profiles::{
    default_device_profile, DeviceChannelRuleAction, HardwareOutput, HardwareOutputType,
    HardwareRule, NoticeProfile,
};
use std::collections::HashMap;

#[test]
fn builds_plan_from_enabled_device_channel_rules_for_internal_event() {
    let profile = profile_with_rules(vec![device_channel_rule_with_actions(
        "agent-failed-device-channel-output",
        "agent.failed",
        80,
        vec![
            device_channel_action("a1", "desk-pico", "pin.gp2", DeviceChannelActionType::Blink),
            device_channel_action(
                "a2",
                "lab-pico",
                "pin.gp3",
                DeviceChannelActionType::Activate,
            ),
        ],
    )]);

    let device_board_ids =
        HashMap::from([("desk-wio".to_string(), "seeed-wio-terminal".to_string())]);

    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.failed",
        &OutputTemplateContext::default(),
        &device_board_ids,
    );

    assert_eq!("agent.failed", plan.internal_event);
    assert_eq!(2, plan.actions.len());
    let first = as_device_channel(&plan.actions[0]);
    assert_eq!("desk-pico", first.device_id);
    assert_eq!("pin.gp2", first.channel_id);
    assert_eq!(DeviceChannelActionType::Blink, first.action);
    assert_eq!(80, first.priority);
    let second = as_device_channel(&plan.actions[1]);
    assert_eq!("lab-pico", second.device_id);
    assert_eq!("pin.gp3", second.channel_id);
    assert_eq!(DeviceChannelActionType::Activate, second.action);
    assert_eq!(80, second.priority);
}

#[test]
fn sorts_device_channel_actions_by_priority_descending() {
    let profile = profile_with_rules(vec![
        device_channel_rule(
            "agent-working-low",
            "agent.working",
            "desk-pico",
            "pin.gp2",
            DeviceChannelActionType::Activate,
            10,
        ),
        device_channel_rule(
            "agent-working-high",
            "agent.working",
            "desk-pico",
            "pin.gp3",
            DeviceChannelActionType::Blink,
            90,
        ),
        device_channel_rule(
            "agent-working-mid",
            "agent.working",
            "desk-pico",
            "pin.gp4",
            DeviceChannelActionType::Pulse,
            50,
        ),
    ]);

    let plan = OutputPlanService::build_plan(&profile, "agent.working");
    let priorities = plan
        .actions
        .iter()
        .map(|action| as_device_channel(action).priority)
        .collect::<Vec<_>>();

    assert_eq!(vec![90, 50, 10], priorities);
}

#[test]
fn ignores_non_device_channel_and_disabled_rules() {
    let mut disabled_rule = device_channel_rule(
        "agent-started-disabled-device",
        "agent.started",
        "desk-pico",
        "pin.gp2",
        DeviceChannelActionType::Activate,
        80,
    );
    disabled_rule.enabled = false;
    let profile = profile_with_rules(vec![
        system_notification_rule("agent-started-notification", "agent.started", 90),
        custom_rule("agent-started-custom", "agent.started", 70),
        disabled_rule,
    ]);

    let plan = OutputPlanService::build_plan(&profile, "agent.started");

    assert_eq!("agent.started", plan.internal_event);
    assert!(plan.actions.is_empty());
}

#[test]
fn returns_empty_plan_when_internal_event_has_no_device_channel_rules() {
    let profile = profile_with_rules(vec![device_channel_rule(
        "agent-failed-desk-gp2",
        "agent.failed",
        "desk-pico",
        "pin.gp2",
        DeviceChannelActionType::Blink,
        80,
    )]);

    let plan = OutputPlanService::build_plan(&profile, "agent.completed");

    assert_eq!("agent.completed", plan.internal_event);
    assert!(plan.actions.is_empty());
}

#[test]
fn preserves_device_channel_action_parameters() {
    let mut rule = device_channel_rule(
        "agent-running-led-color",
        "agent.running",
        "desk-pico",
        "ws2812.gp16",
        DeviceChannelActionType::SetColor,
        80,
    );
    rule.output.channel_actions[0].duty_percent = Some(60);
    rule.output.channel_actions[0].frequency_hz = Some(2200);
    rule.output.channel_actions[0].color = Some("#33ccff".to_string());
    rule.output.channel_actions[0].brightness_percent = Some(35);
    let profile = profile_with_rules(vec![rule]);

    let plan = OutputPlanService::build_plan(&profile, "agent.running");

    assert_eq!(1, plan.actions.len());
    let action = as_device_channel(&plan.actions[0]);
    assert_eq!(Some(60), action.duty_percent);
    assert_eq!(Some(2200), action.frequency_hz);
    assert_eq!(Some("#33ccff".to_string()), action.color);
    assert_eq!(Some(35), action.brightness_percent);
}

#[test]
fn build_plan_includes_display_extension_action_with_rendered_templates() {
    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-display-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: display_output(
            "desk-wio",
            "success",
            "{{source}} 已完成",
            "{{last_assistant_message}}",
        ),
    }]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "Codex"),
        ("last_assistant_message", "构建通过"),
    ]);
    let plan = OutputPlanService::build_plan_with_context(&profile, "agent.completed", &context);

    assert_eq!(1, plan.actions.len());
    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!("desk-wio", action.device_id);
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("success"), action.status.as_deref());
            assert_eq!(Some("Codex ???"), action.title.as_deref());
            assert_eq!(Some("????"), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn pico_buzzer_pattern_channel_action_keeps_channel_id() {
    let mut action = device_channel_action(
        "a1",
        "desk-pico",
        "buzzer.gp19",
        DeviceChannelActionType::Pattern,
    );
    action.duration_ms = None;
    action.pattern = Some("success".to_string());
    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-device-channel-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 90,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids = HashMap::from([("desk-pico".to_string(), "rp2040-pico".to_string())]);

    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.completed",
        &OutputTemplateContext::default(),
        &device_board_ids,
    );

    assert_eq!(1, plan.actions.len());
    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!("desk-pico", action.device_id);
            assert_eq!(DeviceExtensionActionType::BuzzerPattern, action.action);
            assert_eq!(Some("buzzer.gp19"), action.channel_id.as_deref());
            assert_eq!(Some("success"), action.pattern.as_deref());
        }
        other => panic!("expected buzzer pattern extension action, got {other:?}"),
    }
}

#[test]
fn wio_buzzer_pattern_channel_action_stays_board_level() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "buzzer.onboard",
        DeviceChannelActionType::Pattern,
    );
    action.duration_ms = None;
    action.pattern = Some("error".to_string());
    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-failed-device-channel-output".to_string(),
        internal_event: "agent.failed".to_string(),
        priority: 90,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);

    let device_board_ids =
        HashMap::from([("desk-wio".to_string(), "seeed-wio-terminal".to_string())]);

    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.failed",
        &OutputTemplateContext::default(),
        &device_board_ids,
    );

    assert_eq!(1, plan.actions.len());
    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!("desk-wio", action.device_id);
            assert_eq!(DeviceExtensionActionType::BuzzerPattern, action.action);
            assert_eq!(None, action.channel_id.as_deref());
            assert_eq!(Some("error"), action.pattern.as_deref());
        }
        other => panic!("expected buzzer pattern extension action, got {other:?}"),
    }
}

#[test]
fn device_channel_display_status_action_builds_display_extension_action() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_status = Some("notice".to_string());
    action.display_title_template = Some("{{source}} 状态".to_string());
    action.display_message_template = Some("{{last_assistant_message}}".to_string());
    action.display_title_max_chars = Some(39);
    action.display_message_max_chars = Some(95);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-device-display-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "Codex"),
        ("last_assistant_message", "任务完成"),
    ]);
    let plan = OutputPlanService::build_plan_with_context(&profile, "agent.completed", &context);

    assert_eq!(1, plan.actions.len());
    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!("desk-wio", action.device_id);
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("notice"), action.status.as_deref());
            assert_eq!(Some("Codex ??"), action.title.as_deref());
            assert_eq!(Some("????"), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_template_action_renders_to_display_status_for_legacy_firmware() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-success".to_string());
    action.display_status = Some("success".to_string());
    action.display_title_template = Some("{{display.title}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template = Some(vec!["{{source}}".to_string(), "Finished".to_string()]);
    action.display_title_max_chars = Some(39);
    action.display_message_max_chars = Some(95);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-display-template-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "Codex"),
        ("last_assistant_message", "完成主要修改"),
    ]);
    let plan = OutputPlanService::build_plan_with_context(&profile, "agent.completed", &context);

    assert_eq!(1, plan.actions.len());
    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!("desk-wio", action.device_id);
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("success"), action.status.as_deref());
            assert_eq!(Some("Task Done"), action.title.as_deref());
            assert_eq!(Some("Codex / Finished"), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_template_rendering_replaces_non_ascii_after_variable_expansion() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-success".to_string());
    action.display_status = Some("success".to_string());
    action.display_title_template = Some("{{source}} Done".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template = Some(vec!["{{source}}".to_string(), "完成".to_string()]);
    action.display_title_max_chars = Some(9);
    action.display_message_max_chars = Some(95);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-display-safe-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "编码助手")]);
    let plan = OutputPlanService::build_plan_with_context(&profile, "agent.completed", &context);

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(Some("???? Done"), action.title.as_deref());
            assert_eq!(Some("???? / ??"), action.message.as_deref());
            assert_eq!(
                Some(vec!["????".to_string(), "??".to_string()]),
                action.lines.clone()
            );
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_template_rendering_keeps_non_ascii_for_unicode_display_capability() {
    let mut action = device_channel_action(
        "a1",
        "desk-display",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_status = Some("notice".to_string());
    action.display_title_template = Some("{{source}} 状态".to_string());
    action.display_message_template = Some("{{last_assistant_message}}".to_string());

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-display-unicode-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids = HashMap::from([(
        "desk-display".to_string(),
        "unicode-display-test-board".to_string(),
    )]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "编码助手"),
        ("last_assistant_message", "任务完成"),
    ]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.completed",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(Some("编码助手 状态"), action.title.as_deref());
            assert_eq!(Some("任务完成"), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_template_action_uses_display_card_for_wio_display_capability() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-success".to_string());
    action.display_status = Some("success".to_string());
    action.display_icon = Some("check".to_string());
    action.display_title_template = Some("{{display.title}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template = Some(vec!["{{source}}".to_string(), "Finished".to_string()]);
    action.display_title_max_chars = Some(39);
    action.display_message_max_chars = Some(95);

    let mut profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-display-card-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    profile.device.board_id = "seeed-wio-terminal".to_string();

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context(&profile, "agent.completed", &context);

    assert_eq!(1, plan.actions.len());
    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!("desk-wio", action.device_id);
            assert_eq!(DeviceExtensionActionType::DisplayCard, action.action);
            assert_eq!(Some("success"), action.status.as_deref());
            assert_eq!(Some("Task Done"), action.title.as_deref());
            assert_eq!(Some("Codex / Finished"), action.message.as_deref());
            assert_eq!(Some("check"), action.icon.as_deref());
            assert_eq!(
                Some(vec!["Codex".to_string(), "Finished".to_string()]),
                action.lines.clone()
            );
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_template_action_uses_target_device_board_capability_over_profile_default_board() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-success".to_string());
    action.display_status = Some("success".to_string());
    action.display_title_template = Some("{{display.title}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template = Some(vec!["{{source}}".to_string(), "Finished".to_string()]);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-display-card-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-wio".to_string(), "seeed-wio-terminal".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.completed",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayCard, action.action);
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_template_action_clamps_text_to_target_display_capability() {
    let mut action = device_channel_action(
        "a1",
        "desk-oled",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-success".to_string());
    action.display_status = Some("success".to_string());
    action.display_title_template = Some("{{source}} build completed".to_string());
    action.display_message_template = Some("{{last_assistant_message}}".to_string());
    action.display_title_max_chars = Some(39);
    action.display_message_max_chars = Some(95);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-pico-oled-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-096".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "Codex"),
        (
            "last_assistant_message",
            "This message is intentionally longer than OLED line",
        ),
    ]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.completed",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(Some("Codex build comp"), action.title.as_deref());
            assert_eq!(Some("This message is "), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn legacy_display_output_clamps_text_to_target_display_capability() {
    let mut output = display_output(
        "desk-oled",
        "success",
        "{{source}} build completed",
        "{{last_assistant_message}}",
    );
    output.display_title_max_chars = Some(39);
    output.display_message_max_chars = Some(95);
    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-legacy-display-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output,
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-096".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "Codex"),
        (
            "last_assistant_message",
            "This message is intentionally longer than OLED line",
        ),
    ]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.completed",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(Some("Codex build comp"), action.title.as_deref());
            assert_eq!(Some("This message is "), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn legacy_display_output_builds_for_pico_oled_091_status_capability() {
    let output = display_output(
        "desk-oled",
        "success",
        "{{source}} build completed",
        "{{last_assistant_message}}",
    );
    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-completed-legacy-display-output".to_string(),
        internal_event: "agent.completed".to_string(),
        priority: 80,
        enabled: true,
        output,
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-091".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![
        ("source", "Codex"),
        ("last_assistant_message", "Finished"),
    ]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.completed",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("Codex build comp"), action.title.as_deref());
            assert_eq!(Some("Finished"), action.message.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_output_template_uses_compact_copy_for_pico_oled_091_running_scene() {
    let mut output = display_output(
        "desk-oled",
        "working",
        "{{display.title}}",
        "{{display.lines}}",
    );
    output.display_template_id = Some("task-running".to_string());
    output.display_icon = Some("spinner".to_string());
    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-running-display-output".to_string(),
        internal_event: "agent.running".to_string(),
        priority: 80,
        enabled: true,
        output,
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-091".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.running",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("working"), action.status.as_deref());
            assert_eq!(Some("Working"), action.title.as_deref());
            assert_eq!(Some("Running"), action.message.as_deref());
            assert_eq!(Some("spinner"), action.icon.as_deref());
            assert_eq!(Some(vec!["Running".to_string()]), action.lines.clone());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_status_template_prefers_status_layout_when_title_and_message_are_present() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_status = Some("notice".to_string());
    action.display_title_template = Some("{{source}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template = Some(vec!["{{source}}".to_string(), "Waiting".to_string()]);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-started-display-lines-output".to_string(),
        internal_event: "agent.started".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-wio".to_string(), "seeed-wio-terminal".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.started",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("Codex"), action.title.as_deref());
            assert_eq!(Some("Codex / Waiting"), action.message.as_deref());
            assert_eq!(
                Some(vec!["Codex".to_string(), "Waiting".to_string()]),
                action.lines.clone()
            );
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_status_action_builds_for_pico_oled_091_with_compact_status_message() {
    let mut action = device_channel_action(
        "a1",
        "desk-oled",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_status = Some("notice".to_string());
    action.display_title_template = Some("{{source}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template =
        Some(vec!["{{source}}".to_string(), "Status updated".to_string()]);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-started-display-output".to_string(),
        internal_event: "agent.started".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-091".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.started",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("Codex"), action.title.as_deref());
            assert_eq!(Some("Status updated"), action.message.as_deref());
            assert_eq!(Some("notice"), action.status.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_status_template_uses_compact_copy_for_pico_oled_091_running_scene() {
    let mut action = device_channel_action(
        "a1",
        "desk-oled",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-running".to_string());
    action.display_status = Some("working".to_string());
    action.display_title_template = Some("{{display.title}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-working-display-output".to_string(),
        internal_event: "agent.working".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-091".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.working",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("Working"), action.title.as_deref());
            assert_eq!(Some("Running"), action.message.as_deref());
            assert_eq!(Some("working"), action.status.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_status_template_uses_small_copy_for_pico_oled_096_running_scene() {
    let mut action = device_channel_action(
        "a1",
        "desk-oled",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_template_id = Some("task-running".to_string());
    action.display_status = Some("working".to_string());
    action.display_title_template = Some("{{display.title}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-working-display-output".to_string(),
        internal_event: "agent.working".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-096".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.working",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("Working"), action.title.as_deref());
            assert_eq!(Some("Codex / Running"), action.message.as_deref());
            assert_eq!(Some("working"), action.status.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn display_status_action_builds_for_pico_oled_096_with_small_status_message() {
    let mut action = device_channel_action(
        "a1",
        "desk-oled",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_status = Some("notice".to_string());
    action.display_title_template = Some("{{source}}".to_string());
    action.display_message_template = Some("{{display.lines}}".to_string());
    action.display_lines_template =
        Some(vec!["{{source}}".to_string(), "Status updated".to_string()]);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-started-display-output".to_string(),
        internal_event: "agent.started".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-oled".to_string(), "rp2040-pico-oled-096".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.started",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayStatus, action.action);
            assert_eq!(Some("Codex"), action.title.as_deref());
            assert_eq!(Some("Codex / Status u"), action.message.as_deref());
            assert_eq!(Some("notice"), action.status.as_deref());
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

#[test]
fn line_only_display_action_uses_display_lines_for_line_capability() {
    let mut action = device_channel_action(
        "a1",
        "desk-wio",
        "display",
        DeviceChannelActionType::DisplayStatus,
    );
    action.duration_ms = None;
    action.display_status = Some("notice".to_string());
    action.display_title_template = None;
    action.display_message_template = None;
    action.display_lines_template = Some(vec!["{{source}}".to_string(), "Waiting".to_string()]);

    let profile = profile_with_rules(vec![HardwareRule {
        id: "agent-started-display-lines-output".to_string(),
        internal_event: "agent.started".to_string(),
        priority: 80,
        enabled: true,
        output: HardwareOutput {
            channel_actions: vec![action],
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
    }]);
    let device_board_ids =
        HashMap::from([("desk-wio".to_string(), "seeed-wio-terminal".to_string())]);

    let context = OutputTemplateContext::from_pairs(vec![("source", "Codex")]);
    let plan = OutputPlanService::build_plan_with_context_and_device_boards(
        &profile,
        "agent.started",
        &context,
        &device_board_ids,
    );

    match &plan.actions[0] {
        OutputExecutionAction::DeviceExtension(action) => {
            assert_eq!(DeviceExtensionActionType::DisplayLines, action.action);
            assert_eq!(
                Some(vec!["Codex".to_string(), "Waiting".to_string()]),
                action.lines.clone()
            );
        }
        other => panic!("expected display extension action, got {other:?}"),
    }
}

fn profile_with_rules(hardware_rules: Vec<HardwareRule>) -> NoticeProfile {
    NoticeProfile {
        id: "plan-test".to_string(),
        name: "Plan Test".to_string(),
        enabled_hook_events: Vec::new(),
        ai_event_mappings: Vec::new(),
        hardware_rules,
        device: default_device_profile(),
    }
}

fn device_channel_rule(
    id: &str,
    internal_event: &str,
    device_id: &str,
    channel_id: &str,
    action: DeviceChannelActionType,
    priority: u8,
) -> HardwareRule {
    device_channel_rule_with_actions(
        id,
        internal_event,
        priority,
        vec![device_channel_action("a1", device_id, channel_id, action)],
    )
}

fn device_channel_rule_with_actions(
    id: &str,
    internal_event: &str,
    priority: u8,
    channel_actions: Vec<DeviceChannelRuleAction>,
) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output: HardwareOutput {
            channel_actions,
            ..output_with_type(HardwareOutputType::DeviceChannel)
        },
        priority,
        enabled: true,
    }
}

fn system_notification_rule(id: &str, internal_event: &str, priority: u8) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output: output_with_type(HardwareOutputType::SystemNotification),
        priority,
        enabled: true,
    }
}

fn custom_rule(id: &str, internal_event: &str, priority: u8) -> HardwareRule {
    HardwareRule {
        id: id.to_string(),
        internal_event: internal_event.to_string(),
        output: output_with_type(HardwareOutputType::Custom),
        priority,
        enabled: true,
    }
}

fn output_with_type(output_type: HardwareOutputType) -> HardwareOutput {
    HardwareOutput {
        output_type,
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
            Some(250)
        } else {
            None
        },
        duty_percent: None,
        frequency_hz: None,
        color: None,
        brightness_percent: None,
        pattern: None,
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

fn display_output(device_id: &str, status: &str, title: &str, message: &str) -> HardwareOutput {
    HardwareOutput {
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
        display_device_id: Some(device_id.to_string()),
        display_template_id: None,
        display_accent: None,
        display_icon: None,
        display_lines_template: None,
        display_status: Some(status.to_string()),
        display_title_template: Some(title.to_string()),
        display_message_template: Some(message.to_string()),
        display_title_max_chars: Some(39),
        display_message_max_chars: Some(95),
        display_expire_behavior: Some("restore-status".to_string()),
        desktop_notice_targets: Vec::new(),
    }
}

fn as_device_channel(action: &OutputExecutionAction) -> &DeviceChannelAction {
    match action {
        OutputExecutionAction::DeviceChannel(action) => action,
        other => panic!("expected device channel action, got {other:?}"),
    }
}
