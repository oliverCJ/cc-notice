import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceSvgImportDialog } from './CustomFaceSvgImportDialog';

const rasterizeMock = vi.hoisted(() => vi.fn());
const openMock = vi.hoisted(() => vi.fn());
const readSvgMock = vi.hoisted(() => vi.fn());

vi.mock('@/domain/customFaces/svg/svgRasterizer', () => ({
  rasterizeSvg: rasterizeMock,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openMock }));
vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>(
    '@/api/tauriApi',
  );
  return { ...actual, readCustomFaceSvg: readSvgMock };
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
  openMock.mockReset();
  readSvgMock.mockReset();
  rasterizeMock.mockReset();
  rasterizeMock.mockResolvedValue(raster(1));
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
