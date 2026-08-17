import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { HardwareOutputType, HardwareRule, NoticeProfile } from '@/api/tauriApi';
import { LinkWorkflowCanvas } from './LinkWorkflowCanvas';
import { createDefaultHardwareRuleForInternalEvent } from '../ruleProfileUtils';
import { LinkWorkflowViewModel } from './types';

function profileFixture(): NoticeProfile {
  return {
    id: 'daily-coding',
    name: 'Daily Coding',
    enabledHookEvents: [
      { source: 'codex', event: 'SessionStart' },
      { source: 'claude-code', event: 'StopFailure' }
    ],
    aiEventMappings: [
      {
        id: 'codex-sessionstart-agent-started',
        source: 'codex',
        event: 'SessionStart',
        internalEvent: 'agent.started',
        enabled: true
      }
    ],
    hardwareRules: [
      createDefaultHardwareRuleForInternalEvent('agent.started', 'system-notification')
    ],
    device: { boardId: 'rp2040-pico', transport: 'serial' }
  };
}

function outputRuleFixture(
  internalEvent: string,
  outputType: HardwareOutputType,
  enabled = true
): HardwareRule {
  const rule = createDefaultHardwareRuleForInternalEvent(internalEvent, outputType);
  if (rule.output.type === 'webhook') {
    rule.output.webhookUrl = 'https://example.test/hooks';
  }
  if (rule.output.type === 'sound') {
    rule.output.soundFilePath = '/tmp/notice.wav';
  }
  if (rule.output.type === 'desktop-notice') {
    rule.output.desktopNoticeTargets = [
      {
        targetId: 'notice-main',
        effect: 'solid',
        colorMode: 'solid',
        colors: [{ color: '#22C55E', position: 0 }],
        durationMs: 3000,
        breathingPeriodMs: 1600,
        opacityPercent: 100,
        brightnessPercent: 100,
        restoreBehavior: 'use-instance-idle',
        edge: 'auto'
      }
    ];
  }
  return {
    ...rule,
    enabled
  };
}

function outputLimitProfileFixture(): NoticeProfile {
  return {
    ...profileFixture(),
    hardwareRules: [
      outputRuleFixture('agent.started', 'device-channel'),
      outputRuleFixture('agent.started', 'system-notification'),
      outputRuleFixture('agent.started', 'webhook'),
      outputRuleFixture('agent.started', 'desktop-notice'),
      displayOutputRuleFixture('agent.started'),
      outputRuleFixture('agent.started', 'sound', false)
    ]
  };
}

function outputLimitAddProfileFixture(): NoticeProfile {
  return {
    ...profileFixture(),
    hardwareRules: [
      outputRuleFixture('agent.started', 'device-channel'),
      outputRuleFixture('agent.started', 'system-notification'),
      outputRuleFixture('agent.started', 'webhook'),
      outputRuleFixture('agent.started', 'desktop-notice')
    ]
  };
}

function blockedViewModel(): LinkWorkflowViewModel {
  return {
    blockedReason: 'no-enabled-hook-events',
    toolNodes: [],
    internalEventOverview: {
      events: [],
      mappedCount: 0,
      withoutOutputCount: 0,
      status: 'blocked'
    },
    outputOverview: {
      outputTypes: [],
      configuredOutputCount: 0,
      needsConfigCount: 0,
      status: 'blocked'
    },
    selectedNode: { kind: 'internal-events' },
    enabledHookEventsBySource: {},
    mappings: [],
    hardwareRules: [],
    internalEvents: [],
    deviceOptions: []
  };
}

function multiToolViewModel(): LinkWorkflowViewModel {
  return {
    blockedReason: null,
    toolNodes: [
      {
        id: 'tool-codex',
        source: 'codex',
        title: 'Codex',
        enabledHookCount: 12,
        mappedHookCount: 10,
        status: 'warning',
        hookEventSummaries: [
          {
            source: 'codex',
            event: 'SessionStart',
            title: '会话开始',
            mappedInternalEvent: 'agent.started',
            mappedInternalEventTitle: 'AI 开始工作',
            status: 'mapped'
          },
          {
            source: 'codex',
            event: 'UserPromptSubmit',
            title: '用户提交提示',
            mappedInternalEvent: null,
            mappedInternalEventTitle: null,
            status: 'unmapped'
          },
          {
            source: 'codex',
            event: 'Notification',
            title: '通知事件',
            mappedInternalEvent: 'agent.failed',
            mappedInternalEventTitle: 'AI 执行异常',
            status: 'disabled'
          }
        ]
      },
      {
        id: 'tool-claude-code',
        source: 'claude-code',
        title: 'Claude Code',
        enabledHookCount: 1,
        mappedHookCount: 0,
        status: 'warning',
        hookEventSummaries: [
          {
            source: 'claude-code',
            event: 'StopFailure',
            title: '停止失败',
            mappedInternalEvent: null,
            mappedInternalEventTitle: null,
            status: 'unmapped'
          }
        ]
      }
    ],
    internalEventOverview: {
      events: [
        {
          id: 'agent.started',
          title: 'AI 开始工作',
          mappedHookCount: 1,
          outputRuleCount: 1,
          status: 'configured',
          hookReferences: [
            {
              source: 'codex',
              sourceTitle: 'Codex',
              event: 'SessionStart',
              eventTitle: '会话开始'
            }
          ]
        }
      ],
      mappedCount: 1,
      withoutOutputCount: 0,
      status: 'configured'
    },
    outputOverview: {
      outputTypes: ['system-notification'],
      configuredOutputCount: 1,
      needsConfigCount: 0,
      status: 'configured'
    },
    selectedNode: { kind: 'tool', source: 'codex' },
    enabledHookEventsBySource: {},
    mappings: profileFixture().aiEventMappings,
    hardwareRules: profileFixture().hardwareRules,
    internalEvents: [
      {
        id: 'agent.started',
        title: 'AI 开始工作',
        description: 'AI 开始处理任务。',
        scenario: '用户提交提示',
        builtIn: true
      },
      {
        id: 'agent.completed',
        title: '任务完成',
        description: 'AI 任务正常结束。',
        scenario: '会话结束',
        builtIn: true
      }
    ],
    deviceOptions: []
  };
}

function noMappingViewModel(): LinkWorkflowViewModel {
  return {
    ...multiToolViewModel(),
    internalEventOverview: {
      events: [],
      mappedCount: 0,
      withoutOutputCount: 0,
      status: 'empty'
    },
    outputOverview: {
      outputTypes: [],
      configuredOutputCount: 0,
      needsConfigCount: 0,
      status: 'empty'
    },
    mappings: [],
    hardwareRules: []
  };
}

function outputLimitViewModel(): LinkWorkflowViewModel {
  const profile = outputLimitProfileFixture();
  return {
    ...multiToolViewModel(),
    outputOverview: {
      outputTypes: [
        'device-channel',
        'system-notification',
        'webhook',
        'desktop-notice',
        'display',
        'sound'
      ],
      configuredOutputCount: 6,
      needsConfigCount: 0,
      status: 'configured'
    },
    hardwareRules: profile.hardwareRules
  };
}

function outputLimitAddViewModel(): LinkWorkflowViewModel {
  const profile = outputLimitAddProfileFixture();
  return {
    ...multiToolViewModel(),
    outputOverview: {
      outputTypes: ['device-channel', 'system-notification', 'webhook', 'desktop-notice'],
      configuredOutputCount: 4,
      needsConfigCount: 0,
      status: 'configured'
    },
    hardwareRules: profile.hardwareRules
  };
}

function displayOutputRuleFixture(internalEvent: string): HardwareRule {
  return {
    ...createDefaultHardwareRuleForInternalEvent(internalEvent, 'display'),
    id: `${internalEvent.replace(/\./g, '-')}-display-output`,
    enabled: true,
    output: {
      ...createDefaultHardwareRuleForInternalEvent(internalEvent, 'display').output,
      type: 'display',
      displayDeviceId: 'desk-wio',
      displayStatus: 'notice',
      displayTitleTemplate: '{{source}}',
      displayMessageTemplate: '{{last_assistant_message}}',
      displayTitleMaxChars: 39,
      displayMessageMaxChars: 95,
      displayExpireBehavior: 'restore-status'
    }
  };
}

describe('LinkWorkflowCanvas', () => {
  test('renders blocked empty state when no hook event is enabled', () => {
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={blockedViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Hook 设置中还没有启用事件')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前往 Hook 设置' })).toBeInTheDocument();
  });

  test('renders C3 workflow canvas with one node per AI tool source', () => {
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('内部事件总览')).toBeInTheDocument();
    expect(screen.getByText('输出规则')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-canvas-surface')).toBeInTheDocument();
    expect(screen.getAllByTestId('workflow-join-lines')).toHaveLength(2);
  });

  test('keeps tool node text within compact node bounds', () => {
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    const mappedBadge = screen.getByText('10/12');
    expect(mappedBadge.className).toContain('max-w-');
    expect(mappedBadge.className).toContain('truncate');
    expect(screen.queryByText('10/12 已映射')).not.toBeInTheDocument();
    expect(screen.getByText('启用 12 个 Hook').className).toContain('truncate');
  });

  test('opens selected node details in a floating inspector dialog', () => {
    const openAiMapping = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onOpenAiMapping={openAiMapping}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.queryByRole('dialog', { name: /Hook 映射/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Claude Code/ }));
    expect(screen.getByRole('dialog', { name: 'Claude Code Hook 映射' })).toBeInTheDocument();
    expect(screen.queryByText('需确认')).not.toBeInTheDocument();
    expect(screen.queryByText('未配置映射')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '配置映射 StopFailure' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑 AI 映射' }));
    expect(openAiMapping).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /内部事件总览/ }));
    expect(screen.getByRole('dialog', { name: '内部事件引用' })).toBeInTheDocument();
    expect(screen.getByText('查看已被 AI Hook 使用的内部事件。')).toBeInTheDocument();
    expect(screen.queryByText(/配置入口/)).not.toBeInTheDocument();
  });

  test('opens hook reference popover from internal event inspector', () => {
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /内部事件总览/ }));
    fireEvent.click(screen.getByRole('button', { name: '查看 agent.started 的 Hook 引用' }));

    expect(screen.getByText('引用 Hook')).toBeInTheDocument();
    expect(screen.getByText('Codex · SessionStart')).toBeInTheDocument();
  });

  test('shows helpful empty states in internal and output inspectors', () => {
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={{
            ...profileFixture(),
            aiEventMappings: [],
            hardwareRules: []
          }}
          viewModel={noMappingViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /内部事件总览/ }));
    expect(screen.getByText('还没有内部事件被 Hook 映射引用。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    expect(screen.getByText('请先完成 Hook 到内部事件的映射，再配置输出方式。')).toBeInTheDocument();
  });

  test('shows disabled hook mapping status separately from unmapped status', () => {
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Codex/ }));

    expect(screen.getByText('映射已停用')).toBeInTheDocument();
    expect(screen.queryByText('未配置映射')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '配置映射 UserPromptSubmit' })).toBeInTheDocument();
  });

  test('toggles existing hook mapping from tool inspector', () => {
    const saveProfile = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Codex/ }));
    fireEvent.click(screen.getByRole('switch', { name: '停用 SessionStart 映射' }));

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        aiEventMappings: [
          expect.objectContaining({
            event: 'SessionStart',
            enabled: false
          })
        ]
      })
    );
  });

  test('opens existing output edit dialog from output inspector', () => {
    const openOutputRules = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onOpenOutputRules={openOutputRules}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));

    expect(screen.getByRole('dialog', { name: '输出规则' })).toBeInTheDocument();
    expect(screen.getByText('选择内部事件，查看它会触发哪些输出方式。')).toBeInTheDocument();
    expect(screen.queryByText(/复用/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加输出方式' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '进入输出规则' }));
    expect(openOutputRules).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    fireEvent.click(screen.getByRole('button', { name: '编辑 system-notification' }));

    expect(screen.getByRole('dialog', { name: /system-notification 输出设置/ })).toBeInTheDocument();
  });

  test('hides legacy standalone display output from output inspector', () => {
    const profile = {
      ...profileFixture(),
      hardwareRules: [
        ...profileFixture().hardwareRules,
        displayOutputRuleFixture('agent.started')
      ]
    };
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profile}
          viewModel={{
            ...multiToolViewModel(),
            hardwareRules: profile.hardwareRules
          }}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    const outputDialog = screen.getByRole('dialog', { name: '输出规则' });

    expect(within(outputDialog).queryByText('屏幕输出')).not.toBeInTheDocument();
    expect(
      within(outputDialog).queryByRole('button', { name: '编辑 display' })
    ).not.toBeInTheDocument();
  });

  test('adds missing output type by opening its detail dialog before saving profile', () => {
    const saveProfile = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    const outputDialog = screen.getByRole('dialog', { name: '输出规则' });
    fireEvent.click(within(outputDialog).getByRole('button', { name: '添加并配置 webhook' }));

    const detailDialog = screen.getByRole('dialog', { name: /webhook 输出设置/ });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(within(detailDialog).getByText('Webhook URL 必填')).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();

    fireEvent.change(within(detailDialog).getByLabelText(/Webhook URL/), {
      target: { value: 'https://example.test/hooks' }
    });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareRules: expect.arrayContaining([
          expect.objectContaining({
            internalEvent: 'agent.started',
            output: expect.objectContaining({
              type: 'webhook',
              webhookUrl: 'https://example.test/hooks'
            })
          })
        ])
      })
    );
  });

  test('configures unmapped hook to internal event from tool inspector', () => {
    const saveProfile = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Claude Code/ }));
    const hookDialog = screen.getByRole('dialog', { name: 'Claude Code Hook 映射' });
    fireEvent.click(within(hookDialog).getByRole('button', { name: '配置映射 StopFailure' }));

    const mappingDialog = screen.getByRole('dialog', { name: '配置 Hook 映射' });
    expect(within(mappingDialog).getByText('StopFailure')).toBeInTheDocument();
    fireEvent.click(within(mappingDialog).getByRole('combobox', { name: '内部事件' }));

    expect(screen.getByRole('option', { name: /agent\.completed/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Stop 事件、会话结束/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /agent\.completed/ }));
    fireEvent.click(within(mappingDialog).getByRole('button', { name: '保存' }));

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledHookEvents: profileFixture().enabledHookEvents,
        aiEventMappings: expect.arrayContaining([
          expect.objectContaining({
            source: 'claude-code',
            event: 'StopFailure',
            internalEvent: 'agent.completed',
            enabled: true
          })
        ]),
        hardwareRules: expect.arrayContaining([
          expect.objectContaining({
            id: 'agent-completed-system-notification-output',
            internalEvent: 'agent.completed'
          })
        ])
      })
    );
  });

  test('toggles existing output rule from output inspector', () => {
    const saveProfile = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profileFixture()}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    fireEvent.click(screen.getByRole('switch', { name: '停用 system-notification 输出' }));

    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareRules: [
          expect.objectContaining({
            id: 'agent-started-system-notification-output',
            enabled: false
          })
        ]
      })
    );
  });

  test('shows output limit error inside output inspector when enabling sixth output', () => {
    const saveProfile = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={outputLimitProfileFixture()}
          viewModel={outputLimitViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    const outputDialog = screen.getByRole('dialog', { name: '输出规则' });
    fireEvent.click(within(outputDialog).getByRole('switch', { name: '启用 sound 输出' }));

    expect(
      within(outputDialog).getByText('当前内部事件最多同时启用 5 个输出方式，请先禁用其它输出。')
    ).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  test('adds fifth output as enabled from visual inspector when four outputs are enabled', () => {
    const saveProfile = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={outputLimitAddProfileFixture()}
          viewModel={outputLimitAddViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    const outputDialog = screen.getByRole('dialog', { name: '输出规则' });
    fireEvent.click(within(outputDialog).getByRole('button', { name: '添加并配置 sound' }));

    const detailDialog = screen.getByRole('dialog', { name: /sound 输出设置/ });
    fireEvent.click(within(detailDialog).getByRole('combobox', { name: '音频来源' }));
    fireEvent.click(screen.getByRole('option', { name: '自定义路径' }));
    fireEvent.change(within(detailDialog).getByLabelText(/音频文件/), {
      target: { value: '/tmp/notice.wav' }
    });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(
      within(outputDialog).queryByText('当前内部事件已启用 5 个输出方式，新添加的输出已默认禁用。')
    ).not.toBeInTheDocument();
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        hardwareRules: expect.arrayContaining([
          expect.objectContaining({
            internalEvent: 'agent.started',
            enabled: true,
            output: expect.objectContaining({
              type: 'sound',
              soundFilePath: '/tmp/notice.wav'
            })
          })
        ])
      })
    );
  });

  test('shows output detail validation error inside output detail dialog', () => {
    const saveProfile = vi.fn();
    const profile = {
      ...profileFixture(),
      hardwareRules: [createDefaultHardwareRuleForInternalEvent('agent.started', 'webhook')]
    };
    render(
      <I18nProvider language="zh-CN">
        <LinkWorkflowCanvas
          profile={profile}
          viewModel={multiToolViewModel()}
          deviceOptions={[]}
          onOpenHookSettings={vi.fn()}
          onSaveProfile={saveProfile}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
    fireEvent.click(screen.getByRole('button', { name: '编辑 webhook' }));
    const detailDialog = screen.getByRole('dialog', { name: /webhook 输出设置/ });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(within(detailDialog).getByText('Webhook URL 必填')).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });
});
