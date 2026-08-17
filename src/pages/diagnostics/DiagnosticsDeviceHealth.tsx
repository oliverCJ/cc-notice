import { DiagnosticsDeviceHealthSnapshot } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { diagnosticStatusBadgeVariant } from './diagnosticsSeverity';
import {
  diagnosticDeviceHealthCheckKey,
  diagnosticDeviceHealthIssueKey,
  diagnosticStatusLabelKey
} from './diagnosticsText';

type DiagnosticsDeviceHealthProps = {
  health: DiagnosticsDeviceHealthSnapshot;
};

export function DiagnosticsDeviceHealth({ health }: DiagnosticsDeviceHealthProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('diagnostics.deviceHealth.title')}</CardTitle>
        <CardDescription>{t('diagnostics.deviceHealth.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label={t('diagnostics.deviceHealth.summary.ok')} value={health.okCount} />
          <Metric
            label={t('diagnostics.deviceHealth.summary.warning')}
            value={health.warningCount}
          />
          <Metric label={t('diagnostics.deviceHealth.summary.error')} value={health.errorCount} />
        </div>

        {health.details.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('diagnostics.deviceHealth.empty')}</p>
        ) : (
          <div className="space-y-3">
            {health.details.map((detail) => (
              <div key={detail.deviceId} className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium">
                      {detail.label ?? detail.deviceId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detail.boardId ?? detail.deviceId}
                    </p>
                  </div>
                  <Badge variant={diagnosticStatusBadgeVariant(detail.status)}>
                    {t(diagnosticStatusLabelKey(detail.status))}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {detail.checks.map((check) => (
                    <div key={check.id} className="rounded-md bg-muted/40 p-2">
                      <p className="text-xs font-medium">
                        {t(diagnosticDeviceHealthCheckKey(check.id))}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t(diagnosticDeviceHealthIssueKey(check.issueCode))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
