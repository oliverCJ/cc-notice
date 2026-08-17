import type {
  DesktopMascotPlayMode,
  DesktopMascotRuntimePack,
  DesktopMascotSettings,
  DesktopMascotState
} from './desktopMascot';
import {
  createDefaultMascotSettings,
  DESKTOP_MASCOT_STAGE_SIZE_LIMITS,
  desktopMascotPackById
} from './desktopMascot';

export type DesktopNoticeVariant = 'custom-lightbar' | 'edge-lightbar' | 'mascot';
export type DesktopNoticeDefaultState = 'hidden' | 'solid' | 'breathing';
export type DesktopNoticeDirection = 'horizontal' | 'vertical';
export type DesktopNoticeScreenEdge = 'top' | 'bottom' | 'left' | 'right';
export type DesktopNoticePresetPosition =
  | 'top-center'
  | 'bottom-center'
  | 'left-center'
  | 'right-center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'custom';
export type DesktopNoticeColorMode = 'solid' | 'gradient';
export type DesktopNoticeRuleEffect =
  | 'solid'
  | 'breathing'
  | 'blink'
  | 'scan'
  | 'fade'
  | 'edge-breathing';
export type DesktopNoticeEdge = 'auto' | 'top' | 'bottom' | 'left' | 'right';
export type DesktopNoticeIdleBehavior = 'hidden' | 'dim-placeholder' | 'keep-last';
export type DesktopNoticeRestoreBehavior =
  | 'use-instance-idle'
  | 'hide'
  | 'keep-last'
  | 'dim-placeholder'
  | 'restore-default';
export type DesktopNoticeRuleTarget = {
  targetId: string;
  effect: DesktopNoticeRuleEffect;
  colorMode: DesktopNoticeColorMode;
  colors: DesktopNoticeColorStop[];
  durationMs: number;
  animationPeriodMs?: number | null;
  breathingPeriodMs?: number | null;
  opacityPercent?: number | null;
  brightnessPercent?: number | null;
  restoreBehavior: DesktopNoticeRestoreBehavior;
  edge?: DesktopNoticeEdge | null;
  mascotState?: DesktopMascotState | null;
  mascotActionId?: string | null;
  mascotPlayMode?: DesktopMascotPlayMode | null;
  mascotPlaybackWindowMs?: number | null;
  mascotBubbleTemplate?: string | null;
};
export type DesktopNoticeValidationCode =
  | 'DESKTOP_NOTICE_INSTANCE_NAME_REQUIRED'
  | 'DESKTOP_NOTICE_INSTANCE_NAME_TOO_LONG'
  | 'DESKTOP_NOTICE_INVALID_SIZE'
  | 'DESKTOP_NOTICE_INVALID_OPACITY'
  | 'DESKTOP_NOTICE_INVALID_CORNER_RADIUS'
  | 'DESKTOP_NOTICE_INVALID_STATE_EFFECT'
  | 'DESKTOP_NOTICE_INVALID_COLOR'
  | 'DESKTOP_NOTICE_INVALID_COLOR_STOPS'
  | 'DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR'
  | 'DESKTOP_NOTICE_RULE_TARGET_REQUIRED'
  | 'DESKTOP_NOTICE_RULE_DURATION_INVALID'
  | 'DESKTOP_MASCOT_ASSET_PACK_NOT_FOUND'
  | 'DESKTOP_MASCOT_INVALID_STAGE_SIZE'
  | 'DESKTOP_MASCOT_INVALID_BUBBLE_TEXT';

export type DesktopNoticeSize = {
  width: number;
  height: number;
};

export type DesktopNoticeColorStop = {
  color: string;
  position: number;
};

export type DesktopNoticeAppearance = {
  colorMode: DesktopNoticeColorMode;
  colors: DesktopNoticeColorStop[];
};

export type DesktopNoticeDefaultStateConfig = {
  brightnessPercent: number;
  breathingPeriodMs: number;
};

export type DesktopNoticeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWorkArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};

export type CustomLightbarSettings = {
  presetPosition: DesktopNoticePresetPosition;
  direction: DesktopNoticeDirection;
  size: DesktopNoticeSize;
  opacityPercent: number;
  cornerRadiusPercent: number;
  boundsOverride?: DesktopNoticeBounds | null;
};

export type EdgeLightbarSettings = {
  enabledEdges: DesktopNoticeScreenEdge[];
  thicknessPx: number;
  insetPx: number;
  opacityPercent: number;
};

export type DesktopNoticeInstance = {
  id: string;
  name: string;
  variant: DesktopNoticeVariant;
  enabled: boolean;
  showOnStartup: boolean;
  alwaysOnTop: boolean;
  idleBehavior: DesktopNoticeIdleBehavior;
  customLightbar?: CustomLightbarSettings | null;
  edgeLightbar?: EdgeLightbarSettings | null;
  mascot?: DesktopMascotSettings | null;
};

export type DesktopNoticeWindowPayload = {
  instanceId: string;
  name: string;
  variant: DesktopNoticeVariant;
  direction: DesktopNoticeDirection;
  defaultState: DesktopNoticeDefaultState;
  size: DesktopNoticeSize;
  opacityPercent: number;
  cornerRadiusPercent: number;
  idleBehavior: DesktopNoticeIdleBehavior;
  defaultStateConfig: DesktopNoticeDefaultStateConfig;
  appearance: DesktopNoticeAppearance;
  effect?: DesktopNoticeRuleEffect | null;
  edge?: DesktopNoticeEdge | null;
  durationMs?: number | null;
  animationPeriodMs?: number | null;
  breathingPeriodMs?: number | null;
  opacityOverridePercent?: number | null;
  brightnessOverridePercent?: number | null;
  customLightbar?: CustomLightbarSettings | null;
  edgeLightbar?: EdgeLightbarSettings | null;
  mascot?: DesktopMascotSettings | null;
  resolvedMascotPack?: DesktopMascotRuntimePack | null;
  mascotState?: DesktopMascotState | null;
  mascotActionId?: string | null;
  mascotPlayMode?: DesktopMascotPlayMode | null;
  mascotPlaybackWindowMs?: number | null;
  mascotBubbleText?: string | null;
  previewMode?: boolean;
};

export type DesktopNoticeValidationResult =
  | { valid: true }
  | { valid: false; code: DesktopNoticeValidationCode };

export type DesktopNoticeValidationOptions = {
  mascotAssetPackIds?: string[];
};

export const DESKTOP_NOTICE_SIZE_LIMITS = {
  minWidth: 10,
  maxWidth: 2000,
  minHeight: 10,
  maxHeight: 2000
};

export const DESKTOP_NOTICE_OPACITY_LIMITS = {
  min: 10,
  max: 100
};

export const DESKTOP_NOTICE_CORNER_RADIUS_LIMITS = {
  min: 0,
  max: 50
};

export const DESKTOP_NOTICE_BRIGHTNESS_LIMITS = {
  min: 10,
  max: 100
};

export const DESKTOP_NOTICE_BREATHING_PERIOD_LIMITS = {
  min: 500,
  max: 5000
};

export const DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS: Record<
  Extract<DesktopNoticeRuleEffect, 'breathing' | 'edge-breathing' | 'blink' | 'scan'>,
  { min: number; max: number; defaultValue: number }
> = {
  breathing: { min: 500, max: 5000, defaultValue: 1600 },
  'edge-breathing': { min: 500, max: 5000, defaultValue: 1600 },
  blink: { min: 200, max: 3000, defaultValue: 800 },
  scan: { min: 500, max: 8000, defaultValue: 2200 }
};

export const DESKTOP_NOTICE_RULE_DURATION_LIMITS = {
  min: 100,
  max: 60000
};

export const DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS = {
  min: 500,
  max: 8000,
  defaultValue: 1800
};

export function createDefaultDesktopNoticeInstance(): DesktopNoticeInstance {
  return createDefaultCustomLightbarInstance();
}

export function createDefaultCustomLightbarSettings(): CustomLightbarSettings {
  return {
    presetPosition: 'top-center',
    direction: 'horizontal',
    size: { width: 720, height: 32 },
    opacityPercent: 100,
    cornerRadiusPercent: 0,
    boundsOverride: null
  };
}

export function createDefaultEdgeLightbarSettings(): EdgeLightbarSettings {
  return {
    enabledEdges: ['top', 'bottom'],
    thicknessPx: 18,
    insetPx: 0,
    opacityPercent: 100
  };
}

export function createDefaultCustomLightbarInstance(): DesktopNoticeInstance {
  return {
    id: `desktop-notice-${shortRandomId()}`,
    name: '桌面提示',
    variant: 'custom-lightbar',
    enabled: true,
    showOnStartup: false,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: createDefaultCustomLightbarSettings(),
    edgeLightbar: null,
    mascot: null
  };
}

export function createDefaultEdgeLightbarInstance(): DesktopNoticeInstance {
  return {
    id: `desktop-notice-${shortRandomId()}`,
    name: '屏幕边缘灯条',
    variant: 'edge-lightbar',
    enabled: true,
    showOnStartup: false,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: null,
    edgeLightbar: createDefaultEdgeLightbarSettings(),
    mascot: null
  };
}

export function createDefaultMascotInstance(): DesktopNoticeInstance {
  return {
    id: `desktop-notice-${shortRandomId()}`,
    name: '桌面精灵',
    variant: 'mascot',
    enabled: true,
    showOnStartup: true,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: null,
    edgeLightbar: null,
    mascot: createDefaultMascotSettings()
  };
}

export function recommendedDesktopNoticeDirection(
  position: DesktopNoticePresetPosition
): DesktopNoticeDirection {
  return position === 'left-center' || position === 'right-center' ? 'vertical' : 'horizontal';
}

export function desktopNoticeSizeForDirection(
  size: DesktopNoticeSize,
  direction: DesktopNoticeDirection
): DesktopNoticeSize {
  if (direction === 'vertical' && size.width > size.height) {
    return { width: size.height, height: size.width };
  }
  if (direction === 'horizontal' && size.height > size.width) {
    return { width: size.height, height: size.width };
  }
  return size;
}

export function validateDesktopNoticeInstance(
  instance: DesktopNoticeInstance,
  options: DesktopNoticeValidationOptions = {}
): DesktopNoticeValidationResult {
  const name = instance.name.trim();
  if (!name) {
    return { valid: false, code: 'DESKTOP_NOTICE_INSTANCE_NAME_REQUIRED' };
  }
  if ([...name].length > 40) {
    return { valid: false, code: 'DESKTOP_NOTICE_INSTANCE_NAME_TOO_LONG' };
  }
  if (instance.variant === 'custom-lightbar') {
    return validateCustomLightbarSettings(instance.customLightbar ?? null);
  }
  if (instance.variant === 'edge-lightbar') {
    return validateEdgeLightbarSettings(instance.edgeLightbar ?? null);
  }
  if (instance.variant === 'mascot') {
    return validateMascotSettings(instance.mascot ?? null, options);
  }
  return { valid: false, code: 'DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR' };
}

function validateMascotSettings(
  settings: DesktopMascotSettings | null,
  options: DesktopNoticeValidationOptions
): DesktopNoticeValidationResult {
  if (!settings) {
    return { valid: false, code: 'DESKTOP_MASCOT_INVALID_STAGE_SIZE' };
  }
  if (
    !desktopMascotPackById(settings.assetPackId) &&
    !options.mascotAssetPackIds?.includes(settings.assetPackId)
  ) {
    return { valid: false, code: 'DESKTOP_MASCOT_ASSET_PACK_NOT_FOUND' };
  }
  const { width, height } = settings.stageSize;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < DESKTOP_MASCOT_STAGE_SIZE_LIMITS.minWidth ||
    width > DESKTOP_MASCOT_STAGE_SIZE_LIMITS.maxWidth ||
    height < DESKTOP_MASCOT_STAGE_SIZE_LIMITS.minHeight ||
    height > DESKTOP_MASCOT_STAGE_SIZE_LIMITS.maxHeight
  ) {
    return { valid: false, code: 'DESKTOP_MASCOT_INVALID_STAGE_SIZE' };
  }
  return { valid: true };
}

function validateCustomLightbarSettings(
  settings: CustomLightbarSettings | null
): DesktopNoticeValidationResult {
  if (!settings) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_SIZE' };
  }
  if (!isValidDirectionalSize(settings.size, settings.direction)) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_SIZE' };
  }
  if (!isValidOpacityPercent(settings.opacityPercent)) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_OPACITY' };
  }
  if (!isValidCornerRadiusPercent(settings.cornerRadiusPercent)) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_CORNER_RADIUS' };
  }
  return { valid: true };
}

function validateEdgeLightbarSettings(
  settings: EdgeLightbarSettings | null
): DesktopNoticeValidationResult {
  if (!settings || settings.enabledEdges.length === 0) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR' };
  }
  const uniqueEdges = new Set(settings.enabledEdges);
  if (
    uniqueEdges.size !== settings.enabledEdges.length ||
    settings.enabledEdges.some((edge) => !['top', 'bottom', 'left', 'right'].includes(edge))
  ) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR' };
  }
  if (
    !Number.isInteger(settings.thicknessPx) ||
    settings.thicknessPx < DESKTOP_NOTICE_SIZE_LIMITS.minHeight ||
    settings.thicknessPx > DESKTOP_NOTICE_SIZE_LIMITS.maxHeight ||
    !Number.isInteger(settings.insetPx) ||
    settings.insetPx < 0 ||
    settings.insetPx > DESKTOP_NOTICE_SIZE_LIMITS.maxWidth
  ) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR' };
  }
  if (!isValidOpacityPercent(settings.opacityPercent)) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_OPACITY' };
  }
  return { valid: true };
}

export function validateDesktopNoticeRuleAppearance(
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[]
): DesktopNoticeValidationResult {
  if (colorMode === 'solid' && colors.length !== 1) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_COLOR_STOPS' };
  }
  if (colorMode === 'gradient' && (colors.length < 2 || colors.length > 4)) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_COLOR_STOPS' };
  }
  if (
    colors.some(
      (stop) => !/^#[0-9A-Fa-f]{6}$/.test(stop.color) || stop.position < 0 || stop.position > 100
    )
  ) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_COLOR' };
  }
  return { valid: true };
}

export function validateDesktopNoticeRuleConfig(params: {
  targetIds: string[];
  effect?: DesktopNoticeRuleEffect | null;
  colorMode: DesktopNoticeColorMode;
  colors: DesktopNoticeColorStop[];
  durationMs: number;
  animationPeriodMs?: number | null;
  breathingPeriodMs?: number | null;
}): DesktopNoticeValidationResult {
  if (params.targetIds.length === 0 || params.targetIds.some((targetId) => !targetId.trim())) {
    return { valid: false, code: 'DESKTOP_NOTICE_RULE_TARGET_REQUIRED' };
  }
  if (
    !Number.isInteger(params.durationMs) ||
    params.durationMs < DESKTOP_NOTICE_RULE_DURATION_LIMITS.min ||
    params.durationMs > DESKTOP_NOTICE_RULE_DURATION_LIMITS.max
  ) {
    return { valid: false, code: 'DESKTOP_NOTICE_RULE_DURATION_INVALID' };
  }
  const animationEffect =
    params.effect ??
    (params.breathingPeriodMs != null ? ('breathing' as const) : null);
  const animationPeriodMs = params.animationPeriodMs ?? params.breathingPeriodMs;
  if (
    animationEffect &&
    isDesktopNoticeAnimatedEffect(animationEffect) &&
    !isValidDesktopNoticeAnimationPeriod(animationEffect, animationPeriodMs)
  ) {
    return { valid: false, code: 'DESKTOP_NOTICE_INVALID_STATE_EFFECT' };
  }
  return validateDesktopNoticeRuleAppearance(params.colorMode, params.colors);
}

export function isDesktopNoticeAnimatedEffect(
  effect: DesktopNoticeRuleEffect
): effect is keyof typeof DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS {
  return effect in DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS;
}

export function defaultDesktopNoticeAnimationPeriod(effect: DesktopNoticeRuleEffect): number {
  return isDesktopNoticeAnimatedEffect(effect)
    ? DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect].defaultValue
    : DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS.breathing.defaultValue;
}

export function normalizeDesktopNoticeAnimationPeriod(
  effect: DesktopNoticeRuleEffect,
  value: number | null | undefined
): number {
  const limits = isDesktopNoticeAnimatedEffect(effect)
    ? DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect]
    : DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS.breathing;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return limits.defaultValue;
  }
  return Math.min(limits.max, Math.max(limits.min, value));
}

export function isValidDesktopNoticeAnimationPeriod(
  effect: DesktopNoticeRuleEffect,
  value: number | null | undefined
): boolean {
  if (!isDesktopNoticeAnimatedEffect(effect) || typeof value !== 'number' || !Number.isInteger(value)) {
    return false;
  }
  const limits = DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect];
  return value >= limits.min && value <= limits.max;
}

export function isOnceMascotPlayMode(
  playMode: DesktopMascotPlayMode | null | undefined
): playMode is Extract<DesktopMascotPlayMode, 'once-then-hold' | 'once-then-idle'> {
  return playMode === 'once-then-hold' || playMode === 'once-then-idle';
}

export function normalizeDesktopMascotPlaybackWindowMs(
  value: number | null | undefined
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.defaultValue;
  }
  return Math.min(
    DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.max,
    Math.max(DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.min, value)
  );
}

function isValidOpacityPercent(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= DESKTOP_NOTICE_OPACITY_LIMITS.min &&
    value <= DESKTOP_NOTICE_OPACITY_LIMITS.max
  );
}

function isValidCornerRadiusPercent(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= DESKTOP_NOTICE_CORNER_RADIUS_LIMITS.min &&
    value <= DESKTOP_NOTICE_CORNER_RADIUS_LIMITS.max
  );
}

function isValidDirectionalSize(
  size: DesktopNoticeSize,
  _direction: DesktopNoticeDirection
): boolean {
  return (
    Number.isInteger(size.width) &&
    Number.isInteger(size.height) &&
    size.width >= DESKTOP_NOTICE_SIZE_LIMITS.minWidth &&
    size.width <= DESKTOP_NOTICE_SIZE_LIMITS.maxWidth &&
    size.height >= DESKTOP_NOTICE_SIZE_LIMITS.minHeight &&
    size.height <= DESKTOP_NOTICE_SIZE_LIMITS.maxHeight
  );
}

export function desktopNoticeValidationMessage(code: DesktopNoticeValidationCode): string {
  const messages: Record<DesktopNoticeValidationCode, string> = {
    DESKTOP_NOTICE_INSTANCE_NAME_REQUIRED: '请填写桌面提示名称。',
    DESKTOP_NOTICE_INSTANCE_NAME_TOO_LONG: '桌面提示名称不能超过 40 个字符。',
    DESKTOP_NOTICE_INVALID_SIZE: '桌面提示尺寸超出允许范围。',
    DESKTOP_NOTICE_INVALID_OPACITY: '透明度必须在 10% 到 100% 之间。',
    DESKTOP_NOTICE_INVALID_CORNER_RADIUS: '圆角必须在 0% 到 50% 之间。',
    DESKTOP_NOTICE_INVALID_STATE_EFFECT: '默认状态效果参数超出允许范围。',
    DESKTOP_NOTICE_INVALID_COLOR: '颜色必须使用 #RRGGBB 格式。',
    DESKTOP_NOTICE_INVALID_COLOR_STOPS: '当前颜色模式的色标数量不正确。',
    DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR: '屏幕边缘灯条设置不完整。',
    DESKTOP_NOTICE_RULE_TARGET_REQUIRED: '请选择至少一个桌面提示实例。',
    DESKTOP_NOTICE_RULE_DURATION_INVALID: '桌面提示显示时长必须在 100 到 60000 毫秒之间。',
    DESKTOP_MASCOT_ASSET_PACK_NOT_FOUND: '桌面精灵资源包不存在。',
    DESKTOP_MASCOT_INVALID_STAGE_SIZE: '桌面精灵舞台尺寸超出允许范围。',
    DESKTOP_MASCOT_INVALID_BUBBLE_TEXT: '桌面精灵气泡文本超出允许范围。'
  };
  return messages[code];
}

function shortRandomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().split('-')[0];
  }
  return Math.random().toString(36).slice(2, 10);
}
