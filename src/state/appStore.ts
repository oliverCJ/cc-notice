import {
  Rocket,
  Activity,
  Cpu,
  Settings,
  Webhook,
  HardDrive,
  Sliders,
  Bug,
  Stethoscope,
  type LucideIcon
} from 'lucide-react';
import type { DesktopNoticeInstance, DesktopNoticeRuleTarget } from '@/domain/desktopNotice';
import type { DeviceRuntimeErrorCode } from '@/api/tauriApi';

export type AiToolId = string;
export type PageId =
  | 'setup'
  | 'monitor'
  | 'devices'
  | 'rules'
  | 'hook-settings'
  | 'firmware'
  | 'diagnostics'
  | 'settings'
  | 'debug';
export type Language = 'zh-CN' | 'en-US';
export type ThemeMode = 'system' | 'light' | 'dark';
export type WindowCloseBehavior = 'hide-to-tray' | 'exit';
export type WindowStartupMode = 'normal' | 'lightweight';

export type AiToolOption = {
  id: AiToolId;
  name: string;
};

export type HookEventDefinitionView = {
  source: AiToolId;
  event: string;
  title: string;
  description: string;
  scenario: string;
  defaultSelected: boolean;
  mappedNoticeEvent: string;
};

export type HookEventSelectionsView = {
  bySource: Record<string, string[]>;
  codex?: string[];
  claudeCode?: string[];
};

export type HookConfigTargetView = {
  id: string;
  scope: 'global' | 'project';
  source: AiToolId;
  label: string;
  projectPath?: string | null;
  enabled: boolean;
  configPath: string;
  exists: boolean;
  canCreate: boolean;
};

export type DebugLogEntryView = {
  debugEntryId: string;
  source: string;
  event: string;
  payload: string;
  rawPayload?: string;
  result: string;
  internalEvent?: string;
  mappingStage?: string;
  commandSummary?: string;
  outputs?: DebugLogOutputView[];
  deviceResults?: DebugLogDeviceResultView[];
  error?: string;
  occurredAt: string;
  requestReceivedAt?: string;
  httpReadElapsedMs?: number;
  prepareElapsedMs?: number;
  queueDelayMs?: number;
  responseElapsedMs?: number;
  processingElapsedMs?: number;
  deviceProcessingElapsedMs?: number;
  webhookProcessingElapsedMs?: number;
  localProcessingElapsedMs?: number;
  processingCompletedAt?: string;
  processingMode?: string;
};

export type DebugLogOutputView = {
  type: string;
  ruleId: string;
  commandSummary?: string;
  desktopNoticeTargets?: DesktopNoticeRuleTarget[];
};

export type DebugLogDeviceResultView = {
  deviceId: string;
  channelId: string;
  outputType: string;
  status: string;
  ack?: string;
  errorCode?: DeviceRuntimeErrorCode;
  error?: string;
};

export type DebugTestEventRequestView = {
  source: AiToolId;
  event: string;
  payload: string;
};

export type SoftwareNoticeStateView = {
  lastEvent?: string;
  lastSource?: string;
};

export type AppConfigView = {
  localHookServer: {
    port: number;
  };
  ui: {
    language: Language;
    themeMode: ThemeMode;
  };
  window: {
    closeBehavior: WindowCloseBehavior;
    startupMode: WindowStartupMode;
    launchAtLogin: boolean;
    hideWindowOnLoginLaunch: boolean;
  };
  arduinoCliPath?: string | null;
  activeProfileId: string;
  hookEventSelections: HookEventSelectionsView;
  hookConfigTargets: Array<Omit<HookConfigTargetView, 'configPath' | 'exists' | 'canCreate'>>;
  desktopNoticeInstances: DesktopNoticeInstance[];
};

export type LocalHookServerStatusView = {
  running: boolean;
  port: number;
  bindAddress: string;
  eventUrl: string;
  healthUrl: string;
  error?: string;
};

export type NavItem = {
  id: PageId;
  labelKey: string;
  icon: LucideIcon;
  isHidden?: boolean;
};

export const navItems: NavItem[] = [
  { id: 'setup', labelKey: 'nav.setup', icon: Rocket },
  { id: 'hook-settings', labelKey: 'nav.hookSettings', icon: Webhook },
  { id: 'rules', labelKey: 'nav.rules', icon: Settings },
  { id: 'monitor', labelKey: 'nav.monitor', icon: Activity },
  { id: 'diagnostics', labelKey: 'nav.diagnostics', icon: Stethoscope },
  { id: 'devices', labelKey: 'nav.devices', icon: Cpu, isHidden: false },
  { id: 'firmware', labelKey: 'nav.firmware', icon: HardDrive, isHidden: false },
  { id: 'settings', labelKey: 'nav.settings', icon: Sliders },
  { id: 'debug', labelKey: 'nav.debug', icon: Bug }
];

export let aiTools: AiToolOption[] = [
  { id: 'codex', name: 'Codex' },
  { id: 'claude-code', name: 'Claude Code' }
];

export function syncAiToolsFromBackend(
  tools: Array<{ source: string; displayName: string }>
) {
  if (tools.length > 0) {
    aiTools = tools.map((tool) => ({ id: tool.source, name: tool.displayName }));
  }
}
