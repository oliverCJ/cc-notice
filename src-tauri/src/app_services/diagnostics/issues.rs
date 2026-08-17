use crate::app_services::diagnostics_service::DiagnosticsInput;
use crate::core::diagnostics::{
    DiagnosticActionKind, DiagnosticIssue, DiagnosticSeverity, DiagnosticsDeviceIssue,
    DiagnosticsDeviceSummary,
};
use crate::core::profiles::NoticeProfile;

pub fn build_issues(
    input: &DiagnosticsInput,
    device_summary: &DiagnosticsDeviceSummary,
    device_issues: &[DiagnosticsDeviceIssue],
) -> Vec<DiagnosticIssue> {
    let mut issues = Vec::new();

    if !input.hook_server_running {
        issues.push(
            DiagnosticIssue::new(
                "hookService.notRunning",
                DiagnosticSeverity::Error,
                "hookService",
                DiagnosticActionKind::OpenDebug,
            )
            .with_context(input.hook_server_error.clone().unwrap_or_default()),
        );
    }

    if !input.relay_source_exists || !input.relay_installed_exists {
        issues.push(DiagnosticIssue::new(
            "relay.notInstalled",
            DiagnosticSeverity::Error,
            "relay",
            DiagnosticActionKind::OpenHookSettings,
        ));
    } else if !input.relay_content_matches {
        issues.push(DiagnosticIssue::new(
            "relay.outdated",
            DiagnosticSeverity::Warning,
            "relay",
            DiagnosticActionKind::OpenHookSettings,
        ));
    }

    for target in input
        .hook_targets
        .iter()
        .filter(|target| target.enabled && !target.matches_selected_events)
    {
        issues.push(
            DiagnosticIssue::new(
                "hookConfig.targetNotSynced",
                DiagnosticSeverity::Warning,
                "hookConfig",
                DiagnosticActionKind::OpenHookSettings,
            )
            .with_context(target.label.clone()),
        );
    }

    if mapping_without_output_count(&input.profile) > 0 {
        issues.push(DiagnosticIssue::new(
            "profile.mappingWithoutOutput",
            DiagnosticSeverity::Error,
            "profile",
            DiagnosticActionKind::OpenAiEventMapping,
        ));
    }

    if device_summary.registered_count == 0 {
        issues.push(DiagnosticIssue::new(
            "device.noneRegistered",
            DiagnosticSeverity::Warning,
            "devices",
            DiagnosticActionKind::OpenDevices,
        ));
    }

    for issue in device_issues {
        let issue_id = match issue.reason.as_str() {
            "referenced-offline" => "device.referencedOffline",
            "heartbeat-issue" => "device.heartbeatIssue",
            "firmware-issue" => "device.firmwareIssue",
            _ => "device.runtimeIssue",
        };
        issues.push(
            DiagnosticIssue::new(
                issue_id,
                DiagnosticSeverity::Warning,
                "devices",
                DiagnosticActionKind::OpenDevices,
            )
            .with_context(issue.device_id.clone()),
        );
    }

    if input.runtime_snapshot.total_failures > 0 || input.runtime_snapshot.runtime_error_count > 0 {
        issues.push(DiagnosticIssue::new(
            "runtime.recentFailure",
            DiagnosticSeverity::Warning,
            "runtime",
            DiagnosticActionKind::OpenDebug,
        ));
    }

    issues
}

pub fn mapping_without_output_count(profile: &NoticeProfile) -> usize {
    profile
        .ai_event_mappings
        .iter()
        .filter(|mapping| mapping.enabled)
        .filter(|mapping| {
            profile
                .map_hardware_outputs(&mapping.internal_event)
                .is_empty()
        })
        .count()
}
