import { useEffect, useState } from 'react';
import { HardwareRule } from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeviceChannelOutputFields } from './DeviceChannelOutputFields';
import { DeviceSelectOption } from './deviceChannelOptions';
import { DisplayOutputFields } from './DisplayOutputFields';
import { SystemNotificationOutputFields } from './SystemNotificationOutputFields';
import { WebhookOutputFields } from './WebhookOutputFields';
import { SoundOutputFields } from './SoundOutputFields';
import { DesktopNoticeOutputFields } from './DesktopNoticeOutputFields';
import { AlertCircle } from 'lucide-react';
import { Translator, useI18n } from '@/i18n';
import { validateDeviceChannelActionParameters } from './ruleProfileUtils';
import { validateDesktopNoticeRuleConfig } from '@/domain/desktopNotice';
import {
  findDuplicateActionTargets,
  MAX_DEVICE_CHANNEL_ACTION_GROUPS
} from './DeviceChannelActionGroupFields';

type HardwareRuleDetailDialogProps = {
  rule: HardwareRule;
  deviceOptions?: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  open: boolean;
  onCancel: () => void;
  onSave: (rule: HardwareRule) => void;
};

export function HardwareRuleDetailDialog({
  rule,
  deviceOptions,
  desktopNoticeInstances = [],
  open,
  onCancel,
  onSave
}: HardwareRuleDetailDialogProps) {
  const t = useI18n();
  const [draftRule, setDraftRule] = useState(rule);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftRule(rule);
      setValidationError(null);
    }
  }, [open, rule]);

  function saveDraft() {
    const error = validateRuleDetails(draftRule, t);
    if (error) {
      setValidationError(error);
      return;
    }
    onSave(draftRule);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('rules.outputRules.detailTitle', { type: draftRule.output.type })}
          </DialogTitle>
          <DialogDescription>
            {t('rules.outputRules.detailDescription', { internalEvent: draftRule.internalEvent })}
          </DialogDescription>
        </DialogHeader>

        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {draftRule.output.type === 'device-channel' ? (
            <DeviceChannelOutputFields
              internalEvent={draftRule.internalEvent}
              output={draftRule.output}
              deviceOptions={deviceOptions}
              onChange={(output) => setDraftRule((current) => ({ ...current, output }))}
            />
          ) : draftRule.output.type === 'display' ? (
            <DisplayOutputFields
              output={draftRule.output}
              displayDeviceOptions={buildDisplayDeviceOptions(deviceOptions)}
              onChange={(output) => setDraftRule((current) => ({ ...current, output }))}
            />
          ) : draftRule.output.type === 'system-notification' ? (
            <SystemNotificationOutputFields
              internalEvent={draftRule.internalEvent}
              output={draftRule.output}
              onChange={(output) => setDraftRule((current) => ({ ...current, output }))}
            />
          ) : draftRule.output.type === 'webhook' ? (
            <WebhookOutputFields
              internalEvent={draftRule.internalEvent}
              output={draftRule.output}
              onChange={(output) => setDraftRule((current) => ({ ...current, output }))}
            />
          ) : draftRule.output.type === 'sound' ? (
            <SoundOutputFields
              internalEvent={draftRule.internalEvent}
              output={draftRule.output}
              onChange={(output) => setDraftRule((current) => ({ ...current, output }))}
            />
          ) : draftRule.output.type === 'desktop-notice' ? (
            <DesktopNoticeOutputFields
              output={draftRule.output}
              instances={desktopNoticeInstances}
              onChange={(output) => setDraftRule((current) => ({ ...current, output }))}
            />
          ) : (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">
                {t('rules.outputRules.unsupported')}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={saveDraft}>{t('rules.outputRules.saveSettings')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validateRuleDetails(rule: HardwareRule, t: Translator): string | null {
  if (rule.output.type === 'device-channel') {
    return validateDeviceChannelDetails(rule.output, t);
  }
  if (rule.output.type === 'webhook') {
    return validateWebhookDetails(rule.output, t);
  }
  if (rule.output.type === 'sound') {
    return validateSoundDetails(rule.output, t);
  }
  if (rule.output.type === 'display') {
    return validateDisplayDetails(rule.output, t);
  }
  if (rule.output.type === 'desktop-notice') {
    return validateDesktopNoticeDetails(rule.output, t);
  }
  return null;
}

function validateDeviceChannelDetails(output: HardwareRule['output'], t: Translator): string | null {
  const actions = output.channelActions ?? [];
  if (actions.length === 0) {
    return t('rules.outputRules.validationChannelActionsRequired');
  }
  if (actions.length > MAX_DEVICE_CHANNEL_ACTION_GROUPS) {
    return t('rules.outputRules.validationChannelActionsLimit');
  }
  if (findDuplicateActionTargets(actions).size > 0) {
    return t('rules.outputRules.validationDuplicateChannelAction');
  }
  for (const action of actions) {
    if (!action.deviceId.trim()) {
      return t('rules.outputRules.validationDeviceRequired');
    }
    if (!action.channelId.trim()) {
      return t('rules.outputRules.validationChannelRequired');
    }
    if (!action.channelAction) {
      return t('rules.outputRules.validationChannelActionRequired');
    }
    const actionParameterError = validateDeviceChannelActionParameters(action);
    if (actionParameterError) {
      return t(actionParameterError);
    }
  }
  return null;
}

function validateWebhookDetails(output: HardwareRule['output'], t: Translator): string | null {
  const url = output.webhookUrl?.trim() ?? '';
  const method = output.webhookMethod ?? 'POST';
  const headers = output.webhookHeaders?.trim() ?? '';
  const body = output.webhookBody?.trim() ?? '';

  if (!url) {
    return t('rules.outputRules.validationWebhookUrlRequired');
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return t('rules.outputRules.validationWebhookUrlInvalid');
  }
  if (headers && !jsonParses(headers)) {
    return t('rules.outputRules.validationHeadersJson');
  }
  if (method !== 'GET' && body && !jsonTemplateParses(body)) {
    return t('rules.outputRules.validationBodyJson');
  }
  return null;
}

function validateSoundDetails(output: HardwareRule['output'], t: Translator): string | null {
  if (!output.soundFilePath?.trim()) {
    return t('rules.outputRules.validationSoundRequired');
  }
  return null;
}

function validateDisplayDetails(output: HardwareRule['output'], t: Translator): string | null {
  if (!output.displayDeviceId?.trim()) {
    return t('rules.outputRules.validationDisplayDeviceRequired');
  }
  if (!output.displayStatus?.trim()) {
    return t('rules.outputRules.validationDisplayStatusRequired');
  }
  if (!output.displayTitleTemplate?.trim()) {
    return t('rules.outputRules.validationDisplayTitleRequired');
  }
  if (!output.displayMessageTemplate?.trim()) {
    return t('rules.outputRules.validationDisplayMessageRequired');
  }
  return null;
}

function validateDesktopNoticeDetails(
  output: HardwareRule['output'],
  t: Translator
): string | null {
  const targets = output.desktopNoticeTargets ?? [];
  if (targets.length === 0) {
    return t('rules.outputRules.validationDesktopNoticeTargetRequired');
  }
  const validation = targets
    .map((target) =>
      validateDesktopNoticeRuleConfig({
        targetIds: [target.targetId],
        effect: target.effect,
        colorMode: target.colorMode,
        colors: target.colors,
        durationMs: target.durationMs,
        animationPeriodMs: target.animationPeriodMs,
        breathingPeriodMs: target.breathingPeriodMs
      })
    )
    .find((result) => !result.valid) ?? { valid: true as const };
  if (validation.valid) {
    return null;
  }
  if (validation.code === 'DESKTOP_NOTICE_RULE_TARGET_REQUIRED') {
    return t('rules.outputRules.validationDesktopNoticeTargetRequired');
  }
  if (validation.code === 'DESKTOP_NOTICE_RULE_DURATION_INVALID') {
    return t('rules.outputRules.validationDesktopNoticeDurationInvalid');
  }
  if (validation.code === 'DESKTOP_NOTICE_INVALID_COLOR') {
    return t('rules.outputRules.validationDesktopNoticeColorInvalid');
  }
  if (validation.code === 'DESKTOP_NOTICE_INVALID_STATE_EFFECT') {
    return t('rules.outputRules.validationDesktopNoticeBreathingPeriodInvalid');
  }
  return t('rules.outputRules.validationDesktopNoticeColorStopsInvalid');
}

function buildDisplayDeviceOptions(deviceOptions?: DeviceSelectOption[]) {
  return (deviceOptions ?? [])
    .filter((device) => device.deviceExtensions?.display?.status)
    .map((device) => ({
      value: device.value,
      label: device.label ?? device.value,
      displayCapabilities: device.deviceExtensions?.display ?? null
    }));
}

function jsonParses(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function jsonTemplateParses(value: string): boolean {
  const tokenPattern = /\{\{[a-zA-Z0-9_\u4e00-\u9fa5]+\}\}/g;
  const quotedTokenPattern = /"\{\{[a-zA-Z0-9_\u4e00-\u9fa5]+\}\}"/g;
  return jsonParses(
    value
      .replace(quotedTokenPattern, '"template"')
      .replace(tokenPattern, '"template"')
  );
}
