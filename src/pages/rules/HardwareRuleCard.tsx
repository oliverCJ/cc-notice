import { useState } from 'react';
import { HardwareOutputType, HardwareRule } from '../../api/tauriApi';
import type {
  DesktopNoticeInstance,
  DesktopNoticeRestoreBehavior,
  DesktopNoticeRuleTarget
} from '@/domain/desktopNotice';
import {
  isOnceMascotPlayMode,
  normalizeDesktopMascotPlaybackWindowMs
} from '@/domain/desktopNotice';
import { builtInMascotPacks, desktopMascotActionLabel } from '@/domain/desktopMascot';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Trash2 } from 'lucide-react';
import { HardwareRuleDetailDialog } from './HardwareRuleDetailDialog';
import { DeviceSelectOption } from './deviceChannelOptions';
import { Translator, useI18n } from '@/i18n';

type HardwareRuleCardProps = {
  rule: HardwareRule;
  deviceOptions?: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  canRemove: boolean;
  onUpdate: (ruleId: string, updater: (rule: HardwareRule) => HardwareRule) => void;
  onRemove: (ruleId: string) => void;
};

export function HardwareRuleCard({
  rule,
  deviceOptions,
  desktopNoticeInstances = [],
  canRemove,
  onUpdate,
  onRemove
}: HardwareRuleCardProps) {
  const t = useI18n();
  const [detailOpen, setDetailOpen] = useState(false);
  const needsRequiredConfig = ruleNeedsRequiredConfig(rule);

  return (
    <div
      className={`grid gap-4 rounded-lg border border-border/80 border-l-4 bg-background p-4 shadow-sm ${ruleAccentClass(rule)}`}
      data-testid={`hardware-rule-card-${rule.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-semibold">
              {rule.output.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {rule.enabled ? t('rules.outputRules.enabled') : t('rules.outputRules.disabled')}
            </span>
            {needsRequiredConfig && (
              <Badge variant="secondary" className="text-xs">
                {t('rules.outputRules.pendingConfig')}
              </Badge>
            )}
          </div>
          <p className="max-w-2xl truncate text-sm text-muted-foreground">
            {outputSummary(rule, t)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            {t('rules.outputRules.detailSettings')}
          </Button>
          <div className="flex items-center space-x-2">
            <Switch
              id={`enabled-${rule.id}`}
              checked={rule.enabled}
              onCheckedChange={(checked) =>
                onUpdate(rule.id, (currentRule) => ({
                  ...currentRule,
                  enabled: checked
                }))
              }
            />
            <Label htmlFor={`enabled-${rule.id}`} className="cursor-pointer">
              {t('rules.outputRules.enable')}
            </Label>
          </div>
          {canRemove && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(rule.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <HardwareRuleDetailDialog
        rule={rule}
        deviceOptions={deviceOptions}
        desktopNoticeInstances={desktopNoticeInstances}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        onSave={(nextRule) => {
          onUpdate(rule.id, () => nextRule);
          setDetailOpen(false);
        }}
      />
    </div>
  );
}

function ruleNeedsRequiredConfig(rule: HardwareRule) {
  if (rule.output.type === 'device-channel') {
    const actions = rule.output.channelActions ?? [];
    return (
      actions.length === 0 ||
      actions.some(
        (action) =>
          !action.deviceId.trim() ||
          !action.channelId.trim() ||
          !action.channelAction
      )
    );
  }
  if (rule.output.type === 'webhook') {
    return !rule.output.webhookUrl?.trim();
  }
  if (rule.output.type === 'sound') {
    return !rule.output.soundFilePath?.trim();
  }
  if (rule.output.type === 'desktop-notice') {
    return !(rule.output.desktopNoticeTargets ?? []).some((target) => target.targetId.trim());
  }
  return false;
}

function outputTypeAccentClass(outputType: HardwareOutputType) {
  if (outputType === 'device-channel') {
    return 'border-l-emerald-400';
  }
  if (outputType === 'system-notification') {
    return 'border-l-sky-400';
  }
  if (outputType === 'webhook') {
    return 'border-l-violet-400';
  }
  if (outputType === 'sound') {
    return 'border-l-orange-400';
  }
  if (outputType === 'desktop-notice') {
    return 'border-l-cyan-400';
  }
  return 'border-l-rose-400';
}

function ruleAccentClass(rule: HardwareRule) {
  if (!rule.enabled) {
    return 'border-l-zinc-400';
  }
  return outputTypeAccentClass(rule.output.type);
}

function outputSummary(rule: HardwareRule, t: Translator) {
  const output = rule.output;
  if (output.type === 'device-channel') {
    const actions = output.channelActions ?? [];
    const channels =
      actions
        .map((action) => `${action.deviceId}:${action.channelId}`)
        .slice(0, 4)
        .join(', ') || t('common.notConfigured');
    return t('rules.outputRules.summaryDeviceChannelActions', {
      count: actions.length,
      channels
    });
  }
  if (output.type === 'system-notification') {
    return t('rules.outputRules.summaryNotification', {
      level: output.notificationLevel ?? 'info',
      title: output.notificationTitle || t('common.notConfigured'),
      seconds: output.notificationThrottleSeconds ?? 30
    });
  }
  if (output.type === 'webhook') {
    return t('rules.outputRules.summaryWebhook', {
      method: output.webhookMethod ?? 'POST',
      url: output.webhookUrl || t('rules.outputRules.unsetUrl')
    });
  }
  if (output.type === 'sound') {
    return t('rules.outputRules.summarySound', {
      file: output.soundFilePath || t('rules.outputRules.unsetSound'),
      volume: output.soundVolumePercent ?? 80
    });
  }
  if (output.type === 'display') {
    const title = output.displayTemplateId
      ? t(displayTemplateLabelKey(output.displayTemplateId))
      : output.displayTitleTemplate || t('common.notConfigured');
    return t('rules.outputRules.summaryDisplay', {
      device: output.displayDeviceId || t('common.notConfigured'),
      status: output.displayStatus ?? 'notice',
      title
    });
  }
  if (output.type === 'desktop-notice') {
    const desktopNoticeTargets = output.desktopNoticeTargets ?? [];
    const targets = desktopNoticeTargets.length
      ? desktopNoticeTargets.map((target) => target.targetId).join(', ')
      : t('common.notConfigured');
    if (desktopNoticeTargets.length > 1) {
      const mascotTargets = desktopNoticeTargets.filter(hasMascotRuleMetadata);
      const firstMascotTarget = mascotTargets[0];
      return t('rules.outputRules.summaryDesktopNoticeTargets', {
        count: desktopNoticeTargets.length,
        targetTypes: formatDesktopNoticeTargetTypes(
          desktopNoticeTargets.length - mascotTargets.length,
          mascotTargets.length,
          t
        ),
        highlight: firstMascotTarget?.mascotState
          ? t(`desktopNotice.mascot.states.${firstMascotTarget.mascotState}`)
          : t('rules.outputRules.multipleTargets'),
        seconds: Math.round((desktopNoticeTargets[0]?.durationMs ?? 3000) / 1000),
        restoreBehavior: t(
          `rules.desktopNotice.restoreBehaviors.${restoreBehaviorLabelKey(
            desktopNoticeTargets[0]?.restoreBehavior ?? 'use-instance-idle'
          )}`
        )
      });
    }
    const firstTarget = desktopNoticeTargets[0];
    if (firstTarget && hasMascotRuleMetadata(firstTarget)) {
      return t('rules.outputRules.summaryDesktopMascot', {
        targets,
        state: firstTarget.mascotState
          ? t(`desktopNotice.mascot.states.${firstTarget.mascotState}`)
          : t('common.notConfigured'),
        action: formatMascotAction(firstTarget, t),
        bubble: firstTarget.mascotBubbleTemplate?.trim() || t('common.notConfigured'),
        playbackWindow: formatMascotPlaybackWindow(firstTarget, t),
        seconds: Math.round((firstTarget.durationMs ?? 3000) / 1000),
        restoreBehavior: t(
          `rules.desktopNotice.restoreBehaviors.${restoreBehaviorLabelKey(
            firstTarget.restoreBehavior ?? 'use-instance-idle'
          )}`
        )
      });
    }
    return t('rules.outputRules.summaryDesktopNotice', {
      targets,
      effect: t(desktopNoticeEffectLabelKey(firstTarget?.effect ?? 'solid')),
      seconds: Math.round((firstTarget?.durationMs ?? 3000) / 1000),
      restoreBehavior: t(
        `rules.desktopNotice.restoreBehaviors.${restoreBehaviorLabelKey(
          firstTarget?.restoreBehavior ?? 'use-instance-idle'
        )}`
      )
    });
  }
  return t('rules.outputRules.noSummary');
}

function hasMascotRuleMetadata(target: DesktopNoticeRuleTarget): boolean {
  return Boolean(target?.mascotState || target?.mascotActionId || target?.mascotBubbleTemplate);
}

function formatDesktopNoticeTargetTypes(
  lightbarCount: number,
  mascotCount: number,
  t: Translator
): string {
  const parts: string[] = [];
  if (lightbarCount > 0) {
    parts.push(t('rules.outputRules.desktopNoticeLightbarCount', { count: lightbarCount }));
  }
  if (mascotCount > 0) {
    parts.push(t('rules.outputRules.desktopNoticeMascotCount', { count: mascotCount }));
  }
  return parts.join(' · ') || t('common.notConfigured');
}

function formatMascotAction(target: DesktopNoticeRuleTarget, t: Translator): string {
  if (!target.mascotActionId) {
    return t('common.notConfigured');
  }
  const action = builtInMascotPacks
    .flatMap((pack) => pack.actions)
    .find((item) => item.id === target.mascotActionId);
  return action ? desktopMascotActionLabel(action, t) : target.mascotActionId;
}

function formatMascotPlaybackWindow(target: DesktopNoticeRuleTarget, t: Translator): string {
  if (!isOnceMascotPlayMode(target.mascotPlayMode)) {
    return t('common.notConfigured');
  }
  return t('rules.desktopNotice.mascotPlaybackWindowSummary', {
    seconds: (normalizeDesktopMascotPlaybackWindowMs(target.mascotPlaybackWindowMs) / 1000).toFixed(1)
  });
}

function restoreBehaviorLabelKey(behavior: DesktopNoticeRestoreBehavior): string {
  if (behavior === 'hide') {
    return 'hide';
  }
  if (behavior === 'keep-last') {
    return 'keepLast';
  }
  return 'useInstanceIdle';
}

function desktopNoticeEffectLabelKey(effect: string): string {
  if (effect === 'edge-breathing') {
    return 'rules.desktopNotice.effects.edgeBreathing';
  }
  return `rules.desktopNotice.effects.${effect}`;
}

function displayTemplateLabelKey(templateId: string): string {
  const suffix = templateId
    .split('-')
    .map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1))
    .join('');
  return `rules.display.templateOptions.${suffix}`;
}
