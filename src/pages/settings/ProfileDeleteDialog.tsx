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
import { useI18n } from '@/i18n';

type ProfileDeleteDialogProps = {
  open: boolean;
  profileName: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProfileDeleteDialog({
  open,
  profileName,
  onClose,
  onConfirm
}: ProfileDeleteDialogProps) {
  const t = useI18n();

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rules.profile.deleteDialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('rules.profile.deleteDialogDescription', { name: profileName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t('rules.profile.delete')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
