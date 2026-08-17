import { useEffect, useMemo, useState } from 'react';
import { Activity, Plug, Unplug } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceRuntimeState, DeviceTransportConfig } from '@/api/tauriApi';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';

export type DeviceConnectionCandidate = {
  resourceId: string;
  displayName: string;
  transport: DeviceTransportConfig;
  matchedDeviceId?: string | null;
};

type DeviceConnectionControlsProps = {
  selectedState: DeviceRuntimeState | null;
  connectionCandidates: DeviceConnectionCandidate[];
  connectingDeviceId: string | null;
  error: DeviceRuntimeError | null;
  onConnect: (deviceId: string, transport?: DeviceTransportConfig | null) => void;
  onDisconnect: (deviceId: string) => void;
  onDisconnectAll: () => void;
  onOpenTransportMonitor: (deviceId: string) => void;
};

export function DeviceConnectionControls({
  selectedState,
  connectionCandidates,
  connectingDeviceId,
  error,
  onConnect,
  onDisconnect,
  onDisconnectAll,
  onOpenTransportMonitor
}: DeviceConnectionControlsProps) {
  const t = useI18n();
  const deviceId = selectedState?.deviceId ?? null;
  const connected = selectedState?.status === 'connected';
  const hasActiveOperation = Boolean(selectedState?.activeOperation);
  const isBusy = Boolean(
    (deviceId && connectingDeviceId === deviceId) ||
      selectedState?.status === 'connecting' ||
      hasActiveOperation
  );
  const batchConnecting = connectingDeviceId === '*';
  const connectionError = error?.scope === 'connection' ? error : null;
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const selectedCandidate = useMemo(
    () => connectionCandidates.find((candidate) => candidate.resourceId === selectedResourceId) ?? null,
    [connectionCandidates, selectedResourceId]
  );

  useEffect(() => {
    if (connectionCandidates.length === 0) {
      setSelectedResourceId('');
      return;
    }
    setSelectedResourceId((currentValue) => {
      const currentCandidate =
        connectionCandidates.find((candidate) => candidate.resourceId === currentValue) ?? null;
      const matchedCandidate =
        connectionCandidates.find((candidate) => candidate.matchedDeviceId === deviceId) ?? null;
      if (matchedCandidate && currentCandidate?.matchedDeviceId !== deviceId) {
        return matchedCandidate.resourceId;
      }
      if (currentCandidate) {
        return currentCandidate.resourceId;
      }
      return matchedCandidate?.resourceId ?? connectionCandidates[0].resourceId;
    });
  }, [connectionCandidates, deviceId]);

  return (
    <Card data-testid="device-connection-controls">
      <CardHeader>
        <CardTitle>{t('devices.connection.title')}</CardTitle>
        <CardDescription>{t('devices.connection.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connectionError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('devices.connection.errorTitle')}</AlertTitle>
            <AlertDescription>{connectionError.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => deviceId && onConnect(deviceId, selectedCandidate?.transport ?? undefined)}
            disabled={!deviceId || connected || isBusy || batchConnecting}
          >
            <Plug className="mr-2 h-4 w-4" />
            {isBusy ? t('devices.connection.connecting') : t('devices.connection.connect')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => deviceId && onDisconnect(deviceId)}
            disabled={!deviceId || !connected || isBusy || batchConnecting}
          >
            <Unplug className="mr-2 h-4 w-4" />
            {t('devices.connection.disconnect')}
          </Button>
          <Button type="button" variant="ghost" onClick={onDisconnectAll}>
            {t('devices.connection.disconnectAll')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => deviceId && onOpenTransportMonitor(deviceId)}
            disabled={!deviceId || !connected || isBusy || batchConnecting}
          >
            <Activity className="mr-2 h-4 w-4" />
            {t('devices.connection.openTransportMonitor')}
          </Button>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{t('devices.connection.selectedTransport')}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {formatTransport(selectedState)}
          </p>
        </div>
        {connectionCandidates.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('devices.connection.availablePorts')}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {connectionCandidates.map((candidate) => (
                <button
                  key={candidate.resourceId}
                  type="button"
                  aria-label={candidate.displayName}
                  className={`rounded-md border p-2 text-left transition-colors hover:bg-muted/50 ${
                    selectedResourceId === candidate.resourceId ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedResourceId(candidate.resourceId)}
                  disabled={connected || isBusy || batchConnecting}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{candidate.displayName}</p>
                    {candidate.matchedDeviceId === deviceId ? (
                      <Badge variant="outline">{t('devices.connection.matchedPort')}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {formatTransportConfig(candidate.transport)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatTransport(state: DeviceRuntimeState | null) {
  const transport = state?.transport;
  if (!transport) {
    return '-';
  }

  if (transport.serialPort) {
    return `${transport.kind}:${transport.serialPort}`;
  }

  if (transport.host || transport.port) {
    return `${transport.kind}:${transport.host ?? ''}:${transport.port ?? ''}`;
  }

  return transport.kind;
}

function formatTransportConfig(transport: DeviceTransportConfig) {
  if (transport.serialPort) {
    return `${transport.kind}:${transport.serialPort}`;
  }

  if (transport.host || transport.port) {
    return `${transport.kind}:${transport.host ?? ''}:${transport.port ?? ''}`;
  }

  return transport.kind;
}
