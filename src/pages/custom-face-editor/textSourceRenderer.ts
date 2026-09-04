import {
  cssFontFamilyForTextPixelizer,
  normalizeTextPixelizerOptions,
  type TextPixelizerOptions
} from './textPixelizerOptions';

export type RenderedTextPixelizerSource = {
  bytes: number[];
  previewUrl: string;
  width: number;
  height: number;
  lineCount: number;
};

const MAX_TEXT_SOURCE_EDGE = 2048;
const TEXT_SOURCE_RENDER_SCALE = 4;

export async function renderTextPixelizerSource(
  canvasSize: { width: number; height: number },
  options: TextPixelizerOptions
): Promise<RenderedTextPixelizerSource | null> {
  const normalized = normalizeTextPixelizerOptions(options);
  if (!normalized.text.trim()) return null;

  const measuringCanvas = document.createElement('canvas');
  const measuringContext = measuringCanvas.getContext('2d');
  if (!measuringContext) throw new Error('text-render-context-unavailable');

  const renderScale = textSourceRenderScale(canvasSize);
  const renderFontSize = normalized.fontSize * renderScale;
  const renderPadding = normalized.padding * renderScale;
  const letterSpacingPx = normalized.fontSize * normalized.letterSpacingEm * renderScale;
  const lineHeightPx = Math.max(1, Math.ceil(renderFontSize * normalized.lineHeight));
  measuringContext.font = `${normalized.fontWeight} ${renderFontSize}px ${cssFontFamilyForTextPixelizer(normalized.fontFamily)}`;
  const width = Math.min(MAX_TEXT_SOURCE_EDGE, Math.max(1, canvasSize.width * TEXT_SOURCE_RENDER_SCALE));
  const height = Math.min(MAX_TEXT_SOURCE_EDGE, Math.max(1, canvasSize.height * TEXT_SOURCE_RENDER_SCALE));
  const maxLineWidth = Math.max(1, width - renderPadding * 2);
  const lines = layoutTextLines(measuringContext, normalized.text, maxLineWidth, normalized.wrap, letterSpacingPx);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('text-render-context-unavailable');

  context.clearRect(0, 0, width, height);
  context.font = `${normalized.fontWeight} ${renderFontSize}px ${cssFontFamilyForTextPixelizer(normalized.fontFamily)}`;
  context.fillStyle = '#000000';
  context.textBaseline = 'top';
  context.textAlign = normalized.align;

  const textX = textAnchorX(width, renderPadding, normalized.align);
  const blockHeight = lines.length * lineHeightPx;
  const startY = clampTextPosition(renderPadding, height, blockHeight);
  lines.forEach((line, index) => {
    drawLineWithLetterSpacing(context, line, textX, startY + index * lineHeightPx, normalized.align, letterSpacingPx);
  });

  const blob = await canvasToPngBlob(canvas);
  const buffer = await blobToArrayBuffer(blob);
  return {
    bytes: Array.from(new Uint8Array(buffer)),
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    lineCount: lines.length
  };
}

function layoutTextLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxLineWidth: number,
  wrap: boolean,
  letterSpacingPx: number
) {
  const explicitLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (!wrap) return explicitLines;
  return explicitLines.flatMap((line) => wrapLine(context, line, maxLineWidth, letterSpacingPx));
}

function wrapLine(
  context: CanvasRenderingContext2D,
  line: string,
  maxLineWidth: number,
  letterSpacingPx: number
) {
  if (line.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const char of Array.from(line)) {
    const next = `${current}${char}`;
    if (current && measureLineWidth(context, next, letterSpacingPx) > maxLineWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}

function measureLineWidth(context: CanvasRenderingContext2D, line: string, letterSpacingPx: number) {
  const chars = Array.from(line);
  if (chars.length === 0) return 0;
  return chars.reduce((sum, char) => sum + context.measureText(char).width, 0)
    + Math.max(0, chars.length - 1) * letterSpacingPx;
}

function drawLineWithLetterSpacing(
  context: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  align: CanvasTextAlign,
  letterSpacingPx: number
) {
  const chars = Array.from(line);
  const lineWidth = measureLineWidth(context, line, letterSpacingPx);
  let cursorX = align === 'right' ? x - lineWidth : align === 'center' ? x - lineWidth / 2 : x;
  chars.forEach((char) => {
    context.fillText(char, cursorX, y);
    cursorX += context.measureText(char).width + letterSpacingPx;
  });
}

function textAnchorX(width: number, padding: number, align: CanvasTextAlign) {
  if (align === 'left') return padding;
  if (align === 'right') return width - padding;
  return width / 2;
}

function textSourceRenderScale(canvasSize: { width: number; height: number }) {
  const scaledWidth = Math.max(1, canvasSize.width * TEXT_SOURCE_RENDER_SCALE);
  const scaledHeight = Math.max(1, canvasSize.height * TEXT_SOURCE_RENDER_SCALE);
  return Math.min(
    TEXT_SOURCE_RENDER_SCALE,
    MAX_TEXT_SOURCE_EDGE / Math.max(scaledWidth, scaledHeight)
  );
}

function clampTextPosition(padding: number, canvasHeight: number, contentHeight: number) {
  return Math.max(padding, Math.round((canvasHeight - contentHeight) / 2));
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('text-render-empty-blob'));
    }, 'image/png');
  });
}

function blobToArrayBuffer(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('text-render-read-failed'));
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error('text-render-read-failed'));
    };
    reader.readAsArrayBuffer(blob);
  });
}
