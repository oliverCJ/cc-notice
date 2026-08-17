import { useEffect, useMemo, useState } from 'react';
import {
  CreateCustomInternalEventRequest,
  InternalEventDefinition,
  UpdateCustomInternalEventRequest
} from '@/api/tauriApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n';
import {
  buildCustomInternalEventId,
  CustomInternalEventPrefixValidation,
  CustomInternalEventPrefixValidationReason,
  validateCustomInternalEventPrefix
} from './customInternalEventValidation';

type CustomInternalEventDialogProps = {
  mode: 'create' | 'edit';
  event?: InternalEventDefinition | null;
  open: boolean;
  error?: string;
  onClose: () => void;
  onCreate: (request: CreateCustomInternalEventRequest) => void | Promise<void>;
  onUpdate: (request: UpdateCustomInternalEventRequest) => void | Promise<void>;
};

export function CustomInternalEventDialog({
  mode,
  event,
  open,
  error,
  onClose,
  onCreate,
  onUpdate
}: CustomInternalEventDialogProps) {
  const t = useI18n();
  const [idPrefix, setIdPrefix] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scenario, setScenario] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setIdPrefix('');
    setTitle(event?.title ?? '');
    setDescription(event?.description ?? '');
    setScenario(event?.scenario ?? '');
  }, [event, open]);

  const prefixValidation = useMemo<CustomInternalEventPrefixValidation>(
    () => (mode === 'create' ? validateCustomInternalEventPrefix(idPrefix) : { valid: true }),
    [idPrefix, mode]
  );
  const titleValid = title.trim().length > 0 && title.trim().length <= 40;
  const descriptionValid = description.trim().length <= 160;
  const scenarioValid = scenario.trim().length <= 160;
  const canSave = prefixValidation.valid && titleValid && descriptionValid && scenarioValid;
  const finalId = mode === 'create' && idPrefix.trim() ? buildCustomInternalEventId(idPrefix) : '';

  function submit() {
    if (!canSave) {
      return;
    }
    if (mode === 'create') {
      void Promise.resolve(
        onCreate({
          idPrefix: idPrefix.trim(),
          title: title.trim(),
          description: description.trim(),
          scenario: scenario.trim()
        })
      ).catch(() => undefined);
      return;
    }
    if (event) {
      void Promise.resolve(
        onUpdate({
          id: event.id,
          title: title.trim(),
          description: description.trim(),
          scenario: scenario.trim()
        })
      ).catch(() => undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('rules.internalCatalog.createDialogTitle')
              : t('rules.internalCatalog.editDialogTitle')}
          </DialogTitle>
          <DialogDescription>{t('rules.internalCatalog.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode === 'create' ? (
            <div className="space-y-2">
              <Label htmlFor="custom-internal-event-prefix">
                {t('rules.internalCatalog.idPrefix')}
              </Label>
              <Input
                id="custom-internal-event-prefix"
                value={idPrefix}
                onChange={(event) => setIdPrefix(event.target.value)}
                placeholder="review.started"
              />
              {finalId && (
                <p className="text-xs text-muted-foreground">
                  {t('rules.internalCatalog.finalId', { id: finalId })}
                </p>
              )}
              {!prefixValidation.valid && idPrefix.trim() && (
                <p className="text-xs text-destructive">
                  {prefixErrorText(prefixValidation.reason, t)}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('rules.internalCatalog.eventId')}</Label>
              <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">
                {event?.id}
              </code>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="custom-internal-event-title">
              {t('rules.internalCatalog.eventTitle')}
            </Label>
            <Input
              id="custom-internal-event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={40}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-internal-event-description">
              {t('rules.internalCatalog.eventDescription')}
            </Label>
            <Textarea
              id="custom-internal-event-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={160}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-internal-event-scenario">
              {t('rules.internalCatalog.eventScenario')}
            </Label>
            <Textarea
              id="custom-internal-event-scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
              maxLength={160}
              rows={3}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!canSave} onClick={submit}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function prefixErrorText(
  reason: CustomInternalEventPrefixValidationReason,
  t: ReturnType<typeof useI18n>
) {
  return t(`rules.internalCatalog.prefixErrors.${reason}`);
}
