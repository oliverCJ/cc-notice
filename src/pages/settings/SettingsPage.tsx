import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  AppConfigView,
  Language,
  ThemeMode,
  WindowCloseBehavior,
  WindowStartupMode
} from '../../state/appStore';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';
import { ArduinoCliStatus, getArduinoCliStatus, ResetConfigurationScope } from '@/api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { DesktopNoticeInstanceLibrary } from '@/pages/desktop-notice/DesktopNoticeInstanceLibrary';
import { SettingsResetSection } from './SettingsResetSection';

type SettingsPageProps = {
  config: AppConfigView;
  onSavePort: (port: number) => void;
  onSaveArduinoCliPath: (path: string | null) => Promise<void>;
  onSaveLanguage: (language: Language) => void;
  onSaveThemeMode: (themeMode: ThemeMode) => Promise<void>;
  onSaveWindowCloseBehavior: (closeBehavior: WindowCloseBehavior) => Promise<void>;
  onSaveWindowStartupMode: (startupMode: WindowStartupMode) => Promise<void>;
  onSaveWindowLaunchAtLogin: (launchAtLogin: boolean) => Promise<void>;
  onSaveWindowHideOnLoginLaunch: (hideWindowOnLoginLaunch: boolean) => Promise<void>;
  onRotateHookToken: () => Promise<void>;
  onResetConfiguration: (scope: ResetConfigurationScope) => Promise<void>;
  onSaveDesktopNoticeInstance?: (instance: DesktopNoticeInstance) => Promise<void>;
  onDeleteDesktopNoticeInstance?: (instanceId: string) => Promise<void>;
  onPreviewDesktopNoticeInstance?: (instanceId: string) => Promise<void>;
  onHideDesktopNoticeInstance?: (instanceId: string) => Promise<void>;
  onSaveDesktopNoticeWindowBounds?: (instanceId: string) => Promise<void>;
};

export function SettingsPage({
  config,
  onSavePort,
  onSaveArduinoCliPath,
  onSaveLanguage,
  onSaveThemeMode,
  onSaveWindowCloseBehavior,
  onSaveWindowStartupMode,
  onSaveWindowLaunchAtLogin,
  onSaveWindowHideOnLoginLaunch,
  onRotateHookToken,
  onResetConfiguration,
  onSaveDesktopNoticeInstance = async () => undefined,
  onDeleteDesktopNoticeInstance = async () => undefined,
  onPreviewDesktopNoticeInstance = async () => undefined,
  onHideDesktopNoticeInstance = async () => undefined,
  onSaveDesktopNoticeWindowBounds = async () => undefined
}: SettingsPageProps) {
  const t = useI18n();
  const [port, setPort] = useState(config.localHookServer.port);
  const [language, setLanguage] = useState<Language>(config.ui.language);
  const [themeMode, setThemeMode] = useState<ThemeMode>(config.ui.themeMode);
  const [closeBehavior, setCloseBehavior] = useState<WindowCloseBehavior>(
    config.window.closeBehavior
  );
  const [startupMode, setStartupMode] = useState<WindowStartupMode>(config.window.startupMode);
  const [launchAtLogin, setLaunchAtLogin] = useState(config.window.launchAtLogin);
  const [hideWindowOnLoginLaunch, setHideWindowOnLoginLaunch] = useState(
    config.window.hideWindowOnLoginLaunch
  );
  const [arduinoCliPath, setArduinoCliPath] = useState(config.arduinoCliPath ?? '');
  const [arduinoCliPathError, setArduinoCliPathError] = useState<string | null>(null);
  const [arduinoCliStatus, setArduinoCliStatus] = useState<ArduinoCliStatus | null>(null);
  const [arduinoCliBusy, setArduinoCliBusy] = useState(false);
  const [arduinoCliSaveBusy, setArduinoCliSaveBusy] = useState(false);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [themeModeBusy, setThemeModeBusy] = useState(false);
  const [closeBehaviorBusy, setCloseBehaviorBusy] = useState(false);
  const [startupModeBusy, setStartupModeBusy] = useState(false);
  const [launchAtLoginBusy, setLaunchAtLoginBusy] = useState(false);
  const [hideWindowOnLoginLaunchBusy, setHideWindowOnLoginLaunchBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPort(config.localHookServer.port);
    setLanguage(config.ui.language);
    setThemeMode(config.ui.themeMode);
    setCloseBehavior(config.window.closeBehavior);
    setStartupMode(config.window.startupMode);
    setLaunchAtLogin(config.window.launchAtLogin);
    setHideWindowOnLoginLaunch(config.window.hideWindowOnLoginLaunch);
    setArduinoCliPath(config.arduinoCliPath ?? '');
  }, [
    config.localHookServer.port,
    config.ui.language,
    config.ui.themeMode,
    config.window.closeBehavior,
    config.window.startupMode,
    config.window.launchAtLogin,
    config.window.hideWindowOnLoginLaunch,
    config.arduinoCliPath
  ]);

  async function handleSavePort() {
    try {
      await onSavePort(port);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.portSavedDescription', { port })
      });
    } catch (error) {
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  }

  async function handleSaveLanguage() {
    try {
      await onSaveLanguage(language);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.languageSavedDescription')
      });
    } catch (error) {
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    }
  }

  async function handleSaveThemeMode() {
    setThemeModeBusy(true);
    try {
      await onSaveThemeMode(themeMode);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.themeModeSavedDescription')
      });
    } catch (error) {
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setThemeModeBusy(false);
    }
  }

  async function handleRotateHookToken() {
    setTokenBusy(true);
    try {
      await onRotateHookToken();
      toast({
        title: t('settings.tokenRotatedTitle'),
        description: t('settings.tokenRotatedDescription')
      });
    } catch (error) {
      toast({
        title: t('settings.tokenRotateFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setTokenBusy(false);
    }
  }

  async function handleCloseBehaviorChange(checked: boolean) {
    const nextBehavior: WindowCloseBehavior = checked ? 'hide-to-tray' : 'exit';
    const previousBehavior = closeBehavior;
    setCloseBehavior(nextBehavior);
    setCloseBehaviorBusy(true);
    try {
      await onSaveWindowCloseBehavior(nextBehavior);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.windowCloseBehaviorSavedDescription')
      });
    } catch (error) {
      setCloseBehavior(previousBehavior);
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setCloseBehaviorBusy(false);
    }
  }

  async function handleStartupModeChange(checked: boolean) {
    const nextMode: WindowStartupMode = checked ? 'lightweight' : 'normal';
    const previousMode = startupMode;
    setStartupMode(nextMode);
    setStartupModeBusy(true);
    try {
      await onSaveWindowStartupMode(nextMode);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.windowStartupModeSavedDescription')
      });
    } catch (error) {
      setStartupMode(previousMode);
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setStartupModeBusy(false);
    }
  }

  async function handleLaunchAtLoginChange(checked: boolean) {
    const previousLaunchAtLogin = launchAtLogin;
    setLaunchAtLogin(checked);
    setLaunchAtLoginBusy(true);
    try {
      await onSaveWindowLaunchAtLogin(checked);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.launchAtLoginSavedDescription')
      });
    } catch (error) {
      setLaunchAtLogin(previousLaunchAtLogin);
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setLaunchAtLoginBusy(false);
    }
  }

  async function handleHideWindowOnLoginLaunchChange(checked: boolean) {
    const previousHideWindowOnLoginLaunch = hideWindowOnLoginLaunch;
    setHideWindowOnLoginLaunch(checked);
    setHideWindowOnLoginLaunchBusy(true);
    try {
      await onSaveWindowHideOnLoginLaunch(checked);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.hideWindowOnLoginLaunchSavedDescription')
      });
    } catch (error) {
      setHideWindowOnLoginLaunch(previousHideWindowOnLoginLaunch);
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setHideWindowOnLoginLaunchBusy(false);
    }
  }

  async function handleSaveArduinoCliPath() {
    const normalizedPath = arduinoCliPath.trim();
    if (!normalizedPath) {
      const message = t('settings.arduinoCliPathRequired');
      setArduinoCliPathError(message);
      toast({
        title: t('settings.saveFailedTitle'),
        description: message,
        variant: 'destructive'
      });
      return;
    }

    setArduinoCliPathError(null);
    setArduinoCliSaveBusy(true);
    try {
      await onSaveArduinoCliPath(normalizedPath);
      setArduinoCliPath(normalizedPath);
      setArduinoCliStatus(null);
      toast({
        title: t('settings.saveSuccessTitle'),
        description: t('settings.arduinoCliPathSavedDescription')
      });
    } catch (error) {
      toast({
        title: t('settings.saveFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setArduinoCliSaveBusy(false);
    }
  }

  async function handleCheckArduinoCli() {
    setArduinoCliBusy(true);
    try {
      const status = await getArduinoCliStatus();
      setArduinoCliStatus(status);
    } catch (error) {
      setArduinoCliStatus({
        configuredPath: arduinoCliPath.trim() || null,
        resolvedPath: arduinoCliPath.trim() || 'arduino-cli',
        available: false,
        version: null,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setArduinoCliBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('settings.description')}</p>
      </div>

      {/* Hook 服务配置 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.localHookServer')}</CardTitle>
          <CardDescription>{t('settings.localHookServerDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="port">{t('settings.receivePort')}</Label>
            <Input
              id="port"
              type="number"
              min={1024}
              max={65535}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              className="max-w-xs"
            />
          </div>
          <p className="text-sm text-muted-foreground">{t('settings.portHelp')}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSavePort}>{t('settings.savePort')}</Button>
            <Button variant="outline" onClick={handleRotateHookToken} disabled={tokenBusy}>
              {tokenBusy ? t('settings.refreshingToken') : t('settings.refreshToken')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Arduino CLI */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.arduinoCliTitle')}</CardTitle>
          <CardDescription>{t('settings.arduinoCliDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="arduino-cli-path">{t('settings.arduinoCliPath')}</Label>
            <Input
              id="arduino-cli-path"
              value={arduinoCliPath}
              onChange={(event) => {
                setArduinoCliPath(event.target.value);
                if (arduinoCliPathError) {
                  setArduinoCliPathError(null);
                }
              }}
              placeholder={t('settings.arduinoCliPathPlaceholder')}
              disabled={arduinoCliSaveBusy}
              aria-invalid={Boolean(arduinoCliPathError)}
            />
            {arduinoCliPathError && (
              <p className="text-sm text-destructive">{arduinoCliPathError}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t('settings.arduinoCliHelp')}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSaveArduinoCliPath} disabled={arduinoCliSaveBusy}>
              {arduinoCliSaveBusy ? t('common.saving') : t('settings.saveArduinoCliPath')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCheckArduinoCli}
              disabled={arduinoCliBusy || arduinoCliSaveBusy}
            >
              {arduinoCliBusy ? t('settings.detectingArduinoCli') : t('settings.detectArduinoCli')}
            </Button>
          </div>
          {arduinoCliStatus && (
            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium">
                {arduinoCliStatus.available
                  ? t('settings.arduinoCliAvailable')
                  : t('settings.arduinoCliUnavailable')}
              </p>
              <p className="mt-1 break-all text-muted-foreground">
                {t('settings.arduinoCliResolvedPath', {
                  path: arduinoCliStatus.resolvedPath
                })}
              </p>
              {arduinoCliStatus.version && (
                <p className="mt-1 break-all text-muted-foreground">
                  {t('settings.arduinoCliVersion', { version: arduinoCliStatus.version })}
                </p>
              )}
              {arduinoCliStatus.error && (
                <p className="mt-1 break-all text-destructive">
                  {formatArduinoCliSettingsError(arduinoCliStatus.error, t)}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DesktopNoticeInstanceLibrary
        instances={config.desktopNoticeInstances ?? []}
        onSaveInstance={onSaveDesktopNoticeInstance}
        onDeleteInstance={onDeleteDesktopNoticeInstance}
        onPreviewInstance={onPreviewDesktopNoticeInstance}
        onHidePreview={onHideDesktopNoticeInstance}
        onSaveWindowBounds={onSaveDesktopNoticeWindowBounds}
      />

      {/* 外观设置 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearanceTitle')}</CardTitle>
          <CardDescription>{t('settings.appearanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="theme-mode">{t('settings.themeMode')}</Label>
            <Select value={themeMode} onValueChange={(val) => setThemeMode(val as ThemeMode)}>
              <SelectTrigger id="theme-mode" aria-label={t('settings.themeMode')} className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t('settings.themeModeSystem')}</SelectItem>
                <SelectItem value="light">{t('settings.themeModeLight')}</SelectItem>
                <SelectItem value="dark">{t('settings.themeModeDark')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">{t('settings.themeModeHelp')}</p>
          <Button onClick={handleSaveThemeMode} disabled={themeModeBusy}>
            {themeModeBusy ? t('common.saving') : t('settings.saveThemeMode')}
          </Button>
        </CardContent>
      </Card>

      {/* 窗口行为 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.windowBehaviorTitle')}</CardTitle>
          <CardDescription>{t('settings.windowBehaviorDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="space-y-1">
              <Label htmlFor="close-to-tray">{t('settings.closeToTray')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.closeToTrayDescription')}
              </p>
            </div>
            <Switch
              id="close-to-tray"
              aria-label={t('settings.closeToTray')}
              checked={closeBehavior === 'hide-to-tray'}
              disabled={closeBehaviorBusy}
              onCheckedChange={handleCloseBehaviorChange}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="space-y-1">
              <Label htmlFor="startup-lightweight-mode">{t('settings.startupLightweightMode')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.startupLightweightModeDescription')}
              </p>
            </div>
            <Switch
              id="startup-lightweight-mode"
              aria-label={t('settings.startupLightweightMode')}
              checked={startupMode === 'lightweight'}
              disabled={startupModeBusy}
              onCheckedChange={handleStartupModeChange}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="space-y-1">
              <Label htmlFor="launch-at-login">{t('settings.launchAtLogin')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.launchAtLoginDescription')}
              </p>
            </div>
            <Switch
              id="launch-at-login"
              aria-label={t('settings.launchAtLogin')}
              checked={launchAtLogin}
              disabled={launchAtLoginBusy}
              onCheckedChange={handleLaunchAtLoginChange}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="space-y-1">
              <Label htmlFor="hide-window-on-login-launch">
                {t('settings.hideWindowOnLoginLaunch')}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.hideWindowOnLoginLaunchDescription')}
              </p>
            </div>
            <Switch
              id="hide-window-on-login-launch"
              aria-label={t('settings.hideWindowOnLoginLaunch')}
              checked={hideWindowOnLoginLaunch}
              disabled={!launchAtLogin || launchAtLoginBusy || hideWindowOnLoginLaunchBusy}
              onCheckedChange={handleHideWindowOnLoginLaunchChange}
            />
          </div>
          </div>
        </CardContent>
      </Card>

      {/* 语言设置 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.languageTitle')}</CardTitle>
          <CardDescription>{t('settings.languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="language">{t('settings.language')}</Label>
            <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
              <SelectTrigger id="language" className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">{t('settings.languageZhCn')}</SelectItem>
                <SelectItem value="en-US">{t('settings.languageEnUs')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveLanguage}>{t('settings.saveLanguage')}</Button>
        </CardContent>
      </Card>

      <Separator />

      <SettingsResetSection onReset={onResetConfiguration} />

      <Separator />

      {/* 日志说明 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.logTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('settings.logDescription')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function formatArduinoCliSettingsError(error: string, t: ReturnType<typeof useI18n>) {
  if (error === 'arduino_cli_not_found') {
    return t('settings.arduinoCliNotFound');
  }
  return error;
}
