export type RasterSize = { width: number; height: number };
export type Point = [number, number];
export type RasterSelection = { x: number; y: number; width: number; height: number; shape?: 'rectangle' | 'circle' };
export type RasterPivot = { x: number; y: number };

export function isPointInsideSelection(selection: RasterSelection, x: number, y: number) {
  if (x < selection.x || x >= selection.x + selection.width || y < selection.y || y >= selection.y + selection.height) return false;
  if (selection.shape !== 'circle') return true;
  const centerX = selection.x + (selection.width - 1) / 2;
  const centerY = selection.y + (selection.height - 1) / 2;
  const radius = Math.min(selection.width, selection.height) / 2;
  return ((x - centerX) ** 2 + (y - centerY) ** 2) <= radius ** 2;
}
export type RotatedSelection = { pixels: Uint8Array; selection: RasterSelection };

function inBounds(size: RasterSize, x: number, y: number) {
  return x >= 0 && y >= 0 && x < size.width && y < size.height;
}

export function getPixel(pixels: Uint8Array, size: RasterSize, x: number, y: number) {
  if (!inBounds(size, x, y)) return false;
  return (pixels[x + Math.floor(y / 8) * size.width] & (1 << (y & 7))) !== 0;
}

export function setPixel(pixels: Uint8Array, size: RasterSize, x: number, y: number, active: boolean) {
  if (!inBounds(size, x, y)) return;
  const index = x + Math.floor(y / 8) * size.width;
  const mask = 1 << (y & 7);
  pixels[index] = active ? pixels[index] | mask : pixels[index] & ~mask;
}

export function rotateSelection(
  pixels: Uint8Array,
  size: RasterSize,
  selection: RasterSelection,
  pivot: RasterPivot,
  degrees: number,
): RotatedSelection {
  const output = pixels.slice();
  if (!Number.isFinite(degrees) || !validSelection(selection, size) || !inBounds(size, pivot.x, pivot.y)) {
    return { pixels: output, selection };
  }
  const normalizedDegrees = normalizeDegrees(degrees);
  if (normalizedDegrees === 0) return { pixels: output, selection };
  const radians = (normalizedDegrees * Math.PI) / 180;
  const cos = snapTrigonometricValue(Math.cos(radians));
  const sin = snapTrigonometricValue(Math.sin(radians));
  const bounds = rotatedBounds(selection, pivot, cos, sin, size);
  clearSelectionPixels(output, pixels, size, selection);
  for (let targetY = bounds.y; targetY < bounds.y + bounds.height; targetY += 1) {
    for (let targetX = bounds.x; targetX < bounds.x + bounds.width; targetX += 1) {
      if (coverageForRotatedPixel(pixels, size, selection, pivot, cos, sin, targetX, targetY) < 4) continue;
      setPixel(output, size, targetX, targetY, true);
    }
  }
  return { pixels: output, selection: { ...bounds, shape: selection.shape } };
}

function coverageForRotatedPixel(
  pixels: Uint8Array,
  size: RasterSize,
  selection: RasterSelection,
  pivot: RasterPivot,
  cos: number,
  sin: number,
  targetX: number,
  targetY: number,
) {
  let activeSamples = 0;
  for (let sampleY = 0; sampleY < 4; sampleY += 1) {
    for (let sampleX = 0; sampleX < 4; sampleX += 1) {
      const targetSampleX = targetX + (sampleX + 0.5) / 4 - 0.5;
      const targetSampleY = targetY + (sampleY + 0.5) / 4 - 0.5;
      const relativeX = targetSampleX - pivot.x;
      const relativeY = targetSampleY - pivot.y;
      const sourceX = Math.round(cos * relativeX + sin * relativeY + pivot.x);
      const sourceY = Math.round(-sin * relativeX + cos * relativeY + pivot.y);
      if (isPointInsideSelection(selection, sourceX, sourceY) && getPixel(pixels, size, sourceX, sourceY)) activeSamples += 1;
    }
  }
  return activeSamples;
}

function validSelection(selection: RasterSelection, size: RasterSize) {
  return Number.isInteger(selection.x)
    && Number.isInteger(selection.y)
    && Number.isInteger(selection.width)
    && Number.isInteger(selection.height)
    && selection.width > 0
    && selection.height > 0
    && selection.x >= 0
    && selection.y >= 0
    && selection.x + selection.width <= size.width
    && selection.y + selection.height <= size.height;
}

function normalizeDegrees(degrees: number) {
  const normalized = ((Math.trunc(degrees) % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function snapTrigonometricValue(value: number) {
  if (Math.abs(value) < 1e-10) return 0;
  if (Math.abs(value - 1) < 1e-10) return 1;
  if (Math.abs(value + 1) < 1e-10) return -1;
  return value;
}

function rotatedBounds(selection: RasterSelection, pivot: RasterPivot, cos: number, sin: number, size: RasterSize): RasterSelection {
  const corners: Point[] = [
    [selection.x, selection.y],
    [selection.x + selection.width - 1, selection.y],
    [selection.x, selection.y + selection.height - 1],
    [selection.x + selection.width - 1, selection.y + selection.height - 1],
  ];
  const points = corners.map(([x, y]) => [
    cos * (x - pivot.x) - sin * (y - pivot.y) + pivot.x,
    sin * (x - pivot.x) + cos * (y - pivot.y) + pivot.y,
  ] as Point);
  const minX = Math.max(0, Math.floor(Math.min(...points.map(([x]) => x))));
  const maxX = Math.min(size.width - 1, Math.ceil(Math.max(...points.map(([x]) => x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const maxY = Math.min(size.height - 1, Math.ceil(Math.max(...points.map(([, y]) => y))));
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function clearSelectionPixels(output: Uint8Array, source: Uint8Array, size: RasterSize, selection: RasterSelection) {
  for (let y = selection.y; y < selection.y + selection.height; y += 1) {
    for (let x = selection.x; x < selection.x + selection.width; x += 1) {
      if (getPixel(source, size, x, y)) setPixel(output, size, x, y, false);
    }
  }
}

export function drawLine(pixels: Uint8Array, size: RasterSize, x0: number, y0: number, x1: number, y1: number) {
  const output = pixels.slice();
  const dx = Math.abs(x1 - x0); const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0); const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(output, size, x0, y0, true);
    if (x0 === x1 && y0 === y1) break;
    const doubled = error * 2;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
  return output;
}

export function drawRectangle(pixels: Uint8Array, size: RasterSize, x: number, y: number, width: number, height: number, outline: boolean) {
  const output = pixels.slice();
  for (let currentY = y; currentY < y + height; currentY += 1) {
    for (let currentX = x; currentX < x + width; currentX += 1) {
      if (!outline || currentX === x || currentX === x + width - 1 || currentY === y || currentY === y + height - 1) setPixel(output, size, currentX, currentY, true);
    }
  }
  return output;
}

export function drawCircle(pixels: Uint8Array, size: RasterSize, centerX: number, centerY: number, radius: number) {
  const output = pixels.slice();
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if (Math.abs((x - centerX) ** 2 + (y - centerY) ** 2 - radius ** 2) <= radius) setPixel(output, size, x, y, true);
    }
  }
  return output;
}

export function drawEllipse(pixels: Uint8Array, size: RasterSize, x: number, y: number, width: number, height: number, filled: boolean) {
  const output = pixels.slice();
  const radiusX = Math.max(0.5, width / 2);
  const radiusY = Math.max(0.5, height / 2);
  const centerX = x + (width - 1) / 2;
  const centerY = y + (height - 1) / 2;
  const inside = (pixelX: number, pixelY: number) =>
    ((pixelX - centerX) / radiusX) ** 2 + ((pixelY - centerY) / radiusY) ** 2 <= 1;
  for (let currentY = y; currentY < y + height; currentY += 1) {
    for (let currentX = x; currentX < x + width; currentX += 1) {
      if (!inside(currentX, currentY)) continue;
      const boundary = !inside(currentX - 1, currentY)
        || !inside(currentX + 1, currentY)
        || !inside(currentX, currentY - 1)
        || !inside(currentX, currentY + 1);
      if (filled || boundary) {
        setPixel(output, size, currentX, currentY, true);
      }
    }
  }
  return output;
}

export function drawTriangle(pixels: Uint8Array, size: RasterSize, x0: number, y0: number, x1: number, y1: number) {
  const halfWidth = Math.abs(x1 - x0);
  return drawPolygon(pixels, size, [[x0, y0], [x0 - halfWidth, y1], [x0 + halfWidth, y1]]);
}

export function drawPolygon(pixels: Uint8Array, size: RasterSize, points: Point[]) {
  const output = pixels.slice();
  if (points.length < 3) return output;
  const minY = Math.max(0, Math.min(...points.map((point) => point[1])));
  const maxY = Math.min(size.height - 1, Math.max(...points.map((point) => point[1])));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections: number[] = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      if ((point[1] <= y && next[1] > y) || (next[1] <= y && point[1] > y)) intersections.push(point[0] + ((y - point[1]) * (next[0] - point[0])) / (next[1] - point[1]));
    });
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1]); x += 1) setPixel(output, size, x, y, true);
  }
  return output;
}
