import type {
  DeviceDisplayCapabilities,
  DeviceFirmwareInfo,
  DeviceInstance,
  DeviceRuntimeState,
  DeviceCustomFaceActiveState,
  DeviceCustomFaceStatus,
} from '@/api/tauriApi';
import { getBoardDeviceExtensions } from '@/domain/boards/boardCatalog';
import { resolveDeviceDisplayCapabilities } from '@/domain/devices/deviceDisplayCapabilities';
import { toChannelSelectOption, type ChannelSelectOption } from './deviceChannelOptions';

export type DeviceRuleContext = {
  deviceId: string;
  label: string;
  boardId: string | null;
  connectionStatus: 'connected' | 'offline-config';
  channels: ChannelSelectOption[];
  deviceExtensions: ReturnType<typeof getBoardDeviceExtensions>;
  displayCapabilities: DeviceDisplayCapabilities | null;
  firmwareInfo: DeviceFirmwareInfo | null;
  customFaceStatus: DeviceCustomFaceStatus | null;
  customFaceActive: DeviceCustomFaceActiveState | null;
};

export function buildDeviceRuleContexts(
  configuredDevices: DeviceInstance[],
  runtimeStates: DeviceRuntimeState[] = []
): DeviceRuleContext[] {
  const runtimeByDeviceId = new Map(
    runtimeStates
      .filter((state) => Boolean(state.deviceId))
      .map((state) => [state.deviceId as string, state] as const)
  );

  const configuredById = new Map(
    configuredDevices
      .filter((device) => device.enabled)
      .filter((device) => Boolean(device.id))
      .map((device) => [device.id, device] as const)
  );
  const deviceIds = new Set<string>([
    ...configuredById.keys(),
    ...runtimeByDeviceId.keys(),
  ]);

  return Array.from(deviceIds)
    .map((deviceId) => {
      const configuredDevice = configuredById.get(deviceId) ?? null;
      const runtimeState = runtimeByDeviceId.get(deviceId) ?? null;
      const boardId = runtimeState?.boardId ?? configuredDevice?.boardId ?? null;
      const deviceExtensions = boardId ? getBoardDeviceExtensions(boardId) : null;
      const displayCapabilities = resolveDeviceDisplayCapabilities(boardId, runtimeState);
      const channels =
        configuredDevice?.channels?.length
          ? configuredDevice.channels
          : runtimeState?.channels ?? [];
      return {
        deviceId,
        label: deviceId,
        boardId,
        connectionStatus: runtimeState?.status === 'connected' ? 'connected' : 'offline-config',
        channels: channels.map((channel) => toChannelSelectOption(channel, boardId)),
        deviceExtensions,
        displayCapabilities,
        firmwareInfo: runtimeState?.firmwareInfo ?? null,
        customFaceStatus: runtimeState?.customFaceStatus ?? null,
        customFaceActive: runtimeState?.firmwareInfo?.customFaceActive ?? null,
      } satisfies DeviceRuleContext;
    })
    .sort((left, right) => left.deviceId.localeCompare(right.deviceId, 'zh-CN'));
}
