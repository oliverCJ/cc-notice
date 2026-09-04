import { describe, expect, test } from 'vitest';
import { defaultPixelizerOptions, normalizePixelizerOptions } from './imagePixelizerOptions';

describe('image pixelizer options', () => {
  test('keeps the monochrome default and clamps the color settings into range', () => {
    const defaults = defaultPixelizerOptions();
    expect(defaults.mode).toBe('mono');
    expect(defaults.colorCount).toBe(8);
    expect(defaults.dither).toBe(false);
    expect(defaults.contrast).toBe(0);
    expect(defaults.brightness).toBe(0);
    expect(defaults.scale).toBe(1);
    expect(defaults.offsetX).toBe(0);
    expect(defaults.offsetY).toBe(0);
    expect(defaults.rotationDeg).toBe(0);
    expect(normalizePixelizerOptions({ ...defaults, colorCount: 0 }).colorCount).toBe(2);
    expect(normalizePixelizerOptions({ ...defaultPixelizerOptions(), colorCount: 999 }).colorCount).toBe(256);
    expect(normalizePixelizerOptions({ ...defaults, contrast: -999 }).contrast).toBe(-100);
    expect(normalizePixelizerOptions({ ...defaults, brightness: 999 }).brightness).toBe(100);
    expect(normalizePixelizerOptions({ ...defaults, scale: 99 }).scale).toBe(4);
    expect(normalizePixelizerOptions({ ...defaults, offsetX: 999 }).offsetX).toBe(512);
    expect(normalizePixelizerOptions({ ...defaults, rotationDeg: 240 }).rotationDeg).toBe(180);
    expect(normalizePixelizerOptions({ ...defaults, rotationDeg: -240 }).rotationDeg).toBe(-180);
  });
});
