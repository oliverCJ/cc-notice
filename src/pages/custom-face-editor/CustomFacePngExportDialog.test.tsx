import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CustomFacePngExportDialog } from './CustomFacePngExportDialog';

test('shows integer scales and updates the physical export size', () => {
  const onConfirm = vi.fn();
  render(
    <CustomFacePngExportDialog
      open
      width={320}
      height={240}
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
  expect(onConfirm).toHaveBeenCalledWith({ scale: 4, invert: false, transparentBackground: false });
});

test('supports invert and transparent background options', () => {
  const onConfirm = vi.fn();
  render(
    <CustomFacePngExportDialog
      open
      width={320}
      height={240}
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />
  );

  // Enable invert
  const invertCheckbox = screen.getByLabelText('反色（黑底白图变白底黑图）');
  fireEvent.click(invertCheckbox);

  // Enable transparent background
  const transparentCheckbox = screen.getByLabelText('透明背景（去除背景色）');
  fireEvent.click(transparentCheckbox);

  fireEvent.click(screen.getByRole('button', { name: '选择保存位置' }));
  expect(onConfirm).toHaveBeenCalledWith({ scale: 1, invert: true, transparentBackground: true });
});
