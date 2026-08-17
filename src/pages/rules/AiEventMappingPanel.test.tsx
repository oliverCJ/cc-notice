import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import {
  AiEventMapping,
  HardwareRule,
  HookEventDefinition,
  InternalEventDefinition
} from '../../api/tauriApi';
import { AiEventMappingPanel } from './AiEventMappingPanel';

const mappings: AiEventMapping[] = [
  {
    id: 'codex-userpromptsubmit-agent-started',
    source: 'codex',
    event: 'UserPromptSubmit',
    internalEvent: 'agent.started',
    enabled: true
  },
  {
    id: 'codex-stop-agent-completed',
    source: 'codex',
    event: 'Stop',
    internalEvent: 'agent.completed',
    enabled: false
  },
  {
    id: 'codex-pretooluse-tool-executing',
    source: 'codex',
    event: 'PreToolUse',
    internalEvent: 'tool.executing',
    enabled: true
  }
];

const internalEvents: InternalEventDefinition[] = [
  {
    id: 'agent.started',
    title: 'AI 开始工作',
    description: '用户提交 prompt 后，AI 开始处理任务。',
    scenario: '用户提交提示',
    builtIn: true
  },
  {
    id: 'agent.completed',
    title: 'AI 完成任务',
    description: 'AI 完成当前任务。',
    scenario: '任务结束',
    builtIn: true
  },
  {
    id: 'tool.executing',
    title: '工具执行中',
    description: 'AI 正在调用工具。',
    scenario: '工具调用',
    builtIn: true
  }
];

const internalEventsWithCustom: InternalEventDefinition[] = [
  ...internalEvents,
  {
    id: 'review.started.userDefined',
    title: '评审开始',
    description: '代码评审流程开始。',
    scenario: '用户提交 review 请求',
    builtIn: false
  }
];

const hookCatalog: HookEventDefinition[] = [
  {
    source: 'codex',
    event: 'UserPromptSubmit',
    title: '用户提交提示',
    description: '用户提交 prompt 时触发。',
    scenario: '任务开始',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.started'
  }
];

const createDialogHookCatalog: HookEventDefinition[] = [
  {
    source: 'codex',
    event: 'Notification',
    title: '通知',
    description: 'AI 工具发出通知时触发。',
    scenario: '通知提示',
    defaultSelected: false,
    mappedNoticeEvent: 'notification'
  },
  {
    source: 'codex',
    event: 'SessionStart',
    title: '会话开始',
    description: '会话启动时触发。',
    scenario: '启动或恢复会话',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.started'
  }
];

describe('AiEventMappingPanel', () => {
  test('marks mapping rows with hook-event accents and disabled-state accent override', () => {
    render(
      <AiEventMappingPanel
        mappings={mappings}
        hardwareRules={[] as HardwareRule[]}
        enabledHookEvents={[
          { source: 'codex', event: 'UserPromptSubmit' },
          { source: 'codex', event: 'Stop' }
        ]}
        hookCatalog={hookCatalog}
        internalEvents={internalEvents}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('ai-mapping-row-codex-userpromptsubmit-agent-started')).toHaveClass(
      'bg-background',
      'border-l-4',
      'border-l-sky-400'
    );
    expect(screen.getByTestId('ai-mapping-row-codex-stop-agent-completed')).toHaveClass(
      'bg-background',
      'border-l-zinc-400'
    );
    expect(screen.getByTestId('ai-mapping-row-codex-pretooluse-tool-executing')).toHaveClass(
      'bg-background',
      'border-l-violet-400'
    );
  });

  test('create dialog only offers hook events enabled in hook settings', () => {
    render(
      <AiEventMappingPanel
        mappings={[]}
        hardwareRules={[] as HardwareRule[]}
        enabledHookEvents={[{ source: 'codex', event: 'SessionStart' }]}
        hookCatalog={createDialogHookCatalog}
        internalEvents={internalEvents}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '新增映射' }));
    const dialog = screen.getByRole('dialog', { name: '新增 Codex 映射' });

    expect(
      within(dialog).getByText('可选 Hook 事件来源于「Hook 设置」中已启用的事件。')
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Hook 事件' }));

    expect(screen.getByRole('option', { name: /SessionStart/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Notification/ })).not.toBeInTheDocument();
  });

  test('creating a mapping does not mutate enabled hook events', () => {
    const onChange = vi.fn();
    render(
      <AiEventMappingPanel
        mappings={[]}
        hardwareRules={[] as HardwareRule[]}
        enabledHookEvents={[{ source: 'codex', event: 'SessionStart' }]}
        hookCatalog={createDialogHookCatalog}
        internalEvents={internalEvents}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '新增映射' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        aiEventMappings: [
          expect.objectContaining({
            source: 'codex',
            event: 'SessionStart',
            internalEvent: 'agent.started'
          })
        ]
      })
    );
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('enabledHookEvents');
  });

  test('create dialog offers custom internal events from merged catalog', () => {
    render(
      <AiEventMappingPanel
        mappings={[]}
        hardwareRules={[] as HardwareRule[]}
        enabledHookEvents={[{ source: 'codex', event: 'SessionStart' }]}
        hookCatalog={createDialogHookCatalog}
        internalEvents={internalEventsWithCustom}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '新增映射' }));
    const dialog = screen.getByRole('dialog', { name: '新增 Codex 映射' });
    fireEvent.click(within(dialog).getByRole('combobox', { name: '内部事件' }));

    expect(screen.getByRole('option', { name: /review\.started\.userDefined/ })).toBeInTheDocument();
  });

  test('creates mapping with selected custom internal event without mutating hook settings', () => {
    const onChange = vi.fn();
    render(
      <AiEventMappingPanel
        mappings={[]}
        hardwareRules={[] as HardwareRule[]}
        enabledHookEvents={[{ source: 'codex', event: 'SessionStart' }]}
        hookCatalog={createDialogHookCatalog}
        internalEvents={internalEventsWithCustom}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '新增映射' }));
    const dialog = screen.getByRole('dialog', { name: '新增 Codex 映射' });
    fireEvent.click(within(dialog).getByRole('combobox', { name: '内部事件' }));
    fireEvent.click(screen.getByRole('option', { name: /review\.started\.userDefined/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        aiEventMappings: [
          expect.objectContaining({
            source: 'codex',
            event: 'SessionStart',
            internalEvent: 'review.started.userDefined'
          })
        ]
      })
    );
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('enabledHookEvents');
  });
});
