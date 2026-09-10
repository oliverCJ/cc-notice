import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CustomFaceGroupLibrary } from './CustomFaceGroupLibrary';

vi.mock('@/i18n', () => ({
  useI18n: () => (key: string) => key,
}));

describe('CustomFaceGroupLibrary', () => {
  test('enables animated preview only while hovering a group card', () => {
    render(
      <CustomFaceGroupLibrary
        groups={[
          {
            groupId: 'group-a',
            name: '组 A',
            displayProfileId: 'custom-128x32-v1',
            faceCount: 1,
            revision: 1,
            defaultFaceId: 'face-a',
            libraryHash: 'hash-a',
          },
        ]}
        previews={{
          'group-a': {
            schemaVersion: 1,
            groupId: 'group-a',
            name: '组 A',
            displayProfileId: 'custom-128x32-v1',
            revision: 1,
            defaultFaceId: 'face-a',
            faces: [
              {
                faceId: 'face-a',
                name: '默认',
                color: { red: 255, green: 255, blue: 255 },
                frames: [
                  { durationMs: 100, packedPixels: [1] },
                  { durationMs: 100, packedPixels: [2] },
                ],
              },
            ],
          },
        }}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
        onCopy={vi.fn()}
        onResizeCopy={vi.fn()}
        onRename={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const card = screen.getByText('组 A').closest('[data-preview-active]') as HTMLElement;
    expect(card).toHaveAttribute('data-preview-active', 'false');

    fireEvent.mouseEnter(card);

    expect(card).toHaveAttribute('data-preview-active', 'true');
  });
});
