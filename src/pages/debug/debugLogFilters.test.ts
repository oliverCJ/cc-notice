import { describe, expect, test } from 'vitest';
import { applyDebugLogFilters, debugLogFilterOptions } from './debugLogFilters';
import { DebugLogEntryView } from '@/state/appStore';

const entries: DebugLogEntryView[] = [
  {
    debugEntryId: 'debug-filter-1',
    source: 'codex',
    event: 'UserPromptSubmit',
    payload: '{"message":"hello"}',
    result: 'accepted',
    internalEvent: 'agent.started',
    mappingStage: 'hardwareRule',
    occurredAt: '2026-06-13T10:00:00Z'
  },
  {
    debugEntryId: 'debug-filter-2',
    source: 'claude-code',
    event: 'StopFailure',
    payload: '{"reason":"tool failed"}',
    result: 'error',
    mappingStage: 'aiEventMapping',
    error: 'no ai event mapping for claude-code/StopFailure',
    occurredAt: '2026-06-13T10:01:00Z'
  },
  {
    debugEntryId: 'debug-filter-3',
    source: 'codex',
    event: 'PostToolUse',
    payload: '{"tool":"shell"}',
    result: 'mapped',
    internalEvent: 'agent.working',
    mappingStage: 'aiEventMapping',
    occurredAt: '2026-06-13T10:02:00Z'
  }
];

describe('debugLogFilters', () => {
  test('filters entries by source event result stage and keyword', () => {
    const filtered = applyDebugLogFilters(entries, {
      source: 'codex',
      event: 'UserPromptSubmit',
      result: 'accepted',
      mappingStage: 'hardwareRule',
      keyword: 'started'
    });

    expect(filtered).toEqual([entries[0]]);
  });

  test('keyword matches error and payload fields case insensitively', () => {
    expect(
      applyDebugLogFilters(entries, {
        source: 'all',
        event: 'all',
        result: 'all',
        mappingStage: 'all',
        keyword: 'TOOL FAILED'
      })
    ).toEqual([entries[1]]);
  });

  test('builds unique sorted option lists from current entries', () => {
    const options = debugLogFilterOptions(entries);

    expect(options.events).toEqual(['PostToolUse', 'StopFailure', 'UserPromptSubmit']);
    expect(options.results).toEqual(['accepted', 'error', 'mapped']);
    expect(options.mappingStages).toEqual(['aiEventMapping', 'hardwareRule']);
  });
});
