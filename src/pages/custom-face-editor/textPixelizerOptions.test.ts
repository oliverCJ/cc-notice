import { describe, expect, test } from 'vitest';
import {
  TEXT_PIXELIZER_FONT_PRESETS,
  defaultTextPixelizerOptions,
  estimateTextPixelizerLimits,
  normalizeTextPixelizerOptions,
  truncateTextToPixelizerHardLimit
} from './textPixelizerOptions';

describe('text pixelizer options', () => {
  test('provides stable defaults and font presets', () => {
    const defaults = defaultTextPixelizerOptions();

    expect(defaults.text).toBe('');
    expect(defaults.fontFamily).toBe('sans-serif');
    expect(defaults.fontSize).toBe(24);
    expect(defaults.fontWeight).toBe('normal');
    expect(defaults.align).toBe('center');
    expect(defaults.lineHeight).toBe(1.1);
    expect(defaults.letterSpacingEm).toBe(0);
    expect(defaults.wrap).toBe(true);
    expect(defaults.padding).toBe(4);
    expect(TEXT_PIXELIZER_FONT_PRESETS.map((item) => item.value)).toEqual([
      'sans-serif',
      'serif',
      'monospace',
      'system-cjk-sans'
    ]);
  });

  test('normalizes text layout values into safe ranges', () => {
    const normalized = normalizeTextPixelizerOptions({
      text: 'abc',
      fontFamily: 'unknown-font',
      fontSize: 999,
      fontWeight: 'heavy',
      align: 'middle',
      lineHeight: 9,
      wrap: true,
      padding: 999
    } as unknown as Parameters<typeof normalizeTextPixelizerOptions>[0]);

    expect(normalized.fontFamily).toBe('sans-serif');
    expect(normalized.fontSize).toBe(128);
    expect(normalized.fontWeight).toBe('normal');
    expect(normalized.align).toBe('center');
    expect(normalized.lineHeight).toBe(2);
    expect(normalized.padding).toBe(64);
  });

  test('keeps text font size above a readable pixel conversion minimum', () => {
    const normalized = normalizeTextPixelizerOptions({
      ...defaultTextPixelizerOptions(),
      fontSize: 6
    });

    expect(normalized.fontSize).toBe(8);
  });

  test('normalizes letter spacing into the text-only supported range', () => {
    const tooSmall = normalizeTextPixelizerOptions({
      ...defaultTextPixelizerOptions(),
      letterSpacingEm: -9
    } as unknown as Parameters<typeof normalizeTextPixelizerOptions>[0]);
    const tooLarge = normalizeTextPixelizerOptions({
      ...defaultTextPixelizerOptions(),
      letterSpacingEm: 9
    } as unknown as Parameters<typeof normalizeTextPixelizerOptions>[0]);

    expect(tooSmall.letterSpacingEm).toBe(-0.25);
    expect(tooLarge.letterSpacingEm).toBe(1);
  });

  test('estimates soft and hard text limits from canvas size and font size', () => {
    const small = estimateTextPixelizerLimits({ width: 128, height: 32 }, { ...defaultTextPixelizerOptions(), fontSize: 16 });
    const large = estimateTextPixelizerLimits({ width: 128, height: 128 }, { ...defaultTextPixelizerOptions(), fontSize: 16 });
    const tinyFont = estimateTextPixelizerLimits({ width: 128, height: 32 }, { ...defaultTextPixelizerOptions(), fontSize: 8 });

    expect(small.softLimit).toBeGreaterThan(0);
    expect(small.hardLimit).toBeGreaterThan(small.softLimit);
    expect(large.softLimit).toBeGreaterThan(small.softLimit);
    expect(tinyFont.softLimit).toBeGreaterThan(small.softLimit);
  });

  test('truncates pasted text at the hard limit without changing shorter text', () => {
    const limits = { softLimit: 4, hardLimit: 6 };

    expect(truncateTextToPixelizerHardLimit('hello', limits)).toBe('hello');
    expect(truncateTextToPixelizerHardLimit('hello world', limits)).toBe('hello ');
  });
});
