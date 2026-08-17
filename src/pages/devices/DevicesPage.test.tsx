import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import * as useDeviceDiscoveryModule from '@/hooks/useDeviceDiscovery';
import { DevicesPage } from './DevicesPage';
import { DeviceRuntimeRegistryState } from '@/hooks/useDeviceRuntimeRegistry';
import { DeviceDiscoveryState } from '@/hooks/useDeviceDiscovery';
import { DeviceCandidateResource } from '@/api/tauriApi';
import { getBoardAvailableChannels } from '@/domain/boards/boardCatalog';

const tauriEventHandlers = vi.hoisted(
  () => new Map<string, (event: { payload: unknown }) => void>()
);

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, handler: (event: { payload: unknown }) => void) => {
    tauriEventHandlers.set(eventName, handler);
    return Promise.resolve(() => {
      tauriEventHandlers.delete(eventName);
    });
  })
}));

const registryState: DeviceRuntimeRegistryState = {
  states: [
    {
      deviceId: 'rp2040-pico-default',
      status: 'disconnected',
      boardId: 'rp2040-pico',
      transport: {
        kind: 'serial',
        serialPort: 'mock://rp2040-pico-default',
        baudRate: 115200
      },
      channels: [
        {
          id: 'pin.gp2',
          label: 'GP2',
          kind: 'digital-output',
          description: 'GPIO 2',
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
      ],
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
    },
    {
      deviceId: 'rp2040-pico-lab',
      status: 'connected',
      boardId: 'rp2040-pico',
      transport: {
        kind: 'serial',
        serialPort: '/dev/tty.usbmodem1101',
        baudRate: 115200
      },
      channels: [
        {
          id: 'pin.gp28',
          label: 'GP28',
          kind: 'digital-output',
          description: 'GPIO 28',
          physicalPin: 34,
          digitalOutput: {
            pin: 28,
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
      ],
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
      lastAck: 'ack:pin.gp2',
      lastError: null,
      lastSentAt: '2026-06-27T10:00:00+08:00'
    }
  ],
  ports: [
    {
      id: 'mock://rp2040-pico-default',
      displayName: 'RP2040 Mock',
      transportKind: 'serial',
      address: 'mock://rp2040-pico-default'
    }
  ],
  inputBindings: [],
  loading: false,
  scanning: false,
  connectingDeviceId: null,
  actionStatus: 'idle',
  error: null,
  upsertDeviceState: vi.fn(),
  refreshStates: vi.fn(),
  autoConnectRegisteredDevices: vi.fn(),
  scanTransports: vi.fn(),
  connectDevice: vi.fn(),
  cancelDeviceOperation: vi.fn(),
  disconnectDevice: vi.fn(),
  disconnectAllDevices: vi.fn(),
  removeRegisteredDevice: vi.fn(),
  pingConnectedDevices: vi.fn(),
  sendTestAction: vi.fn(),
  sendExtensionAction: vi.fn(),
  updateDeviceChannels: vi.fn(),
  refreshInputBindings: vi.fn(),
  saveInputBindings: vi.fn(),
  checkDeviceFirmware: vi.fn(),
  resetDeviceIdentity: vi.fn()
};

const discoveryState: DeviceDiscoveryState = {
  candidates: [],
  scanning: false,
  identifyingResourceId: null,
  registeringResourceId: null,
  error: null,
  scanCandidates: vi.fn(),
  identifyCandidate: vi.fn(),
  registerCandidate: vi.fn()
};

vi.mock('@/hooks/useDeviceDiscovery', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useDeviceDiscovery')>(
    '@/hooks/useDeviceDiscovery'
  );
  return {
    ...actual,
    useDeviceDiscovery: vi.fn(() => discoveryState)
  };
});

describe('DevicesPage', () => {
  test('uses generic device management description instead of board-specific copy', () => {
    renderDevicesPage();

    expect(
      screen.getByText('管理多个硬件设备、传输连接、设备通道和测试动作。')
    ).toBeInTheDocument();
    expect(screen.queryByText(/当前板卡 RP2040 Pico/)).not.toBeInTheDocument();
    expect(screen.queryByText(/rp2040-pico\.uf2/)).not.toBeInTheDocument();
  });

  test('shows multiple device states and selected device channels', () => {
    renderDevicesPage();

    expect(screen.getByText('rp2040-pico-default')).toBeInTheDocument();
    expect(screen.getByText('rp2040-pico-lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'rp2040-pico-default rp2040-pico' })).toHaveAttribute(
      'title',
      'rp2040-pico-default'
    );
    expect(screen.getByRole('cell', { name: 'GP2' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'GP2 · Pin 4' })).toBeInTheDocument();
    expect(screen.getByText('按当前设备能力展示可用通道。通道类型、针脚和电平语义由板卡能力配置维护。')).toBeInTheDocument();
    expect(screen.queryByText(/默认 RP2040 Pico 数字输出通道/)).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'GP28' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'rp2040-pico-lab rp2040-pico' }));

    expect(screen.getByRole('cell', { name: 'GP28' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'GP2' })).not.toBeInTheDocument();
  });

  test('calls candidate scan from discovery action', () => {
    renderDevicesPage();

    fireEvent.click(screen.getByRole('button', { name: '扫描设备资源' }));

    expect(discoveryState.scanCandidates).toHaveBeenCalledTimes(1);
  });

  test('wires newly registered devices into the runtime instance list', () => {
    const upsertDeviceState = vi.fn();
    renderDevicesPage({
      ...registryState,
      upsertDeviceState
    });

    expect(useDeviceDiscoveryModule.useDeviceDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({
        onRegisteredDevice: upsertDeviceState
      })
    );
  });

  test('connects disconnected registered device after manual identify matches it', () => {
    const connectDevice = vi.fn();
    const matchedTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/cu.usbmodem-new',
      baudRate: 115200
    };
    const matchedCandidate: DeviceCandidateResource = {
      resourceId: 'serial:/dev/cu.usbmodem-new',
      displayName: 'Matched Pico',
      transport: matchedTransport,
      discoveryStatus: 'matched',
      handshakeInfo: null,
      deviceUid: 'rp2040-pico:0011223344556677',
      matchedDeviceId: 'rp2040-pico-default',
      error: null
    };

    renderDevicesPage({
      ...registryState,
      connectDevice
    });
    const discoveryCalls = vi.mocked(useDeviceDiscoveryModule.useDeviceDiscovery).mock.calls;
    const discoveryOptions = discoveryCalls[discoveryCalls.length - 1]?.[0] as {
      onIdentifiedMatchedDevice?: (candidate: DeviceCandidateResource) => void;
    };

    act(() => {
      discoveryOptions.onIdentifiedMatchedDevice?.(matchedCandidate);
    });

    expect(connectDevice).toHaveBeenCalledWith('rp2040-pico-default', matchedTransport);
  });

  test('does not reconnect registered device after manual identify when it is already connected', () => {
    const connectDevice = vi.fn();
    const matchedCandidate: DeviceCandidateResource = {
      resourceId: 'serial:/dev/tty.usbmodem1101',
      displayName: 'Matched Pico Lab',
      transport: {
        kind: 'serial',
        serialPort: '/dev/tty.usbmodem1101',
        baudRate: 115200
      },
      discoveryStatus: 'matched',
      handshakeInfo: null,
      deviceUid: 'rp2040-pico:lab',
      matchedDeviceId: 'rp2040-pico-lab',
      error: null
    };

    renderDevicesPage({
      ...registryState,
      connectDevice
    });
    const discoveryCalls = vi.mocked(useDeviceDiscoveryModule.useDeviceDiscovery).mock.calls;
    const discoveryOptions = discoveryCalls[discoveryCalls.length - 1]?.[0] as {
      onIdentifiedMatchedDevice?: (candidate: DeviceCandidateResource) => void;
    };

    act(() => {
      discoveryOptions.onIdentifiedMatchedDevice?.(matchedCandidate);
    });

    expect(connectDevice).not.toHaveBeenCalled();
  });

  test('separates manual discovery from selected device connection controls', () => {
    renderDevicesPage();

    expect(screen.getByRole('button', { name: '扫描设备资源' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '连接当前设备' })).toBeInTheDocument();
  });

  test('connects selected registered device through its saved transport', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      connectDevice: vi.fn()
    };
    renderDevicesPage(stateWithConnectAction);

    fireEvent.click(screen.getByRole('button', { name: '连接当前设备' }));

    expect(stateWithConnectAction.connectDevice).toHaveBeenCalledWith('rp2040-pico-default');
  });

  test('connects selected registered device through latest matched scanned transport', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      connectDevice: vi.fn()
    };
    const latestTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/cu.usbmodem-new',
      baudRate: 115200
    };
    renderDevicesPage(stateWithConnectAction, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.usbmodem-new',
          displayName: 'Pico',
          transport: latestTransport,
          discoveryStatus: 'matched',
          handshakeInfo: null,
          deviceUid: 'rp2040-pico:0011223344556677',
          matchedDeviceId: 'rp2040-pico-default',
          error: null
        }
      ]
    });

    fireEvent.click(screen.getByRole('button', { name: '连接当前设备' }));

    expect(stateWithConnectAction.connectDevice).toHaveBeenCalledWith(
      'rp2040-pico-default',
      latestTransport
    );
  });

  test('lets manual fallback devices connect through a chosen unoccupied scanned transport', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-nano',
          boardId: 'arduino-nano',
          deviceUid: null
        },
        registryState.states[1]
      ],
      connectDevice: vi.fn()
    };
    const selectedTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/cu.usbmodem-selected',
      baudRate: 115200
    };
    renderDevicesPage(stateWithConnectAction, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.usbmodem-selected',
          displayName: 'Candidate Nano',
          transport: selectedTransport,
          discoveryStatus: 'unidentified',
          handshakeInfo: null,
          deviceUid: null,
          matchedDeviceId: null,
          error: null
        },
        {
          resourceId: 'serial:/dev/tty.usbmodem1101',
          displayName: 'Other registered Pico',
          transport: {
            kind: 'serial',
            serialPort: '/dev/tty.usbmodem1101',
            baudRate: 115200
          },
          discoveryStatus: 'matched',
          handshakeInfo: null,
          deviceUid: 'rp2040-pico:other',
          matchedDeviceId: 'rp2040-pico-lab',
          error: null
        }
      ]
    });

    const connectionPanel = screen.getByTestId('device-connection-controls');

    expect(within(connectionPanel).getByText('Candidate Nano')).toBeInTheDocument();
    expect(within(connectionPanel).queryByText('Other registered Pico')).not.toBeInTheDocument();
    fireEvent.click(within(connectionPanel).getByRole('button', { name: 'Candidate Nano' }));
    fireEvent.click(within(connectionPanel).getByRole('button', { name: '连接当前设备' }));

    expect(stateWithConnectAction.connectDevice).toHaveBeenCalledWith(
      'desk-nano',
      selectedTransport
    );
  });

  test('hides unidentified scanned transports for rp2040 devices that require matched resources', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      states: registryState.states.map((state) =>
        state.deviceId === 'rp2040-pico-default'
          ? {
              ...state,
              deviceUid: 'rp2040-pico:0011223344556677'
            }
          : state
      ),
      connectDevice: vi.fn()
    };
    renderDevicesPage(stateWithConnectAction, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.wio-terminal',
          displayName: 'Seeed Wio Terminal',
          transport: {
            kind: 'serial',
            serialPort: '/dev/cu.wio-terminal',
            baudRate: 115200
          },
          discoveryStatus: 'unidentified',
          handshakeInfo: null,
          deviceUid: null,
          matchedDeviceId: null,
          error: null
        }
      ]
    });

    const connectionPanel = screen.getByTestId('device-connection-controls');

    expect(within(connectionPanel).queryByText('Seeed Wio Terminal')).not.toBeInTheDocument();
    fireEvent.click(within(connectionPanel).getByRole('button', { name: '连接当前设备' }));
    expect(stateWithConnectAction.connectDevice).toHaveBeenCalledWith('rp2040-pico-default');
  });

  test('shows unidentified scanned transports for Wio devices that need manual port selection', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          boardId: 'seeed-wio-terminal',
          deviceUid: 'seeed-wio-terminal:090645eb5336464e',
          transport: {
            kind: 'serial',
            serialPort: '/dev/cu.usbmodem-old',
            baudRate: 115200
          }
        }
      ],
      connectDevice: vi.fn()
    };
    const newTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/cu.usbmodem1301',
      baudRate: 115200
    };
    renderDevicesPage(stateWithConnectAction, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.usbmodem1301',
          displayName: 'Seeed Wio Terminal (cu.usbmodem1301)',
          transport: newTransport,
          discoveryStatus: 'unidentified',
          handshakeInfo: null,
          deviceUid: null,
          matchedDeviceId: null,
          error: null
        }
      ]
    });

    const connectionPanel = screen.getByTestId('device-connection-controls');

    expect(within(connectionPanel).getByText('Seeed Wio Terminal (cu.usbmodem1301)')).toBeInTheDocument();
    fireEvent.click(
      within(connectionPanel).getByRole('button', { name: 'Seeed Wio Terminal (cu.usbmodem1301)' })
    );
    fireEvent.click(within(connectionPanel).getByRole('button', { name: '连接当前设备' }));
    expect(stateWithConnectAction.connectDevice).toHaveBeenCalledWith('desk-wio', newTransport);
  });

  test('hides matched transport when it is already the selected device transport', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      states: registryState.states.map((state) =>
        state.deviceId === 'rp2040-pico-default'
          ? {
              ...state,
              deviceUid: 'rp2040-pico:0011223344556677',
              transport: {
                kind: 'serial',
                serialPort: '/dev/cu.usbmodem-current',
                baudRate: 115200
              }
            }
          : state
      ),
      connectDevice: vi.fn()
    };
    renderDevicesPage(stateWithConnectAction, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.usbmodem-current',
          displayName: 'Current Pico Port',
          transport: {
            kind: 'serial',
            serialPort: '/dev/cu.usbmodem-current',
            baudRate: 115200
          },
          discoveryStatus: 'matched',
          handshakeInfo: null,
          deviceUid: 'rp2040-pico:0011223344556677',
          matchedDeviceId: 'rp2040-pico-default',
          error: null
        }
      ]
    });

    const connectionPanel = screen.getByTestId('device-connection-controls');

    expect(within(connectionPanel).queryByText('Current Pico Port')).not.toBeInTheDocument();
  });

  test('keeps current device stable uid matched transport even when another device has stale saved port', () => {
    const stateWithConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      connectDevice: vi.fn()
    };
    const matchedTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/tty.usbmodem1101',
      baudRate: 115200
    };
    renderDevicesPage(stateWithConnectAction, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/tty.usbmodem1101',
          displayName: 'Current Device New Port',
          transport: matchedTransport,
          discoveryStatus: 'matched',
          handshakeInfo: null,
          deviceUid: 'rp2040-pico:0011223344556677',
          matchedDeviceId: 'rp2040-pico-default',
          error: null
        }
      ]
    });

    const connectionPanel = screen.getByTestId('device-connection-controls');

    expect(within(connectionPanel).getByText('Current Device New Port')).toBeInTheDocument();
    fireEvent.click(within(connectionPanel).getByRole('button', { name: '连接当前设备' }));
    expect(stateWithConnectAction.connectDevice).toHaveBeenCalledWith(
      'rp2040-pico-default',
      matchedTransport
    );
  });

  test('auto connects registered devices from connection controls', () => {
    const stateWithAutoConnectAction: DeviceRuntimeRegistryState = {
      ...registryState,
      autoConnectRegisteredDevices: vi.fn()
    };
    renderDevicesPage(stateWithAutoConnectAction);

    fireEvent.click(screen.getByRole('button', { name: '自动连接已注册设备' }));

    expect(stateWithAutoConnectAction.autoConnectRegisteredDevices).toHaveBeenCalled();
  });

  test('does not show auto connect action in selected device connection controls', () => {
    renderDevicesPage();

    const connectionPanel = screen.getByTestId('device-connection-controls');

    expect(within(connectionPanel).queryByRole('button', { name: '自动连接已注册设备' })).not.toBeInTheDocument();
  });

  test('shows connection errors near connection management instead of runtime status', () => {
    renderDevicesPage({
      ...registryState,
      error: {
        message: 'Device or resource busy',
        scope: 'connection'
      }
    });

    const connectionPanel = screen.getByTestId('device-connection-controls');
    expect(within(connectionPanel).getByText('连接操作失败')).toBeInTheDocument();
    expect(within(connectionPanel).getByText('Device or resource busy')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('device-runtime-status-panel')).queryByText('Device or resource busy')
    ).not.toBeInTheDocument();
  });

  test('shows auto connect errors near device discovery actions', () => {
    renderDevicesPage({
      ...registryState,
      error: {
        message: 'scan failed',
        scope: 'device-access'
      }
    });

    const discoveryPanel = screen.getByTestId('device-discovery-panel');
    expect(within(discoveryPanel).getByText('自动连接失败')).toBeInTheDocument();
    expect(within(discoveryPanel).getByText('scan failed')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('device-connection-controls')).queryByText('scan failed')
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('device-runtime-status-panel')).queryByText('scan failed')
    ).not.toBeInTheDocument();
  });

  test('removes selected registered device from the list action', () => {
    const stateWithRemoveAction: DeviceRuntimeRegistryState = {
      ...registryState,
      removeRegisteredDevice: vi.fn()
    };
    renderDevicesPage(stateWithRemoveAction);

    fireEvent.click(screen.getByRole('button', { name: '移除设备 rp2040-pico-default' }));
    expect(stateWithRemoveAction.removeRegisteredDevice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认移除' }));

    expect(stateWithRemoveAction.removeRegisteredDevice).toHaveBeenCalledWith('rp2040-pico-default');
  });

  test('shows friendly referenced-device removal error with rules navigation action', () => {
    const openRules = vi.fn();
    renderDevicesPage(
      {
        ...registryState,
        error: {
          code: 'device-referenced-by-output-rule',
          message: 'device rp2040-pico-default is used by output rule agent-running-device-channel-output',
          deviceId: 'rp2040-pico-default',
          ruleId: 'agent-running-device-channel-output'
        }
      },
      discoveryState,
      openRules
    );

    const deviceListPanel = screen.getByTestId('device-list-panel');
    expect(within(deviceListPanel).getByText('设备正在被输出规则引用，不能移除。')).toBeInTheDocument();
    expect(within(deviceListPanel).getByText('引用规则：agent-running-device-channel-output')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('device-runtime-status-panel')).queryByText(
        '设备正在被输出规则引用，不能移除。'
      )
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '前往 AI 事件映射' }));

    expect(openRules).toHaveBeenCalledTimes(1);
  });

  test('shows referenced-channel mode switch error near the device channel table', () => {
    const openRules = vi.fn();
    renderDevicesPage(
      {
        ...registryState,
        error: {
          code: 'device-channel-referenced-by-output-rule',
          message: 'device channel pin.gp2 is used by output rule agent-running-device-channel-output',
          channelId: 'pin.gp2',
          ruleId: 'agent-running-device-channel-output',
          scope: 'runtime'
        } as never
      },
      discoveryState,
      openRules
    );

    const deviceListPanel = screen.getByTestId('device-list-panel');
    const channelPanel = screen.getByTestId('device-channel-panel');
    expect(within(deviceListPanel).queryByText('设备正在被输出规则引用，不能移除。')).not.toBeInTheDocument();
    expect(within(channelPanel).getByText('通道正在被输出规则引用，不能切换为输入。')).toBeInTheDocument();
    expect(within(channelPanel).getByText('通道：pin.gp2')).toBeInTheDocument();
    expect(within(channelPanel).getByText('引用规则：agent-running-device-channel-output')).toBeInTheDocument();

    fireEvent.click(within(channelPanel).getByRole('button', { name: '前往 AI 事件映射' }));

    expect(openRules).toHaveBeenCalledTimes(1);
  });

  test('shows matched candidate without allowing duplicate registration', () => {
    renderDevicesPage(registryState, {
      ...discoveryState,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.usbmodem1101',
          displayName: 'Pico',
          transport: {
            kind: 'serial',
            serialPort: '/dev/cu.usbmodem1101',
            baudRate: 115200
          },
          discoveryStatus: 'matched',
          handshakeInfo: null,
          deviceUid: 'rp2040-pico:0011223344556677',
          matchedDeviceId: 'rp2040-pico-lab',
          error: null
        }
      ],
      identifyCandidate: vi.fn(),
      registerCandidate: vi.fn()
    });

    expect(screen.getByText('已匹配设备：rp2040-pico-lab')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '识别设备' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '注册设备' })).toBeDisabled();
  });

  test('persists added device channels through registry actions', () => {
    renderDevicesPage();

    fireEvent.click(screen.getByRole('combobox', { name: '新增通道' }));
    expect(screen.queryByRole('option', { name: /GP15 .*数字输出/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /PWM 输出/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /可寻址 LED/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'GP28 · Pin 34 · 数字输出' }));
    fireEvent.click(screen.getByRole('button', { name: '添加通道' }));

    expect(registryState.updateDeviceChannels).toHaveBeenCalledWith(
      'rp2040-pico-default',
      expect.arrayContaining([
        expect.objectContaining({ id: 'pin.gp2' }),
        expect.objectContaining({ id: 'pin.gp28' })
      ])
    );
  });

  test('formats non-RP2040 addable channels with board-specific pin labels', () => {
    const proMicroChannels = getBoardAvailableChannels('sparkfun-pro-micro-32u4');
    const firstProMicroChannel =
      proMicroChannels.find((channel) => channel.id === 'pin.d0') ?? proMicroChannels[0];
    expect(firstProMicroChannel).toBeDefined();
    const proMicroState: DeviceRuntimeRegistryState = {
      ...registryState,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-pro-micro',
          boardId: 'sparkfun-pro-micro-32u4',
          channels: [firstProMicroChannel!]
        }
      ]
    };

    renderDevicesPage(proMicroState);

    fireEvent.click(screen.getByRole('combobox', { name: '新增通道' }));

    expect(screen.getByRole('option', { name: 'A0 · 数字输出' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /GP18/ })).not.toBeInTheDocument();
  });

  test('refreshes configured channel capabilities from the selected board catalog', () => {
    const stateWithOldChannelCapabilities: DeviceRuntimeRegistryState = {
      ...registryState,
      updateDeviceChannels: vi.fn()
    };
    renderDevicesPage(stateWithOldChannelCapabilities);

    fireEvent.click(screen.getByRole('button', { name: '刷新通道能力' }));

    expect(stateWithOldChannelCapabilities.updateDeviceChannels).toHaveBeenCalledWith(
      'rp2040-pico-default',
      [
        expect.objectContaining({
          id: 'pin.gp2',
          supportedActions: expect.arrayContaining(['activate', 'deactivate', 'blink', 'breathe', 'pulse'])
        })
      ]
    );
  });

  test('requires confirmation before switching a Pico GPIO channel to input mode', () => {
    const stateWithModeSwitch: DeviceRuntimeRegistryState = {
      ...registryState,
      updateDeviceChannels: vi.fn()
    };
    renderDevicesPage(stateWithModeSwitch);

    fireEvent.click(screen.getAllByRole('button', { name: '切为输入' })[0]);

    expect(stateWithModeSwitch.updateDeviceChannels).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '确认切换' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));

    expect(stateWithModeSwitch.updateDeviceChannels).toHaveBeenCalledWith(
      'rp2040-pico-default',
      [
        expect.objectContaining({
          id: 'pin.gp2',
          kind: 'button-input',
          direction: 'input',
          input: expect.objectContaining({
            control: 'pin.gp2',
            inputKind: 'gpio',
            fixed: false
          }),
          supportedActions: []
        })
      ]
    );
  });

  test('allows Pico OLED GPIO channels to switch to input mode', () => {
    const picoOled096Gp2 = getBoardAvailableChannels('rp2040-pico-oled-096').find(
      (channel) => channel.id === 'pin.gp2'
    );
    const picoOled091Gp22 = getBoardAvailableChannels('rp2040-pico-oled-091').find(
      (channel) => channel.id === 'pin.gp22'
    );
    const stateWithPicoOledDevices: DeviceRuntimeRegistryState = {
      ...registryState,
      updateDeviceChannels: vi.fn(),
      states: [
        {
          ...registryState.states[0],
          deviceId: 'pico-oled-096',
          boardId: 'rp2040-pico-oled-096',
          channels: [picoOled096Gp2!]
        },
        {
          ...registryState.states[1],
          deviceId: 'pico-oled-091',
          boardId: 'rp2040-pico-oled-091',
          channels: [picoOled091Gp22!]
        }
      ]
    };
    renderDevicesPage(stateWithPicoOledDevices);

    fireEvent.click(screen.getByRole('button', { name: '切为输入' }));
    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));

    expect(stateWithPicoOledDevices.updateDeviceChannels).toHaveBeenCalledWith(
      'pico-oled-096',
      [
        expect.objectContaining({
          id: 'pin.gp2',
          kind: 'button-input',
          direction: 'input',
          input: expect.objectContaining({
            control: 'pin.gp2',
            inputKind: 'gpio',
            fixed: false
          }),
          supportedActions: []
        })
      ]
    );

    fireEvent.click(screen.getByRole('button', { name: 'pico-oled-091 rp2040-pico-oled-091' }));
    fireEvent.click(screen.getByRole('button', { name: '切为输入' }));
    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));

    expect(stateWithPicoOledDevices.updateDeviceChannels).toHaveBeenCalledWith(
      'pico-oled-091',
      [
        expect.objectContaining({
          id: 'pin.gp22',
          kind: 'button-input',
          direction: 'input',
          input: expect.objectContaining({
            control: 'pin.gp22',
            inputKind: 'gpio',
            fixed: false
          }),
          supportedActions: []
        })
      ]
    );
  });

  test('clears pending GPIO mode switch when the channel disappears before confirmation', () => {
    const stateWithTwoChannels: DeviceRuntimeRegistryState = {
      ...registryState,
      updateDeviceChannels: vi.fn(),
      states: [
        {
          ...registryState.states[0],
          channels: [
            registryState.states[0].channels[0],
            registryState.states[1].channels[0]
          ]
        },
        registryState.states[1]
      ]
    };
    const stateWithoutGp2: DeviceRuntimeRegistryState = {
      ...stateWithTwoChannels,
      states: [
        {
          ...stateWithTwoChannels.states[0],
          channels: [registryState.states[1].channels[0]]
        },
        registryState.states[1]
      ]
    };
    const { rerender } = renderDevicesPage(stateWithTwoChannels);

    fireEvent.click(screen.getAllByRole('button', { name: '切为输入' })[0]);
    expect(screen.getByRole('button', { name: '确认切换' })).toBeInTheDocument();

    rerender(
      <I18nProvider language="zh-CN">
        <DevicesPage registry={stateWithoutGp2} />
      </I18nProvider>
    );
    rerender(
      <I18nProvider language="zh-CN">
        <DevicesPage registry={stateWithTwoChannels} />
      </I18nProvider>
    );

    expect(screen.queryByRole('button', { name: '确认切换' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '切为输入' }).length).toBeGreaterThanOrEqual(1);
  });

  test('persists removed device channels through registry actions', () => {
    const stateWithTwoChannels: DeviceRuntimeRegistryState = {
      ...registryState,
      states: [
        {
          ...registryState.states[0],
          channels: [
            registryState.states[0].channels[0],
            registryState.states[1].channels[0]
          ]
        },
        registryState.states[1]
      ],
      updateDeviceChannels: vi.fn()
    };
    renderDevicesPage(stateWithTwoChannels);

    fireEvent.click(screen.getByRole('button', { name: '删除 GP2' }));

    expect(stateWithTwoChannels.updateDeviceChannels).toHaveBeenCalledWith(
      'rp2040-pico-default',
      [expect.objectContaining({ id: 'pin.gp28' })]
    );
  });

  test('opens hardware guide from a device channel', () => {
    renderDevicesPage();

    fireEvent.click(screen.getByRole('button', { name: '查看 GP2 连接说明' }));

    expect(screen.getByRole('dialog', { name: '数字输出连接助手' })).toBeInTheDocument();
    expect(screen.getByText('适合普通 LED、继电器输入和低压数字触发模块。')).toBeInTheDocument();
    expect(screen.getByText('GPIO 输出逻辑电平：3.3V。')).toBeInTheDocument();
    expect(screen.getByText('普通 LED 推荐串联 330Ω - 1kΩ；默认优先选 470Ω 或 1kΩ。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '官方引脚图' })).toHaveAttribute(
      'href',
      'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#non-wireless-board-layout'
    );
    expect(screen.getByRole('link', { name: 'Pico 数据手册' })).toHaveAttribute(
      'href',
      'https://pip-assets.raspberrypi.com/categories/610-raspberry-pi-pico/documents/RP-008307-DS-1-pico-datasheet.pdf'
    );
    expect(screen.getByRole('link', { name: 'RP2040 数据手册' })).toHaveAttribute(
      'href',
      'https://pip-assets.raspberrypi.com/categories/814-rp2040/documents/RP-008371-DS-1-rp2040-datasheet.pdf'
    );
    expect(screen.getByTestId('rp2040-pico-physical-pin-4')).toHaveAttribute('data-highlighted', 'true');
  });

  test('shows Wio fixed input channel and opens shortcut binding dialog', () => {
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      inputBindings: [
        {
          id: 'desk-wio:input.button.a:press',
          enabled: true,
          deviceId: 'desk-wio',
          channelId: 'input.button.a',
          trigger: 'press',
          action: {
            type: 'keyboard-shortcut',
            shortcut: { keys: ['Command', 'Enter'] }
          }
        }
      ],
      refreshInputBindings: vi.fn(),
      saveInputBindings: vi.fn(),
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          boardId: 'seeed-wio-terminal',
          channels: [
            {
              id: 'input.button.a',
              label: 'Button A',
              kind: 'button-input',
              direction: 'input',
              description: 'Button A',
              physicalPin: null,
              digitalOutput: null,
              pwmOutput: null,
              buzzer: null,
              addressableLed: null,
              input: { control: 'button.a', inputKind: 'button', fixed: true },
              supportedActions: [],
              hardwareGuideId: null
            }
          ]
        }
      ]
    };

    renderDevicesPage(wioState);

    expect(screen.getByRole('cell', { name: 'Button A' })).toBeInTheDocument();
    expect(screen.getByText('固定输入')).toBeInTheDocument();
    expect(screen.getAllByText('Command + Enter').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: '配置 Button A 输入动作' }));

    expect(screen.getByRole('dialog', { name: '输入动作' })).toBeInTheDocument();
  });

  test('shows input test panel with highlighted configured shortcut keys', () => {
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      inputBindings: [
        {
          id: 'desk-wio:input.button.a:press',
          enabled: true,
          deviceId: 'desk-wio',
          channelId: 'input.button.a',
          trigger: 'press',
          action: {
            type: 'keyboard-shortcut',
            shortcut: { keys: ['Command', 'Enter'] }
          }
        }
      ],
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          boardId: 'seeed-wio-terminal',
          channels: [
            {
              id: 'input.button.a',
              label: 'Button A',
              kind: 'button-input',
              direction: 'input',
              description: 'Button A',
              physicalPin: null,
              digitalOutput: null,
              pwmOutput: null,
              buzzer: null,
              addressableLed: null,
              input: { control: 'button.a', inputKind: 'button', fixed: true },
              supportedActions: [],
              hardwareGuideId: null
            }
          ]
        }
      ]
    };

    renderDevicesPage(wioState);

    const panel = screen.getByTestId('device-input-test-panel');
    expect(within(panel).getByText('按钮上行测试')).toBeInTheDocument();
    expect(within(panel).getByText('Button A')).toBeInTheDocument();
    expect(within(panel).getByText('Command + Enter')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: /Button A/ })).toHaveAttribute(
      'data-selected',
      'true'
    );
    expect(within(panel).getAllByTestId('shortcut-keyboard-panel')).toHaveLength(1);
    expect(within(panel).getByRole('button', { name: 'Command' })).toHaveAttribute(
      'data-key-state',
      'highlighted'
    );
    expect(within(panel).getByRole('button', { name: 'Enter' })).toHaveAttribute(
      'data-key-state',
      'highlighted'
    );
  });

  test('shows disabled input binding state in channel record and input test panel', () => {
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      inputBindings: [
        {
          id: 'desk-wio:input.button.a:press',
          enabled: false,
          deviceId: 'desk-wio',
          channelId: 'input.button.a',
          trigger: 'press',
          action: {
            type: 'keyboard-shortcut',
            shortcut: { keys: ['Command', 'Enter'] }
          }
        }
      ],
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          boardId: 'seeed-wio-terminal',
          channels: [
            {
              id: 'input.button.a',
              label: 'Button A',
              kind: 'button-input',
              direction: 'input',
              description: 'Button A',
              physicalPin: null,
              digitalOutput: null,
              pwmOutput: null,
              buzzer: null,
              addressableLed: null,
              input: { control: 'button.a', inputKind: 'button', fixed: true },
              supportedActions: [],
              hardwareGuideId: null
            }
          ]
        }
      ]
    };

    renderDevicesPage(wioState);

    expect(screen.getByText('Command + Enter（已禁用）')).toBeInTheDocument();
    const panel = screen.getByTestId('device-input-test-panel');
    expect(within(panel).getAllByText('已禁用').length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getByText(/当前按钮功能已禁用/)).toBeInTheDocument();
    expect(within(panel).queryByText('当前输入通道还没有配置快捷键，请先在设备通道中配置输入动作。')).not.toBeInTheDocument();
    expect(within(panel).queryByTestId('shortcut-keyboard-panel')).not.toBeInTheDocument();
  });

  test('shows recent real device input event in input test panel', async () => {
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      inputBindings: [
        {
          id: 'desk-wio:input.button.a:press',
          enabled: true,
          deviceId: 'desk-wio',
          channelId: 'input.button.a',
          trigger: 'press',
          action: {
            type: 'keyboard-shortcut',
            shortcut: { keys: ['Command', 'Enter'] }
          }
        }
      ],
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          boardId: 'seeed-wio-terminal',
          status: 'connected',
          channels: [
            {
              id: 'input.button.a',
              label: 'Button A',
              kind: 'button-input',
              direction: 'input',
              description: 'Button A',
              physicalPin: null,
              digitalOutput: null,
              pwmOutput: null,
              buzzer: null,
              addressableLed: null,
              input: { control: 'button.a', inputKind: 'button', fixed: true },
              supportedActions: [],
              hardwareGuideId: null
            }
          ]
        }
      ]
    };

    renderDevicesPage(wioState);
    await waitFor(() =>
      expect(tauriEventHandlers.has('cc-notice://device-input-event')).toBe(true)
    );

    act(() => {
      tauriEventHandlers.get('cc-notice://device-input-event')?.({
        payload: {
          deviceId: 'desk-wio',
          channelId: 'input.button.a',
          control: 'button.a',
          action: 'press',
          seq: 18,
          receivedAt: '2026-07-17T14:00:00+08:00'
        }
      });
    });

    const panel = screen.getByTestId('device-input-test-panel');
    expect(within(panel).getByText('最近收到')).toBeInTheDocument();
    expect(within(panel).getByText('button.a · press · #18')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Command' })).toHaveAttribute(
      'data-key-state',
      'highlighted'
    );
    expect(within(panel).getByRole('button', { name: 'Enter' })).toHaveAttribute(
      'data-key-state',
      'highlighted'
    );
  });

  test('shows skipped status for disconnected test actions', () => {
    renderDevicesPage({
      ...registryState,
      actionStatus: 'skipped'
    });

    expect(screen.getByText('设备未连接，测试动作已跳过。')).toBeInTheDocument();
  });

  test('shows firmware update status and checks firmware version on demand', () => {
    const checkDeviceFirmware = vi.fn();
    const stateWithOutdatedFirmware = {
      ...registryState,
      checkDeviceFirmware,
      states: [
        {
          ...registryState.states[0],
          firmwareInfo: {
            boardId: 'rp2040-pico',
            deviceUid: 'rp2040-pico:0011223344556677',
            firmwareVersion: '0.2.0',
            protocolVersion: 2
          },
          bundledFirmwareVersion: '0.2.1',
          firmwareStatus: 'update-available',
          firmwareCheckError: null
        }
      ]
    } as unknown as DeviceRuntimeRegistryState;
    renderDevicesPage(stateWithOutdatedFirmware);

    expect(screen.getByText('0.2.0')).toBeInTheDocument();
    expect(screen.getByText('0.2.1')).toBeInTheDocument();
    expect(screen.getByText('需要更新固件')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '检查固件版本' }));

    expect(checkDeviceFirmware).toHaveBeenCalledWith('rp2040-pico-default');
  });

  test('sends observable default parameters for breathe test actions', () => {
    const connectedState: DeviceRuntimeRegistryState = {
      ...registryState,
      states: [
        {
          ...registryState.states[0],
          status: 'connected',
          channels: [
            {
              ...registryState.states[0].channels[0],
              supportedActions: ['activate', 'deactivate', 'blink', 'breathe', 'pulse']
            }
          ]
        }
      ],
      sendTestAction: vi.fn()
    };
    renderDevicesPage(connectedState);

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));
    fireEvent.click(screen.getByRole('option', { name: '呼吸' }));
    fireEvent.click(screen.getByRole('button', { name: '发送测试动作' }));

    expect(connectedState.sendTestAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'breathe',
        durationMs: 5000,
        intervalMs: 1200
      })
    );
  });

  test('sends selected Pico buzzer pattern from channel test actions', () => {
    const sendTestAction = vi.fn();
    const connectedState: DeviceRuntimeRegistryState = {
      ...registryState,
      sendTestAction,
      states: [
        {
          ...registryState.states[0],
          status: 'connected',
          channels: [
            {
              id: 'buzzer.gp19',
              label: 'GP19 Buzzer',
              kind: 'buzzer',
              description: 'GPIO 19 buzzer',
              physicalPin: 25,
              digitalOutput: null,
              pwmOutput: null,
              buzzer: {
                pin: 19,
                activeLevel: 'high',
                defaultFrequencyHz: 2000,
                supportsTone: true
              },
              addressableLed: null,
              supportedActions: ['beep', 'tone', 'pattern', 'clear'],
              hardwareGuideId: 'buzzer'
            }
          ]
        }
      ]
    };
    renderDevicesPage(connectedState);

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));
    expect(screen.queryByText('devices.channelAction.pattern')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '提示音模式' }));
    fireEvent.click(screen.getByRole('combobox', { name: '提示音模式' }));
    fireEvent.click(screen.getByRole('option', { name: '成功音' }));
    fireEvent.click(screen.getByRole('button', { name: '发送测试动作' }));

    expect(sendTestAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'rp2040-pico-default',
        channelId: 'buzzer.gp19',
        action: 'pattern',
        pattern: 'success'
      })
    );
  });

  test('shows device extension panel for Pico OLED display devices', () => {
    const sendExtensionAction = vi.fn();
    const picoOledState: DeviceRuntimeRegistryState = {
      ...registryState,
      sendExtensionAction,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-pico-oled',
          status: 'connected',
          boardId: 'rp2040-pico-oled-096'
        }
      ]
    };

    renderDevicesPage(picoOledState);

    expect(screen.getByText('设备扩展能力')).toBeInTheDocument();
    expect(screen.getByText('屏幕测试')).toBeInTheDocument();
    expect(screen.queryByText('提示音模式')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '静音' })).not.toBeInTheDocument();

    expect(screen.getByLabelText('测试内容')).toHaveValue('Test message');

    fireEvent.click(screen.getByRole('button', { name: '成功' }));
    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-pico-oled',
        action: 'display-status',
        status: 'success',
        title: 'Done',
        message: 'OK'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '工作中' }));
    fireEvent.click(screen.getByRole('button', { name: '警告' }));
    fireEvent.click(screen.getByRole('button', { name: '错误' }));

    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-pico-oled',
        action: 'display-status',
        status: 'working',
        title: 'Working',
        message: 'Running'
      })
    );
    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-pico-oled',
        action: 'display-status',
        status: 'warning',
        title: 'Warning',
        message: 'Check'
      })
    );
    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-pico-oled',
        action: 'display-status',
        status: 'error',
        title: 'Failed',
        message: 'Error'
      })
    );
  });

  test('sends status and runtime display tests for Pico OLED 0.91 display devices', () => {
    const sendExtensionAction = vi.fn();
    const picoOledState: DeviceRuntimeRegistryState = {
      ...registryState,
      sendExtensionAction,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-pico-oled-091',
          status: 'connected',
          boardId: 'rp2040-pico-oled-091'
        }
      ]
    };

    renderDevicesPage(picoOledState);

    expect(screen.getByText('设备扩展能力')).toBeInTheDocument();
    expect(screen.getByText('屏幕测试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '测试事件覆盖页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '成功' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '成功' }));
    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-pico-oled-091',
        action: 'display-status',
        status: 'success',
        title: 'Done',
        message: 'OK'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '测试运行态' }));

    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-pico-oled-091',
        action: 'display-runtime',
        status: 'working',
        title: 'Working',
        message: 'E/O 12/34',
        lines: ['Last codex hook', 'OK 33 / Err 1']
      })
    );
  });

  test('shows device extension panel with display and buzzer features for Wio devices', () => {
    const sendExtensionAction = vi.fn();
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      sendExtensionAction,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          status: 'connected',
          boardId: 'seeed-wio-terminal'
        }
      ]
    };

    renderDevicesPage(wioState);

    expect(screen.getByText('设备扩展能力')).toBeInTheDocument();
    expect(screen.getByText('屏幕测试')).toBeInTheDocument();
    expect(screen.getByText('提示音模式')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '静音' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '成功' }));
    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-wio',
        action: 'display-status',
        status: 'success',
        title: 'Task Done',
        message: 'CC Notice received a success state'
      })
    );
  });

  test('sends ascii Wio display overlay test content from extension panel', () => {
    const sendExtensionAction = vi.fn();
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      sendExtensionAction,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          status: 'connected',
          boardId: 'seeed-wio-terminal'
        }
      ]
    };

    renderDevicesPage(wioState);

    fireEvent.change(screen.getByLabelText('测试标题'), {
      target: { value: 'Rule Test' }
    });
    fireEvent.change(screen.getByLabelText('测试内容'), {
      target: { value: 'This is a display overlay test' }
    });
    fireEvent.click(screen.getByRole('button', { name: '测试事件覆盖页' }));

    expect(sendExtensionAction).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 'desk-wio',
        action: 'display-status',
        status: 'notice',
        title: 'Rule Test',
        message: 'This is a display overlay test'
      })
    );
  });

  test('blocks non ascii Wio display overlay test content', () => {
    const sendExtensionAction = vi.fn();
    const wioState: DeviceRuntimeRegistryState = {
      ...registryState,
      sendExtensionAction,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-wio',
          status: 'connected',
          boardId: 'seeed-wio-terminal'
        }
      ]
    };

    renderDevicesPage(wioState);

    fireEvent.change(screen.getByLabelText('测试标题'), {
      target: { value: '规则测试' }
    });
    fireEvent.change(screen.getByLabelText('测试内容'), {
      target: { value: '这是一条自定义屏幕测试内容' }
    });

    expect(screen.getByText('当前屏幕暂不支持中文，请使用英文、数字或常用符号。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '测试事件覆盖页' })).toBeDisabled();
    expect(sendExtensionAction).not.toHaveBeenCalled();
  });

  test('hides device extension panel for devices without extension capabilities', () => {
    renderDevicesPage();

    expect(screen.queryByText('设备扩展能力')).not.toBeInTheDocument();
  });

  test('allows resetting identity for connected limited identity boards after confirmation', () => {
    const resetDeviceIdentity = vi.fn();
    const nanoState: DeviceRuntimeRegistryState = {
      ...registryState,
      resetDeviceIdentity,
      states: [
        {
          ...registryState.states[0],
          deviceId: 'desk-nano',
          status: 'connected',
          boardId: 'arduino-nano',
          deviceUid: 'arduino-nano:b91c5a5779ad41e0',
          transport: {
            kind: 'serial',
            serialPort: '/dev/cu.usbserial-14110',
            baudRate: 115200
          }
        }
      ]
    };

    renderDevicesPage(nanoState);

    fireEvent.click(screen.getByRole('button', { name: '重置设备 ID' }));
    fireEvent.click(screen.getByRole('button', { name: '确认重置' }));

    expect(resetDeviceIdentity).toHaveBeenCalledWith('desk-nano');
  });

  test('opens diagnostics center from selected device runtime panel', () => {
    const onOpenDiagnosticsCenter = vi.fn();

    renderDevicesPage(registryState, discoveryState, vi.fn(), onOpenDiagnosticsCenter);
    fireEvent.click(screen.getByRole('button', { name: '查看诊断' }));

    expect(onOpenDiagnosticsCenter).toHaveBeenCalledTimes(1);
  });
});

function renderDevicesPage(
  state: DeviceRuntimeRegistryState = registryState,
  discovery: DeviceDiscoveryState = discoveryState,
  onOpenRulesPage = vi.fn(),
  onOpenDiagnosticsCenter = vi.fn()
) {
  vi.mocked(useDeviceDiscoveryModule.useDeviceDiscovery).mockReturnValue(discovery);

  return render(
    <I18nProvider language="zh-CN">
      <DevicesPage
        registry={state}
        onOpenRulesPage={onOpenRulesPage}
        onOpenDiagnosticsCenter={onOpenDiagnosticsCenter}
      />
    </I18nProvider>
  );
}
