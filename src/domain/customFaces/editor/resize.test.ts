import { expect, test } from 'vitest';
import type { CustomFaceGroup } from '@/api/tauriApi';
import { resizeCustomFaceGroup } from './resize';

test('creates a new group and applies target profile frame limits', () => {
  let id = 0;
  const group: CustomFaceGroup = { schemaVersion: 1, groupId: 'old-group', name: 'Group', displayProfileId: 'custom-mono-128x32-v1', revision: 3, defaultFaceId: 'old-face', faces: [{ faceId: 'old-face', name: 'Face', color: { red: 255, green: 255, blue: 255 }, frames: Array.from({ length: 7 }, () => ({ durationMs: 200, packedPixels: Array(512).fill(0) })) }] };
  const resized = resizeCustomFaceGroup(group, 'custom-mono-320x240-v1', () => `new-${++id}`);
  expect(resized.groupId).not.toBe(group.groupId);
  expect(resized.defaultFaceId).toBe(resized.faces[0].faceId);
  expect(resized.displayProfileId).toBe('custom-mono-320x240-v1');
  expect(resized.faces[0].frames).toHaveLength(5);
  expect(resized.faces[0].frames[0].packedPixels).toHaveLength(9600);
});
