import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2, Send, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  AiToolId,
  DebugLogEntryView,
  DebugTestEventRequestView,
  HookEventDefinitionView,
  LocalHookServerStatusView,
  aiTools
} from '../../state/appStore';
import {
  applyDebugLogFilters,
  debugLogFilterOptions,
  defaultDebugLogFilters,
  DebugLogFilters
} from './debugLogFilters';
import { DebugEventDetailDialog } from './DebugEventDetailDialog';
import { useI18n } from '@/i18n';
import { hookEventTitle } from '@/lib/hookEventText';

type DebugPageProps = {
  entries: DebugLogEntryView[];
  hookCatalog: HookEventDefinitionView[];
  hookServerStatus: LocalHookServerStatusView;
  selectedToolId: AiToolId;
  testDialogRequestId?: number;
  onSendTestEvent: (event: DebugTestEventRequestView) => void;
  onRefresh: () => void;
  onClear: () => void;
};

const PAGE_SIZE = 20;
const DEFAULT_PAYLOAD = JSON.stringify({ captured: false, source: 'debug-page' }, null, 2);

export function DebugPage({
  entries,
  hookCatalog,
  hookServerStatus,
  selectedToolId,
  testDialogRequestId = 0,
  onSendTestEvent,
  onRefresh,
  onClear
}: DebugPageProps) {
  const t = useI18n();
  const [currentPage, setCurrentPage] = useState(1);
  const [detailEntry, setDetailEntry] = useState<DebugLogEntryView | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testSource, setTestSource] = useState<AiToolId>(selectedToolId);
  const [testEvent, setTestEvent] = useState(
    preferredTestEvent(hookCatalog, selectedToolId)?.event ?? ''
  );
  const [testPayload, setTestPayload] = useState(DEFAULT_PAYLOAD);
  const [filters, setFilters] = useState<DebugLogFilters>(defaultDebugLogFilters);
  const filterOptions = useMemo(() => debugLogFilterOptions(entries), [entries]);
  const filteredEntries = useMemo(
    () => applyDebugLogFilters(entries, filters),
    [entries, filters]
  );
  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedEntries = filteredEntries.slice(startIndex, endIndex);
  const testEvents = hookCatalog.filter((event) => event.source === testSource);

  useEffect(() => {
    if (testDialogRequestId <= 0) {
      return;
    }

    openTestDialog();
  }, [testDialogRequestId]);

  function updateFilter<K extends keyof DebugLogFilters>(key: K, value: DebugLogFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  }

  function resetFilters() {
    setFilters(defaultDebugLogFilters);
    setCurrentPage(1);
  }

  function openTestDialog() {
    const preferred = preferredTestEvent(hookCatalog, selectedToolId);
    setTestSource(selectedToolId);
    setTestEvent(preferred?.event ?? '');
    setTestPayload(DEFAULT_PAYLOAD);
    setTestDialogOpen(true);
  }

  function handleTestSourceChange(source: AiToolId) {
    const preferred = preferredTestEvent(hookCatalog, source);
    setTestSource(source);
    setTestEvent(preferred?.event ?? '');
  }

  async function submitTestEvent() {
    if (!testEvent) {
      return;
    }
    await onSendTestEvent({
      source: testSource,
      event: testEvent,
      payload: testPayload
    });
    setTestDialogOpen(false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('debug.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('debug.description')}</p>
      </div>

      {/* Hook 服务状态 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('debug.localHookServer')}</CardTitle>
          <CardDescription>{t('debug.localHookServerDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={hookServerStatus.running ? 'default' : 'destructive'}>
              {hookServerStatus.running ? t('debug.running') : t('debug.failed')}
            </Badge>
          </div>
          <div className="space-y-2 rounded-lg bg-muted p-4 text-sm font-mono">
            <p>
              <span className="font-medium">Event URL:</span>{' '}
              <code className="ml-2">{hookServerStatus.eventUrl}</code>
            </p>
            <p>
              <span className="font-medium">Health URL:</span>{' '}
              <code className="ml-2">{hookServerStatus.healthUrl}</code>
            </p>
          </div>
          {hookServerStatus.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{hookServerStatus.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={openTestDialog}>
          <Send className="mr-2 h-4 w-4" />
          {t('debug.sendTestEvent')}
        </Button>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('debug.refreshLog')}
        </Button>
        <Button variant="destructive" onClick={onClear}>
          <Trash2 className="mr-2 h-4 w-4" />
          {t('debug.clearLog')}
        </Button>
      </div>

      {/* Debug 日志 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle>{t('debug.debugLogTitle')}</CardTitle>
              <CardDescription className="mt-1.5">
                {t('debug.debugLogDescription', {
                  total: entries.length,
                  matched: filteredEntries.length,
                  range:
                    filteredEntries.length > 0
                      ? t('debug.debugLogRange', {
                          start: startIndex + 1,
                          end: Math.min(endIndex, filteredEntries.length)
                        })
                      : ''
                })}
              </CardDescription>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[150px_190px_150px_180px_1fr_auto]">
              <FilterSelect
                label={t('debug.sourceFilter')}
                value={filters.source}
                options={[
                  { value: 'all', label: t('debug.allSources') },
                  ...aiTools.map((tool) => ({ value: tool.id, label: tool.name }))
                ]}
                onChange={(value) => updateFilter('source', value)}
              />
              <FilterSelect
                label={t('debug.eventFilter')}
                value={filters.event}
                options={[
                  { value: 'all', label: t('debug.allEvents') },
                  ...filterOptions.events.map((event) => ({ value: event, label: event }))
                ]}
                onChange={(value) => updateFilter('event', value)}
              />
              <FilterSelect
                label={t('debug.resultFilter')}
                value={filters.result}
                options={[
                  { value: 'all', label: t('debug.allResults') },
                  ...filterOptions.results.map((result) => ({ value: result, label: result }))
                ]}
                onChange={(value) => updateFilter('result', value)}
              />
              <FilterSelect
                label={t('debug.stageFilter')}
                value={filters.mappingStage}
                options={[
                  { value: 'all', label: t('debug.allStages') },
                  ...filterOptions.mappingStages.map((stage) => ({ value: stage, label: stage }))
                ]}
                onChange={(value) => updateFilter('mappingStage', value)}
              />
              <div className="grid gap-1">
                <Label htmlFor="debug-log-keyword" className="text-xs text-muted-foreground">
                  {t('debug.keyword')}
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="debug-log-keyword"
                    className="pl-8"
                    placeholder={t('debug.keywordPlaceholder')}
                    value={filters.keyword}
                    onChange={(event) => updateFilter('keyword', event.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full" onClick={resetFilters}>
                  {t('common.reset')}
                </Button>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t('debug.previousPage')}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  {t('debug.nextPage')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">{t('debug.emptyLog')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openTestDialog}>
                <Send className="mr-2 h-4 w-4" />
                {t('debug.sendTestEvent')}
              </Button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">{t('debug.noMatchedLog')}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                {t('debug.resetFilters')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedEntries.map((entry, index) => (
                <div
                  key={`${entry.occurredAt}-${index}`}
                  className="rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-sm font-semibold">{entry.source}</code>
                        <span className="text-muted-foreground">/</span>
                        <code className="font-mono text-sm font-semibold">{entry.event}</code>
                        <Badge variant={resultBadgeVariant(entry.result)}>{entry.result}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>
                          {t('debug.internalEvent')}
                          <code className="ml-1 font-mono text-foreground">
                            {entry.internalEvent ?? '-'}
                          </code>
                        </span>
                        <span>
                          {t('debug.mappingStage')}
                          <code className="ml-1 font-mono text-foreground">
                            {entry.mappingStage ?? '-'}
                          </code>
                        </span>
                        <span>{entry.occurredAt}</span>
                      </div>
                      {entry.error && (
                        <p className="line-clamp-1 text-sm text-destructive">{entry.error}</p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setDetailEntry(entry)}>
                      <FileText className="mr-2 h-4 w-4" />
                      {t('debug.viewDetails')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('debug.testDialogTitle')}</DialogTitle>
            <DialogDescription>{t('debug.testDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>{t('debug.aiTool')}</Label>
              <Select
                value={testSource}
                onValueChange={(value) => handleTestSourceChange(value as AiToolId)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aiTools.map((tool) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('debug.hookEvent')}</Label>
              <Select value={testEvent} onValueChange={setTestEvent}>
                <SelectTrigger>
                  <SelectValue placeholder={t('debug.hookEventPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {testEvents.map((event) => (
                    <SelectItem key={event.event} value={event.event}>
                      {event.event} · {hookEventTitle(event, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('debug.payload')}</Label>
              <Textarea
                className="min-h-40 font-mono text-xs"
                value={testPayload}
                onChange={(event) => setTestPayload(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={submitTestEvent} disabled={!testEvent}>
              <Send className="mr-2 h-4 w-4" />
              {t('common.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DebugEventDetailDialog
        entry={detailEntry}
        open={detailEntry !== null}
        onOpenChange={(open) => !open && setDetailEntry(null)}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function preferredTestEvent(catalog: HookEventDefinitionView[], source: AiToolId) {
  const events = catalog.filter((event) => event.source === source);
  return (
    events.find((event) => event.event === 'UserPromptSubmit') ??
    events.find((event) => event.defaultSelected) ??
    events[0]
  );
}

function resultBadgeVariant(result: string): 'default' | 'secondary' | 'destructive' {
  if (result === 'accepted' || result === 'mapped') {
    return 'default';
  }
  if (result === 'skipped') {
    return 'secondary';
  }
  return 'destructive';
}
