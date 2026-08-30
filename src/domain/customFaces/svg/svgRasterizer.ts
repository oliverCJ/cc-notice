import { drawLine, setPixel, type Point, type RasterSize } from '../editor/raster';
import type { SvgDocument, SvgElement } from './svgParser';

export type SvgRasterOptions = { offsetX: number; offsetY: number; scale: number; rotationDeg: number; threshold: number };

export function rasterizeSvg(document: SvgDocument, targetSize: RasterSize, options: SvgRasterOptions) {
  const pixels = new Uint8Array(targetSize.width * Math.ceil(targetSize.height / 8));
  const backgroundFill = dominantBackgroundFill(document);
  let clipped = false;
  for (const element of document.elements) {
    if (backgroundFill && (element.attributes.fill ?? '').toLowerCase() === backgroundFill) continue;
    const points = geometryPoints(element);
    const transformed = points.map((point) => transformPoint(point, element, document, targetSize, options));
    if (transformed.some(([x, y]) => x < 0 || y < 0 || x >= targetSize.width || y >= targetSize.height)) clipped = true;
    if (element.type === 'circle' || element.type === 'ellipse') drawEllipsePixels(pixels, targetSize, transformed, element.type === 'circle');
    else if (element.type === 'rect') {
      const rectWidth = num(element.attributes.width);
      const rectHeight = num(element.attributes.height);
      if (rectWidth <= 1 && rectHeight <= 1) setPixel(pixels, targetSize, Math.round(transformed[0][0]), Math.round(transformed[0][1]), true);
      else if (rectWidth <= 1 || rectHeight <= 1) drawPolyline(pixels, targetSize, transformed);
      else drawPolygon(pixels, targetSize, transformed, true);
    }
    else if (element.type === 'polygon' || element.type === 'path') drawPolygon(pixels, targetSize, transformed, true);
    else drawPolyline(pixels, targetSize, transformed);
  }
  let activePixelCount = 0;
  for (const byte of pixels) activePixelCount += byte.toString(2).split('1').length - 1;
  return { pixels, activePixelCount, clipped };
}

function dominantBackgroundFill(document: SvgDocument) {
  const areas = new Map<string, number>();
  for (const element of document.elements) {
    const fill = element.attributes.fill?.trim().toLowerCase();
    if (!fill || fill === 'none') continue;
    const area = element.type === 'rect' ? Math.max(0, num(element.attributes.width) * num(element.attributes.height)) : element.type === 'circle' ? Math.PI * num(element.attributes.r) ** 2 : 0;
    areas.set(fill, (areas.get(fill) ?? 0) + area);
  }
  if (areas.size < 2) return null;
  const entries = [...areas.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, area]) => sum + area, 0);
  return entries[0][1] >= total * 0.5 ? entries[0][0] : null;
}

function geometryPoints(element: SvgElement): Point[] {
  const a = element.attributes;
  if (element.type === 'rect') { const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height); return [[x, y], [x + w - 1, y], [x + w - 1, y + h - 1], [x, y + h - 1]]; }
  if (element.type === 'line') return [[num(a.x1), num(a.y1)], [num(a.x2), num(a.y2)]];
  if (element.type === 'circle') return [[num(a.cx), num(a.cy)], [num(a.cx) + num(a.r), num(a.cy)]];
  if (element.type === 'ellipse') return [[num(a.cx), num(a.cy)], [num(a.cx) + num(a.rx), num(a.cy)], [num(a.cx), num(a.cy) + num(a.ry)]];
  const values = (a.points ?? '').trim().split(/[ ,]+/).map(Number);
  if (values.length >= 4 && values.every(Number.isFinite)) { const points: Point[] = []; for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]]); return points; }
  const pathValues = (a.d ?? '').match(/[MLHVZCQSmSmlhvzcqs]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const points: Point[] = []; let current: Point = [0, 0]; let start: Point = current; let command = 'M'; let cursor = 0; let previousControl: Point | null = null;
  const read = () => Number(pathValues[cursor++]);
  const point = (x: number, y: number, relative: boolean): Point => relative ? [current[0] + x, current[1] + y] : [x, y];
  while (cursor < pathValues.length) {
    if (/^[A-Za-z]$/.test(pathValues[cursor])) { command = pathValues[cursor++]; if (!/[CS cs]/.test(command)) previousControl = null; }
    const upper = command.toUpperCase();
    const relative = command === command.toLowerCase();
    if (upper === 'Z') { current = start; points.push(current); command = relative ? 'm' : 'M'; continue; }
    if (upper === 'M' || upper === 'L') { if (cursor + 1 >= pathValues.length) break; current = point(read(), read(), relative); points.push(current); if (upper === 'M') { start = current; command = relative ? 'l' : 'L'; } continue; }
    if (upper === 'H') { current = relative ? [current[0] + read(), current[1]] : [read(), current[1]]; points.push(current); continue; }
    if (upper === 'V') { current = relative ? [current[0], current[1] + read()] : [current[0], read()]; points.push(current); continue; }
    if (upper === 'C' || upper === 'S') { const required = upper === 'C' ? 5 : 3; if (cursor + required >= pathValues.length) break; const origin = current; const c1 = upper === 'C' ? point(read(), read(), relative) : (previousControl ? [2 * current[0] - previousControl[0], 2 * current[1] - previousControl[1]] : current); const c2 = point(read(), read(), relative); const end = point(read(), read(), relative); for (let step = 1; step <= 8; step += 1) { const t = step / 8; const mt = 1 - t; points.push([mt ** 3 * origin[0] + 3 * mt ** 2 * t * c1[0] + 3 * mt * t ** 2 * c2[0] + t ** 3 * end[0], mt ** 3 * origin[1] + 3 * mt ** 2 * t * c1[1] + 3 * mt * t ** 2 * c2[1] + t ** 3 * end[1]]); } current = end; previousControl = c2; continue; }
    if (upper === 'Q') { if (cursor + 3 >= pathValues.length) break; const origin = current; const c = point(read(), read(), relative); const end = point(read(), read(), relative); for (let step = 1; step <= 8; step += 1) { const t = step / 8; const mt = 1 - t; points.push([mt ** 2 * origin[0] + 2 * mt * t * c[0] + t ** 2 * end[0], mt ** 2 * origin[1] + 2 * mt * t * c[1] + t ** 2 * end[1]]); } current = end; continue; }
    cursor += 1;
  }
  return points;
}

function transformPoint([rawX, rawY]: Point, element: SvgElement, document: SvgDocument, targetSize: RasterSize, options: SvgRasterOptions): Point {
  let x = rawX;
  let y = rawY;
  for (const transform of element.transform) {
    if (transform.type === 'translate') { x += transform.x; y += transform.y; }
    else if (transform.type === 'scale') { x *= transform.x; y *= transform.y; }
    else { const angle = (transform.angle * Math.PI) / 180; const nextX = x * Math.cos(angle) - y * Math.sin(angle); y = x * Math.sin(angle) + y * Math.cos(angle); x = nextX; }
  }
  const originX = document.viewBox[0] + document.viewBox[2] / 2;
  const originY = document.viewBox[1] + document.viewBox[3] / 2;
  const scale = options.scale || 1;
  const radians = (options.rotationDeg * Math.PI) / 180;
  const sx = (x - originX) * scale;
  const sy = (y - originY) * scale;
  return [Math.round(sx * Math.cos(radians) - sy * Math.sin(radians) + targetSize.width / 2 + options.offsetX), Math.round(sx * Math.sin(radians) + sy * Math.cos(radians) + targetSize.height / 2 + options.offsetY)];
}
function num(value: string | undefined) { const parsed = Number.parseFloat(value ?? '0'); return Number.isFinite(parsed) ? parsed : 0; }

function drawPolyline(pixels: Uint8Array, size: RasterSize, points: Point[]) { for (let i = 1; i < points.length; i += 1) { const [x0, y0] = points[i - 1]; const [x1, y1] = points[i]; const line = drawLine(pixels, size, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)); pixels.set(line); } }
function drawPolygon(pixels: Uint8Array, size: RasterSize, points: Point[], filled: boolean) { if (points.length < 2) return; if (!filled) return drawPolyline(pixels, size, [...points, points[0]]); const minX = Math.floor(Math.min(...points.map(([x]) => x))); const maxX = Math.ceil(Math.max(...points.map(([x]) => x))); const minY = Math.floor(Math.min(...points.map(([, y]) => y))); const maxY = Math.ceil(Math.max(...points.map(([, y]) => y))); for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) if (insidePolygon(x, y, points)) setPixel(pixels, size, x, y, true); }
function insidePolygon(x: number, y: number, points: Point[]) { let inside = false; for (let i = 0, j = points.length - 1; i < points.length; j = i++) { const [xi, yi] = points[i]; const [xj, yj] = points[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
function drawEllipsePixels(pixels: Uint8Array, size: RasterSize, points: Point[], circle: boolean) { const [centerX, centerY] = points[0]; const radiusX = Math.max(1, Math.abs(points[1][0] - centerX)); const radiusY = circle ? radiusX : Math.max(1, Math.abs(points[2][1] - centerY)); for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += 1) for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) if (((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2 <= 1) setPixel(pixels, size, x, y, true); }
