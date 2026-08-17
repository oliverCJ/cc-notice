import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { DeviceRuntimeState } from '@/api/tauriApi';
import { DeviceConnectionControls } from './DeviceConnectionControls';

const selectedState: DeviceRuntimeState = {
  deviceId: 'desk-pico',
  status: 'disconnected',
  boardId: 'rp2040-pico',
  transport: {
    kind: 'serial',
    serialPort: '/dev/cu.old',
    baudRate: 115200
  },
  channels: [],
  firmwareInfo: null,
  bundledFirmwareVersion: null,
  firmwareStatus: 'unknown',
  firmwareCheckError: null,
  heartbeatStatus: 'unknown',
  heartbeatFailureCount: 0,
  lastHeartbeatAt: null,
  manualReconnectSuppressed: false,
  matchedResourceId: null,
  lastDiscoveredAt: null,
  lastAck: null,
  lastError: null,
  lastSentAt: null
};

describe('DeviceConnectionControls', () => {
  test('opens transport monitor only when selected device is connected', () => {
    const onOpenTransportMonitor = vi.fn();
    renderControls({
      selectedState: {
        ...selectedState,
        status: 'connected'
      },
      onOpenTransportMonitor,
      candidates: [],
      onConnect: vi.fn()
    });

    fireEvent.click(screen.getByRole('button', { name: '打开通信监控' }));

    expect(onOpenTransportMonitor).toHaveBeenCalledWith('desk-pico');
  });

  test('disables transport monitor action for disconnected devices', () => {
    renderControls({
      selectedState,
      candidates: [],
      onConnect: vi.fn()
    });

    expect(screen.getByRole('button', { name: '打开通信监控' })).toBeDisabled();
  });

  test('switches to current device matched transport when a later scan finds it', () => {
    const onConnect = vi.fn();
    const fallbackTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/cu.fallback',
      baudRate: 115200
    };
    const matchedTransport = {
      kind: 'serial' as const,
      serialPort: '/dev/cu.matched',
      baudRate: 115200
    };
    const { rerender } = renderControls({
      onConnect,
      candidates: [
        {
          resourceId: 'serial:/dev/cu.fallback',
          displayName: 'Fallback Port',
          transport: fallbackTransport,
          matchedDeviceId: null
        }
      ]
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fallback Port' }));

    rerender(
      <I18nProvider language="zh-CN">
        <DeviceConnectionControls
          selectedState={selectedState}
          connectionCandidates={[
            {
              resourceId: 'serial:/dev/cu.fallback',
              displayName: 'Fallback Port',
              transport: fallbackTransport,
              matchedDeviceId: null
            },
            {
              resourceId: 'serial:/dev/cu.matched',
              displayName: 'Matched Port',
              transport: matchedTransport,
              matchedDeviceId: 'desk-pico'
            }
          ]}
          connectingDeviceId={null}
          error={null}
          onConnect={onConnect}
          onDisconnect={vi.fn()}
          onDisconnectAll={vi.fn()}
          onOpenTransportMonitor={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '连接当前设备' }));

    expect(onConnect).toHaveBeenCalledWith('desk-pico', matchedTransport);
  });
});

function renderControls({
  candidates,
  onConnect,
  onOpenTransportMonitor = vi.fn(),
  selectedState: renderedState = selectedState
}: {
  candidates: React.ComponentProps<typeof DeviceConnectionControls>['connectionCandidates'];
  onConnect: React.ComponentProps<typeof DeviceConnectionControls>['onConnect'];
  onOpenTransportMonitor?: React.ComponentProps<typeof DeviceConnectionControls>['onOpenTransportMonitor'];
  selectedState?: DeviceRuntimeState;
}) {
  return render(
    <I18nProvider language="zh-CN">
      <DeviceConnectionControls
        selectedState={renderedState}
        connectionCandidates={candidates}
        connectingDeviceId={null}
        error={null}
        onConnect={onConnect}
        onDisconnect={vi.fn()}
        onDisconnectAll={vi.fn()}
        onOpenTransportMonitor={onOpenTransportMonitor}
      />
    </I18nProvider>
  );
}
