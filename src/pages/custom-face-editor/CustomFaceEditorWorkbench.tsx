import { useEffect, useReducer, useState } from 'react';
import { clearCustomFaceRecovery, saveCustomFaceGroup, saveCustomFaceRecovery } from '@/api/tauriApi';
import type { SaveCustomFaceGroupResult } from '@/api/tauriApi';
import type { EditorState, ToolId } from '@/domain/customFaces/editor/types';
import { editorReducer } from '@/domain/customFaces/editor/reducer';
import { CanvasToolState, CustomFaceCanvas } from './CustomFaceCanvas';
import type { CanvasGuide } from './CustomFaceRulers';
import { CustomFaceTimeline } from './CustomFaceTimeline';
import { CustomFaceToolbar } from './CustomFaceToolbar';

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
  const [guides, setGuides] = useState<CanvasGuide[]>([]);
  const [toolState, setToolState] = useState<CanvasToolState>({ pointer: null, start: null, end: null, bounds: null, penPointCount: 0 });
  const [penCommand, setPenCommand] = useState<{ id: number; type: 'finish' | 'cancel' } | null>(null);
  const [statusMessage, setStatusMessage] = useState('选择工具后在画布中操作。');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
  const frame = face?.frames[state.selectedFrameIndex];
  const onionFrame = face && state.selectedFrameIndex > 0 ? face.frames[state.selectedFrameIndex - 1] : undefined;
  const pixels = frame ? new Uint8Array(frame.packedPixels) : new Uint8Array(state.profile.framebufferBytes);

  useEffect(() => { if (!state.past.length) return; const timer = window.setTimeout(() => { void saveCustomFaceRecovery(state.presentGroup).catch((error) => console.warn('failed to autosave custom face recovery', error)); }, 600); return () => window.clearTimeout(timer); }, [state.past.length, state.presentGroup]);
  useEffect(() => { if (!state.past.length) return; const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [state.past.length]);
  useEffect(() => { setSelection(null); dispatch({ type: 'set-selection', selection: null }); }, [selectedTool]);

  const save = async () => { setSaveError(null); try { await saveCustomFaceRecovery(state.presentGroup); const result = await saveCustomFaceGroup({ group: state.presentGroup, expectedLibraryHash }); await clearCustomFaceRecovery(state.presentGroup.groupId); onSaved(result); } catch (error) { const message = error instanceof Error ? error.message : String(error); setSaveError(message); setStatusMessage(message.includes('conflict') ? '保存冲突：磁盘中的表情组已变化，请返回组管理后重新打开。' : `保存失败：${message}`); } };
  const changeSelection = (value: EditorState['selection']) => { setSelection(value); dispatch({ type: 'set-selection', selection: value }); if (value) setStatusMessage(`已框选 ${value.width} × ${value.height} 像素区域，可在右侧执行选区操作。`); };
  const requireSelection = (operation: () => void) => { if (!selection) { setStatusMessage('请先选择“框选”工具，并在画布中拖拽建立选区。'); return; } operation(); };
  const clearLocalSelection = () => { setSelection(null); dispatch({ type: 'set-selection', selection: null }); };

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button className="border border-border px-3 py-2 text-sm" onClick={() => { if (!state.past.length || window.confirm('当前组有未保存修改，确定丢弃吗？')) onBack(); }}>返回组管理</button>
        <button className="border border-primary px-3 py-2 text-sm" onClick={() => void save()}>保存</button>
        <strong>{state.presentGroup.name}</strong>
        <span className="border border-primary bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">{state.profile.width} × {state.profile.height}</span>
        <span className="ml-auto text-xs text-muted-foreground">{state.past.length ? '有未保存修改' : '已保存'}</span>
      </header>
      {saveError ? <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">保存失败：{saveError}</div> : null}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <CustomFaceToolbar collapsed={collapsed} selectedTool={selectedTool} canUndo={state.past.length > 0 && !playing} canRedo={state.future.length > 0 && !playing} onCollapsedChange={setCollapsed} onToolChange={(tool) => { setSelectedTool(tool); setStatusMessage(toolHint(tool)); }} onUndo={() => dispatch({ type: 'undo' })} onRedo={() => dispatch({ type: 'redo' })} />
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <CustomFaceCanvas width={state.profile.width} height={state.profile.height} pixels={pixels} selection={selection} guides={guides} eraserSize={eraserSize} onionPixels={onionFrame ? new Uint8Array(onionFrame.packedPixels) : undefined} selectedTool={selectedTool} constraintEnabled={constraintEnabled} rectangleFilled={rectangleFilled} disabled={playing} penCommand={penCommand} onGuidesChange={setGuides} onToolStateChange={setToolState} onSelectionChange={changeSelection} onPixelTransaction={(changes) => dispatch({ type: 'apply-pixel-transaction', pixels: changes })} />
          <div role="status" className="min-h-8 border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">{statusMessage}</div>
          <CustomFaceTimeline frames={face?.frames ?? []} selectedIndex={state.selectedFrameIndex} onSelect={(index) => { clearLocalSelection(); dispatch({ type: 'select-frame', index }); }} onMove={(from, to) => { clearLocalSelection(); dispatch({ type: 'move-frame', from, to }); }} onAdd={() => { clearLocalSelection(); dispatch({ type: 'add-frame' }); }} onDelete={(index) => { clearLocalSelection(); dispatch({ type: 'delete-frame', index }); }} onPlayingChange={setPlaying} />
        </section>
        <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-hidden border-l border-border pl-4 text-sm">
          <section className="shrink-0 border-b border-border pb-4"><h2 className="font-medium">当前表情</h2><p className="mt-3 text-muted-foreground">{face?.name ?? '暂无表情'}</p><p className="mt-2 text-xs text-muted-foreground">当前帧 {face ? state.selectedFrameIndex + 1 : 0} / {face?.frames.length ?? 0}</p><label className="mt-2 block text-xs text-muted-foreground">帧时长<input type="number" min="120" max="5000" value={frame?.durationMs ?? 200} disabled={!frame || playing} className="mt-1 w-full border border-border bg-background px-2 py-1" onChange={(event) => dispatch({ type: 'set-frame-duration', index: state.selectedFrameIndex, durationMs: Number(event.target.value) })} /></label><p className="mt-2 text-xs text-muted-foreground">默认表情：{face?.faceId === state.presentGroup.defaultFaceId ? '是' : '否'}</p><p className="mt-1 text-xs text-muted-foreground">分辨率 {state.profile.width} × {state.profile.height}</p></section>
          <section className="min-h-0 flex-1 overflow-y-auto pb-4"><h2 className="font-medium">工具属性</h2><p className="mt-3 text-muted-foreground">当前工具：{TOOL_LABELS[selectedTool]}</p>{supportsConstraint(selectedTool) ? <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={constraintEnabled} onChange={(event) => setConstraintEnabled(event.target.checked)} />{constraintText(selectedTool)}</label> : null}{selectedTool === 'rectangle' ? <div className="mt-3"><span className="text-xs text-muted-foreground">绘制方式</span><div className="mt-1 flex gap-2"><button className={!rectangleFilled ? 'border border-primary bg-primary/10 px-2 py-1 text-xs' : 'border border-border px-2 py-1 text-xs'} onClick={() => setRectangleFilled(false)}>空心</button><button className={rectangleFilled ? 'border border-primary bg-primary/10 px-2 py-1 text-xs' : 'border border-border px-2 py-1 text-xs'} onClick={() => setRectangleFilled(true)}>实心</button></div></div> : null}{selectedTool === 'eraser' ? <label className="mt-3 block text-xs text-muted-foreground">擦除范围：{eraserSize} × {eraserSize}<input className="mt-2 w-full" type="range" min="1" max="8" value={eraserSize} onChange={(event) => setEraserSize(Number(event.target.value))} /></label> : null}{toolState.start ? <p className="mt-3 text-xs text-muted-foreground">起点：{toolState.start.join(', ')}</p> : null}{toolState.end ? <p className="mt-1 text-xs text-muted-foreground">终点：{toolState.end.join(', ')}</p> : null}{toolState.bounds ? <p className="mt-1 text-xs text-muted-foreground">范围：{toolState.bounds.width} × {toolState.bounds.height}</p> : null}
            {selection ? <div className="mt-3 border-t border-border pt-3"><p className="text-xs text-muted-foreground">选区：{selection.x},{selection.y} · {selection.width} × {selection.height}</p><div className="mt-2 grid grid-cols-2 gap-2"><button className="border border-border px-2 py-1 text-xs" onClick={() => { dispatch({ type: 'copy-selection' }); setStatusMessage('已复制选区，可切换帧后粘贴。'); }}>复制</button><button className="border border-border px-2 py-1 text-xs" onClick={() => requireSelection(() => { if (!state.clipboard) { setStatusMessage('剪贴板为空，请先复制选区。'); return; } dispatch({ type: 'paste-selection' }); clearLocalSelection(); setStatusMessage('已粘贴选区。'); })}>粘贴</button><button className="border border-border px-2 py-1 text-xs" onClick={() => { dispatch({ type: 'clear-selection' }); clearLocalSelection(); setStatusMessage('已清空选区。'); }}>清空</button><button className="border border-border px-2 py-1 text-xs" onClick={() => { dispatch({ type: 'set-selection-active', active: true }); clearLocalSelection(); }}>高亮</button><button className="border border-border px-2 py-1 text-xs" onClick={() => { dispatch({ type: 'set-selection-active', active: false }); clearLocalSelection(); }}>熄灭</button><button className="border border-border px-2 py-1 text-xs" onClick={clearLocalSelection}>取消</button></div></div> : selectedTool === 'select' ? <p className="mt-3 text-xs text-muted-foreground">请在画布中拖拽建立选区。</p> : null}
            {selectedTool === 'pen' ? <div className="mt-3"><p className="text-xs text-muted-foreground">顶点：{toolState.penPointCount}</p><div className="mt-2 flex gap-2"><button className="border border-primary px-2 py-1 text-xs" onClick={() => setPenCommand({ id: Date.now(), type: 'finish' })}>完成路径</button><button className="border border-border px-2 py-1 text-xs" onClick={() => setPenCommand({ id: Date.now(), type: 'cancel' })}>取消路径</button></div></div> : null}
            <p className="mt-4 text-xs text-muted-foreground">{toolHint(selectedTool)}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function supportsConstraint(tool: ToolId) { return ['line', 'rectangle', 'circle', 'triangle'].includes(tool); }
function constraintText(tool: ToolId) { if (tool === 'line') return '约束到水平、垂直或 45°'; if (tool === 'rectangle') return '约束为正方形'; if (tool === 'circle') return '约束为正圆'; return '约束为等腰三角形'; }
function toolHint(tool: ToolId) { const hints: Record<ToolId, string> = { select: '在画布拖拽建立选区，然后在右侧执行选区操作。', brush: '点击一个像素切换高亮状态。', eraser: '调整擦除范围后在画布拖动，松开时作为一次操作提交。', line: '按下建立起点，拖动查看线段预览，松开提交。', rectangle: '按下建立起点，拖动查看预览框，松开提交。', circle: '拖动外接框；预览轮廓与最终椭圆使用同一范围。', triangle: '首次点击点固定为顶点，拖动调整底边。', pen: '逐点点击建立路径；双击或右侧按钮完成。' }; return hints[tool]; }
