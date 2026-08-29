import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { CustomFaceSvgImportDialog } from './CustomFaceSvgImportDialog';

const openMock = vi.hoisted(() => vi.fn());
const readSvgMock = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: openMock }));
vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return { ...actual, readCustomFaceSvg: readSvgMock };
});

beforeEach(() => { openMock.mockReset(); readSvgMock.mockReset(); });

test('selects only svg files, previews target resolution and applies packed pixels once', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="3" height="2" /></svg>');
  const onApply = vi.fn();

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={onApply} />);
  expect(screen.getByRole('dialog')).toHaveClass('max-w-none');
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));

  await waitFor(() => expect(screen.getByText(/目标分辨率/)).toBeInTheDocument());
  expect(openMock).toHaveBeenCalledWith(expect.objectContaining({ multiple: false, directory: false, filters: [{ name: 'SVG 图像', extensions: ['svg'] }] }));
  expect(screen.getByTestId('svg-import-screen')).toHaveStyle({ aspectRatio: '8 / 8' });
  expect(screen.getByTestId('svg-import-screen')).toHaveStyle({ maxWidth: '800px' });
  expect(screen.getByRole('spinbutton', { name: '水平位置 X' })).toHaveValue(0);
  fireEvent.change(screen.getByRole('spinbutton', { name: '水平位置 X' }), { target: { value: '3' } });
  expect(screen.getByRole('spinbutton', { name: '水平位置 X' })).toHaveValue(3);
  fireEvent.click(screen.getByRole('button', { name: '左上角' }));
  expect(screen.getByRole('spinbutton', { name: '水平位置 X' })).toHaveValue(0);
  fireEvent.click(screen.getByRole('button', { name: '应用到当前帧' }));
  expect(onApply).toHaveBeenCalledOnce();
  expect(onApply.mock.calls[0][0]).toHaveLength(8);
  expect(onApply.mock.calls[0][1]).toBe('merge');
});

test('rejects a transformed svg with no visible pixels', async () => {
  openMock.mockResolvedValue('/tmp/empty.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="2" /></svg>');
  const onApply = vi.fn();

  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByText(/高亮像素/)).toBeInTheDocument());
  fireEvent.change(screen.getByRole('slider', { name: '水平偏移' }), { target: { value: '8' } });
  expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeDisabled();
  expect(onApply).not.toHaveBeenCalled();
});

test('allows switching SVG import from merge to replace mode', async () => {
  openMock.mockResolvedValue('/tmp/face.svg');
  readSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="2" height="2" /></svg>');
  const onApply = vi.fn();
  render(<CustomFaceSvgImportDialog open width={8} height={8} onCancel={vi.fn()} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: '选择 SVG 文件' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: '覆盖当前帧' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('radio', { name: '覆盖当前帧' }));
  fireEvent.click(screen.getByRole('button', { name: '应用到当前帧' }));
  expect(onApply).toHaveBeenCalledWith(expect.any(Array), 'replace');
});
