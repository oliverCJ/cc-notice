import { describe, expect, test } from 'vitest';
import { drawCircle, drawLine, drawPolygon, drawRectangle, getPixel, setPixel } from './raster';

const size = { width: 8, height: 8 };

test('sets and reads page-packed pixels while clipping bounds', () => {
  const pixels = new Uint8Array(8);
  setPixel(pixels, size, 2, 3, true);
  setPixel(pixels, size, -1, 0, true);
  expect(getPixel(pixels, size, 2, 3)).toBe(true);
  expect(getPixel(pixels, size, 0, 0)).toBe(false);
});

test('rasterizes line, rectangle, circle and polygon within profile bounds', () => {
  const line = drawLine(new Uint8Array(8), size, -2, -2, 4, 4);
  expect(getPixel(line, size, 0, 0)).toBe(true);
  expect(getPixel(line, size, 4, 4)).toBe(true);
  const rectangle = drawRectangle(new Uint8Array(8), size, 1, 1, 4, 3, true);
  expect(getPixel(rectangle, size, 1, 1)).toBe(true);
  expect(getPixel(rectangle, size, 2, 2)).toBe(false);
  const circle = drawCircle(new Uint8Array(8), size, 3, 3, 2);
  expect(getPixel(circle, size, 3, 1)).toBe(true);
  const polygon = drawPolygon(new Uint8Array(8), size, [[1, 1], [5, 1], [3, 5]]);
  expect(getPixel(polygon, size, 3, 3)).toBe(true);
});
