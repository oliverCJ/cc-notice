import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DebugLogEntryView } from '@/state/appStore';
import { useI18n } from '@/i18n';

type RuntimeRecentEventsProps = {
  entries: DebugLogEntryView[];
  onOpenDetail: (entry: DebugLogEntryView) => void;
};

export function RuntimeRecentEvents({ entries, onOpenDetail }: RuntimeRecentEventsProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('monitor.recent.title')}</CardTitle>
        <CardDescription>{t('monitor.recent.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            {t('monitor.recent.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <div
                key={`${entry.occurredAt}-${index}`}
                className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-sm">{entry.source}</code>
                    <span className="text-muted-foreground">/</span>
                    <code className="font-mono text-sm">{entry.event}</code>
                    <Badge variant={entry.result === 'error' ? 'destructive' : 'secondary'}>
                      {entry.result}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {t('monitor.recent.internalEvent', { event: entry.internalEvent ?? '-' })} · {entry.occurredAt}
                    {entry.error ? ` · ${entry.error}` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenDetail(entry)}>
                  <FileText className="mr-2 h-4 w-4" />
                  {t('monitor.recent.details')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
