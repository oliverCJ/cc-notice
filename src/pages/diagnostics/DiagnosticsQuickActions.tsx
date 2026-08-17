import { DiagnosticAction, DiagnosticActionKind } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { diagnosticActionLabelKey } from './diagnosticsText';

type DiagnosticsQuickActionsProps = {
  actions: DiagnosticAction[];
  loading: boolean;
  onAction: (action: DiagnosticActionKind) => void;
};

export function DiagnosticsQuickActions({
  actions,
  loading,
  onAction
}: DiagnosticsQuickActionsProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('diagnostics.quickActions.title')}</CardTitle>
        <CardDescription>{t('diagnostics.quickActions.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <Button
            key={action.kind}
            variant="outline"
            disabled={!action.enabled || loading}
            onClick={() => onAction(action.kind)}
          >
            {t(diagnosticActionLabelKey(action.kind))}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
