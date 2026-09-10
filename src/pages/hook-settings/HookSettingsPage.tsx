import {
  HookConfigWritePreview,
  HookConfigWriteResult,
  HookEventFrontendState,
  HookEventSelections
} from '../../api/tauriApi';
import { AiToolId, aiTools } from '../../state/appStore';
import { HookEventSelectionPanel } from './HookEventSelectionPanel';
import { HookConfigPreviewDialog } from './HookConfigPreviewDialog';
import { HookConfigTargetPanel } from './HookConfigTargetPanel';
import { useHookEventSelection } from './useHookEventSelection';
import { defaultTargetDebugEnabled } from './hookTargetDebugMode';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Translator, useI18n } from '@/i18n';

type HookTargetBusyState = 'preview' | 'write' | 'restore';

type HookSettingsPageProps = {
  selectedToolId: AiToolId;
  hookConfigError?: string;
  hookConfigPreviewDialog: HookConfigWritePreview | null;
  hookConfigPreviewMode: 'write' | 'restore';
  hookEventState: HookEventFrontendState | null;
  hookTargetBusy: Record<string, HookTargetBusyState>;
  hookTargetDebugModes: Record<string, boolean>;
  hookTargetError?: string;
  hookTargetErrors: Record<string, string>;
  hookTargetWriteResults: Record<string, HookConfigWriteResult>;
  onAddProjectTarget: () => void;
  onCloseHookConfigPreview: () => void;
  onConfirmRestoreHookConfigTarget: (targetId: string) => void;
  onHookSelectionChange: (selections: HookEventSelections) => void;
  onPreviewHookConfigTarget: (targetId: string) => void;
  onPreviewRestoreHookConfigTarget: (targetId: string) => void;
  onRemoveHookConfigTarget: (targetId: string) => void;
  onSelectTool: (toolId: AiToolId) => void;
  onTargetDebugModeChange: (targetId: string, enabled: boolean) => void;
  onWriteHookConfigTarget: (targetId: string) => void;
};

export function HookSettingsPage({
  selectedToolId,
  hookConfigError,
  hookConfigPreviewDialog,
  hookConfigPreviewMode,
  hookEventState,
  hookTargetBusy,
  hookTargetDebugModes,
  hookTargetError,
  hookTargetErrors,
  hookTargetWriteResults,
  onAddProjectTarget,
  onCloseHookConfigPreview,
  onConfirmRestoreHookConfigTarget,
  onHookSelectionChange,
  onPreviewHookConfigTarget,
  onPreviewRestoreHookConfigTarget,
  onRemoveHookConfigTarget,
  onSelectTool,
  onTargetDebugModeChange,
  onWriteHookConfigTarget
}: HookSettingsPageProps) {
  const t = useI18n();
  const { applyRecommended, selectedEvents, toggleEvent, visibleEvents } =
    useHookEventSelection({
      hookEventState,
      onHookSelectionChange,
      selectedToolId
    });

  const visibleTargets =
    hookEventState?.targets.filter(
      (target) => target.source === selectedToolId && target.scope === 'global'
    ) ?? [];
  const previewTargetLabel =
    hookEventState?.targets.find((target) => target.id === hookConfigPreviewDialog?.targetId)
      ?.label ?? hookConfigPreviewDialog?.targetId ?? '';

  const configOutdated: Record<string, boolean> = {};
  visibleTargets.forEach((target) => {
    const debugMode =
      hookTargetDebugModes[target.id] ??
      defaultTargetDebugEnabled(hookEventState?.targets, target.id);
    const debugMismatch = debugMode !== target.debugEnabled;
    configOutdated[target.id] =
      target.exists && (!target.matchesSelectedEvents || debugMismatch);
  });
  const hookConfigDisplayError = displayHookConfigError(hookTargetError ?? hookConfigError, t);
  const legacyTargets =
    hookEventState?.legacyTargets?.filter((target) => target.source === selectedToolId) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('hookSettings.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('hookSettings.description')}</p>
      </div>

      {/* AI 工具切换 */}
      <Tabs value={selectedToolId} onValueChange={(val) => onSelectTool(val as AiToolId)}>
        <TabsList>
          {(hookEventState?.tools?.length
            ? hookEventState.tools.map((tool) => ({ id: tool.source, name: tool.displayName }))
            : aiTools
          ).map((tool) => (
            <TabsTrigger key={tool.id} value={tool.id}>
              {tool.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <HookEventSelectionPanel
        onApplyRecommended={applyRecommended}
        onToggleEvent={toggleEvent}
        selectedEvents={selectedEvents}
        selectedToolId={selectedToolId}
        visibleEvents={visibleEvents}
      />

      {legacyTargets.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>{t('hookSettings.legacy.message', { count: legacyTargets.length })}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPreviewRestoreHookConfigTarget(legacyTargets[0].id)}
          >
            {t('hookSettings.legacy.cleanup')}
          </Button>
        </div>
      )}

      {/* Hook 配置目标 */}
      <HookConfigTargetPanel
        error={hookConfigDisplayError}
        operationDisabled={selectedEvents.length === 0}
        targets={visibleTargets}
        targetBusy={hookTargetBusy}
        targetDebugModes={hookTargetDebugModes}
        targetErrors={hookTargetErrors}
        writeResults={hookTargetWriteResults}
        configOutdated={configOutdated}
        onAddProjectTarget={onAddProjectTarget}
        onPreviewTarget={onPreviewHookConfigTarget}
        onPreviewRestoreTarget={onPreviewRestoreHookConfigTarget}
        onRemoveTarget={onRemoveHookConfigTarget}
        onTargetDebugModeChange={onTargetDebugModeChange}
        onWriteTarget={onWriteHookConfigTarget}
      />

      {/* 预览对话框 */}
      {hookConfigPreviewDialog && (
        <HookConfigPreviewDialog
          preview={hookConfigPreviewDialog}
          mode={hookConfigPreviewMode}
          targetLabel={previewTargetLabel}
          busy={
            hookTargetBusy[hookConfigPreviewDialog.targetId] ===
            (hookConfigPreviewMode === 'restore' ? 'restore' : 'write')
          }
          onClose={onCloseHookConfigPreview}
          onWrite={
            hookConfigPreviewMode === 'restore'
              ? onConfirmRestoreHookConfigTarget
              : onWriteHookConfigTarget
          }
        />
      )}
    </div>
  );
}

function displayHookConfigError(error: string | undefined, t: Translator) {
  if (!error) {
    return undefined;
  }
  return error.startsWith('hookSettings.') ? t(error) : error;
}
