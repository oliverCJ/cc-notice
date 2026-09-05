import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  drawEllipse,
  drawLine,
  drawPolygon,
  drawRectangle,
  drawTriangle,
  getPixel,
} from '@/domain/customFaces/editor/raster';
import type { SelectionShape, ToolId } from '@/domain/customFaces/editor/types';
import type { CanvasGuide } from './CustomFaceRulers';
import {
  CustomFaceViewport,
  logicalPointFromClientPoint,
  magnifierViewport,
  moveMagnifierViewportOrigin,
  type LogicalViewport,
} from './CustomFaceViewport';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';
import { CustomFaceMagnifier } from './CustomFaceMagnifier';

type Point = [number, number];
export type CanvasSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: SelectionShape;
};
export type CanvasToolState = {
  pointer: Point | null;
  start: Point | null;
  end: Point | null;
  bounds: CanvasSelection | null;
  penPointCount: number;
};

type Props = {
  width: number;
  height: number;
  pixels: Uint8Array;
  onionPixels?: Uint8Array;
  selection?: CanvasSelection | null;
  selectionOrigin?: CanvasSelection | null;
  selectionPivot?: { x: number; y: number } | null;
  pickingSelectionPivot?: boolean;
  selectedTool: ToolId;
  selectionShape?: SelectionShape;
  eraserSize?: number;
  constraintEnabled?: boolean;
  rectangleFilled?: boolean;
  disabled?: boolean;
  penCommand?: { id: number; type: 'finish' | 'cancel' } | null;
  guides?: CanvasGuide[];
  onPixelTransaction: (pixels: Array<{ x: number; y: number; active: boolean }>) => void;
  onSelectionChange?: (selection: CanvasSelection | null) => void;
  onSelectionPivotChange?: (pivot: { x: number; y: number }) => void;
  onToolStateChange?: (state: CanvasToolState) => void;
  onGuidesChange?: (guides: CanvasGuide[]) => void;
  pendingImportPixels?: number[] | null;
  pendingImportSize?: { width: number; height: number };
  pendingImportOffset?: { x: number; y: number };
  onPendingImportMove?: (dx: number, dy: number) => void;
};

const DRAW_COLOR = '#d7ff70';
const PREVIEW_STROKE = '#67e8f9';
const PREVIEW_HALO = 'rgba(8, 15, 20, 0.9)';
const SELECTION_STROKE = '#facc15';
const MAGNIFIER_SCALE = 16;
const MAGNIFIER_MAX_WIDTH = 16;
const MAGNIFIER_MAX_HEIGHT = 12;

export function CustomFaceCanvas({
  width,
  height,
  pixels,
  onionPixels,
  selection,
  selectionOrigin,
  selectionPivot = null,
  pickingSelectionPivot = false,
  selectedTool,
  selectionShape = 'rectangle',
  eraserSize = 3,
  constraintEnabled = false,
  rectangleFilled = false,
  disabled = false,
  penCommand,
  guides = [],
  onPixelTransaction,
  onSelectionChange,
  onSelectionPivotChange,
  onToolStateChange,
  onGuidesChange = () => undefined,
  pendingImportPixels = null,
  pendingImportSize = { width, height },
  pendingImportOffset = { x: 0, y: 0 },
  onPendingImportMove = () => undefined,
}: Props) {
  const t = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const eraserChangesRef = useRef(new Map<string, { x: number; y: number; active: false }>());
  const drawingRef = useRef(false);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [penPoints, setPenPoints] = useState<Point[]>([]);
  const [displayScale, setDisplayScale] = useState(1);
  const [magnifierOpen, setMagnifierOpen] = useState(true);
  const [magnifierMode, setMagnifierMode] = useState<'follow' | 'locked'>('follow');
  const [magnifierCenter, setMagnifierCenter] = useState<Point>([
    Math.floor(width / 2),
    Math.floor(height / 2),
  ]);
  const [pointerSurface, setPointerSurface] = useState<'main' | 'magnifier' | null>(null);

  const previewEnd = useMemo(
    () =>
      start && end
        ? clampPoint(constrainEnd(start, end, selectedTool, constraintEnabled), width, height)
        : end,
    [constraintEnabled, end, height, selectedTool, start, width]
  );
  const bounds = useMemo(
    () =>
      start && previewEnd ? boundsForTool(start, previewEnd, selectedTool, selectionShape) : null,
    [previewEnd, selectedTool, selectionShape, start]
  );
  const magnifier = useMemo(
    () =>
      magnifierViewport(magnifierCenter, width, height, MAGNIFIER_MAX_WIDTH, MAGNIFIER_MAX_HEIGHT),
    [height, magnifierCenter, width]
  );

  useEffect(() => {
    onToolStateChange?.({
      pointer,
      start,
      end: previewEnd,
      bounds,
      penPointCount: penPoints.length,
    });
  }, [bounds, onToolStateChange, penPoints.length, pointer, previewEnd, start]);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    drawPacked(context, onionPixels, width, height, 'rgba(90, 180, 220, 0.25)');
    drawPacked(context, pixels, width, height, DRAW_COLOR);
  }, [height, onionPixels, pixels, width]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const updateScale = () => {
      const availableWidth = Math.max(1, workspace.clientWidth - 16);
      const availableHeight = Math.max(1, workspace.clientHeight - 16);
      setDisplayScale(
        Math.max(
          1,
          Math.min(16, Math.floor(Math.min(availableWidth / width, availableHeight / height)))
        )
      );
    };
    updateScale();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [height, width]);

  const coordinate = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return logicalPointFromClientPoint(rect, event.clientX, event.clientY, width, height);
  };

  const addEraserArea = (point: Point) => {
    const originX = point[0] - Math.floor((eraserSize - 1) / 2);
    const originY = point[1] - Math.floor((eraserSize - 1) / 2);
    for (let row = 0; row < eraserSize; row += 1) {
      for (let column = 0; column < eraserSize; column += 1) {
        const x = originX + column;
        const y = originY + row;
        eraserChangesRef.current.set(`${x}:${y}`, { x, y, active: false });
      }
    }
  };

  const pixelsToChanges = (next: Uint8Array) => {
    const changes: Array<{ x: number; y: number; active: boolean }> = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const before = getPixel(pixels, { width, height }, x, y);
        const after = getPixel(next, { width, height }, x, y);
        if (before !== after) changes.push({ x, y, active: after });
      }
    }
    return changes;
  };

  const finishPen = () => {
    if (penPoints.length >= 3) {
      const changes = pixelsToChanges(drawPolygon(pixels, { width, height }, penPoints));
      if (changes.length) onPixelTransaction(changes);
    }
    setPenPoints([]);
  };

  useEffect(() => {
    if (!penCommand) return;
    if (penCommand.type === 'finish') finishPen();
    else setPenPoints([]);
  }, [penCommand]);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLCanvasElement>,
    point: Point,
    surface: 'main' | 'magnifier'
  ) => {
    if (disabled) return;
    if (pickingSelectionPivot) {
      onSelectionPivotChange?.({ x: point[0], y: point[1] });
      return;
    }
    setPointer(point);
    setPointerSurface(surface);
    if (surface === 'main' && magnifierMode === 'follow') setMagnifierCenter(point);
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (selectedTool === 'eraser') {
      eraserChangesRef.current.clear();
      addEraserArea(point);
      return;
    }
    if (selectedTool === 'pen') {
      const nextPoints = [...penPoints, point];
      setPenPoints(nextPoints);
      if (event.detail === 2 && nextPoints.length >= 3) {
        const changes = pixelsToChanges(drawPolygon(pixels, { width, height }, nextPoints));
        if (changes.length) onPixelTransaction(changes);
        setPenPoints([]);
      }
      return;
    }
    if (selectedTool === 'brush') {
      onPixelTransaction([
        {
          x: point[0],
          y: point[1],
          active: !getPixel(pixels, { width, height }, point[0], point[1]),
        },
      ]);
      return;
    }
    setStart(point);
    setEnd(point);
  };

  const handlePointerMove = (
    _event: React.PointerEvent<HTMLCanvasElement>,
    point: Point,
    updateMagnifierCenter: boolean
  ) => {
    setPointer(point);
    setPointerSurface(updateMagnifierCenter ? 'main' : 'magnifier');
    if (updateMagnifierCenter && magnifierMode === 'follow') setMagnifierCenter(point);
    if (!disabled && drawingRef.current && selectedTool === 'eraser') addEraserArea(point);
    if (start) setEnd(point);
  };

  const handlePointerUp = () => {
    if (disabled) return;
    drawingRef.current = false;
    if (selectedTool === 'eraser') {
      const changes = [...eraserChangesRef.current.values()];
      eraserChangesRef.current.clear();
      if (changes.length) onPixelTransaction(changes);
      return;
    }
    if (!start || !previewEnd) return;
    if (selectedTool === 'select') {
      onSelectionChange?.({ ...boundsFor(start, previewEnd), shape: selectionShape });
      setStart(null);
      setEnd(null);
      return;
    }
    const shapeBounds = boundsForTool(start, previewEnd, selectedTool, selectionShape);
    let next = pixels;
    if (selectedTool === 'line') {
      next = drawLine(pixels, { width, height }, start[0], start[1], previewEnd[0], previewEnd[1]);
    } else if (selectedTool === 'rectangle') {
      next = drawRectangle(
        pixels,
        { width, height },
        shapeBounds.x,
        shapeBounds.y,
        shapeBounds.width,
        shapeBounds.height,
        !rectangleFilled
      );
    } else if (selectedTool === 'circle') {
      next = drawEllipse(
        pixels,
        { width, height },
        shapeBounds.x,
        shapeBounds.y,
        shapeBounds.width,
        shapeBounds.height,
        false
      );
    } else if (selectedTool === 'triangle') {
      next = drawTriangle(
        pixels,
        { width, height },
        start[0],
        start[1],
        previewEnd[0],
        previewEnd[1]
      );
    }
    const changes = pixelsToChanges(next);
    if (changes.length) onPixelTransaction(changes);
    setStart(null);
    setEnd(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Enter' && selectedTool === 'pen') finishPen();
    if (event.key === 'Escape') {
      setStart(null);
      setEnd(null);
      setPenPoints([]);
      onSelectionChange?.(null);
    }
  };
  const handleMainPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = coordinate(event);
    if (point) handlePointerDown(event, point, 'main');
  };
  const handleMainPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = coordinate(event);
    if (point) handlePointerMove(event, point, true);
  };
  const handleMagnifierPointerMove = (event: React.PointerEvent<HTMLCanvasElement>, point: Point) =>
    handlePointerMove(event, point, false);
  const handleMagnifierPointerDown = (event: React.PointerEvent<HTMLCanvasElement>, point: Point) =>
    handlePointerDown(event, point, 'magnifier');
  const handlePointerLeave = (surface: 'main' | 'magnifier') => {
    if (!drawingRef.current && pointerSurface === surface) {
      setPointer(null);
      setPointerSurface(null);
    }
  };
  const magnifierDragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const handleMagnifierFramePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (magnifierMode === 'follow') return;
    magnifierDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      originX: magnifier.originX,
      originY: magnifier.originY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleMagnifierFramePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = magnifierDragRef.current;
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    )
      return;
    event.stopPropagation();
    const next = moveMagnifierViewportOrigin(
      { ...magnifier, originX: drag.originX, originY: drag.originY },
      [
        (event.clientX - drag.clientX) / displayScale,
        (event.clientY - drag.clientY) / displayScale,
      ],
      width,
      height
    );
    setMagnifierCenter([
      next.originX + Math.floor(next.width / 2),
      next.originY + Math.floor(next.height / 2),
    ]);
  };
  const handleMagnifierFramePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    magnifierDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pendingDragRef = useRef<{ clientX: number; clientY: number; pointerId: number } | null>(
    null
  );
  const handlePendingPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pendingDragRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    };
    if (typeof event.currentTarget.setPointerCapture === 'function')
      event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePendingPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = pendingDragRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    const dx = Math.round((event.clientX - origin.clientX) / displayScale);
    const dy = Math.round((event.clientY - origin.clientY) / displayScale);
    if (dx || dy) {
      onPendingImportMove(dx, dy);
      pendingDragRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
      };
    }
  };
  const handlePendingPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pendingDragRef.current = null;
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId) &&
      typeof event.currentTarget.releasePointerCapture === 'function'
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const scaleX = 100 / width;
  const scaleY = 100 / height;
  const magnifierBounds: CanvasSelection = {
    x: magnifier.originX,
    y: magnifier.originY,
    width: magnifier.width,
    height: magnifier.height,
  };
  const pointerBounds: CanvasSelection | null = pointer
    ? {
        x: pointer[0],
        y: pointer[1],
        width: 1,
        height: 1,
      }
    : null;
  const eraserBounds = pointer
    ? {
        x: pointer[0] - Math.floor((eraserSize - 1) / 2),
        y: pointer[1] - Math.floor((eraserSize - 1) / 2),
        width: eraserSize,
        height: eraserSize,
      }
    : null;
  const penPreviewPoints = pointer && penPoints.length > 0 ? [...penPoints, pointer] : penPoints;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span>
          {width} × {height}
        </span>
        <div className="flex items-center gap-2 font-normal text-muted-foreground">
          <span>
            {pointer
              ? t('customFaceEditor.canvas.coordinate', { x: pointer[0], y: pointer[1] })
              : ''}
            {t('customFaceEditor.canvas.scale', { scale: displayScale })}
          </span>
          <button
            type="button"
            aria-pressed={magnifierOpen}
            className="border border-border px-2 py-1 text-xs text-foreground"
            onClick={() => setMagnifierOpen((current) => !current)}
          >
            {magnifierOpen
              ? t('customFaceEditor.magnifier.hide')
              : t('customFaceEditor.magnifier.show')}
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col gap-3">
        <div
          ref={workspaceRef}
          className="flex min-h-56 min-w-0 flex-1 items-center justify-center overflow-auto bg-muted/20 p-2"
        >
          <CustomFaceViewport
            width={width}
            height={height}
            scale={displayScale}
            guides={guides}
            onGuidesChange={onGuidesChange}
          >
            <div
              className="relative shrink-0"
              style={{ width: `${width * displayScale}px`, height: `${height * displayScale}px` }}
            >
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="img"
                aria-label={t('customFaceEditor.canvas.label', { width, height })}
                width={width}
                height={height}
                onKeyDown={handleKeyDown}
                onPointerDown={handleMainPointerDown}
                onPointerMove={handleMainPointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={() => handlePointerLeave('main')}
                className={cursorClass(selectedTool)}
                style={{ imageRendering: 'pixelated', width: '100%', height: '100%' }}
              />
              <ToolOverlay
                width={width}
                height={height}
                tool={selectedTool}
                start={start}
                end={previewEnd}
                bounds={bounds}
                selection={selection ?? null}
                selectionOrigin={selectionOrigin ?? null}
                selectionPivot={selectionPivot}
                eraserBounds={selectedTool === 'eraser' ? eraserBounds : null}
                penPoints={selectedTool === 'pen' ? penPreviewPoints : []}
                magnifierBounds={magnifierOpen ? magnifierBounds : null}
                pointerBounds={pointerBounds}
                magnifierMode={magnifierMode}
                onMagnifierPointerDown={handleMagnifierFramePointerDown}
                onMagnifierPointerMove={handleMagnifierFramePointerMove}
                onMagnifierPointerUp={handleMagnifierFramePointerUp}
              />
              {pendingImportPixels ? (
                <div
                  aria-label={t('customFaceEditor.canvasOverlay.pendingImport')}
                  className="pointer-events-auto absolute inset-0 z-20 cursor-move border-2 border-dashed border-fuchsia-400 bg-fuchsia-400/10"
                  onPointerDown={handlePendingPointerDown}
                  onPointerMove={handlePendingPointerMove}
                  onPointerUp={handlePendingPointerUp}
                  onPointerCancel={handlePendingPointerUp}
                >
                  <div
                    data-testid="custom-face-pending-import-preview"
                    className="pointer-events-none absolute left-0 top-0 opacity-60"
                    style={{
                      width: `${pendingImportSize.width * displayScale}px`,
                      height: `${pendingImportSize.height * displayScale}px`,
                      transform: `translate(${pendingImportOffset.x * displayScale}px, ${pendingImportOffset.y * displayScale}px)`,
                    }}
                  >
                    <CustomFacePixelPreview
                      width={pendingImportSize.width}
                      height={pendingImportSize.height}
                      displayScale={displayScale}
                      packedPixels={pendingImportPixels}
                      ariaLabel={t('customFaceEditor.canvasOverlay.pendingImportPreview', {
                        width: pendingImportSize.width,
                        height: pendingImportSize.height,
                      })}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </CustomFaceViewport>
        </div>
        {magnifierOpen ? (
          <CustomFaceMagnifier
            canvasWidth={width}
            canvasHeight={height}
            pixels={pixels}
            onionPixels={onionPixels}
            viewport={magnifier}
            scale={MAGNIFIER_SCALE}
            pointer={pointer}
            mode={magnifierMode}
            cursorClassName={cursorClass(selectedTool)}
            onKeyDown={handleKeyDown}
            onPointerDown={handleMagnifierPointerDown}
            onPointerMove={handleMagnifierPointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => handlePointerLeave('magnifier')}
            onModeChange={setMagnifierMode}
            onClose={() => setMagnifierOpen(false)}
          >
            <ToolOverlay
              width={width}
              height={height}
              tool={selectedTool}
              start={start}
              end={previewEnd}
              bounds={bounds}
              selection={selection ?? null}
              selectionOrigin={selectionOrigin ?? null}
              selectionPivot={selectionPivot}
              eraserBounds={selectedTool === 'eraser' ? eraserBounds : null}
              penPoints={selectedTool === 'pen' ? penPreviewPoints : []}
              viewport={magnifier}
            />
          </CustomFaceMagnifier>
        ) : null}
      </div>
    </div>
  );
}

function ToolOverlay({
  width,
  height,
  tool,
  start,
  end,
  bounds,
  selection,
  selectionOrigin,
  selectionPivot,
  eraserBounds,
  penPoints,
  magnifierBounds,
  pointerBounds,
  magnifierMode,
  onMagnifierPointerDown,
  onMagnifierPointerMove,
  onMagnifierPointerUp,
  viewport,
}: {
  width: number;
  height: number;
  tool: ToolId;
  start: Point | null;
  end: Point | null;
  bounds: CanvasSelection | null;
  selection: CanvasSelection | null;
  selectionOrigin: CanvasSelection | null;
  selectionPivot?: { x: number; y: number } | null;
  eraserBounds: CanvasSelection | null;
  penPoints: Point[];
  magnifierBounds?: CanvasSelection | null;
  pointerBounds?: CanvasSelection | null;
  magnifierMode?: 'follow' | 'locked';
  onMagnifierPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onMagnifierPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onMagnifierPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  viewport?: LogicalViewport;
}) {
  const t = useI18n();
  const visible = viewport ?? { originX: 0, originY: 0, width, height };
  const styleFor = (value: CanvasSelection) => ({
    left: `${((value.x - visible.originX) / visible.width) * 100}%`,
    top: `${((value.y - visible.originY) / visible.height) * 100}%`,
    width: `${(value.width / visible.width) * 100}%`,
    height: `${(value.height / visible.height) * 100}%`,
  });
  return (
    <>
      {magnifierBounds && !viewport ? (
        <div
          aria-label={t('customFaceEditor.canvasOverlay.magnifierArea')}
          className={`absolute border-2 border-dashed border-fuchsia-300 bg-fuchsia-300/10 shadow-[0_0_0_1px_rgba(0,0,0,.95)] ${magnifierMode === 'locked' ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}`}
          style={styleFor(magnifierBounds)}
          onPointerDown={onMagnifierPointerDown}
          onPointerMove={onMagnifierPointerMove}
          onPointerUp={onMagnifierPointerUp}
          onPointerCancel={onMagnifierPointerUp}
        />
      ) : null}
      {pointerBounds ? (
        <div
          aria-label={t('customFaceEditor.canvasOverlay.currentPixel')}
          className="pointer-events-none absolute border-2 border-cyan-300 shadow-[0_0_0_1px_rgba(0,0,0,.95)]"
          style={styleFor(pointerBounds)}
        />
      ) : null}
      {selectionOrigin ? (
        selectionOrigin.shape === 'circle' ? (
          <svg
            aria-label={t('customFaceEditor.canvasOverlay.originalSelection')}
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`${visible.originX} ${visible.originY} ${visible.width} ${visible.height}`}
            preserveAspectRatio="none"
          >
            <ellipse
              cx={selectionOrigin.x + selectionOrigin.width / 2}
              cy={selectionOrigin.y + selectionOrigin.height / 2}
              rx={selectionOrigin.width / 2}
              ry={selectionOrigin.height / 2}
              fill="rgba(253,224,71,.1)"
              stroke="rgb(253,224,71)"
              strokeWidth="0.55"
              strokeDasharray="1.2 0.8"
              vectorEffect="non-scaling-stroke"
              filter="drop-shadow(0 0 0.25px rgba(0,0,0,.85))"
            />
          </svg>
        ) : (
          <div
            aria-label={t('customFaceEditor.canvasOverlay.originalSelection')}
            className="pointer-events-none absolute border-2 border-dashed border-yellow-300 bg-yellow-300/10 shadow-[0_0_0_1px_rgba(0,0,0,.85)]"
            style={styleFor(selectionOrigin)}
          />
        )
      ) : null}
      {selection ? (
        selection.shape === 'circle' ? (
          <svg
            aria-label={t('customFaceEditor.canvasOverlay.selection')}
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`${visible.originX} ${visible.originY} ${visible.width} ${visible.height}`}
            preserveAspectRatio="none"
          >
            <ellipse
              cx={selection.x + selection.width / 2}
              cy={selection.y + selection.height / 2}
              rx={selection.width / 2}
              ry={selection.height / 2}
              fill="rgba(103,232,249,.1)"
              stroke="rgb(103,232,249)"
              strokeWidth="0.55"
              vectorEffect="non-scaling-stroke"
              filter="drop-shadow(0 0 0.25px rgba(0,0,0,.85))"
            />
          </svg>
        ) : (
          <div
            aria-label={t('customFaceEditor.canvasOverlay.selection')}
            className="pointer-events-none absolute border-2 border-solid border-cyan-300 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(0,0,0,.85)]"
            style={styleFor(selection)}
          />
        )
      ) : null}
      {selectionPivot ? (
        <div
          aria-label={t('customFaceEditor.canvasOverlay.selectionPivot')}
          className="pointer-events-none absolute z-10 flex items-center justify-center text-orange-300"
          style={{
            left: `${((selectionPivot.x - visible.originX + 0.5) / visible.width) * 100}%`,
            top: `${((selectionPivot.y - visible.originY + 0.5) / visible.height) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          +
        </div>
      ) : null}
      {eraserBounds ? (
        <div
          aria-label={t('customFaceEditor.canvasOverlay.eraserArea')}
          className="pointer-events-none absolute border-2 border-red-400 bg-red-400/15 shadow-[0_0_0_1px_rgba(0,0,0,.85)]"
          style={styleFor(eraserBounds)}
        />
      ) : null}
      {start && end && bounds ? (
        <svg
          aria-label={t('customFaceEditor.canvasOverlay.toolPreview')}
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`${visible.originX} ${visible.originY} ${visible.width} ${visible.height}`}
          preserveAspectRatio="none"
        >
          {tool === 'line' ? (
            <line
              x1={start[0] + 0.5}
              y1={start[1] + 0.5}
              x2={end[0] + 0.5}
              y2={end[1] + 0.5}
              {...previewStroke()}
            />
          ) : null}
          {tool === 'rectangle' ? (
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              fill="rgba(103,232,249,.1)"
              {...previewStroke()}
            />
          ) : null}
          {tool === 'select' ? (
            bounds.shape === 'circle' ? (
              <ellipse
                cx={bounds.x + bounds.width / 2}
                cy={bounds.y + bounds.height / 2}
                rx={bounds.width / 2}
                ry={bounds.height / 2}
                fill="rgba(103,232,249,.1)"
                {...previewStroke(SELECTION_STROKE)}
              />
            ) : (
              <rect
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                fill="rgba(103,232,249,.1)"
                {...previewStroke(SELECTION_STROKE)}
              />
            )
          ) : null}
          {tool === 'circle' ? (
            <ellipse
              cx={bounds.x + bounds.width / 2}
              cy={bounds.y + bounds.height / 2}
              rx={bounds.width / 2}
              ry={bounds.height / 2}
              fill="rgba(103,232,249,.1)"
              {...previewStroke()}
            />
          ) : null}
          {tool === 'triangle' ? (
            <polygon
              points={`${start[0] + 0.5},${start[1] + 0.5} ${start[0] - Math.abs(end[0] - start[0]) + 0.5},${end[1] + 0.5} ${start[0] + Math.abs(end[0] - start[0]) + 0.5},${end[1] + 0.5}`}
              fill="rgba(103,232,249,.1)"
              {...previewStroke()}
            />
          ) : null}
          <circle
            cx={start[0] + 0.5}
            cy={start[1] + 0.5}
            r="0.8"
            fill={PREVIEW_STROKE}
            stroke={PREVIEW_HALO}
            strokeWidth="0.35"
          />
        </svg>
      ) : null}
      {penPoints.length > 0 ? (
        <svg
          aria-label={t('customFaceEditor.canvasOverlay.penPreview')}
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`${visible.originX} ${visible.originY} ${visible.width} ${visible.height}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={penPoints.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ')}
            fill="none"
            {...previewStroke()}
          />
          {penPoints.slice(0, -1).map(([x, y], index) => (
            <circle
              key={`${x}:${y}:${index}`}
              cx={x + 0.5}
              cy={y + 0.5}
              r="0.75"
              fill={PREVIEW_STROKE}
              stroke={PREVIEW_HALO}
              strokeWidth="0.35"
            />
          ))}
        </svg>
      ) : null}
    </>
  );
}

function previewStroke(stroke = PREVIEW_STROKE) {
  return {
    stroke,
    strokeWidth: 0.55,
    strokeDasharray: '1.2 0.8',
    vectorEffect: 'non-scaling-stroke' as const,
    filter: 'drop-shadow(0 0 0.3px #000)',
  };
}

function boundsFor(start: Point, end: Point): CanvasSelection {
  return {
    x: Math.min(start[0], end[0]),
    y: Math.min(start[1], end[1]),
    width: Math.abs(end[0] - start[0]) + 1,
    height: Math.abs(end[1] - start[1]) + 1,
  };
}

function boundsForTool(
  start: Point,
  end: Point,
  tool: ToolId,
  shape?: SelectionShape
): CanvasSelection {
  if (tool !== 'triangle') {
    const baseBounds = boundsFor(start, end);
    return tool === 'select' && shape ? { ...baseBounds, shape } : baseBounds;
  }
  const halfWidth = Math.abs(end[0] - start[0]);
  return {
    x: start[0] - halfWidth,
    y: Math.min(start[1], end[1]),
    width: halfWidth * 2 + 1,
    height: Math.abs(end[1] - start[1]) + 1,
  };
}

function constrainEnd(start: Point, end: Point, tool: ToolId, enabled: boolean): Point {
  if (!enabled) return end;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (tool === 'line') {
    if (Math.abs(dx) > Math.abs(dy) * 2) return [end[0], start[1]];
    if (Math.abs(dy) > Math.abs(dx) * 2) return [start[0], end[1]];
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    return [start[0] + Math.sign(dx || 1) * distance, start[1] + Math.sign(dy || 1) * distance];
  }
  if (tool === 'rectangle' || tool === 'circle' || tool === 'triangle') {
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    return [start[0] + Math.sign(dx || 1) * distance, start[1] + Math.sign(dy || 1) * distance];
  }
  return end;
}

function clampPoint(point: Point, width: number, height: number): Point {
  return [Math.min(width - 1, Math.max(0, point[0])), Math.min(height - 1, Math.max(0, point[1]))];
}

function cursorClass(tool: ToolId) {
  if (tool === 'select') return 'block h-full w-full cursor-cell';
  if (tool === 'pen') return 'block h-full w-full cursor-crosshair';
  if (tool === 'eraser') return 'block h-full w-full cursor-none';
  return 'block h-full w-full cursor-crosshair';
}

function drawPacked(
  context: CanvasRenderingContext2D,
  pixels: Uint8Array | undefined,
  width: number,
  height: number,
  color: string
) {
  if (!pixels) return;
  context.fillStyle = color;
  pixels.forEach((value, index) => {
    if (!value) return;
    for (let bit = 0; bit < 8; bit += 1) {
      if (!(value & (1 << bit))) continue;
      const y = Math.floor(index / width) * 8 + bit;
      if (y < height) context.fillRect(index % width, y, 1, 1);
    }
  });
}
