import { useI18n } from '@/i18n';

type SetupStepActionsProps = {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
};

export function SetupStepActions({
  canGoBack,
  canGoNext,
  onBack,
  onNext
}: SetupStepActionsProps) {
  const t = useI18n();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canGoBack ? (
        <button
          className="rounded-md border border-input px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={onBack}
        >
          {t('setup.previous')}
        </button>
      ) : null}
      {canGoNext ? (
        <button
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={onNext}
        >
          {t('setup.next')}
        </button>
      ) : null}
    </div>
  );
}
