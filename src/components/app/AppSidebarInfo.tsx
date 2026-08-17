import { appInfo } from '@/domain/appInfo';
import { useI18n } from '@/i18n';

export function AppSidebarInfo() {
  const t = useI18n();

  return (
    <section
      aria-label={t('appInfo.ariaLabel')}
      className="rounded-lg border border-border bg-background/60 px-3 py-3 text-xs text-muted-foreground"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{appInfo.productName}</span>
        <span>{t('appInfo.version', { version: appInfo.version })}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span>{t('appInfo.developer')}</span>
        <span className="font-medium text-foreground">{appInfo.developer}</span>
      </div>
    </section>
  );
}
