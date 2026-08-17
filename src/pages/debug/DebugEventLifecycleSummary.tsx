import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import type { DebugLifecycleSummary } from './debugEventLifecycleViewModel';

type DebugEventLifecycleSummaryProps = {
  summary: DebugLifecycleSummary;
};

export function DebugEventLifecycleSummary({ summary }: DebugEventLifecycleSummaryProps) {
  const t = useI18n();
  const elapsed =
    summary.totalElapsedMs === null
      ? t('debug.lifecycle.notRecorded')
      : `${summary.totalElapsedMs} ms`;

  return (
    <section className="rounded-md border bg-muted/20 p-3" data-testid="debug-lifecycle-summary">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('debug.lifecycle.summaryTitle')}</h3>
        <Badge variant={summary.result === 'accepted' ? 'outline' : 'destructive'}>
          {summary.result}
        </Badge>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem
          label={t('debug.lifecycle.sourceEvent')}
          value={`${summary.source} / ${summary.event}`}
        />
        <SummaryItem
          label={t('debug.lifecycle.internalEvent')}
          value={summary.internalEvent ?? t('debug.lifecycle.internalEventMissing')}
        />
        <SummaryItem
          label={t('debug.lifecycle.mappingStage')}
          value={summary.mappingStage ?? t('debug.lifecycle.notRecorded')}
        />
        <SummaryItem
          label={t('debug.lifecycle.processingMode')}
          value={summary.processingMode ?? t('debug.lifecycle.notRecorded')}
        />
        <SummaryItem label={t('debug.lifecycle.elapsed')} value={elapsed} />
        <SummaryItem label={t('debug.lifecycle.outputs')} value={String(summary.outputCount)} />
        <SummaryItem
          label={t('debug.lifecycle.deviceResults')}
          value={`${summary.deviceResultCount} / ${t('debug.lifecycle.failedDeviceResults', {
            count: summary.failedDeviceResultCount
          })}`}
        />
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border bg-background/70 px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{value}</div>
    </div>
  );
}
