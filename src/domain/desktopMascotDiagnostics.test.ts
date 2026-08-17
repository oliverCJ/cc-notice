import { describe, expect, test } from 'vitest';
import { buildCustomMascotDiagnosticGroups } from './desktopMascotDiagnostics';
import type { CustomMascotDiagnostic, DesktopMascotRuntimePack } from './desktopMascot';

const pack = (id: string): DesktopMascotRuntimePack => ({
  id,
  name: `资源包 ${id}`,
  version: '1.0.0',
  renderer: 'gif',
  animations: { idle: `/tmp/${id}/idle.gif` },
  states: ['idle', 'task-received', 'working', 'success', 'error'],
  actions: [
    { id: 'idle.sleep', state: 'idle', animation: 'idle', loop: true, interruptible: true }
  ],
  interactions: { hoverActionId: 'idle.sleep', clickActionId: 'idle.sleep' },
  source: 'local'
});

const diagnostic = (
  code: string,
  path: string,
  packId: string | null = null
): CustomMascotDiagnostic => ({
  code,
  path,
  packId,
  message: `raw ${code}`
});

describe('desktop mascot diagnostic view model', () => {
  test('groups loaded packs and diagnostics by local pack', () => {
    const result = buildCustomMascotDiagnosticGroups(
      [pack('good-pack')],
      [
        diagnostic('MISSING_ANIMATION_FILE', '/Users/test/.cc-notice/mascots/bad-pack', 'bad-pack'),
        diagnostic('UNKNOWN_ACTION_ANIMATION', '/Users/test/.cc-notice/mascots/bad-pack', 'bad-pack')
      ],
      (key) => key
    );

    expect(result.loadedPacks).toEqual([
      expect.objectContaining({
        id: 'good-pack',
        actionCount: 1,
        animationCount: 1
      })
    ]);
    expect(result.issueGroups).toHaveLength(1);
    expect(result.issueGroups[0]).toEqual(
      expect.objectContaining({
        key: 'bad-pack',
        title: 'bad-pack',
        issueCount: 2
      })
    );
  });

  test('maps known diagnostic code to title and fix hint', () => {
    const result = buildCustomMascotDiagnosticGroups(
      [],
      [diagnostic('ANIMATION_FILE_TOO_LARGE', '/packs/large-pack', 'large-pack')],
      (key) => key
    );

    expect(result.issueGroups[0].issues[0]).toEqual(
      expect.objectContaining({
        code: 'ANIMATION_FILE_TOO_LARGE',
        titleKey: 'desktopNotice.mascot.diagnostics.codes.ANIMATION_FILE_TOO_LARGE.title',
        suggestionKey:
          'desktopNotice.mascot.diagnostics.codes.ANIMATION_FILE_TOO_LARGE.suggestion'
      })
    );
  });

  test('keeps unknown diagnostic code visible', () => {
    const result = buildCustomMascotDiagnosticGroups(
      [],
      [diagnostic('NEW_BACKEND_CODE', '/packs/new-pack', 'new-pack')],
      (key) => key
    );

    expect(result.issueGroups[0].issues[0]).toEqual(
      expect.objectContaining({
        code: 'NEW_BACKEND_CODE',
        titleKey: 'desktopNotice.mascot.diagnostics.codes.UNKNOWN.title',
        suggestionKey: 'desktopNotice.mascot.diagnostics.codes.UNKNOWN.suggestion'
      })
    );
  });
});
