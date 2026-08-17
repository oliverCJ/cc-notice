import { describe, expect, test } from 'vitest';
import { HookConfigTargetStatus } from '@/api/tauriApi';
import { defaultTargetDebugEnabled } from './hookTargetDebugMode';

const baseTarget: HookConfigTargetStatus = {
  id: 'project-target',
  scope: 'project',
  source: 'codex',
  label: 'Project',
  projectPath: '/workspace/project',
  configPath: '/workspace/project/.codex/hooks.json',
  enabled: false,
  exists: false,
  canCreate: true,
  matchesSelectedEvents: false,
  debugEnabled: false
};

describe('hookTargetDebugMode', () => {
  test('defaults debug on for new or unknown targets', () => {
    expect(defaultTargetDebugEnabled([{ ...baseTarget, exists: false }], baseTarget.id)).toBe(
      true
    );
    expect(defaultTargetDebugEnabled([], 'missing-target')).toBe(true);
  });

  test('uses parsed debug state when config already exists', () => {
    expect(
      defaultTargetDebugEnabled(
        [{ ...baseTarget, exists: true, debugEnabled: false }],
        baseTarget.id
      )
    ).toBe(false);
    expect(
      defaultTargetDebugEnabled(
        [{ ...baseTarget, exists: true, debugEnabled: true }],
        baseTarget.id
      )
    ).toBe(true);
  });

  test('global targets follow the same default and parsed-state rules', () => {
    expect(
      defaultTargetDebugEnabled(
        [{ ...baseTarget, id: 'global-target', scope: 'global', exists: false }],
        'global-target'
      )
    ).toBe(true);
    expect(
      defaultTargetDebugEnabled(
        [
          {
            ...baseTarget,
            id: 'global-target',
            scope: 'global',
            exists: true,
            debugEnabled: false
          }
        ],
        'global-target'
      )
    ).toBe(false);
  });
});
