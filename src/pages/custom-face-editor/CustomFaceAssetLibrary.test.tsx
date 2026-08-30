import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CustomFaceAssetLibrary } from './CustomFaceAssetLibrary';

test('switches between group and public personal assets', () => {
  const onApplyPersonal = vi.fn();
  const asset = { assetId: 'a', scope: 'group' as const, groupId: 'g', name: '素材', tags: [], profileId: 'p', width: 8, height: 8, packedPixels: [0], source: 'editor', createdAt: '', updatedAt: '' };
  const view = render(<CustomFaceAssetLibrary groupId="g" activeTab="group" onTabChange={() => undefined} personalAssets={[asset]} onApplyPersonal={onApplyPersonal} />);
  expect(screen.getByText('素材')).toBeInTheDocument();
  view.rerender(<CustomFaceAssetLibrary groupId="g" activeTab="public" onTabChange={() => undefined} personalAssets={[asset]} onApplyPersonal={onApplyPersonal} />);
  expect(screen.getByText('暂无素材')).toBeInTheDocument();
});

test('filters assets through visible tag buttons and clears the filter', () => {
  const assets = [
    { assetId: 'a', scope: 'public' as const, groupId: null, name: '角色', tags: ['角色'], profileId: 'p', width: 8, height: 8, packedPixels: [1], source: 'editor', createdAt: '', updatedAt: '' },
    { assetId: 'b', scope: 'public' as const, groupId: null, name: '背景', tags: ['背景'], profileId: 'p', width: 8, height: 8, packedPixels: [1], source: 'editor', createdAt: '', updatedAt: '' }
  ];
  render(<CustomFaceAssetLibrary groupId="g" activeTab="public" onTabChange={() => undefined} personalAssets={assets} />);
  fireEvent.click(screen.getByRole('button', { name: '角色' }));
  expect(screen.getAllByText('角色').length).toBeGreaterThan(0);
  expect(screen.getAllByText('背景').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));
  expect(screen.getAllByText('背景').length).toBeGreaterThan(0);
});

test('edits asset tags inline and persists the submitted values', () => {
  const onUpdateTags = vi.fn();
  const asset = { assetId: 'a', scope: 'public' as const, groupId: null, name: '素材', tags: ['旧'], profileId: 'p', width: 8, height: 8, packedPixels: [1], source: 'editor', createdAt: '', updatedAt: '' };
  render(<CustomFaceAssetLibrary groupId="g" activeTab="public" onTabChange={() => undefined} personalAssets={[asset]} onUpdateTags={onUpdateTags} />);
  fireEvent.click(screen.getByRole('button', { name: '标签' }));
  fireEvent.change(screen.getByRole('textbox', { name: '素材标签' }), { target: { value: '角色, 主角' } });
  fireEvent.click(screen.getByRole('button', { name: '确认标签' }));
  expect(onUpdateTags).toHaveBeenCalledWith(asset, ['角色', '主角']);
});
