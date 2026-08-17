import { AiEventMapping, EnabledHookEvent, HardwareRule, HookEventDefinition } from '@/api/tauriApi';
import { aiTools } from '@/state/appStore';
import {
  BuildLinkWorkflowViewModelInput,
  EnabledHookEventOption,
  LinkWorkflowHookSummary,
  LinkWorkflowHookReference,
  LinkWorkflowInternalEventOverview,
  LinkWorkflowInternalEventSummary,
  LinkWorkflowNodeStatus,
  LinkWorkflowOutputOverview,
  LinkWorkflowToolNode,
  LinkWorkflowViewModel
} from './types';

export function buildLinkWorkflowViewModel(
  input: BuildLinkWorkflowViewModelInput
): LinkWorkflowViewModel {
  const enabledHookEvents = input.enabledHookEvents;
  const enabledHookEventsBySource = groupEnabledHookEvents(input, enabledHookEvents);
  const hasEnabledHookEvents = enabledHookEvents.length > 0;
  const blocked = !hasEnabledHookEvents;
  const toolNodes = buildToolNodes(input);

  return {
    blockedReason: blocked ? 'no-enabled-hook-events' : null,
    toolNodes,
    internalEventOverview: buildInternalEventOverview({
      mappings: input.profile.aiEventMappings,
      hardwareRules: input.profile.hardwareRules,
      internalEvents: input.internalEvents,
      hookCatalog: input.hookCatalog,
      blocked
    }),
    outputOverview: buildOutputOverview({
      hardwareRules: input.profile.hardwareRules,
      blocked
    }),
    selectedNode: toolNodes[0]
      ? { kind: 'tool', source: toolNodes[0].source }
      : { kind: 'internal-events' },
    enabledHookEventsBySource,
    mappings: input.profile.aiEventMappings,
    hardwareRules: input.profile.hardwareRules,
    internalEvents: input.internalEvents,
    deviceOptions: input.deviceOptions
  };
}

function buildToolNodes(input: BuildLinkWorkflowViewModelInput): LinkWorkflowToolNode[] {
  const enabledHookEventsBySource = groupEnabledHookEvents(input, input.enabledHookEvents);
  return Object.entries(enabledHookEventsBySource)
    .map(([source, enabledHooks]) => {
      const hookEventSummaries = enabledHooks.map((hook) =>
        buildHookSummary(hook, input.profile.aiEventMappings, input.internalEvents)
      );
      const mappedHookCount = hookEventSummaries.filter(
        (summary) => summary.status === 'mapped'
      ).length;

      return {
        id: `tool-${source}`,
        source,
        title: toolTitleForSource(source, input.hookCatalog),
        enabledHookCount: enabledHooks.length,
        mappedHookCount,
        hookEventSummaries,
        status: toolNodeStatus(enabledHooks.length, mappedHookCount)
      };
    })
    .sort((left, right) => left.source.localeCompare(right.source));
}

function buildHookSummary(
  hook: EnabledHookEventOption,
  mappings: AiEventMapping[],
  internalEvents: BuildLinkWorkflowViewModelInput['internalEvents']
): LinkWorkflowHookSummary {
  const mapping = mappings.find(
    (item) => item.source === hook.source && item.event === hook.event
  );
  const internalEvent = mapping
    ? internalEvents.find((event) => event.id === mapping.internalEvent)
    : null;
  const status = mapping ? (mapping.enabled ? 'mapped' : 'disabled') : 'unmapped';

  return {
    source: hook.source,
    event: hook.event,
    title: hook.definition?.title ?? null,
    mappedInternalEvent: mapping?.internalEvent ?? null,
    mappedInternalEventTitle: internalEvent?.title ?? null,
    status
  };
}

function toolTitleForSource(source: string, hookCatalog: HookEventDefinition[]) {
  return (
    aiTools.find((tool) => tool.id === source)?.name ??
    hookCatalog.find((item) => item.source === source)?.source ??
    source
  );
}

function toolNodeStatus(
  enabledHookCount: number,
  mappedHookCount: number
): LinkWorkflowNodeStatus {
  if (enabledHookCount === 0) {
    return 'blocked';
  }
  if (mappedHookCount === enabledHookCount) {
    return 'configured';
  }
  if (mappedHookCount > 0) {
    return 'warning';
  }
  return 'warning';
}

function buildInternalEventOverview(input: {
  mappings: AiEventMapping[];
  hardwareRules: HardwareRule[];
  internalEvents: BuildLinkWorkflowViewModelInput['internalEvents'];
  hookCatalog: HookEventDefinition[];
  blocked: boolean;
}): LinkWorkflowInternalEventOverview {
  if (input.blocked) {
    return { events: [], mappedCount: 0, withoutOutputCount: 0, status: 'blocked' };
  }

  const enabledMappings = input.mappings.filter((mapping) => mapping.enabled);
  const mappedEventIds = Array.from(
    new Set(enabledMappings.map((mapping) => mapping.internalEvent))
  ).sort((left, right) => left.localeCompare(right));
  const events: LinkWorkflowInternalEventSummary[] = mappedEventIds.map((eventId) => {
    const outputRuleCount = input.hardwareRules.filter(
      (rule) => rule.enabled && rule.internalEvent === eventId
    ).length;
    const hookReferences = buildHookReferences({
      mappings: enabledMappings,
      internalEvent: eventId,
      hookCatalog: input.hookCatalog
    });
    return {
      id: eventId,
      title: input.internalEvents.find((event) => event.id === eventId)?.title ?? null,
      mappedHookCount: enabledMappings.filter((mapping) => mapping.internalEvent === eventId).length,
      outputRuleCount,
      hookReferences,
      status: outputRuleCount > 0 ? 'configured' : 'warning'
    };
  });
  const withoutOutputCount = events.filter((event) => event.outputRuleCount === 0).length;

  return {
    events,
    mappedCount: events.length,
    withoutOutputCount,
    status: events.length === 0 ? 'empty' : withoutOutputCount > 0 ? 'warning' : 'configured'
  };
}

function buildHookReferences(input: {
  mappings: AiEventMapping[];
  internalEvent: string;
  hookCatalog: HookEventDefinition[];
}): LinkWorkflowHookReference[] {
  return input.mappings
    .filter((mapping) => mapping.internalEvent === input.internalEvent)
    .map((mapping) => {
      const hookDefinition =
        input.hookCatalog.find(
          (item) => item.source === mapping.source && item.event === mapping.event
        ) ?? null;
      return {
        source: mapping.source,
        sourceTitle: toolTitleForSource(mapping.source, input.hookCatalog),
        event: mapping.event,
        eventTitle: hookDefinition?.title ?? null
      };
    })
    .sort((left, right) =>
      `${left.sourceTitle}.${left.event}`.localeCompare(`${right.sourceTitle}.${right.event}`)
    );
}

function buildOutputOverview(input: {
  hardwareRules: HardwareRule[];
  blocked: boolean;
}): LinkWorkflowOutputOverview {
  if (input.blocked) {
    return { outputTypes: [], configuredOutputCount: 0, needsConfigCount: 0, status: 'blocked' };
  }

  const enabledRules = input.hardwareRules.filter((rule) => rule.enabled);
  const needsConfigCount = input.hardwareRules.filter(outputNeedsConfig).length;
  const outputTypes = Array.from(new Set(input.hardwareRules.map((rule) => rule.output.type))).sort();

  return {
    outputTypes,
    configuredOutputCount: enabledRules.length,
    needsConfigCount,
    status:
      input.hardwareRules.length === 0
        ? 'empty'
        : needsConfigCount > 0
          ? 'warning'
          : 'configured'
  };
}

function outputNeedsConfig(rule: HardwareRule): boolean {
  if (rule.output.type === 'webhook') {
    return !(rule.output.webhookUrl ?? '').trim();
  }
  if (rule.output.type === 'sound') {
    return !(rule.output.soundFilePath ?? '').trim();
  }
  if (rule.output.type === 'device-channel') {
    return (rule.output.channelActions ?? []).length === 0;
  }
  return false;
}

function groupEnabledHookEvents(
  input: BuildLinkWorkflowViewModelInput,
  enabledHookEvents: EnabledHookEvent[]
): Record<string, EnabledHookEventOption[]> {
  return enabledHookEvents.reduce<Record<string, EnabledHookEventOption[]>>(
    (groups, enabled) => {
      const definition =
        input.hookCatalog.find(
          (item) => item.source === enabled.source && item.event === enabled.event
        ) ?? null;
      groups[enabled.source] = groups[enabled.source] ?? [];
      groups[enabled.source].push({
        source: enabled.source,
        event: enabled.event,
        definition
      });
      return groups;
    },
    {}
  );
}
