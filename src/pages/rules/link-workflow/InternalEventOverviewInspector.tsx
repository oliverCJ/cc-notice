import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { LinkWorkflowInternalEventSummary, LinkWorkflowViewModel } from './types';

type InternalEventOverviewInspectorProps = {
  viewModel: LinkWorkflowViewModel;
};

export function InternalEventOverviewInspector({
  viewModel
}: InternalEventOverviewInspectorProps) {
  const t = useI18n();
  const [openReferenceEventId, setOpenReferenceEventId] = useState<string | null>(null);

  return (
    <aside className="rounded-xl border bg-background p-4">
      <div className="mb-4">
        <h3 className="font-semibold">{t('rules.linkWorkflow.inspector.internalReferences')}</h3>
      </div>
      <div className="space-y-3">
        {viewModel.internalEventOverview.events.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            {t('rules.linkWorkflow.inspector.noInternalReferences')}
          </div>
        ) : (
          viewModel.internalEventOverview.events.map((event) => (
            <div key={event.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium">{event.id}</p>
                  {event.title && (
                    <p className="truncate text-xs text-muted-foreground">{event.title}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('rules.linkWorkflow.inspector.referenceCount', {
                      count: event.mappedHookCount
                    })}
                  </p>
                </div>
                <HookReferenceMenu
                  event={event}
                  open={openReferenceEventId === event.id}
                  onToggle={() =>
                    setOpenReferenceEventId(openReferenceEventId === event.id ? null : event.id)
                  }
                />
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function HookReferenceMenu({
  event,
  open,
  onToggle
}: {
  event: LinkWorkflowInternalEventSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useI18n();
  if (event.hookReferences.length === 0) {
    return null;
  }

  return (
    <div className="relative shrink-0">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={t('rules.linkWorkflow.inspector.viewHookReferences', {
          event: event.id
        })}
        className="h-8 w-8"
        onClick={onToggle}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('rules.linkWorkflow.inspector.hookReferences')}
          </p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {event.hookReferences.map((reference) => (
              <p
                key={`${reference.source}-${reference.event}`}
                className="truncate rounded-sm px-2 py-1 text-sm"
              >
                {reference.sourceTitle} · {reference.event}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
