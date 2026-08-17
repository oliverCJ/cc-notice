import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  addHookProjectTarget,
  getHookEventState,
  HookEventFrontendState,
  HookEventSelections,
  saveHookEventSelections
} from '@/api/tauriApi';
import { useHookConfigActions } from './useHookConfigActions';
import { previewHookConfigTarget } from '@/api/tauriApi';
import { writeHookConfigTarget } from '@/api/tauriApi';
import { open } from '@tauri-apps/plugin-dialog';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}));

vi.mock('@/api/tauriApi', () => ({
  addHookProjectTarget: vi.fn(),
  getHookEventState: vi.fn(),
  previewHookConfigTarget: vi.fn(),
  removeHookConfigTarget: vi.fn(),
  restoreHookConfigTarget: vi.fn(),
  saveHookEventSelections: vi.fn(),
  writeHookConfigTarget: vi.fn()
}));

const initialHookState: HookEventFrontendState = {
  catalog: [],
  selected: {
    bySource: {
      codex: ['UserPromptSubmit']
    }
  },
  targets: [
    {
      id: 'codex-global',
      scope: 'global',
      source: 'codex',
      label: 'Codex 全局配置',
      configPath: '/Users/test/.codex/config.toml',
      enabled: false,
      exists: true,
      canCreate: true,
      matchesSelectedEvents: true,
      debugEnabled: false
    }
  ]
};

const refreshedHookState: HookEventFrontendState = {
  ...initialHookState,
  selected: {
    bySource: {
      codex: ['UserPromptSubmit', 'Stop']
    }
  },
  targets: [
    {
      ...initialHookState.targets[0],
      matchesSelectedEvents: false
    }
  ]
};

describe('useHookConfigActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveHookEventSelections).mockResolvedValue({
      bySource: {
        codex: ['UserPromptSubmit', 'Stop']
      }
    });
  });

  test('saves global hook event selections without mutating the active profile', async () => {
    const setHookEventState = vi.fn();
    vi.mocked(getHookEventState).mockResolvedValue(refreshedHookState);
    const nextSelections: HookEventSelections = {
      bySource: {
        codex: ['UserPromptSubmit', 'Stop']
      }
    };

    const { result } = renderHook(() =>
      useHookConfigActions({
        hookEventState: initialHookState,
        selectedToolId: 'codex',
        setHookEventState
      })
    );

    await act(async () => {
      await result.current.handleHookSelectionChange(nextSelections);
    });

    expect(saveHookEventSelections).toHaveBeenCalledWith(nextSelections);
    await waitFor(() => {
      expect(setHookEventState).toHaveBeenLastCalledWith(refreshedHookState);
    });
  });

  test('refreshes claude-code hook target checks after hook event selection changes', async () => {
    const claudeHookState: HookEventFrontendState = {
      catalog: [],
      selected: {
        bySource: {
          'claude-code': ['SessionStart']
        }
      },
      targets: [
        {
          id: 'claude-global',
          scope: 'global',
          source: 'claude-code',
          label: 'Claude Code 全局配置',
          configPath: '/Users/test/.claude/settings.json',
          enabled: false,
          exists: true,
          canCreate: true,
          matchesSelectedEvents: true,
          debugEnabled: false
        }
      ]
    };
    const refreshedClaudeState: HookEventFrontendState = {
      ...claudeHookState,
      selected: {
        bySource: {
          'claude-code': ['SessionStart', 'PermissionRequest']
        }
      },
      targets: [
        {
          ...claudeHookState.targets[0],
          matchesSelectedEvents: false
        }
      ]
    };
    const setHookEventState = vi.fn();
    vi.mocked(saveHookEventSelections).mockResolvedValue({
      bySource: {
        'claude-code': ['SessionStart', 'PermissionRequest']
      }
    });
    vi.mocked(getHookEventState).mockResolvedValue(refreshedClaudeState);
    const nextSelections: HookEventSelections = {
      bySource: {
        'claude-code': ['SessionStart', 'PermissionRequest']
      }
    };

    const { result } = renderHook(() =>
      useHookConfigActions({
        hookEventState: claudeHookState,
        selectedToolId: 'claude-code',
        setHookEventState
      })
    );

    await act(async () => {
      await result.current.handleHookSelectionChange(nextSelections);
    });

    expect(saveHookEventSelections).toHaveBeenCalledWith(nextSelections);
    await waitFor(() => {
      expect(setHookEventState).toHaveBeenLastCalledWith(refreshedClaudeState);
    });
  });

  test('previews project target with debug enabled by default when config does not exist', async () => {
    const setHookEventState = vi.fn();
    const projectHookState: HookEventFrontendState = {
      ...initialHookState,
      targets: [
        {
          id: 'codex-project-new',
          scope: 'project',
          source: 'codex',
          label: 'new-project',
          projectPath: '/workspace/new-project',
          configPath: '/workspace/new-project/.codex/hooks.json',
          enabled: false,
          exists: false,
          canCreate: true,
          matchesSelectedEvents: false,
          debugEnabled: false
        }
      ]
    };
    vi.mocked(previewHookConfigTarget).mockResolvedValue({
      targetId: 'codex-project-new',
      source: 'codex',
      configPath: '/workspace/new-project/.codex/hooks.json',
      configExists: false,
      eventCount: 1,
      originalJson: null,
      previewJson: '{}',
      inlineHooksWarning: null
    });

    const { result } = renderHook(() =>
      useHookConfigActions({
        hookEventState: projectHookState,
        selectedToolId: 'codex',
        setHookEventState
      })
    );

    await act(async () => {
      await result.current.handlePreviewHookConfigTarget('codex-project-new');
    });

    expect(previewHookConfigTarget).toHaveBeenCalledWith('codex-project-new', true);
  });

  test('clears hook target write result after timeout', async () => {
    vi.useFakeTimers();
    const setHookEventState = vi.fn();
    vi.mocked(writeHookConfigTarget).mockResolvedValue({
      targetId: 'codex-global',
      source: 'codex',
      configPath: '/Users/test/.codex/hooks.json',
      backupPath: '/Users/test/.codex/hooks.json.20260609T120000.bak',
      eventCount: 1,
      inlineHooksWarning: null
    });
    vi.mocked(getHookEventState).mockResolvedValue({
      ...initialHookState,
      targets: [{ ...initialHookState.targets[0], enabled: true }]
    });

    const { result } = renderHook(() =>
      useHookConfigActions({
        hookEventState: initialHookState,
        selectedToolId: 'codex',
        setHookEventState
      })
    );

    await act(async () => {
      await result.current.handleWriteHookConfigTarget('codex-global');
    });

    expect(result.current.hookTargetWriteResults['codex-global']).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.hookTargetWriteResults['codex-global']).toBeUndefined();
    vi.useRealTimers();
  });

  test('clears add project target error after timeout', async () => {
    vi.useFakeTimers();
    const setHookEventState = vi.fn();
    vi.mocked(open).mockResolvedValue('/workspace/existing-project');
    vi.mocked(addHookProjectTarget).mockRejectedValue(
      new Error('hook config target already exists for codex')
    );

    const { result } = renderHook(() =>
      useHookConfigActions({
        hookEventState: initialHookState,
        selectedToolId: 'codex',
        setHookEventState
      })
    );

    await act(async () => {
      await result.current.handleAddProjectTarget();
    });

    expect(result.current.hookTargetError).toBe(
      'hook config target already exists for codex'
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.hookTargetError).toBeUndefined();
    vi.useRealTimers();
  });
});
