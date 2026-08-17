import {
  AiEventMapping,
  HookEventDefinition,
  InternalEventDefinition
} from '../../../api/tauriApi';
import { buildAiMappingId } from './ids';

export function aiMappingEventInUse(
  mappings: AiEventMapping[],
  source: string,
  event: string,
  currentMappingId?: string
) {
  return mappings.some(
    (mapping) =>
      mapping.id !== currentMappingId && mapping.source === source && mapping.event === event
  );
}

export function createDefaultAiMapping(
  hookEvent: HookEventDefinition,
  internalEvents: InternalEventDefinition[]
): AiEventMapping {
  const internalEvent = firstInternalEventId(internalEvents);
  return {
    id: buildAiMappingId(hookEvent.source, hookEvent.event, internalEvent),
    source: hookEvent.source,
    event: hookEvent.event,
    internalEvent,
    enabled: true
  };
}

export function createAiMappingIfAvailable(
  mappings: AiEventMapping[],
  hookEvent: HookEventDefinition,
  internalEvent: string,
  internalEvents: InternalEventDefinition[]
): AiEventMapping | null {
  if (aiMappingEventInUse(mappings, hookEvent.source, hookEvent.event)) {
    return null;
  }

  return {
    ...createDefaultAiMapping(hookEvent, internalEvents),
    internalEvent,
    id: buildAiMappingId(hookEvent.source, hookEvent.event, internalEvent)
  };
}

function firstInternalEventId(internalEvents: InternalEventDefinition[]) {
  return internalEvents[0]?.id ?? 'agent.running';
}
