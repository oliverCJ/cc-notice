import { describe, expect, test } from 'vitest';
import errorAnimation from './animations/error.json';
import idleAnimation from './animations/idle.json';
import successAnimation from './animations/success.json';
import waveAnimation from './animations/wave.json';
import workingAnimation from './animations/working.json';

type LottieAnimation = {
  w: number;
  h: number;
  layers: LottieLayer[];
};

type LottieLayer = {
  nm: string;
  ty: number;
  ks?: LottieTransform;
  shapes?: LottieShape[];
};

type LottieShape = {
  ty: string;
  nm?: string;
  s?: { k: number[] };
  p?: { k: number[] };
  it?: LottieShape[];
};

type LottieTransform = {
  p?: { k: number[] | LottieKeyframe[] };
  a?: { k: number[] };
  s?: { k: number[] | LottieKeyframe[] };
  r?: { k: number | LottieKeyframe[] };
};

type LottieKeyframe = {
  s?: number[];
};

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const animations: Array<[string, LottieAnimation]> = [
  ['idle', idleAnimation],
  ['working', workingAnimation],
  ['success', successAnimation],
  ['error', errorAnimation],
  ['wave', waveAnimation]
];

describe('warm-buddy Lottie asset bounds', () => {
  test.each(animations)('%s animation keeps visible shapes inside its canvas', (_, animation) => {
    const bounds = animationBounds(animation);

    expect(bounds.minX).toBeGreaterThanOrEqual(0);
    expect(bounds.minY).toBeGreaterThanOrEqual(0);
    expect(bounds.maxX).toBeLessThanOrEqual(animation.w);
    expect(bounds.maxY).toBeLessThanOrEqual(animation.h);
  });
});

function animationBounds(animation: LottieAnimation): Bounds {
  const layerBounds = animation.layers.flatMap((layer) => {
    if (layer.ty !== 4 || !layer.shapes) {
      return [];
    }
    return shapeBounds(layer.shapes, transformFromLayer(layer));
  });
  return mergeBounds(layerBounds);
}

function shapeBounds(shapes: LottieShape[], transform: LottieMatrix): Bounds[] {
  const bounds: Bounds[] = [];
  shapes.forEach((shape) => {
    if (shape.ty === 'gr' && shape.it) {
      bounds.push(...shapeBounds(shape.it, multiply(transform, transformFromGroup(shape.it))));
      return;
    }
    if ((shape.ty === 'rc' || shape.ty === 'el') && shape.s) {
      const [width, height] = shape.s.k;
      const [x, y] = shape.p?.k ?? [0, 0];
      bounds.push(rectBounds(transformPoint(transform, x - width / 2, y - height / 2), transformPoint(transform, x + width / 2, y + height / 2)));
    }
  });
  return bounds;
}

function transformFromLayer(layer: LottieLayer): LottieMatrix {
  const position = firstVector(layer.ks?.p?.k, [0, 0]);
  const anchor = firstVector(layer.ks?.a?.k, [0, 0]);
  const scale = firstVector(layer.ks?.s?.k, [100, 100]);
  return {
    tx: position[0] - anchor[0] * (scale[0] / 100),
    ty: position[1] - anchor[1] * (scale[1] / 100),
    sx: scale[0] / 100,
    sy: scale[1] / 100
  };
}

function transformFromGroup(items: LottieShape[]): LottieMatrix {
  const transform = items.find((item) => item.ty === 'tr');
  const position = firstVector(transform?.p?.k, [0, 0]);
  const scale = firstVector(transform?.s?.k, [100, 100]);
  return {
    tx: position[0],
    ty: position[1],
    sx: scale[0] / 100,
    sy: scale[1] / 100
  };
}

type LottieMatrix = {
  tx: number;
  ty: number;
  sx: number;
  sy: number;
};

function multiply(parent: LottieMatrix, child: LottieMatrix): LottieMatrix {
  return {
    tx: parent.tx + child.tx * parent.sx,
    ty: parent.ty + child.ty * parent.sy,
    sx: parent.sx * child.sx,
    sy: parent.sy * child.sy
  };
}

function transformPoint(matrix: LottieMatrix, x: number, y: number) {
  return {
    x: matrix.tx + x * matrix.sx,
    y: matrix.ty + y * matrix.sy
  };
}

function rectBounds(topLeft: { x: number; y: number }, bottomRight: { x: number; y: number }): Bounds {
  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxX: Math.max(topLeft.x, bottomRight.x),
    maxY: Math.max(topLeft.y, bottomRight.y)
  };
}

function mergeBounds(bounds: Bounds[]): Bounds {
  return bounds.reduce(
    (merged, item) => ({
      minX: Math.min(merged.minX, item.minX),
      minY: Math.min(merged.minY, item.minY),
      maxX: Math.max(merged.maxX, item.maxX),
      maxY: Math.max(merged.maxY, item.maxY)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function firstVector(
  value: number[] | LottieKeyframe[] | undefined,
  fallback: number[]
): number[] {
  if (!value) {
    return fallback;
  }
  if (typeof value[0] === 'number') {
    return value as number[];
  }
  return (value[0] as LottieKeyframe).s ?? fallback;
}
