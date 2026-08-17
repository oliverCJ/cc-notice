import { useState } from 'react';
import { Cpu, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { DeviceRuntimeState } from '@/api/tauriApi';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';

type DeviceListPanelProps = {
  states: DeviceRuntimeState[];
  loading: boolean;
  selectedDeviceId: string | null;
  error: DeviceRuntimeError | null;
  onSelectDevice: (deviceId: string) => void;
  onRemoveDevice: (deviceId: string) => void;
  onOpenRulesPage?: () => void;
};

export function DeviceListPanel({
  states,
  loading,
  selectedDeviceId,
  error,
  onSelectDevice,
  onRemoveDevice,
  onOpenRulesPage
}: DeviceListPanelProps) {
  const t = useI18n();
  const [devicePendingRemoval, setDevicePendingRemoval] = useState<string | null>(null);
  const blockedRemovalError =
    error?.code === 'device-referenced-by-output-rule' ? error : null;
  const blockedDeviceExists = Boolean(
    blockedRemovalError?.deviceId &&
      states.some((state) => state.deviceId === blockedRemovalError.deviceId)
  );

  function confirmRemoveDevice() {
    if (!devicePendingRemoval) {
      return;
    }
    onRemoveDevice(devicePendingRemoval);
    setDevicePendingRemoval(null);
  }

  return (
    <>
      <Card data-testid="device-list-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            {t('devices.list.title')}
          </CardTitle>
          <CardDescription>{t('devices.list.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blockedRemovalError && !blockedDeviceExists ? (
            <RemoveBlockedAlert error={blockedRemovalError} onOpenRulesPage={onOpenRulesPage} />
          ) : null}
          {loading && <p className="text-sm text-muted-foreground">{t('devices.list.loading')}</p>}
          {!loading && states.length === 0 && (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t('devices.list.empty')}
            </p>
          )}
          {states.map((state) => {
            const deviceId = state.deviceId ?? t('devices.unknownDevice');
            const selected = selectedDeviceId === state.deviceId;
            const rowBlockedError =
              blockedRemovalError?.deviceId === state.deviceId ? blockedRemovalError : null;

            return (
              <div
                key={deviceId}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => state.deviceId && onSelectDevice(state.deviceId)}
                    title={deviceId}
                  >
                    <p className="break-all text-sm font-medium leading-snug">{deviceId}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {state.boardId ?? t('devices.unknownBoard')}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant={state.status === 'connected' ? 'default' : 'secondary'}>
                      {t(`devices.status.${state.status}`)}
                    </Badge>
                    {state.deviceId ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={t('devices.list.removeDevice', { device: state.deviceId })}
                        onClick={() => setDevicePendingRemoval(state.deviceId ?? null)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {rowBlockedError ? (
                  <div className="mt-3">
                    <RemoveBlockedAlert
                      error={rowBlockedError}
                      onOpenRulesPage={onOpenRulesPage}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(devicePendingRemoval)}
        onOpenChange={(open) => {
          if (!open) {
            setDevicePendingRemoval(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('devices.list.removeDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('devices.list.removeDialogDescription', {
                device: devicePendingRemoval ?? ''
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveDevice}>
              {t('devices.list.confirmRemove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RemoveBlockedAlert({
  error,
  onOpenRulesPage
}: {
  error: DeviceRuntimeError;
  onOpenRulesPage?: () => void;
}) {
  const t = useI18n();

  return (
    <Alert variant="destructive">
      <AlertTitle>{t('devices.list.removeBlockedTitle')}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t('devices.list.removeBlockedDescription')}</p>
        {error.ruleId ? (
          <p className="break-all">
            {t('devices.list.referencedRule', { rule: error.ruleId })}
          </p>
        ) : null}
        {onOpenRulesPage ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpenRulesPage}>
            {t('devices.list.openRules')}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
