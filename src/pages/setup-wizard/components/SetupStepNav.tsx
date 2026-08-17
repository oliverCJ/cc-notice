import { setupFlowSteps, SetupStepId } from '../setupFlow';
import { useI18n } from '@/i18n';

type SetupStepNavProps = {
  activeStepId: SetupStepId;
  onSelectStep: (stepId: SetupStepId) => void;
};

export function SetupStepNav({ activeStepId, onSelectStep }: SetupStepNavProps) {
  const t = useI18n();

  return (
    <ol className="space-y-2 rounded-lg border border-border bg-card p-3 text-card-foreground">
      {setupFlowSteps.map((step, index) => (
        <li key={step.id}>
          <button
            className={
              activeStepId === step.id
                ? 'w-full rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary'
                : 'w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }
            onClick={() => onSelectStep(step.id)}
          >
            {t('setup.stepLabel', { index: index + 1, label: t(step.labelKey) })}
          </button>
        </li>
      ))}
    </ol>
  );
}
