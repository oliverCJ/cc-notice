import { Loader2 } from 'lucide-react';
import { DeviceRuntimeState } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n';

type DeviceOperationDialogProps = {
  state: DeviceRuntimeState | null;
  cancelling: boolean;
  onCancel: (deviceId: string, operationId: number) => void;
};

export function DeviceOperationDialog({ state, cancelling, onCancel }: DeviceOperationDialogProps) {
  const t = useI18n();
  const operation = state?.activeOperation;
  const deviceId = state?.deviceId ?? null;
  const open = Boolean(operation && deviceId && operation.kind === 'manual-connect');
  const port = state?.transport?.serialPort ?? state?.matchedResourceId ?? '-';

  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('devices.operation.connectingTitle')}
          </DialogTitle>
          <DialogDescription>{t('devices.operation.connectingDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('devices.operation.deviceLabel')}</span>
            <span className="truncate font-medium">{deviceId ?? '-'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t('devices.operation.portLabel')}</span>
            <span className="truncate font-mono text-xs">{port}</span>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={!operation?.cancellable || !deviceId || cancelling}
            onClick={() => {
              if (deviceId && operation) {
                onCancel(deviceId, operation.operationId);
              }
            }}
          >
            {cancelling ? t('devices.operation.cancelling') : t('devices.operation.cancelConnection')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
