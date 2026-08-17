import { useMemo } from 'react';
import { HookConfigWritePreview } from '../../api/tauriApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { HookSettingsAlert } from './HookSettingsAlert';
import { useI18n } from '@/i18n';
import { useDocumentDarkTheme } from '@/hooks/useThemeMode';

type HookConfigPreviewDialogProps = {
  preview: HookConfigWritePreview;
  mode?: 'write' | 'restore';
  targetLabel: string;
  busy?: boolean;
  onClose: () => void;
  onWrite: (targetId: string) => void;
};

export function HookConfigPreviewDialog({
  preview,
  mode = 'write',
  targetLabel,
  busy = false,
  onClose,
  onWrite
}: HookConfigPreviewDialogProps) {
  const t = useI18n();
  // 格式化 JSON 以便更好地对比
  const formattedOldJson = useMemo(() => {
    if (!preview.originalJson) return '';
    try {
      const parsed = JSON.parse(preview.originalJson);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return preview.originalJson;
    }
  }, [preview.originalJson]);

  const formattedNewJson = useMemo(() => {
    try {
      const parsed = JSON.parse(preview.previewJson);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return preview.previewJson;
    }
  }, [preview.previewJson]);

  const hasOriginal = preview.configExists && formattedOldJson.length > 0;
  const isRestoreMode = mode === 'restore';
  const isGlobalWriteMode = mode === 'write' && preview.targetId.startsWith('global-');
  const isDarkTheme = useDocumentDarkTheme();

  // 自定义 diff 样式
  const diffStyles = {
    variables: {
      light: {
        diffViewerBackground: '#fff',
        diffViewerColor: '#212529',
        addedBackground: '#e6ffed',
        addedColor: '#24292e',
        removedBackground: '#ffeef0',
        removedColor: '#24292e',
        wordAddedBackground: '#acf2bd',
        wordRemovedBackground: '#fdb8c0',
        addedGutterBackground: '#cdffd8',
        removedGutterBackground: '#ffdce0',
        gutterBackground: '#f7f7f7',
        gutterBackgroundDark: '#f3f1f1',
        highlightBackground: '#fffbdd',
        highlightGutterBackground: '#fff5b1',
      },
      dark: {
        diffViewerBackground: 'hsl(222.2 84% 4.9%)',
        diffViewerColor: 'hsl(210 40% 98%)',
        addedBackground: 'rgba(16, 185, 129, 0.16)',
        addedColor: 'hsl(210 40% 98%)',
        removedBackground: 'rgba(239, 68, 68, 0.16)',
        removedColor: 'hsl(210 40% 98%)',
        wordAddedBackground: 'rgba(16, 185, 129, 0.28)',
        wordRemovedBackground: 'rgba(239, 68, 68, 0.28)',
        addedGutterBackground: 'rgba(16, 185, 129, 0.2)',
        removedGutterBackground: 'rgba(239, 68, 68, 0.2)',
        gutterBackground: 'hsl(217.2 32.6% 17.5%)',
        gutterBackgroundDark: 'hsl(217.2 32.6% 17.5%)',
        highlightBackground: 'rgba(245, 158, 11, 0.18)',
        highlightGutterBackground: 'rgba(245, 158, 11, 0.22)',
      },
    },
    line: {
      padding: '10px 2px',
      fontSize: '12px',
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    },
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {t('hookSettings.previewDialog.title', {
              mode: isRestoreMode
                ? t('hookSettings.previewDialog.restoreMode')
                : t('hookSettings.previewDialog.writeMode'),
              targetLabel
            })}
          </DialogTitle>
          <DialogDescription>
            {isRestoreMode
              ? t('hookSettings.previewDialog.restoreDescription')
              : t('hookSettings.previewDialog.writeDescription', {
                  existsMessage: preview.configExists
                    ? t('hookSettings.previewDialog.exists')
                    : t('hookSettings.previewDialog.missing'),
                  count: preview.eventCount
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          <div className="rounded-lg bg-muted p-3 font-mono text-sm break-all">
            {preview.configPath}
          </div>

          {preview.inlineHooksWarning && (
            <HookSettingsAlert icon={AlertCircle} tone="warning">
              {preview.inlineHooksWarning}
            </HookSettingsAlert>
          )}

          {isGlobalWriteMode && (
            <HookSettingsAlert icon={AlertCircle} tone="warning">
              {t('hookSettings.previewDialog.globalEnableWarning')}
            </HookSettingsAlert>
          )}

          {hasOriginal ? (
            <Tabs defaultValue="diff" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="diff">{t('hookSettings.previewDialog.diff')}</TabsTrigger>
                <TabsTrigger value="old">{t('hookSettings.previewDialog.oldConfig')}</TabsTrigger>
                <TabsTrigger value="new">
                  {isRestoreMode
                    ? t('hookSettings.previewDialog.restoredConfig')
                    : t('hookSettings.previewDialog.newConfig')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="diff" className="mt-4">
                <div className="rounded-lg border overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <ReactDiffViewer
                      oldValue={formattedOldJson}
                      newValue={formattedNewJson}
                      splitView={true}
                      compareMethod={DiffMethod.WORDS}
                      leftTitle={t('hookSettings.previewDialog.oldConfig')}
                      rightTitle={
                        isRestoreMode
                          ? t('hookSettings.previewDialog.restoredConfig')
                          : t('hookSettings.previewDialog.newConfig')
                      }
                      styles={diffStyles}
                      useDarkTheme={isDarkTheme}
                      showDiffOnly={false}
                    />
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  <p>• {t('hookSettings.previewDialog.deletedLegend')}</p>
                  <p>• {t('hookSettings.previewDialog.addedLegend')}</p>
                  <p>• {t('hookSettings.previewDialog.contextLegend')}</p>
                </div>
              </TabsContent>

              <TabsContent value="old" className="mt-4">
                <div className="rounded-lg border overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <pre className="bg-slate-950 p-4 text-xs text-slate-100">
                      {formattedOldJson}
                    </pre>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="new" className="mt-4">
                <div className="rounded-lg border overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <pre className="bg-slate-950 p-4 text-xs text-slate-100">
                      {formattedNewJson}
                    </pre>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">
                {isRestoreMode
                  ? t('hookSettings.previewDialog.restoredConfig')
                  : t('hookSettings.previewDialog.configToWrite')}
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-[500px] overflow-auto">
                  <pre className="bg-slate-950 p-4 text-xs text-slate-100">
                    {formattedNewJson}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t('common.close')}
          </Button>
          <Button disabled={busy} onClick={() => onWrite(preview.targetId)}>
            {busy
              ? isRestoreMode
                ? t('hookSettings.previewDialog.restoring')
                : t('hookSettings.previewDialog.writing')
              : isRestoreMode
                ? t('hookSettings.previewDialog.confirmRestore')
                : t('hookSettings.previewDialog.write')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
