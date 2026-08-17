import { useEffect, useMemo, useRef, useState } from 'react';
import { HardwareRule, NoticeProfile } from '@/api/tauriApi';
import { Translator } from '@/i18n';
import {
  createDefaultOutputForType,
  createHardwareRuleIfAvailable,
  dedupeRuleId,
  enabledOutputLimitReached,
  MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT
} from '../ruleProfileUtils';
import { buildOutputRuleSummaries, OutputRuleSummary } from './outputRuleSummaries';
import { LinkWorkflowViewModel } from './types';

const EVENT_LIMIT_MESSAGE_AUTO_HIDE_MS = 10_000;

type UseOutputRuleInspectorControllerInput = {
  viewModel: LinkWorkflowViewModel;
  profile: NoticeProfile;
  t: Translator;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function useOutputRuleInspectorController({
  viewModel,
  profile,
  t,
  onSaveProfile
}: UseOutputRuleInspectorControllerInput) {
  const internalEvents = viewModel.internalEventOverview.events;
  const [selectedInternalEvent, setSelectedInternalEvent] = useState(
    internalEvents[0]?.id ?? ''
  );
  const [editingRule, setEditingRule] = useState<HardwareRule | null>(null);
  const [draftAddingRule, setDraftAddingRule] = useState<HardwareRule | null>(null);
  const [outputLimitMessage, setOutputLimitMessage] = useState<string | null>(null);
  const outputLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedEvent = selectedInternalEvent || internalEvents[0]?.id || '';
  const summaries = useMemo(
    () =>
      selectedEvent
        ? buildOutputRuleSummaries({
            internalEvent: selectedEvent,
            rules: profile.hardwareRules,
            t
          })
        : [],
    [profile.hardwareRules, selectedEvent, t]
  );
  const enabledCount = summaries.filter((summary) => summary.status === 'enabled').length;
  const needsConfigCount = summaries.filter((summary) => summary.status === 'needs-config').length;

  useEffect(() => {
    return () => clearOutputLimitTimer();
  }, []);

  useEffect(() => {
    clearOutputLimitMessage();
  }, [selectedEvent]);

  function editSummary(summary: OutputRuleSummary) {
    if (summary.action === 'add') {
      startAddingSummary(summary);
      return;
    }
    const rule = profile.hardwareRules.find((item) => item.id === summary.ruleId);
    if (rule) {
      setEditingRule(rule);
    }
  }

  function startAddingSummary(summary: OutputRuleSummary) {
    const output = createDefaultOutputForType(summary.outputType, summary.internalEvent);
    const rule = createHardwareRuleIfAvailable(
      profile.hardwareRules,
      summary.internalEvent,
      summary.outputType,
      output
    );
    if (!rule) {
      return;
    }

    const shouldDisableNewRule = enabledOutputLimitReached(
      profile.hardwareRules,
      summary.internalEvent
    );
    clearOutputLimitMessage();
    setDraftAddingRule({
      ...rule,
      enabled: shouldDisableNewRule ? false : rule.enabled,
      id: dedupeRuleId(
        profile.hardwareRules.map((item) => item.id),
        rule.id
      )
    });
  }

  function saveRule(nextRule: HardwareRule) {
    onSaveProfile({
      ...profile,
      hardwareRules: profile.hardwareRules.map((rule) =>
        rule.id === nextRule.id ? nextRule : rule
      )
    });
    setEditingRule(null);
  }

  function saveNewRule(nextRule: HardwareRule) {
    const shouldDisableNewRule = enabledOutputLimitReached(
      profile.hardwareRules,
      nextRule.internalEvent
    );
    const savedRule = {
      ...nextRule,
      enabled: shouldDisableNewRule ? false : nextRule.enabled,
      id: dedupeRuleId(
        profile.hardwareRules.map((rule) => rule.id),
        nextRule.id
      )
    };

    onSaveProfile({
      ...profile,
      hardwareRules: [...profile.hardwareRules, savedRule]
    });
    setDraftAddingRule(null);
    if (shouldDisableNewRule) {
      showOutputLimitMessage('rules.outputRules.limitAddMessage');
    } else {
      clearOutputLimitMessage();
    }
  }

  function toggleRule(summary: OutputRuleSummary, enabled: boolean) {
    if (!summary.ruleId) {
      return;
    }
    const currentRule = profile.hardwareRules.find((rule) => rule.id === summary.ruleId);
    if (!currentRule) {
      return;
    }
    const enablingRule = !currentRule.enabled && enabled;
    if (
      enablingRule &&
      enabledOutputLimitReached(profile.hardwareRules, currentRule.internalEvent)
    ) {
      showOutputLimitMessage('rules.outputRules.limitEnableMessage');
      return;
    }

    clearOutputLimitMessage();
    onSaveProfile({
      ...profile,
      hardwareRules: profile.hardwareRules.map((rule) =>
        rule.id === summary.ruleId ? { ...rule, enabled } : rule
      )
    });
  }

  function showOutputLimitMessage(messageKey: string) {
    setOutputLimitMessage(
      t(messageKey, {
        limit: MAX_ENABLED_OUTPUTS_PER_INTERNAL_EVENT
      })
    );
    clearOutputLimitTimer();
    outputLimitTimerRef.current = setTimeout(() => {
      setOutputLimitMessage(null);
      outputLimitTimerRef.current = null;
    }, EVENT_LIMIT_MESSAGE_AUTO_HIDE_MS);
  }

  function clearOutputLimitMessage() {
    clearOutputLimitTimer();
    setOutputLimitMessage(null);
  }

  function clearOutputLimitTimer() {
    if (outputLimitTimerRef.current) {
      clearTimeout(outputLimitTimerRef.current);
      outputLimitTimerRef.current = null;
    }
  }

  return {
    internalEvents,
    selectedEvent,
    summaries,
    enabledCount,
    needsConfigCount,
    editingRule,
    draftAddingRule,
    outputLimitMessage,
    setSelectedInternalEvent,
    setEditingRule,
    setDraftAddingRule,
    editSummary,
    saveRule,
    saveNewRule,
    toggleRule
  };
}
