import {
  DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_ID,
  DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID,
  DESKTOP_MASCOT_BUBBLE_LIMITS,
  DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS,
  createDefaultMascotSettings,
  desktopMascotBubbleFontCssFamily,
  desktopMascotBubbleFontOptions,
  desktopMascotActionsForState,
  desktopMascotPackById,
  selectableMascotPacks,
  validateMascotBubbleText,
  warmBuddyMascotPack
} from './desktopMascot';

describe('desktopMascot domain', () => {
  test('creates default settings for the built-in mascot pack', () => {
    expect(createDefaultMascotSettings()).toEqual({
      assetPackId: DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID,
      stageSize: { width: 260, height: 260 },
      presetPosition: 'bottom-right',
      boundsOverride: null,
      idleState: 'idle',
      interactionEnabled: false,
      bubbleEnabled: false,
      bubblePlacement: 'top-right',
      bubbleFontSizePx: 14,
      bubbleFontId: DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_ID
    });
  });

  test('provides stable bubble font options for current presets and future font sources', () => {
    expect(DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS).toEqual({ min: 12, max: 20 });
    expect(desktopMascotBubbleFontOptions.map((option) => option.id)).toEqual([
      'soft-handwriting',
      'round-cute',
      'comic',
      'clean-sans',
      'system-default'
    ]);
    expect(desktopMascotBubbleFontCssFamily('soft-handwriting')).toContain('Klee One');
    expect(desktopMascotBubbleFontCssFamily('round-cute')).toContain('Yuanti SC');
    expect(desktopMascotBubbleFontCssFamily('comic')).toContain('HanziPen SC');
    expect(desktopMascotBubbleFontCssFamily('comic')).toContain('翩翩体-简');
    expect(desktopMascotBubbleFontCssFamily('comic')).toContain('Hannotate SC');
    expect(desktopMascotBubbleFontCssFamily('comic')).toContain('手札体-简');
    expect(desktopMascotBubbleFontCssFamily('comic')).toContain('LXGW WenKai');
    expect(desktopMascotBubbleFontCssFamily('unknown-font')).toBe(
      desktopMascotBubbleFontCssFamily(DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_ID)
    );
  });

  test('filters actions by AI semantic state', () => {
    expect(
      desktopMascotActionsForState(warmBuddyMascotPack, 'working').map((action) => action.id)
    ).toContain('working.loop');
    expect(
      desktopMascotActionsForState(warmBuddyMascotPack, 'success').map((action) => action.id)
    ).toContain('success.jump');
  });

  test('registers the built-in G7 GIF mascot pack', () => {
    const pack = desktopMascotPackById('g7-buddy');

    expect(pack).toMatchObject({
      id: 'g7-buddy',
      renderer: 'gif',
      animations: expect.objectContaining({
        idle: expect.stringContaining('idle.gif'),
        sleep: expect.stringContaining('sleep.gif'),
        working: expect.stringContaining('working.gif'),
        success: expect.stringContaining('success.gif'),
        error: expect.stringContaining('error.gif')
      })
    });
    expect(desktopMascotActionsForState(pack!, 'warning').map((action) => action.id)).toContain(
      'warning.surprised'
    );
    expect(desktopMascotActionsForState(pack!, 'task-received').map((action) => action.id)).toEqual(
      ['task-received.wave', 'task-received.working', 'task-received.cheer', 'task-received.fly']
    );
    expect(desktopMascotActionsForState(pack!, 'working').map((action) => action.id)).toEqual([
      'working.loop',
      'working.cheer',
      'working.call'
    ]);
    expect(desktopMascotActionsForState(pack!, 'idle').map((action) => action.id)).toEqual([
      'idle.sleep',
      'idle.hi',
      'idle.laugh',
      'idle.thanks',
      'idle.love',
      'idle.bye'
    ]);
  });

  test('hides warm buddy from selectable packs while keeping runtime lookup compatible', () => {
    expect(selectableMascotPacks.map((pack) => pack.id)).toEqual(['g7-buddy']);
    expect(desktopMascotPackById('warm-buddy')).toMatchObject({
      id: 'warm-buddy',
      renderer: 'lottie'
    });
  });

  test('validates bubble text line count and width', () => {
    expect(validateMascotBubbleText('任务完成')).toEqual({ valid: true });
    expect(validateMascotBubbleText('第一行\n第二行\n第三行')).toEqual({
      valid: false,
      code: 'DESKTOP_MASCOT_INVALID_BUBBLE_TEXT'
    });
    expect(
      validateMascotBubbleText('字'.repeat(DESKTOP_MASCOT_BUBBLE_LIMITS.maxCharsPerLine + 1))
    ).toEqual({
      valid: false,
      code: 'DESKTOP_MASCOT_INVALID_BUBBLE_TEXT'
    });
  });
});
