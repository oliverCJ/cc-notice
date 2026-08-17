import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { DebugEventDetailDialog } from './DebugEventDetailDialog';

describe('DebugEventDetailDialog', () => {
  test('shows desktop notice target details in a dedicated output group', () => {
    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-desktop-notice-output',
            source: 'codex',
            event: 'SessionStart',
            payload: '{}',
            result: 'accepted',
            internalEvent: 'agent.started',
            occurredAt: '2026-07-10T12:00:00+08:00',
            outputs: [
              {
                type: 'desktop-notice',
                ruleId: 'rule-desktop-notice',
                commandSummary: 'desktop notice output',
                desktopNoticeTargets: [
                  {
                    targetId: 'desktop-notice-edge',
                    effect: 'edge-breathing',
                    colorMode: 'gradient',
                    colors: [
                      { color: '#22c55e', position: 0 },
                      { color: '#3b82f6', position: 100 }
                    ],
                    durationMs: 1800,
                    animationPeriodMs: 1600,
                    opacityPercent: 90,
                    brightnessPercent: 100,
                    restoreBehavior: 'use-instance-idle',
                    edge: 'top'
                  }
                ]
              }
            ]
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText('桌面提示输出')).toBeInTheDocument();
    expect(screen.getByText('desktop-notice-edge')).toBeInTheDocument();
    expect(screen.getByText('效果: edge-breathing')).toBeInTheDocument();
    expect(screen.getByText('颜色: gradient')).toBeInTheDocument();
    expect(screen.getByText('时长: 1800 ms')).toBeInTheDocument();
    expect(screen.getByText('动画周期: 1600 ms')).toBeInTheDocument();
    expect(screen.getByText('发光边: top')).toBeInTheDocument();
  });

  test('shows desktop mascot target metadata in the output group', () => {
    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-desktop-mascot-output',
            source: 'codex',
            event: 'SessionStart',
            payload: '{}',
            result: 'accepted',
            internalEvent: 'agent.started',
            occurredAt: '2026-07-10T12:00:00+08:00',
            outputs: [
              {
                type: 'desktop-notice',
                ruleId: 'rule-desktop-mascot',
                commandSummary: 'desktop mascot output',
                desktopNoticeTargets: [
                  {
                    targetId: 'notice-mascot',
                    effect: 'solid',
                    colorMode: 'solid',
                    colors: [{ color: '#38bdf8', position: 0 }],
                    durationMs: 2400,
                    opacityPercent: 100,
                    brightnessPercent: 100,
                    restoreBehavior: 'use-instance-idle',
                    edge: 'auto',
                    mascotState: 'task-received',
                    mascotActionId: 'task-received.wave',
                    mascotBubbleTemplate: '收到任务'
                  }
                ]
              }
            ]
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText('notice-mascot')).toBeInTheDocument();
    expect(screen.getByText('精灵状态: 收到任务')).toBeInTheDocument();
    expect(screen.getByText('精灵动作: 收到任务：挥手')).toBeInTheDocument();
    expect(screen.getByText('气泡文本: 收到任务')).toBeInTheDocument();
    expect(screen.queryByText('效果: solid')).not.toBeInTheDocument();
    expect(screen.queryByText('颜色: solid')).not.toBeInTheDocument();
    expect(screen.queryByText('动画周期: -')).not.toBeInTheDocument();
    expect(screen.queryByText('发光边: auto')).not.toBeInTheDocument();
  });

  test('shows device dispatch results when present', () => {
    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-device-results',
            source: 'codex',
            event: 'SessionStart',
            payload: '{}',
            result: 'accepted',
            occurredAt: '2026-07-10T12:00:00+08:00',
            deviceResults: [
              {
                deviceId: 'desk-pico',
                channelId: 'pin.gp2',
                outputType: 'device-channel',
                status: 'sent',
                ack: '{"ok":true}'
              },
              {
                deviceId: 'lab-pico',
                channelId: 'pin.gp3',
                outputType: 'device-channel',
                status: 'failed',
                errorCode: 'DEVICE_TRANSPORT_ERROR',
                error: 'write failed'
              }
            ]
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByText('设备下发结果')).toBeInTheDocument();
    expect(screen.getByTestId('debug-lifecycle-summary')).toBeInTheDocument();
    expect(screen.getByTestId('debug-lifecycle-timeline')).toBeInTheDocument();
    expect(screen.getByText('输出执行')).toBeInTheDocument();
    expect(screen.getByText('desk-pico')).toBeInTheDocument();
    expect(screen.getByText('pin.gp2')).toBeInTheDocument();
    expect(screen.getByText('设备响应: {"ok":true}')).toBeInTheDocument();
    expect(screen.getByText('错误编码: DEVICE_TRANSPORT_ERROR')).toBeInTheDocument();
    expect(screen.getByText('错误原因: write failed')).toBeInTheDocument();
  });

  test('does not show device dispatch section when no device result exists', () => {
    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-empty-device-results',
            source: 'codex',
            event: 'SessionStart',
            payload: '{}',
            result: 'accepted',
            occurredAt: '2026-07-10T12:00:00+08:00',
            deviceResults: []
          }}
        />
      </I18nProvider>
    );

    expect(screen.queryByText('设备下发结果')).not.toBeInTheDocument();
  });

  test('renders non-json raw payload without throwing', () => {
    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-raw-text',
            source: 'codex',
            event: 'SessionStart',
            payload: '{not-json',
            rawPayload: 'plain text payload',
            result: 'accepted',
            occurredAt: '2026-07-20T10:00:00+08:00'
          }}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText('摘要 Payload')).toHaveValue('{not-json');
    expect(screen.getByLabelText('原始 Payload')).toHaveValue('plain text payload');
  });

  test('keeps long event details scrollable inside the dialog', () => {
    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-long-details',
            source: 'codex',
            event: 'SessionStart',
            payload: JSON.stringify({ content: 'line\n'.repeat(120) }),
            result: 'accepted',
            occurredAt: '2026-07-10T12:00:00+08:00',
            rawPayload: JSON.stringify({ content: 'raw\n'.repeat(160) })
          }}
        />
      </I18nProvider>
    );

    const detailBody = screen.getByTestId('debug-event-detail-body');
    expect(detailBody).toHaveClass('overflow-y-auto');
    expect(detailBody).toHaveClass('min-h-0');
    expect(detailBody.className).toContain('max-h-[calc(90vh-96px)]');
  });

  test('keeps payload textareas inside the dialog width', () => {
    const summaryPayload = JSON.stringify({ content: 'long-content'.repeat(80) });
    const rawPayload = JSON.stringify({ content: 'raw-content'.repeat(100) });

    render(
      <I18nProvider language="zh-CN">
        <DebugEventDetailDialog
          open
          onOpenChange={vi.fn()}
          entry={{
            debugEntryId: 'debug-payload-width',
            source: 'codex',
            event: 'SessionStart',
            payload: summaryPayload,
            result: 'accepted',
            occurredAt: '2026-07-10T12:00:00+08:00',
            rawPayload
          }}
        />
      </I18nProvider>
    );

    const summaryTextarea = screen.getByLabelText('摘要 Payload');
    const rawTextarea = screen.getByLabelText('原始 Payload');
    expect(summaryTextarea).toHaveValue(JSON.stringify(JSON.parse(summaryPayload), null, 2));
    expect(rawTextarea).toHaveValue(JSON.stringify(JSON.parse(rawPayload), null, 2));

    const payloadTextareas = [summaryTextarea, rawTextarea];
    expect(payloadTextareas).toHaveLength(2);
    payloadTextareas.forEach((textarea) => {
      expect(textarea).toHaveClass('w-full');
      expect(textarea).toHaveClass('min-w-0');
      expect(textarea).toHaveClass('max-w-full');
      expect(textarea).toHaveClass('box-border');
      expect(textarea).toHaveClass('break-all');
      expect(textarea).toHaveClass('overflow-auto');
      expect(textarea).toHaveClass('resize-none');
    });
  });
});
