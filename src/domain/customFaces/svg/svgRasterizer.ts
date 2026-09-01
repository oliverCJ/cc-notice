import { setPixel, type RasterSize } from '../editor/raster';
import type { SvgDocument } from './svgParser';

const SAMPLES_PER_PIXEL = 4;
const CONTENT_PADDING_RATIO = 0.08;
const MEASUREMENT_MAX_SIZE = 1_024;

export type SvgRecognitionMode = 'alpha' | 'brightness';

export type SvgRasterOptions = {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotationDeg: number;
  threshold: number;
  invert?: boolean;
  recognitionMode?: SvgRecognitionMode;
};

export type SvgRasterResult = {
  pixels: Uint8Array;
  activePixelCount: number;
  clipped: boolean;
};

type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function rasterizeSvg(
  document: SvgDocument,
  targetSize: RasterSize,
  options: SvgRasterOptions,
): Promise<SvgRasterResult> {
  const image = await loadSvgImage(document.source);
  const source = renderSourceImage(image, document);
  const sourceBounds = opaquePixelBounds(
    source.context.getImageData(0, 0, source.width, source.height).data,
    source.width,
    source.height,
  );
  if (!sourceBounds) {
    return emptyRasterResult(targetSize);
  }

  const sampleSize = {
    width: targetSize.width * SAMPLES_PER_PIXEL,
    height: targetSize.height * SAMPLES_PER_PIXEL,
  };
  const canvas = documentCreateCanvas(sampleSize);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前环境无法创建 SVG 导入画布');
  }
  context.clearRect(0, 0, sampleSize.width, sampleSize.height);
  drawCroppedSvgImage(
    context,
    source.canvas,
    sourceBounds,
    targetSize,
    options,
  );
  const rgba = context.getImageData(0, 0, sampleSize.width, sampleSize.height).data;
  const pixels = rasterizeAlphaCoverage(
    rgba,
    targetSize,
    SAMPLES_PER_PIXEL,
    options.threshold,
    options.invert,
    options.recognitionMode,
  );
  return {
    pixels,
    activePixelCount: countActivePixels(pixels),
    clipped: isCroppedContentOutsideTarget(sourceBounds, targetSize, options),
  };
}

export function rasterizeAlphaCoverage(
  rgba: Uint8ClampedArray,
  targetSize: RasterSize,
  samplesPerPixel: number,
  threshold: number,
  invert = false,
  recognitionMode: SvgRecognitionMode = 'alpha',
) {
  const expectedLength =
    targetSize.width * samplesPerPixel * targetSize.height * samplesPerPixel * 4;
  if (rgba.length !== expectedLength) {
    throw new Error('SVG 导入像素缓冲区尺寸无效');
  }
  const pixels = new Uint8Array(
    targetSize.width * Math.ceil(targetSize.height / 8),
  );
  const thresholdRatio = clamp(threshold, 0, 100) / 100;
  const samplesPerLogicalPixel = samplesPerPixel * samplesPerPixel;
  const sampleWidth = targetSize.width * samplesPerPixel;
  const contentBounds = logicalContentBounds(
    rgba,
    targetSize,
    samplesPerPixel,
  );

  for (let y = 0; y < targetSize.height; y += 1) {
    for (let x = 0; x < targetSize.width; x += 1) {
      let signalSum = 0;
      for (let sampleY = 0; sampleY < samplesPerPixel; sampleY += 1) {
        for (let sampleX = 0; sampleX < samplesPerPixel; sampleX += 1) {
          const index =
            ((y * samplesPerPixel + sampleY) * sampleWidth +
              (x * samplesPerPixel + sampleX)) *
            4;
          signalSum += sampleSignal(rgba, index, recognitionMode);
        }
      }
      const coverage = signalSum / (samplesPerLogicalPixel * 255);
      const active = coverage >= thresholdRatio;
      const inContent = Boolean(contentBounds && contains(contentBounds, x, y));
      const outputActive = inContent && invert ? !active : active;
      if (outputActive) {
        setPixel(pixels, targetSize, x, y, true);
      }
    }
  }
  return pixels;
}

function sampleSignal(
  rgba: Uint8ClampedArray,
  index: number,
  recognitionMode: SvgRecognitionMode,
) {
  const alpha = rgba[index + 3];
  if (recognitionMode === 'alpha') return alpha;
  const brightness =
    0.299 * rgba[index] + 0.587 * rgba[index + 1] + 0.114 * rgba[index + 2];
  return (alpha * (255 - brightness)) / 255;
}

function logicalContentBounds(
  rgba: Uint8ClampedArray,
  targetSize: RasterSize,
  samplesPerPixel: number,
): PixelBounds | null {
  const sampleWidth = targetSize.width * samplesPerPixel;
  let minX = targetSize.width;
  let minY = targetSize.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < targetSize.height; y += 1) {
    for (let x = 0; x < targetSize.width; x += 1) {
      let hasAlpha = false;
      for (let sampleY = 0; sampleY < samplesPerPixel && !hasAlpha; sampleY += 1) {
        for (let sampleX = 0; sampleX < samplesPerPixel; sampleX += 1) {
          const index =
            ((y * samplesPerPixel + sampleY) * sampleWidth +
              (x * samplesPerPixel + sampleX)) *
            4;
          if (rgba[index + 3] > 0) {
            hasAlpha = true;
            break;
          }
        }
      }
      if (!hasAlpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function contains(bounds: PixelBounds, x: number, y: number) {
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

export function opaquePixelBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): PixelBounds | null {
  if (rgba.length !== width * height * 4) {
    throw new Error('SVG 导入像素缓冲区尺寸无效');
  }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function renderSourceImage(image: HTMLImageElement, document: SvgDocument) {
  const sourceAspectRatio = document.viewBox[2] / document.viewBox[3];
  const width =
    sourceAspectRatio >= 1
      ? MEASUREMENT_MAX_SIZE
      : Math.max(1, Math.round(MEASUREMENT_MAX_SIZE * sourceAspectRatio));
  const height =
    sourceAspectRatio >= 1
      ? Math.max(1, Math.round(MEASUREMENT_MAX_SIZE / sourceAspectRatio))
      : MEASUREMENT_MAX_SIZE;
  const canvas = documentCreateCanvas({ width, height });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('当前环境无法创建 SVG 导入画布');
  }
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return { canvas, context, width, height };
}

function drawCroppedSvgImage(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  bounds: PixelBounds,
  targetSize: RasterSize,
  options: SvgRasterOptions,
) {
  const sampleScale = SAMPLES_PER_PIXEL;
  const paddedWidth = bounds.width / (1 - CONTENT_PADDING_RATIO * 2);
  const paddedHeight = bounds.height / (1 - CONTENT_PADDING_RATIO * 2);
  const fittedScale = Math.min(targetSize.width / paddedWidth, targetSize.height / paddedHeight);
  const drawWidth = bounds.width * fittedScale;
  const drawHeight = bounds.height * fittedScale;
  context.save();
  context.translate(
    (targetSize.width / 2 + options.offsetX) * sampleScale,
    (targetSize.height / 2 + options.offsetY) * sampleScale,
  );
  context.rotate((options.rotationDeg * Math.PI) / 180);
  context.scale(options.scale * sampleScale, options.scale * sampleScale);
  context.drawImage(
    source,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  context.restore();
}

function isCroppedContentOutsideTarget(
  bounds: PixelBounds,
  targetSize: RasterSize,
  options: SvgRasterOptions,
) {
  const paddedWidth = bounds.width / (1 - CONTENT_PADDING_RATIO * 2);
  const paddedHeight = bounds.height / (1 - CONTENT_PADDING_RATIO * 2);
  const fittedScale = Math.min(targetSize.width / paddedWidth, targetSize.height / paddedHeight);
  const halfWidth = (bounds.width * fittedScale * Math.abs(options.scale)) / 2;
  const halfHeight = (bounds.height * fittedScale * Math.abs(options.scale)) / 2;
  const radians = (options.rotationDeg * Math.PI) / 180;
  const centerX = targetSize.width / 2 + options.offsetX;
  const centerY = targetSize.height / 2 + options.offsetY;
  const corners = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ] as const;
  return corners.some(([x, y]) => {
    const transformedX = centerX + x * Math.cos(radians) - y * Math.sin(radians);
    const transformedY = centerY + x * Math.sin(radians) + y * Math.cos(radians);
    return (
      transformedX < 0 ||
      transformedY < 0 ||
      transformedX > targetSize.width ||
      transformedY > targetSize.height
    );
  });
}

function emptyRasterResult(targetSize: RasterSize): SvgRasterResult {
  return {
    pixels: new Uint8Array(targetSize.width * Math.ceil(targetSize.height / 8)),
    activePixelCount: 0,
    clipped: false,
  };
}

function documentCreateCanvas(size: RasterSize) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

async function loadSvgImage(source: string) {
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } catch (error) {
    throw new Error(
      `SVG 图像无法解码：${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function countActivePixels(pixels: Uint8Array) {
  let count = 0;
  for (const byte of pixels) {
    count += byte.toString(2).split('1').length - 1;
  }
  return count;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
