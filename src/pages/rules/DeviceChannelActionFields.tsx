import {
  DeviceChannelActionType,
  DeviceChannelKind,
  DeviceChannelRuleAction
} from '../../api/tauriApi';
import { HardwareGuideButton } from '@/components/hardware-guides/HardwareGuideButton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useI18n } from '@/i18n';
import { AlertCircle, Trash2 } from 'lucide-react';
import {
  ChannelSelectOption,
  DeviceSelectOption,
  buildChannelKindOptions,
  defaultChannelOptions,
  defaultDeviceOptions,
  enrichDeviceChannelsForRule
} from './deviceChannelOptions';
import { defaultParametersForDeviceChannelAction } from './ruleProfileUtils';
import { DeviceChannelActionParameterFields } from './DeviceChannelActionParameterFields';

type DeviceChannelActionFieldsProps = {
  internalEvent: string;
  action: DeviceChannelRuleAction;
  index: number;
  duplicate: boolean;
  canRemove: boolean;
  deviceOptions?: DeviceSelectOption[];
  channelOptions?: ChannelSelectOption[];
  lockIdentityFields?: boolean;
  onChange: (action: DeviceChannelRuleAction) => void;
  onRemove: () => void;
};

export function DeviceChannelActionFields({
  internalEvent,
  action,
  index,
  duplicate,
  canRemove,
  deviceOptions,
  channelOptions = defaultChannelOptions,
  lockIdentityFields = false,
  onChange,
  onRemove
}: DeviceChannelActionFieldsProps) {
  const t = useI18n();
  const actionDomId = `${internalEvent}-${action.id}-${index}`;
  const effectiveDeviceOptions = deviceOptions ?? defaultDeviceOptions;
  const allowBoardCapabilityFallback = deviceOptions === undefined;
  const selectedDeviceId = action.deviceId || effectiveDeviceOptions[0]?.value || 'rp2040-pico-default';
  const selectedDevice =
    effectiveDeviceOptions.find((device) => device.value === selectedDeviceId) ??
    effectiveDeviceOptions[0];
  const selectedDeviceRuleChannels = selectedDevice
    ? enrichDeviceChannelsForRule(selectedDevice)
    : [];
  const effectiveChannelOptions = selectedDeviceRuleChannels.length
    ? selectedDeviceRuleChannels
    : allowBoardCapabilityFallback
      ? channelOptions
      : [];
  const selectedChannel =
    effectiveChannelOptions.find((channel) => channel.value === action.channelId) ??
    effectiveChannelOptions[0];
  const selectedKind = selectedChannel?.kind ?? effectiveChannelOptions[0]?.kind;
  const channelKindOptions = buildChannelKindOptions(effectiveChannelOptions);
  const filteredChannels = effectiveChannelOptions.filter((channel) => channel.kind === selectedKind);
  const actionOptions = selectedChannel?.supportedActions ?? [];
  const selectedAction = resolveAction(action.channelAction, actionOptions);
  const hasChannelOptions = effectiveChannelOptions.length > 0;
  const pinReuseWarning = selectedChannel
    ? findPinReuseWarning(selectedChannel, effectiveChannelOptions)
    : null;

  function updateAction(patch: Partial<DeviceChannelRuleAction>) {
    onChange({
      ...action,
      ...patch
    });
  }

  function updateChannelKind(kind: DeviceChannelKind) {
    const nextChannels = effectiveChannelOptions.filter((channel) => channel.kind === kind);
    const nextChannel = pickCompatibleChannel(nextChannels, selectedChannel, selectedAction);
    const nextAction = pickCompatibleAction(nextChannel, selectedAction);
    updateAction({
      channelId: nextChannel?.value ?? '',
      channelAction: nextAction,
      ...defaultParametersIfActionChanged(action.channelAction, nextAction)
    });
  }

  function updateDevice(deviceId: string) {
    const nextDevice = effectiveDeviceOptions.find((device) => device.value === deviceId);
    const nextDeviceRuleChannels = nextDevice
      ? enrichDeviceChannelsForRule(nextDevice)
      : [];
    const nextChannels = nextDeviceRuleChannels.length
      ? nextDeviceRuleChannels
      : allowBoardCapabilityFallback
        ? channelOptions
        : [];
    const nextChannel = pickCompatibleChannel(nextChannels, selectedChannel, selectedAction);
    const nextAction = pickCompatibleAction(nextChannel, selectedAction);
    updateAction({
      deviceId,
      channelId: nextChannel?.value ?? '',
      channelAction: nextAction,
      ...defaultParametersIfActionChanged(action.channelAction, nextAction)
    });
  }

  function updateChannel(channelId: string) {
    const nextChannel = effectiveChannelOptions.find((channel) => channel.value === channelId);
    const nextAction = pickCompatibleAction(nextChannel, selectedAction);
    updateAction({
      channelId,
      channelAction: nextAction,
      ...defaultParametersIfActionChanged(action.channelAction, nextAction)
    });
  }

  function updateChannelAction(nextAction: DeviceChannelActionType) {
    updateAction({
      channelAction: nextAction,
      ...defaultParametersForDeviceChannelAction(nextAction)
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {t('rules.deviceChannel.actionGroupTitle', { index: index + 1 })}
        </p>
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {duplicate ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('rules.outputRules.validationDuplicateChannelAction')}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`device-${actionDomId}`}>{t('rules.deviceChannel.device')}</Label>
          <Select
            value={selectedDeviceId}
            onValueChange={updateDevice}
            disabled={lockIdentityFields}
          >
            <SelectTrigger id={`device-${actionDomId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {effectiveDeviceOptions.map((device) => (
                <SelectItem key={device.value} value={device.value}>
                  {device.label ?? (device.labelKey ? t(device.labelKey) : device.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`channel-kind-${actionDomId}`}>
            {t('rules.deviceChannel.channelType')}
          </Label>
          <Select
            value={selectedKind ?? ''}
            onValueChange={(value) => updateChannelKind(value as DeviceChannelKind)}
            disabled={lockIdentityFields || !hasChannelOptions}
          >
            <SelectTrigger id={`channel-kind-${actionDomId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channelKindOptions.map((kind) => (
                <SelectItem key={kind.value} value={kind.value}>
                  {t(kind.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`channel-${actionDomId}`}>{t('rules.deviceChannel.channel')}</Label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Select
                value={selectedChannel?.value}
                onValueChange={updateChannel}
                disabled={lockIdentityFields || !hasChannelOptions}
              >
                <SelectTrigger id={`channel-${actionDomId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredChannels.map((channel) => (
                    <SelectItem key={channel.value} value={channel.value}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedChannel ? (
              <HardwareGuideButton
                guideId={selectedChannel.hardwareGuideId}
                boardId={selectedChannel.boardId ?? selectedDevice?.boardId ?? 'rp2040-pico'}
                channelLabel={selectedChannel.label}
                channel={selectedChannel.sourceChannel}
                variant="outline"
              />
            ) : null}
          </div>
          {!hasChannelOptions ? (
            <p className="text-xs text-muted-foreground">
              {t('rules.deviceChannel.noConfiguredChannels')}
            </p>
          ) : null}
          {pinReuseWarning ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('rules.deviceChannel.pinReuseWarning', {
                  channels: pinReuseWarning.reusedBy
                })}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`channel-action-${actionDomId}`}>
            {t('rules.deviceChannel.action')}
          </Label>
          <Select
            value={selectedAction ?? ''}
            onValueChange={(value) => updateChannelAction(value as DeviceChannelActionType)}
            disabled={!hasChannelOptions}
          >
            <SelectTrigger id={`channel-action-${actionDomId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actionOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`rules.deviceChannel.actions.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DeviceChannelActionParameterFields
          action={selectedAction}
          actionDomId={actionDomId}
          value={action}
          displayCapabilities={selectedDevice?.deviceExtensions?.display}
          onChange={updateAction}
        />
      </div>
    </div>
  );
}

function resolveAction(
  action: DeviceChannelActionType | null | undefined,
  supportedActions: DeviceChannelActionType[]
): DeviceChannelActionType | undefined {
  if (action && supportedActions.includes(action)) {
    return action;
  }
  return supportedActions[0];
}

function pickCompatibleChannel(
  nextChannels: ChannelSelectOption[],
  currentChannel: ChannelSelectOption | undefined,
  currentAction: DeviceChannelActionType | undefined
): ChannelSelectOption | undefined {
  if (nextChannels.length === 0) {
    return undefined;
  }

  const currentChannelId = currentChannel?.value;
  const currentKind = currentChannel?.kind;
  const exactChannel = currentChannelId
    ? nextChannels.find((channel) => channel.value === currentChannelId)
    : undefined;
  const sameKindChannels = currentKind
    ? nextChannels.filter((channel) => channel.kind === currentKind)
    : [];

  return (
    findChannelSupportingAction([exactChannel], currentAction) ??
    findChannelSupportingAction(sameKindChannels, currentAction) ??
    exactChannel ??
    sameKindChannels[0] ??
    nextChannels[0]
  );
}

function findChannelSupportingAction(
  channels: Array<ChannelSelectOption | undefined>,
  action: DeviceChannelActionType | undefined
): ChannelSelectOption | undefined {
  if (!action) {
    return undefined;
  }
  return channels.find((channel) => channel?.supportedActions.includes(action));
}

function pickCompatibleAction(
  channel: ChannelSelectOption | undefined,
  currentAction: DeviceChannelActionType | undefined
): DeviceChannelActionType {
  if (currentAction && channel?.supportedActions.includes(currentAction)) {
    return currentAction;
  }
  return channel?.supportedActions[0] ?? currentAction ?? 'activate';
}

function defaultParametersIfActionChanged(
  previousAction: DeviceChannelActionType | null | undefined,
  nextAction: DeviceChannelActionType
): Partial<DeviceChannelRuleAction> {
  if (previousAction === nextAction) {
    return {};
  }
  return defaultParametersForDeviceChannelAction(nextAction);
}

function shouldShowDuration(action: DeviceChannelActionType): boolean {
  return ['activate', 'blink', 'breathe', 'pulse', 'set-duty', 'beep', 'tone', 'set-color'].includes(action);
}

function findPinReuseWarning(
  selectedChannel: ChannelSelectOption,
  channelOptions: ChannelSelectOption[]
): { reusedBy: string } | null {
  const selectedPin = channelHardwarePin(selectedChannel);
  if (selectedPin === null) {
    return null;
  }

  const reusedBy = channelOptions
    .filter((channel) => channel.value !== selectedChannel.value)
    .filter((channel) => channelHardwarePin(channel) === selectedPin)
    .map((channel) => channel.label);

  if (reusedBy.length === 0) {
    return null;
  }

  return { reusedBy: reusedBy.join('、') };
}

function channelHardwarePin(channel: ChannelSelectOption): number | null {
  const source = channel.sourceChannel;
  return (
    source?.digitalOutput?.pin ??
    source?.pwmOutput?.pin ??
    source?.buzzer?.pin ??
    source?.addressableLed?.pin ??
    null
  );
}
