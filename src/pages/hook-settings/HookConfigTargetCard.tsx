import { HookConfigTargetStatus, HookConfigWriteResult } from '../../api/tauriApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { HookSettingsAlert } from './HookSettingsAlert';
import {
  AlertCircle,
  FileCode,
  FolderOpen,
  Eye,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useI18n } from '@/i18n';

type HookTargetBusyState = 'preview' | 'write' | 'restore';

type HookConfigTargetCardProps = {
  target: HookConfigTargetStatus;
  operationDisabled: boolean;
  configOutdated?: boolean;
  debugMode: boolean;
  error?: string;
  busy?: HookTargetBusyState;
  writeResult?: HookConfigWriteResult;
  onPreview: (targetId: string) => void;
  onWrite: (targetId: string) => void;
  onDebugModeChange: (targetId: string, enabled: boolean) => void;
  onRemove: (targetId: string) => void;
  onPreviewRestore?: (targetId: string) => void;
};

export function HookConfigTargetCard({
  target,
  operationDisabled,
  configOutdated = false,
  debugMode,
  error,
  busy,
  writeResult,
  onPreview,
  onWrite,
  onDebugModeChange,
  onRemove,
  onPreviewRestore
}: HookConfigTargetCardProps) {
  const t = useI18n();
  const isBusy = busy !== undefined;

  function handleRestoreOriginal() {
    if (!onPreviewRestore) return;
    onPreviewRestore(target.id);
  }

  function handleEnabledChange(checked: boolean) {
    if (checked) {
      if (target.scope === 'global') {
        onPreview(target.id);
        return;
      }
      onWrite(target.id);
      return;
    }
    handleRestoreOriginal();
  }

  const debugConfigMismatch = target.exists && debugMode !== target.debugEnabled;
  const eventConfigMismatch = target.exists && !target.matchesSelectedEvents;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {target.scope === 'global' ? (
                <FileCode className="h-4 w-4 text-muted-foreground" />
              ) : (
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              )}
              <h4 className="font-semibold">{target.label}</h4>
              <Badge variant={target.scope === 'global' ? 'default' : 'secondary'}>
                {target.scope === 'global'
                  ? t('hookSettings.targets.global')
                  : t('hookSettings.targets.project')}
              </Badge>
              <Badge variant={target.enabled ? 'default' : 'outline'}>
                {target.enabled
                  ? t('hookSettings.targets.enabled')
                  : t('hookSettings.targets.disabled')}
              </Badge>
              {configOutdated && target.exists && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t('hookSettings.targets.outdated')}
                </Badge>
              )}
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {target.projectPath && (
                <p className="break-all font-mono text-xs">{target.projectPath}</p>
              )}
              <p className="break-all font-mono text-xs">{target.configPath}</p>
              <p className="text-xs">
                {target.exists
                  ? t('hookSettings.targets.exists')
                  : t('hookSettings.targets.missing')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex h-9 items-center gap-2 rounded-md border px-3">
              <Switch
                id={`target-enabled-${target.id}`}
                checked={target.enabled}
                disabled={operationDisabled || isBusy || (target.enabled && !onPreviewRestore)}
                onCheckedChange={handleEnabledChange}
              />
              <Label htmlFor={`target-enabled-${target.id}`} className="text-xs">
                {t('hookSettings.targets.enable')}
              </Label>
            </div>
            <div className="flex h-9 items-center gap-2 rounded-md border px-3">
              <Switch
                id={`debug-${target.id}`}
                checked={debugMode}
                disabled={operationDisabled || isBusy}
                onCheckedChange={(checked) => onDebugModeChange(target.id, checked)}
              />
              <Label htmlFor={`debug-${target.id}`} className="text-xs">
                Debug
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={operationDisabled || isBusy}
              onClick={() => onPreview(target.id)}
            >
              <Eye className="mr-2 h-4 w-4" />
              {busy === 'preview' ? t('hookSettings.targets.previewing') : t('common.preview')}
            </Button>
          </div>
        </div>

        {configOutdated && target.exists && (
          <HookSettingsAlert icon={AlertTriangle} tone="destructive">
            {eventConfigMismatch
              ? t('hookSettings.targets.eventMismatch')
              : t('hookSettings.targets.debugMismatch')}
          </HookSettingsAlert>
        )}

        {debugMode ? (
          <HookSettingsAlert icon={AlertTriangle}>
            {t('hookSettings.targets.debugEnabled', {
              suffix: debugConfigMismatch ? t('hookSettings.targets.notUpdatedSuffix') : ''
            })}
          </HookSettingsAlert>
        ) : (
          <HookSettingsAlert icon={AlertTriangle} tone="warning">
            {t('hookSettings.targets.debugDisabled', {
              suffix: debugConfigMismatch ? t('hookSettings.targets.notUpdatedSuffix') : ''
            })}
          </HookSettingsAlert>
        )}

        {error && (
          <HookSettingsAlert icon={AlertCircle} tone="destructive">
            {error}
          </HookSettingsAlert>
        )}

        {target.enabled && writeResult && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10">
            <AlertDescription className="space-y-2">
              <p className="font-medium text-emerald-800 dark:text-emerald-200">
                {t('hookSettings.targets.enableDone')}
              </p>
              <p className="break-all font-mono text-xs text-emerald-700 dark:text-emerald-300">
                {writeResult.configPath}
              </p>
              <p className="break-all font-mono text-xs text-emerald-700 dark:text-emerald-300">
                {t('hookSettings.targets.backup', { path: writeResult.backupPath })}
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          {target.scope === 'project' && (
            <Button
              variant="destructive"
              size="sm"
              disabled={isBusy}
              onClick={() => onRemove(target.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('hookSettings.targets.removeTarget')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
