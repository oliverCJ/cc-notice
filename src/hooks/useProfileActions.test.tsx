import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  activateProfile,
  createProfile,
  deleteProfile,
  duplicateProfile,
  importProfilePackage,
  NoticeProfile,
  ProfileFrontendState,
  saveAppConfig,
  saveProfile
} from '@/api/tauriApi';
import { AppConfigView } from '@/state/appStore';
import { useProfileActions } from './useProfileActions';

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    activateProfile: vi.fn(),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
    duplicateProfile: vi.fn(),
    importProfilePackage: vi.fn(),
    saveAppConfig: vi.fn(),
    saveProfile: vi.fn()
  };
});

const activeProfile: NoticeProfile = {
  id: 'daily-coding',
  name: 'Daily Coding',
  enabledHookEvents: [],
  aiEventMappings: [],
  hardwareRules: [],
  device: {
    boardId: 'rp2040-pico',
    transport: 'serial'
  }
};

const focusProfile: NoticeProfile = {
  ...activeProfile,
  id: 'focus-mode',
  name: 'Focus Mode'
};

const appConfig: AppConfigView = {
  localHookServer: { port: 53919 },
  ui: { language: 'zh-CN', themeMode: 'system' },
  window: {
    closeBehavior: 'hide-to-tray',
    startupMode: 'normal',
    launchAtLogin: false,
    hideWindowOnLoginLaunch: true
  },
  activeProfileId: 'daily-coding',
  hookEventSelections: { bySource: {} },
  hookConfigTargets: [],
  desktopNoticeInstances: []
};

const dailyProfileState: ProfileFrontendState = {
  activeProfileId: 'daily-coding',
  activeProfile,
  profiles: [
    { id: 'daily-coding', name: 'Daily Coding', active: true },
    { id: 'focus-mode', name: 'Focus Mode', active: false }
  ]
};

const focusProfileState: ProfileFrontendState = {
  activeProfileId: 'focus-mode',
  activeProfile: focusProfile,
  profiles: [
    { id: 'daily-coding', name: 'Daily Coding', active: false },
    { id: 'focus-mode', name: 'Focus Mode', active: true }
  ]
};

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('useProfileActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveProfile).mockResolvedValue(focusProfileState);
    vi.mocked(createProfile).mockResolvedValue(focusProfileState);
    vi.mocked(deleteProfile).mockResolvedValue(focusProfileState);
    vi.mocked(duplicateProfile).mockResolvedValue(focusProfileState);
    vi.mocked(activateProfile).mockResolvedValue(focusProfileState);
    vi.mocked(importProfilePackage).mockResolvedValue({
      profileState: focusProfileState,
      hookEventSelections: { bySource: {} },
      desktopNoticeInstances: []
    });
    vi.mocked(saveAppConfig).mockResolvedValue({ config: appConfig, restartRequired: false });
  });

  test('activating a profile relies on activateProfile persistence and does not save app config again', async () => {
    const setAppConfig = vi.fn();
    const setProfileState = vi.fn();
    const { result } = renderHook(() =>
      useProfileActions({
        setAppConfig,
        setProfileState
      })
    );

    await act(async () => {
      await result.current.handleActivateProfile('focus-mode');
    });

    expect(activateProfile).toHaveBeenCalledWith('focus-mode');
    expect(setProfileState).toHaveBeenCalledWith(focusProfileState);
    expect(saveAppConfig).not.toHaveBeenCalled();
    expect(setAppConfig).toHaveBeenCalledTimes(1);

    const updater = setAppConfig.mock.calls[0][0] as (current: AppConfigView) => AppConfigView;
    expect(updater(appConfig)).toEqual({
      ...appConfig,
      activeProfileId: 'focus-mode'
    });
  });

  test('ignores stale save profile result after activating another profile', async () => {
    const pendingSave = deferredPromise<ProfileFrontendState>();
    vi.mocked(saveProfile).mockReturnValueOnce(pendingSave.promise);
    const setAppConfig = vi.fn();
    const setProfileState = vi.fn();
    const { result } = renderHook(() =>
      useProfileActions({
        setAppConfig,
        setProfileState
      })
    );

    act(() => {
      void result.current.handleSaveProfile(activeProfile);
    });

    await act(async () => {
      await result.current.handleActivateProfile('focus-mode');
    });

    await act(async () => {
      pendingSave.resolve(dailyProfileState);
      await pendingSave.promise;
    });

    expect(setProfileState).toHaveBeenLastCalledWith(focusProfileState);
  });

  test('keeps import errors out of the persistent profile error area', async () => {
    vi.mocked(importProfilePackage).mockRejectedValueOnce(new Error('import failed'));
    const setAppConfig = vi.fn();
    const setProfileState = vi.fn();
    const { result } = renderHook(() =>
      useProfileActions({
        setAppConfig,
        setProfileState
      })
    );

    await act(async () => {
      await expect(
        result.current.handleImportProfilePackage('/tmp/profile.json', [], false)
      ).rejects.toThrow('import failed');
    });

    expect(result.current.profileError).toBeUndefined();
  });

  test('updates desktop notice instances after importing a profile package', async () => {
    const importedDesktopNoticeInstances = [
      {
        id: 'desktop-notice-import-a1b2c3',
        name: '导入灯条',
        variant: 'custom-lightbar' as const,
        enabled: true,
        showOnStartup: false,
        alwaysOnTop: true,
        idleBehavior: 'hidden' as const,
        customLightbar: {
          presetPosition: 'top-center' as const,
          direction: 'horizontal' as const,
          size: { width: 720, height: 32 },
          opacityPercent: 100,
          cornerRadiusPercent: 0,
          boundsOverride: null
        },
        edgeLightbar: null
      }
    ];
    vi.mocked(importProfilePackage).mockResolvedValueOnce({
      profileState: focusProfileState,
      hookEventSelections: { bySource: { codex: ['stop'] } },
      desktopNoticeInstances: importedDesktopNoticeInstances
    });
    const setAppConfig = vi.fn();
    const setProfileState = vi.fn();
    const { result } = renderHook(() =>
      useProfileActions({
        setAppConfig,
        setProfileState
      })
    );

    await act(async () => {
      await result.current.handleImportProfilePackage('/tmp/profile.json', [], true);
    });

    const updater = setAppConfig.mock.calls[0][0] as (current: AppConfigView) => AppConfigView;
    expect(updater(appConfig)).toEqual({
      ...appConfig,
      activeProfileId: 'focus-mode',
      hookEventSelections: { bySource: { codex: ['stop'] } },
      desktopNoticeInstances: importedDesktopNoticeInstances
    });
  });
});
