import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';
import {
  clearStorage,
  getStorageUsageSnapshot,
  type StorageCleanupResult,
  type StorageUsageEntry,
  type StorageUsageSnapshot
} from '@/api/tauriApi';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';

type ResultTone = 'success' | 'warning' | 'destructive';

export function StorageCleanupCard() {
  const t = useI18n();
  const { toast } = useToast();
  const [snapshot, setSnapshot] = useState<StorageUsageSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 进入设置页时不自动扫描，避免首屏被磁盘遍历拖慢。
  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getStorageUsageSnapshot();
      setSnapshot(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  const totalBytes = useMemo(() => {
    if (!snapshot) {
      return 0;
    }
    return snapshot.cache.bytes + snapshot.logs.bytes;
  }, [snapshot]);

  const canClear = Boolean(snapshot) && !loading && !clearing;
  const isBusy = loading || clearing;

  async function handleClearConfirm() {
    setClearing(true);
    try {
      const result = await clearStorage();
      await loadSnapshot();
      const outcome = summarizeCleanupResult(result, t);
      toast({
        title: outcome.title,
        description: outcome.description,
        variant: outcome.tone === 'destructive' ? 'destructive' : 'default'
      });
    } catch (clearError) {
      toast({
        title: t('settings.storage.clearFailedTitle'),
        description: clearError instanceof Error ? clearError.message : String(clearError),
        variant: 'destructive'
      });
    } finally {
      setClearing(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {t('settings.storage.title')}
          </CardTitle>
          <CardDescription>{t('settings.storage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid gap-3 md:grid-cols-2">
            <StorageUsageBlock
              label={t('settings.storage.cacheLabel')}
              entry={snapshot?.cache ?? null}
              loading={loading}
              statusText={snapshot ? storageUsageStatusText(snapshot.cache.status, t) : null}
            />
            <StorageUsageBlock
              label={t('settings.storage.logsLabel')}
              entry={snapshot?.logs ?? null}
              loading={loading}
              statusText={snapshot ? storageUsageStatusText(snapshot.logs.status, t) : null}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void loadSnapshot()} disabled={isBusy}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              {loading ? t('common.loading') : t('settings.storage.refresh')}
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={!canClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              {clearing ? t('common.saving') : t('settings.storage.clear')}
            </Button>
            <p className="text-sm text-muted-foreground">
              {snapshot
                ? t('settings.storage.totalSummary', { bytes: formatBytes(totalBytes) })
                : t('settings.storage.totalSummary', { bytes: '-' })}
            </p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={(nextOpen) => !nextOpen && setConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.storage.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.storage.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearConfirm} disabled={clearing}>
              {clearing ? t('common.saving') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StorageUsageBlock({
  label,
  entry,
  loading,
  statusText
}: {
  label: string;
  entry: StorageUsageEntry | null;
  loading: boolean;
  statusText: string | null;
}) {
  const t = useI18n();

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-foreground">{label}</p>
        <span className="text-xs text-muted-foreground">
          {loading ? t('common.loading') : statusText ?? t('settings.storage.unknown')}
        </span>
      </div>
      <p className="mt-2 break-all text-xs text-muted-foreground">
        {entry?.path ?? t('settings.storage.unresolvedPath')}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <StatItem label={t('settings.storage.size')} value={entry ? formatBytes(entry.bytes) : '-'} />
        <StatItem
          label={t('settings.storage.files')}
          value={entry ? String(entry.fileCount) : '-'}
        />
        <StatItem
          label={t('settings.storage.directories')}
          value={entry ? String(entry.directoryCount) : '-'}
        />
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function storageUsageStatusText(
  status: StorageUsageEntry['status'],
  t: ReturnType<typeof useI18n>
) {
  switch (status) {
    case 'ok':
      return t('settings.storage.status.ok');
    case 'missing':
      return t('settings.storage.status.missing');
    case 'unreadable':
      return t('settings.storage.status.unreadable');
    default:
      return null;
  }
}

function summarizeCleanupResult(
  result: StorageCleanupResult,
  t: ReturnType<typeof useI18n>
): {
  tone: ResultTone;
  title: string;
  description: string;
} {
  const entries = [result.cache, result.logs];
  const partial = entries.some((entry) => entry.status === 'partial');
  const failed = entries.some((entry) => entry.status === 'failed');
  const removedBytes = result.cache.removedBytes + result.logs.removedBytes;
  const cleanedTargets = entries.filter((entry) => entry.status === 'cleaned').length;
  const missingTargets = entries.filter((entry) => entry.status === 'missing').length;

  if (!partial && !failed) {
    return {
      tone: 'success',
      title: t('settings.storage.clearSuccessTitle'),
      description: t('settings.storage.clearSuccessDescription', {
        bytes: formatBytes(removedBytes),
        cleanedTargets,
        missingTargets
      })
    };
  }

  return {
    tone: 'warning',
    title: t('settings.storage.clearPartialTitle'),
    description: t('settings.storage.clearPartialDescription', {
      bytes: formatBytes(removedBytes),
      cacheStatus: t(`settings.storage.status.${result.cache.status}`),
      logsStatus: t(`settings.storage.status.${result.logs.status}`)
    })
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 'B';
  for (const nextUnit of units) {
    value /= 1024;
    unit = nextUnit;
    if (value < 1024 || nextUnit === units.at(-1)) {
      break;
    }
  }
  return `${value.toFixed(1)} ${unit}`;
}
