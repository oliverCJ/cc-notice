import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CustomFaceGifExportDialog } from './CustomFaceGifExportDialog';

test('shows integer scales and updates the physical export size', () => {
  const onConfirm = vi.fn();
  render(
    <CustomFaceGifExportDialog
      open
      width={320}
      height={240}
      frameCount={5}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />
  );

  expect(screen.getAllByText('320 × 240')).toHaveLength(2);
  fireEvent.click(screen.getByRole('combobox', { name: '导出倍率' }));
  expect(screen.getByRole('option', { name: '8×' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '9×' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: '4×' }));
  expect(screen.getByText('1280 × 960')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '选择保存位置' }));
  expect(onConfirm).toHaveBeenCalledWith({
    scale: 4,
    invert: false,
    transparentBackground: false,
    frameIndices: [],
  });
});

test('supports custom frame selection', () => {
  const onConfirm = vi.fn();
  render(
    <CustomFaceGifExportDialog
      open
      width={320}
      height={240}
      frameCount={5}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />
  );

  // Switch to custom frame selection
  fireEvent.click(screen.getByLabelText('自定义选择帧'));

  // Get all checkboxes for frames (not the option checkboxes)
  const frameLabels = screen.getAllByRole('checkbox').filter((cb) => {
    const parent = cb.closest('label');
    return parent && /^\d+$/.test(parent.textContent?.trim() || '');
  });

  // Select frames 1, 3, 5 (indices 0, 2, 4)
  fireEvent.click(frameLabels[0]); // frame 1
  fireEvent.click(frameLabels[2]); // frame 3
  fireEvent.click(frameLabels[4]); // frame 5

  expect(screen.getByText('已选择 3 帧')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '选择保存位置' }));
  expect(onConfirm).toHaveBeenCalledWith({
    scale: 1,
    invert: false,
    transparentBackground: false,
    frameIndices: [0, 2, 4],
  });
});
