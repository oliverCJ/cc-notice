import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DeviceDisplayCapabilities } from '@/api/tauriApi';
import { DisplayFacePreview } from './DisplayFacePreview';

let animationCallback: FrameRequestCallback | null = null;
let intersectionCallback: IntersectionObserverCallback | null = null;

function capability(
  overrides: Partial<DeviceDisplayCapabilities> = {}
): DeviceDisplayCapabilities {
  return {
    status: true,
    face: true,
    faceTemplates: ['working-focus'],
    clear: true,
    sizeClass: 'compact',
    statuses: ['working'],
    titleMaxChars: 16,
    messageMaxChars: 16,
    pixelWidth: 128,
    pixelHeight: 32,
    faceRendererProfile: 'oled-128x32-v1',
    ...overrides
  };
}

describe('DisplayFacePreview', () => {
  beforeEach(() => {
    animationCallback = null;
    intersectionCallback = null;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      imageSmoothingEnabled: true,
      fillStyle: ''
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationCallback = callback;
        return 41;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('IntersectionObserver', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('uses device resolution and cleans up the animation frame', () => {
    const { unmount } = render(
      <DisplayFacePreview
        displayCapabilities={capability()}
        templateId="working-focus"
      />
    );

    expect(screen.getByTestId('pixel-display-canvas')).toHaveAttribute('width', '128');
    expect(screen.getByTestId('pixel-display-canvas')).toHaveAttribute('height', '32');
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(41);
  });

  test('uses the renderer profile when legacy resolution fields are missing', () => {
    render(
      <DisplayFacePreview
        displayCapabilities={capability({ pixelWidth: undefined, pixelHeight: undefined })}
        templateId="idle-sleep"
      />
    );

    expect(screen.getByTestId('pixel-display-canvas')).toHaveAttribute('width', '128');
    expect(screen.getByTestId('pixel-display-canvas')).toHaveAttribute('height', '32');
  });

  test('shows unavailable state and skips animation for unknown renderer profile', () => {
    render(
      <DisplayFacePreview
        displayCapabilities={capability({ faceRendererProfile: 'unknown' })}
        templateId="working-focus"
      />
    );

    expect(screen.getByTestId('pixel-display-unavailable')).toHaveTextContent(
      '当前设备缺少有效的屏幕分辨率'
    );
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  test('pauses while hidden and resumes when visible', () => {
    class TestIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe() {}
      disconnect() {}
    }
    vi.stubGlobal(
      'IntersectionObserver',
      TestIntersectionObserver as unknown as typeof IntersectionObserver
    );

    render(
      <DisplayFacePreview
        displayCapabilities={capability()}
        templateId="working-focus"
      />
    );
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(41);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(animationCallback).not.toBeNull();
  });
});
