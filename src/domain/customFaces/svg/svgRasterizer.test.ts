import { expect, test } from 'vitest';
import { parseSvgDocument } from './svgParser';
import { rasterizeSvg } from './svgRasterizer';
import { getPixel } from '../editor/raster';

test('rasterizes supported geometry into page-packed pixels', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 8 8"><rect x="1" y="1" width="3" height="2"/><line x1="0" y1="0" x2="7" y2="7"/><circle cx="6" cy="2" r="1"/></svg>');
  const result = rasterizeSvg(document, { width: 8, height: 8 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBeGreaterThan(0);
  expect(getPixel(result.pixels, { width: 8, height: 8 }, 1, 1)).toBe(true);
  expect(getPixel(result.pixels, { width: 8, height: 8 }, 7, 7)).toBe(true);
});

test('applies transforms and reports clipping without writing outside target bounds', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 4 4"><rect x="0" y="0" width="4" height="4" /></svg>');
  const result = rasterizeSvg(document, { width: 4, height: 4 }, { offsetX: 3, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.clipped).toBe(true);
  expect(result.pixels).toHaveLength(4);
  expect(getPixel(result.pixels, { width: 4, height: 4 }, 3, 0)).toBe(true);
  expect(getPixel(result.pixels, { width: 4, height: 4 }, 0, 0)).toBe(false);
});

test('returns no active pixels when the transformed document is outside the target', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 4 4"><path d="M0 0 L4 0 L4 4 Z" /></svg>');
  const result = rasterizeSvg(document, { width: 4, height: 4 }, { offsetX: 10, offsetY: 10, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBe(0);
  expect(result.clipped).toBe(true);
});

test('centers an SVG viewBox in a different target resolution', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 8 8"><rect x="3" y="3" width="2" height="2" /></svg>');
  const result = rasterizeSvg(document, { width: 16, height: 8 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(getPixel(result.pixels, { width: 16, height: 8 }, 7, 3)).toBe(true);
});

test('treats the dominant background fill as off and keeps foreground elements active', () => {
  const document = parseSvgDocument('<svg width="640" height="160" viewBox="0 0 128 32"><rect width="128" height="32" fill="#5c94fc"/><rect x="16" y="8" width="8" height="8" fill="#c84c0c"/></svg>');
  const result = rasterizeSvg(document, { width: 128, height: 32 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(getPixel(result.pixels, { width: 128, height: 32 }, 0, 0)).toBe(false);
  expect(getPixel(result.pixels, { width: 128, height: 32 }, 18, 10)).toBe(true);
});
