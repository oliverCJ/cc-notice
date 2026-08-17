use crate::app_services::diagnostics::devices::device_summary;
use crate::app_services::diagnostics::issues::mapping_without_output_count;
use crate::app_services::diagnostics_service::DiagnosticsInput;
use crate::core::diagnostics::{DiagnosticActionKind, DiagnosticSection, DiagnosticStatus};

pub fn build_sections(input: &DiagnosticsInput) -> Vec<DiagnosticSection> {
    vec![
        hook_service_section(input),
        relay_section(input),
        hook_config_section(input),
        profile_section(input),
        device_section(input),
    ]
}

fn hook_service_section(input: &DiagnosticsInput) -> DiagnosticSection {
    DiagnosticSection {
        id: "hookService".to_string(),
        status: if input.hook_server_running {
            DiagnosticStatus::Ok
        } else {
            DiagnosticStatus::Error
        },
        action: DiagnosticActionKind::OpenDebug,
        detail: input.hook_server_error.clone(),
        checked_at: input.checked_at.clone(),
    }
}

fn relay_section(input: &DiagnosticsInput) -> DiagnosticSection {
    let status = if !input.relay_source_exists || !input.relay_installed_exists {
        DiagnosticStatus::Error
    } else if !input.relay_content_matches {
        DiagnosticStatus::Warning
    } else {
        DiagnosticStatus::Ok
    };

    DiagnosticSection {
        id: "relay".to_string(),
        status,
        action: DiagnosticActionKind::OpenHookSettings,
        detail: None,
        checked_at: input.checked_at.clone(),
    }
}

fn hook_config_section(input: &DiagnosticsInput) -> DiagnosticSection {
    let status = if input.hook_targets.is_empty() {
        DiagnosticStatus::NotConfigured
    } else if input
        .hook_targets
        .iter()
        .any(|target| target.enabled && !target.matches_selected_events)
    {
        DiagnosticStatus::Warning
    } else if input.hook_targets.iter().any(|target| target.enabled) {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::NotConfigured
    };

    DiagnosticSection {
        id: "hookConfig".to_string(),
        status,
        action: DiagnosticActionKind::OpenHookSettings,
        detail: None,
        checked_at: input.checked_at.clone(),
    }
}

fn profile_section(input: &DiagnosticsInput) -> DiagnosticSection {
    let has_profile_rules = input
        .profile
        .ai_event_mappings
        .iter()
        .any(|mapping| mapping.enabled)
        || input.profile.hardware_rules.iter().any(|rule| rule.enabled);
    let status = if mapping_without_output_count(&input.profile) > 0 {
        DiagnosticStatus::Error
    } else if has_profile_rules {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::NotConfigured
    };

    DiagnosticSection {
        id: "profile".to_string(),
        status,
        action: DiagnosticActionKind::OpenAiEventMapping,
        detail: None,
        checked_at: input.checked_at.clone(),
    }
}

fn device_section(input: &DiagnosticsInput) -> DiagnosticSection {
    let summary = device_summary(&input.profile, &input.device_states);
    let status = if summary.registered_count == 0 {
        DiagnosticStatus::NotConfigured
    } else if summary.referenced_unavailable_count > 0
        || summary.heartbeat_issue_count > 0
        || summary.firmware_issue_count > 0
    {
        DiagnosticStatus::Warning
    } else if summary.connected_count > 0 {
        DiagnosticStatus::Ok
    } else {
        DiagnosticStatus::Warning
    };

    DiagnosticSection {
        id: "devices".to_string(),
        status,
        action: DiagnosticActionKind::OpenDevices,
        detail: None,
        checked_at: input.checked_at.clone(),
    }
}
