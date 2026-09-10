export type ImagePixelizerOptions = {
  mode: 'mono' | 'color';
  colorCount: number;
  dither: boolean;
  invert: boolean;
  threshold: number;
  contrast: number;
  brightness: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotationDeg: number;
};

export function defaultPixelizerOptions(): ImagePixelizerOptions {
  return {
    mode: 'mono',
    colorCount: 8,
    dither: false,
    invert: false,
    threshold: 128,
    contrast: 0,
    brightness: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotationDeg: 0
  };
}

export function normalizePixelizerOptions(options: ImagePixelizerOptions): ImagePixelizerOptions {
  const mode = options.mode === 'color' ? 'color' : 'mono';
  const colorCount = clamp(Math.trunc(options.colorCount || 2), 2, 256);
  const threshold = clamp(Math.trunc(options.threshold || 128), 0, 255);
  const contrast = clamp(Math.trunc(options.contrast || 0), -100, 100);
  const brightness = clamp(Math.trunc(options.brightness || 0), -100, 100);
  const scale = clamp(Number(options.scale) || 1, 0.1, 4);
  const offsetX = clamp(Math.trunc(options.offsetX || 0), -512, 512);
  const offsetY = clamp(Math.trunc(options.offsetY || 0), -512, 512);
  const rotationDeg = clamp(Math.trunc(options.rotationDeg || 0), -180, 180);
  return {
    ...options,
    mode,
    colorCount,
    threshold,
    contrast,
    brightness,
    scale,
    offsetX,
    offsetY,
    rotationDeg
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
