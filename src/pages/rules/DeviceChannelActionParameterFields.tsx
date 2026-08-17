import {
  DeviceBuzzerPattern,
  DeviceChannelActionType,
  DeviceChannelRuleAction,
  DeviceDisplayCapabilities,
} from '../../api/tauriApi';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import {
  NumericParameterConstraint,
  clampOptionalNumber,
  deviceChannelParameterConstraints
} from './ruleProfileUtils';
import { TemplateVariablePopover } from './template-variables/TemplateVariablePopover';
import {
  TEMPLATE_VARIABLES,
  insertTemplateToken
} from './template-variables/templateVariables';
import {
  DISPLAY_TEMPLATE_IDS,
  DisplayTemplateId,
  defaultLinesForDisplayTemplate,
  displayIconForTemplate,
  displayStatusForTemplate
} from '@/domain/display/displayTemplates';
import { validateAsciiDisplayTemplate } from './displayTemplateValidation';
import { DeferredNumberInput } from './DeferredNumberInput';

type DeviceChannelActionParameterFieldsProps = {
  action?: DeviceChannelActionType | null;
  actionDomId: string;
  value: DeviceChannelRuleAction;
  displayCapabilities?: DeviceDisplayCapabilities | null;
  onChange: (patch: Partial<DeviceChannelRuleAction>) => void;
};

export function DeviceChannelActionParameterFields({
  action,
  actionDomId,
  value,
  displayCapabilities,
  onChange
}: DeviceChannelActionParameterFieldsProps) {
  const t = useI18n();
  const [activeDisplayTemplateField, setActiveDisplayTemplateField] = useState<'title' | 'message'>('message');
  const [advancedDisplayEditing, setAdvancedDisplayEditing] = useState(false);
  const displayTitleInputRef = useRef<HTMLInputElement>(null);
  const displayMessageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const displayTitleValidationKey = validateAsciiDisplayTemplate(value.displayTitleTemplate ?? '');
  const displayMessageValidationKey = validateAsciiDisplayTemplate(value.displayMessageTemplate ?? '');
  const displayTitleConstraint = displayLimitConstraint(displayCapabilities?.titleMaxChars, 39);
  const displayMessageConstraint = displayLimitConstraint(displayCapabilities?.messageMaxChars, 95);
  const displaySizeClass = displayCapabilities?.sizeClass ?? 'small';
  const normalizedDisplayTitleMaxChars = clampDisplayLimitValue(
    value.displayTitleMaxChars,
    displayTitleConstraint
  );
  const normalizedDisplayMessageMaxChars = clampDisplayLimitValue(
    value.displayMessageMaxChars,
    displayMessageConstraint
  );

  useEffect(() => {
    if (action !== 'display-status') {
      return;
    }
    if (
      normalizedDisplayTitleMaxChars === value.displayTitleMaxChars &&
      normalizedDisplayMessageMaxChars === value.displayMessageMaxChars
    ) {
      return;
    }
    onChange({
      displayTitleMaxChars: normalizedDisplayTitleMaxChars,
      displayMessageMaxChars: normalizedDisplayMessageMaxChars
    });
  }, [
    action,
    normalizedDisplayMessageMaxChars,
    normalizedDisplayTitleMaxChars,
    onChange,
    value.displayMessageMaxChars,
    value.displayTitleMaxChars
  ]);

  if (!action) {
    return null;
  }

  function insertDisplayVariableToken(token: string) {
    if (activeDisplayTemplateField === 'title') {
      const result = insertTemplateToken(
        value.displayTitleTemplate ?? '',
        token,
        displayTitleInputRef.current?.selectionStart,
        displayTitleInputRef.current?.selectionEnd
      );
      onChange({ displayTitleTemplate: result.value });
      requestAnimationFrame(() => {
        displayTitleInputRef.current?.focus();
        displayTitleInputRef.current?.setSelectionRange(result.cursorPosition, result.cursorPosition);
      });
      return;
    }

    const result = insertTemplateToken(
      value.displayMessageTemplate ?? '',
      token,
      displayMessageTextareaRef.current?.selectionStart,
      displayMessageTextareaRef.current?.selectionEnd
    );
    onChange({ displayMessageTemplate: result.value });
    requestAnimationFrame(() => {
      displayMessageTextareaRef.current?.focus();
      displayMessageTextareaRef.current?.setSelectionRange(result.cursorPosition, result.cursorPosition);
    });
  }

  function copyDisplayVariableToken(token: string) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(token);
    }
  }

  return (
    <>
      {shouldShowDuration(action) ? (
        <NumberField
          id={`device-duration-${actionDomId}`}
          label={t('rules.deviceChannel.durationMs')}
          value={value.durationMs}
          constraint={deviceChannelParameterConstraints.durationMs}
          placeholder={t('rules.deviceChannel.durationPlaceholder')}
          rangeLabel={t('rules.deviceChannel.rangeHint', {
            min: deviceChannelParameterConstraints.durationMs.min,
            max: deviceChannelParameterConstraints.durationMs.max
          })}
          onChange={(durationMs) => onChange({ durationMs })}
        />
      ) : null}

      {action === 'blink' || action === 'breathe' ? (
        <NumberField
          id={`device-interval-${actionDomId}`}
          label={t('rules.deviceChannel.intervalMs')}
          value={value.intervalMs}
          constraint={
            action === 'breathe'
              ? deviceChannelParameterConstraints.breatheIntervalMs
              : deviceChannelParameterConstraints.intervalMs
          }
          placeholder={t('rules.deviceChannel.intervalPlaceholder')}
          rangeLabel={t('rules.deviceChannel.rangeHint', {
            min:
              action === 'breathe'
                ? deviceChannelParameterConstraints.breatheIntervalMs.min
                : deviceChannelParameterConstraints.intervalMs.min,
            max:
              action === 'breathe'
                ? deviceChannelParameterConstraints.breatheIntervalMs.max
                : deviceChannelParameterConstraints.intervalMs.max
          })}
          onChange={(intervalMs) => onChange({ intervalMs })}
        />
      ) : null}

      {action === 'set-duty' ? (
        <NumberField
          id={`device-duty-${actionDomId}`}
          label={t('rules.deviceChannel.dutyPercent')}
          value={value.dutyPercent}
          placeholder={t('rules.deviceChannel.dutyPercentPlaceholder')}
          constraint={deviceChannelParameterConstraints.dutyPercent}
          rangeLabel={t('rules.deviceChannel.rangeHint', {
            min: deviceChannelParameterConstraints.dutyPercent.min,
            max: deviceChannelParameterConstraints.dutyPercent.max
          })}
          onChange={(dutyPercent) => onChange({ dutyPercent })}
        />
      ) : null}

      {action === 'beep' || action === 'tone' ? (
        <NumberField
          id={`device-frequency-${actionDomId}`}
          label={t('rules.deviceChannel.frequencyHz')}
          value={value.frequencyHz}
          placeholder={t('rules.deviceChannel.frequencyPlaceholder')}
          constraint={deviceChannelParameterConstraints.frequencyHz}
          rangeLabel={t('rules.deviceChannel.rangeHint', {
            min: deviceChannelParameterConstraints.frequencyHz.min,
            max: deviceChannelParameterConstraints.frequencyHz.max
          })}
          onChange={(frequencyHz) => onChange({ frequencyHz })}
        />
      ) : null}

      {action === 'set-color' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor={`device-color-${actionDomId}`}>
              {t('rules.deviceChannel.color')}
            </Label>
            <Input
              id={`device-color-${actionDomId}`}
              type="text"
              value={value.color ?? ''}
              placeholder={t('rules.deviceChannel.colorPlaceholder')}
              onChange={(event) => onChange({ color: event.target.value || null })}
            />
          </div>
          <NumberField
            id={`device-brightness-${actionDomId}`}
            label={t('rules.deviceChannel.brightnessPercent')}
            value={value.brightnessPercent}
            placeholder={t('rules.deviceChannel.brightnessPlaceholder')}
            constraint={deviceChannelParameterConstraints.brightnessPercent}
            rangeLabel={t('rules.deviceChannel.rangeHint', {
              min: deviceChannelParameterConstraints.brightnessPercent.min,
              max: deviceChannelParameterConstraints.brightnessPercent.max
            })}
            onChange={(brightnessPercent) => onChange({ brightnessPercent })}
          />
        </>
      ) : null}

      {action === 'pattern' ? (
        <div className="space-y-2">
          <Label htmlFor={`device-pattern-${actionDomId}`}>
            {t('rules.deviceChannel.pattern')}
          </Label>
          <Select
            value={value.pattern ?? 'notice'}
            onValueChange={(pattern) => onChange({ pattern: pattern as DeviceBuzzerPattern })}
          >
            <SelectTrigger id={`device-pattern-${actionDomId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['notice', 'success', 'warning', 'error', 'working'].map((pattern) => (
                <SelectItem key={pattern} value={pattern}>
                  {t(`devices.deviceExtension.pattern.${pattern}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {action === 'display-status' ? (
        <div className="space-y-3 md:col-span-2 xl:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {t('rules.display.variableHelp')}
            </p>
            <TemplateVariablePopover
              variables={TEMPLATE_VARIABLES}
              onInsert={insertDisplayVariableToken}
              onCopy={copyDisplayVariableToken}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`device-display-template-${actionDomId}`}>
                {t('rules.display.template')}
              </Label>
              <Select
                value={value.displayTemplateId ?? 'notice'}
                onValueChange={(displayTemplateId) =>
                  onChange({
                    displayTemplateId,
                    displayAccent: displayStatusForTemplate(displayTemplateId),
                    displayIcon: displayIconForTemplate(displayTemplateId),
                    displayStatus: displayStatusForTemplate(displayTemplateId),
                    displayTitleTemplate: '{{display.title}}',
                    displayMessageTemplate: '{{display.lines}}',
                    displayLinesTemplate: defaultLinesForDisplayTemplate(
                      displayTemplateId,
                      displaySizeClass
                    )
                  })
                }
              >
                <SelectTrigger id={`device-display-template-${actionDomId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_TEMPLATE_IDS.map((templateId) => (
                    <SelectItem key={templateId} value={templateId}>
                      {t(displayTemplateLabelKey(templateId))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberField
              id={`device-display-title-max-${actionDomId}`}
              label={t('rules.display.titleMaxChars')}
              value={normalizedDisplayTitleMaxChars}
              constraint={displayTitleConstraint}
              onChange={(displayTitleMaxChars) => onChange({ displayTitleMaxChars })}
            />
          </div>

          <button
            type="button"
            className="text-left text-xs font-medium text-primary hover:underline"
            onClick={() => setAdvancedDisplayEditing((current) => !current)}
          >
            {t('rules.display.advancedCustom')}
          </button>

          {advancedDisplayEditing ? (
            <div className="space-y-3 rounded-md border border-border/70 p-3">
              <p className="text-xs text-muted-foreground">
                {t('rules.display.asciiOnlyHint')}
              </p>
              <div className="space-y-2">
                <Label htmlFor={`device-display-title-${actionDomId}`}>
                  {t('rules.display.titleTemplate')}
                </Label>
                <Input
                  ref={displayTitleInputRef}
                  id={`device-display-title-${actionDomId}`}
                  value={value.displayTitleTemplate ?? ''}
                  onFocus={() => setActiveDisplayTemplateField('title')}
                  onChange={(event) => onChange({ displayTitleTemplate: event.target.value })}
                />
                {displayTitleValidationKey ? (
                  <p className="text-xs text-destructive">{t(displayTitleValidationKey)}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`device-display-message-${actionDomId}`}>
                  {t('rules.display.messageTemplate')}
                </Label>
                <Textarea
                  ref={displayMessageTextareaRef}
                  id={`device-display-message-${actionDomId}`}
                  value={value.displayMessageTemplate ?? ''}
                  rows={3}
                  onFocus={() => setActiveDisplayTemplateField('message')}
                  onChange={(event) => onChange({ displayMessageTemplate: event.target.value })}
                />
                {displayMessageValidationKey ? (
                  <p className="text-xs text-destructive">{t(displayMessageValidationKey)}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <NumberField
            id={`device-display-message-max-${actionDomId}`}
            label={t('rules.display.messageMaxChars')}
            value={normalizedDisplayMessageMaxChars}
            constraint={displayMessageConstraint}
            onChange={(displayMessageMaxChars) => onChange({ displayMessageMaxChars })}
          />
        </div>
      ) : null}
    </>
  );
}

function displayLimitConstraint(
  capabilityMaxChars: number | null | undefined,
  fallbackMaxChars: number
): NumericParameterConstraint {
  const max = capabilityMaxChars ?? fallbackMaxChars;
  return { min: 1, max, defaultValue: max };
}

function clampDisplayLimitValue(
  value: number | null | undefined,
  constraint: NumericParameterConstraint
): number | null {
  if (value === null || value === undefined) {
    return constraint.defaultValue;
  }
  return Math.min(constraint.max, Math.max(constraint.min, value));
}

function displayTemplateLabelKey(templateId: DisplayTemplateId): string {
  const suffix = templateId
    .split('-')
    .map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1))
    .join('');
  return `rules.display.templateOptions.${suffix}`;
}

type NumberFieldProps = {
  id: string;
  label: string;
  value?: number | null;
  constraint: NumericParameterConstraint;
  placeholder?: string;
  rangeLabel?: string;
  onChange: (value: number | null) => void;
};

function NumberField({
  id,
  label,
  value,
  constraint,
  placeholder,
  rangeLabel,
  onChange
}: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <DeferredNumberInput
        id={id}
        min={constraint.min}
        max={constraint.max}
        value={value}
        placeholder={placeholder}
        allowEmpty
        onCommit={(nextValue) => onChange(clampOptionalNumber(String(nextValue ?? ''), constraint))}
      />
      {rangeLabel ? <p className="text-xs text-muted-foreground">{rangeLabel}</p> : null}
    </div>
  );
}

function shouldShowDuration(action: DeviceChannelActionType): boolean {
  return ['activate', 'blink', 'breathe', 'pulse', 'set-duty', 'beep', 'tone', 'set-color'].includes(action);
}
