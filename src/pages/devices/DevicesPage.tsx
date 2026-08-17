import { useEffect, useMemo, useState } from 'react';
import { DeviceDiscoveryState, useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { DeviceRuntimeRegistryState } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';
import {
  DeviceCandidateResource,
  DeviceChannel,
  DeviceRuntimeState,
  DeviceTransportConfig,
  openDeviceTransportMonitorWindow
} from '@/api/tauriApi';
import { getBoardAvailableChannels, getBoardConnectionResourceMode } from '@/domain/boards/boardCatalog';
import {
  toRp2040PicoGpioInputChannel,
  toRp2040PicoGpioOutputChannel
} from '@/domain/boards/rp2040PicoChannels';
import { DeviceConnectionCandidate } from './DeviceConnectionControls';
import { DeviceDetailPanel } from './DeviceDetailPanel';
import { DeviceDiscoveryPanel } from './DeviceDiscoveryPanel';
import { RegisteredDeviceListPanel } from './RegisteredDeviceListPanel';

const DEFAULT_DEVICE_BOARD_ID = 'rp2040-pico';

type DevicesPageProps = {
  registry: DeviceRuntimeRegistryState;
  onOpenRulesPage?: () => void;
  onOpenDiagnosticsCenter?: () => void;
};

export function DevicesPage({
  registry,
  onOpenRulesPage,
  onOpenDiagnosticsCenter
}: DevicesPageProps) {
  const t = useI18n();
  const discovery = useDeviceDiscovery({
    onRegisteredDevice: registry.upsertDeviceState,
    onIdentifiedMatchedDevice: connectIdentifiedMatchedDevice
  });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const { refreshInputBindings } = registry;

  useEffect(() => {
    void refreshInputBindings();
  }, [refreshInputBindings]);

  useEffect(() => {
    if (selectedDeviceId && registry.states.some((state) => state.deviceId === selectedDeviceId)) {
      return;
    }

    const firstDeviceId = registry.states.find((state) => Boolean(state.deviceId))?.deviceId;
    setSelectedDeviceId(firstDeviceId ?? null);
  }, [registry.states, selectedDeviceId]);

  const selectedState = useMemo(
    () => registry.states.find((state) => state.deviceId === selectedDeviceId) ?? registry.states[0] ?? null,
    [registry.states, selectedDeviceId]
  );
  const connectionCandidates = useMemo(
    () => connectionCandidatesForDevice(selectedState, registry.states, discovery.candidates),
    [discovery.candidates, registry.states, selectedState]
  );
  const selectedChannels = selectedState?.channels ?? [];
  const addableChannels = useMemo(() => {
    const configuredChannelIds = new Set(selectedChannels.map((channel) => channel.id));
    return getBoardAvailableChannels(selectedState?.boardId ?? DEFAULT_DEVICE_BOARD_ID).filter(
      (channel) => !configuredChannelIds.has(channel.id)
    );
  }, [selectedChannels, selectedState?.boardId]);

  function addChannelDraft(channel: DeviceChannel) {
    if (!selectedState?.deviceId) {
      return;
    }
    if (selectedChannels.some((item) => item.id === channel.id)) {
      return;
    }
    registry.updateDeviceChannels(selectedState.deviceId, [...selectedChannels, channel]);
  }

  function removeChannelDraft(channelId: string) {
    if (!selectedState?.deviceId) {
      return;
    }
    const nextChannels = selectedChannels.filter((channel) => channel.id !== channelId);
    if (nextChannels.length === 0) {
      return;
    }
    registry.updateDeviceChannels(selectedState.deviceId, nextChannels);
  }

  function refreshChannelCapabilities() {
    if (!selectedState?.deviceId || selectedChannels.length === 0) {
      return;
    }
    const boardChannelById = new Map(
      getBoardAvailableChannels(selectedState.boardId ?? DEFAULT_DEVICE_BOARD_ID).map((channel) => [
        channel.id,
        channel
      ])
    );
    const refreshedChannels = selectedChannels.map((channel) => {
      const catalogChannel = boardChannelById.get(channel.id) ?? channel;
      if ((channel.direction ?? 'output') === 'input' && channel.input?.inputKind === 'gpio') {
        return toRp2040PicoGpioInputChannel(catalogChannel);
      }
      return catalogChannel;
    });
    registry.updateDeviceChannels(selectedState.deviceId, refreshedChannels);
  }

  function updateChannelMode(channelId: string, direction: 'output' | 'input') {
    if (!selectedState?.deviceId) {
      return;
    }
    const boardChannelById = new Map(
      getBoardAvailableChannels(selectedState.boardId ?? DEFAULT_DEVICE_BOARD_ID).map((channel) => [
        channel.id,
        channel
      ])
    );
    const nextChannels = selectedChannels.map((channel) => {
      if (channel.id !== channelId) {
        return channel;
      }
      const sourceChannel = boardChannelById.get(channel.id) ?? channel;
      if (direction === 'input') {
        return toRp2040PicoGpioInputChannel(sourceChannel);
      }
      return toRp2040PicoGpioOutputChannel(sourceChannel);
    });
    registry.updateDeviceChannels(selectedState.deviceId, nextChannels);
  }

  function connectRegisteredDevice(deviceId: string, selectedTransport?: DeviceTransportConfig | null) {
    if (selectedTransport) {
      registry.connectDevice(deviceId, selectedTransport);
      return;
    }
    const latestTransport = latestMatchedTransportForDevice(deviceId, discovery.candidates);
    if (latestTransport) {
      registry.connectDevice(deviceId, latestTransport);
      return;
    }
    registry.connectDevice(deviceId);
  }

  function connectIdentifiedMatchedDevice(candidate: DeviceCandidateResource) {
    const matchedDeviceId = candidate.matchedDeviceId;
    if (!matchedDeviceId) {
      return;
    }
    if (registry.connectingDeviceId === '*' || registry.connectingDeviceId === matchedDeviceId) {
      return;
    }
    const matchedState = registry.states.find((state) => state.deviceId === matchedDeviceId);
    if (!matchedState) {
      return;
    }
    if (
      matchedState.status === 'connected' ||
      matchedState.status === 'connecting' ||
      matchedState.activeOperation
    ) {
      return;
    }
    registry.connectDevice(matchedDeviceId, candidate.transport);
  }

  function openTransportMonitor(deviceId: string) {
    void openDeviceTransportMonitorWindow(deviceId).catch((error) => {
      console.warn('failed to open device transport monitor', error);
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('devices.title')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('devices.description')}
        </p>
      </div>

      <DeviceDiscoveryPanel
        discovery={discovery}
        autoConnecting={registry.connectingDeviceId === '*'}
        autoConnectError={registry.error?.scope === 'device-access' ? registry.error : null}
        onAutoConnect={registry.autoConnectRegisteredDevices}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <RegisteredDeviceListPanel
          states={registry.states}
          loading={registry.loading}
          selectedDeviceId={selectedState?.deviceId ?? null}
          error={registry.error}
          onSelectDevice={setSelectedDeviceId}
          onRemoveDevice={registry.removeRegisteredDevice}
          onOpenRulesPage={onOpenRulesPage}
        />

        <DeviceDetailPanel
          fallbackBoardId={DEFAULT_DEVICE_BOARD_ID}
          selectedState={selectedState}
          selectedChannels={selectedChannels}
          addableChannels={addableChannels}
          connectionCandidates={connectionCandidates}
          registry={registry}
          onConnectDevice={connectRegisteredDevice}
          onAddChannel={addChannelDraft}
          onRemoveChannel={removeChannelDraft}
          onUpdateChannelMode={updateChannelMode}
          onRefreshCapabilities={refreshChannelCapabilities}
          onOpenRulesPage={onOpenRulesPage}
          onOpenDiagnosticsCenter={onOpenDiagnosticsCenter}
          onOpenTransportMonitor={openTransportMonitor}
        />
      </div>
    </div>
  );
}

export function connectionCandidatesForDevice(
  selectedState: DeviceRuntimeState | null,
  states: DeviceRuntimeState[],
  candidates: DeviceCandidateResource[]
): DeviceConnectionCandidate[] {
  const selectedDeviceId = selectedState?.deviceId ?? null;
  if (!selectedDeviceId) {
    return [];
  }
  const selectedSerialPort = selectedState?.transport?.serialPort ?? null;
  const allowsManualFallback =
    getBoardConnectionResourceMode(selectedState?.boardId ?? '') === 'manual-fallback';
  const occupiedSerialPorts = new Set(
    states
      .filter(
        (state) =>
          state.deviceId &&
          state.deviceId !== selectedDeviceId &&
          (state.status === 'connected' || state.status === 'connecting' || state.activeOperation)
      )
      .map((state) => state.transport?.serialPort)
      .filter((serialPort): serialPort is string => Boolean(serialPort))
  );

  return candidates
    .filter((candidate) => {
      const serialPort = candidate.transport.serialPort;
      if (serialPort && selectedSerialPort && serialPort === selectedSerialPort) {
        return false;
      }
      if (candidate.matchedDeviceId === selectedDeviceId) {
        return true;
      }
      if (candidate.matchedDeviceId) {
        return false;
      }
      if (!allowsManualFallback) {
        return false;
      }
      return !serialPort || !occupiedSerialPorts.has(serialPort);
    })
    .map((candidate) => ({
      resourceId: candidate.resourceId,
      displayName: candidate.displayName,
      transport: candidate.transport,
      matchedDeviceId: candidate.matchedDeviceId
    }));
}

function latestMatchedTransportForDevice(
  deviceId: string,
  candidates: DeviceDiscoveryState['candidates']
): DeviceTransportConfig | undefined {
  const matched = candidates.find((candidate) => candidate.matchedDeviceId === deviceId);
  return matched?.transport;
}
