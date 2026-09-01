import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceMagnifier } from './CustomFaceMagnifier';

const context = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  imageSmoothingEnabled: true,
  fillStyle: '',
};

beforeEach(() => {
  context.clearRect.mockReset();
  context.fillRect.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: vi.fn(() => true) });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
});

test('renders only the selected logical viewport from the shared packed pixels', () => {
  const pixels = new Uint8Array(16 * 2);
  pixels[5 + Math.floor(4 / 8) * 16] = 1 << (4 & 7);
  pixels[10 + Math.floor(7 / 8) * 16] = 1 << (7 & 7);

  render(
    <CustomFaceMagnifier
      canvasWidth={16}
      canvasHeight={12}
      pixels={pixels}
      viewport={{ originX: 4, originY: 3, width: 6, height: 5 }}
      scale={16}
      pointer={[6, 5]}
      mode="follow"
      cursorClassName="cursor-crosshair"
      onPointerDown={() => undefined}
      onPointerMove={() => undefined}
      onPointerUp={() => undefined}
      onPointerLeave={() => undefined}
      onKeyDown={() => undefined}
      onModeChange={() => undefined}
    />,
  );

  expect(screen.getByRole('img', { name: '局部放大像素画布' })).toHaveAttribute('width', '6');
  expect(screen.getByRole('img', { name: '局部放大像素画布' })).toHaveAttribute('height', '5');
  expect(context.fillRect).toHaveBeenCalledWith(1, 1, 1, 1);
  expect(context.fillRect).not.toHaveBeenCalledWith(6, 4, 1, 1);
});

test('drags the floating panel by its header and closes it without editing pixels', () => {
  const onClose = vi.fn();
  const onModeChange = vi.fn();
  render(
    <CustomFaceMagnifier
      canvasWidth={16}
      canvasHeight={12}
      pixels={new Uint8Array(32)}
      viewport={{ originX: 4, originY: 3, width: 6, height: 5 }}
      scale={16}
      pointer={null}
      mode="follow"
      cursorClassName="cursor-crosshair"
      onPointerDown={() => undefined}
      onPointerMove={() => undefined}
      onPointerUp={() => undefined}
      onPointerLeave={() => undefined}
      onKeyDown={() => undefined}
      onModeChange={onModeChange}
      onClose={onClose}
    />,
  );

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 1000 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 300 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 300 });
  const panel = screen.getByRole('region', { name: '局部放大画布' });
  const header = panel.querySelector('div.mb-2') as HTMLElement;
  fireEvent.pointerDown(header, { clientX: 30, clientY: 40, pointerId: 1 });
  fireEvent.pointerMove(header, { clientX: 50, clientY: 60, pointerId: 1 });
  expect(panel.style.left).toBeTruthy();
  expect(panel.style.top).toBeTruthy();

  fireEvent.pointerUp(header, { clientX: 50, clientY: 60, pointerId: 1 });

  fireEvent.click(screen.getByRole('button', { name: '关闭局部放大浮窗' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onModeChange).not.toHaveBeenCalled();
});
