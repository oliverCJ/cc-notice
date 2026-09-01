import { useEffect, useMemo, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { readCustomFaceSvg } from '@/api/tauriApi';
import { parseSvgDocument, SvgParseError } from '@/domain/customFaces/svg/svgParser';
import {
  rasterizeSvg,
  type SvgRasterResult,
} from '@/domain/customFaces/svg/svgRasterizer';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';
import { CustomFaceViewport } from './CustomFaceViewport';
import { useI18n } from '@/i18n';

type Props = {
  open: boolean;
  width: number;
  height: number;
  onCancel: () => void;
  onApply: (packedPixels: number[], mode: 'merge' | 'replace') => void;
};

type ParsedDocument = ReturnType<typeof parseSvgDocument>;

export function CustomFaceSvgImportDialog({
  open: visible,
  width,
  height,
  onCancel,
  onApply,
}: Props) {
  const t = useI18n();
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [raster, setRaster] = useState<SvgRasterResult | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [threshold, setThreshold] = useState(50);
  const [invert, setInvert] = useState(false);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [guides, setGuides] = useState<
    import('./CustomFaceRulers').CanvasGuide[]
  >([]);
  const [displayScale, setDisplayScale] = useState(() =>
    displayScaleFor(width, height, 720, 540),
  );
  const layoutRef = useRef<HTMLDivElement>(null);
  const renderVersionRef = useRef(0);
  const dragRef = useRef<{
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const pendingDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const document = useMemo(() => {
    if (!source) return null;
    try {
      return parseSvgDocument(source);
    } catch (caught) {
      return {
        error: caught instanceof SvgParseError ? caught.message : String(caught),
      };
    }
  }, [source]);

  useEffect(() => {
    const version = renderVersionRef.current + 1;
    renderVersionRef.current = version;
    if (!document || 'error' in document) {
      setRaster(null);
      setRendering(false);
      return;
    }
    setRendering(true);
    void rasterizeSvg(document, { width, height }, {
      offsetX,
      offsetY,
      scale,
      rotationDeg,
      threshold,
      invert,
    })
      .then((result) => {
        if (renderVersionRef.current === version) setRaster(result);
      })
      .catch((caught) => {
        if (renderVersionRef.current === version) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (renderVersionRef.current === version) setRendering(false);
      });
    return () => {
      if (renderVersionRef.current === version) renderVersionRef.current += 1;
    };
  }, [document, height, invert, offsetX, offsetY, rotationDeg, scale, threshold, width]);

  useEffect(() => {
    if (!visible) {
      setSource('');
      setError(null);
      setRaster(null);
      setOffsetX(0);
      setOffsetY(0);
      setScale(1);
      setRotationDeg(0);
      setThreshold(50);
      setInvert(false);
      setMode('merge');
      setGuides([]);
    }
  }, [visible]);

  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout || !visible) return;
    const updateScale = () => {
      if (layout.clientWidth <= 0 || window.innerHeight <= 0) return;
      setDisplayScale(
        displayScaleFor(
          width,
          height,
          Math.min(720, Math.max(1, layout.clientWidth - 196)),
          Math.min(540, Math.max(1, window.innerHeight - 180)),
        ),
      );
    };
    updateScale();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(layout);
    return () => observer.disconnect();
  }, [height, visible, width]);

  const selectFile = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'SVG 图像', extensions: ['svg'] }],
      });
      if (typeof path !== 'string') return;
      setSource(await readCustomFaceSvg(path));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const setOffset = (axis: 'x' | 'y', value: number) => {
    const limit = axis === 'x' ? width : height;
    const next = clampOffset(value, limit);
    if (axis === 'x') setOffsetX(next);
    else setOffsetY(next);
  };
  const handlePreviewPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!raster) return;
    dragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX,
      offsetY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const flushPendingDragOffset = () => {
    const pending = pendingDragOffsetRef.current;
    pendingDragOffsetRef.current = null;
    dragFrameRef.current = null;
    if (!pending) return;
    setOffsetX(pending.x);
    setOffsetY(pending.y);
  };
  const handlePreviewPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const origin = dragRef.current;
    if (!origin || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    pendingDragOffsetRef.current = {
      x: clampOffset(
        origin.offsetX + Math.round((event.clientX - origin.clientX) / displayScale),
        width,
      ),
      y: clampOffset(
        origin.offsetY + Math.round((event.clientY - origin.clientY) / displayScale),
        height,
      ),
    };
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(flushPendingDragOffset);
    }
  };
  const handlePreviewPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    dragRef.current = null;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      flushPendingDragOffset();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  useEffect(() => () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
    }
  }, []);
  const parseError = document && 'error' in document ? document.error : null;
  const effectiveError = error ?? parseError;

  return (
    <Dialog open={visible} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}>
      <DialogContent className="w-[min(1320px,calc(100vw-2rem))] max-w-none max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入 SVG</DialogTitle>
          <DialogDescription>
            使用 SVG 原生静态渲染转换为单色像素。推荐透明背景和任意不透明前景；不透明底色也会被点亮。
          </DialogDescription>
        </DialogHeader>
        <button type="button" className="border border-border px-3 py-2" disabled={busy} onClick={() => void selectFile()}>
          {busy ? '读取中…' : '选择 SVG 文件'}
        </button>
        {document && !('error' in document) ? (
          <p className="text-xs text-muted-foreground">
            原始尺寸 {document.width} × {document.height} · {document.elementCount} 个元素 · 目标分辨率 {width} × {height}
          </p>
        ) : null}
        <div ref={layoutRef} className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="min-w-0 overflow-auto pb-2">
            <CustomFaceViewport
              width={width}
              height={height}
              scale={displayScale}
              guides={guides}
              onGuidesChange={setGuides}
              screenTestId="svg-import-screen"
              screenStyle={{
                aspectRatio: `${width} / ${height}`,
                border: '2px solid rgb(34 211 238)',
                cursor: raster ? 'move' : 'default',
              }}
              onScreenPointerDown={handlePreviewPointerDown}
              onScreenPointerMove={handlePreviewPointerMove}
              onScreenPointerUp={handlePreviewPointerUp}
              onScreenPointerCancel={handlePreviewPointerUp}
            >
              {raster ? (
                <CustomFacePixelPreview
                  width={width}
                  height={height}
                  displayScale={displayScale}
                  packedPixels={raster.pixels}
                  ariaLabel={`SVG 预览 ${width} × ${height}`}
                />
              ) : (
                <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  请选择 SVG 文件
                </span>
              )}
              {rendering && raster ? (
                <span className="pointer-events-none absolute right-2 top-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                  正在更新预览…
                </span>
              ) : null}
            </CustomFaceViewport>
          </div>
          <div className="min-w-0 space-y-3 text-xs">
            <fieldset>
              <legend className="mb-1">导入方式</legend>
              <label className="mr-3"><input type="radio" name="svg-import-mode" aria-label="叠加到当前帧" checked={mode === 'merge'} onChange={() => setMode('merge')} /> 叠加</label>
              <label><input type="radio" name="svg-import-mode" aria-label="覆盖当前帧" checked={mode === 'replace'} onChange={() => setMode('replace')} /> 覆盖</label>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">X<input aria-label="水平位置 X" className="mt-1 w-full border border-border px-2 py-1" type="number" min={-width} max={width} step="1" value={offsetX} onChange={(event) => setOffset('x', Number(event.target.value))} /></label>
              <label className="block">Y<input aria-label="垂直偏移" className="mt-1 w-full border border-border px-2 py-1" type="number" min={-height} max={height} step="1" value={offsetY} onChange={(event) => setOffset('y', Number(event.target.value))} /></label>
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" className="border border-border px-2 py-1" onClick={() => { setOffsetX(0); setOffsetY(0); }}>居中</button>
              <button type="button" className="border border-border px-2 py-1" onClick={() => { setOffsetX(0); setOffsetY(0); }}>左上角</button>
              <button type="button" className="border border-border px-2 py-1" onClick={() => { setOffsetX(0); setOffsetY(0); }}>重置</button>
            </div>
            <label className="block">水平偏移：{offsetX}<input aria-label="水平偏移" className="mt-1 w-full" type="range" min={-width} max={width} value={offsetX} onChange={(event) => setOffset('x', Number(event.target.value))} /></label>
            <label className="block">垂直偏移：{offsetY}<input aria-label="垂直偏移" className="mt-1 w-full" type="range" min={-height} max={height} value={offsetY} onChange={(event) => setOffset('y', Number(event.target.value))} /></label>
            <label className="block">缩放：{scale.toFixed(2)}<input aria-label="缩放" className="mt-1 w-full" type="range" min="0.25" max="4" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
            <label className="block">旋转：{rotationDeg}°<input aria-label="旋转" className="mt-1 w-full" type="range" min="-180" max="180" step="1" value={rotationDeg} onChange={(event) => setRotationDeg(Number(event.target.value))} /></label>
            <label className="block">像素覆盖阈值：{threshold}<input aria-label="像素覆盖阈值" className="mt-1 w-full" type="range" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
            <p className="text-muted-foreground">低值保留更多细线，高值会收紧边缘。</p>
            <label className="flex items-start gap-2"><input aria-label={t('customFaceEditor.faceImport.invertImage')} type="checkbox" checked={invert} onChange={(event) => setInvert(event.target.checked)} /><span><span className="block">{t('customFaceEditor.faceImport.invertImage')}</span><span className="text-muted-foreground">{t('customFaceEditor.faceImport.invertImageHint')}</span></span></label>
            {raster ? <p>高亮像素：{raster.activePixelCount}{raster.clipped ? ' · 已裁切屏幕外内容' : ''}</p> : null}
          </div>
        </div>
        {effectiveError ? <p role="alert" className="text-sm text-destructive">{effectiveError}</p> : null}
        <DialogFooter>
          <button type="button" className="border border-border px-3 py-2" disabled={busy} onClick={onCancel}>取消</button>
          <button type="button" className="border border-primary bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || rendering || !raster || raster.activePixelCount === 0} onClick={() => raster && onApply([...raster.pixels], mode)}>应用到当前帧</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function displayScaleFor(width: number, height: number, availableWidth: number, availableHeight: number) {
  return Math.max(1, Math.min(16, Math.floor(Math.min(availableWidth / width, availableHeight / height))));
}

function clampOffset(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, Math.trunc(value) || 0));
}
