import { useState } from 'react';
import { Fingerprint } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceRuntimeState } from '@/api/tauriApi';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

type DeviceIdentityPanelProps = {
  selectedState: DeviceRuntimeState | null;
  busy: boolean;
  error: DeviceRuntimeError | null;
  onResetIdentity: (deviceId: string) => void;
};

export function DeviceIdentityPanel({
  selectedState,
  busy,
  error,
  onResetIdentity
}: DeviceIdentityPanelProps) {
  const t = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deviceId = selectedState?.deviceId ?? null;
  const deviceUid = selectedState?.deviceUid ?? '-';
  const supported = isIdentityResetSupported(selectedState);
  const connected = selectedState?.status === 'connected';
  const identityError = error?.scope === 'connection' ? error : null;

  if (!supported) {
    return null;
  }

  function handleConfirm() {
    if (deviceId) {
      onResetIdentity(deviceId);
    }
    setConfirmOpen(false);
  }

  return (
    <Card data-testid="device-identity-panel">
      <CardHeader>
        <CardTitle>{t('devices.identity.title')}</CardTitle>
        <CardDescription>{t('devices.identity.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {identityError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('devices.identity.errorTitle')}</AlertTitle>
            <AlertDescription>{identityError.message}</AlertDescription>
          </Alert>
        ) : null}
        <div className="rounded-md border p-3">
          <p className="text-sm font-medium">{t('devices.identity.currentUid')}</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{deviceUid}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={!deviceId || !connected || busy}
        >
          <Fingerprint className="mr-2 h-4 w-4" />
          {busy ? t('devices.identity.resetting') : t('devices.identity.reset')}
        </Button>
      </CardContent>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('devices.identity.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('devices.identity.confirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t('devices.identity.confirmWarning')}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={handleConfirm}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {t('devices.identity.confirmReset')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function isIdentityResetSupported(state: DeviceRuntimeState | null): boolean {
  const boardId = state?.boardId ?? '';
  return boardId === 'arduino-uno' || boardId === 'arduino-nano';
}
