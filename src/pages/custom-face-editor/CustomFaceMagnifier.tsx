import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { getPixel } from '@/domain/customFaces/editor/raster';
import { useI18n } from '@/i18n';
import { logicalPointFromViewportClientPoint, type LogicalViewport } from './CustomFaceViewport';

type Point = [number, number];

type Props = {
  canvasWidth: number;
  canvasHeight: number;
  pixels: Uint8Array;
  onionPixels?: Uint8Array;
  viewport: LogicalViewport;
  scale: number;
  pointer: Point | null;
  mode: 'follow' | 'locked';
  cursorClassName: string;
  children?: ReactNode;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>, point: Point) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>, point: Point) => void;
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLCanvasElement>) => void;
  onModeChange: (mode: 'follow' | 'locked') => void;
  onClose?: () => void;
};

const DRAW_COLOR = '#d7ff70';
const ONION_COLOR = 'rgba(90, 180, 220, 0.25)';

export function CustomFaceMagnifier({
  canvasWidth,
  canvasHeight,
  pixels,
  onionPixels,
  viewport,
  scale,
  pointer,
  mode,
  cursorClassName,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onKeyDown,
  onModeChange,
  onClose,
}: Props) {
  const t = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    left: number;
    top: number;
  } | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, viewport.width, viewport.height);
    drawViewportPacked(context, onionPixels, canvasWidth, canvasHeight, viewport, ONION_COLOR);
    drawViewportPacked(context, pixels, canvasWidth, canvasHeight, viewport, DRAW_COLOR);
  }, [canvasHeight, canvasWidth, onionPixels, pixels, viewport]);

  useEffect(() => {
    const handleResize = () => {
      const panel = panelRef.current;
      const parent = panel?.parentElement;
      if (!panel || !parent) return;
      const maxLeft = Math.max(0, parent.clientWidth - panel.offsetWidth - 12);
      const maxTop = Math.max(0, parent.clientHeight - panel.offsetHeight - 12);
      setPosition((current) => ({
        left: Math.min(maxLeft, Math.max(12, current.left)),
        top: Math.min(maxTop, Math.max(12, current.top)),
      }));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewport.height, viewport.width]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      left: position.left,
      top: position.top,
    };
  };
  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    )
      return;
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return;
    const maxLeft = Math.max(0, parent.clientWidth - panel.offsetWidth - 12);
    const maxTop = Math.max(0, parent.clientHeight - panel.offsetHeight - 12);
    setPosition({
      left: Math.min(maxLeft, Math.max(12, drag.left + event.clientX - drag.clientX)),
      top: Math.min(maxTop, Math.max(12, drag.top + event.clientY - drag.clientY)),
    });
  };
  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const coordinate = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return [viewport.originX, viewport.originY] as Point;
    return logicalPointFromViewportClientPoint(
      rect,
      event.clientX,
      event.clientY,
      canvasWidth,
      canvasHeight,
      viewport
    );
  };

  return (
    <section
      ref={panelRef}
      className="absolute z-20 max-w-[calc(100%-1.5rem)] border border-primary/70 bg-background/95 p-2 shadow-xl backdrop-blur"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      aria-label={t('customFaceEditor.magnifier.panelLabel')}
    >
      <div
        className="mb-2 flex cursor-move flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <span>{t('customFaceEditor.magnifier.title', { scale })}</span>
        <span data-testid="custom-face-magnifier-range">
          {t('customFaceEditor.magnifier.range', {
            startX: viewport.originX,
            startY: viewport.originY,
            endX: viewport.originX + viewport.width - 1,
            endY: viewport.originY + viewport.height - 1,
          })}
        </span>
        <div className="flex items-center gap-2">
          <span>{t(`customFaceEditor.magnifier.mode.${mode}`)}</span>
          <button
            type="button"
            aria-label={t(`customFaceEditor.magnifier.modeAction.${mode}`)}
            aria-pressed={mode === 'locked'}
            className="border border-border px-2 py-1 text-foreground"
            onClick={() => onModeChange(mode === 'locked' ? 'follow' : 'locked')}
          >
            {t(`customFaceEditor.magnifier.modeAction.${mode}`)}
          </button>
          <button
            type="button"
            aria-label={t('customFaceEditor.magnifier.closePanel')}
            title={t('customFaceEditor.magnifier.closePanel')}
            className="border border-border px-2 py-1 text-foreground"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>
      <div
        className="relative overflow-hidden bg-black outline outline-1 outline-border"
        style={{ width: `${viewport.width * scale}px`, height: `${viewport.height * scale}px` }}
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label={t('customFaceEditor.magnifier.canvasLabel')}
          width={viewport.width}
          height={viewport.height}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => onPointerDown(event, coordinate(event))}
          onPointerMove={(event) => onPointerMove(event, coordinate(event))}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          className={cursorClassName}
          style={{ imageRendering: 'pixelated' }}
        />
        {children}
        {pointer && isPointInViewport(pointer, viewport) ? (
          <div
            aria-label={t('customFaceEditor.magnifier.pointer')}
            className="pointer-events-none absolute border-2 border-cyan-300 shadow-[0_0_0_1px_rgba(0,0,0,.95)]"
            style={{
              left: `${(pointer[0] - viewport.originX) * scale}px`,
              top: `${(pointer[1] - viewport.originY) * scale}px`,
              width: `${scale}px`,
              height: `${scale}px`,
            }}
          />
        ) : null}
        <PixelGrid scale={scale} />
      </div>
    </section>
  );
}

function PixelGrid({ scale }: { scale: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(130, 165, 178, 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(130, 165, 178, 0.28) 1px, transparent 1px)',
        backgroundSize: `${scale}px ${scale}px`,
      }}
    />
  );
}

function isPointInViewport(point: Point, viewport: LogicalViewport) {
  return (
    point[0] >= viewport.originX &&
    point[0] < viewport.originX + viewport.width &&
    point[1] >= viewport.originY &&
    point[1] < viewport.originY + viewport.height
  );
}

function drawViewportPacked(
  context: CanvasRenderingContext2D,
  packedPixels: Uint8Array | undefined,
  canvasWidth: number,
  canvasHeight: number,
  viewport: LogicalViewport,
  color: string
) {
  if (!packedPixels) return;
  context.fillStyle = color;
  // 局部画布仅投影全图像素，避免产生第二份可编辑 framebuffer。
  for (let localY = 0; localY < viewport.height; localY += 1) {
    for (let localX = 0; localX < viewport.width; localX += 1) {
      if (
        !getPixel(
          packedPixels,
          { width: canvasWidth, height: canvasHeight },
          viewport.originX + localX,
          viewport.originY + localY
        )
      )
        continue;
      context.fillRect(localX, localY, 1, 1);
    }
  }
}
