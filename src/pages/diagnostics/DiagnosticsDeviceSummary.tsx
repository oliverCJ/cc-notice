import { DiagnosticsDeviceIssue, DiagnosticsDeviceSummary as DeviceSummary } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { diagnosticStatusBadgeVariant } from './diagnosticsSeverity';
import { diagnosticDeviceIssueReasonKey, diagnosticStatusLabelKey } from './diagnosticsText';

type DiagnosticsDeviceSummaryProps = {
  summary: DeviceSummary;
  issues: DiagnosticsDeviceIssue[];
};

export function DiagnosticsDeviceSummary({ summary, issues }: DiagnosticsDeviceSummaryProps) {
  const t = useI18n();
  const metrics = [
    { key: 'registered', value: summary.registeredCount },
    { key: 'connected', value: summary.connectedCount },
    { key: 'offline', value: summary.offlineCount },
    { key: 'heartbeatIssues', value: summary.heartbeatIssueCount },
    { key: 'firmwareIssues', value: summary.firmwareIssueCount },
    { key: 'referencedUnavailable', value: summary.referencedUnavailableCount }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('diagnostics.devices.title')}</CardTitle>
        <CardDescription>{t('diagnostics.devices.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.key} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {t(`diagnostics.devices.metrics.${metric.key}`)}
              </p>
              <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('diagnostics.devices.issueList')}</p>
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('diagnostics.devices.emptyIssues')}</p>
          ) : (
            issues.map((issue) => (
              <div
                key={`${issue.deviceId}-${issue.reason}`}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <span className="block break-all text-sm font-medium">{issue.label ?? issue.deviceId}</span>
                  <p className="text-xs text-muted-foreground">
                    {t(diagnosticDeviceIssueReasonKey(issue.reason))}
                  </p>
                </div>
                <Badge variant={diagnosticStatusBadgeVariant(issue.status)}>
                  {t(diagnosticStatusLabelKey(issue.status))}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
