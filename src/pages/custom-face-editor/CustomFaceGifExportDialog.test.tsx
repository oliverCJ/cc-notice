import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CustomFaceGifExportDialog } from './CustomFaceGifExportDialog';

test('shows integer scales and updates the physical export size', () => {
  const onConfirm = vi.fn();
  render(<CustomFaceGifExportDialog open width={320} height={240} onCancel={vi.fn()} onConfirm={onConfirm} />);

  expect(screen.getAllByText('320 × 240')).toHaveLength(2);
  fireEvent.click(screen.getByRole('combobox', { name: '导出倍率' }));
  expect(screen.getByRole('option', { name: '4×' })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '5×' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: '4×' }));
  expect(screen.getByText('1280 × 960')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '选择保存位置' }));
  expect(onConfirm).toHaveBeenCalledWith(4);
});
