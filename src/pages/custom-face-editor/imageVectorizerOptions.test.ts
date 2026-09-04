import { describe, expect, test } from 'vitest';
import {
  defaultVectorizerOptions,
  normalizeVectorizerOptions,
  VECTORIZE_OPTIONS_DEBOUNCE_MS,
} from './imageVectorizerOptions';

describe('image vectorizer options', () => {
  test('uses binary defaults and clamps vtracer parameters into supported ranges', () => {
    const defaults = defaultVectorizerOptions();

    expect(defaults.mode).toBe('binary');
    expect(defaults.filterSpeckle).toBe(4);
    expect(defaults.colorPrecision).toBe(6);
    expect(defaults.layerDifference).toBe(16);
    expect(defaults.cornerThreshold).toBe(60);
    expect(defaults.lengthThreshold).toBe(4);
    expect(defaults.maxIterations).toBe(10);
    expect(defaults.spliceThreshold).toBe(45);
    expect(defaults.pathPrecision).toBe(2);
    expect(defaults.scale).toBe(1);
    expect(defaults.rotationDeg).toBe(0);
    expect(defaults.invert).toBe(false);
    expect(defaults.brightness).toBe(0);
    expect(defaults.contrast).toBe(0);
    expect(VECTORIZE_OPTIONS_DEBOUNCE_MS).toBeGreaterThanOrEqual(300);

    expect(normalizeVectorizerOptions({ ...defaults, mode: 'color' }).mode).toBe('color');
    expect(normalizeVectorizerOptions({ ...defaults, filterSpeckle: -1 }).filterSpeckle).toBe(0);
    expect(normalizeVectorizerOptions({ ...defaults, filterSpeckle: 999 }).filterSpeckle).toBe(128);
    expect(normalizeVectorizerOptions({ ...defaults, colorPrecision: 0 }).colorPrecision).toBe(1);
    expect(normalizeVectorizerOptions({ ...defaults, colorPrecision: 99 }).colorPrecision).toBe(8);
    expect(normalizeVectorizerOptions({ ...defaults, layerDifference: 0 }).layerDifference).toBe(1);
    expect(normalizeVectorizerOptions({ ...defaults, layerDifference: 99 }).layerDifference).toBe(64);
    expect(normalizeVectorizerOptions({ ...defaults, cornerThreshold: -99 }).cornerThreshold).toBe(0);
    expect(normalizeVectorizerOptions({ ...defaults, cornerThreshold: 180 }).cornerThreshold).toBe(180);
    expect(normalizeVectorizerOptions({ ...defaults, lengthThreshold: 0 }).lengthThreshold).toBe(0.5);
    expect(normalizeVectorizerOptions({ ...defaults, lengthThreshold: 99 }).lengthThreshold).toBe(20);
    expect(normalizeVectorizerOptions({ ...defaults, maxIterations: 0 }).maxIterations).toBe(1);
    expect(normalizeVectorizerOptions({ ...defaults, maxIterations: 99 }).maxIterations).toBe(50);
    expect(normalizeVectorizerOptions({ ...defaults, spliceThreshold: -99 }).spliceThreshold).toBe(0);
    expect(normalizeVectorizerOptions({ ...defaults, spliceThreshold: 180 }).spliceThreshold).toBe(180);
    expect(normalizeVectorizerOptions({ ...defaults, pathPrecision: 0 }).pathPrecision).toBe(0);
    expect(normalizeVectorizerOptions({ ...defaults, pathPrecision: 99 }).pathPrecision).toBe(5);
    expect(normalizeVectorizerOptions({ ...defaults, scale: 0 }).scale).toBe(0.25);
    expect(normalizeVectorizerOptions({ ...defaults, scale: 99 }).scale).toBe(4);
    expect(normalizeVectorizerOptions({ ...defaults, rotationDeg: -999 }).rotationDeg).toBe(-180);
    expect(normalizeVectorizerOptions({ ...defaults, rotationDeg: 999 }).rotationDeg).toBe(180);
    expect(normalizeVectorizerOptions({ ...defaults, brightness: -999 }).brightness).toBe(-100);
    expect(normalizeVectorizerOptions({ ...defaults, brightness: 999 }).brightness).toBe(100);
    expect(normalizeVectorizerOptions({ ...defaults, contrast: -999 }).contrast).toBe(-100);
    expect(normalizeVectorizerOptions({ ...defaults, contrast: 999 }).contrast).toBe(100);
  });
});
