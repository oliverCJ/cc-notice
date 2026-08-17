use std::collections::HashSet;

use crate::adapters::boards::BoardCatalogRegistry;
use crate::core::boards::StableUidPolicy;
use crate::core::device::{
    DeviceChannelDirection, DeviceConnectionStatus, DeviceFirmwareStatus, DeviceHeartbeatStatus,
    DeviceRuntimeErrorCode, DeviceRuntimeState,
};
use crate::core::diagnostics::{
    DiagnosticActionKind, DiagnosticStatus, DiagnosticsDeviceHealthCheck,
    DiagnosticsDeviceHealthDetail, DiagnosticsDeviceHealthSnapshot, DiagnosticsDeviceHealthStatus,
    DiagnosticsDeviceIssue, DiagnosticsDeviceSummary,
};
use crate::core::profiles::{HardwareOutputType, NoticeProfile};

pub fn device_summary(
    profile: &NoticeProfile,
    states: &[DeviceRuntimeState],
) -> DiagnosticsDeviceSummary {
    let referenced = referenced_device_ids(profile);
    let registered_count = states.len();
    let connected_count = states
        .iter()
        .filter(|state| state.status == DeviceConnectionStatus::Connected)
        .count();
    let offline_count = states
        .iter()
        .filter(|state| state.status != DeviceConnectionStatus::Connected)
        .count();
    let heartbeat_issue_count = states
        .iter()
        .filter(|state| {
            matches!(
                state.heartbeat_status,
                DeviceHeartbeatStatus::Lost | DeviceHeartbeatStatus::Stale
            )
        })
        .count();
    let firmware_issue_count = states
        .iter()
        .filter(|state| {
            matches!(
                state.firmware_status,
                DeviceFirmwareStatus::UpdateAvailable | DeviceFirmwareStatus::Incompatible
            )
        })
        .count();
    let referenced_unavailable_count = states
        .iter()
        .filter(|state| {
            state
                .device_id
                .as_ref()
                .map(|device_id| {
                    referenced.contains(device_id)
                        && state.status != DeviceConnectionStatus::Connected
                })
                .unwrap_or(false)
        })
        .count();

    DiagnosticsDeviceSummary {
        registered_count,
        connected_count,
        offline_count,
        heartbeat_issue_count,
        firmware_issue_count,
        referenced_unavailable_count,
    }
}

pub fn device_issues(
    profile: &NoticeProfile,
    states: &[DeviceRuntimeState],
) -> Vec<DiagnosticsDeviceIssue> {
    let referenced = referenced_device_ids(profile);
    let mut issues = Vec::new();

    for state in states {
        let Some(device_id) = state.device_id.as_ref() else {
            continue;
        };

        if let Some(issue) = prioritized_device_issue(state, device_id, &referenced) {
            upsert_device_issue(&mut issues, issue);
        }
    }

    issues
}

pub fn device_health_snapshot(
    profile: &NoticeProfile,
    states: &[DeviceRuntimeState],
) -> DiagnosticsDeviceHealthSnapshot {
    let referenced = referenced_device_ids(profile);
    let mut details = states
        .iter()
        .filter_map(|state| {
            state
                .device_id
                .as_deref()
                .map(|device_id| device_health_detail(state, device_id, &referenced))
        })
        .collect::<Vec<_>>();

    details.sort_by(|left, right| {
        right
            .status
            .priority()
            .cmp(&left.status.priority())
            .then_with(|| left.device_id.cmp(&right.device_id))
    });

    let ok_count = details
        .iter()
        .filter(|detail| detail.status == DiagnosticsDeviceHealthStatus::Ok)
        .count();
    let warning_count = details
        .iter()
        .filter(|detail| detail.status == DiagnosticsDeviceHealthStatus::Warning)
        .count();
    let error_count = details
        .iter()
        .filter(|detail| detail.status == DiagnosticsDeviceHealthStatus::Error)
        .count();

    DiagnosticsDeviceHealthSnapshot {
        ok_count,
        warning_count,
        error_count,
        details,
    }
}

fn device_health_detail(
    state: &DeviceRuntimeState,
    device_id: &str,
    referenced: &HashSet<String>,
) -> DiagnosticsDeviceHealthDetail {
    let checks = vec![
        connection_health_check(state),
        identity_health_check(state),
        firmware_health_check(state),
        heartbeat_health_check(state),
        rule_reference_health_check(state, device_id, referenced),
        input_config_health_check(state),
    ];
    let status = checks
        .iter()
        .map(|check| check.status)
        .max_by_key(|status| status.priority())
        .unwrap_or(DiagnosticsDeviceHealthStatus::Unknown);

    DiagnosticsDeviceHealthDetail {
        device_id: device_id.to_string(),
        label: None,
        board_id: state.board_id.clone(),
        status,
        checks,
    }
}

fn connection_health_check(state: &DeviceRuntimeState) -> DiagnosticsDeviceHealthCheck {
    match state.status {
        DeviceConnectionStatus::Connected => health_check(
            "connection",
            DiagnosticsDeviceHealthStatus::Ok,
            None,
            DiagnosticActionKind::OpenDevices,
            None,
        ),
        DeviceConnectionStatus::Connecting => health_check(
            "connection",
            DiagnosticsDeviceHealthStatus::Unknown,
            Some("deviceConnecting"),
            DiagnosticActionKind::OpenDevices,
            None,
        ),
        DeviceConnectionStatus::Disconnected => health_check(
            "connection",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("deviceNotConnected"),
            DiagnosticActionKind::AutoConnectRegisteredDevices,
            None,
        ),
        DeviceConnectionStatus::Error => {
            let issue_code = state
                .last_error_code
                .map(health_issue_from_error_code)
                .unwrap_or("connectionError");
            health_check(
                "connection",
                DiagnosticsDeviceHealthStatus::Error,
                Some(issue_code),
                DiagnosticActionKind::OpenDevices,
                None,
            )
        }
    }
}

fn identity_health_check(state: &DeviceRuntimeState) -> DiagnosticsDeviceHealthCheck {
    let Some(board_id) = state.board_id.as_deref() else {
        return health_check(
            "identity",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("boardCatalogMissing"),
            DiagnosticActionKind::OpenDevices,
            None,
        );
    };
    let registry = BoardCatalogRegistry::bundled().ok();
    let Some(board) = registry
        .as_ref()
        .and_then(|registry| registry.board(board_id))
    else {
        return health_check(
            "identity",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("boardCatalogMissing"),
            DiagnosticActionKind::OpenDevices,
            None,
        );
    };
    if board.stable_uid_policy() == &StableUidPolicy::Limited
        && state
            .device_uid
            .as_deref()
            .map(|device_uid| device_uid.ends_with(":limited"))
            .unwrap_or(true)
    {
        return health_check(
            "identity",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("deviceIdentityLimited"),
            DiagnosticActionKind::OpenDevices,
            None,
        );
    }
    if state.device_uid.as_deref().unwrap_or_default().is_empty() {
        return health_check(
            "identity",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("deviceUidMissing"),
            DiagnosticActionKind::OpenDevices,
            None,
        );
    }
    health_check(
        "identity",
        DiagnosticsDeviceHealthStatus::Ok,
        None,
        DiagnosticActionKind::OpenDevices,
        None,
    )
}

fn firmware_health_check(state: &DeviceRuntimeState) -> DiagnosticsDeviceHealthCheck {
    match state.firmware_status {
        DeviceFirmwareStatus::UpToDate | DeviceFirmwareStatus::Unsupported => health_check(
            "firmware",
            DiagnosticsDeviceHealthStatus::Ok,
            None,
            DiagnosticActionKind::OpenFirmware,
            None,
        ),
        DeviceFirmwareStatus::UpdateAvailable | DeviceFirmwareStatus::Incompatible => health_check(
            "firmware",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("firmwareIssue"),
            DiagnosticActionKind::OpenFirmware,
            None,
        ),
        DeviceFirmwareStatus::Unknown => health_check(
            "firmware",
            DiagnosticsDeviceHealthStatus::Unknown,
            Some("firmwareUnknown"),
            DiagnosticActionKind::OpenFirmware,
            None,
        ),
    }
}

fn heartbeat_health_check(state: &DeviceRuntimeState) -> DiagnosticsDeviceHealthCheck {
    match state.heartbeat_status {
        DeviceHeartbeatStatus::Healthy | DeviceHeartbeatStatus::Unsupported => health_check(
            "heartbeat",
            DiagnosticsDeviceHealthStatus::Ok,
            None,
            DiagnosticActionKind::OpenDevices,
            None,
        ),
        DeviceHeartbeatStatus::Stale | DeviceHeartbeatStatus::Lost => health_check(
            "heartbeat",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("heartbeatIssue"),
            DiagnosticActionKind::OpenDevices,
            None,
        ),
        DeviceHeartbeatStatus::Unknown => health_check(
            "heartbeat",
            DiagnosticsDeviceHealthStatus::Unknown,
            Some("heartbeatUnknown"),
            DiagnosticActionKind::OpenDevices,
            None,
        ),
    }
}

fn rule_reference_health_check(
    state: &DeviceRuntimeState,
    device_id: &str,
    referenced: &HashSet<String>,
) -> DiagnosticsDeviceHealthCheck {
    if referenced.contains(device_id) && state.status != DeviceConnectionStatus::Connected {
        return health_check(
            "ruleReference",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("referencedOffline"),
            DiagnosticActionKind::OpenDevices,
            None,
        );
    }
    health_check(
        "ruleReference",
        DiagnosticsDeviceHealthStatus::Ok,
        None,
        DiagnosticActionKind::OpenDevices,
        None,
    )
}

fn input_config_health_check(state: &DeviceRuntimeState) -> DiagnosticsDeviceHealthCheck {
    let has_input_channel = state
        .channels
        .iter()
        .any(|channel| channel.direction == DeviceChannelDirection::Input);
    if has_input_channel && state.status != DeviceConnectionStatus::Connected {
        return health_check(
            "inputConfig",
            DiagnosticsDeviceHealthStatus::Warning,
            Some("inputPendingSync"),
            DiagnosticActionKind::OpenDevices,
            None,
        );
    }
    health_check(
        "inputConfig",
        DiagnosticsDeviceHealthStatus::Ok,
        None,
        DiagnosticActionKind::OpenDevices,
        None,
    )
}

fn health_check(
    id: &str,
    status: DiagnosticsDeviceHealthStatus,
    issue_code: Option<&str>,
    action: DiagnosticActionKind,
    detail: Option<String>,
) -> DiagnosticsDeviceHealthCheck {
    DiagnosticsDeviceHealthCheck {
        id: id.to_string(),
        status,
        issue_code: issue_code.map(str::to_string),
        action,
        detail,
    }
}

fn health_issue_from_error_code(code: DeviceRuntimeErrorCode) -> &'static str {
    match code {
        DeviceRuntimeErrorCode::DeviceTransportDisconnected => "deviceTransportDisconnected",
        DeviceRuntimeErrorCode::DeviceTransportBusy => "deviceTransportBusy",
        DeviceRuntimeErrorCode::DeviceTransportPermissionDenied => {
            "deviceTransportPermissionDenied"
        }
        DeviceRuntimeErrorCode::DeviceInfoTimeout => "deviceInfoTimeout",
        DeviceRuntimeErrorCode::DeviceActionTimeout => "deviceActionTimeout",
        DeviceRuntimeErrorCode::DeviceIoWorkerStopped => "deviceIoWorkerStopped",
        DeviceRuntimeErrorCode::DeviceNotConnected => "deviceNotConnected",
        DeviceRuntimeErrorCode::DeviceChannelNotConfigured => "deviceChannelNotConfigured",
        DeviceRuntimeErrorCode::DeviceChannelActionUnsupported => "deviceActionUnsupported",
        DeviceRuntimeErrorCode::DeviceProtocolUnsupportedCommand => "deviceCommandUnsupported",
        DeviceRuntimeErrorCode::DeviceProtocolInvalidResponse => "deviceProtocolInvalidResponse",
        DeviceRuntimeErrorCode::DeviceOperationCancelled => "deviceOperationCancelled",
        DeviceRuntimeErrorCode::DeviceConnectionChanged => "deviceConnectionChanged",
        DeviceRuntimeErrorCode::DeviceRuntimeUnavailable => "deviceRuntimeUnavailable",
        DeviceRuntimeErrorCode::DeviceNotRegistered => "deviceNotRegistered",
        DeviceRuntimeErrorCode::DeviceTransportError => "deviceTransportError",
    }
}

fn prioritized_device_issue(
    state: &DeviceRuntimeState,
    device_id: &str,
    referenced: &HashSet<String>,
) -> Option<DiagnosticsDeviceIssue> {
    if state.status == DeviceConnectionStatus::Error {
        let reason = state
            .last_error_code
            .map(reason_from_error_code)
            .unwrap_or_else(|| reason_from_missing_error_code(state));
        return Some(device_issue(device_id, DiagnosticStatus::Error, reason));
    }
    if matches!(
        state.heartbeat_status,
        DeviceHeartbeatStatus::Lost | DeviceHeartbeatStatus::Stale
    ) {
        return Some(device_issue(
            device_id,
            DiagnosticStatus::Warning,
            "heartbeat-issue",
        ));
    }
    if matches!(
        state.firmware_status,
        DeviceFirmwareStatus::UpdateAvailable | DeviceFirmwareStatus::Incompatible
    ) {
        return Some(device_issue(
            device_id,
            DiagnosticStatus::Warning,
            "firmware-issue",
        ));
    }
    if referenced.contains(device_id) && state.status != DeviceConnectionStatus::Connected {
        return Some(device_issue(
            device_id,
            DiagnosticStatus::Warning,
            "referenced-offline",
        ));
    }
    catalog_device_issue(state, device_id)
}

fn catalog_device_issue(
    state: &DeviceRuntimeState,
    device_id: &str,
) -> Option<DiagnosticsDeviceIssue> {
    let board_id = state.board_id.as_deref()?;
    let registry = BoardCatalogRegistry::bundled().ok()?;
    let Some(board) = registry.board(board_id) else {
        return Some(device_issue(
            device_id,
            DiagnosticStatus::Warning,
            "board-catalog-missing",
        ));
    };

    if board.stable_uid_policy() == &StableUidPolicy::Limited
        && state
            .device_uid
            .as_deref()
            .map(|device_uid| device_uid.ends_with(":limited"))
            .unwrap_or(true)
    {
        return Some(device_issue(
            device_id,
            DiagnosticStatus::Warning,
            "device-identity-limited",
        ));
    }

    None
}

fn upsert_device_issue(issues: &mut Vec<DiagnosticsDeviceIssue>, issue: DiagnosticsDeviceIssue) {
    let Some(existing) = issues
        .iter_mut()
        .find(|item| item.device_id == issue.device_id)
    else {
        issues.push(issue);
        return;
    };

    if device_issue_priority(&issue) > device_issue_priority(existing) {
        *existing = issue;
    }
}

fn device_issue_priority(issue: &DiagnosticsDeviceIssue) -> u8 {
    match (issue.status, issue.reason.as_str()) {
        (DiagnosticStatus::Error, "connection-error") => 40,
        (DiagnosticStatus::Error, _) => 30,
        (DiagnosticStatus::Warning, "heartbeat-issue") => 23,
        (DiagnosticStatus::Warning, "firmware-issue") => 22,
        (DiagnosticStatus::Warning, "referenced-offline") => 21,
        (DiagnosticStatus::Warning, "board-catalog-missing") => 19,
        (DiagnosticStatus::Warning, "device-identity-limited") => 18,
        (DiagnosticStatus::Warning, _) => 20,
        _ => 0,
    }
}

fn reason_from_error_code(code: DeviceRuntimeErrorCode) -> &'static str {
    match code {
        DeviceRuntimeErrorCode::DeviceNotConnected => "device-not-connected",
        DeviceRuntimeErrorCode::DeviceChannelNotConfigured => "device-channel-not-configured",
        DeviceRuntimeErrorCode::DeviceChannelActionUnsupported => "device-action-unsupported",
        DeviceRuntimeErrorCode::DeviceProtocolUnsupportedCommand => "device-command-unsupported",
        DeviceRuntimeErrorCode::DeviceTransportBusy
        | DeviceRuntimeErrorCode::DeviceTransportPermissionDenied
        | DeviceRuntimeErrorCode::DeviceTransportDisconnected
        | DeviceRuntimeErrorCode::DeviceTransportError => "device-transport-error",
        _ => "connection-error",
    }
}

fn reason_from_missing_error_code(state: &DeviceRuntimeState) -> &'static str {
    if state.last_error.is_some() {
        tracing::debug!(
            device_id = state.device_id.as_deref().unwrap_or(""),
            "device diagnostic fell back because last_error_code is missing"
        );
    }
    "connection-error"
}

fn device_issue(device_id: &str, status: DiagnosticStatus, reason: &str) -> DiagnosticsDeviceIssue {
    DiagnosticsDeviceIssue {
        device_id: device_id.to_string(),
        label: None,
        status,
        reason: reason.to_string(),
        action: DiagnosticActionKind::OpenDevices,
    }
}

pub fn referenced_device_ids(profile: &NoticeProfile) -> HashSet<String> {
    let mut device_ids = HashSet::new();
    for rule in profile.hardware_rules.iter().filter(|rule| rule.enabled) {
        if rule.output.output_type != HardwareOutputType::DeviceChannel {
            continue;
        }
        for action in &rule.output.channel_actions {
            device_ids.insert(action.device_id.clone());
        }
    }
    device_ids
}
