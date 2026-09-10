import { useEffect, useRef } from 'react';
import { PixelMatrix } from '@/domain/display/displayFaceRasterizer';
import { cn } from '@/lib/utils';

type PixelDisplayProps = {
  matrix: PixelMatrix | null;
  className?: string;
  accessibleLabel: string;
  unavailableLabel: string;
};

export function PixelDisplay({
  matrix,
  className,
  accessibleLabel,
  unavailableLabel
}: PixelDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const warnedUnavailableContextRef = useRef(false);

  useEffect(() => {
    if (!matrix || !canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      if (!warnedUnavailableContextRef.current) {
        console.warn('[display-face-preview] Canvas 2D context is unavailable');
        warnedUnavailableContextRef.current = true;
      }
      return;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, matrix.width, matrix.height);
    context.fillStyle = matrix.previewColor;
    matrix.pixels.forEach((active, index) => {
      if (!active) {
        return;
      }
      context.fillRect(index % matrix.width, Math.floor(index / matrix.width), 1, 1);
    });
  }, [matrix]);

  if (!matrix) {
    return (
      <div
        className={cn(
          'flex min-h-20 items-center justify-center border border-dashed border-border bg-muted/30 px-3 text-center text-xs text-muted-foreground',
          className
        )}
        data-testid="pixel-display-unavailable"
      >
        {unavailableLabel}
      </div>
    );
  }

  const displayScale = matrix.width <= 128 ? 2 : 1;
  return (
    <div
      className={cn(
        'max-w-full overflow-hidden border border-border bg-black p-1 shadow-inner',
        className
      )}
      style={{
        aspectRatio: `${matrix.width} / ${matrix.height}`,
        boxSizing: 'content-box',
        width: `${matrix.width * displayScale}px`
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label={accessibleLabel}
        className="block h-full w-full"
        data-testid="pixel-display-canvas"
        height={matrix.height}
        role="img"
        style={{ imageRendering: 'pixelated' }}
        width={matrix.width}
      />
    </div>
  );
}
