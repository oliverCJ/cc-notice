import { useEffect, useReducer, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Download, FileArchive, Plus, Star, Trash2, Upload } from 'lucide-react';
import { clearCustomFaceRecovery, closeCustomFaceEditor, deleteCustomFaceAsset, exportCustomFaceGif, exportCustomFaceItem, getCustomFaceAssets, getCustomFaceGroup, previewCustomFaceItemImport, saveCustomFaceAsset, saveCustomFaceGroup, saveCustomFaceRecovery } from '@/api/tauriApi';
import type { CustomFaceItemImportPreview, PersonalCustomFaceAsset, SaveCustomFaceGroupResult } from '@/api/tauriApi';
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
import type { EditorState, ToolId } from '@/domain/customFaces/editor/types';
import { editorReducer } from '@/domain/customFaces/editor/reducer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CanvasToolState, CustomFaceCanvas } from './CustomFaceCanvas';
import type { CanvasGuide } from './CustomFaceRulers';
import { CustomFaceTimeline } from './CustomFaceTimeline';
import { CustomFaceToolbar } from './CustomFaceToolbar';
import { CustomFaceSvgImportDialog } from './CustomFaceSvgImportDialog';
import { CustomFaceAssetLibrary } from './CustomFaceAssetLibrary';
import { CustomFaceItemImportDialog } from './CustomFaceItemImportDialog';
import { CustomFaceGifExportDialog } from './CustomFaceGifExportDialog';
import { useI18n } from '@/i18n';

type Props = { initialState: EditorState; expectedLibraryHash?: string; onBack: () => void; onSaved: (result: SaveCustomFaceGroupResult) => void };
const TOOL_LABELS: Record<ToolId, string> = { select: 'select', brush: 'brush', eraser: 'eraser', line: 'line', rectangle: 'rectangle', circle: 'circle', triangle: 'triangle', pen: 'pen' };

export function CustomFaceEditorWorkbench({ initialState, expectedLibraryHash, onBack, onSaved }: Props) {
  const t = useI18n();
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolId>('brush');
  const [constraintEnabled, setConstraintEnabled] = useState(false);
  const [rectangleFilled, setRectangleFilled] = useState(false);
  const [eraserSize, setEraserSize] = useState(3);
  const [selection, setSelection] = useState<EditorState['selection']>(null);
  const [selectionMoveStep, setSelectionMoveStep] = useState(1);
  const [guides, setGuides] = useState<CanvasGuide[]>([]);
  const [toolState, setToolState] = useState<CanvasToolState>({ pointer: null, start: null, end: null, bounds: null, penPointCount: 0 });
  const [penCommand, setPenCommand] = useState<{ id: number; type: 'finish' | 'cancel' } | null>(null);
  const [statusMessage, setStatusMessage] = useState(t('customFaceEditor.workbench.initialStatus'));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState(initialState.presentGroup.name);
  const [svgDialogOpen, setSvgDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ pixels: number[]; basePixels: number[]; mode: 'merge' | 'replace'; scale: number; offsetX: number; offsetY: number; sourceWidth: number; sourceHeight: number } | null>(null);
  const [personalAssets, setPersonalAssets] = useState<PersonalCustomFaceAsset[]>([]);
  const [assetTab, setAssetTab] = useState<"group" | "public">("group");
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [highlightAssetId, setHighlightAssetId] = useState<string | null>(null);
  const [libraryHash, setLibraryHash] = useState(expectedLibraryHash);
  const [saving, setSaving] = useState(false);
  const [conflictHash, setConflictHash] = useState<string | null>(null);
  const [leaveIntent, setLeaveIntent] = useState<'back' | 'window' | null>(null);
  const [faceItemPreview, setFaceItemPreview] = useState<CustomFaceItemImportPreview | null>(null);
  const [faceItemImportError, setFaceItemImportError] = useState<string | null>(null);
  const [faceItemBusy, setFaceItemBusy] = useState(false);
  const [gifExportDialogOpen, setGifExportDialogOpen] = useState(false);
  const dirtyRef = useRef(false);
  const closingRef = useRef(false);
  const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
  const frame = face?.frames[state.selectedFrameIndex];
  const onionFrame = face && state.selectedFrameIndex > 0 ? face.frames[state.selectedFrameIndex - 1] : undefined;
  const pixels = frame ? new Uint8Array(frame.packedPixels) : new Uint8Array(state.profile.framebufferBytes);

  useEffect(() => { if (!state.past.length) return; const timer = window.setTimeout(() => { void saveCustomFaceRecovery(state.presentGroup).catch((error) => console.warn('failed to autosave custom face recovery', error)); }, 600); return () => window.clearTimeout(timer); }, [state.past.length, state.presentGroup]);
  useEffect(() => { setSelection(null); dispatch({ type: 'set-selection', selection: null }); }, [selectedTool]);
  useEffect(() => { setSelection(state.selection); }, [state.selection]);
  useEffect(() => { setGroupNameDraft(state.presentGroup.name); }, [state.presentGroup.name]);
  useEffect(() => { setLibraryHash(expectedLibraryHash); }, [expectedLibraryHash]);
  useEffect(() => { if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return; void getCustomFaceAssets().then(setPersonalAssets).catch((error) => console.warn('failed to load personal custom face assets', error)); }, []);
  dirtyRef.current = state.past.length > 0;
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWindow().onCloseRequested((event) => {
      if (closingRef.current) return;
      if (!dirtyRef.current) {
        event.preventDefault();
        closingRef.current = true;
        void closeCustomFaceEditor().catch((error) => { closingRef.current = false; console.warn('failed to close clean custom face editor', error); });
        return;
      }
      event.preventDefault();
      setLeaveIntent('window');
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch((error) => console.warn('failed to register custom face editor close handler', error));
    return () => { disposed = true; unlisten?.(); };
  }, []);

  const clearSelection = () => { setSelection(null); dispatch({ type: 'set-selection', selection: null }); };
  const save = async (expectedHash = libraryHash) => {
    setSaveError(null);
    setSaving(true);
    try {
      await saveCustomFaceRecovery(state.presentGroup);
      const result = await saveCustomFaceGroup({ group: state.presentGroup, expectedLibraryHash: expectedHash });
      await clearCustomFaceRecovery(state.presentGroup.groupId);
      dispatch({ type: 'mark-saved', group: result.group });
      setLibraryHash(result.libraryHash);
      setConflictHash(null);
      onSaved(result);
      setStatusMessage(t('customFaceEditor.workbench.saveSuccess'));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentHash = conflictLibraryHash(message);
      if (currentHash) {
        setConflictHash(currentHash);
        setStatusMessage(t('customFaceEditor.workbench.saveConflict'));
      } else {
        setSaveError(message);
        setStatusMessage(t('customFaceEditor.workbench.saveFailed', { error: message }));
      }
      return false;
    } finally {
      setSaving(false);
    }
  };
  const reloadDiskGroup = async () => {
    if (!conflictHash) return;
    setSaving(true);
    setSaveError(null);
    try {
      const group = await getCustomFaceGroup(state.presentGroup.groupId);
      await clearCustomFaceRecovery(group.groupId);
      dispatch({ type: 'mark-saved', group });
      setLibraryHash(conflictHash);
      setConflictHash(null);
      onSaved({ group, libraryHash: conflictHash, changed: false });
      setStatusMessage(t('customFaceEditor.workbench.reloadSuccess'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      setStatusMessage(t('customFaceEditor.workbench.reloadFailed', { error: message }));
    } finally {
      setSaving(false);
    }
  };
  const finishLeave = async (intent: 'back' | 'window') => {
    if (intent === 'back') onBack();
    else {
      closingRef.current = true;
      try { await closeCustomFaceEditor(); }
      catch (error) { closingRef.current = false; throw error; }
    }
  };
  const discardAndLeave = async () => {
    if (!leaveIntent) return;
    const intent = leaveIntent;
    setLeaveIntent(null);
    setSaving(true);
    try {
      await clearCustomFaceRecovery(state.presentGroup.groupId);
      await finishLeave(intent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('failed to discard custom face editor changes', error);
      setSaveError(message);
      setStatusMessage(t('customFaceEditor.workbench.discardFailed', { error: message }));
    } finally {
      setSaving(false);
    }
  };
  const saveAndLeave = async () => {
    if (!leaveIntent) return;
    const intent = leaveIntent;
    setLeaveIntent(null);
    if (await save()) {
      try {
        await finishLeave(intent);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('failed to leave custom face editor after saving', error);
        setSaveError(message);
        setStatusMessage(t('customFaceEditor.workbench.closeFailed', { error: message }));
      }
    }
  };
  const changeFace = (faceId: string) => { clearSelection(); dispatch({ type: 'select-face', faceId }); setStatusMessage(t('customFaceEditor.workbench.switchFace')); };
  const addFace = () => { if (state.presentGroup.faces.length >= 15) { setStatusMessage(t('customFaceEditor.workbench.maxFaces')); return; } const name = uniqueFaceName(state, t('customFaceEditor.workbench.newFace')); dispatch({ type: 'add-face', face: { faceId: crypto.randomUUID(), name, color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(state.profile.framebufferBytes).fill(0) }] } }); clearSelection(); setStatusMessage(t('customFaceEditor.workbench.addedFace', { name })); };
  const duplicateFace = () => { if (!face) return; if (state.presentGroup.faces.length >= 15) { setStatusMessage(t('customFaceEditor.workbench.maxFaces')); return; } const name = uniqueFaceName(state, `${face.name} ${t('customFaceEditor.workbench.copySuffix')}`); dispatch({ type: 'duplicate-face', sourceFaceId: face.faceId, faceId: crypto.randomUUID(), name }); clearSelection(); setStatusMessage(t('customFaceEditor.workbench.copiedFace', { name })); };
  const renameFace = (name: string) => { if (!face) return; const nextName = name.trim(); if (!nextName) { setStatusMessage(t('customFaceEditor.workbench.emptyFaceName')); return; } if (state.presentGroup.faces.some((item) => item.faceId !== face.faceId && item.name.trim().toLocaleLowerCase() === nextName.toLocaleLowerCase())) { setStatusMessage(t('customFaceEditor.workbench.duplicateFaceName')); return; } dispatch({ type: 'rename-face', faceId: face.faceId, name: nextName }); setStatusMessage(t('customFaceEditor.workbench.faceRenamed', { name: nextName })); };
  const deleteFace = () => { if (!face) return; if (state.presentGroup.faces.length <= 1) { setStatusMessage(t('customFaceEditor.workbench.minFaces')); return; } if (!window.confirm(t('customFaceEditor.workbench.deleteFaceConfirm', { name: face.name }))) return; const replacement = state.presentGroup.faces.find((item) => item.faceId !== face.faceId); dispatch({ type: 'delete-face', faceId: face.faceId, replacementDefaultFaceId: face.faceId === state.presentGroup.defaultFaceId ? replacement?.faceId : undefined }); clearSelection(); };
  const importFaceItem = async () => {
    if (faceItemBusy) return;
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'CC Face Item', extensions: ['ccfaceitem'] }]
    });
    if (typeof path !== 'string') return;
    setFaceItemBusy(true);
    setFaceItemImportError(null);
    try {
      const preview = await previewCustomFaceItemImport(path);
      if (preview.displayProfileId !== state.profile.id
        || preview.width !== state.profile.width
        || preview.height !== state.profile.height) {
        setFaceItemImportError(t('customFaceEditor.faceImport.profileMismatch', {
          sourceWidth: preview.width,
          sourceHeight: preview.height,
          targetWidth: state.profile.width,
          targetHeight: state.profile.height
        }));
        return;
      }
      setFaceItemPreview(preview);
    } catch (error) {
      setFaceItemImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setFaceItemBusy(false);
    }
  };
  const importFaceItemIntoDraft = (name: string) => {
    if (!faceItemPreview) return;
    const resolvedName = uniqueFaceName(state, name);
    dispatch({
      type: 'add-face',
      face: {
        ...structuredClone(faceItemPreview.face),
        faceId: crypto.randomUUID(),
        name: resolvedName
      }
    });
    clearSelection();
    setFaceItemPreview(null);
    setStatusMessage(t('customFaceEditor.faceImport.imported', { name: resolvedName }));
  };
  const exportCurrentFace = async (format: 'item' | 'gif', scale = 1) => {
    if (!face || faceItemBusy) return;
    const extension = format === 'item' ? 'ccfaceitem' : 'gif';
    const path = await saveDialog({
      defaultPath: `${safeFaceFileName(face.name, t('customFaceEditor.defaults.fileName'))}.${extension}`,
      filters: [{ name: format === 'item' ? 'CC Face Item' : 'GIF', extensions: [extension] }]
    });
    if (typeof path !== 'string') return;
    const snapshot = structuredClone(face);
    setFaceItemBusy(true);
    setStatusMessage(t('customFaceEditor.faceExport.exporting'));
    try {
      if (format === 'item') {
        await exportCustomFaceItem({ face: snapshot, displayProfileId: state.profile.id, path });
        setStatusMessage(t('customFaceEditor.faceExport.itemSuccess'));
      } else {
        const result = await exportCustomFaceGif({ face: snapshot, displayProfileId: state.profile.id, path, scale });
        const originalDuration = snapshot.frames.reduce((total, frame) => total + frame.durationMs, 0);
        const key = originalDuration === result.totalDurationMs
          ? 'customFaceEditor.faceExport.gifSuccess'
          : 'customFaceEditor.faceExport.quantized';
        setStatusMessage(t(key, { frames: snapshot.frames.length, duration: result.totalDurationMs }));
      }
    } catch (error) {
      setStatusMessage(t('customFaceEditor.faceExport.failed', {
        error: error instanceof Error ? error.message : String(error)
      }));
    } finally {
      setFaceItemBusy(false);
    }
  };

  return <><main className="flex h-screen min-h-0 flex-col bg-background text-foreground"><header className="flex items-center gap-3 border-b border-border px-4 py-3"><button className="border border-border px-3 py-2 text-sm" onClick={() => { if (state.past.length) setLeaveIntent('back'); else onBack(); }}>{t('customFaceEditor.workbench.back')}</button><button className="border border-primary px-3 py-2 text-sm disabled:opacity-50" disabled={saving} onClick={() => void save()}>{saving ? t('customFaceEditor.workbench.saving') : t('customFaceEditor.workbench.save')}</button><button type="button" className="border border-border px-3 py-2 text-sm" disabled={saving || !face} onClick={() => setSvgDialogOpen(true)}>{t('customFaceEditor.workbench.importSvg')}</button><button type="button" className="border border-border px-3 py-2 text-sm" onClick={() => setAssetLibraryOpen(true)}>{t('customFaceEditor.workbench.assets')}</button><label className="flex items-center gap-2 text-xs text-muted-foreground">{t('customFaceEditor.workbench.groupName')}<input aria-label={t('customFaceEditor.workbench.groupName')} value={groupNameDraft} maxLength={64} className="w-48 border border-border bg-background px-2 py-1 text-sm text-foreground" onChange={(event) => setGroupNameDraft(event.target.value)} /><button type="button" aria-label={t('customFaceEditor.workbench.applyGroupName')} disabled={!groupNameDraft.trim() || groupNameDraft.trim() === state.presentGroup.name} className="border border-border px-2 py-1 text-xs text-foreground disabled:opacity-30" onClick={() => { const name = groupNameDraft.trim(); dispatch({ type: 'rename-group', name }); setStatusMessage(t('customFaceEditor.workbench.groupNameChanged', { name })); }}>{t('customFaceEditor.workbench.applyName')}</button></label><span className="border border-primary bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">{state.profile.width} × {state.profile.height}</span><span className="ml-auto text-xs text-muted-foreground">{state.past.length ? t('customFaceEditor.workbench.modified') : t('customFaceEditor.workbench.saved')}</span></header>{saveError ? <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{t('customFaceEditor.workbench.saveFailed', { error: saveError })}</div> : null}{faceItemImportError ? <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">{faceItemImportError}</div> : null}<div className="flex min-h-0 flex-1 gap-3 p-3"><CustomFaceToolbar collapsed={collapsed} selectedTool={selectedTool} canUndo={state.past.length > 0 && !playing} canRedo={state.future.length > 0 && !playing} onCollapsedChange={setCollapsed} onToolChange={(tool) => { setSelectedTool(tool); setStatusMessage(toolHint(tool, t)); }} onUndo={() => dispatch({ type: 'undo' })} onRedo={() => dispatch({ type: 'redo' })} /><section className="flex min-w-0 flex-1 flex-col gap-3"><CustomFaceCanvas width={state.profile.width} height={state.profile.height} pixels={pixels} selection={selection} selectionOrigin={state.selectionOrigin} pendingImportPixels={pendingImport?.pixels} pendingImportOffset={{ x: pendingImport?.offsetX ?? 0, y: pendingImport?.offsetY ?? 0 }} pendingImportSize={{ width: pendingImport?.sourceWidth ?? state.profile.width, height: pendingImport?.sourceHeight ?? state.profile.height }} onPendingImportMove={(dx, dy) => setPendingImport((current) => current ? { ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy } : current)} guides={guides} eraserSize={eraserSize} onionPixels={onionFrame ? new Uint8Array(onionFrame.packedPixels) : undefined} selectedTool={selectedTool} constraintEnabled={constraintEnabled} rectangleFilled={rectangleFilled} disabled={playing} penCommand={penCommand} onGuidesChange={setGuides} onToolStateChange={setToolState} onSelectionChange={(value) => { setSelection(value); dispatch({ type: 'set-selection', selection: value }); if (value) setStatusMessage(t('customFaceEditor.workbench.selectionCreated', { width: value.width, height: value.height })); }} onPixelTransaction={(changes) => dispatch({ type: 'apply-pixel-transaction', pixels: changes })} /><div role="status" className="min-h-8 border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{statusMessage}</div><CustomFaceTimeline frames={face?.frames ?? []} width={state.profile.width} height={state.profile.height} selectedIndex={state.selectedFrameIndex} onSelect={(index) => { clearSelection(); dispatch({ type: 'select-frame', index }); }} onMove={(from, to) => { clearSelection(); dispatch({ type: 'move-frame', from, to }); }} onAdd={() => { clearSelection(); dispatch({ type: 'add-frame' }); setStatusMessage(t('customFaceEditor.workbench.frameAdded')); }} onDelete={(index) => { clearSelection(); dispatch({ type: 'delete-frame', index }); }} onPlayingChange={setPlaying} /></section><aside className="flex w-64 shrink-0 flex-col gap-4 overflow-hidden border-l border-border pl-4 text-sm"><FacePanel state={state} face={face} frameDuration={frame?.durationMs ?? 200} playing={playing} busy={faceItemBusy} onSelect={changeFace} onAdd={addFace} onDuplicate={duplicateFace} onRename={renameFace} onDefault={() => face && dispatch({ type: 'set-default-face', faceId: face.faceId })} onDelete={deleteFace} onImport={() => void importFaceItem()} onExportItem={() => void exportCurrentFace('item')} onExportGif={() => setGifExportDialogOpen(true)} onDuration={(durationMs) => dispatch({ type: 'set-frame-duration', index: state.selectedFrameIndex, durationMs })} /><CustomFaceAssetLibrary open={assetLibraryOpen} onClose={() => setAssetLibraryOpen(false)} groupId={state.presentGroup.groupId} activeTab={assetTab} onTabChange={setAssetTab} personalAssets={personalAssets} onApplyPersonal={(asset) => { setPendingImport({ pixels: Array.from(asset.packedPixels), basePixels: Array.from(asset.packedPixels), mode: "merge", scale: 1, offsetX: 0, offsetY: 0, sourceWidth: asset.width, sourceHeight: asset.height }); setAssetLibraryOpen(false); setStatusMessage(t('customFaceEditor.workbench.assetApplied')); }} onSaveCurrent={async (scope) => { if (!frame) return; const now = new Date().toISOString(); const saved = await saveCustomFaceAsset({ assetId: crypto.randomUUID(), scope, groupId: scope === "group" ? state.presentGroup.groupId : null, name: `${t('customFaceEditor.workbench.frameName')} ${state.selectedFrameIndex + 1}`, tags: [], profileId: state.profile.id, width: state.profile.width, height: state.profile.height, packedPixels: [...frame.packedPixels], source: "editor", createdAt: now, updatedAt: now }); setPersonalAssets((items) => [...items, saved]); setAssetTab(scope); setHighlightAssetId(saved.assetId); setStatusMessage(t('customFaceEditor.workbench.assetSaved')); }} onDeletePersonal={async (assetId) => { await deleteCustomFaceAsset(assetId); setPersonalAssets((items) => items.filter((asset) => asset.assetId !== assetId)); }} onRenamePersonal={async (asset, name) => { const saved = await saveCustomFaceAsset({ ...asset, name, updatedAt: new Date().toISOString() }); setPersonalAssets((items) => items.map((item) => item.assetId === saved.assetId ? saved : item)); }} onUpdateTags={async (asset, tags) => { const saved = await saveCustomFaceAsset({ ...asset, tags, updatedAt: new Date().toISOString() }); setPersonalAssets((items) => items.map((item) => item.assetId === saved.assetId ? saved : item)); }} /><ToolPanel tool={selectedTool} state={toolState} selection={selection} selectionOrigin={state.selectionOrigin} clipboardReady={Boolean(state.clipboard)} constraintEnabled={constraintEnabled} rectangleFilled={rectangleFilled} eraserSize={eraserSize} onConstraint={setConstraintEnabled} onRectangleFilled={setRectangleFilled} onEraserSize={setEraserSize} onPenCommand={(type) => setPenCommand({ id: Date.now(), type })} onCopy={() => { if (!selection) return; dispatch({ type: 'copy-selection' }); setStatusMessage(t('customFaceEditor.workbench.copiedSelection')); }} onPaste={() => { if (!selection) { setStatusMessage(t('customFaceEditor.workbench.pasteTarget')); return; } if (!state.clipboard) { setStatusMessage(t('customFaceEditor.workbench.clipboardEmpty')); return; } dispatch({ type: 'paste-selection' }); clearSelection(); }} onClear={() => { if (selection) { dispatch({ type: 'clear-selection' }); clearSelection(); } }} onSetActive={(active) => { if (selection) { dispatch({ type: 'set-selection-active', active }); clearSelection(); } }} onCancelSelection={clearSelection} onCancelMove={() => { dispatch({ type: "cancel-selection-move" }); setSelection(null); }} selectionMoveStep={selectionMoveStep} onSelectionMoveStep={setSelectionMoveStep} onMoveSelection={(dx, dy) => dispatch({ type: "move-selection", dx: dx * selectionMoveStep, dy: dy * selectionMoveStep })} /><PendingImportActions pending={pendingImport} onCancel={() => setPendingImport(null)} onScale={(scale) => setPendingImport((current) => current ? { ...current, scale, pixels: scalePackedPixels(current.basePixels, state.profile.width, state.profile.height, scale) } : current)} onConfirm={() => { if (!pendingImport) return; const changes = pendingImport.mode === "replace" ? packedPixelsToChanges(movePackedPixels(pendingImport.pixels, state.profile.width, state.profile.height, pendingImport.offsetX, pendingImport.offsetY), state.profile.width, state.profile.height) : packedPixelsToChanges(movePackedPixels(pendingImport.pixels, state.profile.width, state.profile.height, pendingImport.offsetX, pendingImport.offsetY), state.profile.width, state.profile.height).filter((change) => change.active); dispatch({ type: "apply-pixel-transaction", pixels: changes }); setPendingImport(null); setStatusMessage(t('customFaceEditor.workbench.frameApplied')); }} /></aside></div></main><SaveConflictDialog open={Boolean(conflictHash)} busy={saving} onCancel={() => setConflictHash(null)} onReload={() => void reloadDiskGroup()} onOverwrite={() => { if (conflictHash) void save(conflictHash); }} /><LeaveConfirmDialog open={Boolean(leaveIntent)} busy={saving} onCancel={() => setLeaveIntent(null)} onDiscard={() => void discardAndLeave()} onSave={() => void saveAndLeave()} /><CustomFaceSvgImportDialog open={svgDialogOpen} width={state.profile.width} height={state.profile.height} onCancel={() => setSvgDialogOpen(false)} onApply={(packedPixels, mode) => { setPendingImport({ pixels: packedPixels, basePixels: packedPixels, mode, scale: 1, offsetX: 0, offsetY: 0, sourceWidth: state.profile.width, sourceHeight: state.profile.height }); setAssetLibraryOpen(false); setSvgDialogOpen(false); setStatusMessage(t('customFaceEditor.workbench.svgApplied')); }} /><CustomFaceItemImportDialog open={Boolean(faceItemPreview)} preview={faceItemPreview} maxFacesReached={state.presentGroup.faces.length >= 15} duplicate={Boolean(faceItemPreview && state.presentGroup.faces.some((item) => sameFaceContent(item, faceItemPreview.face)))} onCancel={() => setFaceItemPreview(null)} onConfirm={importFaceItemIntoDraft} /><CustomFaceGifExportDialog open={gifExportDialogOpen} width={state.profile.width} height={state.profile.height} onCancel={() => setGifExportDialogOpen(false)} onConfirm={(scale) => { setGifExportDialogOpen(false); void exportCurrentFace('gif', scale); }} /></>;
}

function SaveConflictDialog({ open, busy, onCancel, onReload, onOverwrite }: { open: boolean; busy: boolean; onCancel: () => void; onReload: () => void; onOverwrite: () => void }) {
  const t = useI18n();
  return <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('customFaceEditor.workbench.saveConflictTitle')}</AlertDialogTitle><AlertDialogDescription>{t('customFaceEditor.workbench.saveConflictDescription')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('customFaceEditor.workbench.cancel')}</AlertDialogCancel><AlertDialogAction disabled={busy} className="border border-border bg-background text-foreground hover:bg-accent" onClick={onReload}>{t('customFaceEditor.workbench.reloadDisk')}</AlertDialogAction><AlertDialogAction disabled={busy} onClick={onOverwrite}>{t('customFaceEditor.workbench.overwrite')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function LeaveConfirmDialog({ open, busy, onCancel, onDiscard, onSave }: { open: boolean; busy: boolean; onCancel: () => void; onDiscard: () => void; onSave: () => void }) {
  const t = useI18n();
  return <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('customFaceEditor.workbench.leaveTitle')}</AlertDialogTitle><AlertDialogDescription>{t('customFaceEditor.workbench.leaveDescription')}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('customFaceEditor.workbench.cancel')}</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDiscard}>{t('customFaceEditor.workbench.discard')}</AlertDialogAction><AlertDialogAction disabled={busy} onClick={onSave}>{t('customFaceEditor.workbench.saveAndClose')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function FacePanel({ state, face, frameDuration, playing, busy, onSelect, onAdd, onDuplicate, onRename, onDefault, onDelete, onImport, onExportItem, onExportGif, onDuration }: { state: EditorState; face: EditorState['presentGroup']['faces'][number] | undefined; frameDuration: number; playing: boolean; busy: boolean; onSelect: (id: string) => void; onAdd: () => void; onDuplicate: () => void; onRename: (name: string) => void; onDefault: () => void; onDelete: () => void; onImport: () => void; onExportItem: () => void; onExportGif: () => void; onDuration: (value: number) => void }) {
  const t = useI18n();
  const [nameDraft, setNameDraft] = useState(face?.name ?? '');
  const [durationDraft, setDurationDraft] = useState(String(frameDuration));
  useEffect(() => setNameDraft(face?.name ?? ''), [face?.faceId, face?.name]);
  useEffect(() => setDurationDraft(String(frameDuration)), [frameDuration, face?.faceId]);
  const commitDuration = () => { const value = Number(durationDraft); if (Number.isFinite(value)) { onDuration(value); setDurationDraft(String(Math.max(120, Math.min(5000, Math.trunc(value))))); } };
  const canApplyName = Boolean(face && nameDraft.trim() && nameDraft.trim() !== face.name);
  return <section className="shrink-0 border-b border-border pb-4"><h2 className="font-medium">{t('customFaceEditor.workbench.currentFace')}</h2><Select value={face?.faceId} onValueChange={onSelect}><SelectTrigger aria-label={t('customFaceEditor.workbench.currentFace')} className="mt-2"><SelectValue placeholder={t('customFaceEditor.workbench.selectFace')} /></SelectTrigger><SelectContent>{state.presentGroup.faces.map((item) => <SelectItem key={item.faceId} value={item.faceId}>{item.name}{item.faceId === state.presentGroup.defaultFaceId ? ` · ${t('customFaceEditor.workbench.defaultFace')}` : ''}</SelectItem>)}</SelectContent></Select><label className="mt-2 block text-xs text-muted-foreground">{t('customFaceEditor.workbench.faceName')}<div className="mt-1 flex gap-1"><input aria-label={t('customFaceEditor.workbench.faceName')} value={nameDraft} disabled={!face || playing} maxLength={64} className="min-w-0 flex-1 border border-border bg-background px-2 py-1 text-sm text-foreground" onChange={(event) => setNameDraft(event.target.value)} /><button type="button" aria-label={t('customFaceEditor.workbench.applyName')} disabled={!canApplyName || playing} className="border border-border px-2 py-1 text-xs disabled:opacity-30" onClick={() => onRename(nameDraft)}>{t('customFaceEditor.workbench.applyName')}</button></div></label><div className="mt-2 grid grid-cols-3 gap-1"><IconAction label={t('customFaceEditor.workbench.newFace')} icon={Plus} onClick={onAdd} /><IconAction label={t('customFaceEditor.workbench.copyFace')} icon={Copy} onClick={onDuplicate} disabled={!face || busy} /><IconAction label={t('customFaceEditor.faceImport.action')} icon={Upload} onClick={onImport} disabled={busy} /><IconAction label={t('customFaceEditor.faceExport.item')} icon={FileArchive} onClick={onExportItem} disabled={!face || busy} /><IconAction label={t('customFaceEditor.faceExport.gif')} icon={Download} onClick={onExportGif} disabled={!face || busy} /><IconAction label={t('customFaceEditor.workbench.setDefault')} icon={Star} onClick={onDefault} disabled={!face || busy || face.faceId === state.presentGroup.defaultFaceId} /><IconAction label={t('customFaceEditor.workbench.deleteFace')} icon={Trash2} onClick={onDelete} disabled={!face || busy || state.presentGroup.faces.length <= 1} /></div><p className="mt-2 text-xs text-muted-foreground">{t('customFaceEditor.workbench.currentFrame', { current: face ? state.selectedFrameIndex + 1 : 0, total: face?.frames.length ?? 0 })}</p><label className="mt-2 block text-xs text-muted-foreground">{t('customFaceEditor.workbench.frameDuration')}<input aria-label={t('customFaceEditor.workbench.frameDuration')} type="number" min="120" max="5000" value={durationDraft} disabled={!face || playing} className="mt-1 w-full border border-border bg-background px-2 py-1" onChange={(event) => setDurationDraft(event.target.value)} onBlur={commitDuration} onKeyDown={(event) => { if (event.key === "Enter") commitDuration(); }} /></label><p className="mt-2 text-xs text-muted-foreground">{t('customFaceEditor.workbench.resolutionFaces', { width: state.profile.width, height: state.profile.height, count: state.presentGroup.faces.length })}</p></section>;
}

function IconAction({ label, icon: Icon, onClick, disabled = false }: { label: string; icon: typeof Plus; onClick: () => void; disabled?: boolean }) { return <button type="button" aria-label={label} title={label} disabled={disabled} className="flex items-center justify-center border border-border p-1 disabled:opacity-30" onClick={onClick}><Icon className="h-4 w-4" /></button>; }

function PendingImportActions({ pending, onCancel, onConfirm, onScale }: { pending: { pixels: number[]; mode: 'merge' | 'replace'; scale: number; sourceWidth: number; sourceHeight: number } | null; onCancel: () => void; onConfirm: () => void; onScale: (scale: number) => void }) {
  const t = useI18n();
  if (!pending) return null;
  return <section className="border border-fuchsia-400/60 bg-fuchsia-400/10 p-3 text-xs"><p className="font-medium text-fuchsia-200">{t('customFaceEditor.workbench.pendingTitle')}</p><p className="mt-1 text-muted-foreground">{t('customFaceEditor.workbench.pendingDescription')}</p><label className="mt-2 block">{t('customFaceEditor.workbench.pendingScale', { scale: pending.scale.toFixed(2) })}<input aria-label={t('customFaceEditor.workbench.pendingScaleLabel')} className="mt-1 w-full" type="range" min="0.25" max="4" step="0.05" value={pending.scale} onChange={(event) => onScale(Number(event.target.value))} /></label><div className="mt-2 flex gap-2"><button type="button" className="border border-border px-2 py-1" onClick={onCancel}>{t('customFaceEditor.workbench.cancelApply')}</button><button type="button" className="border border-primary bg-primary px-2 py-1 text-primary-foreground" onClick={onConfirm}>{t('customFaceEditor.workbench.confirmApply')}</button></div></section>;
}

function ToolPanel({ tool, state, selection, selectionOrigin, clipboardReady, constraintEnabled, rectangleFilled, eraserSize, onConstraint, onRectangleFilled, onEraserSize, onPenCommand, onCopy, onPaste, onClear, onSetActive, onCancelSelection, onCancelMove, onMoveSelection, selectionMoveStep, onSelectionMoveStep }: { tool: ToolId; state: CanvasToolState; selection: EditorState['selection']; selectionOrigin: EditorState['selectionOrigin']; clipboardReady: boolean; constraintEnabled: boolean; rectangleFilled: boolean; eraserSize: number; onConstraint: (value: boolean) => void; onRectangleFilled: (value: boolean) => void; onEraserSize: (value: number) => void; onPenCommand: (type: 'finish' | 'cancel') => void; onCopy: () => void; onPaste: () => void; onClear: () => void; onSetActive: (active: boolean) => void; onCancelSelection: () => void; onCancelMove: () => void; onMoveSelection: (dx: number, dy: number) => void; selectionMoveStep: number; onSelectionMoveStep: (value: number) => void }) {
  const t = useI18n();
  return <section className="min-h-0 flex-1 overflow-y-auto border-t border-border pt-3 pb-4"><h2 className="font-medium">{t('customFaceEditor.workbench.toolProperties')}</h2><p className="mt-3 text-muted-foreground">{t('customFaceEditor.workbench.currentTool', { tool: t(`customFaceEditor.toolbar.tools.${TOOL_LABELS[tool]}.label`) })}</p>{supportsConstraint(tool) ? <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={constraintEnabled} onChange={(event) => onConstraint(event.target.checked)} />{constraintText(tool, t)}</label> : null}{tool === 'rectangle' ? <div className="mt-3 flex gap-2"><button className={!rectangleFilled ? 'border border-primary bg-primary/10 px-2 py-1 text-xs' : 'border border-border px-2 py-1 text-xs'} onClick={() => onRectangleFilled(false)}>{t('customFaceEditor.workbench.outline')}</button><button className={rectangleFilled ? 'border border-primary bg-primary/10 px-2 py-1 text-xs' : 'border border-border px-2 py-1 text-xs'} onClick={() => onRectangleFilled(true)}>{t('customFaceEditor.workbench.filled')}</button></div> : null}{tool === 'eraser' ? <label className="mt-3 block text-xs text-muted-foreground">{t('customFaceEditor.workbench.eraseArea', { size: eraserSize })}<input className="mt-2 w-full" type="range" min="1" max="8" value={eraserSize} onChange={(event) => onEraserSize(Number(event.target.value))} /></label> : null}{state.start ? <p className="mt-3 text-xs text-muted-foreground">{t('customFaceEditor.workbench.start', { point: state.start.join(', ') })}</p> : null}{state.end ? <p className="mt-1 text-xs text-muted-foreground">{t('customFaceEditor.workbench.end', { point: state.end.join(', ') })}</p> : null}{state.bounds ? <p className="mt-1 text-xs text-muted-foreground">{t('customFaceEditor.workbench.bounds', { width: state.bounds.width, height: state.bounds.height })}</p> : null}{selection ? <div className="mt-3 border-t border-border pt-3"><p className="text-xs text-muted-foreground">{t('customFaceEditor.workbench.selectionInfo', { x: selection.x, y: selection.y, width: selection.width, height: selection.height })}</p><label className="mt-2 block text-xs text-muted-foreground">{t('customFaceEditor.workbench.moveStep')}<input aria-label={t('customFaceEditor.workbench.moveStep')} className="mt-1 w-full border border-border px-2 py-1" type="number" min="1" max="8" step="1" value={selectionMoveStep} onChange={(event) => onSelectionMoveStep(Math.max(1, Math.min(8, Number(event.target.value) || 1)))} /></label><div className="mx-auto mt-2 grid w-24 grid-cols-3 gap-1"><span /><button aria-label={t('customFaceEditor.workbench.up')} title={t('customFaceEditor.workbench.up')} className="border border-border p-1" onClick={() => onMoveSelection(0, -1)}><ArrowUp className="mx-auto h-4 w-4" /></button><span /><button aria-label={t('customFaceEditor.workbench.left')} title={t('customFaceEditor.workbench.left')} className="border border-border p-1" onClick={() => onMoveSelection(-1, 0)}><ArrowLeft className="mx-auto h-4 w-4" /></button><button aria-label={t('customFaceEditor.workbench.down')} title={t('customFaceEditor.workbench.down')} className="border border-border p-1" onClick={() => onMoveSelection(0, 1)}><ArrowDown className="mx-auto h-4 w-4" /></button><button aria-label={t('customFaceEditor.workbench.right')} title={t('customFaceEditor.workbench.right')} className="border border-border p-1" onClick={() => onMoveSelection(1, 0)}><ArrowRight className="mx-auto h-4 w-4" /></button></div><div className="mt-2 grid grid-cols-2 gap-2">{selectionOrigin ? <button className="col-span-2 border border-primary bg-primary/10 px-2 py-1 text-xs" onClick={onCancelSelection}>{t('customFaceEditor.workbench.confirmMove')}</button> : null}<button className="border border-border px-2 py-1 text-xs" onClick={onCopy}>{t('customFaceEditor.workbench.copy')}</button><button className="border border-border px-2 py-1 text-xs" title={clipboardReady ? t('customFaceEditor.workbench.pasteHint') : t('customFaceEditor.workbench.copyFirst')} onClick={onPaste}>{t('customFaceEditor.workbench.paste')}</button><button className="border border-border px-2 py-1 text-xs" onClick={onClear}>{t('customFaceEditor.workbench.clear')}</button><button className="border border-border px-2 py-1 text-xs" onClick={() => onSetActive(true)}>{t('customFaceEditor.workbench.highlight')}</button><button className="border border-border px-2 py-1 text-xs" onClick={() => onSetActive(false)}>{t('customFaceEditor.workbench.dim')}</button><button className="border border-border px-2 py-1 text-xs" onClick={selectionOrigin ? onCancelMove : onCancelSelection}>{selectionOrigin ? t('customFaceEditor.workbench.cancelMove') : t('customFaceEditor.workbench.cancel')}</button></div></div> : tool === 'select' ? <p className="mt-3 text-xs text-muted-foreground">{t('customFaceEditor.workbench.selectHint')}</p> : null}{tool === 'pen' ? <div className="mt-3"><p className="text-xs text-muted-foreground">{t('customFaceEditor.workbench.points', { count: state.penPointCount })}</p><div className="mt-2 flex gap-2"><button className="border border-primary px-2 py-1 text-xs" onClick={() => onPenCommand('finish')}>{t('customFaceEditor.workbench.finishPath')}</button><button className="border border-border px-2 py-1 text-xs" onClick={() => onPenCommand('cancel')}>{t('customFaceEditor.workbench.cancelPath')}</button></div></div> : null}<p className="mt-4 text-xs text-muted-foreground">{toolHint(tool, t)}</p></section>;
}

function uniqueFaceName(state: EditorState, base: string) { const names = new Set(state.presentGroup.faces.map((face) => face.name.trim().toLocaleLowerCase())); if (!names.has(base.toLocaleLowerCase())) return base; for (let index = 2; index <= 99; index += 1) { const candidate = `${base} ${index}`; if (!names.has(candidate.toLocaleLowerCase())) return candidate; } return `${base} ${Date.now()}`; }
function safeFaceFileName(name: string, fallback = 'custom-face') { return name.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || fallback; }
function sameFaceContent(left: { color: { red: number; green: number; blue: number }; frames: Array<{ durationMs: number; packedPixels: number[] }> }, right: { color: { red: number; green: number; blue: number }; frames: Array<{ durationMs: number; packedPixels: number[] }> }) { return left.color.red === right.color.red && left.color.green === right.color.green && left.color.blue === right.color.blue && left.frames.length === right.frames.length && left.frames.every((frame, index) => frame.durationMs === right.frames[index].durationMs && frame.packedPixels.length === right.frames[index].packedPixels.length && frame.packedPixels.every((pixel, pixelIndex) => pixel === right.frames[index].packedPixels[pixelIndex])); }
function packedPixelsToChanges(pixels: number[], width: number, height: number) { const changes: Array<{ x: number; y: number; active: boolean }> = []; for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) changes.push({ x, y, active: (pixels[x + Math.floor(y / 8) * width] & (1 << (y & 7))) !== 0 }); return changes; }
function movePackedPixels(pixels: number[], width: number, height: number, dx: number, dy: number) { const next = new Array(pixels.length).fill(0); for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const source = x + Math.floor(y / 8) * width; if ((pixels[source] & (1 << (y & 7))) === 0) continue; const targetX = x + dx; const targetY = y + dy; if (targetX < 0 || targetY < 0 || targetX >= width || targetY >= height) continue; const target = targetX + Math.floor(targetY / 8) * width; next[target] |= 1 << (targetY & 7); } return next; }
function scalePackedPixels(pixels: number[], width: number, height: number, scale: number) { const next = new Array(pixels.length).fill(0); const centerX = (width - 1) / 2; const centerY = (height - 1) / 2; for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const sourceX = Math.round((x - centerX) / scale + centerX); const sourceY = Math.round((y - centerY) / scale + centerY); if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) continue; const source = sourceX + Math.floor(sourceY / 8) * width; if ((pixels[source] & (1 << (sourceY & 7))) === 0) continue; const target = x + Math.floor(y / 8) * width; next[target] |= 1 << (y & 7); } return next; }
function conflictLibraryHash(message: string) { return message.match(/custom face group conflicts with current hash (\S+)/)?.[1] ?? null; }
function supportsConstraint(tool: ToolId) { return ['line', 'rectangle', 'circle', 'triangle'].includes(tool); }
function constraintText(tool: ToolId, t: ReturnType<typeof useI18n>) { return t(`customFaceEditor.workbench.constraints.${tool}`); }
function toolHint(tool: ToolId, t: ReturnType<typeof useI18n>) { return t(`customFaceEditor.workbench.toolHints.${TOOL_LABELS[tool]}`); }
