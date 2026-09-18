import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { CustomFaceImagePixelizerWindow } from './CustomFaceImagePixelizerWindow';

const createPackedPixels = (width: number, height: number, activeByteIndex = 0) =>
  Array.from({ length: width * Math.ceil(height / 8) }, (_, index) =>
    index === activeByteIndex ? 1 : 0
  );

const waitForDebouncedPixelize = () =>
  act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 260);
    });
  });

const prepareSourceMock = vi.hoisted(() => vi.fn());
const pixelizeSourceMock = vi.hoisted(() => vi.fn());
const prepareGifSourceMock = vi.hoisted(() => vi.fn());
const pixelizeGifSourceMock = vi.hoisted(() => vi.fn());
const releaseSourceMock = vi.hoisted(() => vi.fn());
const applyMock = vi.hoisted(() => vi.fn());
const closePixelizerMock = vi.hoisted(() => vi.fn());
const emitMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const listenMock = vi.hoisted(() => vi.fn());
const windowApiMock = vi.hoisted(() => ({
  onCloseRequested: vi.fn(),
  unlisten: vi.fn(),
}));
let imagePixelizerOpenRequestHandler:
  ((event: { payload: { width: number; height: number } }) => void) | undefined;

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    prepareCustomFaceImagePixelizerSource: prepareSourceMock,
    pixelizeCustomFaceImageSource: pixelizeSourceMock,
    prepareCustomFaceGifPixelizerSource: prepareGifSourceMock,
    pixelizeCustomFaceGifSource: pixelizeGifSourceMock,
    releaseCustomFaceImagePixelizerSource: releaseSourceMock,
    applyCustomFaceImageImport: applyMock,
    closeCustomFaceImagePixelizer: closePixelizerMock,
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  emit: emitMock,
  listen: listenMock,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onCloseRequested: windowApiMock.onCloseRequested }),
}));

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' }));
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:text-source'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  prepareSourceMock.mockReset();
  pixelizeSourceMock.mockReset();
  prepareGifSourceMock.mockReset();
  pixelizeGifSourceMock.mockReset();
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
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    })),
    putImageData: vi.fn(),
    imageSmoothingEnabled: false,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D);
});

test('reads the canvas size from the window url', () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=128');

  render(<CustomFaceImagePixelizerWindow />);

  expect(screen.getByText('画布 128 × 128')).toBeInTheDocument();
});

test('keeps the pixelizer window itself from becoming a third scroll container', () => {
  render(<CustomFaceImagePixelizerWindow />);

  const root = screen.getByRole('main');
  const layout = root.querySelector('[data-testid="custom-face-image-pixelizer-layout"]');
  expect(root.className).toContain('overflow-hidden');
  expect(layout?.className).toContain('overflow-hidden');
  expect(layout?.querySelector('section')?.className).toContain('min-h-0');
  expect(layout?.querySelector('section')?.className).toContain('overflow-hidden');
  expect(
    layout?.querySelector('[data-testid="custom-face-image-pixelizer-viewport"]')?.className
  ).toContain('overflow-auto');
  expect(
    layout?.querySelector('[data-testid="custom-face-image-pixelizer-viewport"]')?.className
  ).toContain('overscroll-contain');
  expect(layout?.querySelector('aside')?.className).toContain('min-h-0');
  expect(layout?.querySelector('aside')?.className).toContain('overscroll-contain');
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

  expect(screen.getByRole('textbox', { name: '颜色数量数值' })).toBeDisabled();
});

test('renders source and conversion mode choices from the active language', () => {
  render(
    <I18nProvider language="en-US">
      <CustomFaceImagePixelizerWindow />
    </I18nProvider>
  );

  expect(screen.getByRole('button', { name: 'Image' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Monochrome' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '黑白' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '多色' })).not.toBeInTheDocument();
});

test('loads an image, supports monochrome and color preview modes, and applies pixels back to the editor', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());
  expect(prepareSourceMock).toHaveBeenCalledWith({
    profileWidth: 128,
    profileHeight: 32,
    imageBytes: [1, 2, 3],
  });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
  expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sourceId: 'source-1',
      options: expect.objectContaining({
        mode: 'mono',
        dither: false,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    })
  );
  expect(screen.getAllByTestId('custom-face-pixel-preview-canvas')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: '多色' }));
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledTimes(2));
  expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      sourceId: 'source-1',
      options: expect.objectContaining({ mode: 'color' }),
    })
  );

  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(applyMock).toHaveBeenCalledWith({
    packedPixels: createPackedPixels(128, 32),
    sourceWidth: 128,
    sourceHeight: 32,
  });
});

test('passes transparent background lighting separately from image invert for image sources', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-background-invert',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: { files: [new File([new Uint8Array([1])], 'transparent.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  expect(screen.getByRole('checkbox', { name: '图像反相' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: '透明背景点亮' }));
  await waitForDebouncedPixelize();

  await waitFor(() =>
    expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          invert: false,
          backgroundInvert: true,
        }),
      })
    )
  );
});

test('loads a GIF source and shows multi-frame preview with durations', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=32&mode=gif');
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-1',
    sourceWidth: 4,
    sourceHeight: 4,
    frameCount: 2,
    totalDurationMs: 350,
    durationWasClamped: true,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    sourceWidth: 4,
    sourceHeight: 4,
    totalDurationMs: 350,
    frames: [
      {
        durationMs: 50,
        packedPixels: createPackedPixels(128, 32),
        previewPixels: new Array(128 * 32 * 4).fill(255),
      },
      {
        durationMs: 300,
        packedPixels: createPackedPixels(128, 32, 1),
        previewPixels: new Array(128 * 32 * 4).fill(0),
      },
    ],
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([0x47, 0x49, 0x46])], 'animation.gif', {
    type: 'image/gif',
  });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(prepareGifSourceMock).toHaveBeenCalledOnce());
  expect(prepareGifSourceMock).toHaveBeenCalledWith({
    profileWidth: 128,
    profileHeight: 32,
    imageBytes: [0x47, 0x49, 0x46],
  });
  await waitFor(() => expect(pixelizeGifSourceMock).toHaveBeenCalledOnce());
  expect(screen.getByTestId('gif-import-timeline')).toBeInTheDocument();
  expect(screen.getByRole('main').className).toContain('overflow-hidden');
  expect(screen.getByTestId('custom-face-image-pixelizer-layout').className).toContain(
    'overflow-hidden'
  );
  expect(screen.getByRole('button', { name: 'GIF 第 1 帧' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'GIF 第 2 帧' })).toBeInTheDocument();
  expect(screen.getByText('总时长 350 ms')).toBeInTheDocument();
  expect(screen.getByText('50 ms')).toBeInTheDocument();
});

test('passes transparent background lighting to GIF source without changing transparency mode', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=32&mode=gif');
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-background-invert',
    sourceWidth: 4,
    sourceHeight: 4,
    frameCount: 1,
    totalDurationMs: 120,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    sourceWidth: 4,
    sourceHeight: 4,
    totalDurationMs: 120,
    frames: [
      {
        durationMs: 120,
        packedPixels: createPackedPixels(128, 32),
        previewPixels: new Array(128 * 32 * 4).fill(255),
        contentMask: new Array(128 * 32).fill(0),
      },
    ],
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: { files: [new File([new Uint8Array([1])], 'transparent.gif', { type: 'image/gif' })] },
  });
  await waitFor(() => expect(pixelizeGifSourceMock).toHaveBeenCalledOnce());

  fireEvent.click(screen.getByRole('checkbox', { name: '透明背景点亮' }));
  await waitForDebouncedPixelize();

  await waitFor(() =>
    expect(pixelizeGifSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          backgroundInvert: true,
        }),
      })
    )
  );
  expect(screen.getByText('当前选择：透明区域应用后覆盖为空')).toBeInTheDocument();
});

test('applies GIF overlay with original content masks after transparent background lighting', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=32&mode=gif');
  const contentMask = [1, 0, ...Array(128 * 32 - 2).fill(0)];
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-background-overlay',
    sourceWidth: 4,
    sourceHeight: 4,
    frameCount: 1,
    totalDurationMs: 120,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    sourceWidth: 4,
    sourceHeight: 4,
    totalDurationMs: 120,
    frames: [
      {
        durationMs: 120,
        packedPixels: createPackedPixels(128, 32),
        previewPixels: new Array(128 * 32 * 4).fill(255),
        contentMask,
      },
    ],
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: { files: [new File([new Uint8Array([1])], 'transparent-overlay.gif', { type: 'image/gif' })] },
  });
  await waitFor(() => expect(pixelizeGifSourceMock).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('checkbox', { name: '透明背景点亮' }));
  await waitForDebouncedPixelize();
  await waitFor(() => expect(pixelizeGifSourceMock).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole('button', { name: '透明处保留当前帧' }));
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  fireEvent.click(screen.getByRole('button', { name: '确认应用' }));

  await waitFor(() =>
    expect(applyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transparencyMode: 'overlay',
        contentMasks: [contentMask],
      })
    )
  );
});

test('switches the main canvas when selecting an in-limit GIF source frame', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=32&mode=gif');
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-select',
    sourceWidth: 4,
    sourceHeight: 4,
    frameCount: 2,
    totalDurationMs: 200,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    sourceWidth: 4,
    sourceHeight: 4,
    totalDurationMs: 200,
    frames: [
      {
        durationMs: 100,
        packedPixels: createPackedPixels(128, 32),
        previewPixels: new Array(128 * 32 * 4).fill(255),
      },
      {
        durationMs: 100,
        packedPixels: createPackedPixels(128, 32, 1),
        previewPixels: Object.assign(new Array(128 * 32 * 4).fill(0), { 4: 255 }),
      },
    ],
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: { files: [new File([new Uint8Array([1])], 'select.gif', { type: 'image/gif' })] },
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'GIF 第 2 帧' })).toBeInTheDocument()
  );

  expect(screen.getAllByLabelText('GIF 第 1 帧预览')[0]).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'GIF 第 2 帧' }));
  expect(screen.getByRole('button', { name: 'GIF 第 2 帧' }).className).toContain('border-primary');
  expect(screen.getByRole('button', { name: 'GIF 第 1 帧' }).className).not.toContain(
    'border-primary'
  );
  await waitFor(() => expect(screen.getAllByLabelText('GIF 第 2 帧预览')[0]).toBeInTheDocument());
});

test('keeps GIF placement controls compact and vertically aligned with header actions', async () => {
  window.history.replaceState(
    {},
    '',
    '/custom-face-image-pixelizer?width=128&height=32&mode=gif&selectedFrameIndex=0&frameCount=1'
  );
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-layout',
    sourceWidth: 4,
    sourceHeight: 4,
    frameCount: 1,
    totalDurationMs: 200,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    sourceWidth: 4,
    sourceHeight: 4,
    totalDurationMs: 200,
    frames: [
      {
        durationMs: 200,
        packedPixels: createPackedPixels(128, 32),
        previewPixels: new Array(128 * 32 * 4).fill(255),
        contentMask: new Array(128 * 32).fill(1),
      },
    ],
  });
  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File([new Uint8Array([1])], 'layout.gif', { type: 'image/gif' })] },
  });
  await waitFor(() => expect(screen.getByTestId('gif-application-options')).toBeInTheDocument());
  const options = screen.getByTestId('gif-application-options');
  expect(options).toContainElement(screen.getByTestId('gif-placement-switch'));
  expect(options).toContainElement(screen.getByTestId('gif-transparency-switch'));
  fireEvent.click(screen.getByRole('button', { name: '插入' }));
  expect(screen.getByRole('combobox', { name: 'GIF 插入位置' })).toBeInTheDocument();
  expect(screen.queryByTestId('gif-insertion-native-select')).not.toBeInTheDocument();
  expect(screen.getByTestId('gif-placement-switch').className).toContain('items-center');
});

test('uses the editor frame count rather than imported GIF frame count for insertion positions', async () => {
  window.history.replaceState(
    {},
    '',
    '/custom-face-image-pixelizer?width=128&height=32&mode=gif&selectedFrameIndex=0&frameCount=1'
  );
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-frame-count',
    sourceWidth: 4,
    sourceHeight: 4,
    frameCount: 3,
    totalDurationMs: 300,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    sourceWidth: 4,
    sourceHeight: 4,
    totalDurationMs: 300,
    frames: Array.from({ length: 3 }, (_, index) => ({
      durationMs: 100,
      packedPixels: createPackedPixels(128, 32, index),
      previewPixels: new Array(128 * 32 * 4).fill(255),
      contentMask: new Array(128 * 32).fill(1),
    })),
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: { files: [new File([new Uint8Array([1])], 'frame-count.gif', { type: 'image/gif' })] },
  });
  await waitFor(() => expect(screen.getByTestId('gif-application-options')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '插入' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'GIF 插入位置' }));

  expect(screen.getAllByRole('option')).toHaveLength(2);
  expect(screen.getByRole('option', { name: '最前面' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '最后面' })).toBeInTheDocument();
});

test('keeps the GIF frame policy prompt as a full-width block in the narrow options panel', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=320&height=240&mode=gif');
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-policy-layout',
    sourceWidth: 8,
    sourceHeight: 8,
    frameCount: 11,
    totalDurationMs: 1100,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 320,
    height: 240,
    sourceWidth: 8,
    sourceHeight: 8,
    totalDurationMs: 1100,
    frames: Array.from({ length: 11 }, (_, index) => ({
      durationMs: 100,
      packedPixels: createPackedPixels(320, 240, index),
      previewPixels: new Array(320 * 240 * 4).fill(255),
      contentMask: new Array(320 * 240).fill(1),
    })),
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: {
      files: [new File([new Uint8Array([1])], 'policy-layout.gif', { type: 'image/gif' })],
    },
  });

  await waitFor(() =>
    expect(screen.getByText('帧数超过 10 帧，请选择处理方式')).toBeInTheDocument()
  );
  const prompt = screen.getByText('帧数超过 10 帧，请选择处理方式');
  expect(prompt.className).toContain('w-full');
  expect(prompt.className).toContain('min-w-0');
});

test('uses forward manual selection as opt-in and updates the processed preview in real time', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=320&height=240&mode=gif');
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-manual-keep',
    sourceWidth: 8,
    sourceHeight: 8,
    frameCount: 11,
    totalDurationMs: 1100,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 320,
    height: 240,
    sourceWidth: 8,
    sourceHeight: 8,
    totalDurationMs: 1100,
    frames: Array.from({ length: 11 }, (_, index) => ({
      durationMs: 100,
      packedPixels: createPackedPixels(320, 240, index),
      previewPixels: new Array(320 * 240 * 4).fill(255),
      contentMask: new Array(320 * 240).fill(1),
    })),
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: { files: [new File([new Uint8Array([1])], 'manual-keep.gif', { type: 'image/gif' })] },
  });

  await waitFor(() => expect(screen.getByText('处理后预览 · 11 帧')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '正向选择（保留）' }));
  expect(screen.getByText('处理后预览 · 0 帧')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'GIF 第 1 帧' }).className).toContain('opacity-40');
  fireEvent.click(screen.getByRole('button', { name: 'GIF 第 1 帧' }));
  expect(screen.getByText('处理后预览 · 1 帧')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '处理后 GIF 第 1 帧' })).toBeInTheDocument();
  expect(screen.getByText('原始第 1 帧')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '处理后 GIF 第 1 帧' }));
  expect(screen.getByRole('button', { name: 'GIF 第 1 帧' }).className).toContain('border-primary');
});

test('uses reverse manual selection as opt-out and reflects processed durations', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=320&height=240&mode=gif');
  prepareGifSourceMock.mockResolvedValue({
    sourceId: 'gif-source-manual-discard',
    sourceWidth: 8,
    sourceHeight: 8,
    frameCount: 11,
    totalDurationMs: 1100,
    durationWasClamped: false,
  });
  pixelizeGifSourceMock.mockResolvedValue({
    width: 320,
    height: 240,
    sourceWidth: 8,
    sourceHeight: 8,
    totalDurationMs: 1100,
    frames: Array.from({ length: 11 }, (_, index) => ({
      durationMs: index === 0 ? 100 : 50,
      packedPixels: createPackedPixels(320, 240, index),
      previewPixels: new Array(320 * 240 * 4).fill(255),
      contentMask: new Array(320 * 240).fill(1),
    })),
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.change(screen.getByTestId('custom-face-image-input'), {
    target: {
      files: [new File([new Uint8Array([1])], 'manual-discard.gif', { type: 'image/gif' })],
    },
  });

  await waitFor(() => expect(screen.getByText('处理后预览 · 11 帧')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '反向选择（丢弃）' }));
  expect(screen.getByText('处理后预览 · 11 帧')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'GIF 第 1 帧' }));
  expect(screen.getByText('处理后预览 · 10 帧')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '仅保留帧原时长' }));
  expect(screen.getByText('总时长 500 ms')).toBeInTheDocument();
});

test('loads an image under react strict mode without leaving the workspace busy', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
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
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.5' } });
  fireEvent.change(screen.getByRole('slider', { name: '旋转' }), { target: { value: '45' } });
  fireEvent.change(screen.getByRole('slider', { name: '水平位置' }), { target: { value: '8' } });
  fireEvent.change(screen.getByRole('slider', { name: '垂直位置' }), { target: { value: '-4' } });
  await waitFor(() =>
    expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ scale: 1.5, rotationDeg: 45, offsetX: 8, offsetY: -4 }),
      })
    )
  );

  fireEvent.click(screen.getByRole('button', { name: '居中' }));
  await waitFor(() =>
    expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ scale: 1.5, rotationDeg: 45, offsetX: 0, offsetY: 0 }),
      })
    )
  );

  fireEvent.click(screen.getByRole('button', { name: '还原图像位置' }));
  await waitFor(() =>
    expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ scale: 1, rotationDeg: 0, offsetX: 0, offsetY: 0 }),
      })
    )
  );
});

test('debounces rapid parameter changes before pixelizing again', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
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
  expect(pixelizeSourceMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      options: expect.objectContaining({ scale: 1.3 }),
    })
  );
});

test('pixelizes once after object drag ends instead of on every pointer move', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
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
  const latestCall = pixelizeSourceMock.mock.calls[pixelizeSourceMock.mock.calls.length - 1];
  expect(latestCall?.[0].options.offsetX).not.toBe(0);
  expect(latestCall?.[0].options.offsetY).not.toBe(0);
});

test('drags the converted pixel result on the target canvas without rendering a source image overlay', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 1024,
    sourceHeight: 768,
    workingWidth: 128,
    workingHeight: 96,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 1024,
    sourceHeight: 768,
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(screen.getByTestId('custom-face-pixel-preview-canvas')).toBeInTheDocument()
  );

  expect(screen.getByTestId('image-pixelizer-source-thumb')).toHaveStyle({
    width: '96px',
    height: '96px',
  });
  expect(screen.getByTestId('image-pixelizer-source-thumb')).not.toHaveClass('overflow-hidden');
  expect(screen.queryByTestId('image-pixelizer-object')).not.toBeInTheDocument();
  expect(screen.getByTestId('custom-face-pixel-preview-canvas').parentElement).not.toHaveClass(
    'opacity-20'
  );
  const initialCall = pixelizeSourceMock.mock.calls[pixelizeSourceMock.mock.calls.length - 1];
  const initialOptions = initialCall?.[0].options;

  const screenCanvas = screen.getByTestId('custom-face-image-pixelizer-screen');
  fireEvent.pointerDown(screenCanvas, { pointerId: 1, buttons: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(screenCanvas, { pointerId: 1, buttons: 1, clientX: 132, clientY: 116 });
  fireEvent.pointerUp(screenCanvas, { pointerId: 1, clientX: 132, clientY: 116 });

  await waitFor(() => {
    const latestCall = pixelizeSourceMock.mock.calls[pixelizeSourceMock.mock.calls.length - 1];
    expect(latestCall?.[0].options).not.toEqual(initialOptions);
  });
  const latestCall = pixelizeSourceMock.mock.calls[pixelizeSourceMock.mock.calls.length - 1];
  expect(latestCall?.[0].options.offsetX).not.toBe(0);
  expect(latestCall?.[0].options.offsetY).not.toBe(0);

  const sourceThumb = screen.getByTestId('image-pixelizer-source-thumb');
  fireEvent.mouseEnter(sourceThumb);
  expect(sourceThumb).toHaveStyle({ width: '192px', height: '192px' });
  expect(screen.queryByTestId('image-pixelizer-object-hover')).not.toBeInTheDocument();
  fireEvent.mouseLeave(sourceThumb);
  expect(sourceThumb).toHaveStyle({ width: '96px', height: '96px' });
});

test('allows moving the source image thumbnail without changing pixelizer options', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 1024,
    sourceHeight: 768,
    workingWidth: 128,
    workingHeight: 96,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 1024,
    sourceHeight: 768,
  });

  render(<CustomFaceImagePixelizerWindow />);
  const input = screen.getByTestId('custom-face-image-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
  const initialCall = pixelizeSourceMock.mock.calls[pixelizeSourceMock.mock.calls.length - 1];
  const initialOptions = initialCall?.[0].options;

  const thumb = screen.getByTestId('image-pixelizer-source-thumb');
  fireEvent.pointerDown(thumb, { pointerId: 1, buttons: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(thumb, { pointerId: 1, buttons: 1, clientX: 36, clientY: 28 });
  fireEvent.pointerUp(thumb, { pointerId: 1, clientX: 36, clientY: 28 });

  expect(thumb).toHaveStyle({ transform: 'translate(34px, 26px)' });
  expect(pixelizeSourceMock).toHaveBeenCalledOnce();
  const latestCall = pixelizeSourceMock.mock.calls[pixelizeSourceMock.mock.calls.length - 1];
  expect(latestCall?.[0].options).toEqual(initialOptions);
});

test('stretches the converted pixel preview across the full target canvas viewport', async () => {
  window.history.replaceState({}, '', '/custom-face-image-pixelizer?width=128&height=128');
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 512,
    sourceHeight: 512,
    workingWidth: 128,
    workingHeight: 128,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 128,
    packedPixels: createPackedPixels(128, 128),
    previewPixels: new Array(128 * 128 * 4).fill(255),
    sourceWidth: 512,
    sourceHeight: 512,
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

  fireEvent.mouseEnter(
    screen.getByRole('button', {
      name: '黑白模式输出可直接应用的像素，多色模式用于测试预览和参数效果。 说明',
    }),
    {
      clientX: 10,
      clientY: 20,
    }
  );

  expect(screen.getByRole('tooltip')).toHaveTextContent('黑白模式输出可直接应用的像素');
});

test('clears the current image draft without applying pixels', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
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
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
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
    workingHeight: 8,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 8,
    sourceHeight: 8,
  });

  render(<CustomFaceImagePixelizerWindow />);
  const file = new File([new Uint8Array([9, 8, 7])], 'pasted.png', { type: 'image/png' });
  fireEvent.paste(window, {
    clipboardData: {
      files: [file],
    },
  });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalledOnce());
});

test('releases a prepared source that resolves after the window unmounts', async () => {
  let resolvePrepare:
    | ((value: {
        sourceId: string;
        sourceWidth: number;
        sourceHeight: number;
        workingWidth: number;
        workingHeight: number;
      }) => void)
    | undefined;
  prepareSourceMock.mockReturnValue(
    new Promise((resolve) => {
      resolvePrepare = resolve;
    })
  );

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
      workingHeight: 8,
    });
  });

  await waitFor(() => expect(releaseSourceMock).toHaveBeenCalledWith('source-after-unmount'));
  expect(pixelizeSourceMock).not.toHaveBeenCalled();
});

test('switches to text mode, renders text source, and applies the converted pixels', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'text-source-1',
    sourceWidth: 64,
    sourceHeight: 32,
    workingWidth: 64,
    workingHeight: 32,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 64,
    sourceHeight: 32,
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.click(screen.getByRole('button', { name: '文字' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文字内容' }), {
    target: { value: 'Hi\n通知' },
  });

  await waitFor(() =>
    expect(prepareSourceMock).toHaveBeenCalledWith({
      profileWidth: 128,
      profileHeight: 32,
      imageBytes: [4, 5, 6],
    })
  );
  await waitFor(() => expect(pixelizeSourceMock).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: '应用' }));
  expect(applyMock).toHaveBeenCalledWith({
    packedPixels: createPackedPixels(128, 32),
    sourceWidth: 128,
    sourceHeight: 32,
  });
});

test('uses the app select control for font family in text mode', () => {
  render(<CustomFaceImagePixelizerWindow />);

  fireEvent.click(screen.getByRole('button', { name: '文字' }));

  expect(screen.getByRole('combobox', { name: '字体' })).toBeInTheDocument();
  expect(document.querySelector('select[aria-label="字体"]')).not.toBeInTheDocument();
});

test('shows letter spacing control in text mode and regenerates the text source after changes', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'text-source-1',
    sourceWidth: 64,
    sourceHeight: 32,
    workingWidth: 64,
    workingHeight: 32,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 64,
    sourceHeight: 32,
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.click(screen.getByRole('button', { name: '文字' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文字内容' }), { target: { value: 'AB' } });
  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());

  fireEvent.change(screen.getByRole('slider', { name: '字间距' }), { target: { value: '0.5' } });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('textbox', { name: '字间距数值' })).toHaveValue('0.5');
});

test('locks text mode to monochrome conversion', async () => {
  render(<CustomFaceImagePixelizerWindow />);

  fireEvent.click(screen.getByRole('button', { name: '多色' }));
  fireEvent.click(screen.getByRole('button', { name: '文字' }));

  expect(screen.getByRole('button', { name: '多色' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: '颜色数量数值' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '黑白' })).toHaveClass('border-primary');
});

test('clears text input when clearing the text workspace', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'text-source-1',
    sourceWidth: 64,
    sourceHeight: 32,
    workingWidth: 64,
    workingHeight: 32,
  });
  pixelizeSourceMock.mockResolvedValue({
    width: 128,
    height: 32,
    packedPixels: createPackedPixels(128, 32),
    previewPixels: new Array(128 * 32 * 4).fill(255),
    sourceWidth: 64,
    sourceHeight: 32,
  });

  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.click(screen.getByRole('button', { name: '文字' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文字内容' }), {
    target: { value: 'Keep me' },
  });
  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalled());

  fireEvent.click(screen.getByRole('button', { name: '清空画布' }));

  expect(screen.getByRole('textbox', { name: '文字内容' })).toHaveValue('');
  expect(releaseSourceMock).toHaveBeenCalledWith('text-source-1');
});

test('restores text layout controls without clearing text on reset all', async () => {
  render(<CustomFaceImagePixelizerWindow />);
  fireEvent.click(screen.getByRole('button', { name: '文字' }));
  fireEvent.change(screen.getByRole('textbox', { name: '文字内容' }), {
    target: { value: 'Keep me' },
  });
  fireEvent.change(screen.getByRole('slider', { name: '字号' }), { target: { value: '48' } });

  fireEvent.click(screen.getByRole('button', { name: '还原设置' }));

  expect(screen.getByRole('textbox', { name: '文字内容' })).toHaveValue('Keep me');
  expect(screen.getByRole('slider', { name: '字号' })).toHaveValue('24');
});
