import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { CustomFaceGroupSummary } from '@/api/tauriApi';
import { DeleteGroupDialog, RenameGroupDialog, ResizeGroupDialog } from './CustomFaceGroupDialogs';

const group: CustomFaceGroupSummary = { groupId: 'g', name: '测试组', displayProfileId: 'custom-mono-128x32-v1', revision: 1, defaultFaceId: 'f', faceCount: 3, libraryHash: 'hash' };

test('submits target profile and editable name in resize dialog', () => {
  const onConfirm = vi.fn();
  render(<ResizeGroupDialog group={group} open busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
  fireEvent.change(screen.getByRole('textbox', { name: '新组名称' }), { target: { value: '目标组' } });
  fireEvent.click(screen.getByRole('combobox', { name: '目标分辨率' }));
  fireEvent.click(screen.getByRole('option', { name: '128 × 64 · 最多 10 帧' }));
  fireEvent.click(screen.getByRole('button', { name: '创建并打开' }));
  expect(onConfirm).toHaveBeenCalledWith('custom-mono-128x64-v1', '目标组');
});

test('requires explicit confirmation before deleting a group', () => {
  const onConfirm = vi.fn();
  render(<DeleteGroupDialog group={group} open busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
  expect(screen.getByText(/将删除“测试组”/)).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
  expect(onConfirm).toHaveBeenCalledOnce();
});

test('submits the edited group name', () => {
  const onConfirm = vi.fn();
  render(<RenameGroupDialog group={group} open busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
  fireEvent.change(screen.getByRole('textbox', { name: '组名称' }), { target: { value: '新名称' } });
  fireEvent.click(screen.getByRole('button', { name: '确认重命名' }));
  expect(onConfirm).toHaveBeenCalledWith('新名称');
});
