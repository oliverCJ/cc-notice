import { DiagnosticActionKind, DiagnosticIssue } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import {
  diagnosticIssueDescriptionKey,
  diagnosticIssueSuggestionKey,
  diagnosticActionLabelKey,
  diagnosticIssueTitleKey,
  diagnosticSeverityLabelKey,
  fallbackText
} from './diagnosticsText';
import { diagnosticSeverityBadgeVariant } from './diagnosticsSeverity';

type DiagnosticsIssueListProps = {
  issues: DiagnosticIssue[];
  onAction: (action: DiagnosticActionKind) => void;
};

export function DiagnosticsIssueList({ issues, onAction }: DiagnosticsIssueListProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('diagnostics.issues.title')}</CardTitle>
        <CardDescription>{t('diagnostics.issues.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('diagnostics.issues.empty')}</p>
        ) : (
          issues.map((issue, index) => (
            <div key={`${issue.id}-${index}`} className="rounded-lg border p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={diagnosticSeverityBadgeVariant(issue.severity)}>
                      {t(diagnosticSeverityLabelKey(issue.severity))}
                    </Badge>
                    <p className="font-medium">
                      {fallbackText(t(diagnosticIssueTitleKey(issue.id)), issue.id)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {fallbackText(t(diagnosticIssueDescriptionKey(issue.id)), '')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fallbackText(t(diagnosticIssueSuggestionKey(issue.id)), '')}
                  </p>
                  {issue.context && (
                    <p className="break-all text-sm text-muted-foreground">{issue.context}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => onAction(issue.action)}>
                  {t(diagnosticActionLabelKey(issue.action))}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
