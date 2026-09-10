import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceCanvas } from './CustomFaceCanvas';

const context = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  imageSmoothingEnabled: true,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
};

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLDivElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLDivElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(HTMLDivElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1280,
    bottom: 320,
    width: 1280,
    height: 320,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('maps one pointer click to exactly one logical pixel', () => {
  const transaction = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="brush"
      onPixelTransaction={transaction}
    />
  );
  const canvas = screen.getByRole('img', { name: '自定义表情画布 128 × 32' });
  expect(screen.getByLabelText('像素网格')).toBeInTheDocument();
  expect(canvas.parentElement).toHaveStyle({ width: '128px', height: '32px' });
  expect(screen.queryByText(/像素 \d+px/)).not.toBeInTheDocument();
  fireEvent.pointerDown(canvas, { clientX: 15, clientY: 25, pointerId: 1 });
  expect(transaction).toHaveBeenCalledWith([{ x: 1, y: 2, active: true }]);
});

test('selects a rotation pivot without creating a pixel transaction', () => {
  const transaction = vi.fn();
  const pivot = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="brush"
      selectionPivot={{ x: 3, y: 4 }}
      pickingSelectionPivot
      onSelectionPivotChange={pivot}
      onPixelTransaction={transaction}
    />
  );
  const canvas = screen.getByRole('img', { name: '自定义表情画布 128 × 32' });
  expect(screen.getAllByLabelText('旋转轴')).toHaveLength(2);
  fireEvent.pointerDown(canvas, { clientX: 55, clientY: 65, pointerId: 1 });
  expect(pivot).toHaveBeenCalledWith({ x: 5, y: 6 });
  expect(transaction).not.toHaveBeenCalled();
});

test('uses the configured eraser size for one erase transaction', () => {
  const transaction = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="eraser"
      eraserSize={4}
      onPixelTransaction={transaction}
    />
  );
  const canvas = screen.getByRole('img', { name: '自定义表情画布 128 × 32' });
  fireEvent.pointerDown(canvas, { clientX: 55, clientY: 55, pointerId: 1 });
  fireEvent.pointerUp(canvas, { clientX: 55, clientY: 55, pointerId: 1 });
  expect(transaction).toHaveBeenCalledTimes(1);
  expect(transaction.mock.calls[0][0]).toHaveLength(16);
});

test('maps a magnifier click to the shared full-canvas coordinate and can hide the panel', () => {
  const transaction = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="brush"
      onPixelTransaction={transaction}
    />
  );

  const magnifier = screen.getByRole('img', { name: '局部放大像素画布' });
  fireEvent.pointerDown(magnifier, { clientX: 400, clientY: 160, pointerId: 1 });
  expect(transaction).toHaveBeenCalledWith([{ x: 61, y: 16, active: true }]);

  fireEvent.click(screen.getByRole('button', { name: '关闭局部放大浮窗' }));
  expect(screen.queryByRole('img', { name: '局部放大像素画布' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '局部放大' })).toHaveAttribute('aria-pressed', 'false');
});

test('keeps magnifier erasing as one shared transaction', () => {
  const transaction = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="eraser"
      eraserSize={4}
      onPixelTransaction={transaction}
    />
  );
  const magnifier = screen.getByRole('img', { name: '局部放大像素画布' });

  fireEvent.pointerDown(magnifier, { clientX: 400, clientY: 160, pointerId: 1 });
  fireEvent.pointerUp(magnifier, { clientX: 400, clientY: 160, pointerId: 1 });

  expect(transaction).toHaveBeenCalledTimes(1);
  expect(transaction.mock.calls[0][0]).toHaveLength(16);
});

test('moves the locked magnifier frame without creating a pixel transaction', () => {
  const transaction = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="brush"
      onPixelTransaction={transaction}
    />
  );
  const canvas = screen.getByRole('img', { name: '自定义表情画布 128 × 32' });
  fireEvent.pointerMove(canvas, { clientX: 900, clientY: 200, pointerId: 1 });
  fireEvent.click(screen.getByRole('button', { name: '锁定放大区域' }));
  const frame = screen.getByLabelText('放大区域');
  expect(frame.querySelector('button')).toBeNull();

  fireEvent.pointerDown(frame, { clientX: 900, clientY: 200, pointerId: 2 });
  fireEvent.pointerMove(frame, { clientX: 884, clientY: 184, pointerId: 2 });
  fireEvent.pointerUp(frame, { clientX: 884, clientY: 184, pointerId: 2 });

  expect(screen.getByTestId('custom-face-magnifier-range')).toHaveTextContent('66,0 至 81,11');
  expect(transaction).not.toHaveBeenCalled();
});

test('locks the current magnifier range while the main canvas keeps moving', () => {
  const transaction = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="brush"
      onPixelTransaction={transaction}
    />
  );
  const canvas = screen.getByRole('img', { name: '自定义表情画布 128 × 32' });
  const lockButton = screen.getByRole('button', { name: '锁定放大区域' });

  fireEvent.pointerMove(canvas, { clientX: 900, clientY: 200, pointerId: 1 });
  expect(screen.getByTestId('custom-face-magnifier-range')).toHaveTextContent('82,14 至 97,25');
  fireEvent.click(lockButton);
  expect(screen.getByRole('button', { name: '解锁放大区域' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10, pointerId: 1 });
  expect(screen.getByTestId('custom-face-magnifier-range')).toHaveTextContent('82,14 至 97,25');
  expect(transaction).not.toHaveBeenCalled();
});

test('drags pending import pixels inside the canvas without editing the base frame', () => {
  const transaction = vi.fn();
  const movePendingImport = vi.fn();
  render(
    <CustomFaceCanvas
      width={128}
      height={32}
      pixels={new Uint8Array(512)}
      selectedTool="brush"
      pendingImportPixels={[1, ...Array(511).fill(0)]}
      pendingImportSize={{ width: 128, height: 32 }}
      pendingImportOffset={{ x: 0, y: 0 }}
      onPendingImportMove={movePendingImport}
      onPixelTransaction={transaction}
    />
  );

  const pendingImport = screen.getByLabelText('待确认导入对象');
  fireEvent.pointerDown(pendingImport, { clientX: 20, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(pendingImport, { clientX: 24, clientY: 23, pointerId: 1 });
  fireEvent.pointerUp(pendingImport, { clientX: 24, clientY: 23, pointerId: 1 });

  expect(movePendingImport).toHaveBeenCalledWith(4, 3);
  expect(transaction).not.toHaveBeenCalled();
});
