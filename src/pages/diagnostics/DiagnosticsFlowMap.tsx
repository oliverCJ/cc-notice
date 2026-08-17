import { ArrowRight } from 'lucide-react';
import { DiagnosticSection } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import {
  diagnosticSectionTitleKey,
  diagnosticStatusLabelKey,
  fallbackText
} from './diagnosticsText';
import { diagnosticStatusBadgeVariant } from './diagnosticsSeverity';

type DiagnosticsFlowMapProps = {
  sections: DiagnosticSection[];
};

const flowSectionIds = ['hookService', 'relay', 'hookConfig', 'profile', 'devices'];

export function DiagnosticsFlowMap({ sections }: DiagnosticsFlowMapProps) {
  const t = useI18n();
  const sectionById = new Map(sections.map((section) => [section.id, section]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('diagnostics.flow.title')}</CardTitle>
        <CardDescription>{t('diagnostics.flow.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-[repeat(5,minmax(0,1fr))]">
          {flowSectionIds.map((sectionId, index) => {
            const section = sectionById.get(sectionId);
            return (
              <div key={sectionId} className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 p-3">
                  <p className="truncate text-sm font-medium">
                    {fallbackText(t(diagnosticSectionTitleKey(sectionId)), sectionId)}
                  </p>
                  <Badge
                    variant={diagnosticStatusBadgeVariant(section?.status ?? 'unknown')}
                    className="mt-2 max-w-full truncate"
                  >
                    {t(diagnosticStatusLabelKey(section?.status ?? 'unknown'))}
                  </Badge>
                </div>
                {index < flowSectionIds.length - 1 && (
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
