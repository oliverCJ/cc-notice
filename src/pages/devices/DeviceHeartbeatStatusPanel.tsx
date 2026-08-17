import { HeartPulse } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceRuntimeState } from '@/api/tauriApi';
import { useI18n } from '@/i18n';

type DeviceHeartbeatStatusPanelProps = {
  selectedState: DeviceRuntimeState | null;
};

export function DeviceHeartbeatStatusPanel({ selectedState }: DeviceHeartbeatStatusPanelProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          {t('devices.heartbeat.title')}
        </CardTitle>
        <CardDescription>{t('devices.heartbeat.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 md:grid-cols-3">
          <HeartbeatItem
            label={t('devices.heartbeat.status')}
            value={t(`devices.heartbeat.statuses.${selectedState?.heartbeatStatus ?? 'unknown'}`)}
          />
          <HeartbeatItem
            label={t('devices.heartbeat.lastHeartbeatAt')}
            value={selectedState?.lastHeartbeatAt}
          />
          <HeartbeatItem
            label={t('devices.heartbeat.failureCount')}
            value={String(selectedState?.heartbeatFailureCount ?? 0)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function HeartbeatItem({ label, value }: { label: string; value?: string | null }) {
  const t = useI18n();

  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all text-sm">{value || t('common.notConfigured')}</dd>
    </div>
  );
}
