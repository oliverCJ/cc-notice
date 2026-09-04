import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceSvgImportDialog } from './CustomFaceSvgImportDialog';

const rasterizeMock = vi.hoisted(() => vi.fn());
const openMock = vi.hoisted(() => vi.fn());
const readSvgMock = vi.hoisted(() => vi.fn());
const openVectorizerMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/domain/customFaces/svg/svgRasterizer', () => ({
  rasterizeSvg: rasterizeMock,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openMock }));
vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>(
    '@/api/tauriApi',
  );
  return { ...actual, openCustomFaceImageVectorizer: openVectorizerMock, readCustomFaceSvg: readSvgMock };
});

const raster = (value: number) => ({
  pixels: new Uint8Array(8).fill(value),
  activePixelCount: 1,
  clipped: false,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  openMock.mockReset();
  readSvgMock.mockReset();
  openVectorizerMock.mockReset().mockResolvedValue(undefined);
  rasterizeMock.mockReset();
  rasterizeMock.mockResolvedValue(raster(1));
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: vi.fn(() => true) });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() });
});

test('loads svg content from an external initial source path', async () => {
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="4" height="4" /></svg>');

  render(
    <CustomFaceSvgImportDialog
      open
      width={8}
      height={8}
      initialSourcePath="/tmp/vectorized.svg"
      initialSourceRevision={1}
      onCancel={vi.fn()}
      onApply={vi.fn()}
    />
  );

  await waitFor(() => expect(readSvgMock).toHaveBeenCalledWith('/tmp/vectorized.svg'));
  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());
});

test('uses brightness recognition by default for vectorizer supplied svg paths', async () => {
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="4" height="4" /></svg>');

  render(
    <CustomFaceSvgImportDialog
      open
      width={8}
      height={8}
      initialSourcePath="/tmp/vectorized.svg"
      initialSourceRevision={1}
      onCancel={vi.fn()}
      onApply={vi.fn()}
    />
  );

  await waitFor(() => expect(readSvgMock).toHaveBeenCalledWith('/tmp/vectorized.svg'));
  await waitFor(() => expect(rasterizeMock).toHaveBeenLastCalledWith(
    expect.anything(),
    { width: 8, height: 8 },
    expect.objectContaining({ recognitionMode: 'brightness' }),
  ));
  expect(screen.getByRole('radio', { name: '按亮度识别像素' })).toBeChecked();
});

test('opens the image vectorizer from the svg import dialog', async () => {
  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '从图片生成' }));

  await waitFor(() => expect(openVectorizerMock).toHaveBeenCalledOnce());
  expect(openVectorizerMock).toHaveBeenCalledWith({ width: 8, height: 8 });
});

test('selects only svg files, previews target resolution and applies packed pixels once', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="3" height="2" /></svg>');
  const onApply = vi.fn();

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={onApply} />);
  expect(screen.getByRole('dialog')).toHaveClass('max-w-none');
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));

  await waitFor(() => expect(screen.getByText(/目标分辨率/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());
  expect(screen.getByRole('checkbox', { name: '反转图像亮点' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: '按透明度识别像素' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '按亮度识别像素' })).not.toBeChecked();
  expect(openMock).toHaveBeenCalledWith(expect.objectContaining({ multiple: false, directory: false, filters: [{ name: 'SVG 图像', extensions: ['svg'] }] }));
  expect(screen.getByTestId('svg-import-screen')).toHaveStyle({ aspectRatio: '8 / 8' });
  expect(screen.getByTestId('svg-import-screen')).toHaveStyle({ width: '128px', height: '128px' });
  expect(screen.getByRole('spinbutton', { name: '水平位置 X' })).toHaveValue(0);
  fireEvent.click(screen.getByRole('checkbox', { name: '反转图像亮点' }));
  await waitFor(() => expect(rasterizeMock).toHaveBeenLastCalledWith(expect.anything(), { width: 8, height: 8 }, expect.objectContaining({ invert: true })));
  fireEvent.change(screen.getByRole('spinbutton', { name: '水平位置 X' }), { target: { value: '3' } });
  expect(screen.getByRole('spinbutton', { name: '水平位置 X' })).toHaveValue(3);
  fireEvent.click(screen.getByRole('button', { name: '左上角' }));
  expect(screen.getByRole('spinbutton', { name: '水平位置 X' })).toHaveValue(0);
  await waitFor(() => expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '应用到当前帧' }));
  expect(onApply).toHaveBeenCalledOnce();
  expect(onApply.mock.calls[0][0]).toHaveLength(8);
  expect(onApply.mock.calls[0][1]).toBe('merge');
});

test('switches pixel recognition mode and passes it to rasterization', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="4" height="4" /></svg>');

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());

  fireEvent.click(screen.getByRole('radio', { name: '按亮度识别像素' }));
  expect(screen.getByRole('radio', { name: '按亮度识别像素' })).toBeChecked();
  expect(screen.getByText('适合白底黑图；深色像素更容易转换为亮点，透明像素仍保持熄灭。')).toBeInTheDocument();
  await waitFor(() => expect(rasterizeMock).toHaveBeenLastCalledWith(
    expect.anything(),
    { width: 8, height: 8 },
    expect.objectContaining({ recognitionMode: 'brightness' }),
  ));
});

test('accepts vtracer-like svg output without a viewBox', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 0 H8 V8 H0 Z" fill="#000000" transform="translate(0,0)"/></svg>');

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));

  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('lets the svg preview object move inside the import canvas by dragging', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="4" height="4" /></svg>');

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());

  const screenElement = screen.getByTestId('svg-import-screen');
  fireEvent.pointerDown(screenElement, { clientX: 20, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(screenElement, { clientX: 36, clientY: 4, pointerId: 1 });
  fireEvent.pointerUp(screenElement, { clientX: 36, clientY: 4, pointerId: 1 });

  expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalled();
  await waitFor(() => expect(rasterizeMock).toHaveBeenLastCalledWith(
    expect.anything(),
    { width: 8, height: 8 },
    expect.objectContaining({ offsetX: 1, offsetY: -1 }),
  ));
});

test('supports precise range adjustments with step buttons and boundaries', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="4" height="4" /></svg>');

  render(<CustomFaceSvgImportDialog open width={8} height={6} onCancel={vi.fn()} onApply={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());

  expect(screen.getByRole('button', { name: '减少缩放' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '增加缩放' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '减少旋转' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '增加旋转' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '减少像素覆盖阈值' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '增加像素覆盖阈值' })).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: '增加缩放' }));
  fireEvent.click(screen.getByRole('button', { name: '增加缩放' }));
  fireEvent.click(screen.getByRole('button', { name: '增加旋转' }));
  fireEvent.click(screen.getByRole('button', { name: '减少像素覆盖阈值' }));
  fireEvent.click(screen.getByRole('button', { name: '增加水平偏移' }));
  fireEvent.click(screen.getByRole('button', { name: '减少垂直偏移' }));

  expect(screen.getByRole('slider', { name: '缩放' })).toHaveValue('1.1');
  expect(screen.getByRole('slider', { name: '旋转' })).toHaveValue('1');
  expect(screen.getByRole('slider', { name: '像素覆盖阈值' })).toHaveValue('49');
  expect(screen.getByRole('slider', { name: '水平偏移' })).toHaveValue('1');
  expect(screen.getByRole('slider', { name: '垂直偏移' })).toHaveValue('-1');
  await waitFor(() => expect(rasterizeMock).toHaveBeenLastCalledWith(
    expect.anything(),
    { width: 8, height: 6 },
    expect.objectContaining({ offsetX: 1, offsetY: -1, scale: 1.1, rotationDeg: 1, threshold: 49 }),
  ));

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '4' } });
  fireEvent.change(screen.getByRole('slider', { name: '旋转' }), { target: { value: '180' } });
  fireEvent.change(screen.getByRole('slider', { name: '像素覆盖阈值' }), { target: { value: '100' } });
  fireEvent.change(screen.getByRole('slider', { name: '水平偏移' }), { target: { value: '8' } });
  fireEvent.change(screen.getByRole('slider', { name: '垂直偏移' }), { target: { value: '6' } });

  expect(screen.getByRole('button', { name: '增加缩放' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '增加旋转' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '增加像素覆盖阈值' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '增加水平偏移' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '增加垂直偏移' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: '减少缩放' }));
  expect(screen.getByRole('slider', { name: '缩放' })).toHaveValue('3.95');
});

test('keeps the completed preview visible while parameter rendering is pending', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="2" /></svg>');
  const nextRaster = deferred<ReturnType<typeof raster>>();
  rasterizeMock.mockResolvedValueOnce(raster(1)).mockReturnValueOnce(nextRaster.promise);

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByTestId('custom-face-pixel-preview-canvas')).toBeInTheDocument());

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.5' } });

  expect(screen.getByTestId('custom-face-pixel-preview-canvas')).toBeInTheDocument();
  expect(screen.getByText('正在更新预览…')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeDisabled();

  nextRaster.resolve(raster(2));
  await waitFor(() => expect(screen.queryByText('正在更新预览…')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeEnabled();
});

test('keeps only the latest asynchronous raster result after consecutive changes', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="2" /></svg>');
  const staleRaster = deferred<ReturnType<typeof raster>>();
  const latestRaster = deferred<ReturnType<typeof raster>>();
  rasterizeMock
    .mockResolvedValueOnce(raster(1))
    .mockReturnValueOnce(staleRaster.promise)
    .mockReturnValueOnce(latestRaster.promise);
  const onApply = vi.fn();

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByText(/高亮像素：1/)).toBeInTheDocument());

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.5' } });
  fireEvent.change(screen.getByRole('slider', { name: '旋转' }), { target: { value: '15' } });
  staleRaster.resolve(raster(2));
  latestRaster.resolve(raster(3));

  await waitFor(() => expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '应用到当前帧' }));
  expect(onApply).toHaveBeenCalledWith(Array(8).fill(3), 'merge');
});

test('allows switching SVG import from merge to replace mode', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="2" /></svg>');
  const onApply = vi.fn();
  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: '覆盖当前帧' })).toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: '覆盖当前帧' }));
  fireEvent.click(screen.getByRole('button', { name: '应用到当前帧' }));
  expect(onApply).toHaveBeenCalledWith(expect.any(Array), 'replace');
});
