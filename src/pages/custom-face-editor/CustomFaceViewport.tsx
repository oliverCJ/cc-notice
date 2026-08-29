import type { CSSProperties, PointerEvent, ReactNode } from 'react';
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

export function CustomFaceViewport({ width, height, scale, guides, onGuidesChange, children, className, screenStyle, screenTestId, onScreenPointerDown, onScreenPointerMove, onScreenPointerUp, onScreenPointerCancel }: Props) {
  return (
    <CustomFaceRulers width={width} height={height} scale={scale} guides={guides} onGuidesChange={onGuidesChange}>
      <div data-testid={screenTestId ?? 'custom-face-viewport-screen'} className={className ?? 'relative shrink-0 overflow-hidden bg-black outline outline-1 outline-border'} style={{ width: `${width * scale}px`, height: `${height * scale}px`, ...screenStyle }} onPointerDown={onScreenPointerDown} onPointerMove={onScreenPointerMove} onPointerUp={onScreenPointerUp} onPointerCancel={onScreenPointerCancel}>
        {children}
        <PixelGrid scale={scale} />
      </div>
    </CustomFaceRulers>
  );
}

export function logicalPointFromClientPoint(rect: DOMRect, clientX: number, clientY: number, width: number, height: number): [number, number] {
  if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return [0, 0];
  return [
    Math.min(width - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * width))),
    Math.min(height - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * height)))
  ];
}

export function PixelGrid({ scale }: { scale: number }) {
  return <div aria-label="像素网格" className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(130, 165, 178, 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(130, 165, 178, 0.28) 1px, transparent 1px)', backgroundSize: `${scale}px ${scale}px` }} />;
}
