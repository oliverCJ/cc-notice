import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { CustomFaceItemImportPreview } from '@/api/tauriApi';
import { CustomFaceItemImportDialog } from './CustomFaceItemImportDialog';

const preview: CustomFaceItemImportPreview = {
  face: {
    faceId: '00000000-0000-4000-8000-000000000111',
    name: 'Ready',
    color: { red: 1, green: 2, blue: 3 },
    frames: [{ durationMs: 205, packedPixels: [0, 1] }],
  },
  displayProfileId: 'custom-mono-128x32-v1',
  width: 128,
  height: 32,
  frameCount: 1,
  totalDurationMs: 205,
  contentHash: 'a'.repeat(64),
  sourceFaceId: '00000000-0000-4000-8000-000000000111',
};

test('confirms a renamed single face import without replacement options', () => {
  const onConfirm = vi.fn();
  render(
    <CustomFaceItemImportDialog
      open
      preview={preview}
      maxFacesReached={false}
      duplicate
      onCancel={vi.fn()}
      onConfirm={onConfirm}
    />
  );

  expect(screen.getByText('当前组中已有内容相同的表情，仍可导入副本。')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: '导入后的表情名称' }), {
    target: { value: 'Ready copy' },
  });
  fireEvent.click(screen.getByRole('button', { name: '导入为新表情' }));

  expect(onConfirm).toHaveBeenCalledWith('Ready copy');
  expect(screen.queryByText(/替换当前表情/)).not.toBeInTheDocument();
});

test('blocks confirmation when the target group is full', () => {
  render(
    <CustomFaceItemImportDialog
      open
      preview={preview}
      maxFacesReached
      duplicate={false}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />
  );

  expect(screen.getByRole('alert')).toHaveTextContent('当前组已达到 15 个表情，无法继续导入。');
  expect(screen.getByRole('button', { name: '导入为新表情' })).toBeDisabled();
});
