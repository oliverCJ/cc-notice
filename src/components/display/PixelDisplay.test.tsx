import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PixelDisplay } from './PixelDisplay';
import { PixelFrame, rasterizeDisplayFace } from '@/domain/display/displayFaceRasterizer';

const clearRect = vi.fn();
const fillRect = vi.fn();
const context = {
  clearRect,
  fillRect,
  imageSmoothingEnabled: true,
  fillStyle: ''
};

function frame(pixels: Uint8Array): PixelFrame {
  return {
    profileId: 'oled-128x32-v1',
    templateId: 'idle-sleep',
    width: 128,
    height: 32,
    packedPixels: new Uint8Array(512),
    pixels,
    color: 'idle',
    previewColor: '#d7ff70'
  };
}

describe('PixelDisplay', () => {
  beforeEach(() => {
    clearRect.mockClear();
    fillRect.mockClear();
    context.fillStyle = '';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('maps active logical pixels to one-pixel canvas squares', () => {
    const pixels = new Uint8Array(128 * 32);
    pixels[1 + 2 * 128] = 1;

    render(
      <PixelDisplay
        matrix={frame(pixels)}
        accessibleLabel="屏幕表情像素预览"
        unavailableLabel="当前设备缺少有效的屏幕分辨率"
      />
    );

    const canvas = screen.getByTestId('pixel-display-canvas');
    expect(canvas).toHaveAttribute('width', '128');
    expect(canvas).toHaveAttribute('height', '32');
    expect(canvas).toHaveAttribute('aria-label', '屏幕表情像素预览');
    expect(canvas.parentElement).toHaveStyle({
      aspectRatio: '128 / 32',
      boxSizing: 'content-box',
      width: '256px'
    });
    expect(fillRect).toHaveBeenCalledTimes(1);
    expect(fillRect).toHaveBeenCalledWith(1, 2, 1, 1);
  });

  test('uses the renderer profile preview color', () => {
    render(
      <PixelDisplay
        matrix={rasterizeDisplayFace('wio-320x240-v1', 'success-happy', 0)}
        accessibleLabel="屏幕表情像素预览"
        unavailableLabel="当前设备缺少有效的屏幕分辨率"
      />
    );

    expect(context.fillStyle).toBe('#00ff00');
  });

  test('shows an explicit unavailable state without creating a canvas', () => {
    render(
      <PixelDisplay
        matrix={null}
        accessibleLabel="屏幕表情像素预览"
        unavailableLabel="当前设备缺少有效的屏幕分辨率"
      />
    );

    expect(screen.getByText('当前设备缺少有效的屏幕分辨率')).toBeInTheDocument();
    expect(screen.queryByTestId('pixel-display-canvas')).not.toBeInTheDocument();
  });

  test('warns instead of throwing when Canvas 2D is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() =>
      render(
        <PixelDisplay
          matrix={{ ...frame(new Uint8Array([1])), width: 1, height: 1 }}
          accessibleLabel="屏幕表情像素预览"
          unavailableLabel="当前设备缺少有效的屏幕分辨率"
        />
      )
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      '[display-face-preview] Canvas 2D context is unavailable'
    );
  });
});
