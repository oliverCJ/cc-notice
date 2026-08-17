import { DebugLogEntryView } from '@/state/appStore';

export type DebugLogFilters = {
  source: string;
  event: string;
  result: string;
  mappingStage: string;
  keyword: string;
};

export const defaultDebugLogFilters: DebugLogFilters = {
  source: 'all',
  event: 'all',
  result: 'all',
  mappingStage: 'all',
  keyword: ''
};

export function applyDebugLogFilters(
  entries: DebugLogEntryView[],
  filters: DebugLogFilters
) {
  const keyword = filters.keyword.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filters.source !== 'all' && entry.source !== filters.source) {
      return false;
    }
    if (filters.event !== 'all' && entry.event !== filters.event) {
      return false;
    }
    if (filters.result !== 'all' && entry.result !== filters.result) {
      return false;
    }
    if (filters.mappingStage !== 'all' && (entry.mappingStage ?? '-') !== filters.mappingStage) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return searchableText(entry).includes(keyword);
  });
}

export function debugLogFilterOptions(entries: DebugLogEntryView[]) {
  return {
    events: uniqueSorted(entries.map((entry) => entry.event)),
    results: uniqueSorted(entries.map((entry) => entry.result)),
    mappingStages: uniqueSorted(entries.map((entry) => entry.mappingStage).filter(isPresent))
  };
}

function searchableText(entry: DebugLogEntryView) {
  return [
    entry.source,
    entry.event,
    entry.result,
    entry.internalEvent,
    entry.mappingStage,
    entry.commandSummary,
    entry.error,
    entry.payload,
    entry.rawPayload,
    entry.occurredAt
  ]
    .filter(isPresent)
    .join('\n')
    .toLowerCase();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isPresent(value: string | undefined): value is string {
  return Boolean(value);
}
