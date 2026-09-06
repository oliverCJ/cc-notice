import { Bell, Eraser, Monitor, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DisplayFacePreview } from '@/components/display/DisplayFacePreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CustomFaceGroup,
  DeviceBuzzerPattern,
  DeviceDisplayCapabilities,
  DeviceExtensionAction,
  DeviceRuntimeState,
} from '@/api/tauriApi';
import { CustomFaceAnimatedPreview } from '@/pages/custom-face-editor/CustomFaceAnimatedPreview';
import { getBoardDeviceExtensions } from '@/domain/boards/boardCatalog';
import { editorProfileFromId } from '@/domain/customFaces/editor/profile';
import {
  clampOptionalNumber,
  deviceChannelParameterConstraints,
} from '@/domain/deviceChannels/deviceChannelActionParameters';
import {
  DISPLAY_FACE_TEMPLATE_IDS,
  DisplayFaceTemplateId,
  defaultDisplayFaceTemplateId,
  displayFaceTemplateLabelKey,
} from '@/domain/display/displayFaceTemplates';
import { resolveDeviceDisplayCapabilities } from '@/domain/devices/deviceDisplayCapabilities';
import { DeviceActionStatus } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';

export type CustomFaceDisplayTestContext = {
  groupById: Record<string, CustomFaceGroup>;
  reloading: boolean;
  loadError: string | null;
  onReload: () => void;
};

type DeviceExtensionPanelProps = {
  selectedState: DeviceRuntimeState | null;
  actionStatus: DeviceActionStatus;
  onSend: (request: DeviceExtensionAction) => void;
  customFaceTestContext?: CustomFaceDisplayTestContext | null;
};

export function DeviceExtensionPanel({
  selectedState,
  actionStatus,
  onSend,
  customFaceTestContext,
}: DeviceExtensionPanelProps) {
  const t = useI18n();
  const boardExtensions = getBoardDeviceExtensions(selectedState?.boardId ?? '');
  const displayCapabilities = resolveDeviceDisplayCapabilities(
    selectedState?.boardId ?? null,
    selectedState
  );
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
      durationMs,
    });
  }

  function sendCustomDisplayFace(groupId: string, faceId: string, durationMs: number) {
    if (!deviceId || !displayCapabilities?.face) {
      return;
    }
    onSend({
      deviceId,
      action: 'display-face',
      faceTemplate: defaultDisplayFaceTemplateId,
      faceIntensity: 'standard',
      customFaceGroupId: groupId,
      customFaceId: faceId,
      durationMs,
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
            selectedState={selectedState}
            customFaceTestContext={customFaceTestContext}
            displayFaceDurationMs={displayFaceDurationMs}
            onSelectedFaceTemplateIdChange={setSelectedFaceTemplateId}
            onDisplayFaceDurationMsChange={setDisplayFaceDurationMs}
            onSendDisplayFace={sendDisplayFace}
            onSendCustomDisplayFace={sendCustomDisplayFace}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setMuted(true)}
              >
                <VolumeX className="mr-2 h-4 w-4" />
                {t('devices.deviceExtension.mute')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setMuted(false)}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                {t('devices.deviceExtension.unmute')}
              </Button>
            </>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {busy
              ? t('devices.testAction.sending')
              : connected
                ? t('devices.testAction.ready')
                : t('devices.testAction.skipped')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type DisplayTestControlsProps = {
  displayCapabilities: DeviceDisplayCapabilities;
  disabled: boolean;
  selectedState: DeviceRuntimeState | null;
  customFaceTestContext?: CustomFaceDisplayTestContext | null;
  selectedFaceTemplateId: string;
  displayFaceDurationMs: string;
  onSelectedFaceTemplateIdChange: (value: string) => void;
  onDisplayFaceDurationMsChange: (value: string) => void;
  onSendDisplayFace: (faceTemplateId: string, durationMs: number) => void;
  onSendCustomDisplayFace: (groupId: string, faceId: string, durationMs: number) => void;
  onClear: () => void;
};

function DisplayTestControls({
  displayCapabilities,
  disabled,
  selectedState,
  customFaceTestContext,
  selectedFaceTemplateId,
  displayFaceDurationMs,
  onSelectedFaceTemplateIdChange,
  onDisplayFaceDurationMsChange,
  onSendDisplayFace,
  onSendCustomDisplayFace,
  onClear,
}: DisplayTestControlsProps) {
  const t = useI18n();
  const [displayFaceTestMode, setDisplayFaceTestMode] = useState<'builtin' | 'custom'>('builtin');
  const [selectedCustomFaceId, setSelectedCustomFaceId] = useState('');
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
  const customFaceSupported = Boolean(selectedState?.firmwareInfo?.customFace);
  const installedCustomFace = selectedState?.customFaceStatus?.installed ?? null;
  const installedCustomFaceGroup =
    installedCustomFace && customFaceTestContext
      ? (customFaceTestContext.groupById[installedCustomFace.groupId] ?? null)
      : null;
  const selectedCustomFace = useMemo(() => {
    if (!installedCustomFaceGroup) {
      return null;
    }
    return (
      installedCustomFaceGroup.faces.find((face) => face.faceId === selectedCustomFaceId) ?? null
    );
  }, [installedCustomFaceGroup, selectedCustomFaceId]);
  const customFaceProfile = installedCustomFaceGroup
    ? editorProfileFromId(installedCustomFaceGroup.displayProfileId)
    : null;
  const customFaceMissingLocally =
    displayFaceTestMode === 'custom' && Boolean(installedCustomFace) && !installedCustomFaceGroup;

  useEffect(() => {
    if (displayFaceTestMode !== 'custom' || !installedCustomFaceGroup) {
      return;
    }
    const preferredFaceId = installedCustomFaceGroup.defaultFaceId;
    const nextFace =
      installedCustomFaceGroup.faces.find((face) => face.faceId === selectedCustomFaceId) ??
      installedCustomFaceGroup.faces.find((face) => face.faceId === preferredFaceId) ??
      installedCustomFaceGroup.faces[0] ??
      null;
    if (nextFace && nextFace.faceId !== selectedCustomFaceId) {
      setSelectedCustomFaceId(nextFace.faceId);
    }
  }, [displayFaceTestMode, installedCustomFaceGroup, selectedCustomFaceId]);

  function normalizeDisplayFaceDuration() {
    onDisplayFaceDurationMsChange(String(effectiveDurationMs));
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('devices.deviceExtension.display')}</p>
        <div className="flex flex-wrap gap-2">
          {displayCapabilities.face ? (
            <div className="grid min-w-[260px] flex-1 items-center gap-3 rounded-md border border-border/70 p-3 lg:grid-cols-[minmax(260px,1fr)_minmax(220px,320px)]">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={displayFaceTestMode === 'builtin' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setDisplayFaceTestMode('builtin')}
                  >
                    {t('devices.deviceExtension.builtinFaceTest')}
                  </Button>
                  <Button
                    type="button"
                    variant={displayFaceTestMode === 'custom' ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={!customFaceSupported}
                    onClick={() => setDisplayFaceTestMode('custom')}
                  >
                    {t('devices.deviceExtension.customFaceTest')}
                  </Button>
                </div>
                {displayFaceTestMode === 'builtin' ? (
                  <div className="flex min-w-0 flex-wrap items-end gap-2">
                    <div className="min-w-[160px] flex-1 space-y-1">
                      <Label htmlFor="device-display-face-template">
                        {t('devices.deviceExtension.displayFace')}
                      </Label>
                      <Select
                        value={selectedFaceTemplate}
                        onValueChange={onSelectedFaceTemplateIdChange}
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
                    <DisplayFaceDurationInput
                      disabled={disabled}
                      value={displayFaceDurationMs}
                      onValueChange={onDisplayFaceDurationMsChange}
                      onBlur={normalizeDisplayFaceDuration}
                    />
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
                ) : (
                  <CustomDisplayFaceTestControls
                    disabled={disabled}
                    reloading={customFaceTestContext?.reloading ?? false}
                    loadError={customFaceTestContext?.loadError ?? null}
                    installedGroupId={installedCustomFace?.groupId ?? ''}
                    installedCustomFaceGroup={installedCustomFaceGroup}
                    selectedCustomFaceId={selectedCustomFaceId}
                    selectedCustomFace={selectedCustomFace}
                    customFaceMissingLocally={customFaceMissingLocally}
                    installed={Boolean(installedCustomFace)}
                    displayFaceDurationMs={displayFaceDurationMs}
                    effectiveDurationMs={effectiveDurationMs}
                    onSelectedCustomFaceIdChange={setSelectedCustomFaceId}
                    onDisplayFaceDurationMsChange={onDisplayFaceDurationMsChange}
                    onNormalizeDisplayFaceDuration={normalizeDisplayFaceDuration}
                    onReload={customFaceTestContext?.onReload}
                    onSendCustomDisplayFace={onSendCustomDisplayFace}
                  />
                )}
              </div>
              {displayFaceTestMode === 'custom' &&
              selectedCustomFace &&
              customFaceProfile &&
              selectedCustomFace.frames.length > 0 ? (
                <CustomFaceAnimatedPreview
                  ariaLabel={t('devices.deviceExtension.customFacePreview')}
                  className="mx-auto w-full rounded-md border border-border"
                  width={customFaceProfile.width}
                  height={customFaceProfile.height}
                  frames={selectedCustomFace.frames}
                />
              ) : (
                <DisplayFacePreview
                  className="mx-auto w-full"
                  displayCapabilities={displayCapabilities}
                  templateId={selectedFaceTemplate}
                />
              )}
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

type CustomDisplayFaceTestControlsProps = {
  disabled: boolean;
  reloading: boolean;
  loadError: string | null;
  installedGroupId: string;
  installedCustomFaceGroup: CustomFaceGroup | null;
  selectedCustomFaceId: string;
  selectedCustomFace: CustomFaceGroup['faces'][number] | null;
  customFaceMissingLocally: boolean;
  installed: boolean;
  displayFaceDurationMs: string;
  effectiveDurationMs: number;
  onSelectedCustomFaceIdChange: (value: string) => void;
  onDisplayFaceDurationMsChange: (value: string) => void;
  onNormalizeDisplayFaceDuration: () => void;
  onReload?: () => void;
  onSendCustomDisplayFace: (groupId: string, faceId: string, durationMs: number) => void;
};

function CustomDisplayFaceTestControls({
  disabled,
  reloading,
  loadError,
  installedGroupId,
  installedCustomFaceGroup,
  selectedCustomFaceId,
  selectedCustomFace,
  customFaceMissingLocally,
  installed,
  displayFaceDurationMs,
  effectiveDurationMs,
  onSelectedCustomFaceIdChange,
  onDisplayFaceDurationMsChange,
  onNormalizeDisplayFaceDuration,
  onReload,
  onSendCustomDisplayFace,
}: CustomDisplayFaceTestControlsProps) {
  const t = useI18n();

  if (!installed) {
    return (
      <p className="rounded-md border border-muted px-3 py-2 text-sm text-muted-foreground">
        {t('devices.deviceExtension.customFaceNotInstalled')}
      </p>
    );
  }

  if (customFaceMissingLocally) {
    return (
      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
        <p className="text-sm text-destructive">
          {t('devices.deviceExtension.customFaceMissingLocalGroup', {
            groupId: installedGroupId,
          })}
        </p>
        {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}
        <Button type="button" variant="outline" size="sm" disabled={reloading} onClick={onReload}>
          <RefreshCw className={`mr-2 h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
          {t('devices.customFaces.reloadGroups')}
        </Button>
      </div>
    );
  }

  if (!installedCustomFaceGroup) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <div className="min-w-[160px] flex-1 space-y-1">
        <Label htmlFor="device-custom-display-face">
          {t('devices.deviceExtension.customFace')}
        </Label>
        <Select value={selectedCustomFaceId} onValueChange={onSelectedCustomFaceIdChange}>
          <SelectTrigger id="device-custom-display-face">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {installedCustomFaceGroup.faces.map((face) => (
              <SelectItem key={face.faceId} value={face.faceId}>
                {face.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DisplayFaceDurationInput
        disabled={disabled}
        value={displayFaceDurationMs}
        onValueChange={onDisplayFaceDurationMsChange}
        onBlur={onNormalizeDisplayFaceDuration}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || !selectedCustomFace}
        onClick={() =>
          selectedCustomFace
            ? onSendCustomDisplayFace(
                installedCustomFaceGroup.groupId,
                selectedCustomFace.faceId,
                effectiveDurationMs
              )
            : undefined
        }
      >
        <Monitor className="mr-2 h-4 w-4" />
        {t('devices.deviceExtension.testCustomFace')}
      </Button>
    </div>
  );
}

type DisplayFaceDurationInputProps = {
  disabled: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onBlur: () => void;
};

function DisplayFaceDurationInput({
  disabled,
  value,
  onValueChange,
  onBlur,
}: DisplayFaceDurationInputProps) {
  const t = useI18n();
  return (
    <div className="w-32 space-y-1">
      <Label htmlFor="device-display-face-duration">
        {t('devices.deviceExtension.displayFaceDurationMs')}
      </Label>
      <Input
        id="device-display-face-duration"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}
