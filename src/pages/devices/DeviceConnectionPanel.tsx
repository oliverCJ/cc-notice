import { useEffect, useMemo, useState } from 'react';
import { Plug, RefreshCw, Unplug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DevicePortDescriptor, DeviceRuntimeState, DeviceTransportConfig } from '@/api/tauriApi';
import { useI18n } from '@/i18n';

type DeviceConnectionPanelProps = {
  selectedState: DeviceRuntimeState | null;
  ports: DevicePortDescriptor[];
  scanning: boolean;
  connectingDeviceId: string | null;
  onScan: () => void;
  onConnect: (deviceId: string, transport?: DeviceTransportConfig | null) => void;
  onDisconnect: (deviceId: string) => void;
  onDisconnectAll: () => void;
};

export function DeviceConnectionPanel({
  selectedState,
  ports,
  scanning,
  connectingDeviceId,
  onScan,
  onConnect,
  onDisconnect,
  onDisconnectAll
}: DeviceConnectionPanelProps) {
  const t = useI18n();
  const deviceId = selectedState?.deviceId ?? null;
  const isBusy = Boolean(deviceId && connectingDeviceId === deviceId);
  const connected = selectedState?.status === 'connected';
  const [selectedPortId, setSelectedPortId] = useState('');
  const selectedPort = useMemo(
    () => ports.find((port) => port.id === selectedPortId) ?? null,
    [ports, selectedPortId]
  );
  const selectedTransport = useMemo(
    () => (selectedPort ? transportConfigFromPort(selectedPort, selectedState) : null),
    [selectedPort, selectedState]
  );

  useEffect(() => {
    if (ports.length === 0) {
      setSelectedPortId('');
      return;
    }

    const currentSerialPort = selectedState?.transport?.serialPort ?? null;
    const currentPort = ports.find((port) => port.address === currentSerialPort);
    const nextPort = currentPort ?? ports[0];
    setSelectedPortId((currentValue) =>
      ports.some((port) => port.id === currentValue) ? currentValue : nextPort.id
    );
  }, [ports, selectedState?.transport?.serialPort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('devices.connection.title')}</CardTitle>
        <CardDescription>{t('devices.connection.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onScan} disabled={scanning}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {scanning ? t('devices.connection.scanning') : t('devices.connection.scan')}
          </Button>
          <Button
            type="button"
            onClick={() => deviceId && onConnect(deviceId, selectedTransport)}
            disabled={!deviceId || !selectedTransport || connected || isBusy}
          >
            <Plug className="mr-2 h-4 w-4" />
            {isBusy ? t('devices.connection.connecting') : t('devices.connection.connect')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => deviceId && onDisconnect(deviceId)}
            disabled={!deviceId || !connected || isBusy}
          >
            <Unplug className="mr-2 h-4 w-4" />
            {t('devices.connection.disconnect')}
          </Button>
          <Button type="button" variant="ghost" onClick={onDisconnectAll}>
            {t('devices.connection.disconnectAll')}
          </Button>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{t('devices.connection.selectedTransport')}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {formatTransport(selectedState)}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('devices.connection.availablePorts')}</p>
          {ports.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('devices.connection.emptyPorts')}</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {ports.map((port) => (
                <button
                  key={port.id}
                  type="button"
                  className={`rounded-md border p-2 text-left transition-colors hover:bg-muted/50 ${
                    selectedPortId === port.id ? 'border-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setSelectedPortId(port.id)}
                  disabled={connected || isBusy}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{port.displayName}</p>
                    <Badge variant="outline">{port.transportKind}</Badge>
                  </div>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{port.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
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

function transportConfigFromPort(
  port: DevicePortDescriptor,
  selectedState: DeviceRuntimeState | null
): DeviceTransportConfig {
  if (port.transportKind === 'serial') {
    return {
      kind: 'serial',
      serialPort: port.address,
      baudRate: selectedState?.transport?.baudRate ?? 115200
    };
  }

  return {
    kind: port.transportKind
  };
}
