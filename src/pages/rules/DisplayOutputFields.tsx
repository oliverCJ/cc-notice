import { DeviceDisplayCapabilities, HardwareOutput } from '@/api/tauriApi';
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
import { DeferredNumberInput } from './DeferredNumberInput';

export type DisplayDeviceOption = {
  value: string;
  label: string;
  displayCapabilities?: DeviceDisplayCapabilities | null;
};

type DisplayOutputFieldsProps = {
  output: HardwareOutput;
  displayDeviceOptions: DisplayDeviceOption[];
  onChange: (output: HardwareOutput) => void;
};

export function DisplayOutputFields({
  output,
  displayDeviceOptions,
  onChange
}: DisplayOutputFieldsProps) {
  const t = useI18n();
  const [activeTemplateField, setActiveTemplateField] = useState<'title' | 'message'>('message');
  const [advancedDisplayEditing, setAdvancedDisplayEditing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedDisplayDevice = displayDeviceOptions.find(
    (device) => device.value === output.displayDeviceId
  );
  const displayTitleMax = selectedDisplayDevice?.displayCapabilities?.titleMaxChars ?? 39;
  const displayMessageMax = selectedDisplayDevice?.displayCapabilities?.messageMaxChars ?? 95;
  const displaySizeClass = selectedDisplayDevice?.displayCapabilities?.sizeClass ?? 'small';
  const normalizedDisplayTitleMaxChars = clampDisplayLimitValue(
    output.displayTitleMaxChars,
    displayTitleMax
  );
  const normalizedDisplayMessageMaxChars = clampDisplayLimitValue(
    output.displayMessageMaxChars,
    displayMessageMax
  );

  useEffect(() => {
    if (
      normalizedDisplayTitleMaxChars === output.displayTitleMaxChars &&
      normalizedDisplayMessageMaxChars === output.displayMessageMaxChars
    ) {
      return;
    }
    patch({
      displayTitleMaxChars: normalizedDisplayTitleMaxChars,
      displayMessageMaxChars: normalizedDisplayMessageMaxChars
    });
  }, [
    normalizedDisplayMessageMaxChars,
    normalizedDisplayTitleMaxChars,
    output.displayMessageMaxChars,
    output.displayTitleMaxChars
  ]);

  function patch(next: Partial<HardwareOutput>) {
    onChange({ ...output, ...next, type: 'display', channelActions: [] });
  }

  function updateDisplayDevice(displayDeviceId: string) {
    const nextDevice = displayDeviceOptions.find((device) => device.value === displayDeviceId);
    const nextSizeClass = nextDevice?.displayCapabilities?.sizeClass ?? 'small';
    patch({
      displayDeviceId,
      displayLinesTemplate: defaultLinesForDisplayTemplate(
        output.displayTemplateId ?? 'notice',
        nextSizeClass
      ),
      displayTitleMaxChars: Math.min(output.displayTitleMaxChars ?? 39, nextDevice?.displayCapabilities?.titleMaxChars ?? 39),
      displayMessageMaxChars: Math.min(output.displayMessageMaxChars ?? 95, nextDevice?.displayCapabilities?.messageMaxChars ?? 95)
    });
  }

  function updateDisplayTemplate(displayTemplateId: string) {
    patch({
      displayTemplateId,
      displayAccent: displayStatusForTemplate(displayTemplateId),
      displayIcon: displayIconForTemplate(displayTemplateId),
      displayStatus: displayStatusForTemplate(displayTemplateId),
      displayTitleTemplate: '{{display.title}}',
      displayMessageTemplate: '{{display.lines}}',
      displayLinesTemplate: defaultLinesForDisplayTemplate(displayTemplateId, displaySizeClass)
    });
  }

  function insertVariableToken(token: string) {
    if (activeTemplateField === 'title') {
      const result = insertTemplateToken(
        output.displayTitleTemplate ?? '',
        token,
        titleInputRef.current?.selectionStart,
        titleInputRef.current?.selectionEnd
      );
      patch({ displayTitleTemplate: result.value });
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.setSelectionRange(result.cursorPosition, result.cursorPosition);
      });
      return;
    }

    const result = insertTemplateToken(
      output.displayMessageTemplate ?? '',
      token,
      messageTextareaRef.current?.selectionStart,
      messageTextareaRef.current?.selectionEnd
    );
    patch({ displayMessageTemplate: result.value });
    requestAnimationFrame(() => {
      messageTextareaRef.current?.focus();
      messageTextareaRef.current?.setSelectionRange(result.cursorPosition, result.cursorPosition);
    });
  }

  function copyVariableToken(token: string) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(token);
    }
  }

  return (
    <div className="space-y-4 md:col-span-2 xl:col-span-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t('rules.display.variableHelp')}
        </p>
        <TemplateVariablePopover
          variables={TEMPLATE_VARIABLES}
          onInsert={insertVariableToken}
          onCopy={copyVariableToken}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="display-device">{t('rules.display.device')}</Label>
          <Select
            value={output.displayDeviceId ?? ''}
            onValueChange={updateDisplayDevice}
          >
            <SelectTrigger id="display-device">
              <SelectValue placeholder={t('rules.display.devicePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {displayDeviceOptions.map((device) => (
                <SelectItem key={device.value} value={device.value}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-template">{t('rules.display.template')}</Label>
          <Select
            value={output.displayTemplateId ?? 'notice'}
            onValueChange={updateDisplayTemplate}
          >
            <SelectTrigger id="display-template">
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
            <Label htmlFor="display-title-template">{t('rules.display.titleTemplate')}</Label>
            <Input
              ref={titleInputRef}
              id="display-title-template"
              value={output.displayTitleTemplate ?? ''}
              onFocus={() => setActiveTemplateField('title')}
              onChange={(event) => patch({ displayTitleTemplate: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-message-template">{t('rules.display.messageTemplate')}</Label>
            <Textarea
              ref={messageTextareaRef}
              id="display-message-template"
              value={output.displayMessageTemplate ?? ''}
              onFocus={() => setActiveTemplateField('message')}
              onChange={(event) => patch({ displayMessageTemplate: event.target.value })}
              rows={4}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="display-title-max">{t('rules.display.titleMaxChars')}</Label>
          <DeferredNumberInput
            id="display-title-max"
            min={1}
            max={displayTitleMax}
            value={normalizedDisplayTitleMaxChars}
            onCommit={(value) =>
              patch({
                displayTitleMaxChars: clampDisplayLimitValue(value, displayTitleMax)
              })
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="display-message-max">{t('rules.display.messageMaxChars')}</Label>
          <DeferredNumberInput
            id="display-message-max"
            min={1}
            max={displayMessageMax}
            value={normalizedDisplayMessageMaxChars}
            onCommit={(value) =>
              patch({
                displayMessageMaxChars: clampDisplayLimitValue(
                  value,
                  displayMessageMax
                )
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function clampDisplayLimitValue(value: number | null | undefined, max: number): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return max;
  }
  return Math.min(max, Math.max(1, Math.round(value)));
}

function displayTemplateLabelKey(templateId: DisplayTemplateId): string {
  const suffix = templateId
    .split('-')
    .map((part, index) => index === 0 ? part : part[0].toUpperCase() + part.slice(1))
    .join('');
  return `rules.display.templateOptions.${suffix}`;
}
