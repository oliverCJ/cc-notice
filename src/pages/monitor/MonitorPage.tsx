import { useMemo, useState } from 'react';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import {
  DebugLogEntryView,
  LocalHookServerStatusView
} from '../../state/appStore';
import { DebugEventDetailDialog } from '../debug/DebugEventDetailDialog';
import { RuntimeHealthAlerts } from './RuntimeHealthAlerts';
import { RuntimeOutputOverview } from './RuntimeOutputOverview';
import { RuntimeRecentEvents } from './RuntimeRecentEvents';
import { RuntimeStatsCharts } from './RuntimeStatsCharts';
import { RuntimeStatusOverview } from './RuntimeStatusOverview';
import { toRuntimeLineChartData } from './runtimeMonitorChartData';
import { useI18n } from '@/i18n';

type MonitorPageProps = {
  runtimeSnapshot: RuntimeMonitorSnapshot | null;
  runtimeLoading: boolean;
  runtimeError: string | null;
  onRefreshRuntime: () => void;
  recentEntries: DebugLogEntryView[];
  hookServerStatus: LocalHookServerStatusView;
};

export function MonitorPage({
  runtimeSnapshot,
  runtimeLoading,
  runtimeError,
  onRefreshRuntime,
  recentEntries,
  hookServerStatus
}: MonitorPageProps) {
  const t = useI18n();
  const [detailEntry, setDetailEntry] = useState<DebugLogEntryView | null>(null);
  const charts = useMemo(
    () => toRuntimeLineChartData(runtimeSnapshot ?? emptyRuntimeSnapshot()),
    [runtimeSnapshot]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('monitor.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('monitor.description')}</p>
        </div>
        <Button variant="outline" onClick={onRefreshRuntime} disabled={runtimeLoading}>
          {runtimeLoading ? t('monitor.refreshing') : t('monitor.refresh')}
        </Button>
      </div>

      <RuntimeStatusOverview snapshot={runtimeSnapshot} hookServerStatus={hookServerStatus} />
      <RuntimeOutputOverview snapshot={runtimeSnapshot} />
      <RuntimeStatsCharts eventChart={charts.eventChart} outputChart={charts.outputChart} />
      <RuntimeRecentEvents entries={recentEntries} onOpenDetail={setDetailEntry} />
      <RuntimeHealthAlerts
        snapshot={runtimeSnapshot}
        hookServerStatus={hookServerStatus}
        error={runtimeError}
      />

      <DebugEventDetailDialog
        entry={detailEntry}
        open={detailEntry !== null}
        onOpenChange={(open) => !open && setDetailEntry(null)}
      />
    </div>
  );
}

function emptyRuntimeSnapshot(): RuntimeMonitorSnapshot {
  return {
    startedAt: '',
    uptimeSeconds: 0,
    totalEvents: 0,
    totalOutputs: 0,
    totalFailures: 0,
    eventsBySource: [],
    eventsByResult: [],
    outputAttemptsByType: [],
    outputFailuresByType: [],
    eventSeries: [],
    outputSeries: [],
    runtimeErrorCount: 0,
    lastEvent: null,
    lastOutput: null
  };
}
