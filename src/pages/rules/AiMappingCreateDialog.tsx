import { useMemo, useState } from 'react';
import {
  AiEventMapping,
  EnabledHookEvent,
  HookEventDefinition,
  InternalEventDefinition
} from '../../api/tauriApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { AiToolId, aiTools } from '../../state/appStore';
import { aiMappingEventInUse } from './ruleProfileUtils';
import { useI18n } from '@/i18n';
import { hookEventDescription, hookEventTitle } from '@/lib/hookEventText';
import { internalEventScenario, internalEventTitle } from './internalEventText';

type AiMappingCreateDialogProps = {
  source: AiToolId;
  mappings: AiEventMapping[];
  enabledHookEvents: EnabledHookEvent[];
  hookCatalog: HookEventDefinition[];
  internalEvents: InternalEventDefinition[];
  onCancel: () => void;
  onCreate: (event: HookEventDefinition, internalEvent: string) => void;
};

export function AiMappingCreateDialog({
  source,
  mappings,
  enabledHookEvents,
  hookCatalog,
  internalEvents,
  onCancel,
  onCreate
}: AiMappingCreateDialogProps) {
  const t = useI18n();
  const enabledHookEventKeys = useMemo(
    () => new Set(enabledHookEvents.map((event) => `${event.source}:${event.event}`)),
    [enabledHookEvents]
  );
  const visibleHookEvents = hookCatalog.filter(
    (event) => event.source === source && enabledHookEventKeys.has(`${event.source}:${event.event}`)
  );
  const availableHookEvents = useMemo(
    () =>
      visibleHookEvents.filter(
        (event) => !aiMappingEventInUse(mappings, event.source, event.event)
      ),
    [mappings, visibleHookEvents]
  );
  const [selectedEvent, setSelectedEvent] = useState(availableHookEvents[0]?.event ?? '');
  const [selectedInternalEvent, setSelectedInternalEvent] = useState(
    internalEvents[0]?.id ?? 'agent.running'
  );
  const toolName = aiTools.find((tool) => tool.id === source)?.name ?? source;
  const hookEvent = availableHookEvents.find((event) => event.event === selectedEvent);
  const selectedHookEventInfo = availableHookEvents.find((e) => e.event === selectedEvent);
  const selectedInternalEventInfo = internalEvents.find((e) => e.id === selectedInternalEvent);
  const canSave = Boolean(hookEvent && selectedInternalEvent);

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('rules.aiMapping.createTitle', { toolName })}</DialogTitle>
          <DialogDescription>{t('rules.aiMapping.createDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {availableHookEvents.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{t('rules.aiMapping.allConfigured')}</AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{t('rules.aiMapping.enabledHookSourceHint')}</AlertDescription>
              </Alert>

              {/* Hook 事件选择 */}
              <div className="space-y-2">
                <Label htmlFor="hook-event">{t('rules.aiMapping.hookEvent')}</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger id="hook-event">
                    <SelectValue placeholder={t('rules.aiMapping.hookEventPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableHookEvents.map((event) => (
                      <SelectItem key={`${event.source}-${event.event}`} value={event.event}>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold">{event.event}</span>
                          <span className="text-xs text-muted-foreground">
                            {hookEventTitle(event, t)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedHookEventInfo && (
                  <p className="text-sm text-muted-foreground">
                    {hookEventDescription(selectedHookEventInfo, t)}
                  </p>
                )}
              </div>

              {/* 内部事件选择 */}
              <div className="space-y-2">
                <Label htmlFor="internal-event">{t('rules.aiMapping.internalEvent')}</Label>
                <Select value={selectedInternalEvent} onValueChange={setSelectedInternalEvent}>
                  <SelectTrigger id="internal-event">
                    <SelectValue placeholder={t('rules.aiMapping.internalEventPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {internalEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold">{event.id}</span>
                          <span className="text-xs text-muted-foreground">
                            {internalEventTitle(event, t)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedInternalEventInfo && (
                  <p className="text-sm text-muted-foreground">
                    {t('rules.aiMapping.scenario', {
                      scenario: internalEventScenario(selectedInternalEventInfo, t)
                    })}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => {
              if (hookEvent) {
                onCreate(hookEvent, selectedInternalEvent);
              }
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
