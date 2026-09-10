import type { CustomFaceVectorizeOptions } from '@/api/tauriApi';

export const VECTORIZE_OPTIONS_DEBOUNCE_MS = 360;

export type ImageVectorizerOptions = CustomFaceVectorizeOptions;

export function defaultVectorizerOptions(): ImageVectorizerOptions {
  return {
    mode: 'binary',
    filterSpeckle: 4,
    colorPrecision: 6,
    layerDifference: 16,
    cornerThreshold: 60,
    lengthThreshold: 4,
    maxIterations: 10,
    spliceThreshold: 45,
    pathPrecision: 2,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0,
    invert: false,
    brightness: 0,
    contrast: 0,
  };
}

export function normalizeVectorizerOptions(options: ImageVectorizerOptions): ImageVectorizerOptions {
  return {
    ...options,
    mode: options.mode === 'color' ? 'color' : 'binary',
    filterSpeckle: clampInteger(options.filterSpeckle, 0, 128, 4),
    colorPrecision: clampInteger(options.colorPrecision, 1, 8, 6),
    layerDifference: clampInteger(options.layerDifference, 1, 64, 16),
    cornerThreshold: clampInteger(options.cornerThreshold, 0, 180, 60),
    lengthThreshold: clampNumber(options.lengthThreshold, 0.5, 20, 4),
    maxIterations: clampInteger(options.maxIterations, 1, 50, 10),
    spliceThreshold: clampInteger(options.spliceThreshold, 0, 180, 45),
    pathPrecision: clampInteger(options.pathPrecision, 0, 5, 2),
    scale: clampNumber(options.scale, 0.25, 4, 1),
    offsetX: clampInteger(options.offsetX, -4096, 4096, 0),
    offsetY: clampInteger(options.offsetY, -4096, 4096, 0),
    rotationDeg: clampInteger(options.rotationDeg, -180, 180, 0),
    invert: Boolean(options.invert),
    brightness: clampInteger(options.brightness, -100, 100, 0),
    contrast: clampInteger(options.contrast, -100, 100, 0),
  };
}

function clampInteger(value: number, min: number, max: number, fallback: number) {
  const next = Number.isFinite(value) ? Math.trunc(value) : fallback;
  return Math.min(max, Math.max(min, next));
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  const next = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, next));
}
