import { renderHook, waitFor } from '@testing-library/react';
import { listen } from '@tauri-apps/api/event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DeviceRuntimeState } from '@/api/tauriApi';
import { DeviceRuntimeRegistryState } from './useDeviceRuntimeRegistry';
import { useDeviceRuntimeAutomation } from './useDeviceRuntimeAutomation';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}));

const listenMock = vi.mocked(listen);
const asyncMock = () => vi.fn().mockResolvedValue(undefined);

const baseRegistry: DeviceRuntimeRegistryState = {
  states: [],
  ports: [],
  inputBindings: [],
  loading: false,
  scanning: false,
  connectingDeviceId: null,
  actionStatus: 'idle',
  error: null,
  upsertDeviceState: vi.fn(),
  refreshStates: asyncMock(),
  autoConnectRegisteredDevices: asyncMock(),
  scanTransports: asyncMock(),
  connectDevice: asyncMock(),
  cancelDeviceOperation: asyncMock(),
  disconnectDevice: asyncMock(),
  disconnectAllDevices: asyncMock(),
  removeRegisteredDevice: asyncMock(),
  pingConnectedDevices: asyncMock(),
  sendTestAction: asyncMock(),
  sendExtensionAction: asyncMock(),
  updateDeviceChannels: asyncMock(),
  refreshInputBindings: asyncMock(),
  saveInputBindings: asyncMock(),
  checkDeviceFirmware: asyncMock(),
  resetDeviceIdentity: asyncMock()
};

function deviceState(
  status: DeviceRuntimeState['status'],
  manualReconnectSuppressed = false
): DeviceRuntimeState {
  return {
    deviceId: 'rp2040-pico-default',
    status,
    boardId: 'rp2040-pico',
    transport: null,
    firmwareInfo: null,
    bundledFirmwareVersion: null,
    firmwareStatus: 'unknown',
    firmwareCheckError: null,
    heartbeatStatus: 'unknown',
    lastHeartbeatAt: null,
    heartbeatFailureCount: 0,
    manualReconnectSuppressed,
    matchedResourceId: null,
    lastDiscoveredAt: null,
    deviceUid: 'rp2040-pico:0011223344556677',
    lastAck: null,
    lastError: null,
    lastSentAt: null,
    channels: []
  };
}

describe('useDeviceRuntimeAutomation', () => {
  beforeEach(() => {
    listenMock.mockReset();
    listenMock.mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('refreshes states without scanning devices from app lifecycle', () => {
    const registry = {
      ...baseRegistry,
      refreshStates: asyncMock(),
      autoConnectRegisteredDevices: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));

    expect(registry.refreshStates).toHaveBeenCalledTimes(1);
    expect(registry.autoConnectRegisteredDevices).not.toHaveBeenCalled();
  });

  test('delays auto connect for reconnectable registered devices', async () => {
    vi.useFakeTimers();
    const registry = {
      ...baseRegistry,
      states: [deviceState('disconnected')],
      autoConnectRegisteredDevices: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));
    vi.advanceTimersByTime(5_000);
    expect(registry.autoConnectRegisteredDevices).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);

    expect(registry.autoConnectRegisteredDevices).toHaveBeenCalledTimes(1);
  });

  test('continues auto connect retries with backoff while device stays reconnectable', async () => {
    vi.useFakeTimers();
    const registry = {
      ...baseRegistry,
      states: [deviceState('disconnected')],
      autoConnectRegisteredDevices: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));

    await vi.advanceTimersByTimeAsync(15_000);
    expect(registry.autoConnectRegisteredDevices).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(29_000);
    expect(registry.autoConnectRegisteredDevices).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(registry.autoConnectRegisteredDevices).toHaveBeenCalledTimes(2);
  });

  test('does not retry auto connect for manually disconnected devices', () => {
    vi.useFakeTimers();
    const registry = {
      ...baseRegistry,
      states: [deviceState('disconnected', true)],
      autoConnectRegisteredDevices: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));
    registry.autoConnectRegisteredDevices.mockClear();

    vi.advanceTimersByTime(5_000);

    expect(registry.autoConnectRegisteredDevices).not.toHaveBeenCalled();
  });

  test('does not retry auto connect while any device operation is running', () => {
    vi.useFakeTimers();
    const registry = {
      ...baseRegistry,
      states: [deviceState('disconnected')],
      connectingDeviceId: 'rp2040-pico-default',
      autoConnectRegisteredDevices: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));
    registry.autoConnectRegisteredDevices.mockClear();

    vi.advanceTimersByTime(5_000);

    expect(registry.autoConnectRegisteredDevices).not.toHaveBeenCalled();
  });

  test('delays heartbeat polling for connected devices', () => {
    vi.useFakeTimers();
    const registry = {
      ...baseRegistry,
      states: [deviceState('connected')],
      pingConnectedDevices: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));

    vi.advanceTimersByTime(5_000);
    expect(registry.pingConnectedDevices).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(registry.pingConnectedDevices).toHaveBeenCalledTimes(1);
  });

  test('refreshes device states when device runtime update event is received', async () => {
    listenMock.mockImplementation(async (_eventName, handler) => {
      handler({ event: 'cc-notice://device-runtime-updated', id: 1, payload: { reason: 'hook-device-output', deviceIds: ['desk-pico'] } });
      return vi.fn();
    });
    const registry = {
      ...baseRegistry,
      refreshStates: asyncMock()
    };

    renderHook(() => useDeviceRuntimeAutomation(registry));

    await waitFor(() => {
      expect(registry.refreshStates).toHaveBeenCalledTimes(2);
    });
    expect(listenMock).toHaveBeenCalledWith(
      'cc-notice://device-runtime-updated',
      expect.any(Function)
    );
  });
});
