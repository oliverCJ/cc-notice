import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateVariable, templateVariableSourceLabel } from './templateVariables';
import { useI18n } from '@/i18n';

type TemplateVariableHelperProps = {
  variables: TemplateVariable[];
  onInsert: (token: string) => void;
  onCopy: (token: string) => void;
};

export function TemplateVariableHelper({
  variables,
  onInsert,
  onCopy
}: TemplateVariableHelperProps) {
  const t = useI18n();
  const commonVariables = variables.filter((variable) => variable.common);
  const advancedVariables = variables.filter((variable) => !variable.common);

  return (
    <section
      role="region"
      aria-label={t('rules.variables.helper')}
      className="space-y-3 rounded-md border bg-background p-3 shadow-lg"
    >
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">{t('rules.variables.helper')}</h4>
        <p className="text-xs text-muted-foreground">
          {t('rules.variables.description')}
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {commonVariables.map((variable) => (
          <VariableItem
            key={variable.token}
            variable={variable}
            onInsert={onInsert}
            onCopy={onCopy}
          />
        ))}
      </div>
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          {t('rules.variables.expandAll')}
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {advancedVariables.map((variable) => (
            <VariableItem
              key={variable.token}
              variable={variable}
              onInsert={onInsert}
              onCopy={onCopy}
            />
          ))}
        </div>
      </details>
    </section>
  );
}

type VariableItemProps = {
  variable: TemplateVariable;
  onInsert: (token: string) => void;
  onCopy: (token: string) => void;
};

function VariableItem({ variable, onInsert, onCopy }: VariableItemProps) {
  const t = useI18n();
  const label = t(variable.labelKey);

  return (
    <div className="flex items-start justify-between gap-2 rounded-md border bg-background p-2">
      <button
        type="button"
        aria-label={t('rules.variables.insertAria', { label })}
        className="min-w-0 flex-1 text-left"
        onClick={() => onInsert(variable.token)}
      >
        <span className="flex items-center gap-2 text-xs font-medium">
          {label}
          <span className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
            {templateVariableSourceLabel(variable.source, t)}
          </span>
        </span>
        <code className="mt-1 block truncate rounded bg-muted px-1.5 py-1 text-xs">
          {variable.token}
        </code>
        <span className="mt-1 block text-xs text-muted-foreground">
          {t(variable.descriptionKey)}
        </span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('rules.variables.copyAria', { label })}
        onClick={() => onCopy(variable.token)}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
