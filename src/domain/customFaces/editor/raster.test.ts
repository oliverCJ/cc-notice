import { describe, expect, test } from 'vitest';
import { drawCircle, drawLine, drawPolygon, drawRectangle, getPixel, isPointInsideSelection, rotateSelection, setPixel } from './raster';

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

test('rotates selected active pixels clockwise around a logical pivot', () => {
  const pixels = new Uint8Array(8);
  setPixel(pixels, size, 2, 1, true);
  setPixel(pixels, size, 2, 2, true);
  const result = rotateSelection(pixels, size, { x: 1, y: 1, width: 2, height: 2 }, { x: 2, y: 2 }, 90);

  expect(getPixel(result.pixels, size, 3, 2)).toBe(true);
  expect(getPixel(result.pixels, size, 2, 2)).toBe(true);
  expect(getPixel(result.pixels, size, 2, 1)).toBe(false);
  expect(result.selection).toEqual({ x: 2, y: 1, width: 2, height: 2 });
});

test('rotates selected active pixels counterclockwise and clips outside the canvas', () => {
  const pixels = new Uint8Array(8);
  setPixel(pixels, size, 0, 0, true);
  setPixel(pixels, size, 1, 0, true);
  const result = rotateSelection(pixels, size, { x: 0, y: 0, width: 2, height: 1 }, { x: 0, y: 0 }, -90);

  expect(getPixel(result.pixels, size, 0, 0)).toBe(true);
  expect(getPixel(result.pixels, size, 1, 0)).toBe(false);
  expect(result.selection).toEqual({ x: 0, y: 0, width: 1, height: 1 });
});

describe('isPointInsideSelection', () => {
  test('returns true for points inside rectangle selection', () => {
    const selection = { x: 2, y: 2, width: 3, height: 3 };
    expect(isPointInsideSelection(selection, 2, 2)).toBe(true);
    expect(isPointInsideSelection(selection, 4, 4)).toBe(true);
    expect(isPointInsideSelection(selection, 3, 3)).toBe(true);
  });

  test('returns false for points outside rectangle selection', () => {
    const selection = { x: 2, y: 2, width: 3, height: 3 };
    expect(isPointInsideSelection(selection, 1, 2)).toBe(false);
    expect(isPointInsideSelection(selection, 5, 2)).toBe(false);
    expect(isPointInsideSelection(selection, 2, 1)).toBe(false);
    expect(isPointInsideSelection(selection, 2, 5)).toBe(false);
  });

  test('returns true for points inside circle selection center and edge', () => {
    const selection = { x: 2, y: 2, width: 5, height: 5, shape: 'circle' as const };
    expect(isPointInsideSelection(selection, 4, 4)).toBe(true);
    expect(isPointInsideSelection(selection, 4, 2)).toBe(true);
    expect(isPointInsideSelection(selection, 6, 4)).toBe(true);
  });

  test('returns false for points in circle selection bounding box corners', () => {
    const selection = { x: 2, y: 2, width: 5, height: 5, shape: 'circle' as const };
    expect(isPointInsideSelection(selection, 2, 2)).toBe(false);
    expect(isPointInsideSelection(selection, 6, 6)).toBe(false);
    expect(isPointInsideSelection(selection, 2, 6)).toBe(false);
    expect(isPointInsideSelection(selection, 6, 2)).toBe(false);
  });

  test('handles circle selection with even width correctly', () => {
    const selection = { x: 0, y: 0, width: 4, height: 4, shape: 'circle' as const };
    expect(isPointInsideSelection(selection, 1, 1)).toBe(true);
    expect(isPointInsideSelection(selection, 2, 2)).toBe(true);
    expect(isPointInsideSelection(selection, 0, 0)).toBe(false);
    expect(isPointInsideSelection(selection, 3, 3)).toBe(false);
  });
});
