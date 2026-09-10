import { appInfo } from '@/domain/appInfo';
import { useI18n } from '@/i18n';
import { AppUpdateIndicator } from './AppUpdateIndicator';

type AppSidebarInfoProps = {
  updateAvailable?: boolean;
  latestVersion?: string;
  onOpenUpdate?: () => void;
};

export function AppSidebarInfo({
  updateAvailable = false,
  latestVersion,
  onOpenUpdate = () => undefined
}: AppSidebarInfoProps) {
  const t = useI18n();
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{appInfo.productName}</span>
        <span>{t('appInfo.version', { version: appInfo.version })}</span>
      </div>
      {updateAvailable && <AppUpdateIndicator latestVersion={latestVersion} />}
      <div className="mt-2 flex items-center justify-between gap-3">
        <span>{t('appInfo.developer')}</span>
        <span className="font-medium text-foreground">{appInfo.developer}</span>
      </div>
    </>
  );

  if (updateAvailable) {
    return (
      <button
        type="button"
        aria-label={t('appInfo.updateAvailableAria', { version: latestVersion ?? '' })}
        className="w-full rounded-lg border border-amber-500/60 bg-amber-100 px-3 py-3 text-left text-xs text-amber-900 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 dark:bg-amber-950/60 dark:text-amber-100 dark:hover:bg-amber-900/70"
        onClick={onOpenUpdate}
      >
        {content}
      </button>
    );
  }

  return (
    <section
      aria-label={t('appInfo.ariaLabel')}
      className="rounded-lg border border-border bg-background/60 px-3 py-3 text-xs text-muted-foreground"
    >
      {content}
    </section>
  );
}
