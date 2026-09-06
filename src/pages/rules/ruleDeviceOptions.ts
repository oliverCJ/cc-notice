import type { DeviceInstance, DeviceRuntimeState } from '@/api/tauriApi';
import { buildDeviceRuleContexts } from './deviceRuleContext';
import type { DeviceSelectOption } from './deviceChannelOptions';

export function buildRuleDeviceOptions(
  configuredDevices: DeviceInstance[],
  runtimeStates: DeviceRuntimeState[] = []
): DeviceSelectOption[] {
  return buildDeviceRuleContexts(configuredDevices, runtimeStates).map((context) => ({
    value: context.deviceId,
    label: context.label,
    connectionStatus: context.connectionStatus,
    boardId: context.boardId,
    deviceExtensions: context.deviceExtensions,
    channels: context.channels,
    ruleContext: context,
  }));
}
