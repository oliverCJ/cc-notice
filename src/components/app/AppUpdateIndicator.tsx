import { Download } from 'lucide-react';
import { useI18n } from '@/i18n';

type AppUpdateIndicatorProps = {
  latestVersion?: string;
};

export function AppUpdateIndicator({ latestVersion }: AppUpdateIndicatorProps) {
  const t = useI18n();

  return (
    <span className="mt-2 flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-100">
      <Download aria-hidden="true" className="h-3.5 w-3.5" />
      {t('appInfo.updateAvailable', { version: latestVersion ?? '' })}
    </span>
  );
}
