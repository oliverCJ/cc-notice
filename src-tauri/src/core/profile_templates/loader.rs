use std::collections::HashSet;

use crate::core::profile_templates::schema::TemplateConfig;
use crate::core::profiles::{
    AiEventMapping, HardwareOutput, HardwareRule, NoticeProfile, ProfileTemplate,
};

use super::schema::TemplateDefinition;

const PROFILE_TEMPLATES_YAML: &str = include_str!("../../../templates/profile_templates.yaml");

pub fn load_template_config() -> Result<TemplateConfig, String> {
    serde_yaml::from_str(PROFILE_TEMPLATES_YAML)
        .map_err(|err| format!("failed to parse profile template yaml: {err}"))
}

pub fn list_templates() -> Result<Vec<TemplateDefinition>, String> {
    let config = load_template_config()?;
    validate_template_config(&config.templates)?;
    Ok(ProfileTemplate::all()
        .into_iter()
        .filter_map(|template| find_template(&config.templates, template).cloned())
        .collect())
}

pub fn get_template(template: ProfileTemplate) -> Result<TemplateDefinition, String> {
    let config = load_template_config()?;
    validate_template_config(&config.templates)?;
    find_template(&config.templates, template)
        .cloned()
        .ok_or_else(|| format!("profile template not found: {}", template.id()))
}

pub fn apply_template_to_profile(
    template: ProfileTemplate,
    profile: &mut NoticeProfile,
) -> Result<(), String> {
    let definition = get_template(template)?;
    profile.ai_event_mappings = definition
        .ai_event_mappings
        .into_iter()
        .map(|mapping| AiEventMapping {
            id: mapping.id,
            source: mapping.source,
            event: mapping.event,
            internal_event: mapping.internal_event,
            enabled: true,
        })
        .collect();
    profile.hardware_rules = definition
        .hardware_rules
        .into_iter()
        .map(|rule| HardwareRule {
            id: rule.id,
            internal_event: rule.internal_event,
            output: HardwareOutput {
                output_type: rule.output.output_type,
                channel_actions: rule.output.channel_actions,
                duration_ms: rule.output.duration_ms,
                text: None,
                notification_level: rule.output.notification_level,
                notification_title: rule.output.notification_title,
                notification_body: rule.output.notification_body,
                notification_title_max_chars: rule.output.notification_title_max_chars,
                notification_body_max_chars: rule.output.notification_body_max_chars,
                notification_throttle_seconds: rule.output.notification_throttle_seconds,
                notification_sound: rule.output.notification_sound,
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
            priority: rule.priority,
            enabled: true,
        })
        .collect();

    Ok(())
}

fn find_template(
    templates: &[TemplateDefinition],
    template: ProfileTemplate,
) -> Option<&TemplateDefinition> {
    templates.iter().find(|item| item.id == template.id())
}

fn validate_template_config(templates: &[TemplateDefinition]) -> Result<(), String> {
    let mut ids = HashSet::new();
    for template in templates {
        if !ids.insert(template.id.as_str()) {
            return Err(format!("duplicate profile template id: {}", template.id));
        }
    }

    for template in ProfileTemplate::all() {
        if find_template(templates, template).is_none() {
            return Err(format!("missing profile template: {}", template.id()));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::core::hook_events::mapped_notice_event;
    use crate::core::profiles::{
        default_device_profile, NoticeProfile, ProfileTemplate, DEFAULT_PROFILE_ID,
    };

    #[test]
    fn loads_all_profile_templates_from_yaml() {
        let config = super::load_template_config().expect("template yaml should parse");

        assert_eq!(3, config.templates.len());
        for template in ProfileTemplate::all() {
            let id = template.id();
            assert!(
                config.templates.iter().any(|item| item.id == id),
                "missing template {id}"
            );
        }
    }

    #[test]
    fn applies_each_template_to_valid_profile() {
        for template in ProfileTemplate::all() {
            let mut profile = NoticeProfile {
                id: DEFAULT_PROFILE_ID.to_string(),
                name: "模板校验".to_string(),
                enabled_hook_events: Vec::new(),
                ai_event_mappings: Vec::new(),
                hardware_rules: Vec::new(),
                device: default_device_profile(),
            };

            super::apply_template_to_profile(template, &mut profile)
                .expect("template should apply");

            profile
                .validate()
                .expect("template profile should be valid");
        }
    }

    #[test]
    fn non_blank_templates_do_not_enable_hook_events() {
        for template in ProfileTemplate::all() {
            if template == ProfileTemplate::Blank {
                continue;
            }
            let mut profile = NoticeProfile {
                id: DEFAULT_PROFILE_ID.to_string(),
                name: "模板 Hook 全局化校验".to_string(),
                enabled_hook_events: Vec::new(),
                ai_event_mappings: Vec::new(),
                hardware_rules: Vec::new(),
                device: default_device_profile(),
            };

            super::apply_template_to_profile(template, &mut profile)
                .expect("template should apply");

            assert!(
                profile.enabled_hook_events.is_empty(),
                "template {} must not preset enabled hook events",
                template.id()
            );
            assert!(
                !profile.ai_event_mappings.is_empty(),
                "template {} should still preset ai event mappings",
                template.id()
            );
            assert!(
                !profile.hardware_rules.is_empty(),
                "template {} should still preset output rules",
                template.id()
            );
        }
    }

    #[test]
    fn each_non_blank_template_has_output_rules_for_mapped_internal_events() {
        for template in ProfileTemplate::all() {
            if template == ProfileTemplate::Blank {
                continue;
            }
            let mut profile = NoticeProfile {
                id: DEFAULT_PROFILE_ID.to_string(),
                name: "模板输出完整性校验".to_string(),
                enabled_hook_events: Vec::new(),
                ai_event_mappings: Vec::new(),
                hardware_rules: Vec::new(),
                device: default_device_profile(),
            };

            super::apply_template_to_profile(template, &mut profile)
                .expect("template should apply");

            for mapping in &profile.ai_event_mappings {
                assert!(
                    profile
                        .hardware_rules
                        .iter()
                        .any(|rule| rule.internal_event == mapping.internal_event),
                    "template {} maps {} to {} but has no output rule for that internal event",
                    template.id(),
                    mapping.event,
                    mapping.internal_event
                );
            }
        }
    }

    #[test]
    fn templates_contain_claude_code_core_mappings_and_system_notifications() {
        for template in [ProfileTemplate::Basic, ProfileTemplate::Advanced] {
            let definition =
                super::get_template(template).expect("claude-code template should exist");

            for event in claude_code_core_events() {
                let expected_internal_event = mapped_notice_event("claude-code", event)
                    .expect("claude-code core event should exist in hook catalog");
                assert!(
                    definition.ai_event_mappings.iter().any(|mapping| {
                        mapping.source == "claude-code"
                            && mapping.event == event
                            && mapping.internal_event == expected_internal_event
                    }),
                    "template {} missing claude-code mapping {event} -> {expected_internal_event}",
                    template.id()
                );
            }

            let mapped_internal_events = definition
                .ai_event_mappings
                .iter()
                .filter(|mapping| {
                    mapping.source == "claude-code"
                        && claude_code_core_events().contains(&mapping.event.as_str())
                })
                .map(|mapping| mapping.internal_event.as_str())
                .collect::<std::collections::HashSet<_>>();

            for internal_event in mapped_internal_events {
                assert!(
                    definition.hardware_rules.iter().any(|rule| {
                        rule.internal_event == internal_event
                            && rule.output.output_type
                                == crate::core::profiles::HardwareOutputType::SystemNotification
                    }),
                    "template {} missing system notification output for {internal_event}",
                    template.id()
                );
            }
        }
    }

    #[test]
    fn advanced_template_contains_new_tool_extension_mappings() {
        let definition =
            super::get_template(ProfileTemplate::Advanced).expect("advanced template should exist");
        for (source, event) in [
            ("gemini-cli", "PreCompress"),
            ("cursor", "subagentStart"),
            ("github-copilot-cli", "notification"),
        ] {
            assert!(
                definition
                    .ai_event_mappings
                    .iter()
                    .any(|mapping| mapping.source == source && mapping.event == event),
                "advanced template missing {source} {event} mapping"
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
    fn blank_template_keeps_rule_collections_empty() {
        let mut profile = NoticeProfile {
            id: DEFAULT_PROFILE_ID.to_string(),
            name: "空白模板".to_string(),
            enabled_hook_events: Vec::new(),
            ai_event_mappings: Vec::new(),
            hardware_rules: Vec::new(),
            device: default_device_profile(),
        };

        super::apply_template_to_profile(ProfileTemplate::Blank, &mut profile)
            .expect("blank template should apply");

        assert!(profile.enabled_hook_events.is_empty());
        assert!(profile.ai_event_mappings.is_empty());
        assert!(profile.hardware_rules.is_empty());
    }
}
