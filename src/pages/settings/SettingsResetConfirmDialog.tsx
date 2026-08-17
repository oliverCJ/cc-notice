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
import { buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { ResetConfigurationScope } from '@/api/tauriApi';

type SettingsResetConfirmDialogProps = {
  scope: ResetConfigurationScope | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (scope: ResetConfigurationScope) => void;
};

export function SettingsResetConfirmDialog({
  scope,
  busy,
  onClose,
  onConfirm
}: SettingsResetConfirmDialogProps) {
  const t = useI18n();
  const open = scope !== null;
  const destructive = scope === 'all';

  function handleConfirm() {
    if (scope) {
      onConfirm(scope);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {scope ? t(`settings.reset.scopes.${scope}.title`) : ''}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {scope ? t(`settings.reset.scopes.${scope}.description`) : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {scope ? t(`settings.reset.scopes.${scope}.warning`) : ''}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={handleConfirm}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
          >
            {busy ? t('settings.reset.resetting') : t('settings.reset.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
