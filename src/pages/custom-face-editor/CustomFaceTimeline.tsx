import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Plus, Trash2 } from 'lucide-react';
import type { CustomFaceFrame } from '@/api/tauriApi';
import { frameAtElapsed, totalDuration } from '@/domain/customFaces/editor/playback';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';

type Props = { frames: CustomFaceFrame[]; width?: number; height?: number; selectedIndex: number; onSelect: (index: number) => void; onAdd: () => void; onDelete: (index: number) => void; onMove?: (from: number, to: number) => void; onPlayingChange?: (playing: boolean) => void };

export function CustomFaceTimeline({ frames, width = 128, height = 32, selectedIndex, onSelect, onAdd, onDelete, onMove, onPlayingChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [checkedFrames, setCheckedFrames] = useState<number[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const elapsedRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const pointerDragRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const setPlayback = (value: boolean) => { if (value) { elapsedRef.current = 0; lastRef.current = null; } setPlaying(value); onPlayingChange?.(value); };
  const startPointerSort = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (playing || (event.target as HTMLElement).closest('input, button[aria-label^="删除"]')) return;
    pointerDragRef.current = index;
    setDraggingIndex(index);
    setDragOverIndex(index);
  };
  const updatePointerSort = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerDragRef.current === null) return;
    const cards = [...(timelineRef.current?.querySelectorAll<HTMLElement>('[data-frame-index]') ?? [])];
    const target = cards.findIndex((card) => event.clientX < card.getBoundingClientRect().left + card.getBoundingClientRect().width / 2);
    setDragOverIndex(target >= 0 ? target : cards.length);
  };
  const finishPointerSort = (event: React.PointerEvent<HTMLDivElement>) => {
    const from = pointerDragRef.current;
    const to = dragOverIndex;
    pointerDragRef.current = null;
    setDraggingIndex(null);
    setDragOverIndex(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (from !== null && to !== null && from !== to && to !== from + 1) onMove?.(from, to > from ? to - 1 : to);
  };

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    let frameId = 0;
    const tick = (time: number) => {
      const last = lastRef.current ?? time;
      elapsedRef.current += Math.max(0, time - last);
      lastRef.current = time;
      const previewFrames = checkedFrames.length ? checkedFrames.map((index) => frames[index]).filter(Boolean) : frames;
      const duration = totalDuration(previewFrames);
      if (elapsedRef.current >= duration) {
        if (loop) elapsedRef.current %= duration;
        else { elapsedRef.current = duration; onSelect(frames.length - 1); setPlayback(false); return; }
      }
      const previewIndex = frameAtElapsed(previewFrames, elapsedRef.current, loop);
      const frameIndex = checkedFrames.length ? checkedFrames[previewIndex] : previewIndex;
      if (frameIndex >= 0 && frameIndex !== selectedIndex) onSelect(frameIndex);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameId); lastRef.current = null; };
  }, [checkedFrames, frames, loop, playing, selectedIndex]);

  return <section className="border-t border-border pt-3" aria-label="表情时间轴"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><button type="button" className="flex items-center gap-1 border border-border px-2 py-1" onClick={() => setPlayback(!playing)}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{playing ? '暂停' : checkedFrames.length ? '预览选中' : '预览全部'}</button><span>总帧数 {frames.length}</span><span>总时长 {totalDuration(frames)} ms</span><span>已选 {checkedFrames.length} 帧</span><span>当前帧 {frames.length ? selectedIndex + 1 : 0} / {frames.length}</span></div><div ref={timelineRef} className="mt-2 flex gap-2 overflow-x-auto pb-1" onPointerMove={updatePointerSort} onPointerUp={finishPointerSort} onPointerCancel={finishPointerSort}>{frames.map((frame, index) => <div key={index} data-testid={"frame-card-" + (index + 1)} data-frame-index={index} onPointerDown={(event) => startPointerSort(event, index)} onPointerMove={updatePointerSort} onPointerUp={finishPointerSort} onPointerCancel={finishPointerSort} draggable={false} style={draggingIndex === index ? { transform: "scale(1.05)", opacity: 0.8, zIndex: 30, boxShadow: "0 8px 20px rgba(0,0,0,.25)" } : undefined} className={`relative h-24 min-w-24 border bg-black p-1 ${index === selectedIndex ? 'border-2 border-primary' : 'border-border'}`} onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragEnter={() => setDragOverIndex(index)} onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index); }} onDragLeave={() => setDragOverIndex(null)} onDrop={(event) => { const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onMove?.(from, index); }}>{dragOverIndex === index ? <span aria-label="插入位置" className="absolute -left-1.5 top-0 z-20 h-full w-1 bg-primary shadow-[0_0_0_1px_rgba(255,255,255,.7)]" /> : null}<label className="absolute left-1 top-1 z-10 bg-background/90 p-0.5"><input aria-label={`勾选第 ${index + 1} 帧`} type="checkbox" checked={checkedFrames.includes(index)} disabled={playing} onChange={() => setCheckedFrames((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b))} /></label><button type="button" disabled={playing} className="h-full w-full text-left" onClick={() => onSelect(index)}><div className="h-16"><CustomFacePixelPreview width={width} height={height} packedPixels={frame.packedPixels} ariaLabel={`第 ${index + 1} 帧预览`} className="h-full w-full" /></div><div className="flex justify-between text-[10px] text-muted-foreground"><span>帧 {index + 1}</span><span>{frame.durationMs} ms</span></div></button><button type="button" aria-label={`删除帧 ${index + 1}`} title={frames.length <= 1 ? '至少保留一帧' : '删除帧'} disabled={playing || frames.length <= 1} className="absolute right-1 top-1 border border-border bg-background/90 p-1 text-muted-foreground disabled:opacity-30" onClick={() => onDelete(index)}><Trash2 className="h-3 w-3" /></button></div>)}{dragOverIndex === frames.length ? <span aria-label="插入位置" className="absolute right-0 top-0 z-20 h-full w-1 bg-primary" /> : null}<button type="button" disabled={playing} className="flex h-24 min-w-24 flex-col items-center justify-center border border-dashed border-border text-xs" onClick={onAdd} title="复制当前帧并追加到末尾"><Plus className="h-4 w-4" />新增帧</button></div></section>;
}
