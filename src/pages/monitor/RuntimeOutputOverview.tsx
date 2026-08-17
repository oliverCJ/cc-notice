import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { formatRuntimeOutputType } from './runtimeOutputLabels';

type RuntimeOutputOverviewProps = {
  snapshot: RuntimeMonitorSnapshot | null;
};

type RuntimeOutputOverviewRow = {
  outputType: string;
  label: string;
  attempts: number;
  failures: number;
  successRate: number;
};

export function RuntimeOutputOverview({ snapshot }: RuntimeOutputOverviewProps) {
  const t = useI18n();
  const rows = buildRuntimeOutputOverviewRows(snapshot, t);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('monitor.outputs.title')}</CardTitle>
        <CardDescription>{t('monitor.outputs.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            {t('monitor.outputs.empty')}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {rows.map((row) => (
              <div key={row.outputType} className="rounded-md border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{row.outputType}</p>
                  </div>
                  <Badge variant={row.failures > 0 ? 'destructive' : 'secondary'}>
                    {t('monitor.outputs.successRate', { rate: row.successRate })}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t('monitor.outputs.attempts', { count: row.attempts })}</span>
                  <span>{t('monitor.outputs.failures', { count: row.failures })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function buildRuntimeOutputOverviewRows(
  snapshot: RuntimeMonitorSnapshot | null,
  t: (key: string, params?: Record<string, string | number>) => string
): RuntimeOutputOverviewRow[] {
  const attempts = snapshot?.outputAttemptsByType ?? [];
  const failuresByType = new Map(
    (snapshot?.outputFailuresByType ?? []).map((item) => [item.key, item.count])
  );

  return attempts
    .map((item) => {
      const failures = failuresByType.get(item.key) ?? 0;
      const successCount = Math.max(item.count - failures, 0);
      const successRate = item.count === 0 ? 0 : Math.round((successCount / item.count) * 100);

      return {
        outputType: item.key,
        label: formatRuntimeOutputType(item.key, t),
        attempts: item.count,
        failures,
        successRate
      };
    })
    .sort((left, right) => right.attempts - left.attempts || left.label.localeCompare(right.label));
}
