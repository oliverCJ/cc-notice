import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CustomFaceAssetLibrary } from './CustomFaceAssetLibrary';

vi.mock('@/i18n', () => ({
  useI18n: () => (key: string) => key,
}));

describe('CustomFaceAssetLibrary', () => {
  test('enables animated preview only while hovering an asset card', () => {
    render(
      <CustomFaceAssetLibrary
        groupId="group-a"
        activeTab="group"
        onTabChange={vi.fn()}
        personalAssets={[
          {
            assetId: 'asset-a',
            name: '素材 A',
            scope: 'group',
            groupId: 'group-a',
            width: 2,
            height: 2,
            packedPixels: [1],
            tags: [],
          },
        ]}
        />
      );

    const card = screen.getByText('素材 A').closest('[data-preview-active]') as HTMLElement;
    expect(card).toHaveAttribute('data-preview-active', 'false');

    fireEvent.mouseEnter(card);

    expect(card).toHaveAttribute('data-preview-active', 'true');
  });
});
