import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  createCustomInternalEvent,
  CreateCustomInternalEventRequest,
  deleteDesktopNoticeInstance,
  deleteCustomInternalEvent,
  DiagnosticActionKind,
  getAppConfig,
  getDesktopNoticeWindowPayload,
  hideDesktopNoticeInstance,
  previewDesktopNoticeInstance,
  resetConfiguration,
  ResetConfigurationScope,
  rotateHookAuthToken,
  saveAppConfig,
  saveDesktopNoticeWindowBounds,
  saveDesktopNoticeInstance,
  updateCustomInternalEvent,
  UpdateCustomInternalEventRequest
} from './api/tauriApi';
import type { DesktopNoticeInstance, DesktopNoticeWindowPayload } from '@/domain/desktopNotice';
import { createTranslator, I18nProvider } from './i18n';
import { DebugPage } from './pages/debug/DebugPage';
import { DesktopNoticeWindow } from './pages/desktop-notice/DesktopNoticeWindow';
import { DeviceTransportMonitorWindow } from './pages/device-monitor/DeviceTransportMonitorWindow';
import { DiagnosticsPage } from './pages/diagnostics/DiagnosticsPage';
import { DevicesPage } from './pages/devices/DevicesPage';
import { FirmwarePage } from './pages/firmware/FirmwarePage';
import { HookSettingsPage } from './pages/hook-settings/HookSettingsPage';
import { RulesPage } from './pages/rules/RulesPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { SetupWizardPage } from './pages/setup-wizard/SetupWizardPage';
import { SetupStepId } from './pages/setup-wizard/setupFlow';
import {
  AiToolId,
  AppConfigView,
  Language,
  WindowCloseBehavior,
  WindowStartupMode,
  aiTools,
  syncAiToolsFromBackend,
  PageId
} from './state/appStore';
import { AppShell } from '@/components/app/AppShell';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useDebugState } from '@/hooks/useDebugState';
import { useDiagnosticsState } from '@/hooks/useDiagnosticsState';
import { useDeviceRuntimeAutomation } from '@/hooks/useDeviceRuntimeAutomation';
import { useDeviceRuntimeRegistry } from '@/hooks/useDeviceRuntimeRegistry';
import { useHookConfigActions } from '@/hooks/useHookConfigActions';
import { useProfileActions } from '@/hooks/useProfileActions';
import { useRuntimeMonitorState } from '@/hooks/useRuntimeMonitorState';
import { useThemeMode } from '@/hooks/useThemeMode';
import { ProfileRepairAlert } from '@/components/app/ProfileRepairAlert';

const DEBUG_REFRESH_INTERVAL_MS = 2_000;
const DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT =
  'cc-notice://desktop-notice-window-bounds-changed';
const DESKTOP_NOTICE_RUNTIME_BOUNDS_SAVE_DELAY_MS = 500;
const MonitorPage = lazy(() =>
  import('./pages/monitor/MonitorPage').then((module) => ({ default: module.MonitorPage }))
);

type DesktopNoticeWindowBoundsChangedPayload = {
  instanceId: string;
  width?: number;
  height?: number;
  userInitiated?: boolean;
};

declare global {
  interface Window {
    __CC_NOTICE_DESKTOP_NOTICE_PAYLOAD__?: DesktopNoticeWindowPayload;
  }
}

export default function App() {
  const desktopNoticeInstanceId = getDesktopNoticeWindowInstanceId();
  if (desktopNoticeInstanceId) {
    return <DesktopNoticeWindowApp instanceId={desktopNoticeInstanceId} />;
  }

  const monitorDeviceId = getDeviceMonitorWindowDeviceId();
  if (monitorDeviceId) {
    return <DeviceMonitorWindowApp deviceId={monitorDeviceId} />;
  }

  const [activePage, setActivePage] = useState<PageId>('setup');
  const [selectedToolId, setSelectedToolId] = useState<AiToolId>('codex');
  const [setupActiveStepId, setSetupActiveStepId] = useState<SetupStepId>('hook-service');
  const [devicesPageVisited, setDevicesPageVisited] = useState(false);
  const [customInternalEventError, setCustomInternalEventError] = useState<string>();
  const [debugTestDialogRequestId, setDebugTestDialogRequestId] = useState(0);
  const {
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
  } = useAppBootstrap();
  const deviceRegistry = useDeviceRuntimeRegistry();
  useEffect(() => {
    if (hookEventState?.tools) {
      syncAiToolsFromBackend(hookEventState.tools);
    }
  }, [hookEventState?.tools]);
  useDeviceRuntimeAutomation(deviceRegistry);
  const appConfigRef = useRef(appConfig);
  const activePageRef = useRef(activePage);
  const appConfigSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const desktopNoticeBoundsSaveTimersRef = useRef<Map<string, number>>(new Map());
  const {
    debugEntries,
    handleClearDebugLog,
    handleSendTestEvent,
    refreshDebugState,
    softwareNoticeState
  } = useDebugState();
  const runtimeMonitor = useRuntimeMonitorState(activePage === 'monitor');
  const diagnosticsState = useDiagnosticsState(
    activePage === 'diagnostics' ||
      (activePage === 'setup' && setupActiveStepId === 'diagnostics-check')
  );
  const {
    handleActivateProfile,
    handleCreateProfile,
    handleDeleteProfile,
    handleDuplicateProfile,
    handleExportProfilePackage,
    handleImportProfilePackage,
    handlePreviewProfilePackageImport,
    handleSaveProfile,
    profileError
  } = useProfileActions({ setAppConfig, setHookEventState, setProfileState });
  const {
    clearHookConfigArtifacts,
    handleAddProjectTarget,
    handleHookSelectionChange,
    handleConfirmRestoreHookConfigTarget,
    handlePreviewHookConfigTarget,
    handlePreviewRestoreHookConfigTarget,
    handleRemoveHookConfigTarget,
    handleTargetDebugModeChange,
    handleWriteHookConfigTarget,
    hookConfigError,
    hookConfigPreviewDialog,
    hookConfigPreviewMode,
    hookTargetBusy,
    hookTargetDebugModes,
    hookTargetError,
    hookTargetErrors,
    hookTargetWriteResults,
    setHookConfigPreviewDialog
  } = useHookConfigActions({
    hookEventState,
    selectedToolId,
    setHookEventState
  });
  const t = useMemo(() => createTranslator(appConfig.ui.language), [appConfig.ui.language]);
  useThemeMode(appConfig.ui.themeMode);
  const selectedTool = useMemo(
    () => aiTools.find((tool) => tool.id === selectedToolId) ?? aiTools[0],
    [selectedToolId]
  );
  useEffect(() => {
    void refreshAppSettings();
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<string>('cc-notice://navigate', (event) => {
      if (event.payload === 'settings') {
        setActivePage('settings');
      }
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => {
        console.warn('failed to initialize tray navigation listener', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    appConfigRef.current = appConfig;
  }, [appConfig]);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen<DesktopNoticeWindowBoundsChangedPayload>(
      DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT,
      (event) => {
        const instanceId = event.payload.instanceId;
        const hasResize =
          typeof event.payload.width === 'number' && typeof event.payload.height === 'number';
        const shouldSaveBounds = Boolean(event.payload.userInitiated || hasResize);
        if (
          disposed ||
          !shouldSaveBounds ||
          !instanceId ||
          activePageRef.current === 'settings'
        ) {
          return;
        }
        const existingTimer = desktopNoticeBoundsSaveTimersRef.current.get(instanceId);
        if (existingTimer) {
          window.clearTimeout(existingTimer);
        }
        const timer = window.setTimeout(() => {
          desktopNoticeBoundsSaveTimersRef.current.delete(instanceId);
          void handleSaveDesktopNoticeWindowBounds(instanceId).catch((error) => {
            console.warn('failed to save desktop notice runtime window bounds', error);
          });
        }, DESKTOP_NOTICE_RUNTIME_BOUNDS_SAVE_DELAY_MS);
        desktopNoticeBoundsSaveTimersRef.current.set(instanceId, timer);
      }
    )
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => {
        console.warn('failed to initialize desktop notice runtime bounds listener', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
      desktopNoticeBoundsSaveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      desktopNoticeBoundsSaveTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (activePage === 'debug' || activePage === 'monitor') {
      void refreshDebugState();
      const refreshTimer = window.setInterval(() => {
        void refreshDebugState();
      }, DEBUG_REFRESH_INTERVAL_MS);

      return () => window.clearInterval(refreshTimer);
    }
  }, [activePage]);

  useEffect(() => {
    if (activePage === 'devices') {
      setDevicesPageVisited(true);
    }
  }, [activePage]);

  function handleSelectTool(toolId: AiToolId) {
    setSelectedToolId(toolId);
    clearHookConfigArtifacts();
  }

  function saveAppConfigQueued(buildNextConfig: (currentConfig: AppConfigView) => AppConfigView) {
    const saveTask = appConfigSaveQueueRef.current.then(async () => {
      const nextConfig = buildNextConfig(appConfigRef.current);
      const saveResult = await saveAppConfig(nextConfig);
      appConfigRef.current = saveResult.config;
      setAppConfig(saveResult.config);
      return saveResult.config;
    });

    appConfigSaveQueueRef.current = saveTask.then(
      () => undefined,
      () => undefined
    );

    return saveTask;
  }

  async function handleSavePort(port: number) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      localHookServer: { port }
    }));
  }

  async function handleSaveLanguage(language: Language) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      ui: { ...currentConfig.ui, language }
    }));
  }

  async function handleSaveThemeMode(themeMode: AppConfigView['ui']['themeMode']) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      ui: { ...currentConfig.ui, themeMode }
    }));
  }

  async function handleSaveWindowCloseBehavior(closeBehavior: WindowCloseBehavior) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      window: { ...currentConfig.window, closeBehavior }
    }));
  }

  async function handleSaveWindowStartupMode(startupMode: WindowStartupMode) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      window: { ...currentConfig.window, startupMode }
    }));
  }

  async function handleSaveWindowLaunchAtLogin(launchAtLogin: boolean) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      window: { ...currentConfig.window, launchAtLogin }
    }));
  }

  async function handleSaveWindowHideOnLoginLaunch(hideWindowOnLoginLaunch: boolean) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      window: { ...currentConfig.window, hideWindowOnLoginLaunch }
    }));
  }

  async function handleSaveArduinoCliPath(arduinoCliPath: string | null) {
    await saveAppConfigQueued((currentConfig) => ({
      ...currentConfig,
      arduinoCliPath
    }));
  }

  async function handleRotateHookToken() {
    await rotateHookAuthToken();
  }

  async function handleSaveDesktopNoticeInstance(instance: DesktopNoticeInstance) {
    const instances = await saveDesktopNoticeInstance(instance);
    setAppConfig((currentConfig) => ({
      ...currentConfig,
      desktopNoticeInstances: instances
    }));
    appConfigRef.current = {
      ...appConfigRef.current,
      desktopNoticeInstances: instances
    };
  }

  async function handleDeleteDesktopNoticeInstance(instanceId: string) {
    const instances = await deleteDesktopNoticeInstance(instanceId);
    setAppConfig((currentConfig) => ({
      ...currentConfig,
      desktopNoticeInstances: instances
    }));
    appConfigRef.current = {
      ...appConfigRef.current,
      desktopNoticeInstances: instances
    };
  }

  async function handlePreviewDesktopNoticeInstance(instanceId: string) {
    await previewDesktopNoticeInstance(instanceId);
  }

  async function handleHideDesktopNoticeInstance(instanceId: string) {
    await hideDesktopNoticeInstance(instanceId);
  }

  async function handleSaveDesktopNoticeWindowBounds(instanceId: string) {
    const instances = await saveDesktopNoticeWindowBounds(instanceId);
    setAppConfig((currentConfig) => ({
      ...currentConfig,
      desktopNoticeInstances: instances
    }));
    appConfigRef.current = {
      ...appConfigRef.current,
      desktopNoticeInstances: instances
    };
  }

  async function handleResetConfiguration(scope: ResetConfigurationScope) {
    const result = await resetConfiguration(scope);
    setAppConfig(result.config);
    setProfileState(result.profileState);
    setHookEventState(result.hookEventState);
  }

  async function handleCreateCustomInternalEvent(request: CreateCustomInternalEventRequest) {
    setCustomInternalEventError(undefined);
    try {
      const nextInternalEvents = await createCustomInternalEvent(request);
      setInternalEvents(nextInternalEvents);
    } catch (error) {
      setCustomInternalEventError(toErrorMessage(error));
      throw error;
    }
  }

  async function handleUpdateCustomInternalEvent(request: UpdateCustomInternalEventRequest) {
    setCustomInternalEventError(undefined);
    try {
      const nextInternalEvents = await updateCustomInternalEvent(request);
      setInternalEvents(nextInternalEvents);
    } catch (error) {
      setCustomInternalEventError(toErrorMessage(error));
      throw error;
    }
  }

  async function handleDeleteCustomInternalEvent(eventId: string) {
    setCustomInternalEventError(undefined);
    try {
      const nextInternalEvents = await deleteCustomInternalEvent(eventId);
      setInternalEvents(nextInternalEvents);
    } catch (error) {
      setCustomInternalEventError(toErrorMessage(error));
      throw error;
    }
  }

  function handleClearCustomInternalEventError() {
    setCustomInternalEventError(undefined);
  }

  function handleDiagnosticAction(action: DiagnosticActionKind) {
    if (action === 'refresh-diagnostics') {
      void diagnosticsState.refresh();
      return;
    }

    if (action === 'open-hook-settings') {
      setActivePage('hook-settings');
      return;
    }

    if (action === 'open-ai-event-mapping') {
      setActivePage('rules');
      return;
    }

    if (action === 'open-devices') {
      setActivePage('devices');
      return;
    }

    if (action === 'open-firmware') {
      setActivePage('firmware');
      return;
    }

    if (action === 'open-debug') {
      setActivePage('debug');
      return;
    }

    if (action === 'send-test-event') {
      setDebugTestDialogRequestId((current) => current + 1);
      setActivePage('debug');
      return;
    }

    if (action === 'auto-connect-registered-devices') {
      void deviceRegistry.autoConnectRegisteredDevices().then(() => diagnosticsState.refresh());
    }
  }

  const page = {
    setup: (
      <SetupWizardPage
        activeStepId={setupActiveStepId}
        hookServerStatus={hookServerStatus}
        profile={profileState?.activeProfile ?? null}
        diagnosticsSnapshot={diagnosticsState.snapshot}
        diagnosticsLoading={diagnosticsState.loading}
        diagnosticsError={diagnosticsState.error}
        selectedToolId={selectedToolId}
        onActiveStepChange={setSetupActiveStepId}
        onOpenDebug={() => setActivePage('debug')}
        onOpenDevices={() => setActivePage('devices')}
        onOpenDiagnosticsCenter={() => setActivePage('diagnostics')}
        onOpenFirmware={() => setActivePage('firmware')}
        onOpenHookSettings={() => setActivePage('hook-settings')}
        onOpenRulesPage={() => setActivePage('rules')}
        onRefreshDiagnostics={diagnosticsState.refresh}
        onSelectTool={handleSelectTool}
      />
    ),
    monitor: (
      <Suspense
        fallback={<div className="text-sm text-muted-foreground">{t('common.loadingRuntimeMonitor')}</div>}
      >
        <MonitorPage
          runtimeSnapshot={runtimeMonitor.snapshot}
          runtimeLoading={runtimeMonitor.loading}
          runtimeError={runtimeMonitor.error}
          onRefreshRuntime={runtimeMonitor.refresh}
          recentEntries={debugEntries.slice(0, 20)}
          hookServerStatus={hookServerStatus}
        />
      </Suspense>
    ),
    devices: null,
    rules: (
      <RulesPage
        activeProfileId={profileState?.activeProfileId ?? appConfig.activeProfileId}
        error={profileError}
        hookCatalog={hookEventState?.catalog ?? []}
        hookEventSelections={hookEventState?.selected ?? appConfig.hookEventSelections}
        internalEvents={internalEvents}
        desktopNoticeInstances={appConfig.desktopNoticeInstances}
        profile={profileState?.activeProfile ?? null}
        profileError={profileError}
        profiles={profileState?.profiles ?? []}
        customInternalEventError={customInternalEventError}
        onActivateProfile={handleActivateProfile}
        onClearCustomInternalEventError={handleClearCustomInternalEventError}
        onCreateProfile={handleCreateProfile}
        onCreateCustomInternalEvent={handleCreateCustomInternalEvent}
        onDeleteProfile={handleDeleteProfile}
        onDeleteCustomInternalEvent={handleDeleteCustomInternalEvent}
        onDuplicateProfile={handleDuplicateProfile}
        onExportProfilePackage={handleExportProfilePackage}
        onImportProfilePackage={handleImportProfilePackage}
        onOpenHookSettings={() => setActivePage('hook-settings')}
        onPreviewProfilePackageImport={handlePreviewProfilePackageImport}
        onSaveProfile={handleSaveProfile}
        onUpdateCustomInternalEvent={handleUpdateCustomInternalEvent}
      />
    ),
    'hook-settings': (
      <HookSettingsPage
        hookConfigError={hookConfigError}
        hookConfigPreviewDialog={hookConfigPreviewDialog}
        hookConfigPreviewMode={hookConfigPreviewMode}
        hookEventState={hookEventState}
        hookTargetBusy={hookTargetBusy}
        hookTargetDebugModes={hookTargetDebugModes}
        hookTargetError={hookTargetError}
        hookTargetErrors={hookTargetErrors}
        hookTargetWriteResults={hookTargetWriteResults}
        selectedToolId={selectedToolId}
        onAddProjectTarget={handleAddProjectTarget}
        onCloseHookConfigPreview={() => setHookConfigPreviewDialog(null)}
        onConfirmRestoreHookConfigTarget={handleConfirmRestoreHookConfigTarget}
        onHookSelectionChange={handleHookSelectionChange}
        onPreviewHookConfigTarget={handlePreviewHookConfigTarget}
        onPreviewRestoreHookConfigTarget={handlePreviewRestoreHookConfigTarget}
        onRemoveHookConfigTarget={handleRemoveHookConfigTarget}
        onSelectTool={handleSelectTool}
        onTargetDebugModeChange={handleTargetDebugModeChange}
        onWriteHookConfigTarget={handleWriteHookConfigTarget}
      />
    ),
    firmware: <FirmwarePage />,
    diagnostics: (
      <DiagnosticsPage
        snapshot={diagnosticsState.snapshot}
        loading={diagnosticsState.loading}
        error={diagnosticsState.error}
        onRefresh={diagnosticsState.refresh}
        onAction={handleDiagnosticAction}
      />
    ),
    settings: (
      <SettingsPage
        config={appConfig}
        onSaveLanguage={handleSaveLanguage}
        onSaveThemeMode={handleSaveThemeMode}
        onSaveArduinoCliPath={handleSaveArduinoCliPath}
        onSavePort={handleSavePort}
        onSaveWindowCloseBehavior={handleSaveWindowCloseBehavior}
        onSaveWindowStartupMode={handleSaveWindowStartupMode}
        onSaveWindowLaunchAtLogin={handleSaveWindowLaunchAtLogin}
        onSaveWindowHideOnLoginLaunch={handleSaveWindowHideOnLoginLaunch}
        onResetConfiguration={handleResetConfiguration}
        onRotateHookToken={handleRotateHookToken}
        onSaveDesktopNoticeInstance={handleSaveDesktopNoticeInstance}
        onDeleteDesktopNoticeInstance={handleDeleteDesktopNoticeInstance}
        onPreviewDesktopNoticeInstance={handlePreviewDesktopNoticeInstance}
        onHideDesktopNoticeInstance={handleHideDesktopNoticeInstance}
        onSaveDesktopNoticeWindowBounds={handleSaveDesktopNoticeWindowBounds}
      />
    ),
    debug: (
      <DebugPage
        entries={debugEntries}
        hookCatalog={hookEventState?.catalog ?? []}
        hookServerStatus={hookServerStatus}
        selectedToolId={selectedToolId}
        testDialogRequestId={debugTestDialogRequestId}
        onClear={handleClearDebugLog}
        onRefresh={refreshDebugState}
        onSendTestEvent={handleSendTestEvent}
      />
    )
  }[activePage];

  return (
    <I18nProvider language={appConfig.ui.language}>
      <AppShell activePage={activePage} onPageChange={setActivePage}>
        <ProfileRepairAlert
          profileName={profileState?.activeProfile.name ?? profileState?.activeProfileId ?? ''}
          repair={profileState?.profileRepair}
        />
        {(devicesPageVisited || activePage === 'devices') ? (
          <div hidden={activePage !== 'devices'}>
            <DevicesPage
              registry={deviceRegistry}
              onOpenRulesPage={() => setActivePage('rules')}
              onOpenDiagnosticsCenter={() => setActivePage('diagnostics')}
            />
          </div>
        ) : null}
        {page}
      </AppShell>
    </I18nProvider>
  );
}

function DesktopNoticeWindowApp({ instanceId }: { instanceId: string }) {
  const [language, setLanguage] = useState<Language>('zh-CN');
  const [themeMode, setThemeMode] = useState<AppConfigView['ui']['themeMode']>('system');
  const [payload, setPayload] = useState<DesktopNoticeWindowPayload | null>(
    () => window.__CC_NOTICE_DESKTOP_NOTICE_PAYLOAD__ ?? null
  );
  useThemeMode(themeMode);

  useEffect(() => {
    const root = document.getElementById('root');
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    const previousRootBackground = root?.style.background ?? '';
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    if (root) {
      root.style.background = 'transparent';
    }
    return () => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
      if (root) {
        root.style.background = previousRootBackground;
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const bootstrapPayload = window.__CC_NOTICE_DESKTOP_NOTICE_PAYLOAD__;
    if (bootstrapPayload) {
      console.info('desktop notice window bootstrap payload loaded', {
        instanceId,
        variant: bootstrapPayload.variant,
        width: bootstrapPayload.size.width,
        height: bootstrapPayload.size.height,
        previewMode: bootstrapPayload.previewMode
      });
      setPayload(bootstrapPayload);
      return () => {
        disposed = true;
      };
    }
    const timer = window.setTimeout(() => {
      console.info('loading desktop notice window payload fallback', { instanceId });
      void Promise.all([getAppConfig(), getDesktopNoticeWindowPayload(instanceId)])
        .then(([config, nextPayload]) => {
          if (!disposed) {
            console.info('desktop notice window payload loaded', {
              instanceId,
              variant: nextPayload.variant,
              width: nextPayload.size.width,
              height: nextPayload.size.height,
              previewMode: nextPayload.previewMode
            });
            setLanguage(config.ui.language as Language);
            setThemeMode(config.ui.themeMode ?? 'system');
            setPayload(nextPayload);
          }
        })
        .catch((error) => {
          console.warn('failed to load desktop notice window payload', error);
        });
    }, 800);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [instanceId]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<DesktopNoticeWindowPayload>(
      'cc-notice://desktop-notice-preview-updated',
      (event) => {
        if (!disposed && event.payload.instanceId === instanceId) {
          setPayload(event.payload);
        }
      }
    )
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => {
        console.warn('failed to initialize desktop notice preview listener', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [instanceId]);

  return (
    <I18nProvider language={language}>
      {payload ? (
        <DesktopNoticeWindow payload={payload} />
      ) : (
        <main className="flex h-screen w-screen items-center justify-center bg-transparent text-xs text-muted-foreground">
          加载中...
        </main>
      )}
    </I18nProvider>
  );
}

function DeviceMonitorWindowApp({ deviceId }: { deviceId: string }) {
  const [language, setLanguage] = useState<Language>('zh-CN');
  const [themeMode, setThemeMode] = useState<AppConfigView['ui']['themeMode']>('system');
  useThemeMode(themeMode);

  useEffect(() => {
    let disposed = false;
    void getAppConfig()
      .then((config) => {
        if (!disposed) {
          setLanguage(config.ui.language as Language);
          setThemeMode(config.ui.themeMode ?? 'system');
        }
      })
      .catch((error) => {
        console.warn('failed to load app config for device monitor window', error);
      });
    return () => {
      disposed = true;
    };
  }, []);

  return (
    <I18nProvider language={language}>
      <DeviceTransportMonitorWindow deviceId={deviceId} />
    </I18nProvider>
  );
}

function getDeviceMonitorWindowDeviceId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('deviceId');
}

function getDesktopNoticeWindowInstanceId() {
  const params = new URLSearchParams(window.location.search);
  const rootRouteInstanceId = params.get('desktopNoticeInstanceId');
  if (rootRouteInstanceId) {
    return rootRouteInstanceId;
  }
  if (window.location.pathname !== '/desktop-notice') {
    return null;
  }
  return params.get('instanceId');
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
