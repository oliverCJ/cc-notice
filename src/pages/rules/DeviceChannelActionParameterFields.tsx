import {
  DeviceBuzzerPattern,
  DeviceChannelActionType,
  DeviceChannelRuleAction,
  DeviceDisplayCapabilities,
} from '../../api/tauriApi';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { DisplayFacePreview } from '@/components/display/DisplayFacePreview';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import {
  DISPLAY_FACE_TEMPLATE_IDS,
  displayFaceTemplateLabelKey
} from '@/domain/display/displayFaceTemplates';
import { validateAsciiDisplayTemplate } from './displayTemplateValidation';
import { DeferredNumberInput } from './DeferredNumberInput';
import {
  CustomFaceLibraryEntries,
  filterCustomFaceGroupSummariesForDisplay,
  resolveCustomFaceGroupFaceCount
} from '@/domain/customFaces/library';
import { CustomFaceAnimatedPreview } from '../custom-face-editor/CustomFaceAnimatedPreview';
import { defaultDisplayFaceTemplateId } from '@/domain/display/displayFaceTemplates';
import { editorProfileFromId } from '@/domain/customFaces/editor/profile';
import { RefreshCw } from 'lucide-react';

type DeviceChannelActionParameterFieldsProps = {
  action?: DeviceChannelActionType | null;
  actionDomId: string;
  value: DeviceChannelRuleAction;
  displayCapabilities?: DeviceDisplayCapabilities | null;
  customFaceLibrary?: CustomFaceLibraryEntries | null;
  customFaceLibraryLoading?: boolean;
  onReloadCustomFaceLibrary?: () => void;
  onChange: (patch: Partial<DeviceChannelRuleAction>) => void;
};

export function DeviceChannelActionParameterFields({
  action,
  actionDomId,
  value,
  displayCapabilities,
  customFaceLibrary,
  customFaceLibraryLoading = false,
  onReloadCustomFaceLibrary,
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
  const customFaceGroups = useMemo(() => {
    if (action !== 'display-face' || !customFaceLibrary) {
      return [];
    }
    return filterCustomFaceGroupSummariesForDisplay(customFaceLibrary.groups, {
      display: displayCapabilities ?? null
    });
  }, [action, customFaceLibrary, displayCapabilities]);
  const selectedCustomFaceGroupId =
    value.customFaceGroupId?.trim() ?? customFaceGroups[0]?.groupId ?? '';
  const selectedCustomFaceGroup =
    selectedCustomFaceGroupId && customFaceLibrary?.groupById[selectedCustomFaceGroupId]
      ? customFaceLibrary.groupById[selectedCustomFaceGroupId]
      : null;
  const selectedCustomFace =
    selectedCustomFaceGroup?.faces.find((face) => face.faceId === value.customFaceId) ??
    selectedCustomFaceGroup?.faces.find((face) => face.faceId === selectedCustomFaceGroup.defaultFaceId) ??
    selectedCustomFaceGroup?.faces[0] ??
    null;
  const customFaceSource =
    value.customFaceGroupId?.trim() && value.customFaceId?.trim() ? 'custom' : 'builtin';

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

  useEffect(() => {
    if (action !== 'display-face' || value.displayFaceIntensity === 'standard') {
      return;
    }
    onChange({ displayFaceIntensity: 'standard' });
  }, [action, onChange, value.displayFaceIntensity]);

  useEffect(() => {
    if (action !== 'display-face' || value.displayFaceTemplateId?.trim()) {
      return;
    }
    onChange({ displayFaceTemplateId: defaultDisplayFaceTemplateId });
  }, [action, onChange, value.displayFaceTemplateId]);

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

      {action === 'display-face' ? (
        <div className="grid gap-3 md:col-span-2 xl:col-span-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`device-display-face-source-${actionDomId}`}>
                {t('rules.displayFace.source')}
              </Label>
              {onReloadCustomFaceLibrary ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={customFaceLibraryLoading}
                  title={t('rules.displayFace.reloadCustomFaces')}
                  aria-label={t('rules.displayFace.reloadCustomFaces')}
                  onClick={onReloadCustomFaceLibrary}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${customFaceLibraryLoading ? 'animate-spin' : ''}`} />
                  {t('rules.displayFace.reloadCustomFaces')}
                </Button>
              ) : null}
            </div>
            <Select
              value={customFaceSource}
              onValueChange={(source) => {
                if (source === 'custom') {
                  const nextGroupId = selectedCustomFaceGroupId || customFaceGroups[0]?.groupId || '';
                  const nextGroup =
                    nextGroupId && customFaceLibrary?.groupById[nextGroupId]
                      ? customFaceLibrary.groupById[nextGroupId]
                      : null;
                  const nextFaceId =
                    nextGroup?.faces.find((face) => face.faceId === value.customFaceId)?.faceId ??
                    nextGroup?.defaultFaceId ??
                    nextGroup?.faces[0]?.faceId ??
                    '';
                  onChange({
                    displayFaceTemplateId: value.displayFaceTemplateId ?? defaultDisplayFaceTemplateId,
                    displayFaceIntensity: value.displayFaceIntensity ?? 'standard',
                    customFaceGroupId: nextGroupId || null,
                    customFaceId: nextFaceId || null
                  });
                  return;
                }
                onChange({
                  displayFaceTemplateId: defaultDisplayFaceTemplateId,
                  displayFaceIntensity: 'standard',
                  customFaceGroupId: null,
                  customFaceId: null
                });
              }}
            >
              <SelectTrigger id={`device-display-face-source-${actionDomId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="builtin">{t('rules.displayFace.sourceBuiltin')}</SelectItem>
                <SelectItem
                  value="custom"
                  disabled={!customFaceGroups.length && !value.customFaceGroupId?.trim()}
                >
                  {t('rules.displayFace.sourceCustom')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customFaceSource === 'builtin' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`device-display-face-template-${actionDomId}`}>
                  {t('rules.displayFace.template')}
                </Label>
                <Select
                  value={value.displayFaceTemplateId ?? defaultDisplayFaceTemplateId}
                  onValueChange={(displayFaceTemplateId) =>
                    onChange({ displayFaceTemplateId })
                  }
                >
                  <SelectTrigger id={`device-display-face-template-${actionDomId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPLAY_FACE_TEMPLATE_IDS.filter((templateId) =>
                      displayCapabilities?.faceTemplates?.length
                        ? displayCapabilities.faceTemplates.includes(templateId)
                        : true
                    ).map((templateId) => (
                      <SelectItem key={templateId} value={templateId}>
                        {t(displayFaceTemplateLabelKey(templateId))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 items-center justify-center">
                <DisplayFacePreview
                  className="w-full"
                  displayCapabilities={displayCapabilities}
                  templateId={value.displayFaceTemplateId}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`device-display-face-group-${actionDomId}`}>
                  {t('rules.displayFace.customGroup')}
                </Label>
                <Select
                  value={selectedCustomFaceGroupId}
                  onValueChange={(groupId) => {
                    const nextGroup = customFaceLibrary?.groupById[groupId] ?? null;
                    const nextFaceId =
                      nextGroup?.faces.find((face) => face.faceId === nextGroup.defaultFaceId)?.faceId ??
                      nextGroup?.faces[0]?.faceId ??
                      '';
                    onChange({
                      displayFaceTemplateId: value.displayFaceTemplateId ?? defaultDisplayFaceTemplateId,
                      displayFaceIntensity: value.displayFaceIntensity ?? 'standard',
                      customFaceGroupId: groupId,
                      customFaceId: nextFaceId || null
                    });
                  }}
                  disabled={!customFaceGroups.length}
                >
                  <SelectTrigger id={`device-display-face-group-${actionDomId}`}>
                    <SelectValue placeholder={t('rules.displayFace.customGroupPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {customFaceGroups.map((group) => (
                      <SelectItem key={group.groupId} value={group.groupId}>
                        {group.name} · {t('rules.displayFace.customFaceCount', { count: resolveCustomFaceGroupFaceCount(group) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`device-display-face-custom-${actionDomId}`}>
                  {t('rules.displayFace.customFace')}
                </Label>
                <Select
                  value={selectedCustomFace?.faceId ?? ''}
                  onValueChange={(faceId) =>
                    onChange({
                      displayFaceTemplateId: value.displayFaceTemplateId ?? defaultDisplayFaceTemplateId,
                      displayFaceIntensity: value.displayFaceIntensity ?? 'standard',
                      customFaceGroupId: selectedCustomFaceGroupId || null,
                      customFaceId: faceId || null
                    })
                  }
                  disabled={!selectedCustomFaceGroup?.faces.length}
                >
                  <SelectTrigger id={`device-display-face-custom-${actionDomId}`}>
                    <SelectValue placeholder={t('rules.displayFace.customFacePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedCustomFaceGroup?.faces ?? []).map((face) => (
                      <SelectItem key={face.faceId} value={face.faceId}>
                        {face.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {customFaceSource === 'custom' ? (
            selectedCustomFace && selectedCustomFaceGroup ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t('rules.displayFace.customPreview')}
                </p>
                <div className="flex min-w-0 items-center justify-center">
                  {(() => {
                    const profile = editorProfileFromId(selectedCustomFaceGroup.displayProfileId);
                    if (!profile) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          {t('rules.displayFace.customPreviewUnavailable')}
                        </p>
                      );
                    }
                    return (
                      <CustomFaceAnimatedPreview
                        width={profile.width}
                        height={profile.height}
                        frames={selectedCustomFace.frames}
                        ariaLabel={t('rules.displayFace.customPreview', {
                          name: selectedCustomFace.name
                        })}
                        className="w-full max-w-[280px]"
                      />
                    );
                  })()}
                </div>
              </div>
            ) : (
                <p className="text-xs text-muted-foreground">
                  {t('rules.displayFace.customPreviewUnavailable')}
                </p>
            )
          ) : null}
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
  return [
    'activate',
    'blink',
    'breathe',
    'pulse',
    'set-duty',
    'beep',
    'tone',
    'set-color',
    'display-face'
  ].includes(action);
}
