use crate::core::profiles::{HardwareOutputType, HardwareRule};
use crate::core::protocol::{NoticeCommand, NoticeCommandType};

pub(crate) fn hardware_rule_to_notice_command(
    rule: &HardwareRule,
) -> Result<NoticeCommand, String> {
    let text = match rule.output.output_type {
        HardwareOutputType::SystemNotification => system_notification_text(rule),
        HardwareOutputType::Webhook => "Webhook output queued".to_string(),
        HardwareOutputType::Sound => "Sound output queued".to_string(),
        HardwareOutputType::DeviceChannel => device_channel_text(rule),
        output_type => format!("Unsupported output type: {output_type:?}"),
    };

    Ok(NoticeCommand {
        command_type: NoticeCommandType::ShowText,
        text: Some(text),
        duration_ms: rule.output.duration_ms.map(u64::from),
        priority: rule.priority,
    })
}

fn system_notification_text(rule: &HardwareRule) -> String {
    match (
        rule.output.notification_title.as_deref(),
        rule.output.notification_body.as_deref(),
    ) {
        (Some(title), Some(body)) => format!("{title}: {body}"),
        (Some(title), None) => title.to_string(),
        (None, Some(body)) => body.to_string(),
        (None, None) => rule.output.text.clone().unwrap_or_default(),
    }
}

fn device_channel_text(rule: &HardwareRule) -> String {
    let summary = rule
        .output
        .channel_actions
        .iter()
        .map(|action| {
            format!(
                "{} / {} / {:?}",
                action.device_id, action.channel_id, action.channel_action
            )
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "Device channel output queued: {} action(s): {}",
        rule.output.channel_actions.len(),
        summary
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::device::DeviceChannelActionType;
    use crate::core::profiles::{DeviceChannelRuleAction, HardwareOutput, HardwareOutputType};

    #[test]
    fn device_channel_rule_builds_summary_command_without_deprecated_protocol() {
        let rule = HardwareRule {
            id: "agent-started-device-channel-test".to_string(),
            internal_event: "agent.started".to_string(),
            output: HardwareOutput {
                output_type: HardwareOutputType::DeviceChannel,
                channel_actions: vec![DeviceChannelRuleAction {
                    id: "a1".to_string(),
                    device_id: "desk-pico".to_string(),
                    channel_id: "pin.gp2".to_string(),
                    channel_action: DeviceChannelActionType::Activate,
                    duration_ms: None,
                    interval_ms: None,
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
                }],
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
        };

        let command = hardware_rule_to_notice_command(&rule).expect("command should map");

        assert_eq!(NoticeCommandType::ShowText, command.command_type);
        assert_eq!(
            Some(
                "Device channel output queued: 1 action(s): desk-pico / pin.gp2 / Activate"
                    .to_string()
            ),
            command.text
        );
    }
}
