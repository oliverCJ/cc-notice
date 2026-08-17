import { DiagnosticActionKind, DiagnosticSeverity, DiagnosticStatus } from '@/api/tauriApi';

const actionKeyByKind: Record<DiagnosticActionKind, string> = {
  'refresh-diagnostics': 'diagnostics.actions.refreshDiagnostics',
  'open-hook-settings': 'diagnostics.actions.openHookSettings',
  'open-ai-event-mapping': 'diagnostics.actions.openAiEventMapping',
  'open-devices': 'diagnostics.actions.openDevices',
  'open-firmware': 'diagnostics.actions.openFirmware',
  'open-debug': 'diagnostics.actions.openDebug',
  'auto-connect-registered-devices': 'diagnostics.actions.autoConnectRegisteredDevices',
  'send-test-event': 'diagnostics.actions.sendTestEvent'
};

const statusKeyByStatus: Record<DiagnosticStatus, string> = {
  ok: 'diagnostics.status.ok',
  warning: 'diagnostics.status.warning',
  error: 'diagnostics.status.error',
  'not-configured': 'diagnostics.status.notConfigured',
  unknown: 'diagnostics.status.unknown'
};

const severityKeyBySeverity: Record<DiagnosticSeverity, string> = {
  error: 'diagnostics.severity.error',
  warning: 'diagnostics.severity.warning',
  info: 'diagnostics.severity.info'
};

const issueTextKeyById: Record<string, string> = {
  'hookService.notRunning': 'hookServiceNotRunning',
  'relay.notInstalled': 'relayNotInstalled',
  'relay.outdated': 'relayOutdated',
  'hookConfig.targetNotSynced': 'hookConfigTargetNotSynced',
  'profile.mappingWithoutOutput': 'profileMappingWithoutOutput',
  'device.noneRegistered': 'deviceNoneRegistered',
  'device.referencedOffline': 'deviceReferencedOffline',
  'device.heartbeatIssue': 'deviceHeartbeatIssue',
  'device.firmwareIssue': 'deviceFirmwareIssue',
  'device.runtimeIssue': 'deviceRuntimeIssue',
  'runtime.recentFailure': 'runtimeRecentFailure'
};

export function diagnosticSectionTitleKey(sectionId: string) {
  return `diagnostics.sections.${sectionId}.title`;
}

export function diagnosticIssueTitleKey(issueId: string) {
  return `diagnostics.issues.items.${issueTextKeyById[issueId] ?? 'unknown'}.title`;
}

export function diagnosticIssueDescriptionKey(issueId: string) {
  return `diagnostics.issues.items.${issueTextKeyById[issueId] ?? 'unknown'}.description`;
}

export function diagnosticIssueSuggestionKey(issueId: string) {
  return `diagnostics.issues.items.${issueTextKeyById[issueId] ?? 'unknown'}.suggestion`;
}

export function diagnosticActionLabelKey(kind: DiagnosticActionKind) {
  return actionKeyByKind[kind];
}

const deviceIssueReasonKeyByReason: Record<string, string> = {
  'referenced-offline': 'referencedOffline',
  'heartbeat-issue': 'heartbeatIssue',
  'firmware-issue': 'firmwareIssue',
  'connection-error': 'connectionError',
  'device-not-connected': 'deviceNotConnected',
  'device-channel-not-configured': 'deviceChannelNotConfigured',
  'device-action-unsupported': 'deviceActionUnsupported',
  'device-command-unsupported': 'deviceCommandUnsupported',
  'device-transport-error': 'deviceTransportError',
  'device-identity-limited': 'deviceIdentityLimited',
  'board-catalog-missing': 'boardCatalogMissing'
};

export function diagnosticStatusLabelKey(status: DiagnosticStatus) {
  return statusKeyByStatus[status];
}

export function diagnosticSeverityLabelKey(severity: DiagnosticSeverity) {
  return severityKeyBySeverity[severity];
}

export function diagnosticDeviceIssueReasonKey(reason: string) {
  const reasonKey = deviceIssueReasonKeyByReason[reason] ?? 'runtimeIssue';
  return 'diagnostics.devices.issueReasons.' + reasonKey;
}

export function diagnosticDeviceHealthCheckKey(checkId: string) {
  return `diagnostics.deviceHealth.checks.${checkId}`;
}

export function diagnosticDeviceHealthIssueKey(issueCode?: string | null) {
  return `diagnostics.deviceHealth.issues.${issueCode ?? 'none'}`;
}

export function fallbackText(translated: string, fallback: string) {
  return translated.includes('.') ? fallback : translated;
}
