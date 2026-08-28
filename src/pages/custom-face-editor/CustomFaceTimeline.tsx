import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Plus, Trash2 } from 'lucide-react';
import type { CustomFaceFrame } from '@/api/tauriApi';
import { frameAtElapsed, totalDuration } from '@/domain/customFaces/editor/playback';

type Props = { frames: CustomFaceFrame[]; selectedIndex: number; onSelect: (index: number) => void; onAdd: () => void; onDelete: (index: number) => void; onMove?: (from: number, to: number) => void; onPlayingChange?: (playing: boolean) => void };

export function CustomFaceTimeline({ frames, selectedIndex, onSelect, onAdd, onDelete, onMove, onPlayingChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const elapsedRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const setPlayback = (value: boolean) => { setPlaying(value); onPlayingChange?.(value); };

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    let frameId = 0;
    const tick = (time: number) => {
      const last = lastRef.current ?? time;
      elapsedRef.current += Math.max(0, time - last);
      lastRef.current = time;
      const duration = totalDuration(frames);
      if (elapsedRef.current >= duration) {
        if (loop) elapsedRef.current %= duration;
        else { elapsedRef.current = duration; onSelect(frames.length - 1); setPlayback(false); return; }
      }
      const frameIndex = frameAtElapsed(frames, elapsedRef.current, loop);
      if (frameIndex >= 0 && frameIndex !== selectedIndex) onSelect(frameIndex);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frameId); lastRef.current = null; };
  }, [frames, loop, playing, selectedIndex]);

  return <section className="border-t border-border pt-3" aria-label="表情时间轴"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><button type="button" className="flex items-center gap-1 border border-border px-2 py-1" onClick={() => setPlayback(!playing)}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{playing ? '暂停' : '预览'}</button><button type="button" className="border border-border px-2 py-1" onClick={() => setLoop(!loop)}>循环：{loop ? '开' : '关'}</button><span>总帧数 {frames.length}</span><span>总时长 {totalDuration(frames)} ms</span><span>当前帧 {frames.length ? selectedIndex + 1 : 0} / {frames.length}</span></div><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{frames.map((frame, index) => <div key={index} draggable={!playing} className={`relative h-24 min-w-24 border bg-black p-1 ${index === selectedIndex ? 'border-2 border-primary' : 'border-border'}`} onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onMove?.(from, index); }}><button type="button" disabled={playing} className="h-full w-full text-left" onClick={() => onSelect(index)}><div className="h-16" /><div className="flex justify-between text-[10px] text-muted-foreground"><span>帧 {index + 1}</span><span>{frame.durationMs} ms</span></div></button><button type="button" aria-label={`删除帧 ${index + 1}`} title={frames.length <= 1 ? '至少保留一帧' : '删除帧'} disabled={playing || frames.length <= 1} className="absolute right-1 top-1 border border-border bg-background/90 p-1 text-muted-foreground disabled:opacity-30" onClick={() => onDelete(index)}><Trash2 className="h-3 w-3" /></button></div>)}<button type="button" disabled={playing} className="flex h-24 min-w-24 flex-col items-center justify-center border border-dashed border-border text-xs" onClick={onAdd}><Plus className="h-4 w-4" />新增帧</button></div></section>;
}
