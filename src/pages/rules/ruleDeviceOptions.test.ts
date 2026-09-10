import { describe, expect, test } from 'vitest';
import type { DeviceInstance, DeviceRuntimeState } from '@/api/tauriApi';
import { buildRuleDeviceOptions } from './ruleDeviceOptions';

function configuredDevice(deviceId: string, boardId: string): DeviceInstance {
  return {
    id: deviceId,
    label: `设备-${deviceId}`,
    boardId,
    deviceUid: `${deviceId}-uid`,
    transport: {
      kind: 'serial',
      serialPort: `/dev/${deviceId}`,
      baudRate: 115200,
    },
    channels: [
      {
        id: 'display',
        label: '屏幕',
        kind: 'display',
        supportedActions: ['display-face'],
        hardwareGuideId: null,
      },
    ],
    enabled: true,
  };
}

function runtimeState(deviceId: string, status: DeviceRuntimeState['status']): DeviceRuntimeState {
  return {
    deviceId,
    status,
    boardId: 'seeed-wio-terminal',
    transport: null,
    channels: [],
    firmwareInfo: null,
    customFaceStatus: { state: 'unknown', installed: null, errorCode: null },
    bundledFirmwareVersion: null,
    firmwareStatus: 'unknown',
    firmwareCheckError: null,
    heartbeatStatus: 'unknown',
    lastHeartbeatAt: null,
    heartbeatFailureCount: 0,
    manualReconnectSuppressed: false,
    matchedResourceId: null,
    lastDiscoveredAt: null,
    activeOperation: null,
    autoReconnectBlockedUntil: null,
    lastAck: null,
    lastErrorCode: null,
    lastError: null,
    lastSentAt: null,
  };
}

describe('buildRuleDeviceOptions', () => {
  test('includes configured devices even when they are only stored in app config', () => {
    const options = buildRuleDeviceOptions([configuredDevice('desk-wio', 'seeed-wio-terminal')]);

    expect(options).toHaveLength(1);
    expect(options[0]).toBeDefined();
    expect(options[0]!).toMatchObject({
      value: 'desk-wio',
      label: 'desk-wio',
      boardId: 'seeed-wio-terminal',
    });
    expect(options[0]!.deviceExtensions?.display?.face).toBe(true);
    expect(options[0]!.channels).toHaveLength(1);
  });

  test('keeps configured devices available for offline display face filtering', () => {
    const options = buildRuleDeviceOptions([configuredDevice('desk-wio', 'seeed-wio-terminal')]);

    expect(options[0]!.deviceExtensions?.display?.face).toBe(true);
    expect(options[0]!.deviceExtensions?.display?.pixelWidth).toBe(320);
    expect(options[0]!.deviceExtensions?.display?.pixelHeight).toBe(240);
  });

  test('adds online and offline status for configured devices from runtime states', () => {
    const options = buildRuleDeviceOptions(
      [
        configuredDevice('desk-wio', 'seeed-wio-terminal'),
        configuredDevice('desk-pico', 'rp2040-pico'),
      ],
      [runtimeState('desk-wio', 'connected'), runtimeState('desk-pico', 'disconnected')]
    );

    expect(options.find((option) => option.value === 'desk-wio')?.connectionStatus).toBe(
      'connected'
    );
    expect(options.find((option) => option.value === 'desk-pico')?.connectionStatus).toBe(
      'offline-config'
    );
    expect(options.find((option) => option.value === 'desk-wio')?.ruleContext).toMatchObject({
      deviceId: 'desk-wio',
      connectionStatus: 'connected',
    });
  });
});
