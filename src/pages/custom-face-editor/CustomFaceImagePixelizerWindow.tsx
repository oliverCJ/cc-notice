import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Info, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RangeStepperField } from './RangeStepperField';
import {
  applyCustomFaceImageImport,
  closeCustomFaceImagePixelizer,
  pixelizeCustomFaceGifSource,
  pixelizeCustomFaceImageSource,
  prepareCustomFaceGifPixelizerSource,
  prepareCustomFaceImagePixelizerSource,
  releaseCustomFaceImagePixelizerSource,
} from '@/api/tauriApi';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';
import {
  defaultPixelizerOptions,
  normalizePixelizerOptions,
  type ImagePixelizerOptions,
} from './imagePixelizerOptions';
import {
  TEXT_PIXELIZER_FONT_PRESETS,
  defaultTextPixelizerOptions,
  estimateTextPixelizerLimits,
  normalizeTextPixelizerOptions,
  truncateTextToPixelizerHardLimit,
  type TextPixelizerAlign,
  type TextPixelizerFontFamily,
  type TextPixelizerFontWeight,
  type TextPixelizerOptions,
} from './textPixelizerOptions';
import { renderTextPixelizerSource } from './textSourceRenderer';
import { CustomFaceViewport } from './CustomFaceViewport';
import type { CanvasGuide } from './CustomFaceRulers';
import { useI18n } from '@/i18n';
import { CUSTOM_FACE_CONTRACT } from '@/domain/customFaces/generated/customFaceContract.generated';
import type { CustomFaceGifPixelizeResult } from '@/api/tauriApi';
import type { GifImportPlacement } from './gifImportModel';
import {
  buildSelectedGifFrames,
  initializeGifFrameSelection,
  restoreAllGifFrames,
  sampleFramesByTimeline,
  selectionFromFrameIds,
  toggleGifFrameSelection,
  truncateFrames,
  type GifDurationPolicy,
  type GifFrameSelectionMode,
} from './gifImportModel';

type PixelizeResult = {
  packedPixels: number[];
  previewPixels: number[];
  contentMask: number[];
  sourceWidth: number;
  sourceHeight: number;
};

type CanvasSize = {
  width: number;
  height: number;
};

type SourceType = 'image' | 'text';
type ImportMode = 'image' | 'gif';

const CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT =
  'cc-notice://custom-face-image-pixelizer-open-request';
const SOURCE_PREVIEW_THUMB_SIZE = 96;
const SOURCE_PREVIEW_HOVER_SIZE = 192;
const PIXELIZE_OPTIONS_DEBOUNCE_MS = 180;

export function CustomFaceImagePixelizerWindow() {
  const t = useI18n();
  const [importMode, setImportMode] = useState<ImportMode>(() =>
    new URLSearchParams(window.location.search).get('mode') === 'gif' ? 'gif' : 'image'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const requestVersionRef = useRef(0);
  const sourceUrlRef = useRef<string | null>(null);
  const sourceIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const closingRef = useRef(false);
  const latestOptionsRef = useRef<ImagePixelizerOptions>(defaultPixelizerOptions());
  const objectDragRef = useRef<{
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const sourcePreviewDragRef = useRef<{
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const textPreviewUrlRef = useRef<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(() => canvasSizeFromLocation());
  const [displayScale, setDisplayScale] = useState(() =>
    displayScaleFor(canvasSize.width, canvasSize.height, 720, 540)
  );
  const [sourceType, setSourceType] = useState<SourceType>('image');
  const [options, setOptions] = useState<ImagePixelizerOptions>(() => defaultPixelizerOptions());
  const [pixelizeOptions, setPixelizeOptions] = useState<ImagePixelizerOptions>(() =>
    defaultPixelizerOptions()
  );
  const [textOptions, setTextOptions] = useState<TextPixelizerOptions>(() =>
    defaultTextPixelizerOptions()
  );
  const [textWarning, setTextWarning] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourcePreviewHovered, setSourcePreviewHovered] = useState(false);
  const [sourcePreviewPosition, setSourcePreviewPosition] = useState({ x: 8, y: 8 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PixelizeResult | null>(null);
  const [gifResult, setGifResult] = useState<CustomFaceGifPixelizeResult | null>(null);
  const [gifSourceMeta, setGifSourceMeta] = useState<{
    sourceWidth: number;
    sourceHeight: number;
    frameCount: number;
    totalDurationMs: number;
    durationWasClamped: boolean;
  } | null>(null);
  const [selectedGifFrame, setSelectedGifFrame] = useState(0);
  const [selectedProcessedGifFrame, setSelectedProcessedGifFrame] = useState(0);
  const [gifPlacement, setGifPlacement] = useState<GifImportPlacement>('replace');
  const [gifInsertionIndex, setGifInsertionIndex] = useState(
    () =>
      (parsePositiveInteger(new URL(window.location.href).searchParams.get('selectedFrameIndex')) ??
        0) + 1
  );
  const [gifFramePolicy, setGifFramePolicy] = useState<'sample' | 'truncate' | null>(null);
  const [gifFrameSelectionMode, setGifFrameSelectionMode] = useState<GifFrameSelectionMode>('keep');
  const [gifFrameSelection, setGifFrameSelection] = useState<boolean[]>([]);
  const [gifDurationPolicy, setGifDurationPolicy] =
    useState<GifDurationPolicy>('preserve-total-duration');
  const [gifPlaying, setGifPlaying] = useState(false);
  const [gifTransparencyMode, setGifTransparencyMode] = useState<'replace' | 'overlay'>('replace');
  const [gifApplyConfirmOpen, setGifApplyConfirmOpen] = useState(false);
  const maxGifFrames = maxFramesForCanvas(canvasSize);
  const [editorFrameCount, setEditorFrameCount] = useState(
    () => parsePositiveInteger(new URL(window.location.href).searchParams.get('frameCount')) ?? 1
  );
  const selectedGifFramesForApply = useMemo(
    () =>
      importMode === 'gif' && gifResult
        ? buildSelectedGifFrames(
            gifResult.frames.map((frame, index) => ({ id: String(index), ...frame })),
            gifFrameSelection,
            gifDurationPolicy
          )
        : undefined,
    [gifDurationPolicy, gifFrameSelection, gifResult, importMode]
  );
  const processedGifResult = useMemo(() => {
    if (!gifResult || !selectedGifFramesForApply) return null;
    return {
      ...gifResult,
      frames: selectedGifFramesForApply,
      totalDurationMs: selectedGifFramesForApply.reduce((sum, frame) => sum + frame.durationMs, 0),
    };
  }, [gifResult, selectedGifFramesForApply]);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    if (typeof currentWindow.setTitle !== 'function') return;
    void currentWindow
      .setTitle(importMode === 'gif' ? 'CC Notice GIF 导入' : 'CC Notice 图片导入')
      .catch((error) => console.warn('failed to update pixelizer window title', error));
  }, [importMode]);

  useEffect(() => {
    if (!gifPlaying || !processedGifResult || processedGifResult.frames.length <= 1) return;
    const frame = processedGifResult.frames[selectedProcessedGifFrame];
    const timer = window.setTimeout(
      () =>
        setSelectedProcessedGifFrame((current) =>
          current + 1 >= processedGifResult.frames.length ? 0 : current + 1
        ),
      Math.max(50, frame?.durationMs ?? 200)
    );
    return () => window.clearTimeout(timer);
  }, [gifPlaying, processedGifResult, selectedProcessedGifFrame]);

  useEffect(() => {
    if (!processedGifResult) return;
    if (selectedProcessedGifFrame >= processedGifResult.frames.length) {
      setSelectedProcessedGifFrame(Math.max(0, processedGifResult.frames.length - 1));
      return;
    }
    const frame = processedGifResult.frames[selectedProcessedGifFrame];
    if (!frame) return;
    setResult({
      packedPixels: frame.packedPixels,
      previewPixels: frame.previewPixels ?? [],
      contentMask: frame.contentMask ?? [],
      sourceWidth: processedGifResult.sourceWidth,
      sourceHeight: processedGifResult.sourceHeight,
    });
  }, [processedGifResult, selectedProcessedGifFrame]);

  const normalizedOptions = useMemo(() => normalizePixelizerOptions(options), [options]);
  const normalizedPixelizeOptions = useMemo(
    () => normalizePixelizerOptions(pixelizeOptions),
    [pixelizeOptions]
  );
  const normalizedTextOptions = useMemo(
    () => normalizeTextPixelizerOptions(textOptions),
    [textOptions]
  );
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
    setGifResult(null);
    setGifSourceMeta(null);
    setSelectedGifFrame(0);
    setSelectedProcessedGifFrame(0);
    setGifPlacement('replace');
    setGifInsertionIndex(0);
    setGifFramePolicy(null);
    setGifFrameSelectionMode('keep');
    setGifFrameSelection([]);
    setGifDurationPolicy('preserve-total-duration');
    setGifPlaying(false);
    setGifApplyConfirmOpen(false);
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
    if (textPreviewUrlRef.current) {
      URL.revokeObjectURL(textPreviewUrlRef.current);
      textPreviewUrlRef.current = null;
    }
  }, []);

  const syncTextWarning = useCallback(
    (nextTextOptions: TextPixelizerOptions) => {
      const nextLimits = estimateTextPixelizerLimits(canvasSize, nextTextOptions);
      const truncated = truncateTextToPixelizerHardLimit(nextTextOptions.text, nextLimits);
      setTextWarning(
        truncated.length < nextTextOptions.text.length
          ? t('customFaceEditor.imagePixelizer.textTruncatedWarning')
          : nextTextOptions.text.length > nextLimits.softLimit
            ? t('customFaceEditor.imagePixelizer.textTooLongWarning')
            : null
      );
      return { ...nextTextOptions, text: truncated };
    },
    [canvasSize, t]
  );

  const updateTextOptions = useCallback(
    (updater: (current: TextPixelizerOptions) => TextPixelizerOptions) => {
      setTextOptions((current) => syncTextWarning(updater(current)));
    },
    [syncTextWarning]
  );

  const updateCanvasSize = useCallback(
    (nextCanvasSize: CanvasSize) => {
      setCanvasSize((current) =>
        current.width === nextCanvasSize.width && current.height === nextCanvasSize.height
          ? current
          : nextCanvasSize
      );
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('width', String(nextCanvasSize.width));
      nextUrl.searchParams.set('height', String(nextCanvasSize.height));
      nextUrl.searchParams.set('mode', importMode);
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
      void releaseCurrentSource();
      resetWorkspace();
    },
    [importMode, releaseCurrentSource, resetWorkspace]
  );

  const loadImageFile = useCallback(
    async (file: File) => {
      const version = requestVersionRef.current + 1;
      requestVersionRef.current = version;
      try {
        await releaseCurrentSource();
        setError(null);
        setResult(null);
        setSelectedName(file.name || t('customFaceEditor.imagePixelizer.pastedImage'));
        setSourceId(null);
        setSourceType('image');
        setBusy(true);
        const nextUrl = createImagePreviewUrl(file);
        if (nextUrl) {
          if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
          sourceUrlRef.current = nextUrl;
          setSourceUrl(nextUrl);
        }
        const buffer = await readBlobAsArrayBuffer(file);
        const imageBytes = Array.from(new Uint8Array(buffer));
        const preparedSource =
          importMode === 'gif'
            ? await prepareCustomFaceGifPixelizerSource({
                profileWidth: canvasSize.width,
                profileHeight: canvasSize.height,
                imageBytes,
              })
            : await prepareCustomFaceImagePixelizerSource({
                profileWidth: canvasSize.width,
                profileHeight: canvasSize.height,
                imageBytes,
              });
        if (!mountedRef.current || requestVersionRef.current !== version) {
          await releaseCustomFaceImagePixelizerSource(preparedSource.sourceId);
          return;
        }
        sourceIdRef.current = preparedSource.sourceId;
        setSourceId(preparedSource.sourceId);
        if (importMode === 'gif') {
          const gifPrepared = preparedSource as Awaited<
            ReturnType<typeof prepareCustomFaceGifPixelizerSource>
          >;
          setGifSourceMeta({
            sourceWidth: gifPrepared.sourceWidth,
            sourceHeight: gifPrepared.sourceHeight,
            frameCount: gifPrepared.frameCount,
            totalDurationMs: gifPrepared.totalDurationMs,
            durationWasClamped: gifPrepared.durationWasClamped,
          });
          const initialMode = 'discard';
          setGifFrameSelection(initializeGifFrameSelection(gifPrepared.frameCount, initialMode));
          setGifFrameSelectionMode(initialMode);
          setGifFramePolicy(null);
        }
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
    },
    [canvasSize.height, canvasSize.width, importMode, releaseCurrentSource, t]
  );

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
    void getCurrentWindow()
      .onCloseRequested((event) => {
        if (closingRef.current) return;
        event.preventDefault();
        closingRef.current = true;
        void closeCustomFaceImagePixelizer().catch((error) => {
          closingRef.current = false;
          console.warn('failed to close custom face image pixelizer', error);
        });
      })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((error) =>
        console.warn('failed to register custom face image pixelizer close handler', error)
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<
      CanvasSize & { mode?: ImportMode; selectedFrameIndex?: number; frameCount?: number }
    >(CUSTOM_FACE_IMAGE_PIXELIZER_OPEN_REQUEST_EVENT, (event) => {
      if (disposed) return;
      const { width, height, mode } = event.payload;
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
        return;
      const nextEditorFrameCount =
        parsePositiveInteger(String(event.payload.frameCount ?? '')) ?? 1;
      setImportMode(mode === 'gif' ? 'gif' : 'image');
      setEditorFrameCount(nextEditorFrameCount);
      updateCanvasSize({ width, height });
      if (mode === 'gif') {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set(
          'selectedFrameIndex',
          String(event.payload.selectedFrameIndex ?? 0)
        );
        nextUrl.searchParams.set('frameCount', String(event.payload.frameCount ?? 0));
        window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
        setGifInsertionIndex(
          Math.min(nextEditorFrameCount, (event.payload.selectedFrameIndex ?? 0) + 1)
        );
      }
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('mode', mode === 'gif' ? 'gif' : 'image');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`);
    })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((error) =>
        console.warn(
          'failed to initialize custom face image pixelizer open request listener',
          error
        )
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [updateCanvasSize]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files?.[0];
      if (file?.type.startsWith('image/')) {
        if (
          importMode === 'gif' &&
          file.type !== 'image/gif' &&
          !file.name.toLowerCase().endsWith('.gif')
        ) {
          setError('GIF 导入窗口仅支持 GIF 文件');
          return;
        }
        event.preventDefault();
        void loadImageFile(file);
        return;
      }
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;
      event.preventDefault();
      void releaseCurrentSource();
      resetWorkspace();
      setSourceType('text');
      setTextOptions((current) => syncTextWarning({ ...current, text }));
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [importMode, loadImageFile, releaseCurrentSource, resetWorkspace, syncTextWarning]);

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
      setPixelizeOptions((current) =>
        samePixelizerOptions(current, normalizedOptions) ? current : normalizedOptions
      );
      return;
    }
    if (objectDragRef.current) return;
    const timeout = window.setTimeout(() => {
      setPixelizeOptions((current) =>
        samePixelizerOptions(current, normalizedOptions) ? current : normalizedOptions
      );
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
    const pixelizeRequest = {
      sourceId,
      profileWidth: canvasSize.width,
      profileHeight: canvasSize.height,
      options: normalizedPixelizeOptions,
    };
    const pixelizePromise =
      importMode === 'gif'
        ? pixelizeCustomFaceGifSource(pixelizeRequest)
        : pixelizeCustomFaceImageSource(pixelizeRequest);
    void pixelizePromise
      .then((next) => {
        if (cancelled || requestVersionRef.current !== version) return;
        if (importMode === 'gif') {
          const gif = next as CustomFaceGifPixelizeResult;
          setGifResult(gif);
          const initialMode = 'discard';
          setGifFrameSelection(initializeGifFrameSelection(gif.frames.length, initialMode));
          setGifFrameSelectionMode(initialMode);
          setSelectedGifFrame((current) => Math.min(current, Math.max(0, gif.frames.length - 1)));
          setSelectedProcessedGifFrame(0);
          const first = gif.frames[0];
          setResult(
            first
              ? {
                  packedPixels: first.packedPixels,
                  previewPixels: first.previewPixels,
                  contentMask: first.contentMask ?? [],
                  sourceWidth: gif.sourceWidth,
                  sourceHeight: gif.sourceHeight,
                }
              : null
          );
        } else {
          const image = next as PixelizeResult;
          setGifResult(null);
          setResult(image);
        }
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
  }, [canvasSize.height, canvasSize.width, importMode, normalizedPixelizeOptions, sourceId]);

  useEffect(() => {
    if (sourceType !== 'text') return;
    const trimmedText = normalizedTextOptions.text.trim();
    if (!trimmedText) {
      void releaseCurrentSource();
      setResult(null);
      setSelectedName(null);
      setSourceId(null);
      setSourceUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        sourceUrlRef.current = null;
        return null;
      });
      return;
    }
    let cancelled = false;
    const version = requestVersionRef.current + 1;
    requestVersionRef.current = version;
    setBusy(true);
    setError(null);
    const timeout = window.setTimeout(() => {
      void renderTextPixelizerSource(canvasSize, normalizedTextOptions)
        .then(async (rendered) => {
          if (!rendered) return null;
          if (textPreviewUrlRef.current && textPreviewUrlRef.current !== rendered.previewUrl) {
            URL.revokeObjectURL(textPreviewUrlRef.current);
          }
          textPreviewUrlRef.current = rendered.previewUrl;
          const preparedSource = await prepareCustomFaceImagePixelizerSource({
            profileWidth: canvasSize.width,
            profileHeight: canvasSize.height,
            imageBytes: rendered.bytes,
          });
          return { rendered, preparedSource };
        })
        .then(async (prepared) => {
          if (!prepared) return;
          if (cancelled || !mountedRef.current || requestVersionRef.current !== version) {
            await releaseCustomFaceImagePixelizerSource(prepared.preparedSource.sourceId);
            if (textPreviewUrlRef.current === prepared.rendered.previewUrl) {
              URL.revokeObjectURL(prepared.rendered.previewUrl);
              textPreviewUrlRef.current = null;
            }
            return;
          }
          const previousSourceId = sourceIdRef.current;
          sourceIdRef.current = prepared.preparedSource.sourceId;
          setSourceId(prepared.preparedSource.sourceId);
          setSelectedName(t('customFaceEditor.imagePixelizer.sourceText'));
          setSourceUrl((current) => {
            if (current) URL.revokeObjectURL(current);
            sourceUrlRef.current = prepared.rendered.previewUrl;
            return prepared.rendered.previewUrl;
          });
          if (previousSourceId) await releaseCustomFaceImagePixelizerSource(previousSourceId);
        })
        .catch((caught) => {
          if (cancelled || requestVersionRef.current !== version) return;
          setError(caught instanceof Error ? caught.message : String(caught));
          setResult(null);
          setSourceId(null);
        })
        .finally(() => {
          if (!cancelled && requestVersionRef.current === version) setBusy(false);
        });
    }, PIXELIZE_OPTIONS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      if (requestVersionRef.current === version) requestVersionRef.current += 1;
    };
  }, [
    canvasSize.height,
    canvasSize.width,
    normalizedTextOptions,
    releaseCurrentSource,
    sourceType,
    t,
  ]);

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const clearWorkspace = async () => {
    const currentSourceId = sourceIdRef.current;
    if (sourceType === 'text') {
      setTextOptions(defaultTextPixelizerOptions());
      setTextWarning(null);
    }
    resetWorkspace();
    if (currentSourceId) {
      try {
        await releaseCustomFaceImagePixelizerSource(currentSourceId);
      } catch (caught) {
        console.warn('failed to release custom face image pixelizer source', caught);
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await loadImageFile(file);
  };

  const handleApply = async () => {
    if (!result || busy) return;
    const selectedGifFrames = selectedGifFramesForApply;
    if (importMode === 'gif' && selectedGifFrames && selectedGifFrames.length === 0) {
      setError('至少保留一帧 GIF 帧后才能应用');
      return;
    }
    if (importMode === 'gif' && selectedGifFrames && selectedGifFrames.length > maxGifFrames) {
      setError(
        `当前保留 ${selectedGifFrames.length} 帧，当前分辨率最多支持 ${maxGifFrames} 帧，请先减少保留帧数`
      );
      return;
    }
    if (importMode === 'gif' && !gifApplyConfirmOpen) {
      setGifApplyConfirmOpen(true);
      return;
    }
    const framesToApply = selectedGifFrames;
    try {
      await applyCustomFaceImageImport({
        packedPixels: result.packedPixels,
        sourceWidth: canvasSize.width,
        sourceHeight: canvasSize.height,
        frames: framesToApply
          ? framesToApply.map((frame) => ({
              durationMs: frame.durationMs,
              packedPixels: frame.packedPixels,
            }))
          : undefined,
        placement: importMode === 'gif' ? gifPlacement : undefined,
        insertionIndex:
          importMode === 'gif' && gifPlacement === 'insert' ? gifInsertionIndex : undefined,
        transparencyMode: importMode === 'gif' ? gifTransparencyMode : undefined,
        contentMasks:
          importMode === 'gif' && framesToApply
            ? framesToApply.map((frame) => frame.contentMask ?? [])
            : undefined,
      });
      await closeCustomFaceImagePixelizer();
      setGifApplyConfirmOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const handleDiscard = async () => {
    await releaseCurrentSource();
    await closeCustomFaceImagePixelizer();
  };

  const resetAllOptions = () => {
    setOptions(defaultPixelizerOptions());
    setTextOptions((current) => ({ ...defaultTextPixelizerOptions(), text: current.text }));
    setTextWarning(null);
  };
  const resetTransformOptions = () =>
    setOptions((current) => ({
      ...current,
      scale: defaultOptions.scale,
      rotationDeg: defaultOptions.rotationDeg,
      offsetX: defaultOptions.offsetX,
      offsetY: defaultOptions.offsetY,
    }));
  const centerTransformOptions = () =>
    setOptions((current) => ({
      ...current,
      offsetX: 0,
      offsetY: 0,
    }));
  const resetToneOptions = () =>
    setOptions((current) => ({
      ...current,
      threshold: defaultOptions.threshold,
      alphaThreshold: defaultOptions.alphaThreshold,
      contrast: defaultOptions.contrast,
      brightness: defaultOptions.brightness,
      invert: defaultOptions.invert,
      backgroundInvert: defaultOptions.backgroundInvert,
      dither: defaultOptions.dither,
    }));
  const resetPaletteOptions = () =>
    setOptions((current) => ({
      ...current,
      mode: sourceType === 'text' ? 'mono' : defaultOptions.mode,
      colorCount: defaultOptions.colorCount,
    }));
  const resetPixelizerOption = <K extends keyof ImagePixelizerOptions>(key: K) =>
    setOptions((current) => ({
      ...current,
      [key]: defaultOptions[key],
    }));
  const resetTextPixelizerOption = <K extends keyof TextPixelizerOptions>(key: K) =>
    updateTextOptions((current) => ({
      ...current,
      [key]: defaultTextPixelizerOptions()[key],
    }));
  const resetTextLayoutOptions = () =>
    setTextOptions((current) => ({
      ...defaultTextPixelizerOptions(),
      text: current.text,
    }));

  const switchSourceType = (nextSourceType: SourceType) => {
    if (importMode === 'gif') return;
    if (nextSourceType === sourceType) return;
    void releaseCurrentSource();
    resetWorkspace();
    setSourceType(nextSourceType);
    if (nextSourceType === 'text') {
      setOptions((current) => ({ ...current, mode: 'mono' }));
    }
    setTextWarning(null);
  };

  const beginObjectDrag = (event: PointerEvent<HTMLDivElement>) => {
    objectDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: normalizedOptions.offsetX,
      offsetY: normalizedOptions.offsetY,
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
      offsetY: Math.round(drag.offsetY + (event.clientY - drag.clientY) / displayScale),
    };
    latestOptionsRef.current = normalizePixelizerOptions(nextOptions);
    setOptions((current) => ({
      ...current,
      offsetX: nextOptions.offsetX,
      offsetY: nextOptions.offsetY,
    }));
  };
  const endObjectDrag = (event: PointerEvent<HTMLDivElement>) => {
    objectDragRef.current = null;
    setPixelizeOptions((current) =>
      samePixelizerOptions(current, latestOptionsRef.current) ? current : latestOptionsRef.current
    );
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const beginSourcePreviewDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    sourcePreviewDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: sourcePreviewPosition.x,
      y: sourcePreviewPosition.y,
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
      y: Math.max(0, Math.round(drag.y + event.clientY - drag.clientY)),
    });
  };

  const endSourcePreviewDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!sourcePreviewDragRef.current) return;
    event.stopPropagation();
    sourcePreviewDragRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const currentMode = sourceType === 'text' ? 'mono' : normalizedOptions.mode;

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="text-sm font-medium">
          {importMode === 'gif' ? 'GIF 动画导入' : t('customFaceEditor.imagePixelizer.title')}
        </h1>
        <span className="border border-primary bg-primary/10 px-2 py-1 text-xs text-primary">
          {t('customFaceEditor.imagePixelizer.canvasSize', {
            width: canvasSize.width,
            height: canvasSize.height,
          })}
        </span>
        {selectedName ? (
          <span className="text-xs text-muted-foreground">
            {t('customFaceEditor.imagePixelizer.selectedFile', { name: selectedName })}
          </span>
        ) : null}
        <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
          {currentMode === 'color'
            ? t('customFaceEditor.imagePixelizer.modeColor')
            : t('customFaceEditor.imagePixelizer.modeMono')}
        </span>
        {importMode === 'image' ? (
          <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
            {sourceType === 'text'
              ? t('customFaceEditor.imagePixelizer.sourceText')
              : t('customFaceEditor.imagePixelizer.sourceImage')}
          </span>
        ) : null}
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={handleChooseImage}
          >
            {importMode === 'gif' ? '选择 GIF' : t('customFaceEditor.imagePixelizer.selectImage')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={clearWorkspace}
          >
            {t('customFaceEditor.imagePixelizer.clear')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={resetAllOptions}
          >
            {t('customFaceEditor.imagePixelizer.resetAll')}
          </button>
          <button
            type="button"
            className="border border-primary px-3 py-2 text-sm disabled:opacity-50"
            disabled={!result || busy}
            onClick={() => void handleApply()}
          >
            {t('customFaceEditor.imagePixelizer.apply')}
          </button>
          <button
            type="button"
            className="border border-border px-3 py-2 text-sm"
            onClick={() => void handleDiscard()}
          >
            {t('customFaceEditor.imagePixelizer.discard')}
          </button>
        </div>
      </header>

      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {t('customFaceEditor.imagePixelizer.pasteHint')}
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
        data-testid="custom-face-image-pixelizer-layout"
        className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3"
      >
        <section
          ref={viewportRef}
          className="min-h-0 min-w-0 flex-1 overflow-hidden border border-border bg-background p-2"
        >
          <div
            data-testid="custom-face-image-pixelizer-viewport"
            className="h-full min-h-0 overflow-auto overscroll-contain"
          >
            <input
              ref={fileInputRef}
              data-testid="custom-face-image-input"
              accept={importMode === 'gif' ? '.gif,image/gif' : 'image/*'}
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
                  cursor: result && !busy ? 'move' : busy ? 'progress' : 'default',
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
                    ariaLabel={
                      importMode === 'gif'
                        ? `GIF 第 ${selectedProcessedGifFrame + 1} 帧预览`
                        : t('customFaceEditor.imagePixelizer.preview')
                    }
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
                    width: `${sourcePreviewHovered ? SOURCE_PREVIEW_HOVER_SIZE : SOURCE_PREVIEW_THUMB_SIZE}px`,
                    height: `${sourcePreviewHovered ? SOURCE_PREVIEW_HOVER_SIZE : SOURCE_PREVIEW_THUMB_SIZE}px`,
                    transform: `translate(${sourcePreviewPosition.x}px, ${sourcePreviewPosition.y}px)`,
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
                </div>
              ) : null}
            </div>
            {importMode === 'gif' && gifResult ? (
              <>
                <section className="mt-3 grid gap-1 border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
                  <span>
                    原始 GIF：{gifSourceMeta?.sourceWidth ?? gifResult.sourceWidth} ×{' '}
                    {gifSourceMeta?.sourceHeight ?? gifResult.sourceHeight}，原始帧数：
                    {gifSourceMeta?.frameCount ?? gifResult.frames.length}
                  </span>
                  <span>
                    原始总时长：{gifSourceMeta?.totalDurationMs ?? gifResult.totalDurationMs} ms；
                    目标画布：{canvasSize.width} × {canvasSize.height}
                  </span>
                  {gifSourceMeta?.durationWasClamped ? (
                    <span className="text-warning">
                      部分帧时长已限制到软件支持范围（50–5000 ms）
                    </span>
                  ) : null}
                  {gifResult.frames.length !==
                  (gifSourceMeta?.frameCount ?? gifResult.frames.length) ? (
                    <span className="text-warning">
                      当前预览已处理为 {gifResult.frames.length} 帧，应用时将使用当前处理结果
                    </span>
                  ) : null}
                </section>
                <GifImportTimeline
                  title="原始帧"
                  result={gifResult}
                  selectedIndex={selectedGifFrame}
                  frameSelection={gifFrameSelection}
                  selectionMode={gifFrameSelectionMode}
                  playing={gifResult.frames.length > maxGifFrames ? false : gifPlaying}
                  onTogglePlaying={
                    gifResult.frames.length > maxGifFrames
                      ? undefined
                      : () => setGifPlaying((current) => !current)
                  }
                  onSelect={(index) => {
                    if (gifResult.frames.length > maxGifFrames) {
                      setGifFrameSelection((current) => toggleGifFrameSelection(current, index));
                    } else {
                      setSelectedProcessedGifFrame(index);
                    }
                    setSelectedGifFrame(index);
                  }}
                />
                {processedGifResult && gifResult.frames.length > maxGifFrames ? (
                  <GifImportTimeline
                    title="处理后预览"
                    result={processedGifResult}
                    selectedIndex={selectedProcessedGifFrame}
                    frameSelection={processedGifResult.frames.map(() => true)}
                    selectionMode="discard"
                    playing={gifPlaying}
                    onTogglePlaying={() => setGifPlaying((current) => !current)}
                    onSelect={setSelectedProcessedGifFrame}
                    frameAriaPrefix="处理后 GIF"
                    previewOnly
                    showSourceFrame
                    onSourceFrameSelect={(sourceIndex) => setSelectedGifFrame(sourceIndex)}
                  />
                ) : null}
                {gifResult.frames.length > maxGifFrames ? (
                  <GifFramePolicySwitch
                    value={gifFramePolicy}
                    selectionMode={gifFrameSelectionMode}
                    durationPolicy={gifDurationPolicy}
                    selectedCount={gifFrameSelection.filter(Boolean).length}
                    maxFrames={maxGifFrames}
                    onSelectionModeChange={(mode) => {
                      setGifFrameSelectionMode(mode);
                      setGifFrameSelection(
                        initializeGifFrameSelection(gifResult.frames.length, mode)
                      );
                      setGifFramePolicy(null);
                    }}
                    onDurationPolicyChange={setGifDurationPolicy}
                    onRestoreAll={() => {
                      setGifFrameSelection(restoreAllGifFrames(gifResult.frames.length));
                      setGifFramePolicy(null);
                    }}
                    onChange={(policy) => {
                      setGifFramePolicy(policy);
                      const sourceFrames = gifResult.frames.map((frame, index) => ({
                        id: String(index),
                        ...frame,
                      }));
                      const nextFrames =
                        policy === 'sample'
                          ? sampleFramesByTimeline(sourceFrames, maxGifFrames)
                          : truncateFrames(sourceFrames, maxGifFrames);
                      setGifFrameSelection(
                        selectionFromFrameIds(
                          nextFrames.map((frame) => frame.id),
                          gifResult.frames.length
                        )
                      );
                      setGifFrameSelectionMode('keep');
                      setSelectedGifFrame(0);
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </section>

        <aside className="flex min-h-0 w-[22rem] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain border-l border-border pl-4 text-sm">
          {importMode === 'gif' && gifResult ? (
            <section
              data-testid="gif-application-options"
              className="grid gap-3 rounded border border-primary/40 bg-primary/5 p-3"
            >
              <div>
                <h2 className="text-sm font-medium">GIF 应用设置</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  以下选项只在点击顶部“应用”时生效。
                </p>
              </div>
              <GifImportPlacementSwitch value={gifPlacement} onChange={setGifPlacement} />
              {gifPlacement === 'insert' && editorFrameCount > 0 ? (
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">插入位置</span>
                  <Select
                    value={String(gifInsertionIndex)}
                    onValueChange={(value) => setGifInsertionIndex(Number(value))}
                  >
                    <SelectTrigger aria-label="GIF 插入位置" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: editorFrameCount + 1 }, (_, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {index === 0
                            ? '最前面'
                            : index === editorFrameCount
                              ? '最后面'
                              : `第 ${index} 帧之后`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              <GifTransparencySwitch
                value={gifTransparencyMode}
                onChange={setGifTransparencyMode}
              />
            </section>
          ) : null}
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {t('customFaceEditor.imagePixelizer.parameters')}
              </h2>
              {busy ? (
                <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
              ) : null}
            </div>

            <ParameterGroup
              title={t('customFaceEditor.imagePixelizer.paletteGroup')}
              onReset={resetPaletteOptions}
            >
              {importMode === 'image' ? (
                <ChoiceSwitch
                  hint={t('customFaceEditor.imagePixelizer.sourceHint')}
                  label={t('customFaceEditor.imagePixelizer.sourceGroup')}
                  value={sourceType}
                  onChange={(value) => switchSourceType(value as SourceType)}
                  options={[
                    { value: 'image', label: t('customFaceEditor.imagePixelizer.sourceImage') },
                    { value: 'text', label: t('customFaceEditor.imagePixelizer.sourceText') },
                  ]}
                />
              ) : null}
              <ModeSwitch
                hint={t('customFaceEditor.imagePixelizer.modeHint')}
                label={t('customFaceEditor.imagePixelizer.mode')}
                value={currentMode}
                onChange={(mode) =>
                  setOptions((current) => ({
                    ...current,
                    mode: sourceType === 'text' ? 'mono' : (mode as ImagePixelizerOptions['mode']),
                  }))
                }
                disabledValues={sourceType === 'text' ? ['color'] : []}
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
                defaultValue={defaultOptions.colorCount}
                onReset={() => resetPixelizerOption('colorCount')}
                onChange={(value) => setOptions((current) => ({ ...current, colorCount: value }))}
              />
            </ParameterGroup>

            {importMode === 'image' && sourceType === 'text' ? (
              <>
                <ParameterGroup
                  title={t('customFaceEditor.imagePixelizer.textGroup')}
                  onReset={() => {
                    setTextOptions((current) => {
                      const next = { ...current, text: '' };
                      setTextWarning(null);
                      return syncTextWarning(next);
                    });
                  }}
                >
                  <label className="grid gap-1 text-xs">
                    <span className="flex items-center gap-1">
                      {t('customFaceEditor.imagePixelizer.textContent')}
                      <HintTip text={t('customFaceEditor.imagePixelizer.textContentHint')} />
                    </span>
                    <textarea
                      aria-label={t('customFaceEditor.imagePixelizer.textContent')}
                      className="min-h-28 resize-y border border-border bg-background px-2 py-2 text-sm"
                      value={textOptions.text}
                      onChange={(event) =>
                        updateTextOptions((current) => ({ ...current, text: event.target.value }))
                      }
                    />
                  </label>
                  {textWarning ? <p className="text-xs text-warning">{textWarning}</p> : null}
                </ParameterGroup>
                <ParameterGroup
                  title={t('customFaceEditor.imagePixelizer.textLayoutGroup')}
                  onReset={resetTextLayoutOptions}
                >
                  <label className="grid gap-1 text-xs">
                    <span className="flex items-center gap-1">
                      {t('customFaceEditor.imagePixelizer.fontFamily')}
                      <HintTip text={t('customFaceEditor.imagePixelizer.fontFamilyHint')} />
                    </span>
                    <Select
                      value={textOptions.fontFamily}
                      onValueChange={(value) =>
                        updateTextOptions((current) => ({
                          ...current,
                          fontFamily: value as TextPixelizerFontFamily,
                        }))
                      }
                    >
                      <SelectTrigger aria-label={t('customFaceEditor.imagePixelizer.fontFamily')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEXT_PIXELIZER_FONT_PRESETS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {t(item.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <ChoiceSwitch
                    label={t('customFaceEditor.imagePixelizer.fontWeight')}
                    hint={t('customFaceEditor.imagePixelizer.fontWeightHint')}
                    value={textOptions.fontWeight}
                    options={[
                      {
                        value: 'normal',
                        label: t('customFaceEditor.imagePixelizer.fontWeightNormal'),
                      },
                      { value: 'bold', label: t('customFaceEditor.imagePixelizer.fontWeightBold') },
                    ]}
                    onChange={(value) =>
                      updateTextOptions((current) => ({
                        ...current,
                        fontWeight: value as TextPixelizerFontWeight,
                      }))
                    }
                  />
                  <ChoiceSwitch
                    label={t('customFaceEditor.imagePixelizer.textAlign')}
                    hint={t('customFaceEditor.imagePixelizer.textAlignHint')}
                    value={textOptions.align}
                    options={[
                      { value: 'left', label: t('customFaceEditor.imagePixelizer.alignLeft') },
                      { value: 'center', label: t('customFaceEditor.imagePixelizer.alignCenter') },
                      { value: 'right', label: t('customFaceEditor.imagePixelizer.alignRight') },
                    ]}
                    onChange={(value) =>
                      updateTextOptions((current) => ({
                        ...current,
                        align: value as TextPixelizerAlign,
                      }))
                    }
                  />
                  <RangeField
                    id="text-pixelizer-font-size"
                    label={t('customFaceEditor.imagePixelizer.fontSize')}
                    hint={t('customFaceEditor.imagePixelizer.fontSizeHint')}
                    min={8}
                    max={128}
                    step={1}
                    value={textOptions.fontSize}
                    defaultValue={defaultTextPixelizerOptions().fontSize}
                    onReset={() => resetTextPixelizerOption('fontSize')}
                    onChange={(value) =>
                      updateTextOptions((current) => ({ ...current, fontSize: value }))
                    }
                  />
                  <RangeField
                    id="text-pixelizer-letter-spacing"
                    label={t('customFaceEditor.imagePixelizer.letterSpacing')}
                    hint={t('customFaceEditor.imagePixelizer.letterSpacingHint')}
                    min={-0.25}
                    max={1}
                    step={0.05}
                    value={textOptions.letterSpacingEm}
                    defaultValue={defaultTextPixelizerOptions().letterSpacingEm}
                    onReset={() => resetTextPixelizerOption('letterSpacingEm')}
                    onChange={(value) =>
                      updateTextOptions((current) => ({ ...current, letterSpacingEm: value }))
                    }
                  />
                  <RangeField
                    id="text-pixelizer-line-height"
                    label={t('customFaceEditor.imagePixelizer.lineHeight')}
                    hint={t('customFaceEditor.imagePixelizer.lineHeightHint')}
                    min={0.8}
                    max={2}
                    step={0.05}
                    value={textOptions.lineHeight}
                    defaultValue={defaultTextPixelizerOptions().lineHeight}
                    onReset={() => resetTextPixelizerOption('lineHeight')}
                    onChange={(value) =>
                      updateTextOptions((current) => ({ ...current, lineHeight: value }))
                    }
                  />
                  <RangeField
                    id="text-pixelizer-padding"
                    label={t('customFaceEditor.imagePixelizer.textPadding')}
                    hint={t('customFaceEditor.imagePixelizer.textPaddingHint')}
                    min={0}
                    max={64}
                    step={1}
                    value={textOptions.padding}
                    defaultValue={defaultTextPixelizerOptions().padding}
                    onReset={() => resetTextPixelizerOption('padding')}
                    onChange={(value) =>
                      updateTextOptions((current) => ({ ...current, padding: value }))
                    }
                  />
                  <label className="flex items-center justify-between border border-border px-2 py-2 text-xs">
                    <span className="flex items-center gap-1">
                      <span>{t('customFaceEditor.imagePixelizer.textWrap')}</span>
                      <HintTip text={t('customFaceEditor.imagePixelizer.textWrapHint')} />
                    </span>
                    <input
                      aria-label={t('customFaceEditor.imagePixelizer.textWrap')}
                      checked={textOptions.wrap}
                      type="checkbox"
                      onChange={(event) =>
                        updateTextOptions((current) => ({ ...current, wrap: event.target.checked }))
                      }
                    />
                  </label>
                </ParameterGroup>
              </>
            ) : null}

            <ParameterGroup
              title={t('customFaceEditor.imagePixelizer.transformGroup')}
              onReset={resetTransformOptions}
            >
              <RangeField
                id="image-pixelizer-scale"
                label={t('customFaceEditor.imagePixelizer.scale')}
                hint={t('customFaceEditor.imagePixelizer.scaleHint')}
                min={0.1}
                max={4}
                step={0.05}
                value={options.scale}
                defaultValue={defaultOptions.scale}
                onReset={() => resetPixelizerOption('scale')}
                onChange={(value) => setOptions((current) => ({ ...current, scale: value }))}
              />
              <RangeField
                id="image-pixelizer-rotation"
                label={t('customFaceEditor.imagePixelizer.rotation')}
                hint={t('customFaceEditor.imagePixelizer.rotationHint')}
                min={-180}
                max={180}
                step={1}
                value={options.rotationDeg}
                defaultValue={defaultOptions.rotationDeg}
                onReset={() => resetPixelizerOption('rotationDeg')}
                onChange={(value) => setOptions((current) => ({ ...current, rotationDeg: value }))}
              />
              <RangeField
                id="image-pixelizer-offset-x"
                label={t('customFaceEditor.imagePixelizer.offsetX')}
                hint={t('customFaceEditor.imagePixelizer.offsetXHint')}
                min={-canvasSize.width}
                max={canvasSize.width}
                step={1}
                value={options.offsetX}
                defaultValue={defaultOptions.offsetX}
                onReset={() => resetPixelizerOption('offsetX')}
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
                defaultValue={defaultOptions.offsetY}
                onReset={() => resetPixelizerOption('offsetY')}
                onChange={(value) => setOptions((current) => ({ ...current, offsetY: value }))}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border border-border px-2 py-1 text-xs"
                  onClick={centerTransformOptions}
                >
                  {t('customFaceEditor.imagePixelizer.center')}
                </button>
              </div>
            </ParameterGroup>

            <ParameterGroup
              title={t('customFaceEditor.imagePixelizer.toneGroup')}
              onReset={resetToneOptions}
            >
              <RangeField
                id="image-pixelizer-threshold"
                label={t('customFaceEditor.imagePixelizer.threshold')}
                hint={t('customFaceEditor.imagePixelizer.thresholdHint')}
                min={0}
                max={255}
                step={1}
                value={options.threshold}
                defaultValue={defaultOptions.threshold}
                onReset={() => resetPixelizerOption('threshold')}
                onChange={(value) => setOptions((current) => ({ ...current, threshold: value }))}
              />

              <RangeField
                id="image-pixelizer-alpha-threshold"
                label={t('customFaceEditor.imagePixelizer.alphaThreshold')}
                hint={t('customFaceEditor.imagePixelizer.alphaThresholdHint')}
                min={0}
                max={255}
                step={1}
                value={options.alphaThreshold}
                defaultValue={defaultOptions.alphaThreshold}
                onReset={() => resetPixelizerOption('alphaThreshold')}
                onChange={(value) =>
                  setOptions((current) => ({ ...current, alphaThreshold: value }))
                }
              />

              <RangeField
                id="image-pixelizer-contrast"
                label={t('customFaceEditor.imagePixelizer.contrast')}
                hint={t('customFaceEditor.imagePixelizer.contrastHint')}
                min={-100}
                max={100}
                step={1}
                value={options.contrast}
                defaultValue={defaultOptions.contrast}
                onReset={() => resetPixelizerOption('contrast')}
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
                defaultValue={defaultOptions.brightness}
                onReset={() => resetPixelizerOption('brightness')}
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

              <ToggleField
                label={t('customFaceEditor.imagePixelizer.backgroundInvert')}
                hint={t('customFaceEditor.imagePixelizer.backgroundInvertHint')}
                checked={options.backgroundInvert}
                onChange={(checked) =>
                  setOptions((current) => ({ ...current, backgroundInvert: checked }))
                }
              />
            </ParameterGroup>
          </section>

          <section className="rounded border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>{t('customFaceEditor.imagePixelizer.outputInfo')}</span>
              <span>
                {result
                  ? t('customFaceEditor.imagePixelizer.outputReady')
                  : t('customFaceEditor.imagePixelizer.outputPending')}
              </span>
            </div>
            {result ? (
              <div className="mt-2 grid gap-1">
                <span>
                  {t('customFaceEditor.imagePixelizer.sourceSize', {
                    width: result.sourceWidth,
                    height: result.sourceHeight,
                  })}
                </span>
                <span>
                  {t('customFaceEditor.imagePixelizer.previewMode', {
                    mode:
                      currentMode === 'color'
                        ? t('customFaceEditor.imagePixelizer.modeColor')
                        : t('customFaceEditor.imagePixelizer.modeMono'),
                  })}
                </span>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
      {gifApplyConfirmOpen && gifResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="确认应用 GIF"
            className="w-full max-w-md border border-border bg-background p-4 shadow-xl"
          >
            <h2 className="text-sm font-medium">确认应用 GIF 动画</h2>
            <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
              <span>
                目标画布：{canvasSize.width} × {canvasSize.height}
              </span>
              <span>
                应用方式：
                {gifPlacement === 'replace' ? '替换' : gifPlacement === 'insert' ? '插入' : '追加'}
              </span>
              <span>
                帧数：{selectedGifFramesForApply?.length ?? gifResult.frames.length}，总时长：
                {selectedGifFramesForApply?.reduce((sum, frame) => sum + frame.durationMs, 0) ??
                  gifResult.totalDurationMs}{' '}
                ms
              </span>
              <span>
                透明像素：{gifTransparencyMode === 'replace' ? '熄灭' : '保留当前画布内容'}
              </span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="border border-border px-3 py-2 text-sm"
                onClick={() => setGifApplyConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="border border-primary bg-primary/10 px-3 py-2 text-sm"
                onClick={() => void handleApply()}
              >
                确认应用
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
  options,
  disabledValues = [],
}: {
  hint: string;
  label: string;
  value: string;
  onChange: (mode: string) => void;
  options?: Array<{ value: string; label: string }>;
  disabledValues?: string[];
}) {
  const t = useI18n();
  const items = options ?? [
    { value: 'mono', label: t('customFaceEditor.imagePixelizer.modeMono') },
    { value: 'color', label: t('customFaceEditor.imagePixelizer.modeColor') },
  ];
  return (
    <div className="grid gap-1 text-xs">
      <span className="flex items-center gap-1">
        <span>{label}</span>
        <HintTip text={hint} />
      </span>
      <div className={`grid gap-2 ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {items.map((item) => {
          const disabled = disabledValues.includes(item.value);
          return (
            <button
              key={item.value}
              type="button"
              className={`border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${value === item.value ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
              disabled={disabled}
              onClick={() => {
                if (!disabled) onChange(item.value);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceSwitch(props: {
  hint: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return <ModeSwitch {...props} />;
}

function RangeField({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  defaultValue,
  disabled = false,
  onReset,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue?: number;
  disabled?: boolean;
  onReset?: () => void;
  onChange: (value: number) => void;
}) {
  const t = useI18n();
  return (
    <div id={id} className={`grid gap-1 text-xs ${disabled ? 'opacity-60' : ''}`}>
      <RangeStepperField
        ariaLabel={label}
        decreaseLabel={t('customFaceEditor.svgImport.decrease', { field: label })}
        description={hint}
        increaseLabel={t('customFaceEditor.svgImport.increase', { field: label })}
        label={label}
        max={max}
        min={min}
        step={step}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        resetLabel={t('customFaceEditor.imagePixelizer.resetGroup', { group: label })}
        onReset={onReset}
        onChange={onChange}
      />
    </div>
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
      <input
        aria-label={label}
        checked={checked}
        type="checkbox"
        onClick={(event) => onChange(event.currentTarget.checked)}
        onChange={() => undefined}
      />
    </label>
  );
}

function HintTip({ text }: { text: string }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  return (
    <button
      type="button"
      className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground"
      aria-label={`${text} 说明`}
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

function samePixelizerOptions(left: ImagePixelizerOptions, right: ImagePixelizerOptions) {
  return (
    left.mode === right.mode &&
    left.colorCount === right.colorCount &&
    left.dither === right.dither &&
    left.invert === right.invert &&
    left.backgroundInvert === right.backgroundInvert &&
    left.threshold === right.threshold &&
    left.alphaThreshold === right.alphaThreshold &&
    left.contrast === right.contrast &&
    left.brightness === right.brightness &&
    left.scale === right.scale &&
    left.rotationDeg === right.rotationDeg &&
    left.offsetX === right.offsetX &&
    left.offsetY === right.offsetY
  );
}

function GifImportTimeline({
  title,
  result,
  selectedIndex,
  frameSelection,
  selectionMode,
  playing,
  onTogglePlaying,
  onSelect,
  frameAriaPrefix = 'GIF',
  previewOnly = false,
  showSourceFrame = false,
  onSourceFrameSelect,
}: {
  title: string;
  result: Omit<CustomFaceGifPixelizeResult, 'frames'> & {
    frames: Array<{
      durationMs: number;
      packedPixels: number[];
      previewPixels?: number[];
      contentMask?: number[];
      id?: string;
    }>;
  };
  selectedIndex: number;
  frameSelection: readonly boolean[];
  selectionMode: GifFrameSelectionMode;
  playing: boolean;
  onTogglePlaying?: () => void;
  onSelect: (index: number) => void;
  frameAriaPrefix?: string;
  previewOnly?: boolean;
  showSourceFrame?: boolean;
  onSourceFrameSelect?: (sourceIndex: number) => void;
}) {
  return (
    <section
      data-testid="gif-import-timeline"
      className="mt-3 border border-border bg-muted/20 p-2"
    >
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {title} · {result.frames.length} 帧
        </span>
        <div className="flex items-center gap-2">
          <span>总时长 {result.totalDurationMs} ms</span>
          {onTogglePlaying ? (
            <button
              type="button"
              className="border border-border px-2 py-1"
              disabled={result.frames.length === 0}
              onClick={onTogglePlaying}
            >
              {playing ? '暂停' : '播放'}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {result.frames.map((frame, index) => (
          <button
            key={`gif-frame-${index}`}
            type="button"
            aria-label={`${frameAriaPrefix} 第 ${index + 1} 帧`}
            className={`shrink-0 border p-1 ${
              index === selectedIndex ? 'border-primary' : 'border-border'
            } ${frameSelection[index] === false ? 'opacity-40 grayscale' : ''}`}
            aria-pressed={frameSelection[index] !== false}
            title={
              previewOnly
                ? '点击预览处理后帧'
                : frameSelection[index] === false
                  ? '当前帧已丢弃，点击恢复'
                  : selectionMode === 'keep'
                    ? '点击取消保留'
                    : '点击标记为丢弃'
            }
            onClick={() => {
              if (showSourceFrame && frame.id !== undefined) {
                const sourceIndex = Number(frame.id);
                if (Number.isInteger(sourceIndex) && sourceIndex >= 0) {
                  onSourceFrameSelect?.(sourceIndex);
                }
              }
              onSelect(index);
            }}
          >
            <CustomFacePixelPreview
              width={result.width}
              height={result.height}
              packedPixels={frame.packedPixels}
              rgbaPixels={frame.previewPixels}
              ariaLabel={`${frameAriaPrefix} 第 ${index + 1} 帧预览`}
              displayScale={0.5}
              className="mb-1 h-12 w-16"
            />
            <span className="block text-[10px] text-muted-foreground">{index + 1}</span>
            {showSourceFrame && frame.id !== undefined ? (
              <span className="block text-[10px] text-primary">
                原始第 {Number(frame.id) + 1} 帧
              </span>
            ) : null}
            <span className="block text-[10px] text-muted-foreground">{frame.durationMs} ms</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GifImportPlacementSwitch({
  value,
  onChange,
}: {
  value: GifImportPlacement;
  onChange: (value: GifImportPlacement) => void;
}) {
  return (
    <div
      data-testid="gif-placement-switch"
      className="flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border px-1 text-xs"
    >
      <span className="text-muted-foreground">应用方式</span>
      <div className="flex items-center gap-1">
        {(
          [
            ['replace', '替换'],
            ['insert', '插入'],
            ['append', '追加'],
          ] as const
        ).map(([item, label]) => (
          <button
            key={item}
            type="button"
            aria-pressed={value === item}
            className={`h-7 border px-2 ${value === item ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
            onClick={() => onChange(item)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GifTransparencySwitch({
  value,
  onChange,
}: {
  value: 'replace' | 'overlay';
  onChange: (value: 'replace' | 'overlay') => void;
}) {
  return (
    <div data-testid="gif-transparency-switch" className="grid gap-2 text-xs">
      <span className="whitespace-nowrap text-muted-foreground">透明像素处理</span>
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ['replace', '透明处覆盖为空'],
            ['overlay', '透明处保留当前帧'],
          ] as const
        ).map(([item, label]) => (
          <button
            key={item}
            type="button"
            aria-pressed={value === item}
            className={`h-7 border px-2 whitespace-nowrap ${value === item ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
            onClick={() => onChange(item)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        当前选择：{value === 'replace' ? '透明区域应用后覆盖为空' : '透明区域应用后保留当前帧内容'}
      </p>
      <p className="text-[11px] text-muted-foreground">
        该设置只在点击应用时生效，不影响上方“透明背景点亮”的像素化预览结果。
      </p>
    </div>
  );
}

function GifFramePolicySwitch({
  value,
  onChange,
  selectionMode,
  durationPolicy,
  selectedCount,
  maxFrames,
  onSelectionModeChange,
  onDurationPolicyChange,
  onRestoreAll,
}: {
  value: 'sample' | 'truncate' | null;
  onChange: (value: 'sample' | 'truncate') => void;
  maxFrames: number;
  selectionMode: GifFrameSelectionMode;
  durationPolicy: GifDurationPolicy;
  selectedCount: number;
  onSelectionModeChange: (value: GifFrameSelectionMode) => void;
  onDurationPolicyChange: (value: GifDurationPolicy) => void;
  onRestoreAll: () => void;
}) {
  return (
    <fieldset data-testid="gif-frame-policy" className="mt-2 grid min-w-0 gap-2 text-xs">
      <legend className="sr-only">GIF 帧数处理方式</legend>
      <p className="block w-full min-w-0 text-muted-foreground leading-5">
        帧数超过 {maxFrames} 帧，请选择处理方式
      </p>
      <div className="flex min-w-0 flex-wrap gap-1">
        <button
          type="button"
          className={`shrink-0 border px-2 py-1 ${value === 'sample' ? 'border-primary' : 'border-border'}`}
          onClick={() => onChange('sample')}
        >
          抽帧（保留时长）
        </button>
        <button
          type="button"
          className={`shrink-0 border px-2 py-1 ${value === 'truncate' ? 'border-primary' : 'border-border'}`}
          onClick={() => onChange('truncate')}
        >
          截帧（保留前段）
        </button>
        <button
          type="button"
          className={`shrink-0 border px-2 py-1 ${value === null && selectionMode === 'keep' ? 'border-primary' : 'border-border'}`}
          onClick={() => onSelectionModeChange('keep')}
        >
          手动选择
        </button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="text-muted-foreground">手动模式</span>
        <button
          type="button"
          className={`border px-2 py-1 ${selectionMode === 'keep' ? 'border-primary' : 'border-border'}`}
          onClick={() => onSelectionModeChange('keep')}
        >
          正向选择（保留）
        </button>
        <button
          type="button"
          className={`border px-2 py-1 ${selectionMode === 'discard' ? 'border-primary' : 'border-border'}`}
          onClick={() => onSelectionModeChange('discard')}
        >
          反向选择（丢弃）
        </button>
        <button type="button" className="border border-border px-2 py-1" onClick={onRestoreAll}>
          恢复全部
        </button>
        <span className="text-muted-foreground">
          已保留 {selectedCount} / {maxFrames} 帧
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="text-muted-foreground">时长</span>
        <button
          type="button"
          className={`border px-2 py-1 ${durationPolicy === 'preserve-total-duration' ? 'border-primary' : 'border-border'}`}
          onClick={() => onDurationPolicyChange('preserve-total-duration')}
        >
          保持原动画总时长
        </button>
        <button
          type="button"
          className={`border px-2 py-1 ${durationPolicy === 'preserve-frame-duration' ? 'border-primary' : 'border-border'}`}
          onClick={() => onDurationPolicyChange('preserve-frame-duration')}
        >
          仅保留帧原时长
        </button>
      </div>
    </fieldset>
  );
}

function nextSelectedFrameIndex(current: number, availableIndexes: readonly number[]) {
  const next = availableIndexes.find((index) => index > current);
  return next ?? availableIndexes[0] ?? current;
}

function maxFramesForCanvas(canvasSize: CanvasSize) {
  const profile = CUSTOM_FACE_CONTRACT.profiles.find(
    (item) => item.width === canvasSize.width && item.height === canvasSize.height
  );
  if (profile) return profile.maxFrames;
  const area = canvasSize.width * canvasSize.height;
  if (area <= 8192) return 20;
  if (area <= 76800) return 10;
  return 5;
}
