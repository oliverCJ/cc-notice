import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Download, FileImage, Info, RotateCcw, Upload, X } from 'lucide-react';
import { RangeStepperField as RangeStepper, normalizeRangeValue } from './RangeStepperField';
import {
  closeCustomFaceImageVectorizer,
  emitCustomFaceOpenSvgPathEvent,
  focusCustomFaceEditor,
  prepareCustomFaceImageVectorizerSource,
  releaseCustomFaceImageVectorizerSource,
  vectorizeCustomFaceImageVectorizerSource,
  writeCustomFaceVectorizedSvgTempFile,
} from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import {
  defaultVectorizerOptions,
  normalizeVectorizerOptions,
  VECTORIZE_OPTIONS_DEBOUNCE_MS,
  type ImageVectorizerOptions,
} from './imageVectorizerOptions';

type SourceSize = {
  width: number;
  height: number;
};

type PreviewPosition = {
  x: number;
  y: number;
};

type PreviewDragState = {
  grabX: number;
  grabY: number;
  width: number;
  height: number;
};

type OutputPreviewDragState = {
  clientX: number;
  clientY: number;
  positionX: number;
  positionY: number;
  maxX: number;
  maxY: number;
};

const SOURCE_PREVIEW_THUMB_SIZE = 96;
const SOURCE_PREVIEW_HOVER_SIZE = 192;
const CUSTOM_FACE_IMAGE_VECTORIZER_OPEN_REQUEST_EVENT =
  'cc-notice://custom-face-image-vectorizer-open-request';

function readVectorizerTargetSize() {
  const params = new URLSearchParams(window.location.search);
  const width = Number(params.get('width') ?? '0');
  const height = Number(params.get('height') ?? '0');
  return {
    width: Number.isFinite(width) && width > 0 ? Math.trunc(width) : 0,
    height: Number.isFinite(height) && height > 0 ? Math.trunc(height) : 0,
  };
}

export function CustomFaceImageVectorizerWindow() {
  const t = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const outputPreviewRef = useRef<HTMLDivElement>(null);
  const sourcePreviewThumbRef = useRef<HTMLDivElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const sourceIdRef = useRef<string | null>(null);
  const sourcePreviewDragRef = useRef<PreviewDragState | null>(null);
  const outputPreviewDragRef = useRef<OutputPreviewDragState | null>(null);
  const renderVersionRef = useRef(0);
  const mountedRef = useRef(true);
  const latestOptionsRef = useRef<ImageVectorizerOptions>(defaultVectorizerOptions());
  const [options, setOptions] = useState<ImageVectorizerOptions>(() => defaultVectorizerOptions());
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<SourceSize | null>(null);
  const [workingSize, setWorkingSize] = useState<SourceSize | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetCanvasSize, setTargetCanvasSize] = useState(() => readVectorizerTargetSize());
  const [sourcePreviewPosition, setSourcePreviewPosition] = useState<PreviewPosition>({
    x: 12,
    y: 12,
  });
  const [sourcePreviewHovered, setSourcePreviewHovered] = useState(false);
  const [outputPreviewPosition, setOutputPreviewPosition] = useState<PreviewPosition>({
    x: 0,
    y: 0,
  });
  const [svg, setSvg] = useState('');
  const [svgWidth, setSvgWidth] = useState(0);
  const [svgHeight, setSvgHeight] = useState(0);
  const [busy, setBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedOptions = useMemo(() => normalizeVectorizerOptions(options), [options]);
  const defaultOptions = useMemo(() => defaultVectorizerOptions(), []);

  useEffect(() => {
    latestOptionsRef.current = normalizedOptions;
  }, [normalizedOptions]);

  const releaseCurrentSource = async () => {
    const currentSourceId = sourceIdRef.current;
    if (!currentSourceId) return;
    sourceIdRef.current = null;
    setSourceId(null);
    try {
      await releaseCustomFaceImageVectorizerSource(currentSourceId);
    } catch (caught) {
      console.warn('failed to release custom face vectorizer source', caught);
    }
  };

  const resetWorkspace = () => {
    renderVersionRef.current += 1;
    setError(null);
    setSelectedName(null);
    setSourceSize(null);
    setWorkingSize(null);
    setSourceId(null);
    setSourcePreviewPosition({ x: 12, y: 12 });
    setSourcePreviewHovered(false);
    setOutputPreviewPosition({ x: 0, y: 0 });
    sourcePreviewDragRef.current = null;
    outputPreviewDragRef.current = null;
    setSourceUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      sourceUrlRef.current = null;
      return null;
    });
    setSvg('');
    setSvgWidth(0);
    setSvgHeight(0);
  };

  const loadImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(t('customFaceEditor.imageVectorizer.unsupportedFile'));
      return;
    }
    if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
      setError(t('customFaceEditor.imageVectorizer.staticOnly'));
      return;
    }
    const version = renderVersionRef.current + 1;
    renderVersionRef.current = version;
    setBusy(true);
    setError(null);
    let loadVersion = version;
    try {
      await releaseCurrentSource();
      resetWorkspace();
      loadVersion = renderVersionRef.current + 1;
      renderVersionRef.current = loadVersion;
      setSelectedName(file.name || t('customFaceEditor.imageVectorizer.pastedImage'));
      const nextUrl = createImagePreviewUrl(file);
      if (nextUrl) {
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
        sourceUrlRef.current = nextUrl;
        setSourceUrl(nextUrl);
      }
      const bytes = await readBlobAsArrayBuffer(file);
      const prepared = await prepareCustomFaceImageVectorizerSource({
        fileName: file.name || 'image.png',
        imageBytes: Array.from(new Uint8Array(bytes)),
        targetWidth: targetCanvasSize.width,
        targetHeight: targetCanvasSize.height,
      });
      if (!mountedRef.current || renderVersionRef.current !== loadVersion) {
        await releaseCustomFaceImageVectorizerSource(prepared.sourceId);
        return;
      }
      sourceIdRef.current = prepared.sourceId;
      setSourceId(prepared.sourceId);
      setSourceSize({ width: prepared.sourceWidth, height: prepared.sourceHeight });
      setWorkingSize({ width: prepared.workingWidth, height: prepared.workingHeight });
    } catch (caught) {
      if (mountedRef.current && renderVersionRef.current === version) {
        setError(caught instanceof Error ? caught.message : String(caught));
        setSourceId(null);
        sourceIdRef.current = null;
        setSourcePreviewHovered(false);
        sourcePreviewDragRef.current = null;
      }
    } finally {
      if (mountedRef.current && renderVersionRef.current === loadVersion) {
        setBusy(false);
      }
    }
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await loadImageFile(file);
  };

  const handlePaste = async (event: ClipboardEvent) => {
    const file = event.clipboardData?.files?.[0];
    if (!file) return;
    event.preventDefault();
    await loadImageFile(file);
  };

  const handlePasteButton = async () => {
    setError(null);
    if (typeof navigator.clipboard?.read !== 'function') {
      setError(t('customFaceEditor.imageVectorizer.clipboardUnsupported'));
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((value) => value.startsWith('image/'));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        await loadImageFile(
          new File([blob], `pasted.${imageType.split('/')[1] || 'png'}`, { type: imageType })
        );
        return;
      }
      setError(t('customFaceEditor.imageVectorizer.clipboardEmpty'));
    } catch (caught) {
      console.warn('failed to read image from clipboard', caught);
      setError(t('customFaceEditor.imageVectorizer.clipboardUnsupported'));
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    event.preventDefault();
    await loadImageFile(file);
  };

  const handleSourcePreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const previewPane = previewPaneRef.current;
    const thumb = sourcePreviewThumbRef.current;
    if (!previewPane || !thumb) return;
    const thumbRect = thumb.getBoundingClientRect();
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    const thumbLeft = Number.isFinite(thumbRect.left) ? thumbRect.left : 0;
    const thumbTop = Number.isFinite(thumbRect.top) ? thumbRect.top : 0;
    const thumbWidth = Number.isFinite(thumbRect.width) ? thumbRect.width : 0;
    const thumbHeight = Number.isFinite(thumbRect.height) ? thumbRect.height : 0;
    sourcePreviewDragRef.current = {
      grabX: clientX - thumbLeft,
      grabY: clientY - thumbTop,
      width: thumbWidth,
      height: thumbHeight,
    };
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setSourcePreviewHovered(true);
  };

  const handleSourcePreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previewPane = previewPaneRef.current;
    const drag = sourcePreviewDragRef.current;
    if (!previewPane || !drag) return;
    const previewRect = previewPane.getBoundingClientRect();
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    const previewLeft = Number.isFinite(previewRect.left) ? previewRect.left : 0;
    const previewTop = Number.isFinite(previewRect.top) ? previewRect.top : 0;
    const previewWidth = Number.isFinite(previewRect.width) ? previewRect.width : 0;
    const previewHeight = Number.isFinite(previewRect.height) ? previewRect.height : 0;
    const nextX = clampPosition(clientX - previewLeft - drag.grabX, previewWidth - drag.width);
    const nextY = clampPosition(clientY - previewTop - drag.grabY, previewHeight - drag.height);
    setSourcePreviewPosition({ x: nextX, y: nextY });
  };

  const handleSourcePreviewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    sourcePreviewDragRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleOutputPreviewPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sourceId || renderBusy) return;
    const previewPane = previewPaneRef.current;
    const outputPreview = outputPreviewRef.current;
    if (!previewPane || !outputPreview) return;
    const paneRect = previewPane.getBoundingClientRect();
    const outputRect = outputPreview.getBoundingClientRect();
    outputPreviewDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      positionX: outputPreviewPosition.x,
      positionY: outputPreviewPosition.y,
      maxX: Math.max(0, (paneRect.width - outputRect.width) / 2),
      maxY: Math.max(0, (paneRect.height - outputRect.height) / 2),
    };
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handleOutputPreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = outputPreviewDragRef.current;
    if (!drag) return;
    setOutputPreviewPosition({
      x: clampPreviewOffset(drag.positionX + Math.round(event.clientX - drag.clientX), drag.maxX),
      y: clampPreviewOffset(drag.positionY + Math.round(event.clientY - drag.clientY), drag.maxY),
    });
  };

  const handleOutputPreviewPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    outputPreviewDragRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleUseSvg = async () => {
    if (!svg || renderBusy) return;
    const result = await writeCustomFaceVectorizedSvgTempFile(svg);
    await emitCustomFaceOpenSvgPathEvent(result.path);
    try {
      await focusCustomFaceEditor();
    } catch (caught) {
      console.warn('failed to focus custom face editor after sending svg', caught);
    }
  };

  const handleExportSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedName?.replace(/\.[^.]+$/, '') || 'vectorized'}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDiscard = async () => {
    await releaseCurrentSource();
    await closeCustomFaceImageVectorizer();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      renderVersionRef.current += 1;
      void releaseCurrentSource();
      if (sourceUrlRef.current) {
        URL.revokeObjectURL(sourceUrlRef.current);
        sourceUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<{ width: number; height: number }>(
      CUSTOM_FACE_IMAGE_VECTORIZER_OPEN_REQUEST_EVENT,
      (event) => {
        if (disposed) return;
        const nextWidth = Number(event.payload?.width);
        const nextHeight = Number(event.payload?.height);
        if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
          setTargetCanvasSize({
            width: Math.max(0, Math.trunc(nextWidth)),
            height: Math.max(0, Math.trunc(nextHeight)),
          });
        }
      }
    )
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((caught) =>
        console.warn('failed to initialize vectorizer open request listener', caught)
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handlePasteEvent = (event: ClipboardEvent) => {
      void handlePaste(event);
    };
    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, []);

  useEffect(() => {
    if (!sourceId) return;
    const version = renderVersionRef.current + 1;
    renderVersionRef.current = version;
    setRenderBusy(true);
    setError(null);
    const timeout = window.setTimeout(() => {
      void vectorizeCustomFaceImageVectorizerSource({
        sourceId,
        options: latestOptionsRef.current,
      })
        .then((result) => {
          if (!mountedRef.current || renderVersionRef.current !== version) return;
          setSvg(result.svg);
          setSvgWidth(result.width);
          setSvgHeight(result.height);
        })
        .catch((caught) => {
          if (!mountedRef.current || renderVersionRef.current !== version) return;
          setError(caught instanceof Error ? caught.message : String(caught));
        })
        .finally(() => {
          if (mountedRef.current && renderVersionRef.current === version) {
            setRenderBusy(false);
          }
        });
    }, VECTORIZE_OPTIONS_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [sourceId, normalizedOptions]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (disposed) return;
        event.preventDefault();
        void handleDiscard().catch((caught) => {
          console.warn('failed to close custom face image vectorizer', caught);
        });
      })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((caught) => console.warn('failed to register vectorizer close handler', caught));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const resetAllOptions = () => setOptions(defaultVectorizerOptions());

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="text-sm font-medium">{t('customFaceEditor.imageVectorizer.title')}</h1>
        {selectedName ? (
          <span className="text-xs text-muted-foreground">
            {t('customFaceEditor.imageVectorizer.selectedFile', { name: selectedName })}
          </span>
        ) : null}
        {sourceSize ? (
          <span className="border border-primary bg-primary/10 px-2 py-1 text-xs text-primary">
            {t('customFaceEditor.imageVectorizer.sourceSize', {
              width: sourceSize.width,
              height: sourceSize.height,
            })}
          </span>
        ) : null}
        {workingSize &&
        (workingSize.width !== sourceSize?.width || workingSize.height !== sourceSize?.height) ? (
          <span className="border border-amber-500 bg-amber-500/10 px-2 py-1 text-xs text-amber-700">
            {t('customFaceEditor.imageVectorizer.workingSize', {
              width: workingSize.width,
              height: workingSize.height,
            })}
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={handleChooseImage}
          >
            <FileImage className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t('customFaceEditor.imageVectorizer.selectImage')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={() => void handlePasteButton()}
          >
            <Upload className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t('customFaceEditor.imageVectorizer.paste')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={resetAllOptions}
          >
            {t('customFaceEditor.imageVectorizer.reset')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={handleExportSvg}
            disabled={!svg}
          >
            <Download className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t('customFaceEditor.imageVectorizer.exportSvg')}
          </button>
          <button
            type="button"
            className="border border-primary px-3 py-2 text-sm disabled:opacity-50"
            disabled={!svg || renderBusy}
            onClick={() => void handleUseSvg()}
          >
            {t('customFaceEditor.imageVectorizer.sendToSvg')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={() => void handleDiscard()}
          >
            <X className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {t('customFaceEditor.imageVectorizer.close')}
          </button>
        </div>
      </header>

      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {t('customFaceEditor.imageVectorizer.pasteHint')}
      </div>

      {error ? (
        <div
          role="alert"
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div
        data-testid="custom-face-vectorizer-layout"
        className="grid min-h-0 flex-1 gap-4 p-3 lg:grid-cols-[minmax(0,8fr)_minmax(360px,2fr)]"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void handleDrop(event)}
      >
        <input
          ref={fileInputRef}
          data-testid="custom-face-vectorizer-input"
          accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
          className="hidden"
          type="file"
          onChange={(event) => void handleFileChange(event)}
        />

        <section className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="relative flex min-h-0 flex-1 flex-col border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('customFaceEditor.imageVectorizer.svgPreview')}</span>
              <span>
                {renderBusy
                  ? t('common.loading')
                  : svg
                    ? t('customFaceEditor.imageVectorizer.ready')
                    : t('customFaceEditor.imageVectorizer.waiting')}
              </span>
            </div>
            <div
              ref={previewPaneRef}
              className="relative min-h-0 flex-1 overflow-hidden border border-border"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.04)',
                backgroundImage:
                  'linear-gradient(45deg, rgba(148, 163, 184, 0.22) 25%, transparent 25%), linear-gradient(-45deg, rgba(148, 163, 184, 0.22) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148, 163, 184, 0.22) 75%), linear-gradient(-45deg, transparent 75%, rgba(148, 163, 184, 0.22) 75%)',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                backgroundSize: '16px 16px',
              }}
            >
              <div
                ref={outputPreviewRef}
                data-testid="custom-face-vectorizer-preview-object"
                className="absolute left-1/2 top-1/2"
                style={{
                  width: svgWidth > 0 ? `${svgWidth}px` : '8px',
                  height: svgHeight > 0 ? `${svgHeight}px` : '8px',
                  maxWidth: 'calc(100% - 24px)',
                  maxHeight: 'calc(100% - 24px)',
                  transform: `translate(calc(-50% + ${outputPreviewPosition.x}px), calc(-50% + ${outputPreviewPosition.y}px))`,
                }}
              >
                <iframe
                  data-testid="custom-face-vectorizer-preview"
                  className="h-full w-full border-0"
                  sandbox=""
                  srcDoc={svg || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>'}
                  title={t('customFaceEditor.imageVectorizer.svgPreview')}
                />
              </div>
              <div
                data-testid="custom-face-vectorizer-output-drag-layer"
                className={`absolute inset-0 z-10 ${sourceId && !renderBusy ? 'cursor-move' : 'cursor-default'}`}
                onPointerDown={handleOutputPreviewPointerDown}
                onPointerMove={handleOutputPreviewPointerMove}
                onPointerUp={handleOutputPreviewPointerUp}
                onPointerCancel={handleOutputPreviewPointerUp}
              />
              <div className="pointer-events-none absolute inset-0">
                {selectedName ? (
                  <div
                    ref={sourcePreviewThumbRef}
                    data-testid="custom-face-vectorizer-source-thumb"
                    className="pointer-events-auto absolute z-20 cursor-move overflow-hidden border border-border bg-background shadow-sm"
                    style={{
                      width: `${sourcePreviewHovered ? SOURCE_PREVIEW_HOVER_SIZE : SOURCE_PREVIEW_THUMB_SIZE}px`,
                      height: `${sourcePreviewHovered ? SOURCE_PREVIEW_HOVER_SIZE : SOURCE_PREVIEW_THUMB_SIZE}px`,
                      transform: `translate(${sourcePreviewPosition.x}px, ${sourcePreviewPosition.y}px)`,
                    }}
                    onPointerDown={handleSourcePreviewPointerDown}
                    onPointerMove={handleSourcePreviewPointerMove}
                    onPointerUp={handleSourcePreviewPointerUp}
                    onPointerCancel={handleSourcePreviewPointerUp}
                    onMouseEnter={() => {
                      setSourcePreviewHovered(true);
                    }}
                    onMouseLeave={() => {
                      setSourcePreviewHovered(false);
                      sourcePreviewDragRef.current = null;
                    }}
                  >
                    {sourceUrl ? (
                      <img
                        alt={selectedName ?? t('customFaceEditor.imageVectorizer.originalImage')}
                        className="block h-full w-full object-contain"
                        draggable={false}
                        src={sourceUrl}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground">
                        {busy
                          ? t('common.loading')
                          : (selectedName ?? t('customFaceEditor.imageVectorizer.originalImage'))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="absolute left-3 top-3 border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm">
                    {busy ? t('common.loading') : t('customFaceEditor.imageVectorizer.selectImage')}
                  </div>
                )}
                {svgWidth && svgHeight ? (
                  <div className="absolute right-3 top-3 border border-border bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
                    {t('customFaceEditor.imageVectorizer.svgSize', {
                      width: svgWidth,
                      height: svgHeight,
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            {sourceSize
              ? t('customFaceEditor.imageVectorizer.sourceSize', {
                  width: sourceSize.width,
                  height: sourceSize.height,
                })
              : t('customFaceEditor.imageVectorizer.waiting')}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm lg:border-l lg:border-border lg:pl-4">
          <section className="grid gap-3">
            <ParameterGroup
              title={t('customFaceEditor.imageVectorizer.transformGroup')}
              description={t('customFaceEditor.imageVectorizer.transformGroupHint')}
              onReset={() =>
                setOptions((current) => ({
                  ...current,
                  scale: defaultOptions.scale,
                  rotationDeg: defaultOptions.rotationDeg,
                  invert: defaultOptions.invert,
                  brightness: defaultOptions.brightness,
                  contrast: defaultOptions.contrast,
                }))
              }
            >
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.scale')}
                description={t('customFaceEditor.imageVectorizer.scaleHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.scale')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.scale'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.scale'),
                })}
                min={0.25}
                max={4}
                step={0.05}
                value={options.scale}
                defaultValue={defaultOptions.scale}
                onReset={() =>
                  setOptions((current) => ({ ...current, scale: defaultOptions.scale }))
                }
                onChange={(value) => setOptions((current) => ({ ...current, scale: value }))}
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    scale: normalizeRangeValue(current.scale + delta, 0.25, 4, 0.05),
                  }))
                }
                formatValue={(value) => `${value.toFixed(2)}x`}
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.rotationDeg')}
                description={t('customFaceEditor.imageVectorizer.rotationDegHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.rotationDeg')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.rotationDeg'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.rotationDeg'),
                })}
                min={-180}
                max={180}
                step={1}
                value={options.rotationDeg}
                defaultValue={defaultOptions.rotationDeg}
                onReset={() =>
                  setOptions((current) => ({ ...current, rotationDeg: defaultOptions.rotationDeg }))
                }
                onChange={(value) => setOptions((current) => ({ ...current, rotationDeg: value }))}
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    rotationDeg: normalizeRangeValue(current.rotationDeg + delta, -180, 180, 1),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.brightness')}
                description={t('customFaceEditor.imageVectorizer.brightnessHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.brightness')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.brightness'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.brightness'),
                })}
                min={-100}
                max={100}
                step={1}
                value={options.brightness}
                defaultValue={defaultOptions.brightness}
                onReset={() =>
                  setOptions((current) => ({ ...current, brightness: defaultOptions.brightness }))
                }
                onChange={(value) => setOptions((current) => ({ ...current, brightness: value }))}
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    brightness: normalizeRangeValue(current.brightness + delta, -100, 100, 1),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.contrast')}
                description={t('customFaceEditor.imageVectorizer.contrastHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.contrast')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.contrast'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.contrast'),
                })}
                min={-100}
                max={100}
                step={1}
                value={options.contrast}
                defaultValue={defaultOptions.contrast}
                onReset={() =>
                  setOptions((current) => ({ ...current, contrast: defaultOptions.contrast }))
                }
                onChange={(value) => setOptions((current) => ({ ...current, contrast: value }))}
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    contrast: normalizeRangeValue(current.contrast + delta, -100, 100, 1),
                  }))
                }
              />
              <label className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  {t('customFaceEditor.imageVectorizer.invert')}
                  <InfoTip
                    label={t('customFaceEditor.imageVectorizer.invert')}
                    description={t('customFaceEditor.imageVectorizer.invertHint')}
                  />
                </span>
                <input
                  className="ml-auto"
                  type="checkbox"
                  aria-label={t('customFaceEditor.imageVectorizer.invert')}
                  checked={normalizedOptions.invert}
                  onChange={(event) =>
                    setOptions((current) => ({ ...current, invert: event.target.checked }))
                  }
                />
              </label>
            </ParameterGroup>
            <ParameterGroup
              title={t('customFaceEditor.imageVectorizer.modeGroup')}
              description={t('customFaceEditor.imageVectorizer.modeGroupHint')}
              onReset={() => setOptions((current) => ({ ...current, mode: defaultOptions.mode }))}
            >
              <ModeSwitch
                label={t('customFaceEditor.imageVectorizer.mode')}
                description={t('customFaceEditor.imageVectorizer.modeHint')}
                value={normalizedOptions.mode}
                defaultValue={defaultOptions.mode}
                onReset={() => setOptions((current) => ({ ...current, mode: defaultOptions.mode }))}
                onChange={(mode) => setOptions((current) => ({ ...current, mode }))}
              />
            </ParameterGroup>
            <ParameterGroup
              title={t('customFaceEditor.imageVectorizer.traceGroup')}
              description={t('customFaceEditor.imageVectorizer.traceGroupHint')}
              onReset={() =>
                setOptions((current) => ({
                  ...current,
                  filterSpeckle: defaultOptions.filterSpeckle,
                  colorPrecision: defaultOptions.colorPrecision,
                  layerDifference: defaultOptions.layerDifference,
                  cornerThreshold: defaultOptions.cornerThreshold,
                  lengthThreshold: defaultOptions.lengthThreshold,
                  maxIterations: defaultOptions.maxIterations,
                }))
              }
            >
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.filterSpeckle')}
                description={t('customFaceEditor.imageVectorizer.filterSpeckleHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.filterSpeckle')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.filterSpeckle'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.filterSpeckle'),
                })}
                min={0}
                max={128}
                step={1}
                value={options.filterSpeckle}
                defaultValue={defaultOptions.filterSpeckle}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    filterSpeckle: defaultOptions.filterSpeckle,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, filterSpeckle: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    filterSpeckle: normalizeRangeValue(current.filterSpeckle + delta, 0, 128, 1),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.colorPrecision')}
                description={t('customFaceEditor.imageVectorizer.colorPrecisionHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.colorPrecision')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.colorPrecision'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.colorPrecision'),
                })}
                min={1}
                max={8}
                step={1}
                value={options.colorPrecision}
                disabled={normalizedOptions.mode !== 'color'}
                defaultValue={defaultOptions.colorPrecision}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    colorPrecision: defaultOptions.colorPrecision,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, colorPrecision: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    colorPrecision: normalizeRangeValue(current.colorPrecision + delta, 1, 8, 1),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.layerDifference')}
                description={t('customFaceEditor.imageVectorizer.layerDifferenceHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.layerDifference')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.layerDifference'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.layerDifference'),
                })}
                min={1}
                max={64}
                step={1}
                value={options.layerDifference}
                disabled={normalizedOptions.mode !== 'color'}
                defaultValue={defaultOptions.layerDifference}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    layerDifference: defaultOptions.layerDifference,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, layerDifference: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    layerDifference: normalizeRangeValue(current.layerDifference + delta, 1, 64, 1),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.cornerThreshold')}
                description={t('customFaceEditor.imageVectorizer.cornerThresholdHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.cornerThreshold')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.cornerThreshold'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.cornerThreshold'),
                })}
                min={0}
                max={180}
                step={1}
                value={options.cornerThreshold}
                defaultValue={defaultOptions.cornerThreshold}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    cornerThreshold: defaultOptions.cornerThreshold,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, cornerThreshold: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    cornerThreshold: normalizeRangeValue(
                      current.cornerThreshold + delta,
                      0,
                      180,
                      1
                    ),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.lengthThreshold')}
                description={t('customFaceEditor.imageVectorizer.lengthThresholdHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.lengthThreshold')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.lengthThreshold'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.lengthThreshold'),
                })}
                min={0.5}
                max={20}
                step={0.5}
                value={options.lengthThreshold}
                defaultValue={defaultOptions.lengthThreshold}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    lengthThreshold: defaultOptions.lengthThreshold,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, lengthThreshold: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    lengthThreshold: normalizeRangeValue(
                      current.lengthThreshold + delta,
                      0.5,
                      20,
                      0.5
                    ),
                  }))
                }
                formatValue={(value) => value.toFixed(1)}
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.maxIterations')}
                description={t('customFaceEditor.imageVectorizer.maxIterationsHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.maxIterations')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.maxIterations'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.maxIterations'),
                })}
                min={1}
                max={50}
                step={1}
                value={options.maxIterations}
                defaultValue={defaultOptions.maxIterations}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    maxIterations: defaultOptions.maxIterations,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, maxIterations: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    maxIterations: normalizeRangeValue(current.maxIterations + delta, 1, 50, 1),
                  }))
                }
              />
            </ParameterGroup>
            <ParameterGroup
              title={t('customFaceEditor.imageVectorizer.pathGroup')}
              description={t('customFaceEditor.imageVectorizer.pathGroupHint')}
              onReset={() =>
                setOptions((current) => ({
                  ...current,
                  spliceThreshold: defaultOptions.spliceThreshold,
                  pathPrecision: defaultOptions.pathPrecision,
                }))
              }
            >
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.spliceThreshold')}
                description={t('customFaceEditor.imageVectorizer.spliceThresholdHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.spliceThreshold')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.spliceThreshold'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.spliceThreshold'),
                })}
                min={0}
                max={180}
                step={1}
                value={options.spliceThreshold}
                defaultValue={defaultOptions.spliceThreshold}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    spliceThreshold: defaultOptions.spliceThreshold,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, spliceThreshold: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    spliceThreshold: normalizeRangeValue(
                      current.spliceThreshold + delta,
                      0,
                      180,
                      1
                    ),
                  }))
                }
              />
              <RangeStepper
                label={t('customFaceEditor.imageVectorizer.pathPrecision')}
                description={t('customFaceEditor.imageVectorizer.pathPrecisionHint')}
                ariaLabel={t('customFaceEditor.imageVectorizer.pathPrecision')}
                decreaseLabel={t('customFaceEditor.svgImport.decrease', {
                  field: t('customFaceEditor.imageVectorizer.pathPrecision'),
                })}
                increaseLabel={t('customFaceEditor.svgImport.increase', {
                  field: t('customFaceEditor.imageVectorizer.pathPrecision'),
                })}
                min={0}
                max={5}
                step={1}
                value={options.pathPrecision}
                defaultValue={defaultOptions.pathPrecision}
                onReset={() =>
                  setOptions((current) => ({
                    ...current,
                    pathPrecision: defaultOptions.pathPrecision,
                  }))
                }
                onChange={(value) =>
                  setOptions((current) => ({ ...current, pathPrecision: value }))
                }
                onStep={(delta) =>
                  setOptions((current) => ({
                    ...current,
                    pathPrecision: normalizeRangeValue(current.pathPrecision + delta, 0, 5, 1),
                  }))
                }
              />
            </ParameterGroup>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ParameterGroup({
  title,
  description,
  onReset,
  children,
}: {
  title: string;
  description?: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const t = useI18n();
  return (
    <section className="grid gap-3 border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-xs font-medium">{title}</h3>
          {description ? <InfoTip label={title} description={description} /> : null}
        </div>
        <button type="button" className="border border-border px-2 py-1 text-xs" onClick={onReset}>
          {t('customFaceEditor.imageVectorizer.reset')}
        </button>
      </div>
      {children}
    </section>
  );
}

function ModeSwitch({
  label,
  description,
  defaultValue,
  value,
  onReset,
  onChange,
}: {
  label: string;
  description?: string;
  defaultValue: ImageVectorizerOptions['mode'];
  value: ImageVectorizerOptions['mode'];
  onReset: () => void;
  onChange: (mode: ImageVectorizerOptions['mode']) => void;
}) {
  const t = useI18n();
  return (
    <div className="grid gap-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span>{label}</span>
          {description ? <InfoTip label={label} description={description} /> : null}
        </span>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center border border-border text-[11px] text-muted-foreground disabled:opacity-30"
          disabled={value === defaultValue}
          aria-label={t('customFaceEditor.imageVectorizer.reset')}
          title={t('customFaceEditor.imageVectorizer.reset')}
          onClick={onReset}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`border px-3 py-2 text-sm ${value === 'binary' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
          onClick={() => onChange('binary')}
        >
          {t('customFaceEditor.imageVectorizer.modeBinary')}
        </button>
        <button
          type="button"
          className={`border px-3 py-2 text-sm ${value === 'color' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
          onClick={() => onChange('color')}
        >
          {t('customFaceEditor.imageVectorizer.modeColor')}
        </button>
      </div>
    </div>
  );
}

function InfoTip({ label, description }: { label: string; description: string }) {
  const [position, setPosition] = useState<PreviewPosition | null>(null);
  return (
    <button
      type="button"
      className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
      aria-label={`${label} 说明`}
      onBlur={() => setPosition(null)}
      onFocus={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.bottom + 6 });
      }}
      onMouseEnter={(event) => setPosition({ x: event.clientX + 10, y: event.clientY + 10 })}
      onMouseLeave={() => setPosition(null)}
    >
      <Info aria-hidden="true" className="h-3 w-3" />
      {position ? (
        <span
          role="tooltip"
          className="fixed z-50 w-56 border border-border bg-popover px-2 py-1 text-left text-[11px] leading-4 text-popover-foreground shadow-lg"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
          {description}
        </span>
      ) : null}
    </button>
  );
}

function clampPosition(value: number, limit: number) {
  return Math.max(0, Math.min(Math.max(0, limit), value));
}

function clampPreviewOffset(value: number, limit: number) {
  const next = Math.trunc(value) || 0;
  const max = Math.max(0, Math.trunc(limit) || 0);
  return Math.max(-max, Math.min(max, next));
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
