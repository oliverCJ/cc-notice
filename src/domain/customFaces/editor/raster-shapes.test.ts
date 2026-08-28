import { expect, test } from 'vitest';
import { drawTriangle, getPixel } from './raster';

test('rasterizes a filled triangle inside bounds', () => {
  const pixels = drawTriangle(new Uint8Array(8), { width: 8, height: 8 }, 1, 1, 6, 6);
  expect(getPixel(pixels, { width: 8, height: 8 }, 3, 4)).toBe(true);
});
