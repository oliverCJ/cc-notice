import { InternalEventDefinition } from '@/api/tauriApi';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';

type CustomInternalEventDeleteDialogProps = {
  event: InternalEventDefinition | null;
  error?: string;
  onClose: () => void;
  onConfirm: (eventId: string) => void | Promise<void>;
};

export function CustomInternalEventDeleteDialog({
  event,
  error,
  onClose,
  onConfirm
}: CustomInternalEventDeleteDialogProps) {
  const t = useI18n();
  return (
    <AlertDialog open={Boolean(event)} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rules.internalCatalog.deleteDialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('rules.internalCatalog.deleteDialogDescription', {
              id: event?.id ?? ''
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => {
              if (event) {
                void Promise.resolve(onConfirm(event.id)).catch(() => undefined);
              }
            }}
          >
            {t('common.delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
