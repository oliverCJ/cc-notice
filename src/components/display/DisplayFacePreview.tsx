import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceDisplayCapabilities } from '@/api/tauriApi';
import {
  rasterizeDisplayFace,
  resolveDisplayFaceRendererProfile
} from '@/domain/display/displayFaceRasterizer';
import { useI18n } from '@/i18n';
import { PixelDisplay } from './PixelDisplay';

const previewFrameIntervalMs = 120;

type DisplayFacePreviewProps = {
  displayCapabilities: DeviceDisplayCapabilities | null | undefined;
  templateId: string | null | undefined;
  className?: string;
};

export function DisplayFacePreview({
  displayCapabilities,
  templateId,
  className
}: DisplayFacePreviewProps) {
  const t = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [visible, setVisible] = useState(true);
  const profile = useMemo(() => {
    if (!displayCapabilities?.face) {
      return null;
    }
    return resolveDisplayFaceRendererProfile(displayCapabilities);
  }, [displayCapabilities]);

  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setElapsedMs(0);
    if (!profile || !visible) {
      return;
    }
    const startedAt = performance.now();
    let lastFrameAt = startedAt - previewFrameIntervalMs;
    let frameId = 0;
    const updateFrame = (now: number) => {
      if (now - lastFrameAt >= previewFrameIntervalMs) {
        lastFrameAt = now;
        setElapsedMs(Math.max(0, now - startedAt));
      }
      frameId = requestAnimationFrame(updateFrame);
    };
    frameId = requestAnimationFrame(updateFrame);
    return () => cancelAnimationFrame(frameId);
  }, [profile, templateId, visible]);

  const matrix = useMemo(
    () =>
      profile
        ? rasterizeDisplayFace(
            profile.id,
            templateId ?? 'idle-sleep',
            elapsedMs
          )
        : null,
    [elapsedMs, profile, templateId]
  );

  return (
    <div ref={containerRef}>
      <PixelDisplay
        accessibleLabel={t('rules.displayFace.previewLabel')}
        className={className}
        matrix={matrix}
        unavailableLabel={t('rules.displayFace.previewUnavailable')}
      />
    </div>
  );
}
