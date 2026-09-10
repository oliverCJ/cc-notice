import { describe, expect, test } from 'vitest';
import type { DeviceInstance, DeviceRuntimeState } from '@/api/tauriApi';
import { buildDeviceRuleContexts } from './deviceRuleContext';

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
    channels: [],
    enabled: true,
  };
}

function runtimeState(deviceId: string): DeviceRuntimeState {
  return {
    deviceId,
    status: 'connected',
    boardId: 'seeed-wio-terminal',
    transport: null,
    channels: [],
    firmwareInfo: {
      boardId: 'seeed-wio-terminal',
      deviceUid: `${deviceId}-uid`,
      firmwareVersion: '0.2.1',
      protocolVersion: 2,
      customFace: {
        protocolVersion: 2,
        profileCode: 3,
        pixelWidth: 320,
        pixelHeight: 240,
        maxFaces: 15,
        maxFramesPerFace: 10,
        maxGroupBytes: 393216,
        chunkBytes: 512,
        incrementalUpdate: true,
      },
      customFaceError: null,
      customFaceActive: {
        source: 'custom',
        groupId: 'custom-group-a',
      },
    },
    customFaceStatus: {
      state: 'installed',
      installed: {
        profileCode: 3,
        groupId: 'custom-group-a',
        groupRuntimeHash: 'hash-a',
        defaultFaceId: 'face-a',
        faceCount: 1,
        encodedBytes: 1463,
      },
      errorCode: null,
      lastConfirmedAt: '2026-09-06T00:00:00Z',
    },
    bundledFirmwareVersion: null,
    firmwareStatus: 'up-to-date',
    firmwareCheckError: null,
    heartbeatStatus: 'healthy',
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

describe('buildDeviceRuleContexts', () => {
  test('merges runtime capabilities into the in-memory rule context', () => {
    const contexts = buildDeviceRuleContexts(
      [configuredDevice('desk-wio', 'seeed-wio-terminal')],
      [runtimeState('desk-wio')]
    );

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      deviceId: 'desk-wio',
      connectionStatus: 'connected',
      deviceExtensions: expect.objectContaining({
        display: expect.objectContaining({
          face: true,
          pixelWidth: 320,
          pixelHeight: 240,
        }),
      }),
      firmwareInfo: expect.objectContaining({
        customFace: expect.objectContaining({
          pixelWidth: 320,
          pixelHeight: 240,
        }),
      }),
      customFaceStatus: expect.objectContaining({
        state: 'installed',
      }),
    });
  });

  test('falls back to runtime custom face capability when board display metadata is missing', () => {
    const contexts = buildDeviceRuleContexts(
      [
        {
          ...configuredDevice('mystery-device', 'unknown-board'),
          boardId: 'unknown-board',
        },
      ],
      [runtimeState('mystery-device')]
    );

    expect(contexts[0]?.displayCapabilities).toMatchObject({
      face: true,
      pixelWidth: 320,
      pixelHeight: 240,
    });
  });

  test('uses runtime custom face capability as the display fallback when the board catalog is unknown', () => {
    const contexts = buildDeviceRuleContexts(
      [
        {
          ...configuredDevice('runtime-only-device', 'unknown-board'),
          boardId: 'unknown-board',
        },
      ],
      [
        {
          ...runtimeState('runtime-only-device'),
          boardId: 'unknown-board',
          firmwareInfo: {
            boardId: 'unknown-board',
            deviceUid: 'runtime-only-device-uid',
            firmwareVersion: '0.2.1',
            protocolVersion: 2,
            customFace: {
              protocolVersion: 2,
              profileCode: 3,
              pixelWidth: 320,
              pixelHeight: 240,
              maxFaces: 15,
              maxFramesPerFace: 10,
              maxGroupBytes: 393216,
              chunkBytes: 512,
              incrementalUpdate: true,
            },
            customFaceError: null,
            customFaceActive: {
              source: 'custom',
              groupId: 'custom-group-a',
            },
          },
        },
      ]
    );

    expect(contexts[0]?.displayCapabilities).toMatchObject({
      face: true,
      pixelWidth: 320,
      pixelHeight: 240,
    });
  });

  test('resolves custom profile board ids as display capabilities while offline', () => {
    const contexts = buildDeviceRuleContexts(
      [
        {
          ...configuredDevice('custom-profile-device', 'custom-320x240-v1'),
          boardId: 'custom-320x240-v1',
        },
      ],
      []
    );

    expect(contexts[0]?.displayCapabilities).toMatchObject({
      face: true,
      pixelWidth: 320,
      pixelHeight: 240,
    });
  });

  test('includes runtime-only connected screen devices in the rule context', () => {
    const contexts = buildDeviceRuleContexts([], [runtimeState('runtime-screen-device')]);

    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({
      deviceId: 'runtime-screen-device',
      connectionStatus: 'connected',
      displayCapabilities: expect.objectContaining({
        face: true,
        pixelWidth: 320,
        pixelHeight: 240,
      }),
    });
  });
});
