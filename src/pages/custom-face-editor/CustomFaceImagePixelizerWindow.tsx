import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Info, RotateCcw } from 'lucide-react';
import {
  applyCustomFaceImageImport,
  closeCustomFaceImagePixelizer,
  pixelizeCustomFaceImageSource,
  prepareCustomFaceImagePixelizerSource,
  releaseCustomFaceImagePixelizerSource,
} from '@/api/tauriApi';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';
import { defaultPixelizerOptions, normalizePixelizerOptions, type ImagePixelizerOptions } from './imagePixelizerOptions';
import { CustomFaceViewport, type CanvasGuide } from './CustomFaceViewport';
import { useI18n } from '@/i18n';

type PixelizeResult = {
  packedPixels: number[];
  previewPixels: number[];
  sourceWidth: number;
  sourceHeight: number;
};

type CanvasSize = {
  width: number;
  height: number;
};

const CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT = 'cc-notice://custom-face-image-pixelizer-open-request';
const SOURCE_PREVIEW_THUMB_SIZE = 96;
const SOURCE_PREVIEW_HOVER_SIZE = 192;
const PIXELIZE_OPTIONS_DEBOUNCE_MS = 180;

export function CustomFaceImagePixelizerWindow() {
  const t = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const requestVersionRef = useRef(0);
  const sourceUrlRef = useRef<string | null>(null);
  const sourceIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const latestOptionsRef = useRef<ImagePixelizerOptions>(defaultPixelizerOptions());
  const objectDragRef = useRef<{ clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null);
  const sourcePreviewDragRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(() => canvasSizeFromLocation());
  const [displayScale, setDisplayScale] = useState(() =>
    displayScaleFor(canvasSize.width, canvasSize.height, 720, 540)
  );
  const [options, setOptions] = useState<ImagePixelizerOptions>(() => defaultPixelizerOptions());
  const [pixelizeOptions, setPixelizeOptions] = useState<ImagePixelizerOptions>(() => defaultPixelizerOptions());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourcePreviewHovered, setSourcePreviewHovered] = useState(false);
  const [sourcePreviewPosition, setSourcePreviewPosition] = useState({ x: 8, y: 8 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PixelizeResult | null>(null);

  const normalizedOptions = useMemo(() => normalizePixelizerOptions(options), [options]);
  const normalizedPixelizeOptions = useMemo(() => normalizePixelizerOptions(pixelizeOptions), [pixelizeOptions]);
  const defaultOptions = useMemo(() => defaultPixelizerOptions(), []);
  const guides: CanvasGuide[] = [];

  useEffect(() => {
    latestOptionsRef.current = normalizedOptions;
  }, [normalizedOptions]);

  const releaseCurrentSource = useCallback(async () => {
    const currentSourceId = sourceIdRef.current;
    if (!currentSourceId) return;
    sourceIdRef.current = null;
    if (mountedRef.current) setSourceId(null);
    try {
      await releaseCustomFaceImagePixelizerSource(currentSourceId);
    } catch (caught) {
      console.warn('failed to release custom face image pixelizer source', caught);
    }
  }, []);

  const resetWorkspace = useCallback(() => {
    requestVersionRef.current += 1;
    setError(null);
    setResult(null);
    setSelectedName(null);
    sourceIdRef.current = null;
    setSourceId(null);
    setSourcePreviewHovered(false);
    setSourcePreviewPosition({ x: 8, y: 8 });
    setSourceUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      sourceUrlRef.current = null;
      return null;
    });
  }, []);

  const updateCanvasSize = useCallback((nextCanvasSize: CanvasSize) => {
    setCanvasSize((current) =>
      current.width === nextCanvasSize.width && current.height === nextCanvasSize.height
        ? current
        : nextCanvasSize
    );
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('width', String(nextCanvasSize.width));
    nextUrl.searchParams.set('height', String(nextCanvasSize.height));
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
    void releaseCurrentSource();
    resetWorkspace();
  }, [releaseCurrentSource, resetWorkspace]);

  const loadImageFile = useCallback(async (file: File) => {
    const version = requestVersionRef.current + 1;
    requestVersionRef.current = version;
    try {
      await releaseCurrentSource();
      setError(null);
      setResult(null);
      setSelectedName(file.name || t('customFaceEditor.imagePixelizer.pastedImage'));
      setSourceId(null);
      setBusy(true);
      const nextUrl = createImagePreviewUrl(file);
      if (nextUrl) {
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
        sourceUrlRef.current = nextUrl;
        setSourceUrl(nextUrl);
      }
      const buffer = await readBlobAsArrayBuffer(file);
      const imageBytes = Array.from(new Uint8Array(buffer));
      const preparedSource = await prepareCustomFaceImagePixelizerSource({
        profileWidth: canvasSize.width,
        profileHeight: canvasSize.height,
        imageBytes
      });
      if (!mountedRef.current || requestVersionRef.current !== version) {
        await releaseCustomFaceImagePixelizerSource(preparedSource.sourceId);
        return;
      }
      sourceIdRef.current = preparedSource.sourceId;
      setSourceId(preparedSource.sourceId);
    } catch (caught) {
      if (mountedRef.current && requestVersionRef.current === version) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setResult(null);
        setSourceId(null);
        sourceIdRef.current = null;
      }
    } finally {
      if (mountedRef.current && requestVersionRef.current === version) setBusy(false);
    }
  }, [canvasSize.height, canvasSize.width, releaseCurrentSource, t]);

  useEffect(() => {
    // React StrictMode 会在开发环境模拟重新挂载，必须在 effect body 恢复挂载状态。
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      void releaseCurrentSource();
      if (sourceUrlRef.current) {
        URL.revokeObjectURL(sourceUrlRef.current);
        sourceUrlRef.current = null;
      }
    };
  }, [releaseCurrentSource]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWindow().onCloseRequested((event) => {
      if (closingRef.current) return;
      event.preventDefault();
      closingRef.current = true;
      void closeCustomFaceImagePixelizer().catch((error) => {
        closingRef.current = false;
        console.warn('failed to close custom face image pixelizer', error);
      });
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch((error) => console.warn('failed to register custom face image pixelizer close handler', error));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<CanvasSize>(CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT, (event) => {
      if (disposed) return;
      const { width, height } = event.payload;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) return;
      updateCanvasSize({ width, height });
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    }).catch((error) => console.warn('failed to initialize custom face image pixelizer open request listener', error));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [updateCanvasSize]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      event.preventDefault();
      void loadImageFile(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImageFile]);

  useEffect(() => {
    const updateScale = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      setDisplayScale(
        displayScaleFor(
          canvasSize.width,
          canvasSize.height,
          Math.min(900, Math.max(1, viewport.clientWidth - 16)),
          Math.min(720, Math.max(1, viewport.clientHeight - 16))
        )
      );
    };

    updateScale();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [canvasSize.height, canvasSize.width]);

  useEffect(() => {
    if (!sourceId) {
      setPixelizeOptions((current) => samePixelizerOptions(current, normalizedOptions) ? current : normalizedOptions);
      return;
    }
    if (objectDragRef.current) return;
    const timeout = window.setTimeout(() => {
      setPixelizeOptions((current) => samePixelizerOptions(current, normalizedOptions) ? current : normalizedOptions);
    }, PIXELIZE_OPTIONS_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [normalizedOptions, sourceId]);

  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    const version = requestVersionRef.current + 1;
    requestVersionRef.current = version;
    setBusy(true);
    setError(null);
    void pixelizeCustomFaceImageSource({
      sourceId,
      profileWidth: canvasSize.width,
      profileHeight: canvasSize.height,
      options: normalizedPixelizeOptions
    })
      .then((next) => {
        if (cancelled || requestVersionRef.current !== version) return;
        setResult({
          packedPixels: next.packedPixels,
          previewPixels: next.previewPixels,
          sourceWidth: next.sourceWidth,
          sourceHeight: next.sourceHeight
        });
      })
      .catch((caught) => {
        if (cancelled || requestVersionRef.current !== version) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (!cancelled && requestVersionRef.current === version) setBusy(false);
      });

    return () => {
      cancelled = true;
      if (requestVersionRef.current === version) requestVersionRef.current += 1;
    };
  }, [canvasSize.height, canvasSize.width, normalizedPixelizeOptions, sourceId]);

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const clearWorkspace = async () => {
    await releaseCurrentSource();
    resetWorkspace();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await loadImageFile(file);
  };

  const handleApply = async () => {
    if (!result || busy) return;
    try {
      await applyCustomFaceImageImport({
        packedPixels: result.packedPixels,
        sourceWidth: canvasSize.width,
        sourceHeight: canvasSize.height
      });
      await closeCustomFaceImagePixelizer();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const handleDiscard = async () => {
    await releaseCurrentSource();
    await closeCustomFaceImagePixelizer();
  };

  const resetAllOptions = () => setOptions(defaultPixelizerOptions());
  const resetTransformOptions = () => setOptions((current) => ({
    ...current,
    scale: defaultOptions.scale,
    offsetX: defaultOptions.offsetX,
    offsetY: defaultOptions.offsetY
  }));
  const centerTransformOptions = () => setOptions((current) => ({
    ...current,
    offsetX: 0,
    offsetY: 0
  }));
  const resetToneOptions = () => setOptions((current) => ({
    ...current,
    threshold: defaultOptions.threshold,
    contrast: defaultOptions.contrast,
    brightness: defaultOptions.brightness,
    invert: defaultOptions.invert,
    dither: defaultOptions.dither
  }));
  const resetPaletteOptions = () => setOptions((current) => ({
    ...current,
    mode: defaultOptions.mode,
    colorCount: defaultOptions.colorCount
  }));

  const beginObjectDrag = (event: PointerEvent<HTMLDivElement>) => {
    objectDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: normalizedOptions.offsetX,
      offsetY: normalizedOptions.offsetY
    };
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const moveObjectDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = objectDragRef.current;
    if (!drag) return;
    const nextOptions = {
      ...latestOptionsRef.current,
      offsetX: Math.round(drag.offsetX + (event.clientX - drag.clientX) / displayScale),
      offsetY: Math.round(drag.offsetY + (event.clientY - drag.clientY) / displayScale)
    };
    latestOptionsRef.current = normalizePixelizerOptions(nextOptions);
    setOptions((current) => ({
      ...current,
      offsetX: nextOptions.offsetX,
      offsetY: nextOptions.offsetY
    }));
  };
  const endObjectDrag = (event: PointerEvent<HTMLDivElement>) => {
    objectDragRef.current = null;
    setPixelizeOptions((current) => samePixelizerOptions(current, latestOptionsRef.current) ? current : latestOptionsRef.current);
    if (typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const beginSourcePreviewDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    sourcePreviewDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: sourcePreviewPosition.x,
      y: sourcePreviewPosition.y
    };
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const moveSourcePreviewDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = sourcePreviewDragRef.current;
    if (!drag) return;
    event.stopPropagation();
    setSourcePreviewPosition({
      x: Math.max(0, Math.round(drag.x + event.clientX - drag.clientX)),
      y: Math.max(0, Math.round(drag.y + event.clientY - drag.clientY))
    });
  };

  const endSourcePreviewDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!sourcePreviewDragRef.current) return;
    event.stopPropagation();
    sourcePreviewDragRef.current = null;
    if (typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const currentMode = normalizedOptions.mode;

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="text-sm font-medium">{t('customFaceEditor.imagePixelizer.title')}</h1>
        <span className="border border-primary bg-primary/10 px-2 py-1 text-xs text-primary">
          {t('customFaceEditor.imagePixelizer.canvasSize', { width: canvasSize.width, height: canvasSize.height })}
        </span>
        {selectedName ? (
          <span className="text-xs text-muted-foreground">
            {t('customFaceEditor.imagePixelizer.selectedFile', { name: selectedName })}
          </span>
        ) : null}
        <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
          {currentMode === 'color' ? t('customFaceEditor.imagePixelizer.modeColor') : t('customFaceEditor.imagePixelizer.modeMono')}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="border border-border px-3 py-2 text-sm" onClick={handleChooseImage}>
            {t('customFaceEditor.imagePixelizer.selectImage')}
          </button>
          <button type="button" className="border border-border px-3 py-2 text-sm" onClick={clearWorkspace}>
            {t('customFaceEditor.imagePixelizer.clear')}
          </button>
          <button type="button" className="border border-border px-3 py-2 text-sm" onClick={resetAllOptions}>
            {t('customFaceEditor.imagePixelizer.resetAll')}
          </button>
          <button type="button" className="border border-primary px-3 py-2 text-sm disabled:opacity-50" disabled={!result || busy} onClick={() => void handleApply()}>
            {t('customFaceEditor.imagePixelizer.apply')}
          </button>
          <button type="button" className="border border-border px-3 py-2 text-sm" onClick={() => void handleDiscard()}>
            {t('customFaceEditor.imagePixelizer.discard')}
          </button>
        </div>
      </header>

      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {t('customFaceEditor.imagePixelizer.pasteHint')}
      </div>

      {error ? (
        <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <section ref={viewportRef} className="min-w-0 flex-1 overflow-auto border border-border bg-background p-2">
          <input
            ref={fileInputRef}
            data-testid="custom-face-image-input"
            accept="image/*"
            className="hidden"
            type="file"
            onChange={(event) => void handleFileChange(event)}
          />

          <div className="relative inline-block">
            <CustomFaceViewport
              width={canvasSize.width}
              height={canvasSize.height}
              scale={displayScale}
              guides={guides}
              onGuidesChange={() => undefined}
              className="relative shrink-0 overflow-hidden bg-background outline outline-1 outline-border"
              screenStyle={{
                aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
                cursor: result && !busy ? 'move' : busy ? 'progress' : 'default'
              }}
              screenTestId="custom-face-image-pixelizer-screen"
              onScreenPointerDown={(event) => {
                if (!result) return;
                beginObjectDrag(event as unknown as PointerEvent<HTMLDivElement>);
              }}
              onScreenPointerMove={(event) => {
                if (!result) return;
                moveObjectDrag(event as unknown as PointerEvent<HTMLDivElement>);
              }}
              onScreenPointerUp={(event) => {
                if (!result) return;
                endObjectDrag(event as unknown as PointerEvent<HTMLDivElement>);
              }}
              onScreenPointerCancel={(event) => {
                if (!result) return;
                endObjectDrag(event as unknown as PointerEvent<HTMLDivElement>);
              }}
            >
              {result ? (
                <CustomFacePixelPreview
                  width={canvasSize.width}
                  height={canvasSize.height}
                  packedPixels={result.packedPixels}
                  rgbaPixels={result.previewPixels}
                  ariaLabel={t('customFaceEditor.imagePixelizer.preview')}
                  displayScale={displayScale}
                  className="pointer-events-none absolute inset-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {busy ? t('common.loading') : t('customFaceEditor.imagePixelizer.selectImage')}
                </div>
              )}
            </CustomFaceViewport>
            {result ? (
              <div
                data-testid="image-pixelizer-source-thumb"
                className="absolute left-0 top-0 z-30 cursor-move border border-primary/70 bg-background/85 shadow-lg"
                style={{
                  width: `${SOURCE_PREVIEW_THUMB_SIZE}px`,
                  height: `${SOURCE_PREVIEW_THUMB_SIZE}px`,
                  transform: `translate(${sourcePreviewPosition.x}px, ${sourcePreviewPosition.y}px)`
                }}
                onPointerDown={beginSourcePreviewDrag}
                onPointerMove={moveSourcePreviewDrag}
                onPointerUp={endSourcePreviewDrag}
                onPointerCancel={endSourcePreviewDrag}
                onPointerEnter={() => setSourcePreviewHovered(true)}
                onPointerLeave={() => setSourcePreviewHovered(false)}
                onMouseEnter={() => setSourcePreviewHovered(true)}
                onMouseLeave={() => setSourcePreviewHovered(false)}
              >
                <div className="h-full w-full overflow-hidden">
                  {sourceUrl ? (
                    <img
                      alt={t('customFaceEditor.imagePixelizer.originalImage')}
                      className="block h-full w-full object-contain"
                      draggable={false}
                      src={sourceUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      {t('customFaceEditor.imagePixelizer.originalImage')}
                    </div>
                  )}
                </div>
                {sourcePreviewHovered ? (
                  <div
                    data-testid="image-pixelizer-object-hover"
                    className="pointer-events-none absolute left-0 top-0 overflow-hidden border border-primary bg-background shadow-2xl"
                    style={{
                      width: `${SOURCE_PREVIEW_HOVER_SIZE}px`,
                      height: `${SOURCE_PREVIEW_HOVER_SIZE}px`,
                      transform: 'translateY(calc(-100% - 8px))',
                      transformOrigin: 'top left'
                    }}
                  >
                    {sourceUrl ? (
                      <img
                        alt={t('customFaceEditor.imagePixelizer.originalImage')}
                        className="block h-full w-full object-contain"
                        draggable={false}
                        src={sourceUrl}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        {t('customFaceEditor.imagePixelizer.originalImage')}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="flex w-[22rem] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border pl-4 text-sm">
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">{t('customFaceEditor.imagePixelizer.parameters')}</h2>
              {busy ? <span className="text-xs text-muted-foreground">{t('common.loading')}</span> : null}
            </div>

            <ParameterGroup title={t('customFaceEditor.imagePixelizer.paletteGroup')} onReset={resetPaletteOptions}>
              <ModeSwitch
                hint={t('customFaceEditor.imagePixelizer.modeHint')}
                label={t('customFaceEditor.imagePixelizer.mode')}
                value={normalizedOptions.mode}
                onChange={(mode) => setOptions((current) => ({ ...current, mode }))}
              />

              <RangeField
                id="image-pixelizer-color-count"
                label={t('customFaceEditor.imagePixelizer.colorCount')}
                hint={t('customFaceEditor.imagePixelizer.colorCountHint')}
                min={2}
                max={256}
                step={1}
                value={options.colorCount}
                disabled={normalizedOptions.mode !== 'color'}
                onChange={(value) => setOptions((current) => ({ ...current, colorCount: value }))}
              />
            </ParameterGroup>

            <ParameterGroup title={t('customFaceEditor.imagePixelizer.transformGroup')} onReset={resetTransformOptions}>
              <RangeField
                id="image-pixelizer-scale"
                label={t('customFaceEditor.imagePixelizer.scale')}
                hint={t('customFaceEditor.imagePixelizer.scaleHint')}
                min={0.1}
                max={4}
                step={0.05}
                value={options.scale}
                onChange={(value) => setOptions((current) => ({ ...current, scale: value }))}
              />
              <RangeField
                id="image-pixelizer-offset-x"
                label={t('customFaceEditor.imagePixelizer.offsetX')}
                hint={t('customFaceEditor.imagePixelizer.offsetXHint')}
                min={-canvasSize.width}
                max={canvasSize.width}
                step={1}
                value={options.offsetX}
                onChange={(value) => setOptions((current) => ({ ...current, offsetX: value }))}
              />
              <RangeField
                id="image-pixelizer-offset-y"
                label={t('customFaceEditor.imagePixelizer.offsetY')}
                hint={t('customFaceEditor.imagePixelizer.offsetYHint')}
                min={-canvasSize.height}
                max={canvasSize.height}
                step={1}
                value={options.offsetY}
                onChange={(value) => setOptions((current) => ({ ...current, offsetY: value }))}
              />
              <div className="flex gap-2">
                <button type="button" className="border border-border px-2 py-1 text-xs" onClick={centerTransformOptions}>
                  {t('customFaceEditor.imagePixelizer.center')}
                </button>
              </div>
            </ParameterGroup>

            <ParameterGroup title={t('customFaceEditor.imagePixelizer.toneGroup')} onReset={resetToneOptions}>
              <RangeField
                id="image-pixelizer-threshold"
                label={t('customFaceEditor.imagePixelizer.threshold')}
                hint={t('customFaceEditor.imagePixelizer.thresholdHint')}
                min={0}
                max={255}
                step={1}
                value={options.threshold}
                onChange={(value) => setOptions((current) => ({ ...current, threshold: value }))}
              />

              <RangeField
                id="image-pixelizer-contrast"
                label={t('customFaceEditor.imagePixelizer.contrast')}
                hint={t('customFaceEditor.imagePixelizer.contrastHint')}
                min={-100}
                max={100}
                step={1}
                value={options.contrast}
                onChange={(value) => setOptions((current) => ({ ...current, contrast: value }))}
              />

              <RangeField
                id="image-pixelizer-brightness"
                label={t('customFaceEditor.imagePixelizer.brightness')}
                hint={t('customFaceEditor.imagePixelizer.brightnessHint')}
                min={-100}
                max={100}
                step={1}
                value={options.brightness}
                onChange={(value) => setOptions((current) => ({ ...current, brightness: value }))}
              />

              <ToggleField
                label={t('customFaceEditor.imagePixelizer.dither')}
                hint={t('customFaceEditor.imagePixelizer.ditherHint')}
                checked={options.dither}
                onChange={(checked) => setOptions((current) => ({ ...current, dither: checked }))}
              />

              <ToggleField
                label={t('customFaceEditor.imagePixelizer.invert')}
                hint={t('customFaceEditor.imagePixelizer.invertHint')}
                checked={options.invert}
                onChange={(checked) => setOptions((current) => ({ ...current, invert: checked }))}
              />
            </ParameterGroup>
          </section>

          <section className="rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>{t('customFaceEditor.imagePixelizer.outputInfo')}</span>
              <span>{result ? t('customFaceEditor.imagePixelizer.outputReady') : t('customFaceEditor.imagePixelizer.outputPending')}</span>
            </div>
            {result ? (
              <div className="mt-2 grid gap-1">
                <span>{t('customFaceEditor.imagePixelizer.sourceSize', { width: result.sourceWidth, height: result.sourceHeight })}</span>
                <span>{t('customFaceEditor.imagePixelizer.previewMode', { mode: currentMode === 'color' ? t('customFaceEditor.imagePixelizer.modeColor') : t('customFaceEditor.imagePixelizer.modeMono') })}</span>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}

function ParameterGroup({
  title,
  onReset,
  children,
}: {
  title: string;
  onReset: () => void;
  children: ReactNode;
}) {
  const t = useI18n();
  return (
    <section className="grid gap-3 border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium">{title}</h3>
        <button
          type="button"
          aria-label={t('customFaceEditor.imagePixelizer.resetGroup', { group: title })}
          className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs"
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('customFaceEditor.imagePixelizer.reset')}
        </button>
      </div>
      {children}
    </section>
  );
}

function ModeSwitch({
  hint,
  label,
  value,
  onChange,
}: {
  hint: string;
  label: string;
  value: ImagePixelizerOptions['mode'];
  onChange: (mode: ImagePixelizerOptions['mode']) => void;
}) {
  return (
    <div className="grid gap-1 text-xs">
      <span className="flex items-center gap-1">
        <span>{label}</span>
        <HintTip text={hint} />
      </span>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`border px-3 py-2 text-sm ${value === 'mono' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
          onClick={() => onChange('mono')}
        >
          黑白
        </button>
        <button
          type="button"
          className={`border px-3 py-2 text-sm ${value === 'color' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
          onClick={() => onChange('color')}
        >
          多色
        </button>
      </div>
    </div>
  );
}

function RangeField({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`grid gap-1 text-xs ${disabled ? 'opacity-60' : ''}`} htmlFor={id}>
      <span className="flex items-center gap-1">
        <span>{label}</span>
        <HintTip text={hint} />
      </span>
      <div className="grid grid-cols-[1fr_4.5rem] items-center gap-2">
        <input
          aria-label={label}
          className="h-8 w-full accent-primary"
          id={id}
          max={max}
          min={min}
          step={step}
          type="range"
          value={sanitizeRangeValue(value, min)}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next)) return;
            onChange(next);
          }}
        />
        <input
          aria-label={`${label}数值`}
          className="border border-border bg-background px-2 py-1 text-sm"
          max={max}
          min={min}
          step={step}
          type="number"
          value={sanitizeRangeValue(value, min)}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next)) return;
            onChange(next);
          }}
        />
      </div>
    </label>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between border border-border px-2 py-2 text-xs">
      <span className="flex items-center gap-1">
        <span>{label}</span>
        <HintTip text={hint} />
      </span>
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function HintTip({ text }: { text: string }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  return (
    <button
      type="button"
      aria-label={text}
      className="inline-flex cursor-help items-center text-muted-foreground outline-none"
      title={text}
      onBlur={() => setPosition(null)}
      onFocus={(event) => setPosition({ x: event.currentTarget.getBoundingClientRect().left, y: event.currentTarget.getBoundingClientRect().bottom + 6 })}
      onMouseEnter={(event) => setPosition({ x: event.clientX + 10, y: event.clientY + 10 })}
      onMouseLeave={() => setPosition(null)}
      onMouseMove={(event) => setPosition({ x: event.clientX + 10, y: event.clientY + 10 })}
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
      {position ? (
        <span
          role="tooltip"
          className="fixed z-50 w-56 border border-border bg-popover px-2 py-1 text-left text-[11px] leading-4 text-popover-foreground shadow-lg"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
          {text}
        </span>
      ) : null}
    </button>
  );
}

function createImagePreviewUrl(file: File) {
  if (typeof URL.createObjectURL !== 'function') {
    return null;
  }
  return URL.createObjectURL(file);
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error('读取图片失败'));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function canvasSizeFromLocation(): CanvasSize {
  const params = new URL(window.location.href).searchParams;
  const width = parsePositiveInteger(params.get('width')) ?? 128;
  const height = parsePositiveInteger(params.get('height')) ?? 32;
  return { width, height };
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function displayScaleFor(width: number, height: number, maxWidth: number, maxHeight: number) {
  if (width <= 0 || height <= 0 || maxWidth <= 0 || maxHeight <= 0) return 1;
  return Math.max(1, Math.min(maxWidth / width, maxHeight / height));
}

function sanitizeRangeValue(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function samePixelizerOptions(left: ImagePixelizerOptions, right: ImagePixelizerOptions) {
  return left.mode === right.mode
    && left.colorCount === right.colorCount
    && left.dither === right.dither
    && left.invert === right.invert
    && left.threshold === right.threshold
    && left.contrast === right.contrast
    && left.brightness === right.brightness
    && left.scale === right.scale
    && left.offsetX === right.offsetX
    && left.offsetY === right.offsetY;
}
