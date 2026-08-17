import { useEffect, useRef, useState } from 'react';
import {
  AiEventMapping,
  HardwareOutput,
  HardwareOutputType,
  HardwareRule
} from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  extractMappedInternalEvents,
  getRulesForEvent,
  createHardwareRuleIfAvailable,
  dedupeRuleId,
  enabledOutputLimitReached,
  MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT
} from './ruleProfileUtils';
import { HardwareRuleCard } from './HardwareRuleCard';
import { OutputTypeAddDialog } from './OutputTypeAddDialog';
import { DeviceSelectOption } from './deviceChannelOptions';
import { useI18n } from '@/i18n';

type HardwareRulePanelProps = {
  rules: HardwareRule[];
  aiEventMappings: AiEventMapping[];
  deviceOptions?: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  onChange: (rules: HardwareRule[]) => void;
};

const EVENT_LIMIT_MESSAGE_AUTO_HIDE_MS = 10_000;

export function HardwareRulePanel({
  rules,
  aiEventMappings,
  deviceOptions,
  desktopNoticeInstances = [],
  onChange
}: HardwareRulePanelProps) {
  const t = useI18n();
  const [draftRules, setDraftRules] = useState<HardwareRule[]>(rules);
  const [addDialogState, setAddDialogState] = useState<{
    open: boolean;
    internalEvent: string;
  }>({ open: false, internalEvent: '' });
  const [eventLimitMessages, setEventLimitMessages] = useState<Record<string, string>>({});
  const draftRulesRef = useRef<HardwareRule[]>(rules);
  const lastAcceptedExternalRulesRef = useRef<HardwareRule[]>(rules);
  const lastEmittedRulesRef = useRef<HardwareRule[] | null>(null);
  const eventLimitMessageTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 从 AI 映射中提取已使用的内部事件列表
  const mappedInternalEventIds = extractMappedInternalEvents(aiEventMappings);

  useEffect(() => {
    // Profile 保存可能先回传旧快照，编辑中的本地草稿不能被旧快照覆盖。
    if (lastEmittedRulesRef.current && rulesDeepEqual(rules, lastAcceptedExternalRulesRef.current)) {
      return;
    }
    if (lastEmittedRulesRef.current && rulesDeepEqual(rules, lastEmittedRulesRef.current)) {
      lastAcceptedExternalRulesRef.current = rules;
      return;
    }
    lastAcceptedExternalRulesRef.current = rules;
    draftRulesRef.current = rules;
    setDraftRules(rules);
  }, [rules]);

  useEffect(() => {
    return () => {
      Object.values(eventLimitMessageTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  function saveDraftRules(updater: (currentRules: HardwareRule[]) => HardwareRule[]) {
    // 字段快速连续编辑时，始终从最新 draft 合并，避免旧 props 快照覆盖已改字段。
    const nextRules = updater(draftRulesRef.current);
    draftRulesRef.current = nextRules;
    setDraftRules(nextRules);
    if (hardwareRulesAreReadyToSave(nextRules)) {
      lastEmittedRulesRef.current = nextRules;
      onChange(nextRules);
    }
  }

  function updateRule(ruleId: string, updater: (rule: HardwareRule) => HardwareRule) {
    saveDraftRules((currentRules) =>
      currentRules.map((item) => (item.id === ruleId ? updater(item) : item))
    );
  }

  function setEventLimitMessage(internalEvent: string, message: string) {
    setEventLimitMessages((currentMessages) => ({
      ...currentMessages,
      [internalEvent]: message
    }));
    if (eventLimitMessageTimersRef.current[internalEvent]) {
      clearTimeout(eventLimitMessageTimersRef.current[internalEvent]);
    }
    eventLimitMessageTimersRef.current[internalEvent] = setTimeout(() => {
      clearEventLimitMessage(internalEvent);
    }, EVENT_LIMIT_MESSAGE_AUTO_HIDE_MS);
  }

  function clearEventLimitMessage(internalEvent: string) {
    if (eventLimitMessageTimersRef.current[internalEvent]) {
      clearTimeout(eventLimitMessageTimersRef.current[internalEvent]);
      delete eventLimitMessageTimersRef.current[internalEvent];
    }
    setEventLimitMessages((currentMessages) => {
      if (!currentMessages[internalEvent]) {
        return currentMessages;
      }
      const nextMessages = { ...currentMessages };
      delete nextMessages[internalEvent];
      return nextMessages;
    });
  }

  function updateRuleWithEnabledLimit(
    ruleId: string,
    updater: (rule: HardwareRule) => HardwareRule
  ) {
    const currentRule = draftRulesRef.current.find((rule) => rule.id === ruleId);
    if (!currentRule) {
      return;
    }
    const nextRule = updater(currentRule);
    const enablingRule = !currentRule.enabled && nextRule.enabled;
    if (
      enablingRule &&
      enabledOutputLimitReached(draftRulesRef.current, currentRule.internalEvent)
    ) {
      setEventLimitMessage(
        currentRule.internalEvent,
        t('rules.outputRules.limitEnableMessage', {
          limit: MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT
        })
      );
      return;
    }

    clearEventLimitMessage(currentRule.internalEvent);
    updateRule(ruleId, () => nextRule);
  }

  function addOutputType(internalEvent: string, outputType: HardwareOutputType, output: HardwareOutput) {
    const rule = createHardwareRuleIfAvailable(
      draftRulesRef.current,
      internalEvent,
      outputType,
      output
    );
    if (!rule) {
      return;
    }
    const shouldDisableNewRule = enabledOutputLimitReached(draftRulesRef.current, internalEvent);
    const nextRule = {
      ...rule,
      enabled: shouldDisableNewRule ? false : rule.enabled,
      id: dedupeRuleId(
        draftRulesRef.current.map((item) => item.id),
        rule.id
      )
    };
    if (shouldDisableNewRule) {
      setEventLimitMessage(
        internalEvent,
        t('rules.outputRules.limitAddMessage', {
          limit: MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT
        })
      );
    } else {
      clearEventLimitMessage(internalEvent);
    }
    saveDraftRules((currentRules) => [...currentRules, nextRule]);
    setAddDialogState({ open: false, internalEvent: '' });
  }

  function removeRule(ruleId: string) {
    saveDraftRules((currentRules) => currentRules.filter((rule) => rule.id !== ruleId));
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('rules.outputRules.title')}</CardTitle>
          <CardDescription className="mt-1.5">
            {t('rules.outputRules.description')}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {mappedInternalEventIds.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t('rules.outputRules.empty')}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('rules.outputRules.emptyHint')}
            </p>
          </div>
        ) : draftRules.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t('rules.outputRules.generating')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {mappedInternalEventIds.map((eventId) => {
              const eventRules = getConfigurableRulesForEvent(draftRules, eventId);
              return (
                <div
                  key={eventId}
                  className="space-y-4 rounded-lg border bg-muted/20 p-4"
                  data-testid={`hardware-rule-event-group-${eventId}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {eventId}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('rules.outputRules.outputTypeCount', { count: eventRules.length })}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddDialogState({ open: true, internalEvent: eventId })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('rules.outputRules.addOutputType')}
                    </Button>
                  </div>
                  {eventLimitMessages[eventId] && (
                    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                      <AlertDescription>{eventLimitMessages[eventId]}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-3">
                    {eventRules.map((rule) => (
                      <HardwareRuleCard
                        key={rule.id}
                        rule={rule}
                        deviceOptions={deviceOptions}
                        desktopNoticeInstances={desktopNoticeInstances}
                        canRemove={eventRules.length > 1}
                        onUpdate={updateRuleWithEnabledLimit}
                        onRemove={removeRule}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      {addDialogState.open && (
        <OutputTypeAddDialog
          internalEvent={addDialogState.internalEvent}
          existingRules={draftRules}
          deviceOptions={deviceOptions}
          desktopNoticeInstances={desktopNoticeInstances}
          onCancel={() => setAddDialogState({ open: false, internalEvent: '' })}
          onAdd={addOutputType}
        />
      )}
    </Card>
  );
}

function rulesDeepEqual(left: HardwareRule[], right: HardwareRule[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getConfigurableRulesForEvent(rules: HardwareRule[], eventId: string) {
  return getRulesForEvent(rules, eventId).filter((rule) => rule.output.type !== 'display');
}

function hardwareRulesAreReadyToSave(rules: HardwareRule[]) {
  return rules.every((rule) => {
    if (rule.output.type === 'webhook') {
      return Boolean(rule.output.webhookUrl?.trim());
    }
    if (rule.output.type === 'sound') {
      return Boolean(rule.output.soundFilePath?.trim());
    }
    if (rule.output.type === 'device-channel') {
      const actions = rule.output.channelActions ?? [];
      return (
        actions.length > 0 &&
        actions.every(
          (action) =>
            action.deviceId.trim() &&
            action.channelId.trim() &&
            Boolean(action.channelAction)
        )
      );
    }
    return true;
  });
}
