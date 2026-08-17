import type {
  DebugLogDeviceResultView,
  DebugLogEntryView,
  DebugLogOutputView
} from '@/state/appStore';

export type DebugLifecycleStatus = 'success' | 'warning' | 'error' | 'pending' | 'skipped';

export type DebugLifecycleNodeId =
  | 'inbound'
  | 'validation'
  | 'mapping'
  | 'rules'
  | 'outputs'
  | 'completion';

export type DebugOutputGroupId = 'local' | 'webhook' | 'desktop-notice' | 'device';

export type DebugLifecycleFact = {
  labelKey: string;
  value: string;
  valueKind: 'text' | 'i18nKey';
  tone?: 'default' | 'danger' | 'muted';
};

export type DebugLifecycleOutputGroup = {
  id: DebugOutputGroupId;
  outputs: DebugLogOutputView[];
};

export type DebugLifecycleSummary = {
  result: string;
  source: string;
  event: string;
  internalEvent: string | null;
  mappingStage: string | null;
  processingMode: string | null;
  totalElapsedMs: number | null;
  outputCount: number;
  deviceResultCount: number;
  failedDeviceResultCount: number;
};

export type DebugLifecycleNode = {
  id: DebugLifecycleNodeId;
  status: DebugLifecycleStatus;
  titleKey: string;
  descriptionKey: string;
  facts: DebugLifecycleFact[];
  outputGroups?: DebugLifecycleOutputGroup[];
  deviceResults?: DebugLogDeviceResultView[];
};

export type DebugEventLifecycleViewModel = {
  summary: DebugLifecycleSummary;
  nodes: DebugLifecycleNode[];
};

const ERROR_RESULTS = new Set(['error', 'failed', 'rejected', 'dropped']);
const DEVICE_OUTPUT_TYPES = new Set(['device-channel', 'display', 'buzzer']);

export function buildDebugEventLifecycleViewModel(
  entry: DebugLogEntryView
): DebugEventLifecycleViewModel {
  const outputs = entry.outputs ?? [];
  const deviceResults = entry.deviceResults ?? [];
  const failedDeviceResultCount = deviceResults.filter((result) => result.status === 'failed').length;
  const hasErrorResult = ERROR_RESULTS.has(entry.result);
  const hasInternalEvent = Boolean(entry.internalEvent);
  const rulesBlocked = hasErrorResult || !hasInternalEvent;
  const outputsBlocked = rulesBlocked || outputs.length === 0;
  const hasDeviceFailure = failedDeviceResultCount > 0;

  return {
    summary: {
      result: entry.result,
      source: entry.source,
      event: entry.event,
      internalEvent: entry.internalEvent ?? null,
      mappingStage: entry.mappingStage ?? null,
      processingMode: entry.processingMode ?? null,
      totalElapsedMs: entry.processingElapsedMs ?? entry.responseElapsedMs ?? null,
      outputCount: outputs.length,
      deviceResultCount: deviceResults.length,
      failedDeviceResultCount
    },
    nodes: [
      buildInboundNode(entry),
      buildValidationNode(entry, hasErrorResult),
      buildMappingNode(entry, hasErrorResult, hasInternalEvent),
      buildRulesNode(rulesBlocked, outputs.length),
      buildOutputsNode(entry, outputsBlocked, outputs, deviceResults, hasDeviceFailure),
      buildCompletionNode(entry, hasErrorResult, hasDeviceFailure)
    ]
  };
}

function buildInboundNode(entry: DebugLogEntryView): DebugLifecycleNode {
  return {
    id: 'inbound',
    status: 'success',
    titleKey: 'debug.lifecycle.nodes.inbound.title',
    descriptionKey: 'debug.lifecycle.nodes.inbound.description',
    facts: [
      fact('debug.lifecycle.facts.source', entry.source),
      fact('debug.lifecycle.facts.event', entry.event),
      fact('debug.lifecycle.facts.occurredAt', entry.occurredAt),
      fact('debug.lifecycle.facts.receivedAt', entry.requestReceivedAt),
      fact('debug.lifecycle.facts.httpRead', formatElapsed(entry.httpReadElapsedMs))
    ]
  };
}

function buildValidationNode(
  entry: DebugLogEntryView,
  hasErrorResult: boolean
): DebugLifecycleNode {
  return {
    id: 'validation',
    status: hasErrorResult ? 'error' : 'success',
    titleKey: 'debug.lifecycle.nodes.validation.title',
    descriptionKey: 'debug.lifecycle.nodes.validation.description',
    facts: [
      fact('debug.lifecycle.facts.prepare', formatElapsed(entry.prepareElapsedMs)),
      fact('debug.lifecycle.facts.response', formatElapsed(entry.responseElapsedMs)),
      fact('debug.lifecycle.facts.mode', entry.processingMode)
    ]
  };
}

function buildMappingNode(
  entry: DebugLogEntryView,
  hasErrorResult: boolean,
  hasInternalEvent: boolean
): DebugLifecycleNode {
  const status: DebugLifecycleStatus = hasErrorResult
    ? 'skipped'
    : hasInternalEvent
      ? 'success'
      : 'warning';
  return {
    id: 'mapping',
    status,
    titleKey: 'debug.lifecycle.nodes.mapping.title',
    descriptionKey: 'debug.lifecycle.nodes.mapping.description',
    facts: [
      fact('debug.lifecycle.facts.mappingStage', entry.mappingStage),
      hasInternalEvent
        ? fact('debug.lifecycle.facts.internalEvent', entry.internalEvent)
        : i18nFact(
            'debug.lifecycle.facts.internalEvent',
            'debug.lifecycle.messages.noInternalEvent',
            'muted'
          )
    ]
  };
}

function buildRulesNode(rulesBlocked: boolean, outputCount: number): DebugLifecycleNode {
  const status: DebugLifecycleStatus = rulesBlocked
    ? 'skipped'
    : outputCount === 0
      ? 'warning'
      : 'success';
  const outputValue =
    outputCount === 0 && !rulesBlocked ? undefined : String(outputCount);

  return {
    id: 'rules',
    status,
    titleKey: 'debug.lifecycle.nodes.rules.title',
    descriptionKey: 'debug.lifecycle.nodes.rules.description',
    facts: [
      outputValue
        ? fact('debug.lifecycle.facts.outputCount', outputValue)
        : i18nFact('debug.lifecycle.facts.outputCount', 'debug.lifecycle.messages.noOutputs', 'muted')
    ]
  };
}

function buildOutputsNode(
  entry: DebugLogEntryView,
  outputsBlocked: boolean,
  outputs: DebugLogOutputView[],
  deviceResults: DebugLogDeviceResultView[],
  hasDeviceFailure: boolean
): DebugLifecycleNode {
  const status: DebugLifecycleStatus = outputsBlocked
    ? 'skipped'
    : hasDeviceFailure
      ? 'warning'
      : 'success';
  const failedCount = deviceResults.filter((result) => result.status === 'failed').length;

  return {
    id: 'outputs',
    status,
    titleKey: 'debug.lifecycle.nodes.outputs.title',
    descriptionKey: 'debug.lifecycle.nodes.outputs.description',
    facts: [
      fact('debug.lifecycle.facts.outputCount', String(outputs.length)),
      fact(
        'debug.lifecycle.facts.deviceFailureCount',
        String(failedCount),
        failedCount > 0 ? 'danger' : 'default'
      )
    ],
    outputGroups: groupOutputs(outputs),
    deviceResults: entry.deviceResults ?? []
  };
}

function buildCompletionNode(
  entry: DebugLogEntryView,
  hasErrorResult: boolean,
  hasDeviceFailure: boolean
): DebugLifecycleNode {
  const isPending = entry.processingMode === 'async' && !entry.processingCompletedAt;
  const status: DebugLifecycleStatus =
    entry.error || hasErrorResult
      ? 'error'
      : hasDeviceFailure
        ? 'warning'
        : isPending
          ? 'pending'
          : 'success';
  const facts = [
    entry.processingCompletedAt
      ? fact('debug.lifecycle.facts.completedAt', entry.processingCompletedAt)
      : isPending
        ? i18nFact(
            'debug.lifecycle.facts.completedAt',
            'debug.lifecycle.messages.asyncPending',
            'muted'
          )
        : fact('debug.lifecycle.facts.completedAt', undefined),
    fact('debug.lifecycle.facts.processing', formatElapsed(entry.processingElapsedMs)),
    fact('debug.lifecycle.facts.deviceProcessing', formatElapsed(entry.deviceProcessingElapsedMs)),
    fact('debug.lifecycle.facts.webhookProcessing', formatElapsed(entry.webhookProcessingElapsedMs)),
    fact('debug.lifecycle.facts.localProcessing', formatElapsed(entry.localProcessingElapsedMs))
  ];

  if (entry.error) {
    facts.push(fact('debug.lifecycle.facts.error', entry.error, 'danger'));
  }

  return {
    id: 'completion',
    status,
    titleKey: 'debug.lifecycle.nodes.completion.title',
    descriptionKey: 'debug.lifecycle.nodes.completion.description',
    facts
  };
}

function groupOutputs(outputs: DebugLogOutputView[]): DebugLifecycleOutputGroup[] {
  const localOutputs = outputs.filter(
    (output) =>
      output.type !== 'webhook' &&
      output.type !== 'desktop-notice' &&
      !DEVICE_OUTPUT_TYPES.has(output.type)
  );
  const webhookOutputs = outputs.filter((output) => output.type === 'webhook');
  const desktopNoticeOutputs = outputs.filter((output) => output.type === 'desktop-notice');
  const deviceOutputs = outputs.filter((output) => DEVICE_OUTPUT_TYPES.has(output.type));
  return [
    { id: 'local' as const, outputs: localOutputs },
    { id: 'webhook' as const, outputs: webhookOutputs },
    { id: 'desktop-notice' as const, outputs: desktopNoticeOutputs },
    { id: 'device' as const, outputs: deviceOutputs }
  ].filter((group) => group.outputs.length > 0);
}

function fact(
  labelKey: string,
  value: string | undefined,
  tone: DebugLifecycleFact['tone'] = 'default'
): DebugLifecycleFact {
  return {
    labelKey,
    value: value ?? 'debug.lifecycle.notRecorded',
    valueKind: value === undefined ? 'i18nKey' : 'text',
    tone
  };
}

function i18nFact(
  labelKey: string,
  messageKey: string,
  tone: DebugLifecycleFact['tone'] = 'default'
): DebugLifecycleFact {
  return {
    labelKey,
    value: messageKey,
    valueKind: 'i18nKey',
    tone
  };
}

function formatElapsed(value?: number) {
  return value === undefined ? undefined : `${value} ms`;
}
