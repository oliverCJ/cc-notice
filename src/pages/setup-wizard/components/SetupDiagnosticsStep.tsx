import { AlertCircle } from 'lucide-react';
import { DiagnosticsSnapshot } from '@/api/tauriApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { diagnosticStatusLabelKey } from '@/pages/diagnostics/diagnosticsText';

type SetupDiagnosticsStepProps = {
  snapshot: DiagnosticsSnapshot | null;
  loading: boolean;
  error: string | null;
  onOpenDiagnosticsCenter: () => void;
  onRefresh: () => Promise<void> | void;
};

export function SetupDiagnosticsStep({
  snapshot,
  loading,
  error,
  onOpenDiagnosticsCenter,
  onRefresh
}: SetupDiagnosticsStepProps) {
  const t = useI18n();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>{t('setup.diagnostics.title')}</CardTitle>
              <CardDescription>{t('setup.diagnostics.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onRefresh} disabled={loading}>
                {loading ? t('diagnostics.refreshing') : t('diagnostics.refresh')}
              </Button>
              <Button onClick={onOpenDiagnosticsCenter}>
                {t('setup.diagnostics.openDiagnosticsCenter')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {snapshot ? (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-4">
                <span className="text-sm text-muted-foreground">
                  {t('diagnostics.overallStatus')}
                </span>
                <Badge variant={snapshot.overallStatus === 'ok' ? 'default' : 'secondary'}>
                  {t(diagnosticStatusLabelKey(snapshot.overallStatus))}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t('diagnostics.checkedAt', { time: snapshot.checkedAt })}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <SummaryMetric
                  label={t('diagnostics.devices.metrics.registered')}
                  value={snapshot.deviceSummary.registeredCount}
                />
                <SummaryMetric
                  label={t('diagnostics.devices.metrics.connected')}
                  value={snapshot.deviceSummary.connectedCount}
                />
                <SummaryMetric
                  label={t('diagnostics.devices.metrics.offline')}
                  value={snapshot.deviceSummary.offlineCount}
                />
                <SummaryMetric
                  label={t('diagnostics.issues.title')}
                  value={snapshot.issues.length}
                />
              </div>
            </>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              {loading ? t('setup.diagnostics.loading') : t('setup.diagnostics.empty')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type SummaryMetricProps = {
  label: string;
  value: number;
};

function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
