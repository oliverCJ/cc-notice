import { expect, test } from 'vitest';
import { customProfileId, editorProfileFromId, maxFramesForResolution } from './profile';

test('parses preset and custom editor profiles', () => {
  expect(editorProfileFromId('custom-mono-128x32-v1')?.framebufferBytes).toBe(512);
  expect(customProfileId(128, 128)).toBe('custom-mono-128x128-v1');
  expect(editorProfileFromId(customProfileId(200, 48))).toMatchObject({
    width: 200,
    height: 48,
    framebufferBytes: 1200,
    maxFrames: 10,
  });
  expect(maxFramesForResolution(128, 64)).toBe(20);
  expect(maxFramesForResolution(320, 240)).toBe(10);
  expect(maxFramesForResolution(640, 480)).toBe(5);
});

test('rejects unsafe custom profile dimensions', () => {
  expect(editorProfileFromId('custom-9x48-v1')).toBeNull();
  expect(editorProfileFromId('custom-1025x1024-v1')).toBeNull();
  expect(editorProfileFromId('custom-1024x1025-v1')).toBeNull();
  expect(editorProfileFromId('custom-1024x1024-v1')).not.toBeNull();
  expect(editorProfileFromId('custom-1024x1023-v1')).not.toBeNull();
});
