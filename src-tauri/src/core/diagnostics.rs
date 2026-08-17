use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiagnosticStatus {
    Ok,
    Warning,
    Error,
    NotConfigured,
    Unknown,
}

impl DiagnosticStatus {
    pub fn overall<I>(statuses: I) -> Self
    where
        I: IntoIterator<Item = DiagnosticStatus>,
    {
        statuses
            .into_iter()
            .max_by_key(|status| status.priority())
            .unwrap_or(DiagnosticStatus::Unknown)
    }

    fn priority(self) -> u8 {
        match self {
            DiagnosticStatus::Ok => 0,
            DiagnosticStatus::Unknown => 1,
            DiagnosticStatus::NotConfigured => 2,
            DiagnosticStatus::Warning => 3,
            DiagnosticStatus::Error => 4,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Info,
}

impl DiagnosticSeverity {
    fn priority(self) -> u8 {
        match self {
            DiagnosticSeverity::Info => 0,
            DiagnosticSeverity::Warning => 1,
            DiagnosticSeverity::Error => 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiagnosticActionKind {
    RefreshDiagnostics,
    OpenHookSettings,
    OpenAiEventMapping,
    OpenDevices,
    OpenFirmware,
    OpenDebug,
    AutoConnectRegisteredDevices,
    SendTestEvent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticSection {
    pub id: String,
    pub status: DiagnosticStatus,
    pub action: DiagnosticActionKind,
    pub detail: Option<String>,
    pub checked_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticIssue {
    pub id: String,
    pub severity: DiagnosticSeverity,
    pub section_id: String,
    pub action: DiagnosticActionKind,
    pub context: Option<String>,
}

impl DiagnosticIssue {
    pub fn new(
        id: &str,
        severity: DiagnosticSeverity,
        section_id: &str,
        action: DiagnosticActionKind,
    ) -> Self {
        Self {
            id: id.to_string(),
            severity,
            section_id: section_id.to_string(),
            action,
            context: None,
        }
    }

    pub fn with_context(mut self, context: impl Into<String>) -> Self {
        self.context = Some(context.into());
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticAction {
    pub kind: DiagnosticActionKind,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsDeviceSummary {
    pub registered_count: usize,
    pub connected_count: usize,
    pub offline_count: usize,
    pub heartbeat_issue_count: usize,
    pub firmware_issue_count: usize,
    pub referenced_unavailable_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsDeviceIssue {
    pub device_id: String,
    pub label: Option<String>,
    pub status: DiagnosticStatus,
    pub reason: String,
    pub action: DiagnosticActionKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DiagnosticsDeviceHealthStatus {
    Ok,
    Warning,
    Error,
    Unknown,
}

impl DiagnosticsDeviceHealthStatus {
    pub fn priority(self) -> u8 {
        match self {
            DiagnosticsDeviceHealthStatus::Ok => 0,
            DiagnosticsDeviceHealthStatus::Unknown => 1,
            DiagnosticsDeviceHealthStatus::Warning => 2,
            DiagnosticsDeviceHealthStatus::Error => 3,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsDeviceHealthCheck {
    pub id: String,
    pub status: DiagnosticsDeviceHealthStatus,
    pub issue_code: Option<String>,
    pub action: DiagnosticActionKind,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsDeviceHealthDetail {
    pub device_id: String,
    pub label: Option<String>,
    pub board_id: Option<String>,
    pub status: DiagnosticsDeviceHealthStatus,
    pub checks: Vec<DiagnosticsDeviceHealthCheck>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsDeviceHealthSnapshot {
    pub ok_count: usize,
    pub warning_count: usize,
    pub error_count: usize,
    pub details: Vec<DiagnosticsDeviceHealthDetail>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSnapshot {
    pub overall_status: DiagnosticStatus,
    pub checked_at: String,
    pub sections: Vec<DiagnosticSection>,
    pub issues: Vec<DiagnosticIssue>,
    pub quick_actions: Vec<DiagnosticAction>,
    pub device_summary: DiagnosticsDeviceSummary,
    pub device_issues: Vec<DiagnosticsDeviceIssue>,
    pub device_health: DiagnosticsDeviceHealthSnapshot,
}

pub fn sort_issues(issues: &mut [DiagnosticIssue]) {
    issues.sort_by(|left, right| {
        right
            .severity
            .priority()
            .cmp(&left.severity.priority())
            .then_with(|| left.section_id.cmp(&right.section_id))
            .then_with(|| left.id.cmp(&right.id))
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_merge_uses_error_warning_not_configured_unknown_ok_order() {
        let status = DiagnosticStatus::overall([
            DiagnosticStatus::Ok,
            DiagnosticStatus::Unknown,
            DiagnosticStatus::NotConfigured,
            DiagnosticStatus::Warning,
        ]);
        assert_eq!(DiagnosticStatus::Warning, status);

        let status = DiagnosticStatus::overall([
            DiagnosticStatus::Ok,
            DiagnosticStatus::Error,
            DiagnosticStatus::Warning,
        ]);
        assert_eq!(DiagnosticStatus::Error, status);
    }

    #[test]
    fn issues_sort_by_severity_then_section() {
        let mut issues = vec![
            DiagnosticIssue::new(
                "profile.noOutputRule",
                DiagnosticSeverity::Warning,
                "profile",
                DiagnosticActionKind::OpenAiEventMapping,
            ),
            DiagnosticIssue::new(
                "device.lost",
                DiagnosticSeverity::Error,
                "devices",
                DiagnosticActionKind::OpenDevices,
            ),
        ];

        sort_issues(&mut issues);

        assert_eq!("device.lost", issues[0].id);
        assert_eq!("profile.noOutputRule", issues[1].id);
    }
}
