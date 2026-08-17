import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { SettingsPage } from './SettingsPage';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn())
}));

const config = {
  localHookServer: { port: 17321 },
  ui: { language: 'zh-CN' as const, themeMode: 'system' as const },
  window: {
    closeBehavior: 'hide-to-tray' as const,
    startupMode: 'normal' as const,
    launchAtLogin: false,
    hideWindowOnLoginLaunch: true
  },
  activeProfileId: 'daily-coding',
  hookEventSelections: {
    bySource: {}
  },
  hookConfigTargets: [],
  desktopNoticeInstances: []
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

describe('SettingsPage', () => {
  test('shows independent reset actions and confirms destructive reset', async () => {
    const onResetConfiguration = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={onResetConfiguration}
        />
      </I18nProvider>
    );

    expect(screen.getByRole('button', { name: '重置应用设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置 Hook 设置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置映射配置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置设备配置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置所有配置' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重置所有配置' }));

    const dialog = await screen.findByRole('alertdialog', { name: '重置所有配置' });
    expect(within(dialog).getByText(/不会删除日志、Hook Token、relay 工具/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认重置' }));

    await waitFor(() => expect(onResetConfiguration).toHaveBeenCalledWith('all'));
  });

  test('saves close-to-tray behavior from window settings switch', async () => {
    const onSaveWindowCloseBehavior = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={onSaveWindowCloseBehavior}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('关闭窗口时隐藏到系统托盘')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: '关闭窗口时隐藏到系统托盘' }));

    await waitFor(() =>
      expect(onSaveWindowCloseBehavior).toHaveBeenCalledWith('exit')
    );
  });

  test('disables close behavior switch while saving to avoid duplicate requests', async () => {
    const saveDeferred = deferredPromise<void>();
    const onSaveWindowCloseBehavior = vi.fn().mockReturnValue(saveDeferred.promise);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={onSaveWindowCloseBehavior}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    const closeBehaviorSwitch = screen.getByRole('switch', {
      name: '关闭窗口时隐藏到系统托盘'
    });

    fireEvent.click(closeBehaviorSwitch);

    expect(closeBehaviorSwitch).toBeDisabled();

    saveDeferred.resolve();

    await waitFor(() => expect(closeBehaviorSwitch).not.toBeDisabled());
  });

  test('saves lightweight startup mode from window settings switch', async () => {
    const onSaveWindowStartupMode = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={onSaveWindowStartupMode}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByText('以轻量模式启动')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: '以轻量模式启动' }));

    await waitFor(() =>
      expect(onSaveWindowStartupMode).toHaveBeenCalledWith('lightweight')
    );
  });

  test('disables lightweight startup switch while saving and rolls back on failure', async () => {
    const saveDeferred = deferredPromise<void>();
    const onSaveWindowStartupMode = vi.fn().mockReturnValue(saveDeferred.promise);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={onSaveWindowStartupMode}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    const startupModeSwitch = screen.getByRole('switch', {
      name: '以轻量模式启动'
    });

    fireEvent.click(startupModeSwitch);

    expect(startupModeSwitch).toBeDisabled();
    saveDeferred.reject(new Error('save failed'));

    await waitFor(() => expect(startupModeSwitch).not.toBeDisabled());
    expect(startupModeSwitch).not.toBeChecked();
  });

  test('saves launch-at-login switch from window settings', async () => {
    const onSaveWindowLaunchAtLogin = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={onSaveWindowLaunchAtLogin}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('switch', { name: '随系统启动 CC Notice' }));

    await waitFor(() => expect(onSaveWindowLaunchAtLogin).toHaveBeenCalledWith(true));
  });

  test('disables hide-window-on-login switch until launch-at-login is enabled', () => {
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByRole('switch', { name: '开机后隐藏主窗口' })).toBeDisabled();
  });

  test('rejects empty arduino cli path before saving', () => {
    const onSaveArduinoCliPath = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={{ ...config, arduinoCliPath: '/usr/local/bin/arduino-cli' }}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={onSaveArduinoCliPath}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText('arduino-cli 路径'), {
      target: { value: '   ' }
    });
    const saveButton = screen.getByRole('button', { name: '保存路径' });

    fireEvent.click(saveButton);

    expect(onSaveArduinoCliPath).not.toHaveBeenCalled();
    expect(saveButton).not.toBeDisabled();
    expect(screen.getByText('请填写 arduino-cli 的完整路径后再保存。')).toBeInTheDocument();
  });

  test('saves selected appearance mode', async () => {
    const onSaveThemeMode = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={onSaveThemeMode}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('combobox', { name: '外观模式' }));
    fireEvent.click(await screen.findByRole('option', { name: '深色' }));
    fireEvent.click(screen.getByRole('button', { name: '保存外观' }));

    await waitFor(() => expect(onSaveThemeMode).toHaveBeenCalledWith('dark'));
  });

  test('creates desktop notice instance from settings library', async () => {
    const onSaveDesktopNoticeInstance = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={config}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
          onSaveDesktopNoticeInstance={onSaveDesktopNoticeInstance}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '新建桌面提示' }));

    await waitFor(() => expect(onSaveDesktopNoticeInstance).toHaveBeenCalledTimes(1));
    expect(onSaveDesktopNoticeInstance.mock.calls[0][0]).toMatchObject({
      variant: 'custom-lightbar',
      customLightbar: expect.any(Object),
      edgeLightbar: null,
      idleBehavior: 'hidden',
      enabled: true,
      showOnStartup: false
    });
  });

  test('opens desktop notice preview for selected instance', async () => {
    const onPreviewDesktopNoticeInstance = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nProvider language="zh-CN">
        <SettingsPage
          config={{
            ...config,
            desktopNoticeInstances: [
              {
                id: 'desk-1',
                name: '顶部提示',
                variant: 'custom-lightbar',
                enabled: true,
                showOnStartup: false,
                alwaysOnTop: true,
                idleBehavior: 'hidden',
                customLightbar: {
                  presetPosition: 'top-center',
                  direction: 'horizontal',
                  size: { width: 640, height: 28 },
                  opacityPercent: 100,
                  cornerRadiusPercent: 0,
                  boundsOverride: null
                },
                edgeLightbar: null
              }
            ]
          }}
          onSavePort={vi.fn()}
          onSaveArduinoCliPath={vi.fn()}
          onSaveLanguage={vi.fn()}
          onSaveThemeMode={vi.fn()}
          onSaveWindowCloseBehavior={vi.fn()}
          onSaveWindowStartupMode={vi.fn()}
          onSaveWindowLaunchAtLogin={vi.fn()}
          onSaveWindowHideOnLoginLaunch={vi.fn()}
          onRotateHookToken={vi.fn()}
          onResetConfiguration={vi.fn()}
          onPreviewDesktopNoticeInstance={onPreviewDesktopNoticeInstance}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));

    await waitFor(() => expect(onPreviewDesktopNoticeInstance).toHaveBeenCalledWith('desk-1'));
  });
});
