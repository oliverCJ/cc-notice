import { describe, expect, test } from 'vitest';
import {
  DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS,
  createDefaultEdgeLightbarInstance,
  createDefaultDesktopNoticeInstance,
  createDefaultMascotInstance,
  desktopNoticeSizeForDirection,
  isOnceMascotPlayMode,
  normalizeDesktopMascotPlaybackWindowMs,
  recommendedDesktopNoticeDirection,
  validateDesktopNoticeRuleConfig,
  validateDesktopNoticeInstance
} from './desktopNotice';

describe('desktopNotice domain', () => {
  test('creates custom lightbar as the default desktop notice instance type', () => {
    const instance = createDefaultDesktopNoticeInstance();

    expect(instance.variant).toBe('custom-lightbar');
    expect(instance.customLightbar).toBeTruthy();
    expect(instance.edgeLightbar).toBeNull();
  });

  test('validates edge lightbar requires at least one edge', () => {
    const instance = createDefaultEdgeLightbarInstance();
    instance.edgeLightbar = { ...instance.edgeLightbar!, enabledEdges: [] };

    expect(validateDesktopNoticeInstance(instance)).toEqual({
      valid: false,
      code: 'DESKTOP_NOTICE_INVALID_EDGE_LIGHTBAR'
    });
  });

  test('creates hidden lightbar instance by default', () => {
    const instance = createDefaultDesktopNoticeInstance();

    expect(instance.variant).toBe('custom-lightbar');
    expect(instance.idleBehavior).toBe('hidden');
    expect(instance.enabled).toBe(true);
    expect(instance.showOnStartup).toBe(false);
    expect(instance.customLightbar?.direction).toBe('horizontal');
    expect(instance.customLightbar?.opacityPercent).toBe(100);
    expect(instance.customLightbar?.cornerRadiusPercent).toBe(0);
  });

  test('creates valid mascot instance with dedicated settings', () => {
    const instance = createDefaultMascotInstance();

    expect(instance.variant).toBe('mascot');
    expect(instance.idleBehavior).toBe('hidden');
    expect(instance.customLightbar).toBeNull();
    expect(instance.edgeLightbar).toBeNull();
    expect(instance.mascot).toEqual({
      assetPackId: 'g7-buddy',
      stageSize: { width: 260, height: 260 },
      presetPosition: 'bottom-right',
      boundsOverride: null,
      idleState: 'idle',
      interactionEnabled: false,
      bubbleEnabled: false,
      bubblePlacement: 'top-right',
      bubbleFontSizePx: 14,
      bubbleFontId: 'soft-handwriting'
    });
    expect(validateDesktopNoticeInstance(instance)).toEqual({ valid: true });
  });

  test('rejects mascot instance with unknown asset pack', () => {
    const instance = createDefaultMascotInstance();
    instance.mascot = { ...instance.mascot!, assetPackId: 'missing-pack' };

    expect(validateDesktopNoticeInstance(instance)).toEqual({
      valid: false,
      code: 'DESKTOP_MASCOT_ASSET_PACK_NOT_FOUND'
    });
  });

  test('accepts mascot instance with scanned custom asset pack', () => {
    const instance = createDefaultMascotInstance();
    instance.mascot = { ...instance.mascot!, assetPackId: 'my-mascot' };

    expect(
      validateDesktopNoticeInstance(instance, {
        mascotAssetPackIds: ['my-mascot']
      })
    ).toEqual({ valid: true });
  });

  test('recommends vertical direction for side positions', () => {
    expect(recommendedDesktopNoticeDirection('left-center')).toBe('vertical');
    expect(recommendedDesktopNoticeDirection('right-center')).toBe('vertical');
    expect(recommendedDesktopNoticeDirection('top-center')).toBe('horizontal');
    expect(recommendedDesktopNoticeDirection('bottom-center')).toBe('horizontal');
  });

  test('keeps horizontal direction recommendation for custom position', () => {
    expect(recommendedDesktopNoticeDirection('custom')).toBe('horizontal');
  });

  test('keeps lightbar dimensions aligned with direction', () => {
    expect(desktopNoticeSizeForDirection({ width: 720, height: 32 }, 'vertical')).toEqual({
      width: 32,
      height: 720
    });
    expect(desktopNoticeSizeForDirection({ width: 32, height: 720 }, 'horizontal')).toEqual({
      width: 720,
      height: 32
    });
  });

  test('accepts vertical lightbar size using height as length', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.customLightbar = {
      ...instance.customLightbar!,
      direction: 'vertical',
      size: { width: 10, height: 10 }
    };

    expect(validateDesktopNoticeInstance(instance)).toEqual({ valid: true });
  });

  test('validates corner radius values', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.customLightbar = { ...instance.customLightbar!, cornerRadiusPercent: 55 };

    expect(validateDesktopNoticeInstance(instance)).toEqual({
      valid: false,
      code: 'DESKTOP_NOTICE_INVALID_CORNER_RADIUS'
    });
  });

  test('rejects invalid color using stable error code', () => {
    expect(
      validateDesktopNoticeRuleConfig({
        targetIds: ['notice-main'],
        colorMode: 'solid',
        colors: [{ color: 'red', position: 0 }],
        durationMs: 3000
      })
    ).toEqual({
      valid: false,
      code: 'DESKTOP_NOTICE_INVALID_COLOR'
    });
  });

  test('rejects opacity outside the supported percentage range', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.customLightbar = { ...instance.customLightbar!, opacityPercent: 5 };

    expect(validateDesktopNoticeInstance(instance)).toEqual({
      valid: false,
      code: 'DESKTOP_NOTICE_INVALID_OPACITY'
    });
  });

  test('accepts valid desktop notice rule breathing period', () => {
    expect(
      validateDesktopNoticeRuleConfig({
        targetIds: ['notice-main'],
        colorMode: 'solid',
        colors: [{ color: '#22C55E', position: 0 }],
        durationMs: 3000,
        breathingPeriodMs: 1600
      })
    ).toEqual({ valid: true });
  });

  test('rejects invalid desktop notice rule breathing period', () => {
    expect(
      validateDesktopNoticeRuleConfig({
        targetIds: ['notice-main'],
        colorMode: 'solid',
        colors: [{ color: '#22C55E', position: 0 }],
        durationMs: 3000,
        breathingPeriodMs: 200
      })
    ).toEqual({ valid: false, code: 'DESKTOP_NOTICE_INVALID_STATE_EFFECT' });
  });

  test('normalizes mascot one-shot playback window', () => {
    expect(normalizeDesktopMascotPlaybackWindowMs(null)).toBe(
      DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.defaultValue
    );
    expect(normalizeDesktopMascotPlaybackWindowMs(120)).toBe(
      DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.min
    );
    expect(normalizeDesktopMascotPlaybackWindowMs(9000)).toBe(
      DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.max
    );
    expect(normalizeDesktopMascotPlaybackWindowMs(2600)).toBe(2600);
  });

  test('detects mascot one-shot playback modes', () => {
    expect(isOnceMascotPlayMode('once-then-hold')).toBe(true);
    expect(isOnceMascotPlayMode('once-then-idle')).toBe(true);
    expect(isOnceMascotPlayMode('loop')).toBe(false);
    expect(isOnceMascotPlayMode('default')).toBe(false);
    expect(isOnceMascotPlayMode(null)).toBe(false);
  });
});
