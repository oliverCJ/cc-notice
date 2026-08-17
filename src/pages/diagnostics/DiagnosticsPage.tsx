import { AlertCircle } from 'lucide-react';
import { DiagnosticActionKind, DiagnosticsSnapshot } from '@/api/tauriApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { DiagnosticsDeviceSummary } from './DiagnosticsDeviceSummary';
import { DiagnosticsDeviceHealth } from './DiagnosticsDeviceHealth';
import { DiagnosticsFlowMap } from './DiagnosticsFlowMap';
import { DiagnosticsIssueList } from './DiagnosticsIssueList';
import { DiagnosticsQuickActions } from './DiagnosticsQuickActions';
import { DiagnosticsStatusCards } from './DiagnosticsStatusCards';
import { diagnosticStatusLabelKey } from './diagnosticsText';

export type DiagnosticsPageProps = {
  snapshot: DiagnosticsSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onAction: (action: DiagnosticActionKind) => void;
};

export function DiagnosticsPage({
  snapshot,
  loading,
  error,
  onRefresh,
  onAction
}: DiagnosticsPageProps) {
  const t = useI18n();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('diagnostics.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('diagnostics.description')}</p>
        </div>
        <Button variant="outline" onClick={onRefresh} disabled={loading}>
          {loading ? t('diagnostics.refreshing') : t('diagnostics.refresh')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {snapshot ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('diagnostics.overallStatus')}</span>
            <span className="text-sm font-medium">
              {t(diagnosticStatusLabelKey(snapshot.overallStatus))}
            </span>
            <span className="text-sm text-muted-foreground">
              {t('diagnostics.checkedAt', { time: snapshot.checkedAt })}
            </span>
          </div>

          <DiagnosticsStatusCards sections={snapshot.sections} />

          <div data-testid="diagnostics-flow-row">
            <DiagnosticsFlowMap sections={snapshot.sections} />
          </div>

          <div
            data-testid="diagnostics-main-grid"
            className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]"
          >
            <DiagnosticsIssueList issues={snapshot.issues} onAction={onAction} />
            <div className="space-y-6">
              <DiagnosticsDeviceSummary
                summary={snapshot.deviceSummary}
                issues={snapshot.deviceIssues}
              />
              <DiagnosticsDeviceHealth health={snapshot.deviceHealth} />
              <DiagnosticsQuickActions
                actions={snapshot.quickActions}
                loading={loading}
                onAction={onAction}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
          {loading ? t('diagnostics.loading') : t('diagnostics.empty')}
        </div>
      )}
    </div>
  );
}
