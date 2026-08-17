import {
  DeviceChannel,
  DeviceChannelActionType,
  DeviceChannelKind,
  DeviceExtensionCapabilities
} from '../../api/tauriApi';
import { getBoardAvailableChannels } from '@/domain/boards/boardCatalog';

export type DeviceSelectOption = {
  value: string;
  label?: string;
  labelKey?: string;
  boardId?: string | null;
  deviceExtensions?: DeviceExtensionCapabilities | null;
  channels?: ChannelSelectOption[];
};

export type ChannelSelectOption = {
  value: string;
  label: string;
  kind: DeviceChannelKind;
  supportedActions: DeviceChannelActionType[];
  hardwareGuideId?: string | null;
  boardId?: string | null;
  sourceChannel?: DeviceChannel | null;
};

export const defaultDeviceOptions: DeviceSelectOption[] = [
  {
    value: 'rp2040-pico-default',
    labelKey: 'rules.deviceChannel.defaultRp2040',
    boardId: 'rp2040-pico'
  }
];

export const defaultChannelOptions: ChannelSelectOption[] = getBoardAvailableChannels('rp2040-pico').map(
  (channel) => toChannelSelectOption(channel, 'rp2040-pico')
);

export type ChannelKindOption = {
  value: DeviceChannelKind;
  labelKey: string;
};

export function buildChannelKindOptions(channels: ChannelSelectOption[]): ChannelKindOption[] {
  const seen = new Set<DeviceChannelKind>();
  return channels.reduce<ChannelKindOption[]>((options, channel) => {
    if (seen.has(channel.kind)) {
      return options;
    }
    seen.add(channel.kind);
    options.push({
      value: channel.kind,
      labelKey: `devices.channelKind.${channel.kind}`
    });
    return options;
  }, []);
}

export function toChannelSelectOption(
  channel: DeviceChannel,
  boardId?: string | null
): ChannelSelectOption {
  return {
    value: channel.id,
    label: formatRuleChannelLabel(channel, boardId),
    kind: channel.kind,
    supportedActions: channel.supportedActions,
    hardwareGuideId: channel.hardwareGuideId,
    boardId,
    sourceChannel: channel
  };
}

export function enrichDeviceChannelsForRule(device: DeviceSelectOption): ChannelSelectOption[] {
  const channels = (device.channels ?? [])
    .filter((channel) => !isHiddenSoftwareChannelKind(channel.kind))
    .map((channel) => {
      if (
        channel.kind === 'buzzer' &&
        device.deviceExtensions?.buzzer?.patterns?.length &&
        !channel.supportedActions.includes('pattern')
      ) {
        return {
          ...channel,
          supportedActions: [...channel.supportedActions, 'pattern' as DeviceChannelActionType]
        };
      }
      return channel;
    });

  if (
    device.deviceExtensions?.display?.status &&
    !channels.some((channel) => channel.value === 'display')
  ) {
    channels.push({
      value: 'display',
      label: '屏幕',
      kind: 'display',
      supportedActions: ['display-status'],
      hardwareGuideId: null,
      boardId: device.boardId ?? null,
      sourceChannel: null
    });
  }

  return channels;
}

function isHiddenSoftwareChannelKind(kind: DeviceChannelKind): boolean {
  return kind === 'pwm-output' || kind === 'addressable-led';
}

function formatRuleChannelLabel(channel: DeviceChannel, boardId?: string | null): string {
  const gpio =
    channel.digitalOutput?.pin ??
    channel.pwmOutput?.pin ??
    channel.buzzer?.pin ??
    channel.addressableLed?.pin ??
    null;
  if (gpio === null || !channel.physicalPin) {
    return channel.label;
  }
  if (!isRp2040Board(boardId)) {
    return channel.label;
  }
  return `GP${gpio} · Pin ${channel.physicalPin}`;
}

function isRp2040Board(boardId?: string | null): boolean {
  return boardId?.startsWith('rp2040-pico') ?? false;
}
