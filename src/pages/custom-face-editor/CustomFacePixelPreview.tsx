import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';

type Props = {
  width: number;
  height: number;
  packedPixels: ArrayLike<number>;
  ariaLabel: string;
  className?: string;
  displayScale?: number;
};

export function CustomFacePixelPreview({ width, height, packedPixels, ariaLabel, className, displayScale = 1 }: Props) {
  const t = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasPixels = packedPixels.length >= Math.ceil(width * height / 8);
  const hasActivePixel = hasPixels && Array.from(packedPixels).some((value) => value !== 0);

  useEffect(() => {
    if (!hasActivePixel || !canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) {
      console.warn('[custom-face-preview] Canvas 2D context is unavailable');
      return;
    }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const byte = packedPixels[x + Math.floor(y / 8) * width];
        if ((byte & (1 << (y & 7))) !== 0) context.fillRect(x, y, 1, 1);
      }
    }
  }, [hasActivePixel, height, packedPixels, width]);

  if (!hasActivePixel) return <div className={className ?? 'flex h-full items-center justify-center text-xs text-muted-foreground'}>{t('customFaceEditor.canvas.emptyFrame')}</div>;
  const scale = Math.max(1, Math.floor(displayScale));
  if (!className) return <canvas ref={canvasRef} aria-label={ariaLabel} data-testid="custom-face-pixel-preview-canvas" height={height} role="img" width={width} style={{ display: 'block', imageRendering: 'pixelated', width: `${width * scale}px`, height: `${height * scale}px` }} />;
  return <div className={className} style={{ aspectRatio: `${width} / ${height}`, minWidth: 1, minHeight: 1, overflow: 'hidden', background: '#000' }}><canvas ref={canvasRef} aria-label={ariaLabel} data-testid="custom-face-pixel-preview-canvas" height={height} role="img" width={width} style={{ display: 'block', imageRendering: 'pixelated', width: '100%', height: '100%' }} /></div>;
}
