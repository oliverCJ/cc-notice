import { HardwareOutputType, HardwareRule } from '@/api/tauriApi';
import { Translator } from '@/i18n';
import { supportedOutputTypes } from '../ruleProfileUtils';

export type OutputRuleSummaryStatus = 'enabled' | 'disabled' | 'needs-config' | 'not-added';
export type OutputRuleSummaryAction = 'edit' | 'add';

export type OutputRuleSummary = {
  id: string;
  ruleId?: string;
  internalEvent: string;
  outputType: HardwareOutputType;
  labelKey: string;
  descriptionKey: string;
  status: OutputRuleSummaryStatus;
  action: OutputRuleSummaryAction;
  summary: string;
};

export function buildOutputRuleSummaries(input: {
  internalEvent: string;
  rules: HardwareRule[];
  t: Translator;
}): OutputRuleSummary[] {
  const eventRules = input.rules.filter((rule) => rule.internalEvent === input.internalEvent);

  return supportedOutputTypes
    .filter((type) => type.implemented && type.value !== 'display')
    .map((type) => {
      const rule = eventRules.find((item) => item.output.type === type.value);
      if (!rule) {
        return {
          id: `${input.internalEvent}-${type.value}-not-added`,
          internalEvent: input.internalEvent,
          outputType: type.value,
          labelKey: type.labelKey,
          descriptionKey: type.descriptionKey,
          status: 'not-added',
          action: 'add',
          summary: ''
        };
      }

      return {
        id: rule.id,
        ruleId: rule.id,
        internalEvent: rule.internalEvent,
        outputType: rule.output.type,
        labelKey: type.labelKey,
        descriptionKey: type.descriptionKey,
        status: outputNeedsConfig(rule) ? 'needs-config' : rule.enabled ? 'enabled' : 'disabled',
        action: 'edit',
        summary: summarizeRule(rule, input.t)
      };
    });
}

function outputNeedsConfig(rule: HardwareRule): boolean {
  if (rule.output.type === 'webhook') {
    return !(rule.output.webhookUrl ?? '').trim();
  }
  if (rule.output.type === 'sound') {
    return !(rule.output.soundFilePath ?? '').trim();
  }
  if (rule.output.type === 'device-channel') {
    return (rule.output.channelActions ?? []).length === 0;
  }
  if (rule.output.type === 'display') {
    return !(
      rule.output.displayDeviceId?.trim() &&
      rule.output.displayStatus?.trim() &&
      rule.output.displayTitleTemplate?.trim() &&
      rule.output.displayMessageTemplate?.trim()
    );
  }
  return false;
}

function summarizeRule(rule: HardwareRule, t: Translator): string {
  if (rule.output.type === 'device-channel') {
    const actions = rule.output.channelActions ?? [];
    const channels = actions.map((action) => action.channelId).filter(Boolean).join(' / ');
    return channels
      ? t('rules.linkWorkflow.summary.deviceActions', {
          count: actions.length,
          channels
        })
      : t('rules.linkWorkflow.summary.deviceActionCount', {
          count: actions.length
        });
  }
  if (rule.output.type === 'webhook') {
    return rule.output.webhookUrl?.trim() || t('rules.linkWorkflow.summary.missingWebhookUrl');
  }
  if (rule.output.type === 'sound') {
    return rule.output.soundFilePath?.trim() || t('rules.linkWorkflow.summary.missingSoundFile');
  }
  if (rule.output.type === 'system-notification') {
    return (
      rule.output.notificationTitle?.trim() ||
      rule.output.text?.trim() ||
      t('rules.linkWorkflow.summary.systemNotification')
    );
  }
  if (rule.output.type === 'display') {
    return (
      rule.output.displayTitleTemplate?.trim() ||
      t('rules.linkWorkflow.summary.display')
    );
  }
  return '';
}
