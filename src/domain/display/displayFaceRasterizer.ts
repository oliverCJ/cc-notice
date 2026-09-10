import { DeviceDisplayCapabilities } from '@/api/tauriApi';
import { DisplayFaceTemplateId } from './displayFaceTemplates';
import { DISPLAY_FACE_CONTRACT } from './generated/displayFaceContract.generated';

export type DisplayFaceColorSemantic = 'idle' | 'working' | 'waiting' | 'success' | 'warning' | 'error';
export type DisplayFaceRendererProfileId = typeof DISPLAY_FACE_CONTRACT.profiles[number]['id'];
export type DisplayFaceRendererProfile = typeof DISPLAY_FACE_CONTRACT.profiles[number];

export type PixelFrame = {
  profileId: DisplayFaceRendererProfileId;
  templateId: DisplayFaceTemplateId;
  width: number;
  height: number;
  packedPixels: Uint8Array;
  pixels: Uint8Array;
  color: DisplayFaceColorSemantic;
  previewColor: string;
};

export type PixelMatrix = PixelFrame;

type RuntimeProfile = {
  id: DisplayFaceRendererProfileId;
  width: number;
  height: number;
  strokeWidth: number;
  symbolUnit: number;
  anchors: Record<string, number>;
  regions: Record<string, { x: number; y: number; width: number; height: number }>;
  previewColor: string;
};

type RuntimeTemplate = {
  id: DisplayFaceTemplateId;
  eyeCode: number;
  mouthCode: number;
  symbolCodes: readonly number[];
  color: DisplayFaceColorSemantic;
  tracks: readonly RuntimeTrack[];
};

type RuntimeTrack = {
  targetCode: number;
  kindCode: number;
  cycleMs: number;
  frames: readonly { durationMs: number; value: number }[];
};

type RenderState = {
  eyeShape: number;
  eyeOffsetX: number;
  faceOffsetX: number;
  symbolPrimaryOffsetY: number;
  symbolPrimaryScalePercent: number;
  symbolPrimaryVisibleCount: number;
  symbolSecondaryVisibleCount: number;
  symbolPrimaryVisible: boolean;
  symbolSecondaryVisible: boolean;
};

type Canvas = {
  profile: RuntimeProfile;
  packedPixels: Uint8Array;
  clip: { x: number; y: number; width: number; height: number };
};

const codes = DISPLAY_FACE_CONTRACT.codes;
const semanticPreviewColors: Record<DisplayFaceColorSemantic, string> = {
  idle: '#ffffff',
  working: '#00ffff',
  waiting: '#ffff00',
  success: '#00ff00',
  warning: '#ffa500',
  error: '#ff0000'
};

export function resolveDisplayFaceRendererProfile(
  capability: Pick<DeviceDisplayCapabilities, 'faceRendererProfile'>
): DisplayFaceRendererProfile | null {
  return DISPLAY_FACE_CONTRACT.profiles.find(
    (profile) => profile.id === capability.faceRendererProfile
  ) ?? null;
}

export function rasterizeDisplayFace(
  profileId: string,
  templateId: string,
  elapsedMs: number
): PixelFrame {
  const profile = DISPLAY_FACE_CONTRACT.profiles.find((item) => item.id === profileId) as RuntimeProfile | undefined;
  if (!profile) {
    throw new RangeError(`unknown display face renderer profile: ${profileId}`);
  }
  const template = (DISPLAY_FACE_CONTRACT.templates.find((item) => item.id === templateId) ??
    DISPLAY_FACE_CONTRACT.templates.find((item) => item.id === 'idle-sleep')) as RuntimeTemplate;
  const packedPixels = new Uint8Array(profile.width * profile.height / 8);
  const canvas: Canvas = { profile, packedPixels, clip: profile.regions.face };
  const state = evaluateTracks(template, elapsedMs);

  canvas.clip = profile.regions.eyes;
  drawEyes(canvas, state.eyeShape, state.faceOffsetX, state.eyeOffsetX);
  canvas.clip = profile.regions.mouth;
  drawMouth(canvas, template.mouthCode, state.faceOffsetX);
  canvas.clip = profile.regions.symbol;
  drawSymbol(canvas, template.symbolCodes[0] ?? codes.symbols.none, 0, state.symbolPrimaryVisibleCount,
    state.symbolPrimaryVisible, state.symbolPrimaryOffsetY, state.symbolPrimaryScalePercent, state.faceOffsetX);
  drawSymbol(canvas, template.symbolCodes[1] ?? codes.symbols.none, 1, state.symbolSecondaryVisibleCount,
    state.symbolSecondaryVisible, 0, 100, state.faceOffsetX);

  const color = template.color;
  return {
    profileId: profile.id,
    templateId: template.id,
    width: profile.width,
    height: profile.height,
    packedPixels,
    pixels: unpackPixels(packedPixels, profile.width, profile.height),
    color,
    previewColor: profile.previewColor === 'semantic'
      ? semanticPreviewColors[color]
      : profile.previewColor
  };
}

export function hashPackedFrame(pixels: Uint8Array): string {
  let hash = 2166136261;
  pixels.forEach((value) => {
    hash = Math.imul((hash ^ value) >>> 0, 16777619) >>> 0;
  });
  return hash.toString(16).padStart(8, '0');
}

function evaluateTracks(template: RuntimeTemplate, elapsedMs: number): RenderState {
  const none = codes.symbols.none;
  const state: RenderState = {
    eyeShape: template.eyeCode,
    eyeOffsetX: 0,
    faceOffsetX: 0,
    symbolPrimaryOffsetY: 0,
    symbolPrimaryScalePercent: 100,
    symbolPrimaryVisibleCount: (template.symbolCodes[0] ?? none) === none ? 0 : 3,
    symbolSecondaryVisibleCount: (template.symbolCodes[1] ?? none) === none ? 0 : 3,
    symbolPrimaryVisible: (template.symbolCodes[0] ?? none) !== none,
    symbolSecondaryVisible: (template.symbolCodes[1] ?? none) !== none
  };
  template.tracks.forEach((track) => {
    const value = trackValueAt(track, elapsedMs);
    switch (track.kindCode) {
      case codes.kinds['eye-shape']:
        state.eyeShape = value;
        break;
      case codes.kinds['eye-offset-x']:
        state.eyeOffsetX = value;
        break;
      case codes.kinds['symbol-visible-count']:
        if (track.targetCode === codes.targets['symbol-secondary']) {
          state.symbolSecondaryVisibleCount = value;
        } else {
          state.symbolPrimaryVisibleCount = value;
        }
        break;
      case codes.kinds['symbol-offset-y']:
        if (track.targetCode === codes.targets['symbol-primary']) state.symbolPrimaryOffsetY = value;
        break;
      case codes.kinds['symbol-scale']:
        if (track.targetCode === codes.targets['symbol-primary']) state.symbolPrimaryScalePercent = value;
        break;
      case codes.kinds['symbol-visible']:
        if (track.targetCode === codes.targets['symbol-secondary']) state.symbolSecondaryVisible = value !== 0;
        else state.symbolPrimaryVisible = value !== 0;
        break;
      case codes.kinds['face-offset-x']:
        state.faceOffsetX = value;
        break;
    }
  });
  return state;
}

function trackValueAt(track: RuntimeTrack, elapsedMs: number): number {
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.trunc(elapsedMs)) : 0;
  const phase = safeElapsed % track.cycleMs;
  let boundary = 0;
  for (const frame of track.frames) {
    boundary += frame.durationMs;
    if (phase < boundary) return frame.value;
  }
  return track.frames[track.frames.length - 1].value;
}

function setPixel(canvas: Canvas, x: number, y: number) {
  if (x < 0 || y < 0 || x >= canvas.profile.width || y >= canvas.profile.height) return;
  if (x < canvas.clip.x || y < canvas.clip.y ||
      x >= canvas.clip.x + canvas.clip.width || y >= canvas.clip.y + canvas.clip.height) return;
  const index = x + Math.trunc(y / 8) * canvas.profile.width;
  canvas.packedPixels[index] |= 1 << (y & 7);
}

function fillRect(canvas: Canvas, x: number, y: number, width: number, height: number) {
  for (let currentY = y; currentY < y + height; currentY += 1) {
    for (let currentX = x; currentX < x + width; currentX += 1) setPixel(canvas, currentX, currentY);
  }
}

function drawLine(canvas: Canvas, x0: number, y0: number, x1: number, y1: number, thickness: number) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    fillRect(canvas, x0, y0, thickness, thickness);
    if (x0 === x1 && y0 === y1) return;
    const doubled = error * 2;
    if (doubled >= dy) { error += dy; x0 += sx; }
    if (doubled <= dx) { error += dx; y0 += sy; }
  }
}

function fillCircle(canvas: Canvas, centerX: number, centerY: number, radius: number) {
  const squared = radius * radius;
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= squared) setPixel(canvas, centerX + x, centerY + y);
    }
  }
}

function drawCircle(canvas: Canvas, centerX: number, centerY: number, radius: number, thickness: number) {
  const outer = radius * radius;
  const innerRadius = radius > thickness ? radius - thickness : 0;
  const inner = innerRadius * innerRadius;
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      const distance = x * x + y * y;
      if (distance <= outer && distance >= inner) setPixel(canvas, centerX + x, centerY + y);
    }
  }
}

function triangleEdge(ax: number, ay: number, bx: number, by: number, px: number, py: number) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

function fillTriangle(
  canvas: Canvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const edge0 = triangleEdge(x0, y0, x1, y1, x, y);
      const edge1 = triangleEdge(x1, y1, x2, y2, x, y);
      const edge2 = triangleEdge(x2, y2, x0, y0, x, y);
      const hasNegative = edge0 < 0 || edge1 < 0 || edge2 < 0;
      const hasPositive = edge0 > 0 || edge1 > 0 || edge2 > 0;
      if (!(hasNegative && hasPositive)) setPixel(canvas, x, y);
    }
  }
}

function drawCurve(canvas: Canvas, centerX: number, topY: number, radius: number, height: number, thickness: number, smile: boolean) {
  for (let dx = -radius; dx <= radius; dx += 1) {
    const edge = Math.trunc(dx * dx * height / (radius * radius));
    const y = smile ? topY + height - edge : topY + edge;
    fillRect(canvas, centerX + dx, y, thickness, thickness);
  }
}

function drawEyes(canvas: Canvas, shape: number, faceOffsetX: number, eyeOffsetX: number) {
  const p = canvas.profile;
  const a = p.anchors;
  const leftX = a.leftEyeX + faceOffsetX + eyeOffsetX;
  const rightX = a.rightEyeX + faceOffsetX + eyeOffsetX;
  const { eyeY: y, eyeWidth: width, eyeHeight: height } = a;
  const stroke = p.strokeWidth;
  switch (shape) {
    case codes.eyes.closed:
      fillRect(canvas, leftX - Math.trunc(width / 2), y, width, stroke);
      fillRect(canvas, rightX - Math.trunc(width / 2), y, width, stroke);
      break;
    case codes.eyes.half:
      fillRect(canvas, leftX - Math.trunc(width / 2), y - Math.trunc(height / 4), width, Math.trunc(height / 2));
      fillRect(canvas, rightX - Math.trunc(width / 2), y - Math.trunc(height / 4), width, Math.trunc(height / 2));
      break;
    case codes.eyes['soft-open']:
      fillRect(canvas, leftX - Math.trunc(width / 2), y - Math.trunc((height - stroke) / 2), width, height - stroke);
      fillRect(canvas, rightX - Math.trunc(width / 2), y - Math.trunc((height - stroke) / 2), width, height - stroke);
      break;
    case codes.eyes['happy-arc']:
      drawCurve(canvas, leftX, y - Math.trunc(height / 2), Math.trunc(width / 2), Math.trunc(height / 2), stroke, false);
      drawCurve(canvas, rightX, y - Math.trunc(height / 2), Math.trunc(width / 2), Math.trunc(height / 2), stroke, false);
      break;
    case codes.eyes.round:
    case codes.eyes['shock-outline']:
      drawCircle(canvas, leftX, y, Math.trunc(height / 2), stroke);
      drawCircle(canvas, rightX, y, Math.trunc(height / 2), stroke);
      fillCircle(canvas, leftX, y, Math.max(1, Math.trunc(height / 5)));
      fillCircle(canvas, rightX, y, Math.max(1, Math.trunc(height / 5)));
      break;
    case codes.eyes.focus:
      fillRect(canvas, leftX - Math.trunc(width / 2), y - Math.trunc((height + stroke * 2) / 2), width, height + stroke * 2);
      fillRect(canvas, rightX - Math.trunc(width / 2), y - Math.trunc((height + stroke * 2) / 2), width, height + stroke * 2);
      break;
    default:
      fillRect(canvas, leftX - Math.trunc(width / 2), y - Math.trunc(height / 2), width, height);
      fillRect(canvas, rightX - Math.trunc(width / 2), y - Math.trunc(height / 2), width, height);
  }
}

function drawMouth(canvas: Canvas, shape: number, faceOffsetX: number) {
  const p = canvas.profile;
  const a = p.anchors;
  const x = a.mouthX + faceOffsetX;
  const y = a.mouthY;
  const radius = a.mouthRadius;
  const height = a.mouthHeight;
  const stroke = p.strokeWidth;
  if (shape === codes.mouths.smile || shape === codes.mouths['smile-arc']) {
    drawCurve(canvas, x, y, radius, height, stroke, true);
  } else if (shape === codes.mouths.o || shape === codes.mouths.call) {
    drawCircle(canvas, x, y + Math.trunc(height / 2), Math.trunc((height + 1) / 2), stroke);
  } else if (shape === codes.mouths.sad) {
    drawCurve(canvas, x, y, radius, height, stroke, false);
  } else {
    fillRect(canvas, x - radius, y + Math.trunc(height / 2), radius * 2 + 1, stroke);
  }
}

function drawZ(canvas: Canvas, x: number, y: number, size: number, thickness: number) {
  fillRect(canvas, x, y, size + 1, thickness);
  drawLine(canvas, x + size, y, x, y + size, thickness);
  fillRect(canvas, x, y + size, size + 1, thickness);
}

function drawSymbol(canvas: Canvas, shape: number, slot: number, visibleCount: number, visible: boolean,
  offsetY: number, scalePercent: number, faceOffsetX: number) {
  if (!visible || shape === codes.symbols.none) return;
  const p = canvas.profile;
  const unit = p.symbolUnit;
  const x = p.anchors.symbolX + faceOffsetX + slot * 12 * unit;
  const y = p.anchors.symbolY + offsetY;
  const stroke = p.strokeWidth;
  const scale = scalePercent > 100 ? 2 : 1;
  switch (shape) {
    case codes.symbols['sleep-z']:
      for (let index = 0; index < visibleCount; index += 1) drawZ(canvas, x + index * 7 * unit, y + index * 4 * unit, (6 - index) * unit, stroke);
      break;
    case codes.symbols['ellipsis-low']:
      for (let index = 0; index < visibleCount; index += 1) fillCircle(canvas, x + index * 8 * unit, y + 12 * unit, stroke + unit);
      break;
    case codes.symbols['busy-lines']:
      if (visibleCount >= 1) fillRect(canvas, x, y + 4 * unit, 20 * unit, stroke);
      if (visibleCount >= 2) fillRect(canvas, x + 4 * unit, y + 12 * unit, 12 * unit, stroke);
      if (visibleCount >= 3) fillRect(canvas, x, y + 20 * unit, 22 * unit, stroke);
      break;
    case codes.symbols['call-waves']:
      for (let index = 0; index < visibleCount; index += 1) {
        const dx = index * 7 * unit;
        const amplitude = (5 + index * 3) * unit;
        drawLine(canvas, x + dx, y + 18 * unit - amplitude, x + dx + 4 * unit, y + 18 * unit, stroke);
        drawLine(canvas, x + dx + 4 * unit, y + 18 * unit, x + dx, y + 18 * unit + amplitude, stroke);
      }
      break;
    case codes.symbols.heart:
      fillCircle(canvas, x, y + 3 * unit, 3 * unit); fillCircle(canvas, x + 6 * unit, y + 3 * unit, 3 * unit);
      fillTriangle(
        canvas,
        x - 3 * unit,
        y + 4 * unit,
        x + 9 * unit,
        y + 4 * unit,
        x + 3 * unit,
        y + 12 * unit
      );
      break;
    case codes.symbols.spark: {
      const radius = 7 * unit * scale;
      drawLine(canvas, x - radius, y, x + radius, y, stroke); drawLine(canvas, x, y - radius, x, y + radius, stroke);
      drawLine(canvas, x - radius, y - radius, x + radius, y + radius, stroke); drawLine(canvas, x + radius, y - radius, x - radius, y + radius, stroke);
      break;
    }
    case codes.symbols.bang:
      fillRect(canvas, x, y, stroke + unit, 14 * unit); fillCircle(canvas, x + Math.trunc(stroke / 2), y + 21 * unit, stroke + unit);
      break;
    case codes.symbols['sweat-dots']:
      for (let index = 0; index < visibleCount; index += 1) fillCircle(canvas, x, y + index * 7 * unit, stroke + unit);
      break;
    case codes.symbols['awkward-lines']:
      for (let index = 0; index < visibleCount; index += 1) fillRect(canvas, x + index * 7 * unit, y, stroke, 18 * unit);
      break;
  }
}

function unpackPixels(packed: Uint8Array, width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = x + Math.trunc(y / 8) * width;
      pixels[y * width + x] = packed[index] & (1 << (y & 7)) ? 1 : 0;
    }
  }
  return pixels;
}
