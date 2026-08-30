import { useEffect, useReducer, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Plus, Star, Trash2 } from 'lucide-react';
import { clearCustomFaceRecovery, closeCustomFaceEditor, deleteCustomFaceAsset, getCustomFaceAssets, getCustomFaceGroup, saveCustomFaceAsset, saveCustomFaceGroup, saveCustomFaceRecovery } from '@/api/tauriApi';
import type { PersonalCustomFaceAsset } from '@/api/tauriApi';
import type { SaveCustomFaceGroupResult } from '@/api/tauriApi';
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

type Props = { initialState: EditorState; expectedLibraryHash?: string; onBack: () => void; onSaved: (result: SaveCustomFaceGroupResult) => void };
const TOOL_LABELS: Record<ToolId, string> = { select: '框选', brush: '画笔', eraser: '橡皮擦', line: '直线', rectangle: '矩形', circle: '圆形', triangle: '三角形', pen: '钢笔' };

export function CustomFaceEditorWorkbench({ initialState, expectedLibraryHash, onBack, onSaved }: Props) {
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
  const [statusMessage, setStatusMessage] = useState('选择工具后在画布中操作。');
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
      setStatusMessage('已保存当前表情组。');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const currentHash = conflictLibraryHash(message);
      if (currentHash) {
        setConflictHash(currentHash);
        setStatusMessage('保存冲突：磁盘中的表情组已被其他操作修改。');
      } else {
        setSaveError(message);
        setStatusMessage(`保存失败：${message}`);
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
      setStatusMessage('已重新加载磁盘版本，本地未保存修改已丢弃。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
      setStatusMessage(`重新加载失败：${message}`);
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
      setStatusMessage(`丢弃修改失败：${message}`);
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
        setStatusMessage(`关闭编辑器失败：${message}`);
      }
    }
  };
  const changeFace = (faceId: string) => { clearSelection(); dispatch({ type: 'select-face', faceId }); setStatusMessage('已切换表情并加载第一帧。'); };
  const addFace = () => { if (state.presentGroup.faces.length >= 15) { setStatusMessage('每组最多 15 个表情。'); return; } const name = uniqueFaceName(state, '新表情'); dispatch({ type: 'add-face', face: { faceId: crypto.randomUUID(), name, color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(state.profile.framebufferBytes).fill(0) }] } }); clearSelection(); setStatusMessage(`已新增“${name}”。`); };
  const duplicateFace = () => { if (!face) return; if (state.presentGroup.faces.length >= 15) { setStatusMessage('每组最多 15 个表情。'); return; } const name = uniqueFaceName(state, `${face.name} 副本`); dispatch({ type: 'duplicate-face', sourceFaceId: face.faceId, faceId: crypto.randomUUID(), name }); clearSelection(); setStatusMessage(`已复制为“${name}”。`); };
  const renameFace = (name: string) => { if (!face) return; const nextName = name.trim(); if (!nextName) { setStatusMessage('表情名称不能为空。'); return; } if (state.presentGroup.faces.some((item) => item.faceId !== face.faceId && item.name.trim().toLocaleLowerCase() === nextName.toLocaleLowerCase())) { setStatusMessage('当前组内表情名称不能重复。'); return; } dispatch({ type: 'rename-face', faceId: face.faceId, name: nextName }); setStatusMessage(`已重命名为“${nextName}”。`); };
  const deleteFace = () => { if (!face) return; if (state.presentGroup.faces.length <= 1) { setStatusMessage('每组至少保留一个表情。'); return; } if (!window.confirm(`确定删除表情“${face.name}”吗？`)) return; const replacement = state.presentGroup.faces.find((item) => item.faceId !== face.faceId); dispatch({ type: 'delete-face', faceId: face.faceId, replacementDefaultFaceId: face.faceId === state.presentGroup.defaultFaceId ? replacement?.faceId : undefined }); clearSelection(); };

  return <><main className="flex h-screen min-h-0 flex-col bg-background text-foreground"><header className="flex items-center gap-3 border-b border-border px-4 py-3"><button className="border border-border px-3 py-2 text-sm" onClick={() => { if (state.past.length) setLeaveIntent('back'); else onBack(); }}>返回组管理</button><button className="border border-primary px-3 py-2 text-sm disabled:opacity-50" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存'}</button><button type="button" className="border border-border px-3 py-2 text-sm" disabled={saving || !face} onClick={() => setSvgDialogOpen(true)}>导入 SVG</button><button type="button" className="border border-border px-3 py-2 text-sm" onClick={() => setAssetLibraryOpen(true)}>素材库</button><label className="flex items-center gap-2 text-xs text-muted-foreground">组名称<input aria-label="组名称" value={groupNameDraft} maxLength={64} className="w-48 border border-border bg-background px-2 py-1 text-sm text-foreground" onChange={(event) => setGroupNameDraft(event.target.value)} /><button type="button" aria-label="应用组名称" disabled={!groupNameDraft.trim() || groupNameDraft.trim() === state.presentGroup.name} className="border border-border px-2 py-1 text-xs text-foreground disabled:opacity-30" onClick={() => { const name = groupNameDraft.trim(); dispatch({ type: 'rename-group', name }); setStatusMessage(`组名称已修改为“${name}”。`); }}>应用</button></label><span className="border border-primary bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">{state.profile.width} × {state.profile.height}</span><span className="ml-auto text-xs text-muted-foreground">{state.past.length ? '有未保存修改' : '已保存'}</span></header>{saveError ? <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">保存失败：{saveError}</div> : null}<div className="flex min-h-0 flex-1 gap-3 p-3"><CustomFaceToolbar collapsed={collapsed} selectedTool={selectedTool} canUndo={state.past.length > 0 && !playing} canRedo={state.future.length > 0 && !playing} onCollapsedChange={setCollapsed} onToolChange={(tool) => { setSelectedTool(tool); setStatusMessage(toolHint(tool)); }} onUndo={() => dispatch({ type: 'undo' })} onRedo={() => dispatch({ type: 'redo' })} /><section className="flex min-w-0 flex-1 flex-col gap-3"><CustomFaceCanvas width={state.profile.width} height={state.profile.height} pixels={pixels} selection={selection} selectionOrigin={state.selectionOrigin} pendingImportPixels={pendingImport?.pixels} pendingImportOffset={{ x: pendingImport?.offsetX ?? 0, y: pendingImport?.offsetY ?? 0 }} pendingImportSize={{ width: pendingImport?.sourceWidth ?? state.profile.width, height: pendingImport?.sourceHeight ?? state.profile.height }} onPendingImportMove={(dx, dy) => setPendingImport((current) => current ? { ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy } : current)} guides={guides} eraserSize={eraserSize} onionPixels={onionFrame ? new Uint8Array(onionFrame.packedPixels) : undefined} selectedTool={selectedTool} constraintEnabled={constraintEnabled} rectangleFilled={rectangleFilled} disabled={playing} penCommand={penCommand} onGuidesChange={setGuides} onToolStateChange={setToolState} onSelectionChange={(value) => { setSelection(value); dispatch({ type: 'set-selection', selection: value }); if (value) setStatusMessage(`已框选 ${value.width} × ${value.height} 像素区域。`); }} onPixelTransaction={(changes) => dispatch({ type: 'apply-pixel-transaction', pixels: changes })} /><div role="status" className="min-h-8 border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{statusMessage}</div><CustomFaceTimeline frames={face?.frames ?? []} width={state.profile.width} height={state.profile.height} selectedIndex={state.selectedFrameIndex} onSelect={(index) => { clearSelection(); dispatch({ type: 'select-frame', index }); }} onMove={(from, to) => { clearSelection(); dispatch({ type: 'move-frame', from, to }); }} onAdd={() => { clearSelection(); dispatch({ type: 'add-frame' }); setStatusMessage('已复制当前帧并追加到时间轴末尾。'); }} onDelete={(index) => { clearSelection(); dispatch({ type: 'delete-frame', index }); }} onPlayingChange={setPlaying} /></section><aside className="flex w-64 shrink-0 flex-col gap-4 overflow-hidden border-l border-border pl-4 text-sm"><FacePanel state={state} face={face} frameDuration={frame?.durationMs ?? 200} playing={playing} onSelect={changeFace} onAdd={addFace} onDuplicate={duplicateFace} onRename={renameFace} onDefault={() => face && dispatch({ type: 'set-default-face', faceId: face.faceId })} onDelete={deleteFace} onDuration={(durationMs) => dispatch({ type: 'set-frame-duration', index: state.selectedFrameIndex, durationMs })} /><CustomFaceAssetLibrary open={assetLibraryOpen} onClose={() => setAssetLibraryOpen(false)} groupId={state.presentGroup.groupId} activeTab={assetTab} onTabChange={setAssetTab} personalAssets={personalAssets} onApplyPersonal={(asset) => { setPendingImport({ pixels: Array.from(asset.packedPixels), basePixels: Array.from(asset.packedPixels), mode: "merge", scale: 1, offsetX: 0, offsetY: 0, sourceWidth: asset.width, sourceHeight: asset.height }); setAssetLibraryOpen(false); setStatusMessage("个人素材已加载到画布，请调整后确认应用。"); }} onSaveCurrent={async (scope) => { if (!frame) return; const now = new Date().toISOString(); const saved = await saveCustomFaceAsset({ assetId: crypto.randomUUID(), scope, groupId: scope === "group" ? state.presentGroup.groupId : null, name: "帧 " + (state.selectedFrameIndex + 1), tags: [], profileId: state.profile.id, width: state.profile.width, height: state.profile.height, packedPixels: [...frame.packedPixels], source: "editor", createdAt: now, updatedAt: now }); setPersonalAssets((items) => [...items, saved]); setAssetTab(scope); setHighlightAssetId(saved.assetId); setStatusMessage("当前帧已保存为个人素材。"); }} onDeletePersonal={async (assetId) => { await deleteCustomFaceAsset(assetId); setPersonalAssets((items) => items.filter((asset) => asset.assetId !== assetId)); }} onRenamePersonal={async (asset, name) => { const saved = await saveCustomFaceAsset({ ...asset, name, updatedAt: new Date().toISOString() }); setPersonalAssets((items) => items.map((item) => item.assetId === saved.assetId ? saved : item)); }} onUpdateTags={async (asset, tags) => { const saved = await saveCustomFaceAsset({ ...asset, tags, updatedAt: new Date().toISOString() }); setPersonalAssets((items) => items.map((item) => item.assetId === saved.assetId ? saved : item)); }} /><ToolPanel tool={selectedTool} state={toolState} selection={selection} selectionOrigin={state.selectionOrigin} clipboardReady={Boolean(state.clipboard)} constraintEnabled={constraintEnabled} rectangleFilled={rectangleFilled} eraserSize={eraserSize} onConstraint={setConstraintEnabled} onRectangleFilled={setRectangleFilled} onEraserSize={setEraserSize} onPenCommand={(type) => setPenCommand({ id: Date.now(), type })} onCopy={() => { if (!selection) return; dispatch({ type: 'copy-selection' }); setStatusMessage('已复制选区，可切换帧后粘贴。'); }} onPaste={() => { if (!selection) { setStatusMessage('请先框选粘贴目标区域。'); return; } if (!state.clipboard) { setStatusMessage('剪贴板为空，请先复制选区。'); return; } dispatch({ type: 'paste-selection' }); clearSelection(); }} onClear={() => { if (selection) { dispatch({ type: 'clear-selection' }); clearSelection(); } }} onSetActive={(active) => { if (selection) { dispatch({ type: 'set-selection-active', active }); clearSelection(); } }} onCancelSelection={clearSelection} onCancelMove={() => { dispatch({ type: "cancel-selection-move" }); setSelection(null); }} selectionMoveStep={selectionMoveStep} onSelectionMoveStep={setSelectionMoveStep} onMoveSelection={(dx, dy) => dispatch({ type: "move-selection", dx: dx * selectionMoveStep, dy: dy * selectionMoveStep })} /><PendingImportActions pending={pendingImport} onCancel={() => setPendingImport(null)} onScale={(scale) => setPendingImport((current) => current ? { ...current, scale, pixels: scalePackedPixels(current.basePixels, state.profile.width, state.profile.height, scale) } : current)} onConfirm={() => { if (!pendingImport) return; const changes = pendingImport.mode === "replace" ? packedPixelsToChanges(movePackedPixels(pendingImport.pixels, state.profile.width, state.profile.height, pendingImport.offsetX, pendingImport.offsetY), state.profile.width, state.profile.height) : packedPixelsToChanges(movePackedPixels(pendingImport.pixels, state.profile.width, state.profile.height, pendingImport.offsetX, pendingImport.offsetY), state.profile.width, state.profile.height).filter((change) => change.active); dispatch({ type: "apply-pixel-transaction", pixels: changes }); setPendingImport(null); setStatusMessage("临时对象已应用到当前帧。"); }} /></aside></div></main><SaveConflictDialog open={Boolean(conflictHash)} busy={saving} onCancel={() => setConflictHash(null)} onReload={() => void reloadDiskGroup()} onOverwrite={() => { if (conflictHash) void save(conflictHash); }} /><LeaveConfirmDialog open={Boolean(leaveIntent)} busy={saving} onCancel={() => setLeaveIntent(null)} onDiscard={() => void discardAndLeave()} onSave={() => void saveAndLeave()} /><CustomFaceSvgImportDialog open={svgDialogOpen} width={state.profile.width} height={state.profile.height} onCancel={() => setSvgDialogOpen(false)} onApply={(packedPixels, mode) => { setPendingImport({ pixels: packedPixels, basePixels: packedPixels, mode, scale: 1, offsetX: 0, offsetY: 0, sourceWidth: state.profile.width, sourceHeight: state.profile.height }); setAssetLibraryOpen(false); setSvgDialogOpen(false); setStatusMessage('SVG 已加载到画布，请调整位置后确认导入。'); }} /></>;
}

function SaveConflictDialog({ open, busy, onCancel, onReload, onOverwrite }: { open: boolean; busy: boolean; onCancel: () => void; onReload: () => void; onOverwrite: () => void }) {
  return <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>检测到保存冲突</AlertDialogTitle><AlertDialogDescription>磁盘中的表情组已被其他操作修改。重新加载会丢弃当前本地修改；覆盖保存会以当前本地版本替换磁盘版本。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction disabled={busy} className="border border-border bg-background text-foreground hover:bg-accent" onClick={onReload}>重新加载磁盘版本</AlertDialogAction><AlertDialogAction disabled={busy} onClick={onOverwrite}>覆盖保存</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function LeaveConfirmDialog({ open, busy, onCancel, onDiscard, onSave }: { open: boolean; busy: boolean; onCancel: () => void; onDiscard: () => void; onSave: () => void }) {
  return <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>保存未完成的修改？</AlertDialogTitle><AlertDialogDescription>当前表情组包含尚未正式保存的修改。保存失败时编辑器会保持打开。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDiscard}>丢弃修改</AlertDialogAction><AlertDialogAction disabled={busy} onClick={onSave}>保存并关闭</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function FacePanel({ state, face, frameDuration, playing, onSelect, onAdd, onDuplicate, onRename, onDefault, onDelete, onDuration }: { state: EditorState; face: EditorState['presentGroup']['faces'][number] | undefined; frameDuration: number; playing: boolean; onSelect: (id: string) => void; onAdd: () => void; onDuplicate: () => void; onRename: (name: string) => void; onDefault: () => void; onDelete: () => void; onDuration: (value: number) => void }) {
  const [nameDraft, setNameDraft] = useState(face?.name ?? '');
  const [durationDraft, setDurationDraft] = useState(String(frameDuration));
  useEffect(() => setNameDraft(face?.name ?? ''), [face?.faceId, face?.name]);
  useEffect(() => setDurationDraft(String(frameDuration)), [frameDuration, face?.faceId]);
  const commitDuration = () => { const value = Number(durationDraft); if (Number.isFinite(value)) { onDuration(value); setDurationDraft(String(Math.max(120, Math.min(5000, Math.trunc(value))))); } };
  const canApplyName = Boolean(face && nameDraft.trim() && nameDraft.trim() !== face.name);
  return <section className="shrink-0 border-b border-border pb-4"><h2 className="font-medium">当前表情</h2><Select value={face?.faceId} onValueChange={onSelect}><SelectTrigger aria-label="当前表情" className="mt-2"><SelectValue placeholder="选择表情" /></SelectTrigger><SelectContent>{state.presentGroup.faces.map((item) => <SelectItem key={item.faceId} value={item.faceId}>{item.name}{item.faceId === state.presentGroup.defaultFaceId ? ' · 默认' : ''}</SelectItem>)}</SelectContent></Select><label className="mt-2 block text-xs text-muted-foreground">表情名称<div className="mt-1 flex gap-1"><input aria-label="表情名称" value={nameDraft} disabled={!face || playing} maxLength={64} className="min-w-0 flex-1 border border-border bg-background px-2 py-1 text-sm text-foreground" onChange={(event) => setNameDraft(event.target.value)} /><button type="button" aria-label="应用名称" disabled={!canApplyName || playing} className="border border-border px-2 py-1 text-xs disabled:opacity-30" onClick={() => onRename(nameDraft)}>应用</button></div></label><div className="mt-2 grid grid-cols-3 gap-1"><IconAction label="新增表情" icon={Plus} onClick={onAdd} /><IconAction label="复制表情" icon={Copy} onClick={onDuplicate} disabled={!face} /><IconAction label="设为默认表情" icon={Star} onClick={onDefault} disabled={!face || face.faceId === state.presentGroup.defaultFaceId} /><IconAction label="删除表情" icon={Trash2} onClick={onDelete} disabled={!face || state.presentGroup.faces.length <= 1} /></div><p className="mt-2 text-xs text-muted-foreground">当前帧 {face ? state.selectedFrameIndex + 1 : 0} / {face?.frames.length ?? 0}</p><label className="mt-2 block text-xs text-muted-foreground">帧时长<input aria-label="帧时长" type="number" min="120" max="5000" value={durationDraft} disabled={!face || playing} className="mt-1 w-full border border-border bg-background px-2 py-1" onChange={(event) => setDurationDraft(event.target.value)} onBlur={commitDuration} onKeyDown={(event) => { if (event.key === "Enter") commitDuration(); }} /></label><p className="mt-2 text-xs text-muted-foreground">分辨率 {state.profile.width} × {state.profile.height} · 表情 {state.presentGroup.faces.length} / 15</p></section>;
}

function IconAction({ label, icon: Icon, onClick, disabled = false }: { label: string; icon: typeof Plus; onClick: () => void; disabled?: boolean }) { return <button type="button" aria-label={label} title={label} disabled={disabled} className="flex items-center justify-center border border-border p-1 disabled:opacity-30" onClick={onClick}><Icon className="h-4 w-4" /></button>; }

function PendingImportActions({ pending, onCancel, onConfirm, onScale }: { pending: { pixels: number[]; mode: 'merge' | 'replace'; scale: number; sourceWidth: number; sourceHeight: number } | null; onCancel: () => void; onConfirm: () => void; onScale: (scale: number) => void }) {
  if (!pending) return null;
  return <section className="border border-fuchsia-400/60 bg-fuchsia-400/10 p-3 text-xs"><p className="font-medium text-fuchsia-200">素材待确认应用</p><p className="mt-1 text-muted-foreground">拖动画布调整位置，确认后写入当前帧。</p><label className="mt-2 block">缩放：{pending.scale.toFixed(2)}<input aria-label="临时素材缩放" className="mt-1 w-full" type="range" min="0.25" max="4" step="0.05" value={pending.scale} onChange={(event) => onScale(Number(event.target.value))} /></label><div className="mt-2 flex gap-2"><button type="button" className="border border-border px-2 py-1" onClick={onCancel}>取消应用</button><button type="button" className="border border-primary bg-primary px-2 py-1 text-primary-foreground" onClick={onConfirm}>确认应用</button></div></section>;
}

function ToolPanel({ tool, state, selection, selectionOrigin, clipboardReady, constraintEnabled, rectangleFilled, eraserSize, onConstraint, onRectangleFilled, onEraserSize, onPenCommand, onCopy, onPaste, onClear, onSetActive, onCancelSelection, onCancelMove, onMoveSelection, selectionMoveStep, onSelectionMoveStep }: { tool: ToolId; state: CanvasToolState; selection: EditorState['selection']; selectionOrigin: EditorState['selectionOrigin']; clipboardReady: boolean; constraintEnabled: boolean; rectangleFilled: boolean; eraserSize: number; onConstraint: (value: boolean) => void; onRectangleFilled: (value: boolean) => void; onEraserSize: (value: number) => void; onPenCommand: (type: 'finish' | 'cancel') => void; onCopy: () => void; onPaste: () => void; onClear: () => void; onSetActive: (active: boolean) => void; onCancelSelection: () => void; onCancelMove: () => void; onMoveSelection: (dx: number, dy: number) => void; selectionMoveStep: number; onSelectionMoveStep: (value: number) => void }) {
  return <section className="min-h-0 flex-1 overflow-y-auto border-t border-border pt-3 pb-4"><h2 className="font-medium">工具属性</h2><p className="mt-3 text-muted-foreground">当前工具：{TOOL_LABELS[tool]}</p>{supportsConstraint(tool) ? <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={constraintEnabled} onChange={(event) => onConstraint(event.target.checked)} />{constraintText(tool)}</label> : null}{tool === 'rectangle' ? <div className="mt-3 flex gap-2"><button className={!rectangleFilled ? 'border border-primary bg-primary/10 px-2 py-1 text-xs' : 'border border-border px-2 py-1 text-xs'} onClick={() => onRectangleFilled(false)}>空心</button><button className={rectangleFilled ? 'border border-primary bg-primary/10 px-2 py-1 text-xs' : 'border border-border px-2 py-1 text-xs'} onClick={() => onRectangleFilled(true)}>实心</button></div> : null}{tool === 'eraser' ? <label className="mt-3 block text-xs text-muted-foreground">擦除范围：{eraserSize} × {eraserSize}<input className="mt-2 w-full" type="range" min="1" max="8" value={eraserSize} onChange={(event) => onEraserSize(Number(event.target.value))} /></label> : null}{state.start ? <p className="mt-3 text-xs text-muted-foreground">起点：{state.start.join(', ')}</p> : null}{state.end ? <p className="mt-1 text-xs text-muted-foreground">终点：{state.end.join(', ')}</p> : null}{state.bounds ? <p className="mt-1 text-xs text-muted-foreground">范围：{state.bounds.width} × {state.bounds.height}</p> : null}{selection ? <div className="mt-3 border-t border-border pt-3"><p className="text-xs text-muted-foreground">选区：{selection.x},{selection.y} · {selection.width} × {selection.height}</p><label className="mt-2 block text-xs text-muted-foreground">移动步长<input aria-label="选区移动步长" className="mt-1 w-full border border-border px-2 py-1" type="number" min="1" max="8" step="1" value={selectionMoveStep} onChange={(event) => onSelectionMoveStep(Math.max(1, Math.min(8, Number(event.target.value) || 1)))} /></label><div className="mx-auto mt-2 grid w-24 grid-cols-3 gap-1"><span /><button aria-label="向上移动选区" title="向上移动选区" className="border border-border p-1" onClick={() => onMoveSelection(0, -1)}><ArrowUp className="mx-auto h-4 w-4" /></button><span /><button aria-label="向左移动选区" title="向左移动选区" className="border border-border p-1" onClick={() => onMoveSelection(-1, 0)}><ArrowLeft className="mx-auto h-4 w-4" /></button><button aria-label="向下移动选区" title="向下移动选区" className="border border-border p-1" onClick={() => onMoveSelection(0, 1)}><ArrowDown className="mx-auto h-4 w-4" /></button><button aria-label="向右移动选区" title="向右移动选区" className="border border-border p-1" onClick={() => onMoveSelection(1, 0)}><ArrowRight className="mx-auto h-4 w-4" /></button></div><div className="mt-2 grid grid-cols-2 gap-2">{selectionOrigin ? <button className="col-span-2 border border-primary bg-primary/10 px-2 py-1 text-xs" onClick={onCancelSelection}>确认移动</button> : null}<button className="border border-border px-2 py-1 text-xs" onClick={onCopy}>复制</button><button className="border border-border px-2 py-1 text-xs" title={clipboardReady ? '粘贴到当前选区左上角' : '请先复制选区'} onClick={onPaste}>粘贴</button><button className="border border-border px-2 py-1 text-xs" onClick={onClear}>清空</button><button className="border border-border px-2 py-1 text-xs" onClick={() => onSetActive(true)}>高亮</button><button className="border border-border px-2 py-1 text-xs" onClick={() => onSetActive(false)}>熄灭</button><button className="border border-border px-2 py-1 text-xs" onClick={selectionOrigin ? onCancelMove : onCancelSelection}>{selectionOrigin ? "取消移动" : "取消"}</button></div></div> : tool === 'select' ? <p className="mt-3 text-xs text-muted-foreground">请在画布中拖拽建立选区。</p> : null}{tool === 'pen' ? <div className="mt-3"><p className="text-xs text-muted-foreground">顶点：{state.penPointCount}</p><div className="mt-2 flex gap-2"><button className="border border-primary px-2 py-1 text-xs" onClick={() => onPenCommand('finish')}>完成路径</button><button className="border border-border px-2 py-1 text-xs" onClick={() => onPenCommand('cancel')}>取消路径</button></div></div> : null}<p className="mt-4 text-xs text-muted-foreground">{toolHint(tool)}</p></section>;
}

function uniqueFaceName(state: EditorState, base: string) { const names = new Set(state.presentGroup.faces.map((face) => face.name.trim().toLocaleLowerCase())); if (!names.has(base.toLocaleLowerCase())) return base; for (let index = 2; index <= 99; index += 1) { const candidate = `${base} ${index}`; if (!names.has(candidate.toLocaleLowerCase())) return candidate; } return `${base} ${Date.now()}`; }
function packedPixelsToChanges(pixels: number[], width: number, height: number) { const changes: Array<{ x: number; y: number; active: boolean }> = []; for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) changes.push({ x, y, active: (pixels[x + Math.floor(y / 8) * width] & (1 << (y & 7))) !== 0 }); return changes; }
function movePackedPixels(pixels: number[], width: number, height: number, dx: number, dy: number) { const next = new Array(pixels.length).fill(0); for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const source = x + Math.floor(y / 8) * width; if ((pixels[source] & (1 << (y & 7))) === 0) continue; const targetX = x + dx; const targetY = y + dy; if (targetX < 0 || targetY < 0 || targetX >= width || targetY >= height) continue; const target = targetX + Math.floor(targetY / 8) * width; next[target] |= 1 << (targetY & 7); } return next; }
function scalePackedPixels(pixels: number[], width: number, height: number, scale: number) { const next = new Array(pixels.length).fill(0); const centerX = (width - 1) / 2; const centerY = (height - 1) / 2; for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const sourceX = Math.round((x - centerX) / scale + centerX); const sourceY = Math.round((y - centerY) / scale + centerY); if (sourceX < 0 || sourceY < 0 || sourceX >= width || sourceY >= height) continue; const source = sourceX + Math.floor(sourceY / 8) * width; if ((pixels[source] & (1 << (sourceY & 7))) === 0) continue; const target = x + Math.floor(y / 8) * width; next[target] |= 1 << (y & 7); } return next; }
function conflictLibraryHash(message: string) { return message.match(/custom face group conflicts with current hash (\S+)/)?.[1] ?? null; }
function supportsConstraint(tool: ToolId) { return ['line', 'rectangle', 'circle', 'triangle'].includes(tool); }
function constraintText(tool: ToolId) { if (tool === 'line') return '约束到水平、垂直或 45°'; if (tool === 'rectangle') return '约束为正方形'; if (tool === 'circle') return '约束为正圆'; return '约束为等腰三角形'; }
function toolHint(tool: ToolId) { const hints: Record<ToolId, string> = { select: '在画布拖拽建立选区，然后在右侧执行选区操作。', brush: '点击一个像素切换高亮状态。', eraser: '调整擦除范围后拖动，松开时作为一次操作提交。', line: '按下建立起点，拖动查看线段预览，松开提交。', rectangle: '拖动查看预览框，松开提交。', circle: '拖动外接框，预览和最终椭圆共用同一范围。', triangle: '首次点击点固定为顶点，拖动调整底边。', pen: '逐点点击建立路径，双击或右侧按钮完成。' }; return hints[tool]; }
