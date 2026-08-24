import { Bell, Eraser, Monitor, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  DeviceBuzzerPattern,
  DeviceDisplayCapabilities,
  DeviceExtensionAction,
  DeviceRuntimeState
} from '@/api/tauriApi';
import { getBoardDeviceExtensions } from '@/domain/boards/boardCatalog';
import {
  clampOptionalNumber,
  deviceChannelParameterConstraints
} from '@/domain/deviceChannels/deviceChannelActionParameters';
import {
  DISPLAY_FACE_TEMPLATE_IDS,
  DisplayFaceTemplateId,
  defaultDisplayFaceTemplateId,
  displayFaceTemplateLabelKey
} from '@/domain/display/displayFaceTemplates';
import { DeviceActionStatus } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';

type DeviceExtensionPanelProps = {
  selectedState: DeviceRuntimeState | null;
  actionStatus: DeviceActionStatus;
  onSend: (request: DeviceExtensionAction) => void;
};

export function DeviceExtensionPanel({
  selectedState,
  actionStatus,
  onSend
}: DeviceExtensionPanelProps) {
  const t = useI18n();
  const boardExtensions = getBoardDeviceExtensions(selectedState?.boardId ?? '');
  const displayCapabilities = boardExtensions?.display ?? null;
  const buzzerPatterns = boardExtensions?.buzzer?.patterns ?? [];
  const [selectedFaceTemplateId, setSelectedFaceTemplateId] = useState<string>(
    defaultDisplayFaceTemplateId
  );
  const [displayFaceDurationMs, setDisplayFaceDurationMs] = useState<string>(
    String(deviceChannelParameterConstraints.durationMs.defaultValue)
  );
  const deviceId = selectedState?.deviceId ?? null;
  const connected = selectedState?.status === 'connected';
  const busy = actionStatus === 'sending';
  const disabled = !deviceId || !connected || busy;

  if (!displayCapabilities && buzzerPatterns.length === 0) {
    return null;
  }

  function sendClear() {
    if (!deviceId) {
      return;
    }
    onSend({ deviceId, action: 'display-clear' });
  }

  function sendDisplayFace(faceTemplateId: string, durationMs: number) {
    if (!deviceId || !displayCapabilities?.face) {
      return;
    }
    onSend({
      deviceId,
      action: 'display-face',
      faceTemplate: faceTemplateId,
      faceIntensity: 'standard',
      durationMs
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
            disabled={disabled}
            selectedFaceTemplateId={selectedFaceTemplateId}
            displayFaceDurationMs={displayFaceDurationMs}
            onSelectedFaceTemplateIdChange={setSelectedFaceTemplateId}
            onDisplayFaceDurationMsChange={setDisplayFaceDurationMs}
            onSendDisplayFace={sendDisplayFace}
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
  disabled: boolean;
  selectedFaceTemplateId: string;
  displayFaceDurationMs: string;
  onSelectedFaceTemplateIdChange: (value: string) => void;
  onDisplayFaceDurationMsChange: (value: string) => void;
  onSendDisplayFace: (faceTemplateId: string, durationMs: number) => void;
  onClear: () => void;
};

function DisplayTestControls({
  displayCapabilities,
  disabled,
  selectedFaceTemplateId,
  displayFaceDurationMs,
  onSelectedFaceTemplateIdChange,
  onDisplayFaceDurationMsChange,
  onSendDisplayFace,
  onClear
}: DisplayTestControlsProps) {
  const t = useI18n();
  const faceTemplateIds = DISPLAY_FACE_TEMPLATE_IDS.filter((templateId) =>
    displayCapabilities.faceTemplates?.length
      ? displayCapabilities.faceTemplates.includes(templateId)
      : true
  );
  const selectedFaceTemplate = faceTemplateIds.includes(
    selectedFaceTemplateId as DisplayFaceTemplateId
  )
    ? selectedFaceTemplateId
    : (faceTemplateIds[0] ?? defaultDisplayFaceTemplateId);
  const parsedDurationMs = clampOptionalNumber(
    displayFaceDurationMs,
    deviceChannelParameterConstraints.durationMs
  );
  const effectiveDurationMs =
    parsedDurationMs ?? deviceChannelParameterConstraints.durationMs.defaultValue;

  function normalizeDisplayFaceDuration() {
    onDisplayFaceDurationMsChange(String(effectiveDurationMs));
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('devices.deviceExtension.display')}</p>
        <div className="flex flex-wrap gap-2">
          {displayCapabilities.face ? (
            <div className="flex min-w-[260px] flex-wrap items-end gap-2 rounded-md border border-border/70 p-2">
              <div className="min-w-[160px] flex-1 space-y-1">
                <Label htmlFor="device-display-face-template">
                  {t('devices.deviceExtension.displayFace')}
                </Label>
                <Select
                  value={selectedFaceTemplate}
                  onValueChange={onSelectedFaceTemplateIdChange}
                  disabled={disabled}
                >
                  <SelectTrigger id="device-display-face-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {faceTemplateIds.map((templateId) => (
                      <SelectItem key={templateId} value={templateId}>
                        {t(displayFaceTemplateLabelKey(templateId))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32 space-y-1">
                <Label htmlFor="device-display-face-duration">
                  {t('devices.deviceExtension.displayFaceDurationMs')}
                </Label>
                <Input
                  id="device-display-face-duration"
                  inputMode="numeric"
                  value={displayFaceDurationMs}
                  disabled={disabled}
                  onChange={(event) => onDisplayFaceDurationMsChange(event.target.value)}
                  onBlur={normalizeDisplayFaceDuration}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled || faceTemplateIds.length === 0}
                onClick={() => onSendDisplayFace(selectedFaceTemplate, effectiveDurationMs)}
              >
                <Monitor className="mr-2 h-4 w-4" />
                {t('devices.deviceExtension.testDisplayFace')}
              </Button>
            </div>
          ) : null}
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
