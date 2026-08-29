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
    const transformed = points.map((point) => transformPoint(point, document, targetSize, options));
    if (transformed.some(([x, y]) => x < 0 || y < 0 || x >= targetSize.width || y >= targetSize.height)) clipped = true;
    if (element.type === 'circle' || element.type === 'ellipse') drawEllipsePixels(pixels, targetSize, transformed, element.type === 'circle');
    else if (element.type === 'rect') drawPolygon(pixels, targetSize, transformed, true);
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
  const pathValues = (a.d ?? '').match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points: Point[] = []; let current: Point = [0, 0];
  for (let i = 0; i < pathValues.length; i += 1) { const token = pathValues[i]; if (/^[ML]$/i.test(token)) { current = [Number(pathValues[++i]), Number(pathValues[++i])]; points.push(current); } else if (/^[HV]$/i.test(token)) { const value = Number(pathValues[++i]); current = /^[H]$/i.test(token) ? [value, current[1]] : [current[0], value]; points.push(current); } }
  return points;
}

function transformPoint([x, y]: Point, document: SvgDocument, targetSize: RasterSize, options: SvgRasterOptions): Point {
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
