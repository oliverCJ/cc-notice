export type RasterSize = { width: number; height: number };
export type Point = [number, number];

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
