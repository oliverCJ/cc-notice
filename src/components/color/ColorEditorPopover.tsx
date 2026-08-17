import type { MouseEvent } from 'react';
import { Pipette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>;
};

export type ColorEditorPopoverProps = {
  open: boolean;
  title: string;
  color: string;
  onDraftColorChange: (color: string) => void;
  onApply: () => void;
  onClose: () => void;
};

const palette = [
  '#22C55E',
  '#38BDF8',
  '#3B82F6',
  '#A855F7',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#F8FAFC'
];

export function ColorEditorPopover({
  open,
  title,
  color,
  onDraftColorChange,
  onApply,
  onClose
}: ColorEditorPopoverProps) {
  const t = useI18n();
  if (!open) {
    return null;
  }
  const supportsEyeDropper = getEyeDropper() !== null;
  const hsv = hexToHsv(isValidHexColor(color) ? color : '#22C55E');
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  async function pickScreenColor() {
    const EyeDropper = getEyeDropper();
    if (!EyeDropper) {
      return;
    }
    try {
      const result = await new EyeDropper().open();
      onDraftColorChange(normalizeHexColor(result.sRGBHex));
    } catch {
      // 用户取消吸色时保持原颜色，不中断配置流程。
    }
  }

  function pickSaturationAndValue(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const value = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    onDraftColorChange(hsvToHex({ h: hsv.h, s: saturation, v: value }));
  }

  function pickHue(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.height <= 0) {
      return;
    }
    const hue = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360;
    onDraftColorChange(
      hsvToHex({ h: hue, s: hsv.s === 0 ? 1 : hsv.s, v: hsv.v === 0 ? 1 : hsv.v })
    );
  }

  return (
    <div
      role="dialog"
      aria-label={title}
      className="relative z-20 rounded-lg border border-primary/40 bg-background p-3 shadow-2xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">
            {t('colorEditor.currentColor', { color })}
          </p>
        </div>
        <span
          className="h-9 w-9 rounded-md border border-border"
          style={{ backgroundColor: color }}
        />
      </div>

      <div className="mb-3 grid grid-cols-[1fr_24px] gap-2">
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('colorEditor.saturationValue')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s * 100)}
          className="relative h-36 cursor-crosshair overflow-hidden rounded-md border border-border shadow-inner"
          style={{ backgroundColor: hueColor }}
          onMouseDown={pickSaturationAndValue}
          onMouseMove={(event) => {
            if (event.buttons === 1) {
              pickSaturationAndValue(event);
            }
          }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg,#FFFFFF,rgba(255,255,255,0))' }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0),#000000)' }}
          />
          <span
            aria-hidden="true"
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label={t('colorEditor.hue')}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          className="relative h-36 cursor-pointer rounded-full border border-border"
          style={{
            background:
              'linear-gradient(180deg,#EF4444,#F97316,#FACC15,#22C55E,#38BDF8,#3B82F6,#A855F7,#EF4444)'
          }}
          onMouseDown={pickHue}
          onMouseMove={(event) => {
            if (event.buttons === 1) {
              pickHue(event);
            }
          }}
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 h-3 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{ top: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-[36px_36px_minmax(0,1fr)_auto_auto] gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t('colorEditor.pickScreenColor')}
          disabled={!supportsEyeDropper}
          onClick={pickScreenColor}
        >
          <Pipette className="h-4 w-4" />
        </Button>
        <label className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background shadow-sm">
          <span className="sr-only">{t('colorEditor.nativeColorInput')}</span>
          <input
            aria-label={t('colorEditor.nativeColorInput')}
            type="color"
            value={isValidHexColor(color) ? color.toLowerCase() : '#22c55e'}
            className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
            onChange={(event) => onDraftColorChange(normalizeHexColor(event.target.value))}
          />
        </label>
        <Input
          aria-label={t('colorEditor.hexColor')}
          value={color}
          onChange={(event) => onDraftColorChange(normalizeHexDraft(event.target.value))}
        />
        <Button type="button" disabled={!isValidHexColor(color)} onClick={onApply}>
          {t('colorEditor.applyColor')}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('colorEditor.close')}
        </Button>
      </div>

      {!supportsEyeDropper ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {t('colorEditor.eyedropperUnsupported')}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t('colorEditor.presetColors')}
          </p>
          <p className="text-xs text-muted-foreground">{t('colorEditor.presetHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {palette.map((preset) => (
            <button
              key={preset}
              type="button"
              className="h-7 w-7 rounded-md border border-border shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: preset }}
              aria-label={`${t('colorEditor.presetColors')} ${preset}`}
              onClick={() => onDraftColorChange(preset)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function normalizeHexColor(color: string): string {
  const normalized = color.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : color;
}

export function normalizeHexDraft(color: string): string {
  const value = color.trim().toUpperCase();
  if (!value) {
    return '#';
  }
  return value.startsWith('#') ? value : `#${value}`;
}

export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/.test(color.trim().toUpperCase());
}

function getEyeDropper(): EyeDropperConstructor | null {
  if (typeof window === 'undefined' || !('EyeDropper' in window)) {
    return null;
  }
  return (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper ?? null;
}

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

function hexToHsv(color: string): HsvColor {
  const { r, g, b } = hexToRgb(color);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

function hsvToHex({ h, s, v }: HsvColor): string {
  const normalizedHue = ((h % 360) + 360) % 360;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((normalizedHue / 60) % 2) - 1));
  const match = v - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (normalizedHue < 60) {
    red = chroma;
    green = x;
  } else if (normalizedHue < 120) {
    red = x;
    green = chroma;
  } else if (normalizedHue < 180) {
    green = chroma;
    blue = x;
  } else if (normalizedHue < 240) {
    green = x;
    blue = chroma;
  } else if (normalizedHue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return rgbToHex({
    r: Math.round((red + match) * 255),
    g: Math.round((green + match) * 255),
    b: Math.round((blue + match) * 255)
  });
}

function hexToRgb(color: string) {
  const value = color.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
