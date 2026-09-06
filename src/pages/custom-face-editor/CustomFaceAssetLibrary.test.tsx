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
            profileId: 'custom-mono-128x32-v1',
            width: 2,
            height: 2,
            packedPixels: [1],
            tags: [],
            source: 'local',
            createdAt: '2026-09-05T00:00:00Z',
            updatedAt: '2026-09-05T00:00:00Z',
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
