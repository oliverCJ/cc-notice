import { useState } from 'react';
import {
  CreateCustomInternalEventRequest,
  InternalEventDefinition,
  UpdateCustomInternalEventRequest
} from '../../api/tauriApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { internalEventScenario, internalEventTitle } from './internalEventText';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CustomInternalEventDialog } from './CustomInternalEventDialog';
import { CustomInternalEventDeleteDialog } from './CustomInternalEventDeleteDialog';

type InternalEventCatalogSectionProps = {
  internalEvents: InternalEventDefinition[];
  customEventError?: string;
  onClearCustomEventError?: () => void;
  onCreateCustomEvent?: (request: CreateCustomInternalEventRequest) => void | Promise<void>;
  onUpdateCustomEvent?: (request: UpdateCustomInternalEventRequest) => void | Promise<void>;
  onDeleteCustomEvent?: (eventId: string) => void | Promise<void>;
};

export function InternalEventCatalogSection({
  internalEvents,
  customEventError,
  onClearCustomEventError,
  onCreateCustomEvent,
  onUpdateCustomEvent,
  onDeleteCustomEvent
}: InternalEventCatalogSectionProps) {
  const t = useI18n();
  const [dialogState, setDialogState] = useState<
    | { type: 'none' }
    | { type: 'create' }
    | { type: 'edit'; event: InternalEventDefinition }
    | { type: 'delete'; event: InternalEventDefinition }
  >({ type: 'none' });

  async function createCustomEvent(request: CreateCustomInternalEventRequest) {
    await onCreateCustomEvent?.(request);
    setDialogState({ type: 'none' });
  }

  async function updateCustomEvent(request: UpdateCustomInternalEventRequest) {
    await onUpdateCustomEvent?.(request);
    setDialogState({ type: 'none' });
  }

  async function deleteCustomEvent(eventId: string) {
    await onDeleteCustomEvent?.(eventId);
    setDialogState({ type: 'none' });
  }

  function openDialog(nextDialogState: Exclude<typeof dialogState, { type: 'none' }>) {
    onClearCustomEventError?.();
    setDialogState(nextDialogState);
  }

  function closeDialog() {
    onClearCustomEventError?.();
    setDialogState({ type: 'none' });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t('rules.internalCatalog.title')}</CardTitle>
            <CardDescription className="mt-1.5">
              {t('rules.internalCatalog.description')}
            </CardDescription>
          </div>
          {onCreateCustomEvent && (
            <Button size="sm" onClick={() => openDialog({ type: 'create' })}>
              <Plus className="mr-2 h-4 w-4" />
              {t('rules.internalCatalog.addCustom')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {internalEvents.map((event) => (
            <div
              key={event.id}
              className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[1.3fr_1fr_1.4fr_auto]"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <code className="font-mono text-sm font-medium">{event.id}</code>
                <Badge variant={event.builtIn ? 'secondary' : 'outline'}>
                  {event.builtIn
                    ? t('rules.internalCatalog.builtIn')
                    : t('rules.internalCatalog.custom')}
                </Badge>
              </div>
              <span className="text-sm">{internalEventTitle(event, t)}</span>
              <span className="text-sm text-muted-foreground">
                {internalEventScenario(event, t)}
              </span>
              <div className="flex items-center gap-2">
                {!event.builtIn && onUpdateCustomEvent && (
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid={`custom-internal-event-edit-${event.id}`}
                    aria-label={t('rules.internalCatalog.editCustom')}
                    onClick={() => openDialog({ type: 'edit', event })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {!event.builtIn && onDeleteCustomEvent && (
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid={`custom-internal-event-delete-${event.id}`}
                    aria-label={t('rules.internalCatalog.deleteCustom')}
                    onClick={() => openDialog({ type: 'delete', event })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CustomInternalEventDialog
        mode={dialogState.type === 'edit' ? 'edit' : 'create'}
        event={dialogState.type === 'edit' ? dialogState.event : null}
        open={dialogState.type === 'create' || dialogState.type === 'edit'}
        error={customEventError}
        onClose={closeDialog}
        onCreate={createCustomEvent}
        onUpdate={updateCustomEvent}
      />
      <CustomInternalEventDeleteDialog
        event={dialogState.type === 'delete' ? dialogState.event : null}
        error={customEventError}
        onClose={closeDialog}
        onConfirm={deleteCustomEvent}
      />
    </Card>
  );
}
