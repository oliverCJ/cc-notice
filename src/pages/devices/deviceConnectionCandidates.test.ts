import { describe, expect, test } from 'vitest';
import { DeviceCandidateResource, DeviceRuntimeState } from '@/api/tauriApi';
import { connectionCandidatesForDevice } from './DevicesPage';

describe('connectionCandidatesForDevice', () => {
  test('shows unidentified scanned transports for Wio devices that need manual port selection', () => {
    const state = runtimeState({
      deviceId: 'desk-wio',
      boardId: 'seeed-wio-terminal',
      deviceUid: 'seeed-wio-terminal:090645eb5336464e',
      serialPort: '/dev/cu.usbmodem-old'
    });
    const transport = { kind: 'serial' as const, serialPort: '/dev/cu.usbmodem1301', baudRate: 115200 };

    const candidates = connectionCandidatesForDevice(state, [state], [
      candidate({
        resourceId: 'serial:/dev/cu.usbmodem1301',
        displayName: 'Seeed Wio Terminal (cu.usbmodem1301)',
        transport
      })
    ]);

    expect(candidates).toEqual([
      {
        resourceId: 'serial:/dev/cu.usbmodem1301',
        displayName: 'Seeed Wio Terminal (cu.usbmodem1301)',
        transport,
        matchedDeviceId: null
      }
    ]);
  });

  test('hides unidentified scanned transports for rp2040 devices that require matched resources', () => {
    const state = runtimeState({
      deviceId: 'desk-pico',
      boardId: 'rp2040-pico',
      deviceUid: 'rp2040-pico:0011223344556677',
      serialPort: '/dev/cu.usbmodem-old'
    });

    const candidates = connectionCandidatesForDevice(state, [state], [
      candidate({
        resourceId: 'serial:/dev/cu.wio-terminal',
        displayName: 'Seeed Wio Terminal',
        transport: { kind: 'serial', serialPort: '/dev/cu.wio-terminal', baudRate: 115200 }
      })
    ]);

    expect(candidates).toEqual([]);
  });

  test('hides matched transport when it is already the selected device transport', () => {
    const state = runtimeState({
      deviceId: 'desk-pico',
      boardId: 'rp2040-pico',
      deviceUid: 'rp2040-pico:0011223344556677',
      serialPort: '/dev/cu.usbmodem-current'
    });

    const candidates = connectionCandidatesForDevice(state, [state], [
      candidate({
        resourceId: 'serial:/dev/cu.usbmodem-current',
        displayName: 'Current Pico Port',
        transport: { kind: 'serial', serialPort: '/dev/cu.usbmodem-current', baudRate: 115200 },
        matchedDeviceId: 'desk-pico',
        deviceUid: 'rp2040-pico:0011223344556677'
      })
    ]);

    expect(candidates).toEqual([]);
  });

  test('does not treat disconnected stale transports from other devices as occupied', () => {
    const wioState = runtimeState({
      deviceId: 'desk-wio',
      boardId: 'seeed-wio-terminal',
      deviceUid: 'seeed-wio-terminal:090645eb5336464e',
      serialPort: '/dev/cu.usbmodem-old'
    });
    const staleOtherState = {
      ...runtimeState({
        deviceId: 'desk-pico',
        boardId: 'rp2040-pico',
        deviceUid: 'rp2040-pico:0011223344556677',
        serialPort: '/dev/cu.usbmodem1301'
      }),
      status: 'error' as const
    };
    const transport = { kind: 'serial' as const, serialPort: '/dev/cu.usbmodem1301', baudRate: 115200 };

    const candidates = connectionCandidatesForDevice(wioState, [wioState, staleOtherState], [
      candidate({
        resourceId: 'serial:/dev/cu.usbmodem1301',
        displayName: 'Seeed Wio Terminal (cu.usbmodem1301)',
        transport
      })
    ]);

    expect(candidates).toEqual([
      {
        resourceId: 'serial:/dev/cu.usbmodem1301',
        displayName: 'Seeed Wio Terminal (cu.usbmodem1301)',
        transport,
        matchedDeviceId: null
      }
    ]);
  });
});

function runtimeState({
  deviceId,
  boardId,
  deviceUid,
  serialPort
}: {
  deviceId: string;
  boardId: string;
  deviceUid: string | null;
  serialPort: string;
}): DeviceRuntimeState {
  return {
    deviceId,
    deviceUid,
    status: 'disconnected',
    boardId,
    transport: { kind: 'serial', serialPort, baudRate: 115200 },
    channels: [],
    firmwareInfo: null,
    bundledFirmwareVersion: null,
    firmwareStatus: 'unknown',
    firmwareCheckError: null,
    heartbeatStatus: 'unknown',
    lastHeartbeatAt: null,
    heartbeatFailureCount: 0,
    manualReconnectSuppressed: false,
    matchedResourceId: null,
    lastDiscoveredAt: null,
    lastAck: null,
    lastError: null,
    lastSentAt: null
  };
}

function candidate({
  resourceId,
  displayName,
  transport,
  matchedDeviceId = null,
  deviceUid = null
}: {
  resourceId: string;
  displayName: string;
  transport: DeviceCandidateResource['transport'];
  matchedDeviceId?: string | null;
  deviceUid?: string | null;
}): DeviceCandidateResource {
  return {
    resourceId,
    displayName,
    transport,
    discoveryStatus: matchedDeviceId ? 'matched' : 'unidentified',
    handshakeInfo: null,
    deviceUid,
    matchedDeviceId,
    error: null
  };
}
