import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
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
  type SvgRecognitionMode,
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
  const [recognitionMode, setRecognitionMode] = useState<SvgRecognitionMode>('alpha');
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
      recognitionMode,
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
  }, [document, height, invert, offsetX, offsetY, recognitionMode, rotationDeg, scale, threshold, width]);

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
      setRecognitionMode('alpha');
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
        filters: [{ name: t('customFaceEditor.svgImport.filterName'), extensions: ['svg'] }],
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
          <DialogTitle>{t('customFaceEditor.svgImport.title')}</DialogTitle>
          <DialogDescription>
            {t('customFaceEditor.svgImport.description')}
          </DialogDescription>
        </DialogHeader>
        <button type="button" className="border border-border px-3 py-2" disabled={busy} onClick={() => void selectFile()}>
          {busy ? t('customFaceEditor.svgImport.read') : t('customFaceEditor.svgImport.selectFile')}
        </button>
        {document && !('error' in document) ? (
          <p className="text-xs text-muted-foreground">
            {t('customFaceEditor.svgImport.metadata', { width: document.width, height: document.height, elements: document.elementCount, targetWidth: width, targetHeight: height })}
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
                  ariaLabel={t('customFaceEditor.svgImport.preview', { width, height })}
                />
              ) : (
                <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t('customFaceEditor.svgImport.noFile')}
                </span>
              )}
              {rendering && raster ? (
                <span className="pointer-events-none absolute right-2 top-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                  {t('customFaceEditor.svgImport.updating')}
                </span>
              ) : null}
            </CustomFaceViewport>
          </div>
          <div className="min-w-0 space-y-3 text-xs">
            <fieldset>
              <legend className="mb-1">{t('customFaceEditor.svgImport.mode')}</legend>
              <label className="mr-3"><input type="radio" name="svg-import-mode" aria-label={t('customFaceEditor.svgImport.mergeLabel')} checked={mode === 'merge'} onChange={() => setMode('merge')} /> {t('customFaceEditor.svgImport.merge')}</label>
              <label><input type="radio" name="svg-import-mode" aria-label={t('customFaceEditor.svgImport.replaceLabel')} checked={mode === 'replace'} onChange={() => setMode('replace')} /> {t('customFaceEditor.svgImport.replace')}</label>
            </fieldset>
            <fieldset>
              <legend className="mb-1">{t('customFaceEditor.svgImport.recognitionMode')}</legend>
              <label className="mr-3"><input type="radio" name="svg-recognition-mode" aria-label={t('customFaceEditor.svgImport.alphaRecognitionLabel')} checked={recognitionMode === 'alpha'} onChange={() => setRecognitionMode('alpha')} /> {t('customFaceEditor.svgImport.alphaRecognition')}</label>
              <label><input type="radio" name="svg-recognition-mode" aria-label={t('customFaceEditor.svgImport.brightnessRecognitionLabel')} checked={recognitionMode === 'brightness'} onChange={() => setRecognitionMode('brightness')} /> {t('customFaceEditor.svgImport.brightnessRecognition')}</label>
              <p className="mt-1 text-muted-foreground">{t(`customFaceEditor.svgImport.${recognitionMode}RecognitionHint`)}</p>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">X<input aria-label={t('customFaceEditor.svgImport.x')} className="mt-1 w-full border border-border px-2 py-1" type="number" min={-width} max={width} step="1" value={offsetX} onChange={(event) => setOffset('x', Number(event.target.value))} /></label>
              <label className="block">Y<input aria-label={t('customFaceEditor.svgImport.y')} className="mt-1 w-full border border-border px-2 py-1" type="number" min={-height} max={height} step="1" value={offsetY} onChange={(event) => setOffset('y', Number(event.target.value))} /></label>
            </div>
            <div className="flex flex-wrap gap-1">
              <button type="button" className="border border-border px-2 py-1" onClick={() => { setOffsetX(0); setOffsetY(0); }}>{t('customFaceEditor.svgImport.center')}</button>
              <button type="button" className="border border-border px-2 py-1" onClick={() => { setOffsetX(0); setOffsetY(0); }}>{t('customFaceEditor.svgImport.topLeft')}</button>
              <button type="button" className="border border-border px-2 py-1" onClick={() => { setOffsetX(0); setOffsetY(0); }}>{t('customFaceEditor.svgImport.reset')}</button>
            </div>
            <RangeStepper
              label={t('customFaceEditor.svgImport.offsetX', { value: offsetX })}
              ariaLabel={t('customFaceEditor.svgImport.offsetXLabel')}
              decreaseLabel={t('customFaceEditor.svgImport.decrease', { field: t('customFaceEditor.svgImport.offsetXLabel') })}
              increaseLabel={t('customFaceEditor.svgImport.increase', { field: t('customFaceEditor.svgImport.offsetXLabel') })}
              min={-width}
              max={width}
              step={1}
              value={offsetX}
              onChange={(value) => setOffset('x', value)}
              onStep={(delta) => setOffsetX((current) => clampOffset(current + delta, width))}
            />
            <RangeStepper
              label={t('customFaceEditor.svgImport.offsetY', { value: offsetY })}
              ariaLabel={t('customFaceEditor.svgImport.offsetYLabel')}
              decreaseLabel={t('customFaceEditor.svgImport.decrease', { field: t('customFaceEditor.svgImport.offsetYLabel') })}
              increaseLabel={t('customFaceEditor.svgImport.increase', { field: t('customFaceEditor.svgImport.offsetYLabel') })}
              min={-height}
              max={height}
              step={1}
              value={offsetY}
              onChange={(value) => setOffset('y', value)}
              onStep={(delta) => setOffsetY((current) => clampOffset(current + delta, height))}
            />
            <RangeStepper
              label={t('customFaceEditor.svgImport.scale', { value: scale.toFixed(2) })}
              ariaLabel={t('customFaceEditor.svgImport.scaleLabel')}
              decreaseLabel={t('customFaceEditor.svgImport.decrease', { field: t('customFaceEditor.svgImport.scaleLabel') })}
              increaseLabel={t('customFaceEditor.svgImport.increase', { field: t('customFaceEditor.svgImport.scaleLabel') })}
              min={0.25}
              max={4}
              step={0.05}
              value={scale}
              onChange={(next) => setScale(normalizeRangeValue(next, 0.25, 4, 0.05))}
              onStep={(delta) => setScale((current) => normalizeRangeValue(current + delta, 0.25, 4, 0.05))}
              formatValue={(value) => value.toFixed(2)}
            />
            <RangeStepper
              label={t('customFaceEditor.svgImport.rotation', { value: rotationDeg })}
              ariaLabel={t('customFaceEditor.svgImport.rotationLabel')}
              decreaseLabel={t('customFaceEditor.svgImport.decrease', { field: t('customFaceEditor.svgImport.rotationLabel') })}
              increaseLabel={t('customFaceEditor.svgImport.increase', { field: t('customFaceEditor.svgImport.rotationLabel') })}
              min={-180}
              max={180}
              step={1}
              value={rotationDeg}
              onChange={(value) => setRotationDeg(value)}
              onStep={(delta) => setRotationDeg((current) => normalizeRangeValue(current + delta, -180, 180, 1))}
            />
            <RangeStepper
              label={t('customFaceEditor.svgImport.threshold', { value: threshold })}
              ariaLabel={t('customFaceEditor.svgImport.thresholdLabel')}
              decreaseLabel={t('customFaceEditor.svgImport.decrease', { field: t('customFaceEditor.svgImport.thresholdLabel') })}
              increaseLabel={t('customFaceEditor.svgImport.increase', { field: t('customFaceEditor.svgImport.thresholdLabel') })}
              min={0}
              max={100}
              step={1}
              value={threshold}
              onChange={(value) => setThreshold(value)}
              onStep={(delta) => setThreshold((current) => normalizeRangeValue(current + delta, 0, 100, 1))}
            />
            <p className="text-muted-foreground">{t('customFaceEditor.svgImport.thresholdHint')}</p>
            <label className="flex items-start gap-2"><input aria-label={t('customFaceEditor.faceImport.invertImage')} type="checkbox" checked={invert} onChange={(event) => setInvert(event.target.checked)} /><span><span className="block">{t('customFaceEditor.faceImport.invertImage')}</span><span className="text-muted-foreground">{t('customFaceEditor.faceImport.invertImageHint')}</span></span></label>
            {raster ? <p>{t('customFaceEditor.svgImport.activePixels', { count: raster.activePixelCount })}{raster.clipped ? ` · ${t('customFaceEditor.svgImport.clipped')}` : ''}</p> : null}
          </div>
        </div>
        {effectiveError ? <p role="alert" className="text-sm text-destructive">{effectiveError}</p> : null}
        <DialogFooter>
          <button type="button" className="border border-border px-3 py-2" disabled={busy} onClick={onCancel}>{t('customFaceEditor.svgImport.cancel')}</button>
          <button type="button" className="border border-primary bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || rendering || !raster || raster.activePixelCount === 0} onClick={() => raster && onApply([...raster.pixels], mode)}>{t('customFaceEditor.svgImport.apply')}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RangeStepperProps = {
  label: string;
  ariaLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  onStep: (delta: number) => void;
  formatValue?: (value: number) => string;
};

function RangeStepper({
  label,
  ariaLabel,
  decreaseLabel,
  increaseLabel,
  min,
  max,
  step,
  value,
  onChange,
  onStep,
  formatValue,
}: RangeStepperProps) {
  const displayValue = formatValue ? formatValue(value) : String(value);
  return (
    <div>
      <label className="block">{label}</label>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-border"
          aria-label={decreaseLabel}
          title={decreaseLabel}
          disabled={value <= min}
          onClick={() => onStep(-step)}
        >
          <Minus aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <input
          aria-label={ariaLabel}
          className="min-w-0 w-full"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-border"
          aria-label={increaseLabel}
          title={increaseLabel}
          disabled={value >= max}
          onClick={() => onStep(step)}
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="sr-only">{displayValue}</span>
    </div>
  );
}

function normalizeRangeValue(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  const steps = Math.round((clamped - min) / step);
  return Number((min + steps * step).toFixed(2));
}

function displayScaleFor(width: number, height: number, availableWidth: number, availableHeight: number) {
  return Math.max(1, Math.min(16, Math.floor(Math.min(availableWidth / width, availableHeight / height))));
}

function clampOffset(value: number, limit: number) {
  return Math.max(-limit, Math.min(limit, Math.trunc(value) || 0));
}
