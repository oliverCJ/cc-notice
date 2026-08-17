import { useEffect, useState } from 'react';
import { InternalEventDefinition } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useI18n } from '@/i18n';
import { internalEventScenario, internalEventTitle } from '../internalEventText';
import { LinkWorkflowHookSummary } from './types';

type HookMappingDetailDialogProps = {
  hook: LinkWorkflowHookSummary;
  sourceTitle: string;
  internalEvents: InternalEventDefinition[];
  open: boolean;
  onCancel: () => void;
  onSave: (internalEvent: string) => void;
};

export function HookMappingDetailDialog({
  hook,
  sourceTitle,
  internalEvents,
  open,
  onCancel,
  onSave
}: HookMappingDetailDialogProps) {
  const t = useI18n();
  const initialInternalEvent = hook.mappedInternalEvent ?? internalEvents[0]?.id ?? '';
  const [selectedInternalEvent, setSelectedInternalEvent] = useState(initialInternalEvent);
  const selectedEvent = internalEvents.find((event) => event.id === selectedInternalEvent);

  useEffect(() => {
    if (open) {
      setSelectedInternalEvent(hook.mappedInternalEvent ?? internalEvents[0]?.id ?? '');
    }
  }, [hook, internalEvents, open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {t(
              hook.mappedInternalEvent
                ? 'rules.linkWorkflow.inspector.editHookMappingTitle'
                : 'rules.linkWorkflow.inspector.configureHookMappingTitle'
            )}
          </DialogTitle>
          <DialogDescription>
            {t('rules.linkWorkflow.inspector.hookMappingDetailDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t('rules.linkWorkflow.inspector.currentAiTool')}
              </p>
              <p className="truncate text-sm font-medium">{sourceTitle}</p>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t('rules.linkWorkflow.inspector.currentHookEvent')}
              </p>
              <p className="truncate font-mono text-sm font-medium">{hook.event}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workflow-hook-internal-event">
              {t('rules.aiMapping.internalEvent')}
            </Label>
            <Select value={selectedInternalEvent} onValueChange={setSelectedInternalEvent}>
              <SelectTrigger id="workflow-hook-internal-event">
                <SelectValue placeholder={t('rules.aiMapping.internalEventPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {internalEvents.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    <div className="flex min-w-0 flex-col">
                      <span className="font-mono text-sm font-semibold">{event.id}</span>
                      <span className="text-xs text-muted-foreground">
                        {internalEventTitle(event, t)} · {internalEventScenario(event, t)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEvent && (
              <p className="text-sm text-muted-foreground">
                {t('rules.linkWorkflow.inspector.internalEventSelectionHint', {
                  title: internalEventTitle(selectedEvent, t),
                  scenario: internalEventScenario(selectedEvent, t)
                })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!selectedInternalEvent} onClick={() => onSave(selectedInternalEvent)}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
