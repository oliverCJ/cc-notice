import {
  AiEventMapping,
  HardwareOutput,
  HardwareRule,
  HardwareOutputType
} from '../../../api/tauriApi';
import { buildHardwareRuleId } from './ids';
import { createDefaultOutputForType } from './outputOptions';

export const MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT = 5;

export function createDefaultHardwareRuleForInternalEvent(
  internalEvent: string,
  outputType: HardwareOutputType = 'system-notification'
): HardwareRule {
  const output = createDefaultOutputForType(outputType, internalEvent);
  return {
    id: buildHardwareRuleIdForOutput(internalEvent, output),
    internalEvent,
    output,
    priority: 50,
    enabled: true
  };
}

export function createHardwareRuleIfAvailable(
  rules: HardwareRule[],
  internalEvent: string,
  outputType: HardwareOutputType,
  output: HardwareOutput
): HardwareRule | null {
  if (hardwareOutputCombinationInUse(rules, internalEvent, outputType)) {
    return null;
  }

  return {
    ...createDefaultHardwareRuleForInternalEvent(internalEvent, output.type),
    id: buildHardwareRuleIdForOutput(internalEvent, output),
    output
  };
}

export function hardwareOutputCombinationInUse(
  rules: HardwareRule[],
  internalEvent: string,
  outputType: HardwareOutputType,
  currentRuleId?: string
) {
  return rules.some(
    (rule) =>
      rule.id !== currentRuleId &&
      rule.internalEvent === internalEvent &&
      rule.output.type === outputType
  );
}

export function extractMappedInternalEvents(mappings: AiEventMapping[]): string[] {
  const eventSet = new Set<string>();
  mappings.forEach((mapping) => {
    if (mapping.enabled && mapping.internalEvent) {
      eventSet.add(mapping.internalEvent);
    }
  });
  return Array.from(eventSet).sort();
}

export function hasOutputTypeForEvent(
  rules: HardwareRule[],
  internalEvent: string,
  outputType: HardwareOutputType
): boolean {
  return rules.some(
    (rule) => rule.internalEvent === internalEvent && rule.output.type === outputType
  );
}

export function getRulesForEvent(rules: HardwareRule[], internalEvent: string): HardwareRule[] {
  return rules.filter((rule) => rule.internalEvent === internalEvent);
}

export function countEnabledOutputsForEvent(rules: HardwareRule[], internalEvent: string): number {
  return rules.filter((rule) => rule.internalEvent === internalEvent && rule.enabled).length;
}

export function enabledOutputLimitReached(rules: HardwareRule[], internalEvent: string): boolean {
  return countEnabledOutputsForEvent(rules, internalEvent) >= MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT;
}

/**
 * 同步输出规则到 AI 映射：
 * 1. 移除未在 AI 映射中使用的内部事件规则
 * 2. 为映射中的内部事件自动创建默认 system-notification 规则（如果不存在任何规则）
 */
export function syncHardwareRulesToMappings(
  rules: HardwareRule[],
  mappings: AiEventMapping[]
): HardwareRule[] {
  const mappedEvents = extractMappedInternalEvents(mappings);

  const existingRules = rules.filter((rule) => mappedEvents.includes(rule.internalEvent));
  const eventsWithRules = new Set(existingRules.map((rule) => rule.internalEvent));
  const eventsNeedingRules = mappedEvents.filter((eventId) => !eventsWithRules.has(eventId));

  const newRules = eventsNeedingRules.map((eventId) =>
    createDefaultHardwareRuleForInternalEvent(eventId, 'system-notification')
  );

  return [...existingRules, ...newRules];
}

function buildHardwareRuleIdForOutput(internalEvent: string, output: HardwareOutput): string {
  return buildHardwareRuleId(internalEvent, output.type);
}
