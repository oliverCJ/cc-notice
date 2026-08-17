import { useRef, useState } from 'react';
import { HardwareOutput } from '../../api/tauriApi';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TemplateVariablePopover } from './template-variables/TemplateVariablePopover';
import {
  insertTemplateToken,
  createTemplatePreviewValues,
  renderTemplatePreview,
  TEMPLATE_VARIABLES
} from './template-variables/templateVariables';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { DeferredNumberInput } from './DeferredNumberInput';

type SystemNotificationOutputFieldsProps = {
  internalEvent: string;
  output: HardwareOutput;
  onChange: (output: HardwareOutput) => void;
};

const notificationLevels = [
  { value: 'info', labelKey: 'rules.notification.levels.info' },
  { value: 'warning', labelKey: 'rules.notification.levels.warning' },
  { value: 'error', labelKey: 'rules.notification.levels.error' },
  { value: 'success', labelKey: 'rules.notification.levels.success' }
];

const notificationSounds = [
  { value: 'default', labelKey: 'rules.notification.sounds.default' }
] as const;

type NotificationSoundOption = (typeof notificationSounds)[number];

function notificationSoundLabel(item: NotificationSoundOption, t: ReturnType<typeof useI18n>) {
  return t(item.labelKey);
}

export function SystemNotificationOutputFields({
  internalEvent,
  output,
  onChange
}: SystemNotificationOutputFieldsProps) {
  const t = useI18n();
  const { toast } = useToast();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTemplateField, setActiveTemplateField] = useState<'title' | 'body'>('body');
  const level = output.notificationLevel ?? 'info';
  const title = output.notificationTitle ?? '';
  const body = output.notificationBody ?? '';
  const titleMaxChars = output.notificationTitleMaxChars ?? 80;
  const bodyMaxChars = output.notificationBodyMaxChars ?? 300;
  const throttleSeconds = output.notificationThrottleSeconds ?? 30;
  const notificationSound = output.notificationSound ?? 'default';
  const previewValues = createTemplatePreviewValues(t);
  const previewTitle = renderTemplatePreview(title, previewValues);
  const previewBody = renderTemplatePreview(body, previewValues);

  function insertVariableToken(token: string) {
    if (activeTemplateField === 'title') {
      const result = insertTemplateToken(
        title,
        token,
        titleInputRef.current?.selectionStart,
        titleInputRef.current?.selectionEnd
      );
      onChange({
        ...output,
        notificationTitle: result.value
      });
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.setSelectionRange(result.cursorPosition, result.cursorPosition);
      });
      return;
    }

    const result = insertTemplateToken(
      body,
      token,
      bodyTextareaRef.current?.selectionStart,
      bodyTextareaRef.current?.selectionEnd
    );
    onChange({
      ...output,
      notificationBody: result.value
    });
    requestAnimationFrame(() => {
      bodyTextareaRef.current?.focus();
      bodyTextareaRef.current?.setSelectionRange(result.cursorPosition, result.cursorPosition);
    });
  }

  function copyVariableToken(token: string) {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(token);
    }
    toast({
      title: t('rules.notification.copiedVariable'),
      description: token
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 md:col-span-2 xl:col-span-3">
        <p className="text-xs text-muted-foreground">
          {t('rules.notification.variableHelp')}
        </p>
        <TemplateVariablePopover
          variables={TEMPLATE_VARIABLES}
          onInsert={insertVariableToken}
          onCopy={copyVariableToken}
        />
      </div>
      <Alert className="flex items-center gap-2 border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200 md:col-span-2 xl:col-span-3 [&>svg]:static [&>svg~*]:pl-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
        <AlertDescription className="text-xs leading-5">
          {t('rules.notification.focusWarning')}
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <Label htmlFor={`notification-level-${internalEvent}`}>{t('rules.notification.level')}</Label>
        <Select
          value={level}
          onValueChange={(value) =>
            onChange({
              ...output,
              notificationLevel: value
            })
          }
        >
          <SelectTrigger id={`notification-level-${internalEvent}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {notificationLevels.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {t(item.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`notification-sound-${internalEvent}`}>{t('rules.notification.sound')}</Label>
        <Select
          value={notificationSound}
          onValueChange={(value) =>
            onChange({
              ...output,
              notificationSound: value
            })
          }
        >
          <SelectTrigger id={`notification-sound-${internalEvent}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {notificationSounds.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {notificationSoundLabel(item, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t('rules.notification.macosSoundHint')}
        </p>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`notification-title-${internalEvent}`}>{t('rules.notification.title')}</Label>
        <Input
          ref={titleInputRef}
          id={`notification-title-${internalEvent}`}
          type="text"
          placeholder={t('rules.notification.titlePlaceholder')}
          value={title}
          onFocus={() => setActiveTemplateField('title')}
          onChange={(event) =>
            onChange({
              ...output,
              notificationTitle: event.target.value
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`notification-title-max-${internalEvent}`}>
          {t('rules.notification.titleMaxChars')}
        </Label>
        <DeferredNumberInput
          id={`notification-title-max-${internalEvent}`}
          min={1}
          max={500}
          value={titleMaxChars}
          onCommit={(value) =>
            onChange({
              ...output,
              notificationTitleMaxChars: value ?? 1
            })
          }
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`notification-body-${internalEvent}`}>{t('rules.notification.body')}</Label>
        <Textarea
          ref={bodyTextareaRef}
          id={`notification-body-${internalEvent}`}
          placeholder={t('rules.notification.bodyPlaceholder')}
          value={body}
          rows={3}
          onFocus={() => setActiveTemplateField('body')}
          onChange={(event) =>
            onChange({
              ...output,
              notificationBody: event.target.value
            })
          }
        />
      </div>
      <div className="space-y-2 md:col-span-2 xl:col-span-3">
        <Label>{t('rules.notification.preview')}</Label>
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-sm font-medium">
            {previewTitle || t('rules.notification.unsetTitle')}
          </div>
          <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {previewBody || t('rules.notification.unsetBody')}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {t('rules.notification.previewCount', {
              titleLength: title.length,
              titleMax: titleMaxChars,
              bodyLength: body.length,
              bodyMax: bodyMaxChars
            })}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`notification-body-max-${internalEvent}`}>
          {t('rules.notification.bodyMaxChars')}
        </Label>
        <DeferredNumberInput
          id={`notification-body-max-${internalEvent}`}
          min={1}
          max={2000}
          value={bodyMaxChars}
          onCommit={(value) =>
            onChange({
              ...output,
              notificationBodyMaxChars: value ?? 1
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`notification-throttle-${internalEvent}`}>
          {t('rules.notification.throttleSeconds')}
        </Label>
        <DeferredNumberInput
          id={`notification-throttle-${internalEvent}`}
          min={0}
          max={3600}
          value={throttleSeconds}
          onCommit={(value) =>
            onChange({
              ...output,
              notificationThrottleSeconds: value ?? 0
            })
          }
        />
      </div>
    </>
  );
}
