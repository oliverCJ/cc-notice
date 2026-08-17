import type {
  DesktopNoticeColorMode,
  DesktopNoticeColorStop,
  DesktopNoticeEdge,
  DesktopNoticeSize
} from './desktopNotice';

export type ResolvedDesktopNoticeEdge = Exclude<DesktopNoticeEdge, 'auto'>;

export type DesktopNoticeLayerStyle = {
  backgroundImage: string;
  backgroundBlendMode?: 'screen';
  boxShadow?: string;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export function resolveDesktopNoticeEdge(
  edge: DesktopNoticeEdge,
  size: Pick<DesktopNoticeSize, 'width' | 'height'>
): ResolvedDesktopNoticeEdge {
  if (edge !== 'auto') {
    return edge;
  }
  return size.height > size.width ? 'right' : 'bottom';
}

export function edgeOrientationForEdge(edge: ResolvedDesktopNoticeEdge): 'horizontal' | 'vertical' {
  return edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal';
}

export function edgeBreathingHaloStyle(
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[],
  edge: ResolvedDesktopNoticeEdge
): DesktopNoticeLayerStyle {
  const orientation = edgeOrientationForEdge(edge);
  const anchor = edgeRadialAnchor(edge);
  const { r, g, b } = primaryEffectColor(colors);
  if (colorMode === 'gradient' && colors.length > 1) {
    return {
      backgroundImage: `${edgeHaloGradient(anchor, r, g, b)}, ${effectColorGradient(colors, 0.38, orientation)}`,
      backgroundBlendMode: 'screen'
    };
  }
  return {
    backgroundImage: edgeHaloGradient(anchor, r, g, b)
  };
}

export function edgeBreathingLineStyle(
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[],
  edge: ResolvedDesktopNoticeEdge
): DesktopNoticeLayerStyle {
  const orientation = edgeOrientationForEdge(edge);
  const { r, g, b } = primaryEffectColor(colors);
  if (colorMode === 'gradient' && colors.length > 1) {
    return {
      backgroundImage: `${edgeLineFade(edge, r, g, b)}, ${effectColorGradient(colors, 1, orientation)}`,
      backgroundBlendMode: 'screen',
      boxShadow: edgeBreathingLineShadow(colors)
    };
  }
  return {
    backgroundImage: edgeLineFade(edge, r, g, b),
    boxShadow: edgeBreathingLineShadow(colors)
  };
}

export function rgbFromHex(color: string): RgbColor {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(color);
  if (!match) {
    return { r: 34, g: 197, b: 94 };
  }
  const value = match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function primaryEffectColor(colors: DesktopNoticeColorStop[]): RgbColor {
  return rgbFromHex(colors[0]?.color ?? '#22C55E');
}

function edgeRadialAnchor(edge: ResolvedDesktopNoticeEdge) {
  if (edge === 'top') {
    return '50% 0%';
  }
  if (edge === 'left') {
    return '0% 50%';
  }
  if (edge === 'right') {
    return '100% 50%';
  }
  return '50% 100%';
}

function edgeHaloGradient(anchor: string, r: number, g: number, b: number) {
  return `radial-gradient(ellipse at ${anchor}, rgba(255,255,255,0.98) 0%, rgba(${r},${g},${b},0.8) 15%, rgba(${r},${g},${b},0.32) 42%, rgba(${r},${g},${b},0) 76%)`;
}

function edgeLineFade(edge: ResolvedDesktopNoticeEdge, r: number, g: number, b: number) {
  const angle = edgeOrientationForEdge(edge) === 'vertical' ? 180 : 90;
  return `linear-gradient(${angle}deg, transparent 0%, transparent 10%, rgba(${r},${g},${b},0.36) 28%, rgba(${r},${g},${b},1) 50%, rgba(${r},${g},${b},0.36) 72%, transparent 90%, transparent 100%)`;
}

function edgeBreathingLineShadow(colors: DesktopNoticeColorStop[]) {
  const { r, g, b } = primaryEffectColor(colors);
  return `0 0 7px rgba(${r},${g},${b},0.82), 0 0 18px rgba(${r},${g},${b},0.32)`;
}

function effectColorGradient(
  colors: DesktopNoticeColorStop[],
  alpha: number,
  orientation: 'horizontal' | 'vertical'
) {
  const angle = orientation === 'vertical' ? 180 : 90;
  const stops = colors
    .map((stop) => {
      const { r, g, b } = rgbFromHex(stop.color);
      return `rgba(${r},${g},${b},${alpha}) ${stop.position}%`;
    })
    .join(', ');
  return `linear-gradient(${angle}deg, ${stops})`;
}
