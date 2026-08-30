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

test('keeps a tall viewBox at its source logical size by default', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 129 112"><rect x="50" y="40" width="20" height="20" /></svg>');
  const result = rasterizeSvg(document, { width: 128, height: 32 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBeGreaterThan(0);
  expect(result.clipped).toBe(false);
});

test('rasterizes cubic path curves instead of dropping their geometry', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 20 20"><path d="M2 10 C 5 0, 15 0, 18 10 C 15 20, 5 20, 2 10 Z" /></svg>');
  const result = rasterizeSvg(document, { width: 20, height: 20 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBeGreaterThan(0);
});

test('rasterizes relative cubic commands used by generated SVG assets', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 129 112"><path d="M24.1 15.3c-3.9 2-6.4 10.5-5.7 19.9.3 4.6.1 8-.5 8.3-.5.4-2.1 3-3.6 5.8-2.1 4.1-2.7 7-3.1 13.9-.4 7.6-.2 9.2 2.1 14 1.3 2.9 3.3 6.2 4.3 7.3 4.6 4.9 4.6 5 2.3 8.9-1.4 2.4-2 4.8-1.7 7.1l.4 3.4-8.5.3c-5.6.2-8.6.7-8.9 1.5-.3 1 12.6 1.3 62.2 1.3 55 0 62.6-.2 62.6-1.5" /></svg>');
  const result = rasterizeSvg(document, { width: 128, height: 32 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBeGreaterThan(0);
});

test('supports smooth relative cubic commands', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 20 20"><path d="M2 10 c3-8 13-8 16 0 s-13 8-16 0" /></svg>');
  const result = rasterizeSvg(document, { width: 20, height: 20 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBeGreaterThan(0);
});

test('uses finer curve sampling for long cubic paths', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 100 100"><path d="M0 50 C 25 0, 75 0, 100 50 C 75 100, 25 100, 0 50 Z" /></svg>');
  const result = rasterizeSvg(document, { width: 100, height: 100 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(result.activePixelCount).toBeGreaterThan(200);
});

test('keeps one-pixel SVG rectangles visible', () => {
  const document = parseSvgDocument('<svg viewBox="0 0 4 4"><rect x="1" y="1" width="1" height="1" /></svg>');
  const result = rasterizeSvg(document, { width: 4, height: 4 }, { offsetX: 0, offsetY: 0, scale: 1, rotationDeg: 0, threshold: 50 });
  expect(getPixel(result.pixels, { width: 4, height: 4 }, 1, 1)).toBe(true);
});
