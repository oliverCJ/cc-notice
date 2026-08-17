import { InternalEventDefinition } from '../../api/tauriApi';
import { Translator } from '@/i18n';

const INTERNAL_EVENT_KEY_BY_ID: Record<string, string> = {
  'agent.started': 'agentStarted',
  'agent.working': 'agentWorking',
  'agent.waiting_input': 'agentWaitingInput',
  'tool.executing': 'toolExecuting',
  'agent.completed': 'agentCompleted',
  'agent.failed': 'agentFailed',
  notification: 'notification',
  'context.compacting': 'contextCompacting'
};

export function internalEventTitle(event: InternalEventDefinition, t: Translator) {
  return internalEventText(event, t, 'title', event.title);
}

export function internalEventDescription(event: InternalEventDefinition, t: Translator) {
  return internalEventText(event, t, 'description', event.description);
}

export function internalEventScenario(event: InternalEventDefinition, t: Translator) {
  return internalEventText(event, t, 'scenario', event.scenario);
}

function internalEventText(
  event: InternalEventDefinition,
  t: Translator,
  field: 'title' | 'description' | 'scenario',
  fallback: string
) {
  const eventKey = INTERNAL_EVENT_KEY_BY_ID[event.id];
  if (!eventKey) {
    return fallback;
  }

  const translationKey = `rules.internalEvents.${eventKey}.${field}`;
  const translated = t(translationKey);
  return translated === translationKey ? fallback : translated;
}
