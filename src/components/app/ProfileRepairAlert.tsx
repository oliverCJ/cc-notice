import { AlertTriangle } from 'lucide-react';
import { ProfileRepairReport } from '@/api/tauriApi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useI18n } from '@/i18n';

type ProfileRepairAlertProps = {
  profileName: string;
  repair?: ProfileRepairReport | null;
};

export function ProfileRepairAlert({ profileName, repair }: ProfileRepairAlertProps) {
  const t = useI18n();
  const items = buildProfileRepairItems(repair, t);

  if (items.length === 0) {
    return null;
  }

  return (
    <Alert className="mb-4 border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
      <AlertTitle>{t('profileRepair.title')}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{t('profileRepair.description', { profile: profileName })}</p>
        <ul className="list-disc space-y-1 pl-5">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t('profileRepair.action')}</p>
      </AlertDescription>
    </Alert>
  );
}

function buildProfileRepairItems(
  repair: ProfileRepairReport | null | undefined,
  t: ReturnType<typeof useI18n>
) {
  if (!repair) {
    return [];
  }
  const items: string[] = [];
  if (repair.isolatedUnrecoverableProfileId) {
    items.push(
      t('profileRepair.items.unrecoverableProfile', {
        profile: repair.isolatedUnrecoverableProfileId
      })
    );
  }
  if (repair.repairedProfileIdentity) {
    items.push(t('profileRepair.items.identity'));
  }
  if (repair.removedEnabledHookEvents > 0) {
    items.push(t('profileRepair.items.hookEvents', { count: repair.removedEnabledHookEvents }));
  }
  if (repair.removedAiEventMappings > 0) {
    items.push(t('profileRepair.items.aiMappings', { count: repair.removedAiEventMappings }));
  }
  if (repair.removedHardwareRules > 0) {
    items.push(t('profileRepair.items.hardwareRules', { count: repair.removedHardwareRules }));
  }
  if (repair.resetDevice) {
    items.push(t('profileRepair.items.device'));
  }
  return items;
}
