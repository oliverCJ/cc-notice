import { Bell, Eraser, Monitor, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DeviceBuzzerPattern,
  DeviceDisplayCapabilities,
  DeviceExtensionAction,
  DeviceExtensionStatus,
  DeviceRuntimeState
} from '@/api/tauriApi';
import { getBoardDeviceExtensions } from '@/domain/boards/boardCatalog';
import { isAsciiDisplayText } from '@/domain/display/displayTemplateValidation';
import { DeviceActionStatus } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';

type DeviceExtensionPanelProps = {
  selectedState: DeviceRuntimeState | null;
  actionStatus: DeviceActionStatus;
  onSend: (request: DeviceExtensionAction) => void;
};

const statusActions: Array<{
  status: DeviceExtensionStatus;
  titleKey: string;
  messageKey: string;
  compactTitleKey: string;
  compactMessageKey: string;
}> = [
  {
    status: 'success',
    titleKey: 'successTitle',
    messageKey: 'successMessage',
    compactTitleKey: 'successTitle',
    compactMessageKey: 'successMessage'
  },
  {
    status: 'working',
    titleKey: 'workingTitle',
    messageKey: 'workingMessage',
    compactTitleKey: 'workingTitle',
    compactMessageKey: 'workingMessage'
  },
  {
    status: 'warning',
    titleKey: 'warningTitle',
    messageKey: 'warningMessage',
    compactTitleKey: 'warningTitle',
    compactMessageKey: 'warningMessage'
  },
  {
    status: 'error',
    titleKey: 'errorTitle',
    messageKey: 'errorMessage',
    compactTitleKey: 'errorTitle',
    compactMessageKey: 'errorMessage'
  }
];

function selectStatusPayload(
  displayCapabilities: DeviceDisplayCapabilities,
  t: ReturnType<typeof useI18n>,
  titleKey: string,
  messageKey: string,
  compactTitleKey: string,
  compactMessageKey: string
) {
  if (displayCapabilities.sizeClass === 'compact') {
    return {
      title: t(`devices.deviceExtension.statusPayloadCompact.${compactTitleKey}`),
      message: t(`devices.deviceExtension.statusPayloadCompact.${compactMessageKey}`)
    };
  }

  const title = t(`devices.deviceExtension.statusPayload.${titleKey}`);
  const message = t(`devices.deviceExtension.statusPayload.${messageKey}`);
  if (
    title.length <= displayCapabilities.titleMaxChars &&
    message.length <= displayCapabilities.messageMaxChars
  ) {
    return { title, message };
  }

  return {
    title: t(`devices.deviceExtension.statusPayloadCompact.${compactTitleKey}`),
    message: t(`devices.deviceExtension.statusPayloadCompact.${compactMessageKey}`)
  };
}

export function DeviceExtensionPanel({
  selectedState,
  actionStatus,
  onSend
}: DeviceExtensionPanelProps) {
  const t = useI18n();
  const boardExtensions = getBoardDeviceExtensions(selectedState?.boardId ?? '');
  const displayCapabilities = boardExtensions?.display ?? null;
  const buzzerPatterns = boardExtensions?.buzzer?.patterns ?? [];
  const [customTitle, setCustomTitle] = useState(t('devices.deviceExtension.customDisplay.defaultTitle'));
  const [customMessage, setCustomMessage] = useState(
    t('devices.deviceExtension.customDisplay.defaultMessage')
  );
  const deviceId = selectedState?.deviceId ?? null;
  const connected = selectedState?.status === 'connected';
  const busy = actionStatus === 'sending';
  const disabled = !deviceId || !connected || busy;
  const customDisplayHasUnsupportedText =
    !isAsciiDisplayText(customTitle) || !isAsciiDisplayText(customMessage);
  const customDisplayDisabled =
    disabled || !customTitle.trim() || !customMessage.trim() || customDisplayHasUnsupportedText;

  if (!displayCapabilities && buzzerPatterns.length === 0) {
    return null;
  }

  function sendStatus(
    status: DeviceExtensionStatus,
    titleKey: string,
    messageKey: string,
    compactTitleKey: string,
    compactMessageKey: string
  ) {
    if (!deviceId || !displayCapabilities) {
      return;
    }
    const payload = selectStatusPayload(
      displayCapabilities,
      t,
      titleKey,
      messageKey,
      compactTitleKey,
      compactMessageKey
    );
    onSend({
      deviceId,
      action: 'display-status',
      status,
      title: payload.title,
      message: payload.message
    });
  }

  function sendClear() {
    if (!deviceId) {
      return;
    }
    onSend({ deviceId, action: 'display-clear' });
  }

  function sendCustomDisplay() {
    if (!deviceId || customDisplayDisabled) {
      return;
    }
    onSend({
      deviceId,
      action: 'display-status',
      status: 'notice',
      title: customTitle.trim(),
      message: customMessage.trim()
    });
  }

  function sendRuntimeDisplay() {
    if (!deviceId || !displayCapabilities?.runtime) {
      return;
    }
    onSend({
      deviceId,
      action: 'display-runtime',
      status: 'working',
      title: t('devices.deviceExtension.runtimePayload.title'),
      message: t('devices.deviceExtension.runtimePayload.message'),
      lines: [
        t('devices.deviceExtension.runtimePayload.line1'),
        t('devices.deviceExtension.runtimePayload.line2')
      ]
    });
  }

  function sendPattern(pattern: DeviceBuzzerPattern) {
    if (!deviceId) {
      return;
    }
    onSend({ deviceId, action: 'buzzer-pattern', pattern });
  }

  function setMuted(active: boolean) {
    if (!deviceId) {
      return;
    }
    onSend({ deviceId, action: 'device-control', control: 'mute', active });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('devices.deviceExtension.title')}</CardTitle>
        <CardDescription>{t('devices.deviceExtension.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayCapabilities ? (
          <DisplayTestControls
            displayCapabilities={displayCapabilities}
            customTitle={customTitle}
            customMessage={customMessage}
            disabled={disabled}
            customDisplayDisabled={customDisplayDisabled}
            customDisplayHasUnsupportedText={customDisplayHasUnsupportedText}
            onCustomTitleChange={setCustomTitle}
            onCustomMessageChange={setCustomMessage}
            onSendCustomDisplay={sendCustomDisplay}
            onSendRuntimeDisplay={sendRuntimeDisplay}
            onSendStatus={sendStatus}
            onClear={sendClear}
          />
        ) : null}

        {buzzerPatterns.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('devices.deviceExtension.buzzerPatterns')}</p>
            <div className="flex flex-wrap gap-2">
              {buzzerPatterns.map((pattern) => (
                <Button
                  key={pattern}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => sendPattern(pattern)}
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {t(`devices.deviceExtension.pattern.${pattern}`)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {buzzerPatterns.length > 0 ? (
            <>
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setMuted(true)}>
                <VolumeX className="mr-2 h-4 w-4" />
                {t('devices.deviceExtension.mute')}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setMuted(false)}>
                <Volume2 className="mr-2 h-4 w-4" />
                {t('devices.deviceExtension.unmute')}
              </Button>
            </>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {busy ? t('devices.testAction.sending') : connected ? t('devices.testAction.ready') : t('devices.testAction.skipped')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type DisplayTestControlsProps = {
  displayCapabilities: DeviceDisplayCapabilities;
  customTitle: string;
  customMessage: string;
  disabled: boolean;
  customDisplayDisabled: boolean;
  customDisplayHasUnsupportedText: boolean;
  onCustomTitleChange: (value: string) => void;
  onCustomMessageChange: (value: string) => void;
  onSendCustomDisplay: () => void;
  onSendRuntimeDisplay: () => void;
  onSendStatus: (
    status: DeviceExtensionStatus,
    titleKey: string,
    messageKey: string,
    compactTitleKey: string,
    compactMessageKey: string
  ) => void;
  onClear: () => void;
};

function DisplayTestControls({
  displayCapabilities,
  customTitle,
  customMessage,
  disabled,
  customDisplayDisabled,
  customDisplayHasUnsupportedText,
  onCustomTitleChange,
  onCustomMessageChange,
  onSendCustomDisplay,
  onSendRuntimeDisplay,
  onSendStatus,
  onClear
}: DisplayTestControlsProps) {
  const t = useI18n();
  const supportedStatuses = new Set(displayCapabilities.statuses);
  const visibleStatusActions = statusActions.filter((item) => supportedStatuses.has(item.status));

  return (
    <>
      {displayCapabilities.status ? (
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="device-display-title">
              {t('devices.deviceExtension.customDisplay.title')}
            </Label>
            <Input
              id="device-display-title"
              value={customTitle}
              maxLength={displayCapabilities.titleMaxChars}
              disabled={disabled}
              onChange={(event) => onCustomTitleChange(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:row-span-2">
            <Label htmlFor="device-display-message">
              {t('devices.deviceExtension.customDisplay.message')}
            </Label>
            <Textarea
              id="device-display-message"
              value={customMessage}
              maxLength={displayCapabilities.messageMaxChars}
              rows={3}
              disabled={disabled}
              onChange={(event) => onCustomMessageChange(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={customDisplayDisabled}
              onClick={onSendCustomDisplay}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t('devices.deviceExtension.customDisplay.send')}
            </Button>
          </div>
          {customDisplayHasUnsupportedText ? (
            <p className="text-xs text-destructive md:col-span-2">
              {t('devices.deviceExtension.customDisplay.asciiValidation')}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground md:col-span-2">
            {t('devices.deviceExtension.customDisplay.asciiNote')}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('devices.deviceExtension.display')}</p>
        <div className="flex flex-wrap gap-2">
          {displayCapabilities.runtime ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={onSendRuntimeDisplay}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t('devices.deviceExtension.testRuntime')}
            </Button>
          ) : null}
          {displayCapabilities.status
            ? visibleStatusActions.map((item) => (
                <Button
                  key={item.status}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    onSendStatus(
                      item.status,
                      item.titleKey,
                      item.messageKey,
                      item.compactTitleKey,
                      item.compactMessageKey
                    )
                  }
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  {t(`devices.deviceExtension.status.${item.status}`)}
                </Button>
              ))
            : null}
          {displayCapabilities.clear ? (
            <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClear}>
              <Eraser className="mr-2 h-4 w-4" />
              {t('devices.deviceExtension.clearDisplay')}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}
