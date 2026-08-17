import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeviceCandidateResource, DeviceRuntimeState } from '@/api/tauriApi';
import { useDeviceDiscovery } from './useDeviceDiscovery';
import * as tauriApi from '@/api/tauriApi';

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    identifyDeviceCandidate: vi.fn(),
    registerIdentifiedDevice: vi.fn(),
    scanDeviceCandidates: vi.fn()
  };
});

const registerIdentifiedDeviceMock = vi.mocked(tauriApi.registerIdentifiedDevice);
const scanDeviceCandidatesMock = vi.mocked(tauriApi.scanDeviceCandidates);
const identifyDeviceCandidateMock = vi.mocked(tauriApi.identifyDeviceCandidate);

const identifiedCandidate: DeviceCandidateResource = {
  resourceId: 'serial:/dev/cu.usbmodem143101',
  displayName: 'Raspberry Pi Pico (cu.usbmodem143101)',
  transport: {
    kind: 'serial',
    serialPort: '/dev/cu.usbmodem143101',
    baudRate: 115200
  },
  discoveryStatus: 'identified',
  handshakeInfo: {
    boardId: 'rp2040-pico',
    deviceUid: 'rp2040-pico:0011223344556677',
    firmwareVersion: '0.2.3',
    protocolVersion: 2,
    identityPersistence: 'persisted'
  },
  deviceUid: 'rp2040-pico:0011223344556677',
  matchedDeviceId: null,
  error: null
};

const registeredState: DeviceRuntimeState = {
  deviceId: 'rp2040-pico-0011223344556677',
  deviceUid: 'rp2040-pico:0011223344556677',
  status: 'disconnected',
  boardId: 'rp2040-pico',
  transport: identifiedCandidate.transport,
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

beforeEach(() => {
  identifyDeviceCandidateMock.mockReset();
  registerIdentifiedDeviceMock.mockReset();
  scanDeviceCandidatesMock.mockReset();
  scanDeviceCandidatesMock.mockResolvedValue([]);
  identifyDeviceCandidateMock.mockResolvedValue(identifiedCandidate);
  registerIdentifiedDeviceMock.mockResolvedValue(registeredState);
});

describe('useDeviceDiscovery', () => {
  test('notifies matched registered device after manual identify succeeds', async () => {
    const matchedCandidate: DeviceCandidateResource = {
      ...identifiedCandidate,
      discoveryStatus: 'matched',
      matchedDeviceId: 'rp2040-pico-0011223344556677'
    };
    identifyDeviceCandidateMock.mockResolvedValueOnce(matchedCandidate);
    const onIdentifiedMatchedDevice = vi.fn();
    const { result } = renderHook(() => useDeviceDiscovery({ onIdentifiedMatchedDevice }));

    await act(async () => {
      await result.current.identifyCandidate(identifiedCandidate);
    });

    expect(onIdentifiedMatchedDevice).toHaveBeenCalledWith(matchedCandidate);
  });

  test('does not notify matched registered device after identify returns unregistered device', async () => {
    identifyDeviceCandidateMock.mockResolvedValueOnce(identifiedCandidate);
    const onIdentifiedMatchedDevice = vi.fn();
    const { result } = renderHook(() => useDeviceDiscovery({ onIdentifiedMatchedDevice }));

    await act(async () => {
      await result.current.identifyCandidate(identifiedCandidate);
    });

    expect(onIdentifiedMatchedDevice).not.toHaveBeenCalled();
  });

  test('notifies registered runtime state without waiting for auto connect refresh', async () => {
    const onRegisteredDevice = vi.fn();
    const { result } = renderHook(() => useDeviceDiscovery({ onRegisteredDevice }));

    await act(async () => {
      await result.current.registerCandidate(identifiedCandidate, 'Desk Pico');
    });

    expect(onRegisteredDevice).toHaveBeenCalledWith(registeredState);
  });

  test('keeps registered candidate in discovery list as matched', async () => {
    scanDeviceCandidatesMock.mockResolvedValueOnce([identifiedCandidate]);
    const { result } = renderHook(() => useDeviceDiscovery());

    await act(async () => {
      await result.current.scanCandidates();
    });

    await act(async () => {
      await result.current.registerCandidate(identifiedCandidate, 'Desk Pico');
    });

    expect(result.current.candidates).toEqual([
      expect.objectContaining({
        resourceId: identifiedCandidate.resourceId,
        discoveryStatus: 'matched',
        deviceUid: 'rp2040-pico:0011223344556677',
        matchedDeviceId: 'rp2040-pico-0011223344556677'
      })
    ]);
  });
});
