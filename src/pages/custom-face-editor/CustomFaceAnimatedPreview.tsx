import { useEffect, useMemo, useState } from 'react';
import type { CustomFaceFrame } from '@/api/tauriApi';
import { frameAtElapsed, totalDuration } from '@/domain/customFaces/editor/playback';
import { useI18n } from '@/i18n';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';

type Props = {
  width: number;
  height: number;
  frames: readonly CustomFaceFrame[];
  ariaLabel: string;
  className?: string;
  displayScale?: number;
  active?: boolean;
};

export function CustomFaceAnimatedPreview({
  width,
  height,
  frames,
  ariaLabel,
  className,
  displayScale,
  active = true,
}: Props) {
  const t = useI18n();
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
    if (!active || frames.length <= 1) {
      return;
    }

    let frameId = 0;
    const startedAt = Date.now();
    const updateFrame = () => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
      frameId = requestAnimationFrame(updateFrame);
    };

    frameId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(frameId);
  }, [active, frames]);

  const currentFrame = useMemo(() => {
    if (frames.length === 0) {
      return null;
    }

    const duration = totalDuration(frames);
    if (duration <= 0) {
      return frames[0] ?? null;
    }

    const index = active ? frameAtElapsed(frames, elapsedMs, true) : 0;
    return frames[index] ?? frames[0] ?? null;
  }, [active, elapsedMs, frames]);

  if (!currentFrame) {
    return (
      <div
        className={
          className ?? 'flex h-full items-center justify-center text-xs text-muted-foreground'
        }
      >
        {t('customFaceEditor.canvas.emptyFrame')}
      </div>
    );
  }

  return (
    <CustomFacePixelPreview
      ariaLabel={ariaLabel}
      className={className}
      displayScale={displayScale}
      width={width}
      height={height}
      packedPixels={currentFrame.packedPixels}
    />
  );
}
