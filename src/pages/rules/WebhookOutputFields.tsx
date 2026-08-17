import { useRef } from 'react';
import { HardwareOutput } from '../../api/tauriApi';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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
  TEMPLATE_VARIABLES
} from './template-variables/templateVariables';
import { useI18n } from '@/i18n';
import { DeferredNumberInput } from './DeferredNumberInput';

type WebhookOutputFieldsProps = {
  internalEvent: string;
  output: HardwareOutput;
  onChange: (output: HardwareOutput) => void;
};

const httpMethods = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' }
];

export function WebhookOutputFields({
  internalEvent,
  output,
  onChange
}: WebhookOutputFieldsProps) {
  const t = useI18n();
  const { toast } = useToast();
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const method = output.webhookMethod ?? 'POST';
  const url = output.webhookUrl ?? '';
  const headers = output.webhookHeaders ?? '';
  const body = output.webhookBody ?? '';
  const bodyMaxChars = output.webhookBodyMaxChars ?? 8000;
  const supportsBody = method !== 'GET';

  function insertVariableToken(token: string) {
    const result = insertTemplateToken(
      body,
      token,
      bodyTextareaRef.current?.selectionStart,
      bodyTextareaRef.current?.selectionEnd
    );
    onChange({
      ...output,
      webhookBody: result.value
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
      title: t('rules.webhook.copiedVariable'),
      description: token
    });
  }

  return (
    <>
      {supportsBody && (
        <div className="flex items-start justify-between gap-3 md:col-span-2 xl:col-span-3">
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{t('rules.webhook.variableHelp')}</p>
            <p className="text-amber-700 dark:text-amber-300">
              {t('rules.webhook.sensitiveDataWarning')}
            </p>
          </div>
          <TemplateVariablePopover
            variables={TEMPLATE_VARIABLES}
            onInsert={insertVariableToken}
            onCopy={copyVariableToken}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`webhook-method-${internalEvent}`}>{t('rules.webhook.method')}</Label>
        <Select
          value={method}
          onValueChange={(value) =>
            onChange({
              ...output,
              webhookMethod: value
            })
          }
        >
          <SelectTrigger id={`webhook-method-${internalEvent}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {httpMethods.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`webhook-url-${internalEvent}`}>
          Webhook URL <span className="text-red-500">*</span>
        </Label>
        <Input
          id={`webhook-url-${internalEvent}`}
          type="url"
          placeholder="https://api.example.com/webhooks/ai-events"
          value={url}
          onChange={(event) =>
            onChange({
              ...output,
              webhookUrl: event.target.value
            })
          }
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`webhook-headers-${internalEvent}`}>
          {t('rules.webhook.headers')}
        </Label>
        <Textarea
          id={`webhook-headers-${internalEvent}`}
          placeholder={'{\n  "Authorization": "Bearer YOUR_TOKEN",\n  "Content-Type": "application/json"\n}'}
          value={headers}
          rows={4}
          onChange={(event) =>
            onChange({
              ...output,
              webhookHeaders: event.target.value
            })
          }
        />
      </div>
      {supportsBody && (
        <>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`webhook-body-${internalEvent}`}>
              {t('rules.webhook.body')}
            </Label>
            <Textarea
              ref={bodyTextareaRef}
              id={`webhook-body-${internalEvent}`}
              placeholder={'{\n  "source": "{{source}}",\n  "event": "{{event}}",\n  "internalEvent": "{{internalEvent}}",\n  "timestamp": "{{timestamp}}"\n}'}
              value={body}
              rows={4}
              onChange={(event) =>
                onChange({
                  ...output,
                  webhookBody: event.target.value
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`webhook-body-max-${internalEvent}`}>
              {t('rules.webhook.bodyMaxChars')}
            </Label>
            <DeferredNumberInput
              id={`webhook-body-max-${internalEvent}`}
              min={1}
              max={20000}
              value={bodyMaxChars}
              onCommit={(value) =>
                onChange({
                  ...output,
                  webhookBodyMaxChars: value ?? 1
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('rules.webhook.currentTemplate', { length: body.length, max: bodyMaxChars })}
            </p>
          </div>
        </>
      )}
    </>
  );
}
