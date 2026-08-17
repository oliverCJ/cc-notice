import { HookEventDefinition, HookEventSelections } from '@/api/tauriApi';
import { Translator } from '@/i18n';
import { hookEventSearchText } from '@/lib/hookEventText';
import { AiToolId } from '@/state/appStore';

export function applyDefaultSelections(catalog: HookEventDefinition[]): HookEventSelections {
  return normalizeSelections({
    bySource: catalog.reduce<Record<string, string[]>>((result, event) => {
      if (!event.defaultSelected) {
        return result;
      }
      result[event.source] = [...(result[event.source] ?? []), event.event];
      return result;
    }, {})
  });
}

export function eventsForTool(selections: HookEventSelections, selectedToolId: AiToolId) {
  return normalizeSelections(selections).bySource[selectedToolId] ?? [];
}

export function updateSelectionsForTool(
  selections: HookEventSelections,
  selectedToolId: AiToolId,
  events: string[]
): HookEventSelections {
  const normalized = normalizeSelections(selections);
  return normalizeSelections({
    bySource: {
      ...normalized.bySource,
      [selectedToolId]: events
    }
  });
}

export function normalizeSelections(selections: HookEventSelections): HookEventSelections {
  const bySource = { ...(selections.bySource ?? {}) };
  if (selections.codex && !bySource.codex) {
    bySource.codex = selections.codex;
  }
  if (selections.claudeCode && !bySource['claude-code']) {
    bySource['claude-code'] = selections.claudeCode;
  }
  return { bySource };
}

export function selectedHookEventsFromSelections(
  selections: HookEventSelections,
  catalog?: HookEventDefinition[]
) {
  const allowedSources = catalog
    ? new Set(catalog.map((event) => event.source))
    : null;
  return Object.entries(normalizeSelections(selections).bySource)
    .filter(([source]) => !allowedSources || allowedSources.has(source as HookEventDefinition['source']))
    .flatMap(([source, events]) => events.map((event) => ({ source, event })));
}

export function filterHookEvents(
  events: HookEventDefinition[],
  query: string,
  t?: Translator
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return events;
  }

  return events.filter(
    (event) =>
      (t ? hookEventSearchText(event, t) : fallbackSearchText(event)).includes(normalizedQuery)
  );
}

function fallbackSearchText(event: HookEventDefinition) {
  return [event.event, event.title, event.description, event.scenario].join(' ').toLowerCase();
}
