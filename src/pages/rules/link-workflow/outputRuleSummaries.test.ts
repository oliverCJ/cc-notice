import { describe, expect, test } from 'vitest';
import { HardwareRule } from '@/api/tauriApi';
import { createDefaultHardwareRuleForInternalEvent } from '../ruleProfileUtils';
import { buildOutputRuleSummaries } from './outputRuleSummaries';

describe('buildOutputRuleSummaries', () => {
  const t = (key: string) => key;

  test('summarizes existing output rules for selected internal event', () => {
    const webhookRule = createDefaultHardwareRuleForInternalEvent('agent.started', 'webhook');
    const rules: HardwareRule[] = [
      createDefaultHardwareRuleForInternalEvent('agent.started', 'system-notification'),
      {
        ...webhookRule,
        output: {
          ...webhookRule.output,
          webhookUrl: ''
        }
      }
    ];

    const summaries = buildOutputRuleSummaries({
      internalEvent: 'agent.started',
      rules,
      t
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        outputType: 'device-channel',
        status: 'not-added',
        action: 'add'
      }),
      expect.objectContaining({
        outputType: 'system-notification',
        status: 'enabled',
        action: 'edit'
      }),
      expect.objectContaining({
        outputType: 'webhook',
        status: 'needs-config',
        action: 'edit'
      }),
      expect.objectContaining({
        outputType: 'sound',
        status: 'not-added',
        action: 'add'
      }),
      expect.objectContaining({
        outputType: 'desktop-notice',
        status: 'not-added',
        action: 'add'
      })
    ]);
  });

  test('formats user-facing summaries through provided translator', () => {
    const deviceRule = createDefaultHardwareRuleForInternalEvent('agent.started', 'device-channel');
    const webhookRule = createDefaultHardwareRuleForInternalEvent('agent.started', 'webhook');
    const systemRule = createDefaultHardwareRuleForInternalEvent(
      'agent.started',
      'system-notification'
    );
    const rules: HardwareRule[] = [
      deviceRule,
      {
        ...webhookRule,
        output: {
          ...webhookRule.output,
          webhookUrl: ''
        }
      },
      {
        ...systemRule,
        output: {
          ...systemRule.output,
          notificationTitle: ''
        }
      }
    ];

    const summaries = buildOutputRuleSummaries({
      internalEvent: 'agent.started',
      rules,
      t: (key, values) => {
        if (key === 'rules.linkWorkflow.summary.deviceActions') {
          return `${values?.count} 个动作 · ${values?.channels}`;
        }
        if (key === 'rules.linkWorkflow.summary.missingWebhookUrl') {
          return '缺少 Webhook URL';
        }
        if (key === 'rules.linkWorkflow.summary.systemNotification') {
          return '系统通知';
        }
        return key;
      }
    });

    expect(summaries.find((summary) => summary.outputType === 'device-channel')?.summary).toBe(
      '1 个动作 · pin.gp2'
    );
    expect(summaries.find((summary) => summary.outputType === 'webhook')?.summary).toBe(
      '缺少 Webhook URL'
    );
    expect(
      summaries.find((summary) => summary.outputType === 'system-notification')?.summary
    ).toBe('系统通知');
  });
});
