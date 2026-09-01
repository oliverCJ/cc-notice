import { expect, test } from 'vitest';
import { getPixel } from '../editor/raster';
import { opaquePixelBounds, rasterizeAlphaCoverage } from './svgRasterizer';

function rgba(
  width: number,
  height: number,
  alphaAt: (x: number, y: number) => number,
) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 48;
      pixels[index + 2] = 48;
      pixels[index + 3] = alphaAt(x, y);
    }
  }
  return pixels;
}

test('uses alpha coverage instead of foreground color to create page-packed pixels', () => {
  const pixels = rasterizeAlphaCoverage(
    rgba(8, 4, (x, y) => (x === 2 || x === 3) && y < 2 ? 255 : 0),
    { width: 4, height: 2 },
    2,
    50,
  );

  expect(getPixel(pixels, { width: 4, height: 2 }, 1, 0)).toBe(true);
  expect(getPixel(pixels, { width: 4, height: 2 }, 0, 0)).toBe(false);
});

test('inverts only the logical content bounds and leaves transparent background off', () => {
  const source = rgba(8, 4, (x) => {
    return x === 2 || x === 3 || x === 6 || x === 7 ? 255 : 0;
  });
  const pixels = rasterizeAlphaCoverage(source, { width: 4, height: 2 }, 2, 50, true);

  expect(getPixel(pixels, { width: 4, height: 2 }, 0, 0)).toBe(false);
  expect(getPixel(pixels, { width: 4, height: 2 }, 1, 0)).toBe(false);
  expect(getPixel(pixels, { width: 4, height: 2 }, 2, 0)).toBe(true);
  expect(getPixel(pixels, { width: 4, height: 2 }, 3, 0)).toBe(false);
  expect(getPixel(pixels, { width: 4, height: 2 }, 1, 1)).toBe(false);
  expect(getPixel(pixels, { width: 4, height: 2 }, 2, 1)).toBe(true);
});

test('uses the threshold as a real alpha coverage boundary', () => {
  const source = rgba(4, 2, (x, y) => (x === 0 && y === 0 ? 255 : 0));
  const lowThreshold = rasterizeAlphaCoverage(source, { width: 2, height: 1 }, 2, 25);
  const highThreshold = rasterizeAlphaCoverage(source, { width: 2, height: 1 }, 2, 75);

  expect(getPixel(lowThreshold, { width: 2, height: 1 }, 0, 0)).toBe(true);
  expect(getPixel(highThreshold, { width: 2, height: 1 }, 0, 0)).toBe(false);
});

test('keeps transparent pixels off and preserves holes from native SVG rendering', () => {
  const pixels = rasterizeAlphaCoverage(
    rgba(8, 8, (x, y) => (x === 7 && y === 7 ? 0 : 255)),
    { width: 2, height: 2 },
    4,
    95,
  );

  expect(getPixel(pixels, { width: 2, height: 2 }, 0, 0)).toBe(true);
  expect(getPixel(pixels, { width: 2, height: 2 }, 1, 1)).toBe(false);
});

test('measures the actual opaque content boundary instead of retaining SVG viewBox padding', () => {
  const bounds = opaquePixelBounds(
    rgba(10, 8, (x, y) => (x >= 3 && x <= 6 && y >= 2 && y <= 4 ? 255 : 0)),
    10,
    8,
  );

  expect(bounds).toEqual({ x: 3, y: 2, width: 4, height: 3 });
});

test('returns no content boundary for a fully transparent SVG rendering', () => {
  expect(opaquePixelBounds(rgba(4, 4, () => 0), 4, 4)).toBeNull();
});

test('rejects an RGBA buffer that does not match the sampling grid', () => {
  expect(() =>
    rasterizeAlphaCoverage(
      new Uint8ClampedArray(3),
      { width: 2, height: 2 },
      2,
      50,
    ),
  ).toThrow(/缓冲区尺寸/);
});
