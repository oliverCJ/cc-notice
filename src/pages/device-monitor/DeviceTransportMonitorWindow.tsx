import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n';
import { DeviceTransportEventDetail } from './DeviceTransportEventDetail';
import { DeviceTransportEventList } from './DeviceTransportEventList';
import { DeviceTransportMonitorToolbar } from './DeviceTransportMonitorToolbar';
import { useDeviceTransportMonitor } from './useDeviceTransportMonitor';

type DeviceTransportMonitorWindowProps = {
  deviceId: string;
};

export function DeviceTransportMonitorWindow({ deviceId }: DeviceTransportMonitorWindowProps) {
  const t = useI18n();
  const monitor = useDeviceTransportMonitor(deviceId);

  return (
    <main className="flex h-screen min-w-0 flex-col bg-background text-foreground">
      <DeviceTransportMonitorToolbar deviceId={deviceId} monitor={monitor} />
      {!monitor.active ? (
        <Alert className="rounded-none border-x-0 border-t-0 border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertDescription>{t('devices.transportMonitor.stoppedBanner')}</AlertDescription>
        </Alert>
      ) : null}
      {monitor.error ? (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertDescription>{monitor.error}</AlertDescription>
        </Alert>
      ) : null}
      {monitor.loading ? (
        <div className="p-4 text-sm text-muted-foreground">{t('common.loadingRuntimeMonitor')}</div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-0 max-[820px]:grid-cols-1">
          <DeviceTransportEventList
            events={monitor.filteredEvents}
            followLatest={monitor.followLatest}
            selectedEventId={monitor.selectedEventId}
            onFollowLatestChange={monitor.setFollowLatest}
            onSelectEvent={monitor.setSelectedEventId}
          />
          <DeviceTransportEventDetail event={monitor.selectedEvent} />
        </div>
      )}
    </main>
  );
}
