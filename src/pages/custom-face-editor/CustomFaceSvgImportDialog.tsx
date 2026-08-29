import { useEffect, useMemo, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { readCustomFaceSvg } from '@/api/tauriApi';
import { parseSvgDocument, SvgParseError } from '@/domain/customFaces/svg/svgParser';
import { rasterizeSvg } from '@/domain/customFaces/svg/svgRasterizer';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';
import { CustomFaceViewport } from './CustomFaceViewport';

type Props = { open: boolean; width: number; height: number; onCancel: () => void; onApply: (packedPixels: number[], mode: 'merge' | 'replace') => void };

export function CustomFaceSvgImportDialog({ open: visible, width, height, onCancel, onApply }: Props) {
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [threshold, setThreshold] = useState(50);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [guides, setGuides] = useState<import('./CustomFaceRulers').CanvasGuide[]>([]);
  const [displayScale, setDisplayScale] = useState(() => Math.max(1, Math.floor(Math.min(800 / width, 360 / height))));
  const layoutRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null);
  const document = useMemo(() => { if (!source) return null; try { return parseSvgDocument(source); } catch (caught) { return { error: caught instanceof SvgParseError ? caught.message : String(caught) }; } }, [source]);
  const raster = useMemo(() => document && 'elements' in document ? rasterizeSvg(document, { width, height }, { offsetX, offsetY, scale, rotationDeg, threshold }) : null, [document, height, offsetX, offsetY, rotationDeg, scale, threshold, width]);
  useEffect(() => { if (!visible) { setSource(''); setError(null); setOffsetX(0); setOffsetY(0); setScale(1); setRotationDeg(0); setThreshold(50); setMode('merge'); setGuides([]); } }, [visible]);
  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout || !visible) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, layout.clientWidth - 220);
      const availableHeight = Math.max(1, Math.min(560, window.innerHeight - 240));
      if (layout.clientWidth <= 0 || window.innerHeight <= 0) return;
      setDisplayScale(Math.max(1, Math.min(16, Math.floor(Math.min(availableWidth / width, availableHeight / height)))));
    };
    updateScale();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(layout);
    return () => observer.disconnect();
  }, [height, visible, width]);

  const selectFile = async () => {
    setBusy(true); setError(null);
    try {
      const path = await open({ multiple: false, directory: false, filters: [{ name: 'SVG 图像', extensions: ['svg'] }] });
      if (typeof path !== 'string') return;
      setSource(await readCustomFaceSvg(path));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  const setOffset = (axis: 'x' | 'y', value: number) => {
    const limit = axis === 'x' ? width : height;
    const next = Math.max(-limit, Math.min(limit, Math.trunc(Number.isFinite(value) ? value : 0)));
    if (axis === 'x') setOffsetX(next); else setOffsetY(next);
  };
  const resetPosition = () => { setOffsetX(0); setOffsetY(0); };
  const moveToCorner = () => { setOffsetX(0); setOffsetY(0); };
  const centerPosition = () => { setOffsetX(0); setOffsetY(0); };
  const handlePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!raster) return;
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, offsetX, offsetY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragRef.current;
    if (!origin || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setOffset('x', origin.offsetX + Math.round((event.clientX - origin.clientX) / displayScale));
    setOffset('y', origin.offsetY + Math.round((event.clientY - origin.clientY) / displayScale));
  };
  const handlePreviewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const parseError = document && 'error' in document ? document.error : null;
  const effectiveError = error ?? parseError;
  return <Dialog open={visible} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}><DialogContent className="w-[min(1200px,calc(100vw-2rem))] max-w-none max-h-[calc(100vh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>导入 SVG</DialogTitle><DialogDescription>仅支持静态几何图形，导入后会按当前分辨率转换为单色像素。</DialogDescription></DialogHeader><button type="button" className="border border-border px-3 py-2" disabled={busy} onClick={() => void selectFile()}>{busy ? '读取中…' : '选择 SVG 文件'}</button>{document && 'elements' in document ? <p className="text-xs text-muted-foreground">原始尺寸 {document.width} × {document.height} · {document.elements.length} 个元素 · 目标分辨率 {width} × {height}</p> : null}<div ref={layoutRef} className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_200px]"><CustomFaceViewport width={width} height={height} scale={displayScale} guides={guides} onGuidesChange={setGuides} screenTestId="svg-import-screen" screenStyle={{ aspectRatio: width + " / " + height, maxWidth: '800px', border: '2px solid rgb(34 211 238)', cursor: raster ? 'move' : 'default' }} onScreenPointerDown={handlePreviewPointerDown} onScreenPointerMove={handlePreviewPointerMove} onScreenPointerUp={handlePreviewPointerUp} onScreenPointerCancel={handlePreviewPointerUp}>{raster ? <><CustomFacePixelPreview width={width} height={height} displayScale={displayScale} packedPixels={raster.pixels} ariaLabel={`SVG 预览 ${width} × ${height}`} /></> : <span className="text-sm text-muted-foreground">请选择 SVG 文件</span>}</CustomFaceViewport><div className="min-w-0 space-y-3 text-xs"><fieldset><legend className="mb-1">导入方式</legend><label className="mr-3"><input type="radio" name="svg-import-mode" aria-label="叠加到当前帧" checked={mode === 'merge'} onChange={() => setMode('merge')} /> 叠加</label><label><input type="radio" name="svg-import-mode" aria-label="覆盖当前帧" checked={mode === 'replace'} onChange={() => setMode('replace')} /> 覆盖</label></fieldset><div className="grid grid-cols-2 gap-2"><label className="block">X<input aria-label="水平位置 X" className="mt-1 w-full border border-border px-2 py-1" type="number" min={-width} max={width} step="1" value={offsetX} onChange={(event) => setOffset('x', Number(event.target.value))} /></label><label className="block">Y<input aria-label="垂直偏移" className="mt-1 w-full border border-border px-2 py-1" type="number" min={-height} max={height} step="1" value={offsetY} onChange={(event) => setOffset('y', Number(event.target.value))} /></label></div><div className="flex flex-wrap gap-1"><button type="button" className="border border-border px-2 py-1" onClick={centerPosition}>居中</button><button type="button" className="border border-border px-2 py-1" onClick={moveToCorner}>左上角</button><button type="button" className="border border-border px-2 py-1" onClick={resetPosition}>重置</button></div><label className="block">水平偏移：{offsetX}<input aria-label="水平偏移" className="mt-1 w-full" type="range" min={-width} max={width} value={offsetX} onChange={(event) => setOffset('x', Number(event.target.value))} /></label><label className="block">垂直偏移：{offsetY}<input aria-label="垂直偏移" className="mt-1 w-full" type="range" min={-height} max={height} value={offsetY} onChange={(event) => setOffset('y', Number(event.target.value))} /></label><label className="block">缩放：{scale.toFixed(2)}<input aria-label="缩放" className="mt-1 w-full" type="range" min="0.25" max="4" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label><label className="block">旋转：{rotationDeg}°<input aria-label="旋转" className="mt-1 w-full" type="range" min="-180" max="180" step="1" value={rotationDeg} onChange={(event) => setRotationDeg(Number(event.target.value))} /></label><label className="block">阈值：{threshold}<input aria-label="阈值" className="mt-1 w-full" type="range" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>{raster ? <p>高亮像素：{raster.activePixelCount}{raster.clipped ? ' · 已裁切屏幕外内容' : ''}</p> : null}</div></div>{effectiveError ? <p role="alert" className="text-sm text-destructive">{effectiveError}</p> : null}<DialogFooter><button type="button" className="border border-border px-3 py-2" disabled={busy} onClick={onCancel}>取消</button><button type="button" className="border border-primary bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || !raster || raster.activePixelCount === 0} onClick={() => raster && onApply([...raster.pixels], mode)}>应用到当前帧</button></DialogFooter></DialogContent></Dialog>;
}
