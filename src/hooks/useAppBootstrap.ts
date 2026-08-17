import { useState } from 'react';
import {
  getAppConfig,
  getHookEventState,
  getInternalEventCatalog,
  getLocalHookServerStatus,
  getProfileState,
  HookEventFrontendState,
  InternalEventDefinition,
  ProfileFrontendState
} from '@/api/tauriApi';
import { AppConfigView, LocalHookServerStatusView } from '@/state/appStore';

const defaultAppConfig: AppConfigView = {
  localHookServer: { port: 17321 },
  ui: { language: 'zh-CN', themeMode: 'system' },
  window: {
    closeBehavior: 'hide-to-tray',
    startupMode: 'normal',
    launchAtLogin: false,
    hideWindowOnLoginLaunch: true
  },
  arduinoCliPath: null,
  activeProfileId: 'daily-coding',
  hookEventSelections: {
    bySource: {}
  },
  hookConfigTargets: [],
  desktopNoticeInstances: []
};

const defaultHookServerStatus: LocalHookServerStatusView = {
  running: false,
  port: 17321,
  bindAddress: '127.0.0.1:17321',
  eventUrl: 'http://127.0.0.1:17321/api/v1/events',
  healthUrl: 'http://127.0.0.1:17321/health'
};

export function useAppBootstrap() {
  const [appConfig, setAppConfig] = useState<AppConfigView>(defaultAppConfig);
  const [profileState, setProfileState] = useState<ProfileFrontendState | null>(null);
  const [internalEvents, setInternalEvents] = useState<InternalEventDefinition[]>([]);
  const [hookEventState, setHookEventState] = useState<HookEventFrontendState | null>(null);
  const [hookServerStatus, setHookServerStatus] =
    useState<LocalHookServerStatusView>(defaultHookServerStatus);

  async function refreshAppSettings() {
    try {
      const [config, status, hookState, nextProfileState, nextInternalEvents] =
        await Promise.all([
          getAppConfig(),
          getLocalHookServerStatus(),
          getHookEventState(),
          getProfileState(),
          getInternalEventCatalog()
        ]);
      setAppConfig(config);
      setHookEventState(hookState);
      setProfileState(nextProfileState);
      setInternalEvents(nextInternalEvents);
      setHookServerStatus({
        running: status.running,
        port: status.port,
        bindAddress: status.bindAddress,
        eventUrl: status.eventUrl,
        healthUrl: status.healthUrl,
        error: status.error ?? undefined
      });
    } catch (error) {
      setHookServerStatus({
        ...defaultHookServerStatus,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    appConfig,
    hookEventState,
    hookServerStatus,
    internalEvents,
    profileState,
    refreshAppSettings,
    setAppConfig,
    setHookEventState,
    setInternalEvents,
    setProfileState
  };
}
