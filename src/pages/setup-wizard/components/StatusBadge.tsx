import { useI18n } from '@/i18n';

export function StatusBadge({ running }: { running: boolean }) {
  const t = useI18n();

  return (
    <span
      className={
        running
          ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300'
          : 'rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive'
      }
    >
      {running ? t('setup.hookService.running') : t('setup.hookService.stopped')}
    </span>
  );
}
