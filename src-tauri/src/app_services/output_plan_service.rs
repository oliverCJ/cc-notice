use crate::adapters::boards::BoardCatalogRegistry;
use crate::app_services::inbound_event::template_renderer::{
    render_template as render_inbound_template, RenderLimit, TemplateRenderContext,
};
use crate::app_services::inbound_event_service::SubmitRelayEventRequest;
use crate::core::device::{
    DeviceChannelAction, DeviceChannelActionType, DeviceDisplayCapabilities,
    DeviceDisplaySizeClass, DeviceDisplayTextEncoding, DeviceExtensionAction,
    DeviceExtensionActionType, OutputExecutionAction, OutputExecutionPlan,
};
use crate::core::profiles::{HardwareOutputType, HardwareRule, NoticeProfile};
use std::collections::HashMap;

pub struct OutputPlanService;

impl OutputPlanService {
    pub fn build_plan(profile: &NoticeProfile, internal_event: &str) -> OutputExecutionPlan {
        Self::build_plan_with_context(profile, internal_event, &OutputTemplateContext::default())
    }

    pub fn build_plan_with_context(
        profile: &NoticeProfile,
        internal_event: &str,
        context: &OutputTemplateContext,
    ) -> OutputExecutionPlan {
        Self::build_plan_with_context_and_device_boards(
            profile,
            internal_event,
            context,
            &HashMap::new(),
        )
    }

    pub fn build_plan_with_context_and_device_boards(
        profile: &NoticeProfile,
        internal_event: &str,
        context: &OutputTemplateContext,
        device_board_ids: &HashMap<String, String>,
    ) -> OutputExecutionPlan {
        let mut rules = profile
            .hardware_rules
            .iter()
            .filter(|rule| rule.enabled && rule.internal_event == internal_event)
            .collect::<Vec<_>>();
        rules.sort_by(|left, right| right.priority.cmp(&left.priority));

        OutputExecutionPlan {
            internal_event: internal_event.to_string(),
            actions: rules
                .into_iter()
                .flat_map(|rule| {
                    hardware_rule_to_actions(
                        rule,
                        context,
                        &profile.device.board_id,
                        device_board_ids,
                    )
                })
                .collect(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct OutputTemplateContext {
    values: HashMap<String, String>,
    relay_context: Option<TemplateRenderContext>,
}

impl OutputTemplateContext {
    pub fn from_pairs(pairs: Vec<(&str, &str)>) -> Self {
        Self {
            values: pairs
                .into_iter()
                .map(|(key, value)| (key.to_string(), value.to_string()))
                .collect(),
            relay_context: None,
        }
    }

    pub fn from_relay_request(request: &SubmitRelayEventRequest, internal_event: &str) -> Self {
        Self {
            values: HashMap::new(),
            relay_context: Some(TemplateRenderContext {
                source: request.source.clone(),
                event: request.event.clone(),
                internal_event: internal_event.to_string(),
                occurred_at: request.occurred_at.clone(),
                payload: request.payload.clone(),
                raw_payload: request.raw_payload.clone(),
            }),
        }
    }

    fn value(&self, key: &str) -> &str {
        self.values.get(key).map(String::as_str).unwrap_or("")
    }
}

fn hardware_rule_to_actions(
    rule: &HardwareRule,
    context: &OutputTemplateContext,
    fallback_board_id: &str,
    device_board_ids: &HashMap<String, String>,
) -> Vec<OutputExecutionAction> {
    match rule.output.output_type {
        HardwareOutputType::DeviceChannel => {
            device_channel_rule_to_actions(rule, context, fallback_board_id, device_board_ids)
        }
        HardwareOutputType::Display => {
            let action = display_rule_to_action(rule, context, fallback_board_id, device_board_ids);
            action
                .into_iter()
                .map(OutputExecutionAction::DeviceExtension)
                .collect()
        }
        _ => Vec::new(),
    }
}

fn device_channel_rule_to_actions(
    rule: &HardwareRule,
    context: &OutputTemplateContext,
    fallback_board_id: &str,
    device_board_ids: &HashMap<String, String>,
) -> Vec<OutputExecutionAction> {
    rule.output
        .channel_actions
        .iter()
        .filter_map(|action| {
            if action.channel_action == DeviceChannelActionType::Pattern {
                let device_id = action.device_id.trim();
                let board_id = device_board_ids
                    .get(device_id)
                    .map(String::as_str)
                    .unwrap_or(fallback_board_id);
                return Some(OutputExecutionAction::DeviceExtension(
                    DeviceExtensionAction {
                        device_id: device_id.to_string(),
                        channel_id: uses_channelized_buzzer_pattern(board_id)
                            .then(|| action.channel_id.trim().to_string()),
                        action: DeviceExtensionActionType::BuzzerPattern,
                        status: None,
                        title: None,
                        message: None,
                        icon: None,
                        lines: None,
                        pattern: action.pattern.clone(),
                        control: None,
                        active: None,
                    },
                ));
            }
            if action.channel_action == DeviceChannelActionType::DisplayStatus {
                let device_id = action.device_id.trim();
                let board_id = device_board_ids
                    .get(device_id)
                    .map(String::as_str)
                    .unwrap_or(fallback_board_id);
                let display_capabilities = display_capabilities_for_board(board_id);
                if display_capabilities
                    .as_ref()
                    .is_some_and(|display| !display.status)
                {
                    return None;
                }
                let text_encoding = display_capabilities
                    .as_ref()
                    .map(|display| display.text_encoding.clone())
                    .unwrap_or_default();
                let size_class = display_capabilities
                    .as_ref()
                    .map(|display| display.size_class.clone())
                    .unwrap_or_default();
                let title_max_chars = display_limit(
                    action.display_title_max_chars,
                    display_capabilities
                        .as_ref()
                        .map(|display| display.title_max_chars),
                    39,
                );
                let message_max_chars = display_limit(
                    action.display_message_max_chars,
                    display_capabilities
                        .as_ref()
                        .map(|display| display.message_max_chars),
                    95,
                );
                let title = action.display_title_template.as_ref().map(|template| {
                    render_display_template_value(
                        template,
                        action.display_template_id.as_deref(),
                        action.display_lines_template.as_ref(),
                        context,
                        title_max_chars,
                        &text_encoding,
                        &size_class,
                    )
                });
                let message = action.display_message_template.as_ref().map(|template| {
                    render_display_template_value(
                        template,
                        action.display_template_id.as_deref(),
                        action.display_lines_template.as_ref(),
                        context,
                        message_max_chars,
                        &text_encoding,
                        &size_class,
                    )
                });
                let lines = render_display_line_values(
                    action.display_template_id.as_deref(),
                    action.display_lines_template.as_ref(),
                    context,
                    message_max_chars.min(24),
                    &text_encoding,
                    &size_class,
                );
                return Some(OutputExecutionAction::DeviceExtension(
                    DeviceExtensionAction {
                        device_id: device_id.to_string(),
                        channel_id: None,
                        action: select_display_action_type(
                            board_id,
                            action.display_template_id.as_deref(),
                            title.as_deref(),
                            message.as_deref(),
                            &lines,
                        ),
                        status: action.display_status.clone(),
                        title,
                        message,
                        icon: action.display_icon.clone(),
                        lines: Some(lines).filter(|lines| !lines.is_empty()),
                        pattern: None,
                        control: None,
                        active: None,
                    },
                ));
            }
            Some(OutputExecutionAction::DeviceChannel(DeviceChannelAction {
                device_id: action.device_id.trim().to_string(),
                channel_id: action.channel_id.trim().to_string(),
                action: action.channel_action,
                duration_ms: action.duration_ms.map(u64::from),
                interval_ms: action.interval_ms,
                duty_percent: action.duty_percent,
                frequency_hz: action.frequency_hz,
                color: action.color.clone(),
                brightness_percent: action.brightness_percent,
                pattern: None,
                priority: rule.priority,
            }))
        })
        .collect()
}

fn display_rule_to_action(
    rule: &HardwareRule,
    context: &OutputTemplateContext,
    fallback_board_id: &str,
    device_board_ids: &HashMap<String, String>,
) -> Option<DeviceExtensionAction> {
    let output = &rule.output;
    let device_id = output.display_device_id.as_ref()?.trim();
    let board_id = device_board_ids
        .get(device_id)
        .map(String::as_str)
        .unwrap_or(fallback_board_id);
    let display_capabilities = display_capabilities_for_board(board_id);
    if display_capabilities
        .as_ref()
        .is_some_and(|display| !display.status)
    {
        return None;
    }
    let text_encoding = display_capabilities
        .as_ref()
        .map(|display| display.text_encoding.clone())
        .unwrap_or_default();
    let size_class = display_capabilities
        .as_ref()
        .map(|display| display.size_class.clone())
        .unwrap_or_default();
    let title_max_chars = display_limit(
        output.display_title_max_chars,
        display_capabilities
            .as_ref()
            .map(|display| display.title_max_chars),
        39,
    );
    let message_max_chars = display_limit(
        output.display_message_max_chars,
        display_capabilities
            .as_ref()
            .map(|display| display.message_max_chars),
        95,
    );
    let title = output.display_title_template.as_ref().map(|template| {
        render_display_template_value(
            template,
            output.display_template_id.as_deref(),
            output.display_lines_template.as_ref(),
            context,
            title_max_chars,
            &text_encoding,
            &size_class,
        )
    });
    let message = output.display_message_template.as_ref().map(|template| {
        render_display_template_value(
            template,
            output.display_template_id.as_deref(),
            output.display_lines_template.as_ref(),
            context,
            message_max_chars,
            &text_encoding,
            &size_class,
        )
    });
    let lines = render_display_line_values(
        output.display_template_id.as_deref(),
        output.display_lines_template.as_ref(),
        context,
        message_max_chars.min(24),
        &text_encoding,
        &size_class,
    );

    Some(DeviceExtensionAction {
        device_id: device_id.to_string(),
        channel_id: None,
        action: select_display_action_type(
            board_id,
            output.display_template_id.as_deref(),
            title.as_deref(),
            message.as_deref(),
            &lines,
        ),
        status: Some(output.display_status.as_ref()?.trim().to_string()),
        title,
        message,
        icon: output.display_icon.clone(),
        lines: Some(lines).filter(|lines| !lines.is_empty()),
        pattern: None,
        control: None,
        active: None,
    })
}

fn uses_channelized_buzzer_pattern(board_id: &str) -> bool {
    board_id.starts_with("rp2040-pico")
}

fn select_display_action_type(
    board_id: &str,
    template_id: Option<&str>,
    title: Option<&str>,
    message: Option<&str>,
    lines: &[String],
) -> DeviceExtensionActionType {
    let Some(display) = BoardCatalogRegistry::bundled().ok().and_then(|registry| {
        registry
            .board(board_id)
            .and_then(|board| board.device_extensions()?.display.clone())
    }) else {
        return DeviceExtensionActionType::DisplayStatus;
    };

    if template_id.is_some() && display.card {
        return DeviceExtensionActionType::DisplayCard;
    }
    if title.is_some_and(|value| !value.trim().is_empty())
        || message.is_some_and(|value| !value.trim().is_empty())
    {
        return DeviceExtensionActionType::DisplayStatus;
    }
    if !lines.is_empty() && display.lines {
        return DeviceExtensionActionType::DisplayLines;
    }
    DeviceExtensionActionType::DisplayStatus
}

fn display_capabilities_for_board(board_id: &str) -> Option<DeviceDisplayCapabilities> {
    #[cfg(test)]
    if board_id == "unicode-display-test-board" {
        return Some(DeviceDisplayCapabilities {
            status: true,
            card: false,
            lines: true,
            runtime: false,
            clear: true,
            size_class: DeviceDisplaySizeClass::Medium,
            statuses: Vec::new(),
            title_max_chars: 80,
            message_max_chars: 160,
            text_encoding: DeviceDisplayTextEncoding::Unicode,
        });
    }

    BoardCatalogRegistry::bundled().ok().and_then(|registry| {
        registry
            .board(board_id)
            .and_then(|board| board.device_extensions()?.display.clone())
    })
}

fn display_limit(
    saved_limit: Option<u32>,
    capability_limit: Option<u32>,
    default_limit: u32,
) -> usize {
    let saved = saved_limit.unwrap_or(default_limit);
    capability_limit.map_or(saved, |limit| saved.min(limit)) as usize
}

fn render_template(
    template: &str,
    context: &OutputTemplateContext,
    max_chars: usize,
    text_encoding: &DeviceDisplayTextEncoding,
) -> String {
    if let Some(relay_context) = &context.relay_context {
        let rendered =
            render_inbound_template(template, relay_context, RenderLimit::new(max_chars)).text;
        return truncate_display_text(rendered.trim(), max_chars, text_encoding);
    }

    let mut output = template.to_string();
    for key in [
        "source",
        "event",
        "internalEvent",
        "model",
        "timestamp",
        "last_assistant_message",
        "prompt",
        "tool_response",
        "error",
    ] {
        output = output.replace(&format!("{{{{{key}}}}}"), context.value(key));
    }
    truncate_display_text(output.trim(), max_chars, text_encoding)
}

fn render_display_template_value(
    template: &str,
    template_id: Option<&str>,
    lines: Option<&Vec<String>>,
    context: &OutputTemplateContext,
    max_chars: usize,
    text_encoding: &DeviceDisplayTextEncoding,
    size_class: &DeviceDisplaySizeClass,
) -> String {
    let output = template
        .replace("{{display.title}}", display_template_title(template_id))
        .replace(
            "{{display.lines}}",
            &render_display_lines(
                template_id,
                lines,
                context,
                max_chars,
                text_encoding,
                size_class,
            ),
        );
    render_template(&output, context, max_chars, text_encoding)
}

fn display_template_title(template_id: Option<&str>) -> &'static str {
    match template_id {
        Some("task-started") => "Working",
        Some("task-running") => "Working",
        Some("task-success") => "Task Done",
        Some("task-warning") => "Attention",
        Some("task-error") => "Task Failed",
        Some("waiting-input") => "Input Needed",
        _ => "Notice",
    }
}

fn render_display_lines(
    template_id: Option<&str>,
    lines: Option<&Vec<String>>,
    context: &OutputTemplateContext,
    max_chars: usize,
    text_encoding: &DeviceDisplayTextEncoding,
    size_class: &DeviceDisplaySizeClass,
) -> String {
    let rendered_lines = render_display_line_values(
        template_id,
        lines,
        context,
        max_chars.min(24),
        text_encoding,
        size_class,
    );
    if *size_class == DeviceDisplaySizeClass::Compact {
        return rendered_lines
            .iter()
            .rev()
            .find(|line| !line.trim().is_empty())
            .cloned()
            .unwrap_or_default();
    }
    rendered_lines.join(" / ")
}

fn render_display_line_values(
    template_id: Option<&str>,
    lines: Option<&Vec<String>>,
    context: &OutputTemplateContext,
    max_chars: usize,
    text_encoding: &DeviceDisplayTextEncoding,
    size_class: &DeviceDisplaySizeClass,
) -> Vec<String> {
    let line_templates = lines
        .cloned()
        .unwrap_or_else(|| default_display_line_templates(template_id, size_class));
    line_templates
        .iter()
        .map(|line| render_template(line, context, max_chars, text_encoding))
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
}

fn default_display_line_templates(
    template_id: Option<&str>,
    size_class: &DeviceDisplaySizeClass,
) -> Vec<String> {
    if *size_class == DeviceDisplaySizeClass::Compact {
        return vec![compact_display_line(template_id).to_string()];
    }

    match template_id {
        Some("task-started") => vec!["{{source}}".to_string(), "Started".to_string()],
        Some("task-running") => vec!["{{source}}".to_string(), "Running".to_string()],
        Some("task-success") => vec!["{{source}}".to_string(), "Finished".to_string()],
        Some("task-warning") => vec!["{{source}}".to_string(), "Check status".to_string()],
        Some("task-error") => vec!["{{source}}".to_string(), "Check details".to_string()],
        Some("waiting-input") => vec!["{{source}}".to_string(), "Waiting for you".to_string()],
        _ => vec!["{{source}}".to_string(), "Status updated".to_string()],
    }
}

fn compact_display_line(template_id: Option<&str>) -> &'static str {
    match template_id {
        Some("task-started") => "Started",
        Some("task-running") => "Running",
        Some("task-success") => "Done",
        Some("task-warning") => "Check",
        Some("task-error") => "Error",
        Some("waiting-input") => "Input",
        _ => "Updated",
    }
}

fn truncate_display_text(
    value: &str,
    max_chars: usize,
    text_encoding: &DeviceDisplayTextEncoding,
) -> String {
    match text_encoding {
        DeviceDisplayTextEncoding::Ascii => truncate_chars(&display_safe_text(value), max_chars),
        DeviceDisplayTextEncoding::Unicode => truncate_chars(value, max_chars),
    }
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn display_safe_text(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character == '\n'
                || character == '\r'
                || character == '\t'
                || (character.is_ascii() && !character.is_ascii_control())
            {
                character
            } else {
                '?'
            }
        })
        .collect()
}

#[cfg(test)]
#[path = "output_plan_service_tests.rs"]
mod tests;
