import { FolderOpen } from 'lucide-react';
import { HookConfigTargetStatus, HookConfigWriteResult } from '../../api/tauriApi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { HookConfigTargetCard } from './HookConfigTargetCard';
import { HookSettingsAlert } from './HookSettingsAlert';
import { defaultTargetDebugEnabled } from './hookTargetDebugMode';
import { useI18n } from '@/i18n';

type HookTargetBusyState = 'preview' | 'write' | 'restore';

type HookConfigTargetPanelProps = {
  error?: string;
  operationDisabled: boolean;
  targets: HookConfigTargetStatus[];
  targetErrors: Record<string, string>;
  targetBusy: Record<string, HookTargetBusyState>;
  targetDebugModes: Record<string, boolean>;
  writeResults: Record<string, HookConfigWriteResult>;
  configOutdated: Record<string, boolean>;
  onAddProjectTarget: () => void;
  onPreviewTarget: (targetId: string) => void;
  onPreviewRestoreTarget: (targetId: string) => void;
  onWriteTarget: (targetId: string) => void;
  onRemoveTarget: (targetId: string) => void;
  onTargetDebugModeChange: (targetId: string, enabled: boolean) => void;
};

export function HookConfigTargetPanel({
  error,
  operationDisabled,
  targets,
  targetErrors,
  targetBusy,
  targetDebugModes,
  writeResults,
  configOutdated,
  onAddProjectTarget,
  onPreviewTarget,
  onPreviewRestoreTarget,
  onWriteTarget,
  onRemoveTarget,
  onTargetDebugModeChange
}: HookConfigTargetPanelProps) {
  const t = useI18n();

  return (
    <Card data-testid="hook-config-targets-section">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('hookSettings.targets.title')}</CardTitle>
            <CardDescription className="mt-1.5">
              {t('hookSettings.targets.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <HookSettingsAlert icon={AlertCircle} tone="destructive">
            {error}
          </HookSettingsAlert>
        )}
        <HookSettingsAlert icon={AlertCircle} tone="warning">
          {t('hookSettings.targets.enableHint')}
        </HookSettingsAlert>
        {targets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('hookSettings.targets.empty')}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {targets.map((target) => (
              <HookConfigTargetCard
                error={targetErrors[target.id]}
                key={target.id}
                operationDisabled={operationDisabled}
                configOutdated={configOutdated[target.id] || false}
                target={target}
                busy={targetBusy[target.id]}
                debugMode={
                  targetDebugModes[target.id] ?? defaultTargetDebugEnabled(targets, target.id)
                }
                writeResult={writeResults[target.id]}
                onPreview={onPreviewTarget}
                onRemove={onRemoveTarget}
                onDebugModeChange={onTargetDebugModeChange}
                onWrite={onWriteTarget}
                onPreviewRestore={onPreviewRestoreTarget}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
