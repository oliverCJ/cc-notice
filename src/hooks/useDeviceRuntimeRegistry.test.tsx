import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeviceRuntimeState, DeviceTransportConfig } from '@/api/tauriApi';
import { useDeviceRuntimeRegistry } from './useDeviceRuntimeRegistry';
import * as tauriApi from '@/api/tauriApi';

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    getDeviceRuntimeStates: vi.fn(),
    scanDeviceTransports: vi.fn(),
    autoConnectRegisteredDevices: vi.fn(),
    connectDevice: vi.fn(),
    disconnectDevice: vi.fn(),
    disconnectAllDevices: vi.fn(),
    removeRegisteredDevice: vi.fn(),
    pingConnectedDevices: vi.fn(),
    sendDeviceTestAction: vi.fn(),
    sendDeviceExtensionAction: vi.fn(),
    updateDeviceChannels: vi.fn(),
    checkDeviceFirmware: vi.fn()
  };
});

const getDeviceRuntimeStatesMock = vi.mocked(tauriApi.getDeviceRuntimeStates);
const scanDeviceTransportsMock = vi.mocked(tauriApi.scanDeviceTransports);
const autoConnectRegisteredDevicesMock = vi.mocked(tauriApi.autoConnectRegisteredDevices);
const connectDeviceMock = vi.mocked(tauriApi.connectDevice);
const removeRegisteredDeviceMock = vi.mocked(tauriApi.removeRegisteredDevice);
const pingConnectedDevicesMock = vi.mocked(tauriApi.pingConnectedDevices);
const sendDeviceTestActionMock = vi.mocked(tauriApi.sendDeviceTestAction);
const sendDeviceExtensionActionMock = vi.mocked(tauriApi.sendDeviceExtensionAction);
const updateDeviceChannelsMock = vi.mocked(tauriApi.updateDeviceChannels);
const checkDeviceFirmwareMock = vi.mocked(tauriApi.checkDeviceFirmware);

const connectedState: DeviceRuntimeState = {
  deviceId: 'rp2040-pico-default',
  status: 'connected',
  boardId: 'rp2040-pico',
  transport: {
    kind: 'serial',
    serialPort: 'mock://rp2040-pico-default',
    baudRate: 115200
  },
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
  lastAck: 'ok',
  lastError: null,
  lastSentAt: '2026-06-27T10:00:00+08:00',
  channels: []
};

const disconnectedState: DeviceRuntimeState = {
  ...connectedState,
  status: 'disconnected',
  lastAck: null,
  lastSentAt: null
};

beforeEach(() => {
  getDeviceRuntimeStatesMock.mockReset();
  scanDeviceTransportsMock.mockReset();
  autoConnectRegisteredDevicesMock.mockReset();
  connectDeviceMock.mockReset();
  removeRegisteredDeviceMock.mockReset();
  pingConnectedDevicesMock.mockReset();
  sendDeviceTestActionMock.mockReset();
  sendDeviceExtensionActionMock.mockReset();
  updateDeviceChannelsMock.mockReset();
  checkDeviceFirmwareMock.mockReset();
  getDeviceRuntimeStatesMock.mockResolvedValue([disconnectedState]);
  scanDeviceTransportsMock.mockResolvedValue([]);
  autoConnectRegisteredDevicesMock.mockResolvedValue([connectedState]);
  connectDeviceMock.mockResolvedValue(connectedState);
  removeRegisteredDeviceMock.mockResolvedValue([]);
  pingConnectedDevicesMock.mockResolvedValue([{
    ...connectedState,
    heartbeatStatus: 'healthy',
    lastHeartbeatAt: '2026-06-27T10:00:05+08:00'
  }]);
  sendDeviceTestActionMock.mockResolvedValue({
    deviceId: 'rp2040-pico-default',
    channelId: 'pin.gp2',
    outputType: 'device-channel',
    status: 'sent',
    ack: '{"ok":true}',
    error: null
  });
  sendDeviceExtensionActionMock.mockResolvedValue({
    deviceId: 'rp2040-pico-default',
    channelId: '',
    outputType: 'display',
    status: 'sent',
    ack: '{"ok":true}',
    error: null
  });
  updateDeviceChannelsMock.mockResolvedValue({
    ...connectedState,
    channels: [
      {
        id: 'pin.gp2',
        label: 'GP2',
        kind: 'digital-output',
        physicalPin: 4,
        digitalOutput: {
          pin: 2,
          activeLevel: 'high',
          defaultLevel: 'low',
          allowBlink: true
        },
        pwmOutput: null,
        buzzer: null,
        addressableLed: null,
        supportedActions: ['activate', 'deactivate', 'blink', 'pulse'],
        hardwareGuideId: 'digital-output'
      }
    ]
  });
  checkDeviceFirmwareMock.mockResolvedValue({
    ...connectedState,
    firmwareInfo: {
      boardId: 'rp2040-pico',
      deviceUid: 'rp2040-pico:0011223344556677',
      firmwareVersion: '0.2.1',
      protocolVersion: 2
    },
    bundledFirmwareVersion: '0.2.1',
    firmwareStatus: 'up-to-date'
  });
});

describe('useDeviceRuntimeRegistry', () => {
  test('keeps the latest refresh result when older requests resolve later', async () => {
    let resolveFirst: (states: DeviceRuntimeState[]) => void = () => undefined;
    let resolveSecond: (states: DeviceRuntimeState[]) => void = () => undefined;

    getDeviceRuntimeStatesMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveSecond = resolve;
      }));

    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    act(() => {
      void result.current.refreshStates();
      void result.current.refreshStates();
    });

    await act(async () => {
      resolveSecond([connectedState]);
    });

    await waitFor(() => expect(result.current.states[0]?.status).toBe('connected'));

    await act(async () => {
      resolveFirst([disconnectedState]);
    });

    expect(result.current.states[0]?.status).toBe('connected');
  });

  test('skips test action for disconnected devices without calling backend', async () => {
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.refreshStates();
    });

    await act(async () => {
      await result.current.sendTestAction({
        deviceId: 'rp2040-pico-default',
        channelId: 'pin.gp2',
        action: 'activate',
        durationMs: 1000,
        intervalMs: null,
        priority: 50
      });
    });

    expect(sendDeviceTestActionMock).not.toHaveBeenCalled();
    expect(result.current.actionStatus).toBe('skipped');
  });

  test('sends device extension action for connected devices', async () => {
    getDeviceRuntimeStatesMock.mockResolvedValue([connectedState]);
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.refreshStates();
    });

    await act(async () => {
      await result.current.sendExtensionAction({
        deviceId: 'rp2040-pico-default',
        action: 'display-status',
        status: 'success',
        title: 'Done',
        message: 'Build passed'
      });
    });

    expect(sendDeviceExtensionActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'rp2040-pico-default',
        action: 'display-status',
        status: 'success'
      })
    );
    expect(result.current.actionStatus).toBe('sent');
  });

  test('updates device channels and merges returned runtime state', async () => {
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.updateDeviceChannels('rp2040-pico-default', [
        {
          id: 'pin.gp2',
          label: 'GP2',
          kind: 'digital-output',
          physicalPin: 4,
          digitalOutput: {
            pin: 2,
            activeLevel: 'high',
            defaultLevel: 'low',
            allowBlink: true
          },
          pwmOutput: null,
          buzzer: null,
          addressableLed: null,
          supportedActions: ['activate', 'deactivate', 'blink', 'pulse'],
          hardwareGuideId: 'digital-output'
        }
      ]);
    });

    expect(updateDeviceChannelsMock).toHaveBeenCalledWith(
      'rp2040-pico-default',
      expect.arrayContaining([expect.objectContaining({ id: 'pin.gp2' })])
    );
    expect(result.current.states[0]?.channels[0]?.id).toBe('pin.gp2');
  });

  test('connects selected device with explicit transport config', async () => {
    const selectedTransport: DeviceTransportConfig = {
      kind: 'serial',
      serialPort: '/dev/cu.usbmodem143101',
      baudRate: 115200
    };
    connectDeviceMock.mockResolvedValue({
      ...connectedState,
      transport: selectedTransport
    });
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.connectDevice('rp2040-pico-default', selectedTransport);
    });

    expect(connectDeviceMock).toHaveBeenCalledWith('rp2040-pico-default', selectedTransport);
    expect(result.current.states[0]?.transport?.serialPort).toBe('/dev/cu.usbmodem143101');
  });

  test('marks connect failures as connection scoped errors', async () => {
    connectDeviceMock.mockRejectedValueOnce('Device or resource busy');
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.connectDevice('rp2040-pico-default');
    });

    expect(result.current.error).toEqual({
      message: 'Device or resource busy',
      scope: 'connection'
    });
  });

  test('auto connects registered devices and replaces runtime states', async () => {
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.autoConnectRegisteredDevices();
    });

    expect(autoConnectRegisteredDevicesMock).toHaveBeenCalledTimes(1);
    expect(result.current.states[0]?.status).toBe('connected');
  });

  test('marks auto connect failures as device access scoped errors', async () => {
    autoConnectRegisteredDevicesMock.mockRejectedValueOnce('scan failed');
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.autoConnectRegisteredDevices();
    });

    expect(result.current.error).toEqual({
      message: 'scan failed',
      scope: 'device-access'
    });
  });

  test('keeps auto connect result when an older refresh resolves later', async () => {
    let resolveRefresh: (states: DeviceRuntimeState[]) => void = () => undefined;
    getDeviceRuntimeStatesMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveRefresh = resolve;
    }));
    autoConnectRegisteredDevicesMock.mockResolvedValueOnce([connectedState]);
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    act(() => {
      void result.current.refreshStates();
      void result.current.autoConnectRegisteredDevices();
    });

    await waitFor(() => expect(result.current.states[0]?.status).toBe('connected'));

    await act(async () => {
      resolveRefresh([disconnectedState]);
    });

    expect(result.current.states[0]?.status).toBe('connected');
  });

  test('keeps pending auto connect result when heartbeat resolves first', async () => {
    let resolveAutoConnect: (states: DeviceRuntimeState[]) => void = () => undefined;
    autoConnectRegisteredDevicesMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveAutoConnect = resolve;
    }));
    pingConnectedDevicesMock.mockResolvedValueOnce([connectedState]);
    const nextConnectedState = {
      ...connectedState,
      transport: {
        kind: 'serial' as const,
        serialPort: 'mock://new-port'
      }
    };
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.refreshStates();
    });

    act(() => {
      void result.current.autoConnectRegisteredDevices();
      void result.current.pingConnectedDevices();
    });

    await waitFor(() => expect(result.current.states[0]?.transport?.serialPort).toBe('mock://rp2040-pico-default'));

    await act(async () => {
      resolveAutoConnect([nextConnectedState]);
    });

    expect(result.current.states[0]?.transport?.serialPort).toBe('mock://new-port');
  });

  test('removes registered device and replaces runtime states', async () => {
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.removeRegisteredDevice('rp2040-pico-default');
    });

    expect(removeRegisteredDeviceMock).toHaveBeenCalledWith('rp2040-pico-default');
    expect(result.current.states).toEqual([]);
  });

  test('converts referenced-device removal failure into a structured runtime error', async () => {
    removeRegisteredDeviceMock.mockRejectedValueOnce(
      'device rp2040-pico-default is used by output rule agent-running-device-channel-output'
    );
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.removeRegisteredDevice('rp2040-pico-default');
    });

    expect(result.current.error).toEqual({
      code: 'device-referenced-by-output-rule',
      message: 'device rp2040-pico-default is used by output rule agent-running-device-channel-output',
      deviceId: 'rp2040-pico-default',
      ruleId: 'agent-running-device-channel-output',
      scope: 'removal'
    });
  });

  test('converts referenced-channel update failure into a structured runtime error', async () => {
    updateDeviceChannelsMock.mockRejectedValueOnce(
      'device channel pin.gp2 is used by output rule agent-running-device-channel-output'
    );
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.updateDeviceChannels('rp2040-pico-default', []);
    });

    expect(result.current.error).toEqual({
      code: 'device-channel-referenced-by-output-rule',
      message: 'device channel pin.gp2 is used by output rule agent-running-device-channel-output',
      channelId: 'pin.gp2',
      ruleId: 'agent-running-device-channel-output',
      scope: 'runtime'
    });
  });

  test('pings connected devices and updates heartbeat state', async () => {
    const { result } = renderHook(() => useDeviceRuntimeRegistry());

    await act(async () => {
      await result.current.refreshStates();
    });

    await act(async () => {
      await result.current.pingConnectedDevices();
    });

    expect(pingConnectedDevicesMock).toHaveBeenCalledTimes(1);
    expect(result.current.states[0]?.heartbeatStatus).toBe('healthy');
  });
});
