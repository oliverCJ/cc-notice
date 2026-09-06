import { invoke } from '@tauri-apps/api/core';
import type {
  CustomMascotScanResult,
  DesktopMascotPlayMode,
  DesktopMascotState,
} from '@/domain/desktopMascot';
import type {
  DesktopNoticeColorMode,
  DesktopNoticeColorStop,
  DesktopNoticeEdge,
  DesktopNoticeInstance,
  DesktopNoticeRestoreBehavior,
  DesktopNoticeRuleTarget,
  DesktopNoticeRuleEffect,
  DesktopNoticeWindowPayload,
} from '@/domain/desktopNotice';

export async function openExternalUrl(url: string): Promise<void> {
  await invoke('open_external_url', { url });
}

export type SubmitRelayEventRequest = {
  source: string;
  event: string;
  payload: string;
  rawPayload?: string | null;
  occurredAt: string;
};

export type NoticeCommand = {
  commandType?: string;
  text?: string | null;
  durationMs?: number | null;
  priority: number;
};

export type DeviceCommandResultView = {
  deviceId: string;
  channelId: string;
  outputType: 'device-channel' | 'display' | 'buzzer' | 'device-control' | string;
  status: 'sent' | 'skipped' | 'failed' | string;
  ack?: string | null;
  errorCode?: DeviceRuntimeErrorCode | null;
  error?: string | null;
};

export type DebugLogEntry = {
  debugEntryId: string;
  source: string;
  event: string;
  payload: string;
  rawPayload?: string | null;
  result: string;
  internalEvent?: string | null;
  mappingStage?: string | null;
  noticeCommand?: NoticeCommand | null;
  outputs?: SubmitRelayEventOutput[] | null;
  deviceResults?: DeviceCommandResultView[] | null;
  error?: string | null;
  occurredAt?: string;
  requestReceivedAt?: string | null;
  httpReadElapsedMs?: number | null;
  prepareElapsedMs?: number | null;
  queueDelayMs?: number | null;
  responseElapsedMs?: number | null;
  processingElapsedMs?: number | null;
  deviceProcessingElapsedMs?: number | null;
  webhookProcessingElapsedMs?: number | null;
  localProcessingElapsedMs?: number | null;
  processingCompletedAt?: string | null;
  processingMode?: string | null;
};

export type SoftwareNoticeState = {
  lastEvent?: string | null;
  lastSource?: string | null;
};

export type RuntimeCountByKey = {
  key: string;
  count: number;
};

export type RuntimeEventBucket = {
  bucketStart: string;
  source: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
};

export type RuntimeOutputBucket = {
  bucketStart: string;
  outputType: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
};

export type RuntimeEventSummary = {
  source: string;
  event: string;
  internalEvent?: string | null;
  result: string;
  occurredAt: string;
};

export type RuntimeOutputSummary = {
  outputType: string;
  result: string;
  occurredAt: string;
};

export type RuntimeMonitorSnapshot = {
  startedAt: string;
  uptimeSeconds: number;
  totalEvents: number;
  totalOutputs: number;
  totalFailures: number;
  eventsBySource: RuntimeCountByKey[];
  eventsByResult: RuntimeCountByKey[];
  outputAttemptsByType: RuntimeCountByKey[];
  outputFailuresByType: RuntimeCountByKey[];
  eventSeries: RuntimeEventBucket[];
  outputSeries: RuntimeOutputBucket[];
  runtimeErrorCount: number;
  lastEvent?: RuntimeEventSummary | null;
  lastOutput?: RuntimeOutputSummary | null;
};

export type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'not-configured' | 'unknown';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';
export type DiagnosticActionKind =
  | 'refresh-diagnostics'
  | 'open-hook-settings'
  | 'open-ai-event-mapping'
  | 'open-devices'
  | 'open-firmware'
  | 'open-debug'
  | 'auto-connect-registered-devices'
  | 'send-test-event';

export type DiagnosticSection = {
  id: string;
  status: DiagnosticStatus;
  action: DiagnosticActionKind;
  detail?: string | null;
  checkedAt: string;
};

export type DiagnosticIssue = {
  id: string;
  severity: DiagnosticSeverity;
  sectionId: string;
  action: DiagnosticActionKind;
  context?: string | null;
};

export type DiagnosticAction = {
  kind: DiagnosticActionKind;
  enabled: boolean;
};

export type DiagnosticsDeviceSummary = {
  registeredCount: number;
  connectedCount: number;
  offlineCount: number;
  heartbeatIssueCount: number;
  firmwareIssueCount: number;
  referencedUnavailableCount: number;
};

export type DiagnosticsDeviceIssue = {
  deviceId: string;
  label?: string | null;
  status: DiagnosticStatus;
  reason: string;
  action: DiagnosticActionKind;
};

export type DiagnosticsDeviceHealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

export type DiagnosticsDeviceHealthCheck = {
  id: string;
  status: DiagnosticsDeviceHealthStatus;
  issueCode?: string | null;
  action: DiagnosticActionKind;
  detail?: string | null;
};

export type DiagnosticsDeviceHealthDetail = {
  deviceId: string;
  label?: string | null;
  boardId?: string | null;
  status: DiagnosticsDeviceHealthStatus;
  checks: DiagnosticsDeviceHealthCheck[];
};

export type DiagnosticsDeviceHealthSnapshot = {
  okCount: number;
  warningCount: number;
  errorCount: number;
  details: DiagnosticsDeviceHealthDetail[];
};

export type DiagnosticsSnapshot = {
  overallStatus: DiagnosticStatus;
  checkedAt: string;
  sections: DiagnosticSection[];
  issues: DiagnosticIssue[];
  quickActions: DiagnosticAction[];
  deviceSummary: DiagnosticsDeviceSummary;
  deviceIssues: DiagnosticsDeviceIssue[];
  deviceHealth: DiagnosticsDeviceHealthSnapshot;
};

export type AppConfig = {
  localHookServer: {
    port: number;
  };
  ui: {
    language: 'zh-CN' | 'en-US';
    themeMode: 'system' | 'light' | 'dark';
  };
  window: {
    closeBehavior: 'hide-to-tray' | 'exit';
    startupMode: 'normal' | 'lightweight';
    launchAtLogin: boolean;
    hideWindowOnLoginLaunch: boolean;
  };
  arduinoCliPath?: string | null;
  activeProfileId: string;
  hookEventSelections: HookEventSelections;
  hookConfigTargets: HookConfigTarget[];
  desktopNoticeInstances: DesktopNoticeInstance[];
  devices: DeviceInstance[];
};

export type AppConfigSaveResult = {
  config: AppConfig;
  restartRequired: boolean;
};

export type ResetConfigurationScope =
  'app-settings' | 'hook-settings' | 'profile-mappings' | 'devices' | 'all';

export type ResetConfigurationResult = {
  config: AppConfig;
  profileState: ProfileFrontendState;
  hookEventState: HookEventFrontendState;
  deviceStates: DeviceRuntimeState[];
};

export type LocalHookServerStatus = {
  running: boolean;
  port: number;
  bindAddress: string;
  eventUrl: string;
  healthUrl: string;
  error?: string | null;
};

export type HookEventDefinition = {
  source: 'codex' | 'claude-code';
  event: string;
  title: string;
  description: string;
  scenario: string;
  defaultSelected: boolean;
  mappedNoticeEvent: string;
};

export type HookEventSelections = {
  bySource: Record<string, string[]>;
  codex?: string[];
  claudeCode?: string[];
};

export type HookConfigTargetScope = 'global' | 'project';

export type HookConfigTarget = {
  id: string;
  scope: HookConfigTargetScope;
  source: string;
  label: string;
  projectPath?: string | null;
  enabled: boolean;
};

export type HookConfigTargetStatus = HookConfigTarget & {
  configPath: string;
  exists: boolean;
  canCreate: boolean;
  matchesSelectedEvents: boolean;
  debugEnabled: boolean;
};

export type HookEventFrontendState = {
  tools?: AiToolFrontendDefinition[];
  catalog: HookEventDefinition[];
  selected: HookEventSelections;
  targets: HookConfigTargetStatus[];
  legacyTargets?: HookConfigTargetStatus[];
};

export type AiToolFrontendDefinition = {
  source: string;
  displayName: string;
  globalConfigPath: string;
  canCreateProjectTarget: boolean;
};

export type HookConfigWritePreview = {
  targetId: string;
  source: string;
  configPath: string;
  configExists: boolean;
  eventCount: number;
  previewJson: string;
  originalJson?: string | null;
  inlineHooksWarning?: string | null;
};

export type HookConfigWriteResult = {
  targetId: string;
  source: string;
  configPath: string;
  backupPath: string;
  eventCount: number;
  inlineHooksWarning?: string | null;
};

export type HardwareOutputType =
  | 'device-channel'
  | 'display'
  | 'buzzer'
  | 'system-notification'
  | 'webhook'
  | 'sound'
  | 'desktop-notice'
  | 'custom';
export type DeviceTransportKind =
  'serial' | 'usb-hid' | 'usb-bulk' | 'tcp' | 'websocket' | 'mqtt' | 'ble-gatt';
export type DeviceConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type DeviceOperationKind =
  | 'manual-connect'
  | 'auto-connect'
  | 'disconnect'
  | 'ping'
  | 'send-action'
  | 'send-extension-action'
  | 'firmware-check';
export type DeviceChannelKind =
  | 'digital-output'
  | 'pwm-output'
  | 'addressable-led'
  | 'display'
  | 'buzzer'
  | 'relay'
  | 'button-input';
export type DeviceChannelDirection = 'output' | 'input';
export type ActiveLevel = 'high' | 'low';
export type DeviceChannelActionType =
  | 'activate'
  | 'deactivate'
  | 'blink'
  | 'breathe'
  | 'pulse'
  | 'clear'
  | 'set-duty'
  | 'beep'
  | 'tone'
  | 'pattern'
  | 'display-status'
  | 'display-face'
  | 'set-color';

export type DigitalOutputConfig = {
  pin: number;
  activeLevel: ActiveLevel;
  defaultLevel: ActiveLevel;
  allowBlink: boolean;
};

export type PwmOutputConfig = {
  pin: number;
  frequencyHz: number;
  defaultDutyPercent: number;
  maxDutyPercent: number;
};

export type BuzzerConfig = {
  pin: number;
  activeLevel: ActiveLevel;
  defaultFrequencyHz: number;
  supportsTone: boolean;
};

export type AddressableLedConfig = {
  pin: number;
  protocol: string;
  ledCount: number;
  colorOrder: string;
  defaultBrightnessPercent: number;
};

export type DeviceInputKind = 'button' | 'gpio';

export type DeviceInputConfig = {
  control: string;
  inputKind: DeviceInputKind;
  fixed: boolean;
};

export type DeviceInputTrigger = 'press';

export type KeyboardShortcut = {
  keys: string[];
};

export type DeviceInputBinding = {
  id: string;
  enabled: boolean;
  deviceId: string;
  channelId: string;
  trigger: DeviceInputTrigger;
  action: {
    type: 'keyboard-shortcut';
    shortcut: KeyboardShortcut;
  };
};

export type DeviceInputEvent = {
  deviceId: string;
  channelId: string;
  control: string;
  action: DeviceInputTrigger;
  seq: number;
  receivedAt: string;
};

export type DeviceTransportMonitorDirection = 'outbound' | 'inbound' | 'system';

export type DeviceTransportMonitorCategory =
  'command' | 'ack' | 'input-event' | 'heartbeat' | 'connection' | 'error';

export type DeviceTransportMonitorStatus =
  'pending' | 'sent' | 'ok' | 'timeout' | 'error' | 'skipped' | 'stopped';

export type DeviceTransportMonitorEvent = {
  id: string;
  timestamp: string;
  deviceId: string;
  boardId?: string | null;
  transportKind?: string | null;
  transportAddress?: string | null;
  direction: DeviceTransportMonitorDirection;
  category: DeviceTransportMonitorCategory;
  commandType?: string | null;
  channelId?: string | null;
  control?: string | null;
  status: DeviceTransportMonitorStatus;
  errorCode?: string | null;
  summary: string;
  payloadPreview?: string | null;
};

export type DeviceTransportMonitorSnapshot = {
  deviceId: string;
  active: boolean;
  events: DeviceTransportMonitorEvent[];
};

export type DeviceChannel = {
  id: string;
  label: string;
  kind: DeviceChannelKind;
  direction?: DeviceChannelDirection;
  description?: string | null;
  physicalPin?: number | null;
  digitalOutput?: DigitalOutputConfig | null;
  pwmOutput?: PwmOutputConfig | null;
  buzzer?: BuzzerConfig | null;
  addressableLed?: AddressableLedConfig | null;
  input?: DeviceInputConfig | null;
  supportedActions: DeviceChannelActionType[];
  hardwareGuideId?: string | null;
};

export type DeviceTransportConfig = {
  kind: DeviceTransportKind;
  serialPort?: string | null;
  baudRate?: number | null;
  host?: string | null;
  port?: number | null;
  path?: string | null;
  topic?: string | null;
};

export type DeviceInstance = {
  id: string;
  label: string;
  boardId: string;
  deviceUid?: string | null;
  transport: DeviceTransportConfig;
  channels: DeviceChannel[];
  enabled: boolean;
};

export type DeviceCandidateResource = {
  resourceId: string;
  transport: DeviceTransportConfig;
  displayName: string;
  discoveryStatus: DeviceDiscoveryStatus;
  handshakeInfo?: DeviceCandidateHandshakeInfo | null;
  deviceUid?: string | null;
  matchedDeviceId?: string | null;
  error?: string | null;
};

export type DeviceCandidateHandshakeInfo = {
  boardId: string;
  deviceUid: string;
  firmwareVersion: string;
  protocolVersion: number;
  identityPersistence: DeviceIdentityPersistence;
};

export type DeviceIdentityPersistence = 'persisted' | 'fallback';

export type DeviceDiscoveryStatus =
  'unidentified' | 'identifying' | 'identified' | 'matched' | 'failed';

export type DeviceChannelAction = {
  deviceId: string;
  channelId: string;
  action: DeviceChannelActionType;
  durationMs?: number | null;
  intervalMs?: number | null;
  dutyPercent?: number | null;
  frequencyHz?: number | null;
  color?: string | null;
  brightnessPercent?: number | null;
  pattern?: DeviceBuzzerPattern | null;
  priority: number;
};

export type DeviceExtensionActionType =
  | 'display-status'
  | 'display-card'
  | 'display-lines'
  | 'display-runtime'
  | 'display-clear'
  | 'display-face'
  | 'buzzer-pattern'
  | 'device-control';

export type DeviceExtensionStatus = 'idle' | 'working' | 'success' | 'warning' | 'error' | 'notice';

export type DeviceBuzzerPattern = 'notice' | 'success' | 'warning' | 'error' | 'working';

export type DeviceExtensionAction = {
  deviceId: string;
  action: DeviceExtensionActionType;
  status?: DeviceExtensionStatus | null;
  title?: string | null;
  message?: string | null;
  icon?: string | null;
  lines?: string[] | null;
  faceTemplate?: string | null;
  faceIntensity?: 'subtle' | 'standard' | 'strong' | null;
  customFaceGroupId?: string | null;
  customFaceId?: string | null;
  durationMs?: number | null;
  pattern?: DeviceBuzzerPattern | null;
  control?: 'mute' | null;
  active?: boolean | null;
};

export type DeviceOperationSummary = {
  operationId: number;
  kind: DeviceOperationKind;
  startedAt: string;
  deadlineMs: number;
  cancellable: boolean;
};

export type DeviceRuntimeErrorCode =
  | 'DEVICE_RUNTIME_UNAVAILABLE'
  | 'DEVICE_NOT_REGISTERED'
  | 'DEVICE_NOT_CONNECTED'
  | 'DEVICE_CHANNEL_NOT_CONFIGURED'
  | 'DEVICE_CHANNEL_ACTION_UNSUPPORTED'
  | 'DEVICE_CUSTOM_FACE_OUTPUT_MISMATCH'
  | 'DEVICE_IO_WORKER_STOPPED'
  | 'DEVICE_ACTION_TIMEOUT'
  | 'DEVICE_INFO_TIMEOUT'
  | 'DEVICE_TRANSPORT_BUSY'
  | 'DEVICE_TRANSPORT_PERMISSION_DENIED'
  | 'DEVICE_TRANSPORT_DISCONNECTED'
  | 'DEVICE_TRANSPORT_ERROR'
  | 'DEVICE_PROTOCOL_UNSUPPORTED_COMMAND'
  | 'DEVICE_PROTOCOL_INVALID_RESPONSE'
  | 'DEVICE_OPERATION_CANCELLED'
  | 'DEVICE_CONNECTION_CHANGED';

export type DeviceRuntimeState = {
  deviceId?: string | null;
  deviceUid?: string | null;
  status: DeviceConnectionStatus;
  boardId?: string | null;
  transport?: DeviceTransportConfig | null;
  channels: DeviceChannel[];
  firmwareInfo?: DeviceFirmwareInfo | null;
  customFaceStatus: DeviceCustomFaceStatus;
  bundledFirmwareVersion?: string | null;
  firmwareStatus: DeviceFirmwareStatus;
  firmwareCheckError?: string | null;
  heartbeatStatus: DeviceHeartbeatStatus;
  lastHeartbeatAt?: string | null;
  heartbeatFailureCount: number;
  manualReconnectSuppressed: boolean;
  matchedResourceId?: string | null;
  lastDiscoveredAt?: string | null;
  activeOperation?: DeviceOperationSummary | null;
  autoReconnectBlockedUntil?: string | null;
  lastAck?: string | null;
  lastErrorCode?: DeviceRuntimeErrorCode | null;
  lastError?: string | null;
  lastSentAt?: string | null;
};

export type DeviceExtensionCapabilities = {
  display?: DeviceDisplayCapabilities | null;
  buzzer?: DeviceBuzzerExtensionCapabilities | null;
  inputs?: DeviceInputCapabilities | null;
};

export type DeviceDisplayCapabilities = {
  status: boolean;
  card?: boolean;
  lines?: boolean;
  runtime?: boolean;
  face?: boolean;
  faceStyleVersion?: string | null;
  faceRendererProfile?: string | null;
  faceTemplates?: string[];
  clear: boolean;
  sizeClass?: 'compact' | 'small' | 'medium' | 'large';
  pixelWidth?: number | null;
  pixelHeight?: number | null;
  statuses: string[];
  titleMaxChars: number;
  messageMaxChars: number;
  textEncoding?: 'ascii' | 'unicode';
};

export type DeviceBuzzerExtensionCapabilities = {
  patterns: DeviceBuzzerPattern[];
};

export type DeviceInputCapabilities = {
  buttons?: DeviceButtonInputCapabilities | null;
};

export type DeviceButtonInputCapabilities = {
  status: string;
  controls: string[];
};

export type DeviceFirmwareInfo = {
  boardId: string;
  deviceUid: string;
  firmwareVersion: string;
  protocolVersion: number;
  customFace?: DeviceCustomFaceCapabilities | null;
  customFaceError?: DeviceCustomFaceErrorCode | null;
  customFaceActive?: DeviceCustomFaceActiveState | null;
};

export type DeviceCustomFaceActiveSource = 'builtin' | 'custom';

export type DeviceCustomFaceActiveState = {
  source: DeviceCustomFaceActiveSource;
  groupId?: string | null;
};

export type DeviceCustomFaceCapabilities = {
  protocolVersion: number;
  profileCode: number;
  pixelWidth: number;
  pixelHeight: number;
  maxFaces: number;
  maxFramesPerFace: number;
  maxGroupBytes: number;
  chunkBytes: number;
  incrementalUpdate: boolean;
};

export type DeviceCustomFaceErrorCode =
  | 'custom-face-capability-invalid'
  | 'custom-face-status-timeout'
  | 'custom-face-storage-error'
  | 'custom-face-status-invalid';

export type DeviceCustomFaceStatusState = 'unknown' | 'empty' | 'installed' | 'unavailable';

export type DeviceInstalledCustomFaceGroup = {
  profileCode: number;
  groupId: string;
  groupRuntimeHash: string;
  defaultFaceId: string;
  faceCount: number;
  encodedBytes: number;
};

export type DeviceCustomFaceStatus = {
  state: DeviceCustomFaceStatusState;
  installed?: DeviceInstalledCustomFaceGroup | null;
  errorCode?: DeviceCustomFaceErrorCode | null;
  lastConfirmedAt?: string | null;
};

export type DeviceFirmwareStatus =
  'unknown' | 'up-to-date' | 'update-available' | 'incompatible' | 'unsupported';

export type DeviceHeartbeatStatus = 'unknown' | 'healthy' | 'stale' | 'lost' | 'unsupported';

export type DevicePortDescriptor = {
  id: string;
  displayName: string;
  transportKind: DeviceTransportKind;
  address: string;
  stableDeviceUid?: string | null;
  stableDeviceUidCandidates?: string[];
};

export type FirmwareFlashTarget = {
  mountPath: string;
  volumeName: string;
};

export type FirmwareUploadToolStatus = {
  toolId: string;
  platform: string;
  path: string;
  available: boolean;
};

export type ArduinoCliStatus = {
  configuredPath?: string | null;
  resolvedPath: string;
  available: boolean;
  version?: string | null;
  error?: string | null;
};

export type FirmwareFlashPortTarget = {
  targetId: string;
  displayName: string;
  transport: DeviceTransportConfig;
};

export type FirmwareFlashStatus = {
  artifactId: string;
  boardId: string;
  artifactName: string;
  artifactType: string;
  targetId?: string | null;
  toolchain?: string | null;
  flashStrategy: string;
  target?: FirmwareFlashTarget | null;
  uploadTool?: FirmwareUploadToolStatus | null;
  arduinoCli?: ArduinoCliStatus | null;
  ready: boolean;
};

export type FirmwareFlashRequest = {
  artifactId: string;
  targetId?: string | null;
};

export type FirmwareFlashResult = {
  artifactId: string;
  boardId: string;
  artifactName: string;
  target: FirmwareFlashTarget;
  copiedBytes: number;
};

export type FirmwareUploadConfig = {
  fqbn: string;
  protocol: string;
  speed: number;
  requires1200bpsReset: boolean;
  bootloaderWaitMs: number;
  boardOptions: Record<string, string>;
};

export type FirmwareCatalogArtifact = {
  artifactId: string;
  boardId: string;
  boardName: string;
  firmwareVersion: string;
  protocolVersion: number;
  visible?: boolean;
  artifactName: string;
  artifactType: string;
  targetId?: string | null;
  toolchain?: string | null;
  flashStrategy: string;
  flashVolumeName: string;
  relativePath: string;
  source: 'local-bundled' | string;
  upload?: FirmwareUploadConfig | null;
};

export type FirmwareCatalog = {
  artifacts: FirmwareCatalogArtifact[];
};

export type SubmitRelayEventOutput = {
  type: HardwareOutputType;
  ruleId: string;
  command: NoticeCommand;
  notificationLevel?: string | null;
  notificationTitle?: string | null;
  notificationBody?: string | null;
  notificationThrottleSeconds?: number | null;
  desktopNoticeTargets?: DesktopNoticeRuleTarget[];
};

export type EnabledHookEvent = {
  source: string;
  event: string;
};

export type AiEventMapping = {
  id: string;
  source: string;
  event: string;
  internalEvent: string;
  enabled: boolean;
};

export type DeviceChannelRuleAction = {
  id: string;
  deviceId: string;
  channelId: string;
  channelAction: DeviceChannelActionType;
  durationMs?: number | null;
  intervalMs?: number | null;
  dutyPercent?: number | null;
  frequencyHz?: number | null;
  color?: string | null;
  brightnessPercent?: number | null;
  pattern?: DeviceBuzzerPattern | null;
  displayTemplateId?: string | null;
  displayAccent?: 'notice' | 'working' | 'success' | 'warning' | 'error' | null;
  displayIcon?: 'info' | 'spinner' | 'check' | 'warning' | 'error' | 'input' | null;
  displayLinesTemplate?: string[] | null;
  displayStatus?: DeviceExtensionStatus | null;
  displayTitleTemplate?: string | null;
  displayMessageTemplate?: string | null;
  displayTitleMaxChars?: number | null;
  displayMessageMaxChars?: number | null;
  displayFaceTemplateId?: string | null;
  displayFaceIntensity?: 'subtle' | 'standard' | 'strong' | null;
  customFaceGroupId?: string | null;
  customFaceId?: string | null;
};

export type HardwareOutput = {
  type: HardwareOutputType;
  durationMs?: number | null;
  // DeviceChannel 字段
  channelActions?: DeviceChannelRuleAction[];
  // 通用字段
  text?: string | null;
  // SystemNotification 字段
  notificationLevel?: string | null;
  notificationTitle?: string | null;
  notificationBody?: string | null;
  notificationTitleMaxChars?: number | null;
  notificationBodyMaxChars?: number | null;
  notificationThrottleSeconds?: number | null;
  notificationSound?: string | null;
  // Webhook 字段
  webhookMethod?: string | null;
  webhookUrl?: string | null;
  webhookHeaders?: string | null;
  webhookBody?: string | null;
  webhookBodyMaxChars?: number | null;
  // Sound 字段
  soundFilePath?: string | null;
  soundVolumePercent?: number | null;
  soundMaxDurationMs?: number | null;
  soundThrottleSeconds?: number | null;
  // Display 字段
  displayDeviceId?: string | null;
  displayTemplateId?: string | null;
  displayAccent?: 'notice' | 'working' | 'success' | 'warning' | 'error' | null;
  displayIcon?: 'info' | 'spinner' | 'check' | 'warning' | 'error' | 'input' | null;
  displayLinesTemplate?: string[] | null;
  displayStatus?: DeviceExtensionStatus | null;
  displayTitleTemplate?: string | null;
  displayMessageTemplate?: string | null;
  displayTitleMaxChars?: number | null;
  displayMessageMaxChars?: number | null;
  displayExpireBehavior?: 'restore-status' | null;
  // DesktopNotice 字段
  desktopNoticeTargets?: DesktopNoticeRuleTarget[];
};

export type HardwareRule = {
  id: string;
  internalEvent: string;
  output: HardwareOutput;
  priority: number;
  enabled: boolean;
};

export type DeviceProfile = {
  boardId: string;
  transport: string;
};

export type ProfileTemplate = 'basic' | 'advanced' | 'blank';

export type ProfileTemplateInfo = {
  id: ProfileTemplate;
  name: string;
  description: string;
  recommended: boolean;
};

export type SoundAssetSource = 'built-in' | 'user';

export type SoundAsset = {
  id: string;
  label: string;
  path: string;
  source: SoundAssetSource;
};

export type NoticeProfile = {
  id: string;
  name: string;
  enabledHookEvents: EnabledHookEvent[];
  aiEventMappings: AiEventMapping[];
  hardwareRules: HardwareRule[];
  device: DeviceProfile;
};

export type ProfileSummary = {
  id: string;
  name: string;
  active: boolean;
};

export type ProfileRepairReport = {
  repairedProfileIdentity: boolean;
  isolatedUnrecoverableProfileId?: string | null;
  removedEnabledHookEvents: number;
  removedAiEventMappings: number;
  removedHardwareRules: number;
  resetDevice: boolean;
};

export type ProfileFrontendState = {
  activeProfileId: string;
  activeProfile: NoticeProfile;
  profiles: ProfileSummary[];
  hookConfigSyncRequired?: boolean;
  profileRepair?: ProfileRepairReport | null;
};

export type ProfilePackageDeviceBindingStatus =
  'full-match' | 'partial-match' | 'board-mismatch' | 'unbound';

export type ProfilePackageDeviceRequirement = {
  ruleId: string;
  outputType: HardwareOutputType;
  channelId?: string | null;
  channelKind?: DeviceChannelKind | null;
  action?: DeviceChannelActionType | null;
  extension?: string | null;
};

export type ProfilePackageDeviceCandidate = {
  deviceId: string;
  boardId?: string | null;
  status: ProfilePackageDeviceBindingStatus;
  missingRequirements: string[];
};

export type ProfilePackageDeviceGroupPreview = {
  sourceDeviceKey: string;
  boardId?: string | null;
  requirementCount: number;
  candidates: ProfilePackageDeviceCandidate[];
};

export type ProfilePackageImportPreview = {
  sourceProfileName: string;
  importedProfileName: string;
  enabledHookEventCount: number;
  aiMappingCount: number;
  outputRuleCount: number;
  deviceRuleCount: number;
  desktopNoticeInstanceCount: number;
  customMascotAssetPackIds: string[];
  deviceGroups: ProfilePackageDeviceGroupPreview[];
  hookConfigSyncRequired: boolean;
};

export type ProfilePackageDeviceBinding = {
  sourceDeviceKey: string;
  targetDeviceId?: string | null;
};

export type ProfilePackageImportRequest = {
  packagePath: string;
  bindings: ProfilePackageDeviceBinding[];
  activate: boolean;
};

export type ProfilePackageImportResult = {
  profileState: ProfileFrontendState;
  hookEventSelections: HookEventSelections;
  desktopNoticeInstances: DesktopNoticeInstance[];
};

export type CustomFaceColor = {
  red: number;
  green: number;
  blue: number;
};

export type CustomFaceFrame = {
  durationMs: number;
  packedPixels: number[];
};

export type CustomFace = {
  faceId: string;
  name: string;
  color: CustomFaceColor;
  frames: CustomFaceFrame[];
};

export type CustomFaceGroup = {
  schemaVersion: number;
  groupId: string;
  name: string;
  displayProfileId: string;
  revision: number;
  defaultFaceId: string;
  faces: CustomFace[];
};

export type CustomFaceGroupSummary = {
  groupId: string;
  name: string;
  displayProfileId: string;
  revision: number;
  defaultFaceId: string;
  faceCount: number;
  libraryHash: string;
};

export type SaveCustomFaceGroupRequest = {
  group: CustomFaceGroup;
  expectedLibraryHash?: string | null;
};

export type SaveCustomFaceGroupResult = {
  group: CustomFaceGroup;
  libraryHash: string;
  changed: boolean;
};

export type CustomFaceImportMode = 'update' | 'copy';
export type CustomFaceImportStatus = 'new' | 'duplicate' | 'conflict';

export type CustomFaceImportPreview = {
  group: CustomFaceGroup;
  libraryHash: string;
  status: CustomFaceImportStatus;
};

export type CustomFaceImportRequest = {
  path: string;
  mode: CustomFaceImportMode;
};

export type CustomFaceItemImportPreview = {
  face: CustomFace;
  displayProfileId: string;
  width: number;
  height: number;
  frameCount: number;
  totalDurationMs: number;
  contentHash: string;
  sourceFaceId: string;
};

export type CustomFacePixelizeOptions = {
  mode: 'mono' | 'color';
  colorCount: number;
  dither: boolean;
  invert: boolean;
  threshold: number;
  contrast: number;
  brightness: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
};

export type CustomFacePixelizeRequest = {
  profileWidth: number;
  profileHeight: number;
  imageBytes: number[];
  options: CustomFacePixelizeOptions;
};

export type PrepareCustomFacePixelizerSourceRequest = {
  profileWidth: number;
  profileHeight: number;
  imageBytes: number[];
};

export type PrepareCustomFacePixelizerSourceResult = {
  sourceId: string;
  sourceWidth: number;
  sourceHeight: number;
  workingWidth: number;
  workingHeight: number;
};

export type CustomFacePixelizeSourceRequest = {
  sourceId: string;
  profileWidth: number;
  profileHeight: number;
  options: CustomFacePixelizeOptions;
};

export type CustomFacePixelizeResult = {
  width: number;
  height: number;
  packedPixels: number[];
  previewPixels: number[];
  sourceWidth: number;
  sourceHeight: number;
};

export type CustomFaceImageImportReadyPayload = {
  packedPixels: number[];
  sourceWidth: number;
  sourceHeight: number;
};

export type ExportCustomFaceRequest = {
  face: CustomFace;
  displayProfileId: string;
  path: string;
};

export type ExportCustomFaceGifRequest = ExportCustomFaceRequest & {
  scale: number;
  invert?: boolean;
  transparentBackground?: boolean;
  frameIndices?: number[];
};

export type ExportCustomFacePngRequest = {
  packedPixels: number[];
  displayProfileId: string;
  path: string;
  scale: number;
  invert?: boolean;
  transparentBackground?: boolean;
};

export type CustomFaceGifExportResult = {
  frameDelaysMs: number[];
  totalDurationMs: number;
};

export type PersonalCustomFaceAsset = {
  assetId: string;
  scope: 'public' | 'group';
  groupId?: string | null;
  name: string;
  tags: string[];
  profileId: string;
  width: number;
  height: number;
  packedPixels: number[];
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type InternalEventDefinition = {
  id: string;
  title: string;
  description: string;
  scenario: string;
  builtIn: boolean;
};

export type CreateCustomInternalEventRequest = {
  idPrefix: string;
  title: string;
  description: string;
  scenario: string;
};

export type UpdateCustomInternalEventRequest = {
  id: string;
  title: string;
  description: string;
  scenario: string;
};

export function healthCheck() {
  return invoke<string>('health_check');
}

export function getDevelopmentLogDir(projectRoot: string) {
  return invoke<string>('development_log_dir', { projectRoot });
}

export function submitRelayEvent(request: SubmitRelayEventRequest) {
  return invoke('submit_relay_event', { request });
}

export function getDebugLogEntries() {
  return invoke<DebugLogEntry[]>('debug_log_entries');
}

export function clearDebugLog() {
  return invoke<void>('clear_debug_log');
}

export function getSoftwareNoticeState() {
  return invoke<SoftwareNoticeState>('software_notice_state');
}

export function getRuntimeMonitorSnapshot() {
  return invoke<RuntimeMonitorSnapshot>('runtime_monitor_snapshot');
}

export function getDiagnosticsSnapshot() {
  return invoke<DiagnosticsSnapshot>('diagnostics_snapshot');
}

export function getAppConfig() {
  return invoke<AppConfig>('get_app_config');
}

export function saveAppConfig(config: AppConfig) {
  return invoke<AppConfigSaveResult>('save_app_config', { config });
}

export function getDesktopNoticeInstances() {
  return invoke<DesktopNoticeInstance[]>('desktop_notice_instances');
}

export function getDesktopMascotAssetPacks() {
  return invoke<CustomMascotScanResult>('desktop_mascot_asset_packs');
}

export function saveDesktopNoticeInstance(instance: DesktopNoticeInstance) {
  return invoke<DesktopNoticeInstance[]>('save_desktop_notice_instance', { instance });
}

export function deleteDesktopNoticeInstance(instanceId: string) {
  return invoke<DesktopNoticeInstance[]>('delete_desktop_notice_instance', {
    request: { instanceId },
  });
}

export function previewDesktopNoticeInstance(instanceId: string) {
  return invoke<DesktopNoticeWindowPayload>('preview_desktop_notice_instance', {
    request: { instanceId },
  });
}

export type DesktopNoticeRuleEffectPreviewRequest = {
  targetId: string;
  effect: DesktopNoticeRuleEffect;
  colorMode: DesktopNoticeColorMode;
  colors: DesktopNoticeColorStop[];
  durationMs: number;
  animationPeriodMs?: number | null;
  breathingPeriodMs?: number | null;
  opacityPercent?: number | null;
  brightnessPercent?: number | null;
  restoreBehavior: DesktopNoticeRestoreBehavior;
  edge?: DesktopNoticeEdge | null;
  mascotState?: DesktopMascotState | null;
  mascotActionId?: string | null;
  mascotPlayMode?: DesktopMascotPlayMode | null;
  mascotPlaybackWindowMs?: number | null;
  mascotBubbleText?: string | null;
};

export function previewDesktopNoticeRuleEffect(request: DesktopNoticeRuleEffectPreviewRequest) {
  return invoke<void>('preview_desktop_notice_rule_effect', { request });
}

export function hideDesktopNoticeInstance(instanceId: string) {
  return invoke<void>('hide_desktop_notice_instance', {
    request: { instanceId },
  });
}

export function getDesktopNoticeWindowPayload(instanceId: string) {
  return invoke<DesktopNoticeWindowPayload>('desktop_notice_window_payload', {
    request: { instanceId },
  });
}

export function saveDesktopNoticeWindowBounds(instanceId: string) {
  return invoke<DesktopNoticeInstance[]>('save_desktop_notice_window_bounds', {
    request: { instanceId },
  });
}

export function resetConfiguration(scope: ResetConfigurationScope) {
  return invoke<ResetConfigurationResult>('reset_configuration', { scope });
}

export function getProfileState() {
  return invoke<ProfileFrontendState>('profile_state');
}

export function saveProfile(profile: NoticeProfile) {
  return invoke<ProfileFrontendState>('save_profile', { profile });
}

export function createProfile(profileId: string, profileName: string, template?: ProfileTemplate) {
  return invoke<ProfileFrontendState>('create_profile', { profileId, profileName, template });
}

export function duplicateProfile(sourceProfileId: string, profileId: string, profileName: string) {
  return invoke<ProfileFrontendState>('duplicate_profile', {
    sourceProfileId,
    profileId,
    profileName,
  });
}

export function activateProfile(profileId: string) {
  return invoke<ProfileFrontendState>('activate_profile', { profileId });
}

export function deleteProfile(profileId: string) {
  return invoke<ProfileFrontendState>('delete_profile', { profileId });
}

export function exportProfilePackage(path: string) {
  return invoke<void>('export_profile_package', { path });
}

export function previewProfilePackageImport(path: string) {
  return invoke<ProfilePackageImportPreview>('preview_profile_package_import', { path });
}

export function importProfilePackage(request: ProfilePackageImportRequest) {
  return invoke<ProfilePackageImportResult>('import_profile_package', { request });
}

export function getCustomFaceGroups() {
  return invoke<CustomFaceGroupSummary[]>('custom_face_groups');
}

export function getCustomFaceGroup(groupId: string) {
  return invoke<CustomFaceGroup>('custom_face_group', { groupId });
}

export function saveCustomFaceGroup(request: SaveCustomFaceGroupRequest) {
  return invoke<SaveCustomFaceGroupResult>('save_custom_face_group', { request });
}

export function deleteCustomFaceGroup(groupId: string, expectedLibraryHash: string) {
  return invoke<void>('delete_custom_face_group', { groupId, expectedLibraryHash });
}

export function saveCustomFaceRecovery(group: CustomFaceGroup) {
  return invoke<void>('save_custom_face_recovery', { group });
}

export function getCustomFaceRecovery(groupId: string) {
  return invoke<CustomFaceGroup | null>('custom_face_recovery', { groupId });
}

export function clearCustomFaceRecovery(groupId: string) {
  return invoke<void>('clear_custom_face_recovery', { groupId });
}

export function exportCustomFaceGroup(groupId: string, path: string) {
  return invoke<void>('export_custom_face_group', { groupId, path });
}

export function previewCustomFaceGroupImport(path: string) {
  return invoke<CustomFaceImportPreview>('preview_custom_face_group_import', { path });
}

export function importCustomFaceGroup(request: CustomFaceImportRequest) {
  return invoke<SaveCustomFaceGroupResult>('import_custom_face_group', { request });
}

export function installCustomFaceGroupToDevice(deviceId: string, groupId: string) {
  return invoke<DeviceRuntimeState>('install_custom_face_group_to_device', {
    request: { deviceId, groupId },
  });
}

export function setCustomFaceActiveSource(
  deviceId: string,
  source: DeviceCustomFaceActiveSource,
  groupId?: string | null
) {
  return invoke<DeviceRuntimeState>('set_custom_face_active_source', {
    request: { deviceId, source, groupId: groupId ?? null },
  });
}

export function previewCustomFaceItemImport(path: string) {
  return invoke<CustomFaceItemImportPreview>('preview_custom_face_item_import', { path });
}

export function exportCustomFaceItem(request: ExportCustomFaceRequest) {
  return invoke<void>('export_custom_face_item', { request });
}

export function exportCustomFaceGif(request: ExportCustomFaceGifRequest) {
  return invoke<CustomFaceGifExportResult>('export_custom_face_gif', { request });
}

export function exportCustomFacePng(request: ExportCustomFacePngRequest) {
  return invoke<void>('export_custom_face_png', { request });
}

export function readCustomFaceSvg(path: string) {
  return invoke<string>('read_custom_face_svg', { path });
}

export function getCustomFaceAssets() {
  return invoke<PersonalCustomFaceAsset[]>('custom_face_assets');
}
export function saveCustomFaceAsset(asset: PersonalCustomFaceAsset) {
  return invoke<PersonalCustomFaceAsset>('save_custom_face_asset', { asset });
}
export function deleteCustomFaceAsset(assetId: string) {
  return invoke<void>('delete_custom_face_asset', { assetId });
}

export function openCustomFaceEditor() {
  return invoke<void>('open_custom_face_editor');
}

export function focusCustomFaceEditor() {
  return invoke<void>('focus_custom_face_editor');
}

export function closeCustomFaceEditor() {
  return invoke<void>('close_custom_face_editor');
}

export type OpenCustomFaceImagePixelizerRequest = {
  width: number;
  height: number;
};

export function openCustomFaceImagePixelizer(request: OpenCustomFaceImagePixelizerRequest) {
  return invoke<void>('open_custom_face_image_pixelizer', { request });
}

export function closeCustomFaceImagePixelizer() {
  return invoke<void>('close_custom_face_image_pixelizer');
}

export function pixelizeCustomFaceImage(request: CustomFacePixelizeRequest) {
  return invoke<CustomFacePixelizeResult>('pixelize_custom_face_image', { request });
}

export function prepareCustomFaceImagePixelizerSource(
  request: PrepareCustomFacePixelizerSourceRequest
) {
  return invoke<PrepareCustomFacePixelizerSourceResult>(
    'prepare_custom_face_image_pixelizer_source',
    { request }
  );
}

export function pixelizeCustomFaceImageSource(request: CustomFacePixelizeSourceRequest) {
  return invoke<CustomFacePixelizeResult>('pixelize_custom_face_image_source', { request });
}

export function releaseCustomFaceImagePixelizerSource(sourceId: string) {
  return invoke<boolean>('release_custom_face_image_pixelizer_source', { sourceId });
}

export function applyCustomFaceImageImport(payload: CustomFaceImageImportReadyPayload) {
  return invoke<void>('apply_custom_face_image_import', { payload });
}

export type PrepareCustomFaceVectorizerSourceRequest = {
  fileName: string;
  imageBytes: number[];
  targetWidth: number;
  targetHeight: number;
};

export type PrepareCustomFaceVectorizerSourceResult = {
  sourceId: string;
  sourceWidth: number;
  sourceHeight: number;
  workingWidth: number;
  workingHeight: number;
};

export type CustomFaceVectorizeMode = 'binary' | 'color';

export type CustomFaceVectorizeOptions = {
  mode: CustomFaceVectorizeMode;
  filterSpeckle: number;
  colorPrecision: number;
  layerDifference: number;
  cornerThreshold: number;
  lengthThreshold: number;
  maxIterations: number;
  spliceThreshold: number;
  pathPrecision: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
  invert: boolean;
  brightness: number;
  contrast: number;
};

export type CustomFaceVectorizeSourceRequest = {
  sourceId: string;
  options: CustomFaceVectorizeOptions;
};

export type CustomFaceVectorizeResult = {
  svg: string;
  width: number;
  height: number;
};

export type VectorizedSvgTempFileResult = {
  path: string;
};

export type OpenCustomFaceImageVectorizerRequest = {
  width: number;
  height: number;
};

export function openCustomFaceImageVectorizer(request: OpenCustomFaceImageVectorizerRequest) {
  return invoke<void>('open_custom_face_image_vectorizer', { request });
}

export function closeCustomFaceImageVectorizer() {
  return invoke<void>('close_custom_face_image_vectorizer');
}

export function prepareCustomFaceImageVectorizerSource(
  request: PrepareCustomFaceVectorizerSourceRequest
) {
  return invoke<PrepareCustomFaceVectorizerSourceResult>(
    'prepare_custom_face_image_vectorizer_source',
    { request }
  );
}

export function vectorizeCustomFaceImageVectorizerSource(
  request: CustomFaceVectorizeSourceRequest
) {
  return invoke<CustomFaceVectorizeResult>('vectorize_custom_face_image_vectorizer_source', {
    request,
  });
}

export function releaseCustomFaceImageVectorizerSource(sourceId: string) {
  return invoke<boolean>('release_custom_face_image_vectorizer_source', { sourceId });
}

export function writeCustomFaceVectorizedSvgTempFile(svg: string) {
  return invoke<VectorizedSvgTempFileResult>('write_custom_face_vectorized_svg_temp_file', { svg });
}

export function emitCustomFaceOpenSvgPathEvent(path: string) {
  return invoke<boolean>('emit_custom_face_open_svg_path_event', { path });
}

export function takeLatestVectorizedSvgTempFilePath() {
  return invoke<string | null>('take_latest_vectorized_svg_temp_file_path');
}

export function getInternalEventCatalog() {
  return invoke<InternalEventDefinition[]>('internal_event_catalog_command');
}

export function createCustomInternalEvent(request: CreateCustomInternalEventRequest) {
  return invoke<InternalEventDefinition[]>('create_custom_internal_event', { request });
}

export function updateCustomInternalEvent(request: UpdateCustomInternalEventRequest) {
  return invoke<InternalEventDefinition[]>('update_custom_internal_event', { request });
}

export function deleteCustomInternalEvent(eventId: string) {
  return invoke<InternalEventDefinition[]>('delete_custom_internal_event', { eventId });
}

export function getProfileTemplateList() {
  return invoke<ProfileTemplateInfo[]>('profile_template_list');
}

export function getLocalHookServerStatus() {
  return invoke<LocalHookServerStatus>('local_hook_server_status');
}

export function rotateHookAuthToken() {
  return invoke<void>('rotate_hook_auth_token');
}

export function getHookEventState() {
  return invoke<HookEventFrontendState>('hook_event_state');
}

export function saveHookEventSelections(selections: HookEventSelections) {
  return invoke<HookEventSelections>('save_hook_event_selections', { selections });
}

export function addHookProjectTarget(source: string, projectPath: string) {
  return invoke<HookEventFrontendState>('add_hook_project_target', { source, projectPath });
}

export function removeHookConfigTarget(targetId: string) {
  return invoke<HookEventFrontendState>('remove_hook_config_target', { targetId });
}

export function previewHookConfigTarget(targetId: string, debug = false) {
  return invoke<HookConfigWritePreview>('preview_hook_config_target', { targetId, debug });
}

export function writeHookConfigTarget(targetId: string, debug = false) {
  return invoke<HookConfigWriteResult>('write_hook_config_target', { targetId, debug });
}

export function previewRestoreHookConfigTarget(targetId: string) {
  return invoke<HookConfigWritePreview>('preview_restore_hook_config_target', { targetId });
}

export function restoreHookConfigTarget(targetId: string) {
  return invoke<HookConfigWriteResult>('restore_hook_config_target', { targetId });
}

export function getSoundAssets() {
  return invoke<SoundAsset[]>('sound_assets');
}

export function previewSound(filePath: string, volumePercent: number, maxDurationMs: number) {
  return invoke<void>('preview_sound', { filePath, volumePercent, maxDurationMs });
}

export function getDeviceRuntimeStates() {
  return invoke<DeviceRuntimeState[]>('device_runtime_states');
}

export function getDeviceRuntimeState(deviceId: string) {
  return invoke<DeviceRuntimeState>('device_runtime_state', { deviceId });
}

export function scanDeviceTransports() {
  return invoke<DevicePortDescriptor[]>('scan_device_transports');
}

export function scanDeviceCandidates() {
  return invoke<DeviceCandidateResource[]>('scan_device_candidates');
}

export function identifyDeviceCandidate(
  resourceId: string,
  displayName: string,
  transport: DeviceTransportConfig
) {
  return invoke<DeviceCandidateResource>('identify_device_candidate', {
    request: { resourceId, displayName, transport },
  });
}

export function registerIdentifiedDevice(resource: DeviceCandidateResource, label: string) {
  return invoke<DeviceRuntimeState>('register_identified_device', {
    request: { resource, label },
  });
}

export function connectDevice(deviceId: string, transport?: DeviceTransportConfig | null) {
  return invoke<DeviceRuntimeState>('connect_device', {
    request: {
      deviceId,
      transport: transport ?? null,
    },
  });
}

export function autoConnectRegisteredDevices() {
  return invoke<DeviceRuntimeState[]>('auto_connect_registered_devices');
}

export function cancelDeviceOperation(deviceId: string, operationId: number) {
  return invoke<DeviceRuntimeState>('cancel_device_operation', { deviceId, operationId });
}

export function checkDeviceFirmware(deviceId: string) {
  return invoke<DeviceRuntimeState>('check_device_firmware', { deviceId });
}

export function disconnectDevice(deviceId: string) {
  return invoke<DeviceRuntimeState>('disconnect_device', { deviceId });
}

export function disconnectAllDevices() {
  return invoke<DeviceRuntimeState[]>('disconnect_all_devices');
}

export function removeRegisteredDevice(deviceId: string) {
  return invoke<DeviceRuntimeState[]>('remove_registered_device', { deviceId });
}

export function resetDeviceIdentity(deviceId: string) {
  return invoke<DeviceRuntimeState>('reset_device_identity', { deviceId });
}

export function pingConnectedDevices() {
  return invoke<DeviceRuntimeState[]>('ping_connected_devices');
}

export function openDeviceTransportMonitorWindow(deviceId: string) {
  return invoke<DeviceTransportMonitorSnapshot>('open_device_transport_monitor_window', {
    deviceId,
  });
}

export function getDeviceTransportMonitorSnapshot(deviceId: string) {
  return invoke<DeviceTransportMonitorSnapshot>('device_transport_monitor_snapshot', {
    deviceId,
  });
}

export function clearDeviceTransportMonitorEvents(deviceId: string) {
  return invoke<DeviceTransportMonitorSnapshot>('clear_device_transport_monitor_events', {
    deviceId,
  });
}

export function closeDeviceTransportMonitorSession(deviceId: string) {
  return invoke<void>('close_device_transport_monitor_session', { deviceId });
}

export function closeDeviceTransportMonitorWindow(deviceId: string) {
  return invoke<void>('close_device_transport_monitor_window', { deviceId });
}

export function sendDeviceTestAction(request: DeviceChannelAction) {
  return invoke<DeviceCommandResultView>('send_device_test_action', { request });
}

export function sendDeviceExtensionAction(request: DeviceExtensionAction) {
  return invoke<DeviceCommandResultView>('send_device_extension_action', { request });
}

export function updateDeviceChannels(deviceId: string, channels: DeviceChannel[]) {
  return invoke<DeviceRuntimeState>('update_device_channels', {
    request: {
      deviceId,
      channels,
    },
  });
}

export function getDeviceInputBindings() {
  return invoke<DeviceInputBinding[]>('device_input_bindings');
}

export function saveDeviceInputBindings(bindings: DeviceInputBinding[]) {
  return invoke<DeviceInputBinding[]>('save_device_input_bindings', { bindings });
}

export function getFirmwareFlashStatus(artifactId: string) {
  return invoke<FirmwareFlashStatus>('firmware_flash_status', { artifactId });
}

export function getFirmwareFlashTargets(artifactId: string) {
  return invoke<FirmwareFlashPortTarget[]>('firmware_flash_targets', { artifactId });
}

export function getArduinoCliStatus() {
  return invoke<ArduinoCliStatus>('arduino_cli_status');
}

export function getFirmwareCatalog() {
  return invoke<FirmwareCatalog>('firmware_catalog');
}

export function flashFirmware(request: FirmwareFlashRequest) {
  return invoke<FirmwareFlashResult>('flash_firmware', { request });
}
