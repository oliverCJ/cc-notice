import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { CustomFaceRulers, type CanvasGuide } from './CustomFaceRulers';

type Props = {
  width: number;
  height: number;
  scale: number;
  guides: CanvasGuide[];
  onGuidesChange: (guides: CanvasGuide[]) => void;
  children: ReactNode;
  className?: string;
  screenStyle?: CSSProperties;
  screenTestId?: string;
  onScreenPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onScreenPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onScreenPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onScreenPointerCancel?: (event: PointerEvent<HTMLDivElement>) => void;
};

export function CustomFaceViewport({
  width,
  height,
  scale,
  guides,
  onGuidesChange,
  children,
  className,
  screenStyle,
  screenTestId,
  onScreenPointerDown,
  onScreenPointerMove,
  onScreenPointerUp,
  onScreenPointerCancel,
}: Props) {
  return (
    <CustomFaceRulers
      width={width}
      height={height}
      scale={scale}
      guides={guides}
      onGuidesChange={onGuidesChange}
    >
      <div
        data-testid={screenTestId ?? 'custom-face-viewport-screen'}
        className={
          className ?? 'relative shrink-0 overflow-hidden bg-black outline outline-1 outline-border'
        }
        style={{ width: `${width * scale}px`, height: `${height * scale}px`, ...screenStyle }}
        onPointerDown={onScreenPointerDown}
        onPointerMove={onScreenPointerMove}
        onPointerUp={onScreenPointerUp}
        onPointerCancel={onScreenPointerCancel}
      >
        {children}
        <PixelGrid scale={scale} />
      </div>
    </CustomFaceRulers>
  );
}

export type LogicalViewport = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function logicalPointFromClientPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  width: number,
  height: number
): [number, number] {
  if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return [0, 0];
  return [
    Math.min(width - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * width))),
    Math.min(height - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * height))),
  ];
}

export function magnifierViewport(
  center: [number, number],
  canvasWidth: number,
  canvasHeight: number,
  maxWidth: number,
  maxHeight: number
): LogicalViewport {
  const width = Math.max(1, Math.min(canvasWidth, maxWidth));
  const height = Math.max(1, Math.min(canvasHeight, maxHeight));
  return {
    originX: Math.min(canvasWidth - width, Math.max(0, center[0] - Math.floor(width / 2))),
    originY: Math.min(canvasHeight - height, Math.max(0, center[1] - Math.floor(height / 2))),
    width,
    height,
  };
}

export function moveMagnifierViewportOrigin(
  viewport: LogicalViewport,
  delta: [number, number],
  canvasWidth: number,
  canvasHeight: number
): LogicalViewport {
  const maxOriginX = Math.max(0, canvasWidth - viewport.width);
  const maxOriginY = Math.max(0, canvasHeight - viewport.height);
  const originX = Math.min(maxOriginX, Math.max(0, viewport.originX + Math.round(delta[0])));
  const originY = Math.min(maxOriginY, Math.max(0, viewport.originY + Math.round(delta[1])));
  return {
    ...viewport,
    originX,
    originY,
  };
}

export function logicalPointFromViewportClientPoint(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  canvasWidth: number,
  canvasHeight: number,
  viewport: LogicalViewport
): [number, number] {
  const [x, y] = logicalPointFromClientPoint(
    rect,
    clientX,
    clientY,
    viewport.width,
    viewport.height
  );
  return [
    Math.min(canvasWidth - 1, Math.max(0, viewport.originX + x)),
    Math.min(canvasHeight - 1, Math.max(0, viewport.originY + y)),
  ];
}

export function PixelGrid({ scale }: { scale: number }) {
  const t = useI18n();
  return (
    <div
      aria-label={t('customFaceEditor.canvasOverlay.pixelGrid')}
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(130, 165, 178, 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(130, 165, 178, 0.28) 1px, transparent 1px)',
        backgroundSize: `${scale}px ${scale}px`,
      }}
    />
  );
}
