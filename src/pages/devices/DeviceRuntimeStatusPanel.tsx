import { Activity } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceFirmwareStatus, DeviceRuntimeState } from '@/api/tauriApi';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';

type DeviceRuntimeStatusPanelProps = {
  selectedState: DeviceRuntimeState | null;
  error: DeviceRuntimeError | null;
  onCheckFirmware: (deviceId: string) => void;
  onOpenDiagnostics?: () => void;
};

export function DeviceRuntimeStatusPanel({
  selectedState,
  error,
  onCheckFirmware,
  onOpenDiagnostics
}: DeviceRuntimeStatusPanelProps) {
  const t = useI18n();
  const deviceId = selectedState?.deviceId ?? null;
  const runtimeError =
    error &&
    (error.scope === 'runtime' || !error.scope) &&
    error.code !== 'device-referenced-by-output-rule' &&
    error.code !== 'device-channel-referenced-by-output-rule'
      ? error
      : null;

  return (
    <Card data-testid="device-runtime-status-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {t('devices.runtime.title')}
        </CardTitle>
        <CardDescription>{t('devices.runtime.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {runtimeError ? <RuntimeErrorAlert error={runtimeError} /> : null}

        <dl className="grid gap-3 md:grid-cols-3">
          <RuntimeItem
            label={t('devices.runtime.deviceFirmwareVersion')}
            value={selectedState?.firmwareInfo?.firmwareVersion}
          />
          <RuntimeItem
            label={t('devices.runtime.bundledFirmwareVersion')}
            value={selectedState?.bundledFirmwareVersion}
          />
          <RuntimeItem
            label={t('devices.runtime.firmwareStatus')}
            value={formatFirmwareStatus(selectedState?.firmwareStatus, t)}
          />
          <RuntimeItem label={t('devices.runtime.lastAck')} value={selectedState?.lastAck} />
          <RuntimeItem label={t('devices.runtime.lastError')} value={selectedState?.lastError} />
          <RuntimeItem label={t('devices.runtime.lastSentAt')} value={selectedState?.lastSentAt} />
        </dl>
        {selectedState?.firmwareCheckError ? (
          <Alert>
            <AlertTitle>{t('devices.runtime.firmwareCheckErrorTitle')}</AlertTitle>
            <AlertDescription>{selectedState.firmwareCheckError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!deviceId}
            onClick={() => {
              if (deviceId) {
                onCheckFirmware(deviceId);
              }
            }}
          >
            {t('devices.runtime.checkFirmware')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!deviceId || !onOpenDiagnostics}
            onClick={onOpenDiagnostics}
          >
            {t('devices.runtime.openDiagnostics')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuntimeErrorAlert({ error }: { error: DeviceRuntimeError }) {
  const t = useI18n();

  return (
    <Alert variant="destructive">
      <AlertTitle>{t('devices.runtime.errorTitle')}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  );
}

function formatFirmwareStatus(
  status: DeviceFirmwareStatus | undefined,
  t: ReturnType<typeof useI18n>
) {
  return t(`devices.runtime.firmwareStatuses.${status ?? 'unknown'}`);
}

function RuntimeItem({ label, value }: { label: string; value?: string | null }) {
  const t = useI18n();

  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all text-sm">{value || t('common.notConfigured')}</dd>
    </div>
  );
}
