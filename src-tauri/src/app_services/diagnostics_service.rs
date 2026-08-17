use crate::app_services::hook_event_service::HookConfigTargetStatus;
use crate::app_services::runtime_monitor::RuntimeMonitorSnapshot;
use crate::core::device::DeviceRuntimeState;
use crate::core::diagnostics::{
    sort_issues, DiagnosticAction, DiagnosticActionKind, DiagnosticSeverity, DiagnosticStatus,
    DiagnosticsDeviceHealthStatus, DiagnosticsSnapshot,
};
use crate::core::profiles::NoticeProfile;

#[derive(Debug, Clone)]
pub struct DiagnosticsInput {
    pub checked_at: String,
    pub hook_server_running: bool,
    pub hook_server_error: Option<String>,
    pub relay_source_exists: bool,
    pub relay_installed_exists: bool,
    pub relay_content_matches: bool,
    pub hook_targets: Vec<HookConfigTargetStatus>,
    pub profile: NoticeProfile,
    pub device_states: Vec<DeviceRuntimeState>,
    pub runtime_snapshot: RuntimeMonitorSnapshot,
}

pub struct DiagnosticsService;

impl DiagnosticsService {
    pub fn snapshot(input: DiagnosticsInput) -> DiagnosticsSnapshot {
        let sections = crate::app_services::diagnostics::sections::build_sections(&input);
        let device_summary = crate::app_services::diagnostics::devices::device_summary(
            &input.profile,
            &input.device_states,
        );
        let device_issues = crate::app_services::diagnostics::devices::device_issues(
            &input.profile,
            &input.device_states,
        );
        let device_health = crate::app_services::diagnostics::devices::device_health_snapshot(
            &input.profile,
            &input.device_states,
        );
        let mut issues = crate::app_services::diagnostics::issues::build_issues(
            &input,
            &device_summary,
            &device_issues,
        );
        sort_issues(&mut issues);

        let mut statuses = sections
            .iter()
            .map(|section| section.status)
            .collect::<Vec<_>>();
        statuses.extend(device_issues.iter().map(|issue| issue.status));
        statuses.extend(issues.iter().map(|issue| match issue.severity {
            DiagnosticSeverity::Error => DiagnosticStatus::Error,
            DiagnosticSeverity::Warning => DiagnosticStatus::Warning,
            DiagnosticSeverity::Info => DiagnosticStatus::Ok,
        }));
        statuses.extend(
            device_health
                .details
                .iter()
                .map(|detail| device_health_status_to_diagnostic_status(detail.status)),
        );

        DiagnosticsSnapshot {
            overall_status: DiagnosticStatus::overall(statuses),
            checked_at: input.checked_at.clone(),
            sections,
            issues,
            quick_actions: quick_actions(),
            device_summary,
            device_issues,
            device_health,
        }
    }
}

fn quick_actions() -> Vec<DiagnosticAction> {
    vec![
        DiagnosticAction {
            kind: DiagnosticActionKind::RefreshDiagnostics,
            enabled: true,
        },
        DiagnosticAction {
            kind: DiagnosticActionKind::AutoConnectRegisteredDevices,
            enabled: true,
        },
        DiagnosticAction {
            kind: DiagnosticActionKind::SendTestEvent,
            enabled: true,
        },
    ]
}

fn device_health_status_to_diagnostic_status(
    status: DiagnosticsDeviceHealthStatus,
) -> DiagnosticStatus {
    match status {
        DiagnosticsDeviceHealthStatus::Ok => DiagnosticStatus::Ok,
        DiagnosticsDeviceHealthStatus::Warning => DiagnosticStatus::Warning,
        DiagnosticsDeviceHealthStatus::Error => DiagnosticStatus::Error,
        DiagnosticsDeviceHealthStatus::Unknown => DiagnosticStatus::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_services::hook_event_service::HookConfigTargetStatus;
    use crate::app_services::runtime_monitor::RuntimeMonitorSnapshot;
    use crate::core::device::{
        DeviceChannelActionType, DeviceConnectionStatus, DeviceFirmwareStatus,
        DeviceHeartbeatStatus, DeviceRuntimeState,
    };
    use crate::core::diagnostics::DiagnosticStatus;
    use crate::core::profiles::{
        DeviceChannelRuleAction, HardwareOutput, HardwareOutputType, HardwareRule,
    };

    #[test]
    fn snapshot_does_not_report_profile_hook_selection_issues() {
        let mut profile = crate::core::profiles::NoticeProfile::daily_coding();
        profile.ai_event_mappings.clear();

        let mut offline_device = DeviceRuntimeState::disconnected();
        offline_device.device_id = Some("desk-pico".to_string());
        offline_device.device_uid = Some("rp2040-pico:0011223344556677".to_string());
        offline_device.status = DeviceConnectionStatus::Disconnected;

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile,
            device_states: vec![offline_device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert!(snapshot
            .issues
            .iter()
            .all(|issue| issue.id != "profile.noEnabledHookEvent"
                && issue.id != "profile.enabledHookWithoutMapping"));
        assert_eq!(1, snapshot.device_summary.offline_count);
    }

    #[test]
    fn snapshot_quick_actions_only_include_real_actions() {
        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: Vec::new(),
            runtime_snapshot: empty_runtime_snapshot(),
        });

        let actions = snapshot
            .quick_actions
            .iter()
            .map(|action| action.kind.clone())
            .collect::<Vec<_>>();

        assert_eq!(
            vec![
                DiagnosticActionKind::RefreshDiagnostics,
                DiagnosticActionKind::AutoConnectRegisteredDevices,
                DiagnosticActionKind::SendTestEvent,
            ],
            actions
        );
    }

    #[test]
    fn snapshot_reports_each_abnormal_device_once() {
        let mut profile = crate::core::profiles::NoticeProfile::daily_coding();
        profile.hardware_rules.clear();
        profile
            .hardware_rules
            .push(device_channel_rule("agent-working-device", "desk-pico"));

        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-pico".to_string());
        device.status = DeviceConnectionStatus::Error;
        device.heartbeat_status = DeviceHeartbeatStatus::Lost;
        device.firmware_status = DeviceFirmwareStatus::Incompatible;

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile,
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert_eq!(1, snapshot.device_issues.len());
        assert_eq!("desk-pico", snapshot.device_issues[0].device_id);
        assert_eq!(DiagnosticStatus::Error, snapshot.device_issues[0].status);
        assert_eq!("connection-error", snapshot.device_issues[0].reason);
    }

    #[test]
    fn snapshot_includes_device_health_details() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-pico".to_string());
        device.board_id = Some("rp2040-pico".to_string());
        device.device_uid = Some("rp2040-pico:0011223344556677".to_string());
        device.status = DeviceConnectionStatus::Connected;
        device.heartbeat_status = DeviceHeartbeatStatus::Healthy;
        device.firmware_status = DeviceFirmwareStatus::UpToDate;

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-20T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert_eq!(1, snapshot.device_health.ok_count);
        assert_eq!(1, snapshot.device_health.details.len());
        assert_eq!("desk-pico", snapshot.device_health.details[0].device_id);
    }

    #[test]
    fn snapshot_overall_status_includes_device_health_warning() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-pico".to_string());
        device.board_id = Some("rp2040-pico".to_string());
        device.status = DeviceConnectionStatus::Connected;
        device.heartbeat_status = DeviceHeartbeatStatus::Healthy;
        device.firmware_status = DeviceFirmwareStatus::UpToDate;

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-20T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert_eq!(1, snapshot.device_health.warning_count);
        assert_eq!(DiagnosticStatus::Warning, snapshot.overall_status);
    }

    #[test]
    fn device_health_uses_error_code_without_reading_error_message() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-wio".to_string());
        device.board_id = Some("seeed-wio-terminal".to_string());
        device.status = DeviceConnectionStatus::Error;
        device.last_error = Some("任意展示文案".to_string());
        device.last_error_code =
            Some(crate::core::device::DeviceRuntimeErrorCode::DeviceTransportDisconnected);

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-20T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        let detail = &snapshot.device_health.details[0];
        assert_eq!(
            crate::core::diagnostics::DiagnosticsDeviceHealthStatus::Error,
            detail.status
        );
        assert!(detail
            .checks
            .iter()
            .any(|check| check.issue_code.as_deref() == Some("deviceTransportDisconnected")));
    }

    #[test]
    fn snapshot_reports_device_output_error_reason_from_error_code() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-pico".to_string());
        device.status = DeviceConnectionStatus::Error;
        device.last_error = Some("localized display message".to_string());
        device.last_error_code =
            Some(crate::core::device::DeviceRuntimeErrorCode::DeviceChannelActionUnsupported);

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert_eq!(1, snapshot.device_issues.len());
        assert_eq!(
            "device-action-unsupported",
            snapshot.device_issues[0].reason
        );
    }

    #[test]
    fn snapshot_reports_limited_identity_from_board_catalog() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-leonardo".to_string());
        device.board_id = Some("arduino-leonardo".to_string());
        device.status = DeviceConnectionStatus::Connected;

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert_eq!(1, snapshot.device_issues.len());
        assert_eq!("device-identity-limited", snapshot.device_issues[0].reason);
    }

    #[test]
    fn snapshot_does_not_warn_when_flash_strategy_is_not_automated() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-leonardo".to_string());
        device.board_id = Some("arduino-leonardo".to_string());
        device.status = DeviceConnectionStatus::Connected;
        device.device_uid = Some("arduino-leonardo:1234".to_string());

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert!(snapshot.device_issues.is_empty());
        assert_eq!(DiagnosticStatus::Ok, snapshot.overall_status);
        assert_eq!(DiagnosticStatus::Ok, snapshot.sections[4].status);
    }

    #[test]
    fn snapshot_reports_missing_board_catalog_entry() {
        let mut device = DeviceRuntimeState::disconnected();
        device.device_id = Some("desk-custom".to_string());
        device.board_id = Some("custom-board".to_string());
        device.status = DeviceConnectionStatus::Connected;

        let snapshot = DiagnosticsService::snapshot(DiagnosticsInput {
            checked_at: "2026-07-08T10:00:00+08:00".to_string(),
            hook_server_running: true,
            hook_server_error: None,
            relay_source_exists: true,
            relay_installed_exists: true,
            relay_content_matches: true,
            hook_targets: vec![hook_target("global-codex", true, true)],
            profile: crate::core::profiles::NoticeProfile::daily_coding(),
            device_states: vec![device],
            runtime_snapshot: empty_runtime_snapshot(),
        });

        assert_eq!(1, snapshot.device_issues.len());
        assert_eq!("board-catalog-missing", snapshot.device_issues[0].reason);
    }

    fn hook_target(
        id: &str,
        enabled: bool,
        matches_selected_events: bool,
    ) -> HookConfigTargetStatus {
        HookConfigTargetStatus {
            id: id.to_string(),
            scope: "global".to_string(),
            source: "codex".to_string(),
            label: id.to_string(),
            project_path: None,
            enabled,
            config_path: "/Users/test/.codex/hooks.json".to_string(),
            exists: true,
            can_create: false,
            matches_selected_events,
            debug_enabled: true,
        }
    }

    fn empty_runtime_snapshot() -> RuntimeMonitorSnapshot {
        RuntimeMonitorSnapshot {
            started_at: "2026-07-08T09:00:00+08:00".to_string(),
            uptime_seconds: 3600,
            total_events: 0,
            total_outputs: 0,
            total_failures: 0,
            events_by_source: Vec::new(),
            events_by_result: Vec::new(),
            output_attempts_by_type: Vec::new(),
            output_failures_by_type: Vec::new(),
            event_series: Vec::new(),
            output_series: Vec::new(),
            runtime_error_count: 0,
            last_event: None,
            last_output: None,
        }
    }

    fn device_channel_rule(internal_event: &str, device_id: &str) -> HardwareRule {
        HardwareRule {
            id: format!("{internal_event}-device-channel"),
            internal_event: internal_event.to_string(),
            output: HardwareOutput {
                output_type: HardwareOutputType::DeviceChannel,
                channel_actions: vec![DeviceChannelRuleAction {
                    id: "action-1".to_string(),
                    device_id: device_id.to_string(),
                    channel_id: "pin.gp2".to_string(),
                    channel_action: DeviceChannelActionType::Blink,
                    duration_ms: Some(1000),
                    interval_ms: Some(500),
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
            priority: 50,
            enabled: true,
        }
    }
}
