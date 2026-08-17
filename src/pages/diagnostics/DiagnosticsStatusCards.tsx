import { Activity, AlertTriangle, CheckCircle2, CircleHelp } from 'lucide-react';
import { DiagnosticSection } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  diagnosticSectionTitleKey,
  diagnosticStatusLabelKey,
  fallbackText
} from './diagnosticsText';
import { diagnosticStatusBadgeVariant, diagnosticStatusBorderClass } from './diagnosticsSeverity';

type DiagnosticsStatusCardsProps = {
  sections: DiagnosticSection[];
};

export function DiagnosticsStatusCards({ sections }: DiagnosticsStatusCardsProps) {
  const t = useI18n();

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {sections.map((section) => {
        const Icon = iconForStatus(section.status);
        return (
          <Card
            key={section.id}
            className={cn('border-l-4', diagnosticStatusBorderClass(section.status))}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                <p className="truncate text-xs text-muted-foreground">
                  {fallbackText(t(diagnosticSectionTitleKey(section.id)), section.id)}
                </p>
                <Badge
                  variant={diagnosticStatusBadgeVariant(section.status)}
                  className="max-w-full truncate"
                >
                  {t(diagnosticStatusLabelKey(section.status))}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function iconForStatus(status: DiagnosticSection['status']) {
  if (status === 'ok') {
    return CheckCircle2;
  }
  if (status === 'error') {
    return AlertTriangle;
  }
  if (status === 'unknown') {
    return CircleHelp;
  }
  return Activity;
}
