import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AiEventMapping, DeviceChannelActionType, HardwareRule } from '../../api/tauriApi';
import { HardwareRulePanel } from './HardwareRulePanel';

const mappings: AiEventMapping[] = [
  {
    id: 'codex-stop-agent-completed',
    source: 'codex',
    event: 'Stop',
    internalEvent: 'agent.completed',
    enabled: true
  }
];

const customEventMappings: AiEventMapping[] = [
  {
    id: 'codex-sessionstart-review-started-userdefined',
    source: 'codex',
    event: 'SessionStart',
    internalEvent: 'review.started.userDefined',
    enabled: true
  }
];

function deviceChannelAction(
  id: string,
  deviceId: string,
  channelId: string,
  channelAction: DeviceChannelActionType
) {
  return {
    id,
    deviceId,
    channelId,
    channelAction,
    durationMs: 5000,
    intervalMs: null,
    dutyPercent: null,
    frequencyHz: null,
    color: null,
    brightnessPercent: null
  };
}

const rules: HardwareRule[] = [
  {
    id: 'agent-completed-device-channel-output',
    internalEvent: 'agent.completed',
    output: {
      type: 'device-channel',
      durationMs: null,
      channelActions: [
        deviceChannelAction(
          'action-1',
          'rp2040-pico-default',
          'pin.gp2',
          'activate'
        )
      ],
      text: null,
      notificationLevel: null,
      notificationTitle: null,
      notificationBody: null,
      notificationTitleMaxChars: null,
      notificationBodyMaxChars: null,
      notificationThrottleSeconds: null,
      webhookMethod: null,
      webhookUrl: null,
      webhookHeaders: null,
      webhookBody: null,
      webhookBodyMaxChars: null
    },
    priority: 50,
    enabled: true
  }
];

const customEventRules: HardwareRule[] = [
  {
    ...rules[0],
    id: 'review-started-userdefined-device-channel-output',
    internalEvent: 'review.started.userDefined'
  }
];

const notificationRule: HardwareRule = {
  id: 'agent-completed-system-notification-output',
  internalEvent: 'agent.completed',
  output: {
    type: 'system-notification',
    durationMs: null,
    text: null,
    notificationLevel: 'info',
    notificationTitle: '完成',
    notificationBody: '旧内容',
    notificationTitleMaxChars: 80,
    notificationBodyMaxChars: 300,
    notificationThrottleSeconds: 30,
    notificationSound: 'default',
    webhookMethod: null,
    webhookUrl: null,
    webhookHeaders: null,
    webhookBody: null,
    webhookBodyMaxChars: null,
    soundFilePath: null,
    soundVolumePercent: null,
    soundMaxDurationMs: null,
    soundThrottleSeconds: null
  },
  priority: 60,
  enabled: true
};

const disabledNotificationRule: HardwareRule = {
  ...notificationRule,
  id: 'agent-completed-disabled-system-notification-output',
  enabled: false
};

const webhookRule: HardwareRule = {
  id: 'agent-completed-webhook-output',
  internalEvent: 'agent.completed',
  output: {
    type: 'webhook',
    durationMs: null,
    text: null,
    notificationLevel: null,
    notificationTitle: null,
    notificationBody: null,
    notificationTitleMaxChars: null,
    notificationBodyMaxChars: null,
    notificationThrottleSeconds: null,
    notificationSound: null,
    webhookMethod: 'POST',
    webhookUrl: 'https://example.test/hooks',
    webhookHeaders: '{\n  "Content-Type": "application/json"\n}',
    webhookBody: '{\n  "source": "{{source}}"\n}',
    webhookBodyMaxChars: 8000,
    soundFilePath: null,
    soundVolumePercent: null,
    soundMaxDurationMs: null,
    soundThrottleSeconds: null
  },
  priority: 50,
  enabled: true
};

const soundRule: HardwareRule = {
  id: 'agent-completed-sound-output',
  internalEvent: 'agent.completed',
  output: {
    type: 'sound',
    durationMs: null,
    text: null,
    notificationLevel: null,
    notificationTitle: null,
    notificationBody: null,
    notificationTitleMaxChars: null,
    notificationBodyMaxChars: null,
    notificationThrottleSeconds: null,
    notificationSound: null,
    webhookMethod: null,
    webhookUrl: null,
    webhookHeaders: null,
    webhookBody: null,
    webhookBodyMaxChars: null,
    soundFilePath: '/tmp/notice.wav',
    soundVolumePercent: 80,
    soundMaxDurationMs: 3000,
    soundThrottleSeconds: 30
  },
  priority: 50,
  enabled: true
};

const desktopNoticeRule: HardwareRule = {
  id: 'agent-completed-desktop-notice-output',
  internalEvent: 'agent.completed',
  output: {
    type: 'desktop-notice',
    durationMs: null,
    text: null,
    notificationLevel: null,
    notificationTitle: null,
    notificationBody: null,
    notificationTitleMaxChars: null,
    notificationBodyMaxChars: null,
    notificationThrottleSeconds: null,
    notificationSound: null,
    webhookMethod: null,
    webhookUrl: null,
    webhookHeaders: null,
    webhookBody: null,
    webhookBodyMaxChars: null,
    soundFilePath: null,
    soundVolumePercent: null,
    soundMaxDurationMs: null,
    soundThrottleSeconds: null,
    desktopNoticeTargets: [
      {
        targetId: 'notice-main',
        effect: 'breathing',
        colorMode: 'solid',
        colors: [{ color: '#22C55E', position: 0 }],
        durationMs: 3000,
        breathingPeriodMs: 1600,
        opacityPercent: 100,
        brightnessPercent: 100,
        restoreBehavior: 'use-instance-idle',
        edge: 'auto'
      }
    ]
  },
  priority: 50,
  enabled: true
};

const displayRule: HardwareRule = {
  id: 'agent-completed-display-output',
  internalEvent: 'agent.completed',
  output: {
    type: 'display',
    durationMs: null,
    text: null,
    notificationLevel: null,
    notificationTitle: null,
    notificationBody: null,
    notificationTitleMaxChars: null,
    notificationBodyMaxChars: null,
    notificationThrottleSeconds: null,
    notificationSound: null,
    webhookMethod: null,
    webhookUrl: null,
    webhookHeaders: null,
    webhookBody: null,
    webhookBodyMaxChars: null,
    soundFilePath: null,
    soundVolumePercent: null,
    soundMaxDurationMs: null,
    soundThrottleSeconds: null,
    displayDeviceId: 'desk-wio',
    displayStatus: 'notice',
    displayTitleTemplate: '{{source}}',
    displayMessageTemplate: '{{last_assistant_message}}',
    displayTitleMaxChars: 39,
    displayMessageMaxChars: 95,
    displayExpireBehavior: 'restore-status'
  },
  priority: 50,
  enabled: true
};

const pwmRuleWithoutDuty: HardwareRule = {
  id: 'agent-completed-pwm-output',
  internalEvent: 'agent.completed',
  output: {
    type: 'device-channel',
    durationMs: 5000,
    channelActions: [
      deviceChannelAction(
        'action-1',
        'rp2040-pico-default',
        'pwm.gp14',
        'set-duty'
      )
    ],
    text: null,
    notificationLevel: null,
    notificationTitle: null,
    notificationBody: null,
    notificationTitleMaxChars: null,
    notificationBodyMaxChars: null,
    notificationThrottleSeconds: null,
    notificationSound: null,
    webhookMethod: null,
    webhookUrl: null,
    webhookHeaders: null,
    webhookBody: null,
    webhookBodyMaxChars: null,
    soundFilePath: null,
    soundVolumePercent: null,
    soundMaxDurationMs: null,
    soundThrottleSeconds: null
  },
  priority: 50,
  enabled: true
};

describe('HardwareRulePanel', () => {
  test('does not create output rule group for disabled AI mappings', () => {
    render(
      <HardwareRulePanel
        aiEventMappings={[{ ...mappings[0], enabled: false }]}
        rules={rules}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId('hardware-rule-event-group-agent.completed')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('请先在「AI事件映射」中配置 AI Hook 到内部事件的映射')
    ).toBeInTheDocument();
  });

  test('creates output rule group for mapped custom internal event', () => {
    render(
      <HardwareRulePanel
        aiEventMappings={customEventMappings}
        rules={customEventRules}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByTestId('hardware-rule-event-group-review.started.userDefined')
    ).toBeInTheDocument();
    expect(screen.getByText('review.started.userDefined')).toBeInTheDocument();
  });

  test('marks event groups and output cards with distinct visual layers', () => {
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={rules}
        onChange={vi.fn()}
      />
    );

    const group = screen.getByTestId('hardware-rule-event-group-agent.completed');
    expect(group).toHaveClass('bg-muted/20');
    expect(group).toHaveClass('border');

    const card = screen.getByTestId('hardware-rule-card-agent-completed-device-channel-output');
    expect(card).toHaveClass('bg-background');
    expect(card).toHaveClass('border-l-4');
    expect(card).toHaveClass('border-l-emerald-400');
  });

  test('uses output type accents and disabled-state accent override for output cards', () => {
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[notificationRule, disabledNotificationRule]}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByTestId('hardware-rule-card-agent-completed-system-notification-output')
    ).toHaveClass('bg-background', 'border-l-sky-400');
    expect(
      screen.getByTestId('hardware-rule-card-agent-completed-disabled-system-notification-output')
    ).toHaveClass('bg-background', 'border-l-zinc-400');
  });

  test('renders desktop notice edge breathing summary with translated effect label', () => {
    const edgeBreathingRule: HardwareRule = {
      ...desktopNoticeRule,
      output: {
        ...desktopNoticeRule.output,
        desktopNoticeTargets: [
          {
            ...desktopNoticeRule.output.desktopNoticeTargets![0],
            effect: 'edge-breathing'
          }
        ]
      }
    };
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[edgeBreathingRule]}
        onChange={vi.fn()}
      />
    );

    const card = screen.getByTestId('hardware-rule-card-agent-completed-desktop-notice-output');
    expect(within(card).getByText(/边缘呼吸/)).toBeInTheDocument();
    expect(within(card).queryByText(/rules\.desktopNotice\.effects\.edge-breathing/)).not.toBeInTheDocument();
  });

  test('renders desktop mascot summary with semantic state and bubble text', () => {
    const mascotRule: HardwareRule = {
      ...desktopNoticeRule,
      output: {
        ...desktopNoticeRule.output,
        desktopNoticeTargets: [
          {
            ...desktopNoticeRule.output.desktopNoticeTargets![0],
            targetId: 'notice-mascot',
            mascotState: 'task-received',
            mascotActionId: 'task-received.wave',
            mascotBubbleTemplate: '收到任务'
          }
        ]
      }
    };

    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[mascotRule]}
        onChange={vi.fn()}
      />
    );

    const card = screen.getByTestId('hardware-rule-card-agent-completed-desktop-notice-output');
    expect(within(card).getByText(/桌面精灵/)).toBeInTheDocument();
    expect(within(card).getByText(/收到任务/)).toBeInTheDocument();
    expect(within(card).getByText(/收到任务：挥手/)).toBeInTheDocument();
    expect(within(card).queryByText(/rules\.desktopNotice/)).not.toBeInTheDocument();
  });

  test('renders mixed desktop notice summary when mascot is not the first target', () => {
    const mixedRule: HardwareRule = {
      ...desktopNoticeRule,
      output: {
        ...desktopNoticeRule.output,
        desktopNoticeTargets: [
          {
            ...desktopNoticeRule.output.desktopNoticeTargets![0],
            targetId: 'notice-lightbar',
            effect: 'scan'
          },
          {
            ...desktopNoticeRule.output.desktopNoticeTargets![0],
            targetId: 'notice-mascot',
            mascotState: 'success',
            mascotActionId: 'success.jump',
            mascotBubbleTemplate: '任务完成'
          }
        ]
      }
    };

    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[mixedRule]}
        onChange={vi.fn()}
      />
    );

    const card = screen.getByTestId('hardware-rule-card-agent-completed-desktop-notice-output');
    expect(within(card).getByText(/2 个目标/)).toBeInTheDocument();
    expect(within(card).getByText(/灯条 1/)).toBeInTheDocument();
    expect(within(card).getByText(/精灵 1/)).toBeInTheDocument();
    expect(within(card).getByText(/完成/)).toBeInTheDocument();
    expect(within(card).queryByText(/扫描/)).not.toBeInTheDocument();
  });

  test('hides legacy standalone display output rules from outer output rule settings', () => {
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, displayRule]}
        onChange={vi.fn()}
      />
    );

    const group = screen.getByTestId('hardware-rule-event-group-agent.completed');
    expect(
      screen.queryByTestId('hardware-rule-card-agent-completed-display-output')
    ).not.toBeInTheDocument();
    expect(within(group).getByText('1 种输出类型')).toBeInTheDocument();
    expect(screen.queryByText('屏幕输出')).not.toBeInTheDocument();
  });

  test('does not replace local textarea draft when stale parent rules are echoed back', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, notificationRule]}
        onChange={onChange}
      />
    );

    const notificationCard = screen.getByTestId(
      'hardware-rule-card-agent-completed-system-notification-output'
    );
    fireEvent.click(within(notificationCard).getByRole('button', { name: '详细设置' }));
    const detailDialog = screen.getByRole('dialog', { name: 'system-notification 输出设置' });
    const bodyInput = within(detailDialog).getByLabelText('通知内容');

    fireEvent.change(bodyInput, { target: { value: '正在输入的新内容' } });

    rerender(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, notificationRule]}
        onChange={onChange}
      />
    );

    expect(within(detailDialog).getByLabelText('通知内容')).toHaveValue('正在输入的新内容');
  });

  test('edits output details in dialog and saves once when confirmed', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, notificationRule]}
        onChange={onChange}
      />
    );

    const notificationCard = screen.getByTestId(
      'hardware-rule-card-agent-completed-system-notification-output'
    );
    expect(within(notificationCard).queryByLabelText('通知内容')).not.toBeInTheDocument();

    fireEvent.click(within(notificationCard).getByRole('button', { name: '详细设置' }));
    const detailDialog = screen.getByRole('dialog', { name: 'system-notification 输出设置' });
    expect(within(detailDialog).queryByLabelText('优先级')).not.toBeInTheDocument();
    fireEvent.change(within(detailDialog).getByLabelText('通知内容'), {
      target: { value: '保存后的通知内容' }
    });

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agent-completed-system-notification-output',
          output: expect.objectContaining({
            notificationBody: '保存后的通知内容'
          })
        })
      ])
    );
    expect(screen.queryByRole('dialog', { name: 'system-notification 输出设置' })).not.toBeInTheDocument();
  });

  test('shows validation errors inside detail dialog without saving invalid webhook', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={rules}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '添加输出类型' }));
    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /Webhook/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    const webhookCard = screen.getByTestId('hardware-rule-card-agent-completed-webhook-output');
    fireEvent.click(within(webhookCard).getByRole('button', { name: '详细设置' }));
    const detailDialog = screen.getByRole('dialog', { name: 'webhook 输出设置' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(within(detailDialog).getByText('Webhook URL 必填')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'webhook 输出设置' })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('shows desktop notice breathing period validation inside detail dialog', () => {
    const invalidDesktopNoticeRule: HardwareRule = {
      ...desktopNoticeRule,
      output: {
        ...desktopNoticeRule.output,
        desktopNoticeTargets: [
          {
            ...desktopNoticeRule.output.desktopNoticeTargets![0],
            breathingPeriodMs: 200
          }
        ]
      }
    };
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[invalidDesktopNoticeRule]}
        onChange={onChange}
      />
    );

    const card = screen.getByTestId('hardware-rule-card-agent-completed-desktop-notice-output');
    fireEvent.click(within(card).getByRole('button', { name: '详细设置' }));
    const detailDialog = screen.getByRole('dialog', { name: 'desktop-notice 输出设置' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(within(detailDialog).getByText('呼吸周期必须在 500 到 5000 毫秒之间。')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('blocks saving device channel action when required parameters are missing', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[pwmRuleWithoutDuty]}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: [
              {
                value: 'pwm.gp14',
                label: 'GP14 PWM',
                kind: 'pwm-output',
                supportedActions: ['set-duty', 'pulse', 'clear'],
                hardwareGuideId: 'pwm-output'
              }
            ]
          }
        ]}
        onChange={onChange}
      />
    );

    const card = screen.getByTestId('hardware-rule-card-agent-completed-pwm-output');
    fireEvent.click(within(card).getByRole('button', { name: '详细设置' }));
    const detailDialog = screen.getByRole('dialog', { name: 'device-channel 输出设置' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(screen.getByText('设置占空比动作需要填写占空比。')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('saves webhook body when variables are quoted as full json values', () => {
    const webhookRuleWithSummary: HardwareRule = {
      ...webhookRule,
      output: {
        ...webhookRule.output,
        webhookBody: '{\n  "source": "{{source}}",\n  "summary": "{{last_assistant_message}}"\n}'
      }
    };
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, webhookRuleWithSummary]}
        onChange={onChange}
      />
    );

    const webhookCard = screen.getByTestId('hardware-rule-card-agent-completed-webhook-output');
    fireEvent.click(within(webhookCard).getByRole('button', { name: '详细设置' }));
    const detailDialog = screen.getByRole('dialog', { name: 'webhook 输出设置' });
    fireEvent.click(within(detailDialog).getByRole('button', { name: '保存设置' }));

    expect(within(detailDialog).queryByText('请求体必须是合法 JSON')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agent-completed-webhook-output',
          output: expect.objectContaining({
            webhookBody: '{\n  "source": "{{source}}",\n  "summary": "{{last_assistant_message}}"\n}'
          })
        })
      ])
    );
  });

  test('keeps new webhook rule as draft until required url is configured', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={rules}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '添加输出类型' }));
    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /Webhook/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onChange).not.toHaveBeenCalled();

    const webhookCard = screen.getByTestId('hardware-rule-card-agent-completed-webhook-output');
    expect(within(webhookCard).getByText('待配置')).toBeInTheDocument();
    expect(
      within(webhookCard).queryByText('Webhook URL 必填，配置完成后才会保存。')
    ).not.toBeInTheDocument();
    fireEvent.click(within(webhookCard).getByRole('button', { name: '详细设置' }));
    const webhookDialog = screen.getByRole('dialog', { name: 'webhook 输出设置' });
    fireEvent.change(within(webhookDialog).getByLabelText(/Webhook URL/), {
      target: { value: 'https://example.test/hooks' }
    });
    fireEvent.click(within(webhookDialog).getByRole('button', { name: '保存设置' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agent-completed-webhook-output',
          output: expect.objectContaining({
            type: 'webhook',
            webhookUrl: 'https://example.test/hooks'
          })
        })
      ])
    );
  });

  test('keeps new sound rule as draft until required file path is configured', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={rules}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '添加输出类型' }));
    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /提示音/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onChange).not.toHaveBeenCalled();

    const soundCard = screen.getByTestId('hardware-rule-card-agent-completed-sound-output');
    expect(within(soundCard).getByText('待配置')).toBeInTheDocument();
    expect(
      within(soundCard).queryByText('音频文件必填，配置完成后才会保存。')
    ).not.toBeInTheDocument();
    fireEvent.click(within(soundCard).getByRole('button', { name: '详细设置' }));
    const soundDialog = screen.getByRole('dialog', { name: 'sound 输出设置' });
    fireEvent.click(within(soundDialog).getByRole('combobox', { name: '音频来源' }));
    fireEvent.click(screen.getByRole('option', { name: '自定义路径' }));
    fireEvent.change(within(soundDialog).getByLabelText(/音频文件/), {
      target: { value: '/tmp/notice.wav' }
    });
    fireEvent.click(within(soundDialog).getByRole('button', { name: '保存设置' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'agent-completed-sound-output',
          output: expect.objectContaining({
            type: 'sound',
            soundFilePath: '/tmp/notice.wav'
          })
        })
      ])
    );
  });

  test('adds fifth output as enabled when four outputs are already enabled', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, notificationRule, webhookRule, desktopNoticeRule]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '添加输出类型' }));
    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /提示音/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    const soundCard = screen.getByTestId('hardware-rule-card-agent-completed-sound-output');
    expect(within(soundCard).getByText('已启用')).toBeInTheDocument();
    expect(
      screen.queryByText('当前内部事件已启用 5 个输出方式，新添加的输出已默认禁用。')
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('prevents enabling output when five outputs are already enabled', () => {
    const disabledSoundRule = { ...soundRule, enabled: false };
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[...rules, notificationRule, webhookRule, desktopNoticeRule, displayRule, disabledSoundRule]}
        onChange={onChange}
      />
    );

    const soundCard = screen.getByTestId('hardware-rule-card-agent-completed-sound-output');
    fireEvent.click(within(soundCard).getByRole('switch', { name: '启用' }));

    expect(within(soundCard).getByRole('switch', { name: '启用' })).not.toBeChecked();
    expect(
      screen.getByText('当前内部事件最多同时启用 5 个输出方式，请先禁用其它输出。')
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('hides output limit message after ten seconds', () => {
    vi.useFakeTimers();
    try {
      const disabledSoundRule = { ...soundRule, enabled: false };
      render(
        <HardwareRulePanel
          aiEventMappings={mappings}
          rules={[...rules, notificationRule, webhookRule, desktopNoticeRule, displayRule, disabledSoundRule]}
          onChange={vi.fn()}
        />
      );

      const soundCard = screen.getByTestId('hardware-rule-card-agent-completed-sound-output');
      fireEvent.click(within(soundCard).getByRole('switch', { name: '启用' }));

      expect(
        screen.getByText('当前内部事件最多同时启用 5 个输出方式，请先禁用其它输出。')
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(9999);
      });
      expect(
        screen.getByText('当前内部事件最多同时启用 5 个输出方式，请先禁用其它输出。')
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(
        screen.queryByText('当前内部事件最多同时启用 5 个输出方式，请先禁用其它输出。')
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  test('allows adding output when existing outputs are disabled', () => {
    const onChange = vi.fn();
    render(
      <HardwareRulePanel
        aiEventMappings={mappings}
        rules={[
          { ...rules[0], enabled: false },
          { ...notificationRule, enabled: false },
          { ...webhookRule, enabled: false }
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '添加输出类型' }));
    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /提示音/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    const soundCard = screen.getByTestId('hardware-rule-card-agent-completed-sound-output');
    expect(within(soundCard).getByText('已启用')).toBeInTheDocument();
    expect(
      screen.queryByText('当前内部事件已启用 5 个输出方式，新添加的输出已默认禁用。')
    ).not.toBeInTheDocument();
  });
});
