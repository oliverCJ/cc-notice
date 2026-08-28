import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceCanvas } from './CustomFaceCanvas';

const context = { clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), imageSmoothingEnabled: true, fillStyle: '', strokeStyle: '', lineWidth: 1 };

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 320, width: 1280, height: 320, toJSON: () => ({}) });
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('maps one pointer click to exactly one logical pixel', () => {
  const transaction = vi.fn();
  render(<CustomFaceCanvas width={128} height={32} pixels={new Uint8Array(512)} selectedTool="brush" onPixelTransaction={transaction} />);
  const canvas = screen.getByRole('img', { name: '自定义表情画布 128 × 32' });
  expect(screen.getByLabelText('像素网格')).toBeInTheDocument();
  expect(canvas.parentElement).toHaveStyle({ width: '128px', height: '32px' });
  expect(screen.queryByText(/像素 \d+px/)).not.toBeInTheDocument();
  fireEvent.pointerDown(canvas, { clientX: 15, clientY: 25, pointerId: 1 });
  expect(transaction).toHaveBeenCalledWith([{ x: 1, y: 2, active: true }]);
});

test('uses the configured eraser size for one erase transaction', () => {
  const transaction = vi.fn();
  render(<CustomFaceCanvas width={128} height={32} pixels={new Uint8Array(512)} selectedTool="eraser" eraserSize={4} onPixelTransaction={transaction} />);
  const canvas = screen.getByRole('img');
  fireEvent.pointerDown(canvas, { clientX: 55, clientY: 55, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 55, clientY: 55, pointerId: 1 });
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(transaction.mock.calls[0][0]).toHaveLength(16);
});
