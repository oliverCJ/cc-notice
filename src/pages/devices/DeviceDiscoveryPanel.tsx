import { Fingerprint, Plus, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceCandidateResource } from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import { DeviceDiscoveryState } from '@/hooks/useDeviceDiscovery';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';

type DeviceDiscoveryPanelProps = {
  discovery: DeviceDiscoveryState;
  autoConnecting: boolean;
  autoConnectError: DeviceRuntimeError | null;
  onAutoConnect: () => void;
};

export function DeviceDiscoveryPanel({
  discovery,
  autoConnecting,
  autoConnectError,
  onAutoConnect
}: DeviceDiscoveryPanelProps) {
  const t = useI18n();

  return (
    <Card data-testid="device-discovery-panel">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{t('devices.discovery.title')}</CardTitle>
          <CardDescription>{t('devices.discovery.description')}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={discovery.scanCandidates}
            disabled={discovery.scanning || autoConnecting}
          >
            <Search className="mr-2 h-4 w-4" />
            {discovery.scanning ? t('devices.discovery.scanning') : t('devices.discovery.scan')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onAutoConnect}
            disabled={autoConnecting}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {autoConnecting ? t('devices.connection.autoConnecting') : t('devices.connection.autoConnect')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {autoConnectError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('devices.discovery.autoConnectErrorTitle')}</AlertTitle>
            <AlertDescription>{autoConnectError.message}</AlertDescription>
          </Alert>
        ) : null}

        {discovery.error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {discovery.error}
          </p>
        ) : null}
        {discovery.candidates.length > 0 ? (
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t('devices.discovery.portHint')}
          </p>
        ) : null}

        {discovery.candidates.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t('devices.discovery.empty')}
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {discovery.candidates.map((candidate) => (
              <CandidateCard key={candidate.resourceId} candidate={candidate} discovery={discovery} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CandidateCard({
  candidate,
  discovery
}: {
  candidate: DeviceCandidateResource;
  discovery: DeviceDiscoveryState;
}) {
  const t = useI18n();
  const identified = candidate.discoveryStatus === 'identified' || candidate.discoveryStatus === 'matched';
  const matched = candidate.discoveryStatus === 'matched';
  const identifying = discovery.identifyingResourceId === candidate.resourceId;
  const registering = discovery.registeringResourceId === candidate.resourceId;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{candidate.displayName}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {candidate.transport.serialPort ?? candidate.resourceId}
          </p>
        </div>
        <Badge variant={identified ? 'default' : 'secondary'}>
          {t(`devices.discovery.statuses.${candidate.discoveryStatus}`)}
        </Badge>
      </div>
      {candidate.deviceUid ? (
        <p className="mt-2 break-all text-xs text-muted-foreground">{candidate.deviceUid}</p>
      ) : null}
      {candidate.handshakeInfo?.identityPersistence === 'fallback' ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-200">
          {t('devices.discovery.identityFallback')}
        </p>
      ) : null}
      {candidate.matchedDeviceId ? (
        <p className="mt-2 break-all text-xs text-muted-foreground">
          {t('devices.discovery.matchedDevice', { device: candidate.matchedDeviceId })}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => discovery.identifyCandidate(candidate)}
          disabled={matched || identifying || registering}
        >
          <Fingerprint className="mr-2 h-4 w-4" />
          {identifying ? t('devices.discovery.identifying') : t('devices.discovery.identify')}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => discovery.registerCandidate(candidate, candidate.displayName)}
          disabled={!identified || matched || registering}
        >
          <Plus className="mr-2 h-4 w-4" />
          {registering ? t('devices.discovery.registering') : t('devices.discovery.register')}
        </Button>
      </div>
    </div>
  );
}
