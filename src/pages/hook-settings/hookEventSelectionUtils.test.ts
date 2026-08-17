import { describe, expect, test } from 'vitest';
import {
  applyDefaultSelections,
  eventsForTool,
  filterHookEvents,
  normalizeSelections,
  selectedHookEventsFromSelections,
  updateSelectionsForTool
} from './hookEventSelectionUtils';
import { HookEventDefinition, HookEventSelections } from '@/api/tauriApi';

const catalog: HookEventDefinition[] = [
  {
    source: 'codex',
    event: 'SessionStart',
    title: '会话开始',
    description: 'Codex 会话开始时触发。',
    scenario: '用于提示 AI 已进入工作状态。',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.running'
  },
  {
    source: 'codex',
    event: 'SubagentStart',
    title: '子代理开始',
    description: 'Codex 启动子代理处理任务时触发。',
    scenario: '用于观察复杂任务中的子代理活动。',
    defaultSelected: false,
    mappedNoticeEvent: 'agent.running'
  },
  {
    source: 'claude-code',
    event: 'StopFailure',
    title: '停止失败',
    description: '停止流程失败时触发。',
    scenario: '用于提示任务结束阶段发生异常。',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.failed'
  }
];

describe('hookEventSelectionUtils', () => {
  test('builds default selections from defaultSelected catalog entries', () => {
    expect(applyDefaultSelections(catalog)).toEqual({
      bySource: {
        codex: ['SessionStart'],
        'claude-code': ['StopFailure']
      }
    });
  });

  test('reads selected events for current tool', () => {
    const selections: HookEventSelections = {
      bySource: {
        codex: ['SessionStart'],
        'claude-code': ['StopFailure']
      }
    };

    expect(eventsForTool(selections, 'codex')).toEqual(['SessionStart']);
    expect(eventsForTool(selections, 'claude-code')).toEqual(['StopFailure']);
  });

  test('reads legacy fixed fields through normalized source index', () => {
    const selections: HookEventSelections = {
      bySource: {},
      codex: ['SessionStart'],
      claudeCode: ['StopFailure']
    };

    expect(normalizeSelections(selections)).toEqual({
      bySource: {
        codex: ['SessionStart'],
        'claude-code': ['StopFailure']
      }
    });
    expect(eventsForTool(selections, 'claude-code')).toEqual(['StopFailure']);
  });

  test('updates selected events for current tool without changing the other tool', () => {
    const selections: HookEventSelections = {
      bySource: {
        codex: ['SessionStart'],
        'claude-code': ['StopFailure']
      }
    };

    expect(updateSelectionsForTool(selections, 'codex', ['SubagentStart'])).toEqual({
      bySource: {
        codex: ['SubagentStart'],
        'claude-code': ['StopFailure']
      }
    });
    expect(updateSelectionsForTool(selections, 'claude-code', [])).toEqual({
      bySource: {
        codex: ['SessionStart'],
        'claude-code': []
      }
    });
  });

  test('converts source indexed selections to enabled hook events', () => {
    expect(
      selectedHookEventsFromSelections({
        bySource: {
          codex: ['SessionStart'],
          'claude-code': ['StopFailure']
        }
      })
    ).toEqual([
      { source: 'codex', event: 'SessionStart' },
      { source: 'claude-code', event: 'StopFailure' }
    ]);
  });

  test('converts only catalog sources when catalog is provided', () => {
    expect(
      selectedHookEventsFromSelections(
        {
          bySource: {
            codex: ['SessionStart'],
            'unknown-tool': ['SomeEvent']
          }
        },
        catalog
      )
    ).toEqual([{ source: 'codex', event: 'SessionStart' }]);
  });

  test('filters events by title, event name, and description case-insensitively', () => {
    expect(filterHookEvents(catalog, 'session').map((event) => event.event)).toEqual([
      'SessionStart'
    ]);
    expect(filterHookEvents(catalog, '子代理').map((event) => event.event)).toEqual([
      'SubagentStart'
    ]);
    expect(filterHookEvents(catalog, '失败').map((event) => event.event)).toEqual([
      'StopFailure'
    ]);
    expect(filterHookEvents(catalog, '').map((event) => event.event)).toEqual([
      'SessionStart',
      'SubagentStart',
      'StopFailure'
    ]);
  });
});
