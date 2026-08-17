import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { HardwareRule } from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { OutputTypeAddDialog } from './OutputTypeAddDialog';

const existingRules: HardwareRule[] = [
  {
    id: 'agent-completed-system-notification-output',
    internalEvent: 'agent.completed',
    output: {
      type: 'system-notification',
      durationMs: null,
      text: null,
      notificationLevel: 'info',
      notificationTitle: '{{source}} 已完成任务',
      notificationBody: '{{last_assistant_message}}',
      notificationTitleMaxChars: 80,
      notificationBodyMaxChars: 300,
      notificationThrottleSeconds: 30,
      notificationSound: 'default'
    },
    priority: 50,
    enabled: true
  }
];

const desktopNoticeInstances: DesktopNoticeInstance[] = [
  {
    id: 'notice-main',
    name: '顶部灯条',
    variant: 'custom-lightbar',
    enabled: true,
    showOnStartup: false,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: {
      presetPosition: 'top-center',
      direction: 'horizontal',
      size: { width: 720, height: 32 },
      opacityPercent: 100,
      cornerRadiusPercent: 0,
      boundsOverride: null
    },
    edgeLightbar: null
  }
];

describe('OutputTypeAddDialog', () => {
  test('defaults to implemented device channel output instead of deprecated output', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.running"
        existingRules={[]}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    expect(screen.getByRole('button', { name: '添加' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onAdd).toHaveBeenCalledWith(
      'agent.running',
      'device-channel',
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            deviceId: 'rp2040-pico-default',
            channelId: 'pin.gp2',
            channelAction: 'activate'
          })
        ]
      })
    );
  });

  test('does not offer display as a standalone output type', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.running"
        existingRules={[]}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));

    expect(screen.queryByRole('option', { name: /屏幕输出/ })).not.toBeInTheDocument();
  });

  test('disables add when explicit device options have no channels', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.running"
        existingRules={[]}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: []
          }
        ]}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    expect(screen.getByText('当前设备尚未启用可用通道，请先到设备页添加通道。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  test('does not add device output when explicit device options only have hidden special channels', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.running"
        existingRules={[]}
        deviceOptions={[
          {
            value: 'desk-pico',
            label: 'Desk Pico',
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
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    expect(screen.getByText('当前设备尚未启用可用通道，请先到设备页添加通道。')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PWM 输出' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onAdd).not.toHaveBeenCalled();
  });

  test('disables add when selected device channel action misses required parameters', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.running"
        existingRules={[]}
        deviceOptions={[
          {
            value: 'desk-pico',
            label: 'Desk Pico',
            channels: [
              {
                value: 'pin.gp2',
                label: 'GP2',
                kind: 'digital-output',
                supportedActions: ['blink'],
                hardwareGuideId: 'digital-output'
              }
            ]
          }
        ]}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    const intervalInput = screen.getByLabelText('闪烁间隔（毫秒）');
    fireEvent.change(intervalInput, { target: { value: '' } });
    fireEvent.blur(intervalInput);

    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  test('adds webhook output with default configuration and leaves details to rule card', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.completed"
        existingRules={existingRules}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /Webhook/ }));

    expect(screen.queryByLabelText(/Webhook URL/)).not.toBeInTheDocument();
    expect(screen.getByText('添加后在输出规则卡片中配置详细参数。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onAdd).toHaveBeenCalledWith(
      'agent.completed',
      'webhook',
      expect.objectContaining({
        type: 'webhook',
        webhookUrl: ''
      })
    );
  });

  test('adds desktop notice solid output without animation-only defaults', () => {
    const onAdd = vi.fn();
    render(
      <OutputTypeAddDialog
        internalEvent="agent.completed"
        existingRules={existingRules}
        desktopNoticeInstances={desktopNoticeInstances}
        onCancel={vi.fn()}
        onAdd={onAdd}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '输出类型' }));
    fireEvent.click(screen.getByRole('option', { name: /桌面提示/ }));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));

    expect(onAdd).toHaveBeenCalledWith(
      'agent.completed',
      'desktop-notice',
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.not.objectContaining({
            animationPeriodMs: expect.any(Number),
            breathingPeriodMs: expect.any(Number)
          })
        ]
      })
    );
  });
});
