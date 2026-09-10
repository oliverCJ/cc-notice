import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { appInfo } from '@/domain/appInfo';
import { formatPublishedAt, AppUpdateState } from '@/domain/appUpdate';
import { useI18n } from '@/i18n';

type AppUpdateCardProps = {
  state: AppUpdateState;
  onCheck: () => void;
  onOpenDownload: (url: string) => void;
};

export function AppUpdateCard({ state, onCheck, onOpenDownload }: AppUpdateCardProps) {
  const t = useI18n();
  const result = state.result;
  const publishedAt = formatPublishedAt(result?.publishedAt ?? null, navigator.language);
  const updateAvailable = result?.status === 'update-available';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.update.title')}</CardTitle>
        <CardDescription>{t('settings.update.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <p>{t('settings.update.currentVersion', { version: appInfo.version })}</p>
          {result && (
            <p className="text-muted-foreground">
              {t('settings.update.latestVersion', { version: result.latestVersion })}
            </p>
          )}
          {state.lastCheckedAt ? (
            <p className="text-muted-foreground">
              {t('settings.update.lastCheckedAt', {
                time:
                  formatPublishedAt(
                    new Date(state.lastCheckedAt).toISOString(),
                    navigator.language
                  ) ?? '',
              })}
            </p>
          ) : (
            <p className="text-muted-foreground">{t('settings.update.neverChecked')}</p>
          )}
        </div>

        {state.status === 'up-to-date' && (
          <p className="text-sm">{t('settings.update.upToDate')}</p>
        )}
        {updateAvailable && result && (
          <div className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
            <p className="font-medium">{t('settings.update.available')}</p>
            <p className="text-sm">
              {t('settings.update.releaseTitle', { name: result.releaseName })}
            </p>
            {publishedAt && (
              <p className="text-sm text-muted-foreground">
                {t('settings.update.publishedAt', { time: publishedAt })}
              </p>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('settings.update.releaseNotes')}</p>
              <div className="max-h-56 overflow-y-auto rounded-md border bg-background/60 p-3 text-sm whitespace-pre-wrap">
                {result.releaseBody || t('settings.update.noReleaseNotes')}
              </div>
            </div>
            <Button onClick={() => onOpenDownload(result.releaseUrl)}>
              <Download className="mr-2 h-4 w-4" />
              {t('settings.update.openDownload')}
            </Button>
          </div>
        )}

        {state.error && (
          <p className="text-sm text-destructive">
            {t('settings.update.checkFailed', { error: state.error })}
          </p>
        )}

        <Button variant="outline" onClick={onCheck} disabled={state.checking}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {state.checking ? t('settings.update.checking') : t('settings.update.check')}
        </Button>
      </CardContent>
    </Card>
  );
}
