import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { DeviceTransportMonitorDirection } from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import { DeviceTransportMonitorState } from './useDeviceTransportMonitor';

type DeviceTransportMonitorToolbarProps = {
  deviceId: string;
  monitor: DeviceTransportMonitorState;
};

const directionOptions: Array<DeviceTransportMonitorDirection | 'all'> = [
  'all',
  'outbound',
  'inbound',
  'system'
];

export function DeviceTransportMonitorToolbar({
  deviceId,
  monitor
}: DeviceTransportMonitorToolbarProps) {
  const t = useI18n();

  return (
    <header className="border-b bg-card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">{t('devices.transportMonitor.title')}</h1>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {t('devices.transportMonitor.subtitle', { device: deviceId })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-background p-1">
            {directionOptions.map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={monitor.direction === option ? 'secondary' : 'ghost'}
                className="h-7 px-2 text-xs"
                onClick={() => monitor.setDirection(option)}
              >
                {option === 'all'
                  ? t('devices.transportMonitor.allDirections')
                  : t(`devices.transportMonitor.direction.${option}`)}
              </Button>
            ))}
          </div>
          <Label className="flex h-8 items-center gap-2 rounded-md border px-2 text-xs">
            <Checkbox
              checked={monitor.errorsOnly}
              onCheckedChange={(checked) => monitor.setErrorsOnly(Boolean(checked))}
            />
            {t('devices.transportMonitor.errorsOnly')}
          </Label>
          <Button type="button" size="sm" variant="ghost" onClick={monitor.clear}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t('devices.transportMonitor.clear')}
          </Button>
        </div>
      </div>
    </header>
  );
}
