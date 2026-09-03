import { render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CustomFacePixelPreview } from './CustomFacePixelPreview';

const fillRect = vi.fn();
const putImageData = vi.fn();

beforeEach(() => {
  fillRect.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    fillRect,
    createImageData: vi.fn((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    })),
    putImageData,
    imageSmoothingEnabled: true,
    fillStyle: ''
  } as unknown as CanvasRenderingContext2D);
});

test('draws each active page-packed pixel at its logical coordinate', () => {
  const pixels = new Uint8Array(8);
  pixels[2 + Math.floor(5 / 8) * 8] = 1 << 5;

  render(<CustomFacePixelPreview width={8} height={8} packedPixels={pixels} ariaLabel="帧预览" />);

  expect(screen.getByRole('img', { name: '帧预览' })).toBeInTheDocument();
  expect(fillRect).toHaveBeenCalledWith(2, 5, 1, 1);
});

test('shows an explicit empty state instead of a black placeholder for empty pixels', () => {
  render(<CustomFacePixelPreview width={8} height={8} packedPixels={[]} ariaLabel="帧预览" />);

  expect(screen.getByText('空白帧')).toBeInTheDocument();
  expect(screen.queryByTestId('custom-face-pixel-preview-canvas')).not.toBeInTheDocument();
});

test('supports integer display scaling without changing logical canvas dimensions', () => {
  render(<CustomFacePixelPreview width={128} height={32} displayScale={5} packedPixels={[1, ...Array(511).fill(0)]} ariaLabel="放大预览" />);

  expect(screen.getByRole('img', { name: '放大预览' })).toHaveStyle({ width: '640px', height: '160px' });
});

test('renders rgba preview pixels when provided', () => {
  const rgbaPixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 255, 255
  ]);

  render(<CustomFacePixelPreview width={2} height={2} packedPixels={[]} rgbaPixels={rgbaPixels} ariaLabel="彩色预览" />);

  expect(putImageData).toHaveBeenCalledOnce();
  expect(screen.getByRole('img', { name: '彩色预览' })).toBeInTheDocument();
});
