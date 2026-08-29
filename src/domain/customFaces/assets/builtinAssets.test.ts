import { expect, test } from 'vitest';
import { getBuiltinCustomFaceAssets } from './builtinAssets';

test('returns read-only built-in assets for the requested profile', () => {
  const assets = getBuiltinCustomFaceAssets({ id: 'custom-mono-128x32-v1', width: 128, height: 32, framebufferBytes: 512 });
  expect(assets.length).toBeGreaterThan(0);
  expect(assets[0].profileId).toBe('custom-mono-128x32-v1');
  expect(Array.from(assets[0].packedPixels).some((value) => value !== 0)).toBe(true);
  expect(Object.isFrozen(assets[0])).toBe(true);
});

test('does not expose assets from another profile', () => {
  const assets = getBuiltinCustomFaceAssets({ id: 'custom-mono-320x240-v1', width: 320, height: 240, framebufferBytes: 9600 });
  expect(assets.every((asset) => asset.profileId === 'custom-mono-320x240-v1')).toBe(true);
});
