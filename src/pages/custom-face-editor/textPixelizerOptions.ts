export type TextPixelizerFontFamily = 'sans-serif' | 'serif' | 'monospace' | 'system-cjk-sans';
export type TextPixelizerFontWeight = 'normal' | 'bold';
export type TextPixelizerAlign = 'left' | 'center' | 'right';

export type TextPixelizerOptions = {
  text: string;
  fontFamily: TextPixelizerFontFamily;
  fontSize: number;
  letterSpacingEm: number;
  fontWeight: TextPixelizerFontWeight;
  align: TextPixelizerAlign;
  lineHeight: number;
  wrap: boolean;
  padding: number;
};

export type TextPixelizerLimits = {
  softLimit: number;
  hardLimit: number;
};

export const TEXT_PIXELIZER_FONT_PRESETS: Array<{
  value: TextPixelizerFontFamily;
  labelKey: string;
  cssFamily: string;
}> = [
  {
    value: 'sans-serif',
    labelKey: 'customFaceEditor.imagePixelizer.fontSans',
    cssFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  {
    value: 'serif',
    labelKey: 'customFaceEditor.imagePixelizer.fontSerif',
    cssFamily: 'Georgia, "Times New Roman", serif'
  },
  {
    value: 'monospace',
    labelKey: 'customFaceEditor.imagePixelizer.fontMono',
    cssFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
  },
  {
    value: 'system-cjk-sans',
    labelKey: 'customFaceEditor.imagePixelizer.fontCjkSans',
    cssFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
  }
];

export function defaultTextPixelizerOptions(): TextPixelizerOptions {
  return {
    text: '',
    fontFamily: 'sans-serif',
    fontSize: 24,
    letterSpacingEm: 0,
    fontWeight: 'normal',
    align: 'center',
    lineHeight: 1.1,
    wrap: true,
    padding: 4
  };
}

export function normalizeTextPixelizerOptions(options: Partial<TextPixelizerOptions>): TextPixelizerOptions {
  const fontFamily = TEXT_PIXELIZER_FONT_PRESETS.some((item) => item.value === options.fontFamily)
    ? options.fontFamily as TextPixelizerFontFamily
    : 'sans-serif';
  const fontWeight = options.fontWeight === 'bold' ? 'bold' : 'normal';
  const align = options.align === 'left' || options.align === 'right' ? options.align : 'center';
  return {
    ...defaultTextPixelizerOptions(),
    ...options,
    text: String(options.text ?? ''),
    fontFamily,
    fontSize: clamp(Math.trunc(Number(options.fontSize) || 24), 8, 128),
    letterSpacingEm: clamp(Number(options.letterSpacingEm) || 0, -0.25, 1),
    fontWeight,
    align,
    lineHeight: clamp(Number(options.lineHeight) || 1.1, 0.8, 2),
    wrap: options.wrap !== false,
    padding: clamp(Math.trunc(Number(options.padding) || 0), 0, 64)
  };
}

export function cssFontFamilyForTextPixelizer(fontFamily: TextPixelizerFontFamily) {
  return TEXT_PIXELIZER_FONT_PRESETS.find((item) => item.value === fontFamily)?.cssFamily
    ?? TEXT_PIXELIZER_FONT_PRESETS[0].cssFamily;
}

export function estimateTextPixelizerLimits(
  canvasSize: { width: number; height: number },
  options: Partial<TextPixelizerOptions>
): TextPixelizerLimits {
  const normalized = normalizeTextPixelizerOptions(options);
  const usableWidth = Math.max(1, canvasSize.width - normalized.padding * 2);
  const usableHeight = Math.max(1, canvasSize.height - normalized.padding * 2);
  const approximateCjkPerLine = Math.max(1, Math.floor(usableWidth / Math.max(1, normalized.fontSize)));
  const approximateLines = Math.max(1, Math.floor(usableHeight / Math.max(1, normalized.fontSize * normalized.lineHeight)));
  const visibleEstimate = approximateCjkPerLine * approximateLines;
  const softLimit = clamp(visibleEstimate * 8, 24, 1200);
  const hardLimit = clamp(visibleEstimate * 24, 80, 3000);
  return { softLimit, hardLimit };
}

export function truncateTextToPixelizerHardLimit(text: string, limits: TextPixelizerLimits) {
  return text.length > limits.hardLimit ? text.slice(0, limits.hardLimit) : text;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
