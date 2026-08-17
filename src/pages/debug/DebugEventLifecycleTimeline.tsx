import { CheckCircle2, CircleDashed, Clock3, TriangleAlert, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { DebugOutputExecutionGroup } from './DebugOutputExecutionGroup';
import type {
  DebugEventLifecycleViewModel,
  DebugLifecycleStatus
} from './debugEventLifecycleViewModel';

type DebugEventLifecycleTimelineProps = {
  lifecycle: DebugEventLifecycleViewModel;
};

export function DebugEventLifecycleTimeline({ lifecycle }: DebugEventLifecycleTimelineProps) {
  const t = useI18n();

  return (
    <section className="rounded-md border p-3" data-testid="debug-lifecycle-timeline">
      <div className="space-y-3">
        {lifecycle.nodes.map((node, index) => (
          <article key={node.id} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <StatusIcon status={node.status} />
              {index < lifecycle.nodes.length - 1 && (
                <div className="mt-2 min-h-8 w-px flex-1 bg-border" />
              )}
            </div>
            <div className="min-w-0 rounded-md border bg-muted/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{t(node.titleKey)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(node.descriptionKey)}
                  </p>
                </div>
                <Badge variant={node.status === 'error' ? 'destructive' : 'outline'}>
                  {t(`debug.lifecycle.status.${node.status}`)}
                </Badge>
              </div>
              {node.facts.length > 0 && (
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {node.facts.map((fact) => (
                    <div key={`${node.id}-${fact.labelKey}-${fact.value}`} className="min-w-0">
                      <dt className="text-muted-foreground">{t(fact.labelKey)}</dt>
                      <dd
                        className={cn(
                          'break-all font-mono',
                          fact.tone === 'danger' && 'text-destructive',
                          fact.tone === 'muted' && 'text-muted-foreground'
                        )}
                      >
                        {fact.valueKind === 'i18nKey' ? t(fact.value) : fact.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {node.id === 'outputs' && (
                <DebugOutputExecutionGroup
                  outputGroups={node.outputGroups ?? []}
                  deviceResults={node.deviceResults ?? []}
                />
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: DebugLifecycleStatus }) {
  const className = 'h-5 w-5';
  if (status === 'success') {
    return <CheckCircle2 className={`${className} text-emerald-600`} aria-hidden />;
  }
  if (status === 'warning') {
    return <TriangleAlert className={`${className} text-amber-600`} aria-hidden />;
  }
  if (status === 'error') {
    return <XCircle className={`${className} text-destructive`} aria-hidden />;
  }
  if (status === 'pending') {
    return <Clock3 className={`${className} text-sky-600`} aria-hidden />;
  }
  return <CircleDashed className={`${className} text-muted-foreground`} aria-hidden />;
}
