import {
  AiEventMapping,
  EnabledHookEvent,
  HardwareOutputType,
  HardwareRule,
  HookEventDefinition,
  InternalEventDefinition,
  NoticeProfile
} from '@/api/tauriApi';
import { DeviceSelectOption } from '../deviceChannelOptions';

export type LinkWorkflowNodeStatus = 'blocked' | 'empty' | 'ready' | 'configured' | 'warning';
export type LinkWorkflowHookStatus = 'mapped' | 'disabled' | 'unmapped';

export type LinkWorkflowBlockedReason = 'no-enabled-hook-events' | null;

export type LinkWorkflowSelectedNode =
  | { kind: 'tool'; source: string }
  | { kind: 'internal-events' }
  | { kind: 'output-rules' };

export type EnabledHookEventOption = {
  source: string;
  event: string;
  definition?: HookEventDefinition | null;
};

export type LinkWorkflowViewModel = {
  blockedReason: LinkWorkflowBlockedReason;
  toolNodes: LinkWorkflowToolNode[];
  internalEventOverview: LinkWorkflowInternalEventOverview;
  outputOverview: LinkWorkflowOutputOverview;
  selectedNode: LinkWorkflowSelectedNode;
  enabledHookEventsBySource: Record<string, EnabledHookEventOption[]>;
  mappings: AiEventMapping[];
  hardwareRules: HardwareRule[];
  internalEvents: InternalEventDefinition[];
  deviceOptions: DeviceSelectOption[];
};

export type LinkWorkflowHookSummary = {
  source: string;
  event: string;
  title?: string | null;
  mappedInternalEvent?: string | null;
  mappedInternalEventTitle?: string | null;
  status: LinkWorkflowHookStatus;
};

export type LinkWorkflowToolNode = {
  id: string;
  source: string;
  title: string;
  enabledHookCount: number;
  mappedHookCount: number;
  hookEventSummaries: LinkWorkflowHookSummary[];
  status: LinkWorkflowNodeStatus;
};

export type LinkWorkflowInternalEventSummary = {
  id: string;
  title?: string | null;
  mappedHookCount: number;
  outputRuleCount: number;
  hookReferences: LinkWorkflowHookReference[];
  status: LinkWorkflowNodeStatus;
};

export type LinkWorkflowHookReference = {
  source: string;
  sourceTitle: string;
  event: string;
  eventTitle?: string | null;
};

export type LinkWorkflowInternalEventOverview = {
  events: LinkWorkflowInternalEventSummary[];
  mappedCount: number;
  withoutOutputCount: number;
  status: LinkWorkflowNodeStatus;
};

export type LinkWorkflowOutputOverview = {
  outputTypes: HardwareOutputType[];
  configuredOutputCount: number;
  needsConfigCount: number;
  status: LinkWorkflowNodeStatus;
};

export type BuildLinkWorkflowViewModelInput = {
  profile: NoticeProfile;
  hookCatalog: HookEventDefinition[];
  internalEvents: InternalEventDefinition[];
  enabledHookEvents: EnabledHookEvent[];
  deviceOptions: DeviceSelectOption[];
};
