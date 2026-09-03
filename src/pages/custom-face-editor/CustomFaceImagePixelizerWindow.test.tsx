import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceImagePixelizerWindow } from './CustomFaceImagePixelizerWindow';

const createPackedPixels = (width: number, height: number, activeByteIndex = 0) =>
  Array.from({ length: width * Math.ceil(height / 8) }, (_, index) => (index === activeByteIndex ? 1 : 0));

const waitForDebouncedPixelize = () => act(async () => {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 260);
  });
});

const prepareSourceMock = vi.hoisted(() => vi.fn());
const pixelizeSourceMock = vi.hoisted(() => vi.fn());
const releaseSourceMock = vi.hoisted(() => vi.fn());
const applyMock = vi.hoisted(() => vi.fn());
const closePixelizerMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const listenMock = vi.hoisted(() => vi.fn());
const windowApiMock = vi.hoisted(() => ({
  onCloseRequested: vi.fn(),
  unlisten: vi.fn()
}));
let imagePixelizerOpenRequestHandler: ((event: { payload: { width: number; height: number } }) => void) | undefined;

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    prepareCustomFaceImagePixelizerSource: prepareSourceMock,
    pixelizeCustomFaceImageSource: pixelizeSourceMock,
    releaseCustomFaceImagePixelizerSource: releaseSourceMock,
    applyCustomFaceImageImport: applyMock,
    closeCustomFaceImagePixelizer: closePixelizerMock
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  emit: emitMock,
  listen: listenMock
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onCloseRequested: windowApiMock.onCloseRequested })
}));

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  prepareSourceMock.mockReset();
  pixelizeSourceMock.mockReset();
  releaseSourceMock.mockReset().mockResolvedValue(undefined);
  applyMock.mockReset();
  closePixelizerMock.mockReset();
  emitMock.mockReset().mockResolvedValue(undefined);
  windowApiMock.onCloseRequested.mockReset().mockImplementation(async (handler) => {
    void handler;
    return windowApiMock.unlisten;
  });
  windowApiMock.unlisten.mockReset();
  imagePixelizerOpenRequestHandler = undefined;
  listenMock.mockReset().mockImplementation(async (_event, handler) => {
    imagePixelizerOpenRequestHandler = handler as typeof imagePixelizerOpenRequestHandler;
    return vi.fn();
  });
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=32');
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: vi.fn(() => true) });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), createImageData: vi.fn((width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })), putImageData: vi.fn(), imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1 } as unknown as CanvasRenderingContext2D);
});

test('reads the canvas size from the window url', () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=128');

  render(<CustomFaceImagePixelizerWindow />);

  expect(screen.getByText('画布 128 × 128')).toBeInTheDocument();
});

test('updates the canvas size when the backend reopens the existing window with a new target profile', async () => {
  render(<CustomFaceImagePixelizerWindow />);

  expect(screen.getByText('画布 128 × 32')).toBeInTheDocument();

  await waitFor(() => expect(imagePixelizerOpenRequestHandler).toBeDefined());
  await act(async () => {
    imagePixelizerOpenRequestHandler?.({ payload: { width: 128, height: 128 } });
  });

  expect(screen.getByText('画布 128 × 128')).toBeInTheDocument();
});

test('keeps color count disabled while monochrome is selected', () => {
  render(<CustomFaceImagePixelizerWindow />);

  expect(screen.getByRole('spinbutton', { name: '颜色数量数值' })).toBeDisabled();
});

test('loads an image, supports monochrome and color preview modes, and applies pixels back to the editor', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());
  expect(prepareSourceMock).toHaveBeenCalledWith({
    profileWidth: 128,
    profileHeight: 32,
    imageBytes: [1, 2, 3]
  });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
  expect(pixelizeSourceMock).toHaveBeenLastCalledWith(expect.objectContaining({
    sourceId: 'source-1',
    options: expect.objectContaining({ mode: 'mono', dither: false, scale: 1, offsetX: 0, offsetY: 0 })
  }));
  expect(screen.getAllByTestId('custom-face-pixel-preview-canvas')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: '多色' }));
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledTimes(2));
  expect(pixelizeSourceMock).toHaveBeenLastCalledWith(expect.objectContaining({
    sourceId: 'source-1',
    options: expect.objectContaining({ mode: 'color' })
  }));

  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(applyMock).toHaveBeenCalledWith({
    packedPixels: createPackedPixels(128, 32),
    sourceWidth: 128,
    sourceHeight: 32
  });
});

test('loads an image under react strict mode without leaving the workspace busy', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(
    <StrictMode>
      <CustomFaceImagePixelizerWindow />
    </StrictMode>
  );
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
  expect(screen.queryByText('加载中')).not.toBeInTheDocument();
  expect(screen.getByTestId('custom-face-pixel-preview-canvas')).toBeInTheDocument();
});

test('passes transform adjustments to the pixelizer and can reset them', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.5' } });
  fireEvent.change(screen.getByRole('slider', { name: '水平位置' }), { target: { value: '8' } });
  fireEvent.change(screen.getByRole('slider', { name: '垂直位置' }), { target: { value: '-4' } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenLastCalledWith(expect.objectContaining({
    options: expect.objectContaining({ scale: 1.5, offsetX: 8, offsetY: -4 })
  })));

  fireEvent.click(screen.getByRole('button', { name: '居中' }));
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenLastCalledWith(expect.objectContaining({
    options: expect.objectContaining({ scale: 1.5, offsetX: 0, offsetY: 0 })
  })));

  fireEvent.click(screen.getByRole('button', { name: '还原图像位置' }));
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenLastCalledWith(expect.objectContaining({
    options: expect.objectContaining({ scale: 1, offsetX: 0, offsetY: 0 })
  })));
});

test('debounces rapid parameter changes before pixelizing again', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.1' } });
  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.2' } });
  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.3' } });

  expect(pixelizeSourceMock).toHaveBeenCalledTimes(1);
  await waitForDebouncedPixelize();

  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledTimes(2));
  expect(pixelizeSourceMock).toHaveBeenLastCalledWith(expect.objectContaining({
    options: expect.objectContaining({ scale: 1.3 })
  }));
});

test('pixelizes once after object drag ends instead of on every pointer move', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  const screenCanvas = screen.getByTestId('custom-face-image-pixelizer-screen');
  fireEvent.pointerDown(screenCanvas, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(screenCanvas, { pointerId: 1, buttons: 1, clientX: 120, clientY: 112 });
  fireEvent.pointerMove(screenCanvas, { pointerId: 1, buttons: 1, clientX: 132, clientY: 116 });
  await waitForDebouncedPixelize();
  expect(pixelizeSourceMock).toHaveBeenCalledTimes(1);

  fireEvent.pointerUp(screenCanvas, { pointerId: 1, clientX: 132, clientY: 116 });

  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledTimes(2));
  expect(pixelizeSourceMock.mock.calls.at(-1)?.[0].options.offsetX).not.toBe(0);
  expect(pixelizeSourceMock.mock.calls.at(-1)?.[0].options.offsetY).not.toBe(0);
});

test('drags the converted pixel result on the target canvas without rendering a source image overlay', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 1024,
    sourceHeight: 768,
    workingWidth: 128,
    workingHeight: 96
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 1024,
    sourceHeight: 768
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByTestId('custom-face-pixel-preview-canvas')).toBeInTheDocument());

  expect(screen.getByTestId('image-pixelizer-source-thumb')).toHaveStyle({ width: '96px', height: '96px' });
  expect(screen.getByTestId('image-pixelizer-source-thumb')).not.toHaveClass('overflow-hidden');
  expect(screen.queryByTestId('image-pixelizer-object')).not.toBeInTheDocument();
  expect(screen.getByTestId('custom-face-pixel-preview-canvas').parentElement).not.toHaveClass('opacity-20');
  const initialOptions = pixelizeSourceMock.mock.calls.at(-1)?.[0].options;

  const screenCanvas = screen.getByTestId('custom-face-image-pixelizer-screen');
  fireEvent.pointerDown(screenCanvas, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(screenCanvas, { pointerId: 1, buttons: 1, clientX: 132, clientY: 116 });
  fireEvent.pointerUp(screenCanvas, { pointerId: 1, clientX: 132, clientY: 116 });

  await waitFor(() => expect(pixelizeSourceMock.mock.calls.at(-1)?.[0].options).not.toEqual(initialOptions));
  expect(pixelizeSourceMock.mock.calls.at(-1)?.[0].options.offsetX).not.toBe(0);
  expect(pixelizeSourceMock.mock.calls.at(-1)?.[0].options.offsetY).not.toBe(0);

  fireEvent.mouseEnter(screen.getByTestId('image-pixelizer-source-thumb'));
  await waitFor(() => expect(screen.getByTestId('image-pixelizer-object-hover')).toBeInTheDocument());
  expect(screen.getByTestId('image-pixelizer-object-hover')).toHaveStyle({ width: '192px', height: '192px' });
  fireEvent.mouseLeave(screen.getByTestId('image-pixelizer-source-thumb'));
  await waitFor(() => expect(screen.queryByTestId('image-pixelizer-object-hover')).not.toBeInTheDocument());
});

test('allows moving the source image thumbnail without changing pixelizer options', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 1024,
    sourceHeight: 768,
    workingWidth: 128,
    workingHeight: 96
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 1024,
    sourceHeight: 768
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
  const initialOptions = pixelizeSourceMock.mock.calls.at(-1)?.[0].options;

  const thumb = screen.getByTestId('image-pixelizer-source-thumb');
  fireEvent.pointerDown(thumb, { pointerId: 1, buttons: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(thumb, { pointerId: 1, buttons: 1, clientX: 36, clientY: 28 });
  fireEvent.pointerUp(thumb, { pointerId: 1, clientX: 36, clientY: 28 });

  expect(thumb).toHaveStyle({ transform: 'translate(34px, 26px)' });
  expect(pixelizeSourceMock).toHaveBeenCalledOnce();
  expect(pixelizeSourceMock.mock.calls.at(-1)?.[0].options).toEqual(initialOptions);
});

test('stretches the converted pixel preview across the full target canvas viewport', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=128');
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 512,
    sourceHeight: 512,
    workingWidth: 128,
    workingHeight: 128
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 128,
    packedPixels: createPackedPixels(128, 128),
    previewPixels: new Array(128 * 128 * 4).fill(255),
    sourceWidth: 512,
    sourceHeight: 512
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  const previewCanvas = await screen.findByTestId('custom-face-pixel-preview-canvas');

  expect(previewCanvas).toHaveStyle({ width: '100%', height: '100%' });
  expect(previewCanvas.parentElement).toHaveClass('absolute', 'inset-0');
});

test('shows parameter hints on hover', () => {
  render(<CustomFaceImagePixelizerWindow />);

  fireEvent.mouseEnter(screen.getByRole('button', { name: '黑白模式输出可直接应用的像素，多色模式用于测试预览和参数效果。' }), {
    clientX: 10,
    clientY: 20
  });

  expect(screen.getByRole('tooltip')).toHaveTextContent('黑白模式输出可直接应用的像素');
});

test('clears the current image draft without applying pixels', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  fireEvent.click(screen.getByRole('button', { name: '清空画布' }));
  await waitFor(() => expect(releaseSourceMock).toHaveBeenCalledWith('source-1'));
  expect(screen.queryByText('已选图片：sample.png')).not.toBeInTheDocument();
  expect(screen.queryByTestId('custom-face-pixel-preview-canvas')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(applyMock).not.toHaveBeenCalled();
});

test('closes the image pixelizer through the backend command', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  fireEvent.click(screen.getByRole('button', { name: '关闭' }));

  await waitFor(() => expect(releaseSourceMock).toHaveBeenCalledWith('source-1'));
  await waitFor(() => expect(closePixelizerMock).toHaveBeenCalledOnce());
});

test('accepts pasted image files as input', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8
  });

  render(<CustomFaceImagePixelizerWindow />);
  const file = new File([new Uint8Array([9, 8, 7])], 'pasted.png', { type: 'image/png' });
  fireEvent.paste(window, {
    clipboardData: {
      files: [file]
    }
  });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
});

test('releases a prepared source that resolves after the window unmounts', async () => {
  let resolvePrepare: ((value: {
    sourceId: string;
    sourceWidth: number;
    sourceHeight: number;
    workingWidth: number;
    workingHeight: number;
  }) => void) | undefined;
  prepareSourceMock.mockReturnValue(new Promise((resolve) => {
    resolvePrepare = resolve;
  }));

  const { unmount } = render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());

  unmount();
  await act(async () => {
    resolvePrepare?.({
      sourceId: 'source-after-unmount',
      sourceWidth: 8,
      sourceHeight: 8,
      workingWidth: 8,
      workingHeight: 8
    });
  });

  await waitFor(() => expect(releaseSourceMock).toHaveBeenCalledWith('source-after-unmount'));
  expect(pixelizeSourceMock).not.toHaveBeenCalled();
});
