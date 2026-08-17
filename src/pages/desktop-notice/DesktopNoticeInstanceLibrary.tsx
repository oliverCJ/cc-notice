import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Download, Eye, EyeOff, HelpCircle, Monitor, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { getDesktopMascotAssetPacks } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  createDefaultMascotSettings,
  DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS,
  DESKTOP_MASCOT_STAGE_SIZE_LIMITS,
  DESKTOP_MASCOT_STATES,
  DesktopMascotBubblePlacement,
  DesktopMascotBubbleFontId,
  DesktopMascotSettings,
  DesktopMascotState,
  CustomMascotDiagnostic,
  DesktopMascotRuntimePack,
  desktopMascotBubbleFontOptions,
  selectableMascotPacks
} from '@/domain/desktopMascot';
import { buildCustomMascotDiagnosticGroups } from '@/domain/desktopMascotDiagnostics';
import {
  createDefaultCustomLightbarSettings,
  createDefaultDesktopNoticeInstance,
  createDefaultEdgeLightbarSettings,
  DESKTOP_NOTICE_CORNER_RADIUS_LIMITS,
  DESKTOP_NOTICE_OPACITY_LIMITS,
  DESKTOP_NOTICE_SIZE_LIMITS,
  CustomLightbarSettings,
  desktopNoticeSizeForDirection,
  desktopNoticeValidationMessage,
  DesktopNoticeVariant,
  EdgeLightbarSettings,
  DesktopNoticeIdleBehavior,
  DesktopNoticeInstance,
  DesktopNoticePresetPosition,
  DesktopNoticeScreenEdge,
  recommendedDesktopNoticeDirection,
  validateDesktopNoticeInstance
} from '@/domain/desktopNotice';
import { useI18n } from '@/i18n';
import customMascotTemplateUrl from '@/assets/desktop-mascots/custom-gif-template.zip?url';

const DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT =
  'cc-notice://desktop-notice-window-bounds-changed';
const DELETE_ERROR_AUTO_DISMISS_MS = 5000;

type DesktopNoticeWindowBoundsChangedPayload = {
  instanceId: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  userInitiated?: boolean;
};

type DesktopNoticeInstanceLibraryProps = {
  instances: DesktopNoticeInstance[];
  onSaveInstance: (instance: DesktopNoticeInstance) => Promise<void>;
  onDeleteInstance: (instanceId: string) => Promise<void>;
  onPreviewInstance: (instanceId: string) => Promise<void>;
  onHidePreview: (instanceId: string) => Promise<void>;
  onSaveWindowBounds: (instanceId: string) => Promise<void>;
};

const presetPositionOptions: Array<{ value: DesktopNoticePresetPosition; label: string }> = [
  { value: 'top-center', label: '顶部居中' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'left-center', label: '左侧居中' },
  { value: 'right-center', label: '右侧居中' },
  { value: 'top-left', label: '左上角' },
  { value: 'top-right', label: '右上角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'bottom-right', label: '右下角' },
  { value: 'center', label: '屏幕居中' },
  { value: 'custom', label: '自定义位置' }
];

const idleBehaviorOptions: Array<{ value: DesktopNoticeIdleBehavior; labelKey: string }> = [
  { value: 'hidden', labelKey: 'desktopNotice.instance.idleBehaviorHidden' },
  { value: 'dim-placeholder', labelKey: 'desktopNotice.instance.idleBehaviorDimPlaceholder' },
  { value: 'keep-last', labelKey: 'desktopNotice.instance.idleBehaviorKeepLast' }
];

const mascotIdleBehaviorOptions: Array<{ value: DesktopNoticeIdleBehavior; labelKey: string }> = [
  { value: 'hidden', labelKey: 'desktopNotice.instance.idleBehaviorHidden' },
  { value: 'dim-placeholder', labelKey: 'desktopNotice.instance.mascotIdleBehaviorResident' }
];

const variantOptions: Array<{ value: DesktopNoticeVariant; labelKey: string }> = [
  { value: 'custom-lightbar', labelKey: 'desktopNotice.instance.variants.customLightbar' },
  { value: 'edge-lightbar', labelKey: 'desktopNotice.instance.variants.edgeLightbar' },
  { value: 'mascot', labelKey: 'desktopNotice.instance.variants.mascot' }
];

const screenEdgeOptions: Array<{ value: DesktopNoticeScreenEdge; labelKey: string }> = [
  { value: 'top', labelKey: 'desktopNotice.instance.edges.top' },
  { value: 'bottom', labelKey: 'desktopNotice.instance.edges.bottom' },
  { value: 'left', labelKey: 'desktopNotice.instance.edges.left' },
  { value: 'right', labelKey: 'desktopNotice.instance.edges.right' }
];

const mascotBubblePlacementOptions: Array<{
  value: DesktopMascotBubblePlacement;
  labelKey: string;
}> = [
  { value: 'top', labelKey: 'desktopNotice.mascot.bubblePlacements.top' },
  { value: 'top-left', labelKey: 'desktopNotice.mascot.bubblePlacements.topLeft' },
  { value: 'top-right', labelKey: 'desktopNotice.mascot.bubblePlacements.topRight' }
];

export function DesktopNoticeInstanceLibrary({
  instances,
  onSaveInstance,
  onDeleteInstance,
  onPreviewInstance,
  onHidePreview,
  onSaveWindowBounds
}: DesktopNoticeInstanceLibraryProps) {
  const t = useI18n();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(instances[0]?.id ?? null);
  const [draftInstance, setDraftInstance] = useState<DesktopNoticeInstance | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewVisibleIds, setPreviewVisibleIds] = useState<Set<string>>(() => new Set());
  const [pendingVariant, setPendingVariant] = useState<DesktopNoticeVariant | null>(null);
  const [customMascotPacks, setCustomMascotPacks] = useState<DesktopMascotRuntimePack[]>([]);
  const [customMascotDiagnostics, setCustomMascotDiagnostics] = useState<CustomMascotDiagnostic[]>([]);
  const [customMascotRootDir, setCustomMascotRootDir] = useState<string>('');
  const [customMascotScanError, setCustomMascotScanError] = useState<string | null>(null);
  const [customMascotScanning, setCustomMascotScanning] = useState(false);
  const [boundsSaveRequest, setBoundsSaveRequest] = useState<{
    instanceId: string;
    version: number;
  } | null>(null);
  const ignoreDraftAutosaveUntilRef = useRef(0);
  const deleteErrorTimerRef = useRef<number | null>(null);
  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? instances[0] ?? null,
    [instances, selectedId]
  );
  const desktopNoticeValidationOptions = useMemo(
    () => ({
      mascotAssetPackIds: customMascotPacks.map((pack) => pack.id)
    }),
    [customMascotPacks]
  );

  useEffect(() => {
    if (!selectedInstance && instances[0]) {
      setSelectedId(instances[0].id);
    }
  }, [instances, selectedInstance]);

  useEffect(() => {
    setDraftInstance(selectedInstance ? structuredClone(selectedInstance) : null);
    setFormError(null);
  }, [selectedInstance]);

  useEffect(() => {
    return () => {
      if (deleteErrorTimerRef.current !== null) {
        window.clearTimeout(deleteErrorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void refreshCustomMascotPacks();
  }, []);

  async function refreshCustomMascotPacks() {
    setCustomMascotScanning(true);
    setCustomMascotScanError(null);
    try {
      const result = await getDesktopMascotAssetPacks();
      setCustomMascotPacks(result.packs);
      setCustomMascotDiagnostics(result.diagnostics);
      setCustomMascotRootDir(result.rootDir);
    } catch (error) {
      setCustomMascotScanError(toErrorMessage(error));
    } finally {
      setCustomMascotScanning(false);
    }
  }

  async function handleCreate() {
    const next = createDefaultDesktopNoticeInstance();
    try {
      await onSaveInstance(next);
      setSelectedId(next.id);
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  function handlePatch(patch: Partial<DesktopNoticeInstance>) {
    if (!draftInstance) {
      return;
    }
    setDraftInstance({ ...draftInstance, ...patch });
    setFormError(null);
  }

  function handleCustomLightbarPatch(patch: Partial<CustomLightbarSettings>) {
    if (!draftInstance) {
      return;
    }
    const current = draftInstance.customLightbar ?? createDefaultCustomLightbarSettings();
    handlePatch({ customLightbar: { ...current, ...patch } });
  }

  function handleEdgeLightbarPatch(patch: Partial<EdgeLightbarSettings>) {
    if (!draftInstance) {
      return;
    }
    const current = draftInstance.edgeLightbar ?? createDefaultEdgeLightbarSettings();
    handlePatch({ edgeLightbar: { ...current, ...patch } });
  }

  function handleMascotPatch(patch: Partial<DesktopMascotSettings>) {
    if (!draftInstance) {
      return;
    }
    const current = draftInstance.mascot ?? createDefaultMascotSettings();
    handlePatch({ mascot: { ...current, ...patch } });
  }

  function requestVariantChange(nextVariant: DesktopNoticeVariant) {
    if (!draftInstance || nextVariant === draftInstance.variant) {
      return;
    }
    setPendingVariant(nextVariant);
  }

  function confirmVariantChange() {
    if (!draftInstance || !pendingVariant) {
      return;
    }
    setDraftInstance(createInstanceForVariant(draftInstance, pendingVariant));
    setPendingVariant(null);
    setFormError(null);
  }

  function handlePositionChange(position: DesktopNoticePresetPosition) {
    if (!draftInstance) {
      return;
    }
    if (position === 'custom') {
      handleCustomLightbarPatch({
        presetPosition: position
      });
      return;
    }
    const direction = recommendedDesktopNoticeDirection(position);
    const current = draftInstance.customLightbar ?? createDefaultCustomLightbarSettings();
    handleCustomLightbarPatch({
      presetPosition: position,
      direction,
      size: desktopNoticeSizeForDirection(current.size, direction),
      boundsOverride: null
    });
  }

  function handleResetVisualSettings() {
    if (!draftInstance) {
      return;
    }
    const defaults = createDefaultDesktopNoticeInstance();
    if (draftInstance.variant === 'edge-lightbar') {
      handlePatch({
        idleBehavior: defaults.idleBehavior,
        edgeLightbar: createDefaultEdgeLightbarSettings()
      });
    } else if (draftInstance.variant === 'mascot') {
      handlePatch({
        idleBehavior: defaults.idleBehavior,
        mascot: createDefaultMascotSettings()
      });
    } else {
      handlePatch({
        idleBehavior: defaults.idleBehavior,
        customLightbar: createDefaultCustomLightbarSettings()
      });
    }
    toast({
      title: t('desktopNotice.instance.resetSuccessTitle'),
      description: t('desktopNotice.instance.resetSuccessDescription')
    });
  }

  async function handleSaveDraft() {
    await saveDraft({ notify: true });
  }

  async function saveDraft(options: { notify?: boolean } = {}) {
    if (!draftInstance) {
      return false;
    }
    const validation = validateDesktopNoticeInstance(draftInstance, desktopNoticeValidationOptions);
    if (!validation.valid) {
      setFormError(desktopNoticeValidationMessage(validation.code));
      return false;
    }
    try {
      const savedName = draftInstance.name.trim();
      await onSaveInstance({
        ...normalizeInstanceForSave(draftInstance),
        name: savedName
      });
      if (options.notify) {
        toast({
          title: t('desktopNotice.instance.saveSuccessTitle'),
          description: t('desktopNotice.instance.saveSuccessDescription', {
            name: savedName
          })
        });
      }
      setFormError(null);
      return true;
    } catch (error) {
      setFormError(toErrorMessage(error));
      return false;
    }
  }

  async function handleDelete() {
    if (!selectedInstance) {
      return;
    }
    try {
      const deletedName = selectedInstance.name;
      await onDeleteInstance(selectedInstance.id);
      setSelectedId(null);
      setFormError(null);
      toast({
        title: t('desktopNotice.instance.deleteSuccessTitle'),
        description: t('desktopNotice.instance.deleteSuccessDescription', {
          name: deletedName
        })
      });
    } catch (error) {
      showTemporaryDeleteError(toErrorMessage(error));
    }
  }

  function showTemporaryDeleteError(message: string) {
    if (deleteErrorTimerRef.current !== null) {
      window.clearTimeout(deleteErrorTimerRef.current);
    }
    setFormError(message);
    deleteErrorTimerRef.current = window.setTimeout(() => {
      setFormError((current) => (current === message ? null : current));
      deleteErrorTimerRef.current = null;
    }, DELETE_ERROR_AUTO_DISMISS_MS);
  }

  async function handlePreviewToggle() {
    if (!selectedInstance || !draftInstance) {
      return;
    }
    setPreviewBusy(true);
    const openingPreview = !previewVisibleIds.has(selectedInstance.id);
    try {
      if (!openingPreview) {
        await onHidePreview(selectedInstance.id);
        setPreviewVisibleIds((current) => {
          const next = new Set(current);
          next.delete(selectedInstance.id);
          return next;
        });
        setFormError(null);
        return;
      }
      const saved = await saveDraft();
      if (!saved) {
        return;
      }
      await onPreviewInstance(selectedInstance.id);
      setPreviewVisibleIds((current) => new Set(current).add(selectedInstance.id));
      setFormError(null);
    } catch (error) {
      if (openingPreview) {
        void onHidePreview(selectedInstance.id).catch((cleanupError) => {
          console.warn('failed to cleanup desktop notice preview after open failure', cleanupError);
        });
        setPreviewVisibleIds((current) => {
          const next = new Set(current);
          next.delete(selectedInstance.id);
          return next;
        });
      }
      setFormError(toErrorMessage(error));
    } finally {
      setPreviewBusy(false);
    }
  }

  const validation = draftInstance
    ? validateDesktopNoticeInstance(draftInstance, desktopNoticeValidationOptions)
    : null;
  const previewVisible = selectedInstance ? previewVisibleIds.has(selectedInstance.id) : false;

  useEffect(() => {
    if (!draftInstance || !selectedInstance || !previewVisibleIds.has(draftInstance.id)) {
      return;
    }
    const normalizedDraft = normalizeInstanceForSave(draftInstance);
    if (sameInstanceConfig(normalizedDraft, selectedInstance)) {
      return;
    }
    if (Date.now() < ignoreDraftAutosaveUntilRef.current) {
      return;
    }
    const validationResult = validateDesktopNoticeInstance(
      normalizedDraft,
      desktopNoticeValidationOptions
    );
    if (!validationResult.valid) {
      setFormError(desktopNoticeValidationMessage(validationResult.code));
      return;
    }
    const timer = window.setTimeout(() => {
      void onSaveInstance(normalizedDraft).catch((error) => setFormError(toErrorMessage(error)));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    desktopNoticeValidationOptions,
    draftInstance,
    onSaveInstance,
    previewVisibleIds,
    selectedInstance
  ]);

  useEffect(() => {
    if (!boundsSaveRequest) {
      return;
    }
    const { instanceId, version } = boundsSaveRequest;
    const timer = window.setTimeout(() => {
      const normalizedDraft =
        draftInstance?.id === instanceId ? normalizeInstanceForSave(draftInstance) : null;
      const shouldSaveDraftFirst =
        normalizedDraft &&
        selectedInstance?.id === instanceId &&
        !sameInstanceConfig(normalizedDraft, selectedInstance) &&
        validateDesktopNoticeInstance(normalizedDraft, desktopNoticeValidationOptions).valid;
      void Promise.resolve()
        .then(async () => {
          if (shouldSaveDraftFirst && normalizedDraft) {
            await onSaveInstance(normalizedDraft);
          }
          await onSaveWindowBounds(instanceId);
        })
        .then(() => {
          setFormError(null);
        })
        .catch((error) => setFormError(toErrorMessage(error)))
        .finally(() => {
          ignoreDraftAutosaveUntilRef.current = 0;
          setBoundsSaveRequest((current) =>
            current?.instanceId === instanceId && current.version === version ? null : current
          );
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    boundsSaveRequest,
    desktopNoticeValidationOptions,
    draftInstance,
    onSaveInstance,
    onSaveWindowBounds,
    selectedInstance
  ]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<DesktopNoticeWindowBoundsChangedPayload>(
      DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT,
      (event) => {
        if (disposed || event.payload.instanceId !== selectedId) {
          return;
        }
        const hasMove =
          typeof event.payload.x === 'number' && typeof event.payload.y === 'number';
        const hasResize =
          typeof event.payload.width === 'number' && typeof event.payload.height === 'number';
        if (!hasMove && !hasResize) {
          return;
        }
        if (hasMove && !event.payload.userInitiated) {
          return;
        }
        if ((hasMove && event.payload.userInitiated) || hasResize) {
          ignoreDraftAutosaveUntilRef.current = Date.now() + 1000;
          setBoundsSaveRequest({
            instanceId: event.payload.instanceId,
            version: Date.now()
          });
        }
        setDraftInstance((current) => {
          if (!current || current.id !== event.payload.instanceId) {
            return current;
          }
          if (current.variant === 'mascot') {
            const mascot = current.mascot ?? createDefaultMascotSettings();
            const nextStageSize = hasResize
              ? {
                  width: event.payload.width as number,
                  height: event.payload.height as number
                }
              : mascot.stageSize;
            const nextBounds =
              hasMove && event.payload.userInitiated
                ? {
                    ...(mascot.boundsOverride ?? {
                      width: nextStageSize.width,
                      height: nextStageSize.height
                    }),
                    x: event.payload.x as number,
                    y: event.payload.y as number
                  }
                : hasResize
                  ? mascot.boundsOverride
                    ? {
                        ...mascot.boundsOverride,
                        width: nextStageSize.width,
                        height: nextStageSize.height
                      }
                    : null
                  : mascot.boundsOverride;
            return {
              ...current,
              mascot: {
                ...mascot,
                stageSize: nextStageSize,
                presetPosition:
                  hasMove && event.payload.userInitiated ? 'custom' : mascot.presetPosition,
                boundsOverride: nextBounds
              }
            };
          }
          if (current.variant !== 'custom-lightbar') {
            return current;
          }
          const customLightbar = current.customLightbar ?? createDefaultCustomLightbarSettings();
          const nextSize = hasResize
            ? {
                width: event.payload.width as number,
                height: event.payload.height as number
              }
            : customLightbar.size;
          return {
            ...current,
            customLightbar: {
              ...customLightbar,
              presetPosition:
                hasMove && event.payload.userInitiated
                  ? 'custom'
                  : customLightbar.presetPosition,
              size: nextSize
            }
          };
        });
      }
    )
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => {
        console.warn('failed to initialize desktop notice bounds listener', error);
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [selectedId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" aria-hidden="true" />
              {t('desktopNotice.instance.title')}
            </CardTitle>
            <CardDescription>
              {t('desktopNotice.instance.description')}
            </CardDescription>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('desktopNotice.instance.create')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {instances.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {t('desktopNotice.instance.empty')}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {instances.map((instance) => (
                <button
                  key={instance.id}
                  type="button"
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    selectedInstance?.id === instance.id
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                  onClick={() => setSelectedId(instance.id)}
                >
                  <span className="font-medium">{instance.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {variantLabel(instance.variant, t)}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {instance.enabled ? '启用' : '禁用'}
                  </span>
                </button>
              ))}
            </div>

            {draftInstance && (
              <div className="rounded-lg border border-border bg-background/60 p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="desktop-notice-name">{t('desktopNotice.instance.name')}</Label>
                    <Input
                      id="desktop-notice-name"
                      value={draftInstance.name}
                      onChange={(event) => handlePatch({ name: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="desktop-notice-variant">
                      {t('desktopNotice.instance.variant')}
                    </Label>
                    <Select
                      value={draftInstance.variant}
                      onValueChange={(value) => requestVariantChange(value as DesktopNoticeVariant)}
                    >
                      <SelectTrigger id="desktop-notice-variant" aria-label="实例类型">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {variantOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="desktop-notice-idle-behavior">
                      {t('desktopNotice.instance.idleBehavior')}
                    </Label>
                    <Select
                      value={idleBehaviorValueForVariant(draftInstance)}
                      onValueChange={(value) =>
                        handlePatch({ idleBehavior: value as DesktopNoticeIdleBehavior })
                      }
                    >
                      <SelectTrigger
                        id="desktop-notice-idle-behavior"
                        aria-label={t('desktopNotice.instance.idleBehavior')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {idleBehaviorOptionsForVariant(draftInstance.variant).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('desktopNotice.instance.idleBehaviorHint')}
                    </p>
                  </div>
                </div>

                {pendingVariant ? (
                  <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                    {t('desktopNotice.instance.typeSwitchWarning')}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={confirmVariantChange}>
                        {t('desktopNotice.instance.confirmTypeSwitch')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPendingVariant(null)}>
                        {t('desktopNotice.instance.cancelTypeSwitch')}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {draftInstance.variant === 'custom-lightbar' ? (
                  <CustomLightbarSettingsPanel
                    settings={draftInstance.customLightbar ?? createDefaultCustomLightbarSettings()}
                    onPositionChange={handlePositionChange}
                    onPatch={handleCustomLightbarPatch}
                  />
                ) : null}

                {draftInstance.variant === 'edge-lightbar' ? (
                  <EdgeLightbarSettingsPanel
                    settings={draftInstance.edgeLightbar ?? createDefaultEdgeLightbarSettings()}
                    onPatch={handleEdgeLightbarPatch}
                  />
                ) : null}

                {draftInstance.variant === 'mascot' ? (
                  <MascotSettingsPanel
                    settings={draftInstance.mascot ?? createDefaultMascotSettings()}
                    customPacks={customMascotPacks}
                    customDiagnostics={customMascotDiagnostics}
                    customRootDir={customMascotRootDir}
                    customScanError={customMascotScanError}
                    customScanning={customMascotScanning}
                    onRefreshCustomPacks={refreshCustomMascotPacks}
                    onPatch={handleMascotPatch}
                  />
                ) : null}

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <ToggleRow
                    id="desktop-notice-enabled"
                    label={t('desktopNotice.instance.enabled')}
                    checked={draftInstance.enabled}
                    onChange={(checked) => handlePatch({ enabled: checked })}
                  />
                  <ToggleRow
                    id="desktop-notice-startup"
                    label={t('desktopNotice.instance.showOnStartup')}
                    checked={draftInstance.showOnStartup}
                    onChange={(checked) => handlePatch({ showOnStartup: checked })}
                  />
                  <ToggleRow
                    id="desktop-notice-topmost"
                    label={t('desktopNotice.instance.alwaysOnTop')}
                    checked={draftInstance.alwaysOnTop}
                    onChange={(checked) => handlePatch({ alwaysOnTop: checked })}
                  />
                </div>

                <p className="mt-4 min-h-5 text-sm text-destructive">
                  {formError ??
                    (validation && !validation.valid
                      ? desktopNoticeValidationMessage(validation.code)
                      : '')}
                </p>

                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handlePreviewToggle}
                    disabled={previewBusy}
                  >
                    {previewVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    {previewVisible
                      ? t('desktopNotice.instance.hidePreview')
                      : t('desktopNotice.instance.showPreview')}
                  </Button>
                  <Button onClick={handleSaveDraft}>{t('desktopNotice.instance.save')}</Button>
                  <Button variant="outline" className="gap-2" onClick={handleResetVisualSettings}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {t('desktopNotice.instance.resetVisualSettings')}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t('desktopNotice.instance.delete')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CustomLightbarSettingsPanel({
  settings,
  onPositionChange,
  onPatch
}: {
  settings: CustomLightbarSettings;
  onPositionChange: (position: DesktopNoticePresetPosition) => void;
  onPatch: (patch: Partial<CustomLightbarSettings>) => void;
}) {
  const t = useI18n();
  return (
    <div className="mt-5 grid gap-4 rounded-md border border-border bg-muted/10 p-3 lg:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="desktop-notice-position">
          {t('desktopNotice.instance.presetPosition')}
        </Label>
        <Select
          value={settings.presetPosition}
          onValueChange={(value) => onPositionChange(value as DesktopNoticePresetPosition)}
        >
          <SelectTrigger id="desktop-notice-position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presetPositionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desktop-notice-width">{t('desktopNotice.instance.width')}</Label>
        <Input
          id="desktop-notice-width"
          type="number"
          min={DESKTOP_NOTICE_SIZE_LIMITS.minWidth}
          max={DESKTOP_NOTICE_SIZE_LIMITS.maxWidth}
          value={settings.size.width}
          onChange={(event) =>
            onPatch({
              size: {
                ...settings.size,
                width: Number(event.target.value)
              }
            })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desktop-notice-height">{t('desktopNotice.instance.height')}</Label>
        <Input
          id="desktop-notice-height"
          type="number"
          min={DESKTOP_NOTICE_SIZE_LIMITS.minHeight}
          max={DESKTOP_NOTICE_SIZE_LIMITS.maxHeight}
          value={settings.size.height}
          onChange={(event) =>
            onPatch({
              size: {
                ...settings.size,
                height: Number(event.target.value)
              }
            })
          }
        />
      </div>
      <RangeField
        id="desktop-notice-corner-radius"
        label={t('desktopNotice.instance.cornerRadius')}
        min={DESKTOP_NOTICE_CORNER_RADIUS_LIMITS.min}
        max={DESKTOP_NOTICE_CORNER_RADIUS_LIMITS.max}
        step={5}
        value={settings.cornerRadiusPercent}
        suffix="%"
        onChange={(value) => onPatch({ cornerRadiusPercent: value })}
      />
      <RangeField
        id="desktop-notice-opacity"
        label={t('desktopNotice.instance.opacity')}
        min={DESKTOP_NOTICE_OPACITY_LIMITS.min}
        max={DESKTOP_NOTICE_OPACITY_LIMITS.max}
        step={5}
        value={settings.opacityPercent}
        suffix="%"
        onChange={(value) => onPatch({ opacityPercent: value })}
      />
    </div>
  );
}

function EdgeLightbarSettingsPanel({
  settings,
  onPatch
}: {
  settings: EdgeLightbarSettings;
  onPatch: (patch: Partial<EdgeLightbarSettings>) => void;
}) {
  const t = useI18n();
  function toggleEdge(edge: DesktopNoticeScreenEdge) {
    const hasEdge = settings.enabledEdges.includes(edge);
    const enabledEdges = hasEdge
      ? settings.enabledEdges.filter((item) => item !== edge)
      : [...settings.enabledEdges, edge];
    onPatch({ enabledEdges });
  }
  return (
    <div className="mt-5 grid gap-4 rounded-md border border-border bg-muted/10 p-3 lg:grid-cols-2">
      <div className="grid gap-2 lg:col-span-2">
        <Label>{t('desktopNotice.instance.edgeSelection')}</Label>
        <div
          role="group"
          aria-label={t('desktopNotice.instance.edgeSelection')}
          className="grid gap-2 sm:grid-cols-4"
        >
          {screenEdgeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                settings.enabledEdges.includes(option.value)
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-foreground'
              }`}
            >
              <span>{t(option.labelKey)}</span>
              <input
                type="checkbox"
                checked={settings.enabledEdges.includes(option.value)}
                onChange={() => toggleEdge(option.value)}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desktop-notice-edge-thickness">
          {t('desktopNotice.instance.edgeThickness')}
        </Label>
        <Input
          id="desktop-notice-edge-thickness"
          type="number"
          min={DESKTOP_NOTICE_SIZE_LIMITS.minHeight}
          max={DESKTOP_NOTICE_SIZE_LIMITS.maxHeight}
          value={settings.thicknessPx}
          onChange={(event) => onPatch({ thicknessPx: Number(event.target.value) })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desktop-notice-edge-inset">
          {t('desktopNotice.instance.edgeInset')}
        </Label>
        <Input
          id="desktop-notice-edge-inset"
          type="number"
          min={0}
          max={DESKTOP_NOTICE_SIZE_LIMITS.maxWidth}
          value={settings.insetPx}
          onChange={(event) => onPatch({ insetPx: Number(event.target.value) })}
        />
      </div>
      <RangeField
        id="desktop-notice-edge-opacity"
        label={t('desktopNotice.instance.opacity')}
        min={DESKTOP_NOTICE_OPACITY_LIMITS.min}
        max={DESKTOP_NOTICE_OPACITY_LIMITS.max}
        step={5}
        value={settings.opacityPercent}
        suffix="%"
        onChange={(value) => onPatch({ opacityPercent: value })}
      />
    </div>
  );
}

function MascotSettingsPanel({
  settings,
  customPacks,
  customDiagnostics,
  customRootDir,
  customScanError,
  customScanning,
  onRefreshCustomPacks,
  onPatch
}: {
  settings: DesktopMascotSettings;
  customPacks: DesktopMascotRuntimePack[];
  customDiagnostics: CustomMascotDiagnostic[];
  customRootDir: string;
  customScanError: string | null;
  customScanning: boolean;
  onRefreshCustomPacks: () => Promise<void>;
  onPatch: (patch: Partial<DesktopMascotSettings>) => void;
}) {
  const t = useI18n();
  const [guideOpen, setGuideOpen] = useState(false);
  const diagnosticSummary = buildCustomMascotDiagnosticGroups(customPacks, customDiagnostics, t);
  return (
    <div className="mt-5 space-y-4">
      <section
        aria-labelledby="desktop-mascot-resource-section-title"
        className="rounded-md border border-border bg-muted/10 p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="desktop-mascot-resource-section-title" className="text-sm font-medium">
            {t('desktopNotice.mascot.fields.resourceSection')}
          </h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="desktop-mascot-asset-pack">
                {t('desktopNotice.mascot.fields.assetPack')}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t('desktopNotice.mascot.customGuide.open')}
                onClick={() => setGuideOpen(true)}
              >
                <HelpCircle className="h-4 w-4" />
                <span>{t('desktopNotice.mascot.customGuide.button')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => void onRefreshCustomPacks()}
                disabled={customScanning}
              >
                <RefreshCw className={`h-4 w-4 ${customScanning ? 'animate-spin' : ''}`} />
                <span>{t('desktopNotice.mascot.customGuide.rescan')}</span>
              </Button>
            </div>
            <Select
              value={settings.assetPackId}
              onValueChange={(value) => onPatch({ assetPackId: value })}
            >
              <SelectTrigger
                id="desktop-mascot-asset-pack"
                aria-label={t('desktopNotice.mascot.fields.assetPack')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectableMascotPacks.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {t(pack.nameKey!)}
                  </SelectItem>
                ))}
                {customPacks.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.name} · {t('desktopNotice.mascot.customGuide.localPack')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customRootDir ? (
              <p className="text-xs text-muted-foreground">
                {t('desktopNotice.mascot.customGuide.scanRoot', { path: customRootDir })}
              </p>
            ) : null}
            {customScanError ? (
              <p className="text-xs text-destructive">
                {t('desktopNotice.mascot.customGuide.scanFailed', { error: customScanError })}
              </p>
            ) : null}
          </div>
          <div className="rounded-md border border-border bg-background/70 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {t('desktopNotice.mascot.customGuide.loadedSummary', {
                  count: diagnosticSummary.loadedCount
                })}
              </span>
              <span
                className={
                  diagnosticSummary.issueCount > 0
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-muted-foreground'
                }
              >
                {t('desktopNotice.mascot.customGuide.issueSummary', {
                  count: diagnosticSummary.issueCount
                })}
              </span>
            </div>
            {diagnosticSummary.loadedPacks.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="font-medium">
                  {t('desktopNotice.mascot.customGuide.loadedPacksTitle')}
                </p>
                {diagnosticSummary.loadedPacks.map((pack) => (
                  <div key={pack.id} className="flex flex-wrap gap-2 text-muted-foreground">
                    <span className="text-foreground">{pack.name}</span>
                    <span>{pack.id}</span>
                    <span>v{pack.version}</span>
                    <span>{pack.actionCount} actions</span>
                    <span>{pack.animationCount} animations</span>
                  </div>
                ))}
              </div>
            ) : null}
            {diagnosticSummary.issueGroups.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="font-medium">
                  {t('desktopNotice.mascot.customGuide.diagnosticsTitle')}
                </p>
                {diagnosticSummary.issueGroups.map((group) => (
                  <details
                    key={group.key}
                    open
                    className="rounded-md border border-border bg-background p-2"
                  >
                    <summary className="cursor-pointer font-medium">{group.title}</summary>
                    <div className="mt-2 space-y-2">
                      {group.issues.map((issue) => (
                        <div
                          key={`${issue.code}-${issue.path}`}
                          className="space-y-1 text-muted-foreground"
                        >
                          <p className="font-medium text-foreground">{t(issue.titleKey)}</p>
                          <p>{t(issue.impactKey)}</p>
                          <p>{t(issue.suggestionKey)}</p>
                          <p>
                            {t('desktopNotice.mascot.customGuide.diagnosticCode', {
                              code: issue.code
                            })}
                          </p>
                          <p className="break-all">
                            {t('desktopNotice.mascot.customGuide.diagnosticPath', {
                              path: issue.path
                            })}
                          </p>
                          <p className="break-all">
                            {t('desktopNotice.mascot.customGuide.diagnosticRaw', {
                              message: issue.rawMessage
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <CustomMascotGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
      <section
        aria-labelledby="desktop-mascot-display-section-title"
        className="grid gap-4 rounded-md border border-border bg-muted/10 p-3 lg:grid-cols-2"
      >
      <h3
        id="desktop-mascot-display-section-title"
        className="col-span-full text-sm font-medium"
      >
        {t('desktopNotice.mascot.fields.displaySection')}
      </h3>
      <div className="grid gap-2">
        <Label htmlFor="desktop-mascot-position">{t('desktopNotice.instance.presetPosition')}</Label>
        <Select
          value={settings.presetPosition}
          onValueChange={(value) =>
            onPatch({
              presetPosition: value as DesktopNoticePresetPosition,
              boundsOverride: value === 'custom' ? settings.boundsOverride ?? null : null
            })
          }
        >
          <SelectTrigger id="desktop-mascot-position">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presetPositionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <NumberField
        id="desktop-mascot-stage-width"
        label={t('desktopNotice.mascot.fields.stageWidth')}
        min={DESKTOP_MASCOT_STAGE_SIZE_LIMITS.minWidth}
        max={DESKTOP_MASCOT_STAGE_SIZE_LIMITS.maxWidth}
        value={settings.stageSize.width}
        onChange={(width) => onPatch({ stageSize: { ...settings.stageSize, width } })}
      />
      <NumberField
        id="desktop-mascot-stage-height"
        label={t('desktopNotice.mascot.fields.stageHeight')}
        min={DESKTOP_MASCOT_STAGE_SIZE_LIMITS.minHeight}
        max={DESKTOP_MASCOT_STAGE_SIZE_LIMITS.maxHeight}
        value={settings.stageSize.height}
        onChange={(height) => onPatch({ stageSize: { ...settings.stageSize, height } })}
      />
      <div className="grid gap-2">
        <Label htmlFor="desktop-mascot-idle-state">
          {t('desktopNotice.mascot.fields.idleState')}
        </Label>
        <Select
          value={settings.idleState}
          onValueChange={(value) => onPatch({ idleState: value as DesktopMascotState })}
        >
          <SelectTrigger
            id="desktop-mascot-idle-state"
            aria-label={t('desktopNotice.mascot.fields.idleState')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DESKTOP_MASCOT_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {t(`desktopNotice.mascot.states.${state}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desktop-mascot-bubble-placement">
          {t('desktopNotice.mascot.fields.bubblePlacement')}
        </Label>
        <Select
          value={settings.bubblePlacement}
          onValueChange={(value) =>
            onPatch({ bubblePlacement: value as DesktopMascotBubblePlacement })
          }
        >
          <SelectTrigger
            id="desktop-mascot-bubble-placement"
            aria-label={t('desktopNotice.mascot.fields.bubblePlacement')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mascotBubblePlacementOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <NumberField
        id="desktop-mascot-bubble-font-size"
        label={t('desktopNotice.mascot.fields.bubbleFontSize')}
        min={DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS.min}
        max={DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS.max}
        value={settings.bubbleFontSizePx}
        onChange={(bubbleFontSizePx) => onPatch({ bubbleFontSizePx })}
      />
      <div className="grid gap-2">
        <Label htmlFor="desktop-mascot-bubble-font">
          {t('desktopNotice.mascot.fields.bubbleFont')}
        </Label>
        <Select
          value={settings.bubbleFontId}
          onValueChange={(value) => onPatch({ bubbleFontId: value as DesktopMascotBubbleFontId })}
        >
          <SelectTrigger
            id="desktop-mascot-bubble-font"
            aria-label={t('desktopNotice.mascot.fields.bubbleFont')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {desktopMascotBubbleFontOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ToggleRow
        id="desktop-mascot-bubble-enabled"
        label={t('desktopNotice.mascot.fields.bubble')}
        checked={settings.bubbleEnabled}
        onChange={(bubbleEnabled) => onPatch({ bubbleEnabled })}
      />
      <ToggleRow
        id="desktop-mascot-interaction-enabled"
        label={t('desktopNotice.mascot.fields.interaction')}
        checked={settings.interactionEnabled}
        onChange={(interactionEnabled) => onPatch({ interactionEnabled })}
      />
      </section>
    </div>
  );
}

function CustomMascotGuideDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useI18n();
  const { toast } = useToast();

  function downloadTemplate() {
    try {
      if (!customMascotTemplateUrl) {
        throw new Error('template url is empty');
      }
      const link = document.createElement('a');
      link.href = customMascotTemplateUrl;
      link.download = 'cc-notice-custom-mascot-template.zip';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast({
        title: t('desktopNotice.mascot.customGuide.downloadStartedTitle'),
        description: t('desktopNotice.mascot.customGuide.downloadStartedDescription')
      });
    } catch (error) {
      console.warn('failed to start custom mascot template download', error);
      toast({
        title: t('desktopNotice.mascot.customGuide.downloadFailedTitle'),
        description: t('desktopNotice.mascot.customGuide.downloadFailedDescription'),
        variant: 'destructive'
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('desktopNotice.mascot.customGuide.title')}</DialogTitle>
          <DialogDescription>{t('desktopNotice.mascot.customGuide.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <section className="rounded-md border border-border bg-muted/20 p-3">
            <h3 className="font-medium">{t('desktopNotice.mascot.customGuide.directoryTitle')}</h3>
            <p className="mt-2 text-muted-foreground">
              {t('desktopNotice.mascot.customGuide.directoryDescription')}
            </p>
            <div className="mt-3 rounded-md bg-background p-3">
              <div className="font-mono text-xs text-primary">
                ~/.cc-notice/mascots/&lt;pack-id&gt;/
              </div>
              <ul className="mt-2 space-y-1 font-mono text-xs text-foreground">
                <li className="pl-4">manifest.json</li>
                <li className="pl-4">animations/</li>
                <li className="pl-8">idle-sleep.gif</li>
                <li className="pl-8">task-wave.gif</li>
                <li className="pl-8">working.gif</li>
                <li className="pl-8">success.gif</li>
                <li className="pl-8">error.gif</li>
              </ul>
            </div>
          </section>
          <section className="grid gap-3 rounded-md border border-border bg-muted/20 p-3 md:grid-cols-2">
            <div>
              <h3 className="font-medium">{t('desktopNotice.mascot.customGuide.requiredTitle')}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{t('desktopNotice.mascot.customGuide.requiredIdle')}</li>
                <li>{t('desktopNotice.mascot.customGuide.requiredTask')}</li>
                <li>{t('desktopNotice.mascot.customGuide.requiredWorking')}</li>
                <li>{t('desktopNotice.mascot.customGuide.requiredSuccess')}</li>
                <li>{t('desktopNotice.mascot.customGuide.requiredError')}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium">{t('desktopNotice.mascot.customGuide.gifTitle')}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{t('desktopNotice.mascot.customGuide.gifTransparent')}</li>
                <li>{t('desktopNotice.mascot.customGuide.gifSize')}</li>
                <li>{t('desktopNotice.mascot.customGuide.gifLimit')}</li>
                <li>{t('desktopNotice.mascot.customGuide.gifAnchor')}</li>
              </ul>
            </div>
          </section>
          <section className="rounded-md border border-border bg-muted/20 p-3">
            <h3 className="font-medium">{t('desktopNotice.mascot.customGuide.playModeTitle')}</h3>
            <p className="mt-2 text-muted-foreground">
              {t('desktopNotice.mascot.customGuide.playModeDescription')}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {['loop', 'onceThenHold', 'onceThenIdle'].map((key) => (
                <div key={key} className="rounded-md border border-border bg-background p-2">
                  <div className="font-mono text-xs text-primary">
                    {t(`desktopNotice.mascot.customGuide.playModes.${key}.name`)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t(`desktopNotice.mascot.customGuide.playModes.${key}.description`)}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-md border border-border bg-muted/20 p-3">
            <h3 className="font-medium">{t('desktopNotice.mascot.customGuide.manifestTitle')}</h3>
            <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-background p-3 text-xs text-foreground">
              <code>{`{
  "id": "my-mascot",
  "renderer": "gif",
  "animations": {
    "idle-sleep": "animations/idle-sleep.gif"
  },
  "actions": [
    {
      "id": "idle.sleep",
      "state": "idle",
      "animation": "idle-sleep",
      "playMode": "loop"
    }
  ]
}`}</code>
            </pre>
          </section>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
            {t('desktopNotice.mascot.customGuide.notAvailableYet')}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            {t('desktopNotice.mascot.customGuide.downloadTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  id,
  label,
  min,
  max,
  value,
  onChange
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function RangeField({
  id,
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="desktop-notice-range h-9 cursor-pointer border-0 bg-transparent px-0 shadow-none"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function toErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'DESKTOP_NOTICE_TARGET_IN_USE') {
    return '该桌面提示实例已被输出规则引用，请先移除相关桌面提示输出配置。';
  }
  if (message === 'DESKTOP_NOTICE_TARGET_NOT_FOUND') {
    return '未找到该桌面提示实例。';
  }
  return message;
}

function normalizeInstanceForSave(instance: DesktopNoticeInstance): DesktopNoticeInstance {
  const normalized = {
    ...instance,
    name: instance.name.trim()
  };
  if (normalized.variant === 'edge-lightbar') {
    return {
      ...normalized,
      customLightbar: null,
      edgeLightbar: normalized.edgeLightbar ?? createDefaultEdgeLightbarSettings(),
      mascot: null
    };
  }
  if (normalized.variant === 'mascot') {
    return {
      ...normalized,
      idleBehavior:
        normalized.idleBehavior === 'hidden'
          ? 'hidden'
          : 'dim-placeholder',
      customLightbar: null,
      edgeLightbar: null,
      mascot: normalized.mascot ?? createDefaultMascotSettings()
    };
  }
  return {
    ...normalized,
    variant: 'custom-lightbar',
    customLightbar: normalized.customLightbar ?? createDefaultCustomLightbarSettings(),
    edgeLightbar: null,
    mascot: null
  };
}

function sameInstanceConfig(left: DesktopNoticeInstance, right: DesktopNoticeInstance) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createInstanceForVariant(
  instance: DesktopNoticeInstance,
  variant: DesktopNoticeVariant
): DesktopNoticeInstance {
  if (variant === 'edge-lightbar') {
    return {
      ...instance,
      variant,
      customLightbar: null,
      edgeLightbar: createDefaultEdgeLightbarSettings(),
      mascot: null
    };
  }
  if (variant === 'mascot') {
    return {
      ...instance,
      variant,
      idleBehavior: 'hidden',
      customLightbar: null,
      edgeLightbar: null,
      mascot: createDefaultMascotSettings()
    };
  }
  return {
    ...instance,
    variant: 'custom-lightbar',
    customLightbar: createDefaultCustomLightbarSettings(),
    edgeLightbar: null,
    mascot: null
  };
}

function idleBehaviorOptionsForVariant(variant: DesktopNoticeVariant) {
  return variant === 'mascot' ? mascotIdleBehaviorOptions : idleBehaviorOptions;
}

function idleBehaviorValueForVariant(instance: DesktopNoticeInstance): DesktopNoticeIdleBehavior {
  if (instance.variant !== 'mascot') {
    return instance.idleBehavior ?? 'hidden';
  }
  return instance.idleBehavior === 'hidden' ? 'hidden' : 'dim-placeholder';
}

function variantLabel(variant: DesktopNoticeVariant, t: ReturnType<typeof useI18n>) {
  const labelKey =
    variantOptions.find((option) => option.value === variant)?.labelKey ??
    'desktopNotice.instance.variants.customLightbar';
  return t(labelKey);
}

function ToggleRow({
  id,
  label,
  checked,
  onChange
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
