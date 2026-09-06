import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DeviceDiscoveryState, useDeviceDiscovery } from '@/hooks/useDeviceDiscovery';
import { DeviceRuntimeRegistryState } from '@/hooks/useDeviceRuntimeRegistry';
import { type Translator, useI18n } from '@/i18n';
import {
  CustomFaceGroup,
  CustomFaceGroupSummary,
  DeviceCandidateResource,
  DeviceChannel,
  DeviceRuntimeState,
  DeviceTransportConfig,
  installCustomFaceGroupToDevice,
  setCustomFaceActiveSource,
  openDeviceTransportMonitorWindow,
} from '@/api/tauriApi';
import {
  getBoardAvailableChannels,
  getBoardConnectionResourceMode,
} from '@/domain/boards/boardCatalog';
import {
  checkCustomFaceDeployment,
  type CustomFaceDeploymentReason,
} from '@/domain/customFaces/deployment';
import {
  filterCustomFaceGroupSummariesForDisplay,
  loadCustomFaceLibraryEntries,
} from '@/domain/customFaces/library';
import { resolveDeviceDisplayCapabilities } from '@/domain/devices/deviceDisplayCapabilities';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  toRp2040PicoGpioInputChannel,
  toRp2040PicoGpioOutputChannel,
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
  onOpenCustomFaceEditor?: () => void;
  customFaceEditorOpen?: boolean;
};

export function DevicesPage({
  registry,
  onOpenRulesPage,
  onOpenDiagnosticsCenter,
  onOpenCustomFaceEditor,
  customFaceEditorOpen = false,
}: DevicesPageProps) {
  const t = useI18n();
  const discovery = useDeviceDiscovery({
    onRegisteredDevice: registry.upsertDeviceState,
    onIdentifiedMatchedDevice: connectIdentifiedMatchedDevice,
  });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [customFaceGroups, setCustomFaceGroups] = useState<CustomFaceGroupSummary[]>([]);
  const [customFaceGroupById, setCustomFaceGroupById] = useState<Record<string, CustomFaceGroup>>(
    {}
  );
  const [selectedCustomFaceGroupId, setSelectedCustomFaceGroupId] = useState<string>('');
  const [customFaceGroupsLoading, setCustomFaceGroupsLoading] = useState(false);
  const [customFaceInstalling, setCustomFaceInstalling] = useState(false);
  const [customFaceInstallError, setCustomFaceInstallError] = useState<string | null>(null);
  const [customFaceActivationError, setCustomFaceActivationError] = useState<string | null>(null);
  const [customFaceLoadError, setCustomFaceLoadError] = useState<string | null>(null);
  const { refreshInputBindings } = registry;

  useEffect(() => {
    void refreshInputBindings();
  }, [refreshInputBindings]);

  useEffect(() => {
    let disposed = false;
    void loadCustomFaceLibraryEntries()
      .then(({ groups, groupById }) => {
        if (disposed) {
          return;
        }
        if (groups.length === 0) {
          return;
        }
        applyLoadedCustomFaceGroups(groups, groupById);
      })
      .catch((error) => {
        if (!disposed) {
          console.warn('failed to load custom face groups for device install', error);
          setCustomFaceGroups([]);
          setCustomFaceGroupById({});
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (selectedDeviceId && registry.states.some((state) => state.deviceId === selectedDeviceId)) {
      return;
    }

    const firstDeviceId = registry.states.find((state) => Boolean(state.deviceId))?.deviceId;
    setSelectedDeviceId(firstDeviceId ?? null);
  }, [registry.states, selectedDeviceId]);

  const selectedState = useMemo(
    () =>
      registry.states.find((state) => state.deviceId === selectedDeviceId) ??
      registry.states[0] ??
      null,
    [registry.states, selectedDeviceId]
  );
  const selectedDeviceDisplay = resolveDeviceDisplayCapabilities(
    selectedState?.boardId ?? null,
    selectedState
  );
  const visibleCustomFaceGroups = useMemo(
    () =>
      filterCustomFaceGroupSummariesForDisplay(customFaceGroups, {
        display: selectedDeviceDisplay,
      }),
    [customFaceGroups, selectedDeviceDisplay]
  );
  const connectionCandidates = useMemo(
    () => connectionCandidatesForDevice(selectedState, registry.states, discovery.candidates),
    [discovery.candidates, registry.states, selectedState]
  );
  const shouldShowCustomFaceInstall =
    Boolean(selectedDeviceDisplay?.face) && Boolean(selectedState?.firmwareInfo?.customFace);
  const selectedChannels = selectedState?.channels ?? [];
  const addableChannels = useMemo(() => {
    const configuredChannelIds = new Set(selectedChannels.map((channel) => channel.id));
    return getBoardAvailableChannels(selectedState?.boardId ?? DEFAULT_DEVICE_BOARD_ID).filter(
      (channel) => !configuredChannelIds.has(channel.id)
    );
  }, [selectedChannels, selectedState?.boardId]);

  useEffect(() => {
    setSelectedCustomFaceGroupId((current) => {
      if (current && visibleCustomFaceGroups.some((group) => group.groupId === current)) {
        return current;
      }
      return visibleCustomFaceGroups[0]?.groupId || '';
    });
  }, [visibleCustomFaceGroups]);

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
        channel,
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
        channel,
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

  function connectRegisteredDevice(
    deviceId: string,
    selectedTransport?: DeviceTransportConfig | null
  ) {
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

  async function installSelectedCustomFaceGroup() {
    if (!selectedState?.deviceId || !selectedCustomFaceGroupId) {
      return;
    }
    setCustomFaceInstalling(true);
    setCustomFaceInstallError(null);
    setCustomFaceActivationError(null);
    try {
      const nextState = await installCustomFaceGroupToDevice(
        selectedState.deviceId,
        selectedCustomFaceGroupId
      );
      registry.upsertDeviceState(nextState);
    } catch (error) {
      setCustomFaceInstallError(error instanceof Error ? error.message : String(error));
    } finally {
      setCustomFaceInstalling(false);
    }
  }

  async function reloadCustomFaceGroups() {
    setCustomFaceGroupsLoading(true);
    setCustomFaceLoadError(null);
    try {
      const { groups, groupById } = await loadCustomFaceLibraryEntries();
      applyLoadedCustomFaceGroups(groups, groupById);
    } catch (error) {
      console.warn('failed to reload custom face groups for device install', error);
      setCustomFaceLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setCustomFaceGroupsLoading(false);
    }
  }

  async function activateBuiltinCustomFace() {
    if (!selectedState?.deviceId) {
      return;
    }
    setCustomFaceActivationError(null);
    try {
      const nextState = await setCustomFaceActiveSource(selectedState.deviceId, 'builtin', null);
      registry.upsertDeviceState(nextState);
    } catch (error) {
      setCustomFaceActivationError(error instanceof Error ? error.message : String(error));
    }
  }

  async function activateSelectedCustomFaceGroup() {
    if (!selectedState?.deviceId || !selectedState?.customFaceStatus?.installed?.groupId) {
      return;
    }
    const groupId = selectedState.customFaceStatus.installed.groupId;
    setCustomFaceActivationError(null);
    try {
      const nextState = await setCustomFaceActiveSource(selectedState.deviceId, 'custom', groupId);
      registry.upsertDeviceState(nextState);
    } catch (error) {
      setCustomFaceActivationError(error instanceof Error ? error.message : String(error));
    }
  }

  function applyLoadedCustomFaceGroups(
    groups: CustomFaceGroupSummary[],
    groupById: Record<string, CustomFaceGroup>
  ) {
    setCustomFaceGroups(groups);
    setCustomFaceGroupById(groupById);
    setSelectedCustomFaceGroupId((current) => {
      if (current && groups.some((group) => group.groupId === current)) {
        return current;
      }
      return groups[0]?.groupId || '';
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('devices.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('devices.description')}</p>
        </div>
      </div>

      <DeviceDiscoveryPanel
        discovery={discovery}
        autoConnecting={registry.connectingDeviceId === '*'}
        autoConnectError={registry.error?.scope === 'device-access' ? registry.error : null}
        onAutoConnect={registry.autoConnectRegisteredDevices}
      />

      {onOpenCustomFaceEditor ? (
        <button
          type="button"
          disabled={customFaceEditorOpen}
          title={
            customFaceEditorOpen
              ? t('devices.customFaces.openedHint')
              : t('devices.customFaces.openHint')
          }
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onOpenCustomFaceEditor}
        >
          ◈ {t('devices.customFaces.manage')}
        </button>
      ) : null}

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
          customFaceTestContext={
            shouldShowCustomFaceInstall
              ? {
                  groupById: customFaceGroupById,
                  reloading: customFaceGroupsLoading,
                  loadError: customFaceLoadError,
                  onReload: reloadCustomFaceGroups,
                }
              : null
          }
          customFaceInstallPanel={
            shouldShowCustomFaceInstall ? (
              <CustomFaceInstallPanel
                selectedState={selectedState}
                groups={customFaceGroups}
                groupById={customFaceGroupById}
                selectedGroupId={selectedCustomFaceGroupId}
                reloading={customFaceGroupsLoading}
                installing={customFaceInstalling}
                loadError={customFaceLoadError}
                installError={customFaceInstallError}
                activationError={customFaceActivationError}
                onSelectedGroupIdChange={setSelectedCustomFaceGroupId}
                onReload={reloadCustomFaceGroups}
                onInstall={installSelectedCustomFaceGroup}
                onActivateBuiltin={activateBuiltinCustomFace}
                onActivateCustom={activateSelectedCustomFaceGroup}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}

type CustomFaceInstallPanelProps = {
  selectedState: DeviceRuntimeState | null;
  groups: CustomFaceGroupSummary[];
  groupById: Record<string, CustomFaceGroup>;
  selectedGroupId: string;
  reloading: boolean;
  installing: boolean;
  loadError: string | null;
  installError: string | null;
  activationError: string | null;
  onSelectedGroupIdChange: (groupId: string) => void;
  onReload: () => void;
  onInstall: () => void;
  onActivateBuiltin: () => void;
  onActivateCustom: () => void;
};

function CustomFaceInstallPanel({
  selectedState,
  groups,
  groupById,
  selectedGroupId,
  reloading,
  installing,
  loadError,
  installError,
  activationError,
  onSelectedGroupIdChange,
  onReload,
  onInstall,
  onActivateBuiltin,
  onActivateCustom,
}: CustomFaceInstallPanelProps) {
  const t = useI18n();
  const selectedGroup = selectedGroupId ? groupById[selectedGroupId] : null;
  const display = resolveDeviceDisplayCapabilities(selectedState?.boardId ?? null, selectedState);
  const customFaceCapability = selectedState?.firmwareInfo?.customFace ?? null;
  const visibleGroups = filterCustomFaceGroupSummariesForDisplay(groups, {
    display,
  });
  const deployment = selectedGroup
    ? checkCustomFaceDeployment(selectedGroup, {
        display,
        customFace: customFaceCapability,
      })
    : null;
  const connected = selectedState?.status === 'connected';
  const installDisabled =
    installing || !connected || !selectedGroup || deployment?.allowed !== true;
  const installed = selectedState?.customFaceStatus?.installed;
  const activeSource = selectedState?.firmwareInfo?.customFaceActive?.source ?? 'builtin';
  const activeSourceLabel =
    activeSource === 'custom'
      ? t('devices.customFaces.activeSourceCustom')
      : t('devices.customFaces.activeSourceBuiltin');
  const preflightReasons = deployment?.reasons
    .map((reason) => customFaceDeploymentReasonText(reason, t))
    .join(t('devices.customFaces.preflightReasonSeparator'));

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold">{t('devices.customFaces.installTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('devices.customFaces.installDescription')}
          </p>
          {installed ? (
            <p className="text-xs text-muted-foreground">
              {t('devices.customFaces.installedGroup', {
                groupId: installed.groupId,
                bytes: installed.encodedBytes,
              })}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t('devices.customFaces.activeSourceLabel', {
              source: activeSourceLabel,
            })}
          </p>
        </div>
        <div className="flex min-w-[280px] flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>{t('devices.customFaces.groupLabel')}</Label>
            <div className="flex gap-2">
              <Select
                value={selectedGroupId}
                onValueChange={onSelectedGroupIdChange}
                disabled={visibleGroups.length === 0 || installing}
              >
                <SelectTrigger aria-label={t('devices.customFaces.groupLabel')}>
                  <SelectValue placeholder={t('devices.customFaces.noGroups')} />
                </SelectTrigger>
                <SelectContent>
                  {visibleGroups.map((group) => (
                    <SelectItem key={group.groupId} value={group.groupId}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={reloading || installing}
                title={t('devices.customFaces.reloadGroups')}
                aria-label={t('devices.customFaces.reloadGroups')}
                onClick={onReload}
              >
                <RefreshCw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <Button type="button" disabled={installDisabled} onClick={onInstall}>
            {installing ? t('devices.customFaces.installing') : t('devices.customFaces.install')}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeSource === 'builtin' ? 'secondary' : 'outline'}
          size="sm"
          disabled={!connected || installing}
          onClick={onActivateBuiltin}
        >
          {t('devices.customFaces.activateBuiltin')}
        </Button>
        <Button
          type="button"
          variant={activeSource === 'custom' ? 'secondary' : 'outline'}
          size="sm"
          disabled={!connected || installing || !installed}
          onClick={onActivateCustom}
        >
          {t('devices.customFaces.activateCustom')}
        </Button>
      </div>
      {deployment && !deployment.allowed ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('devices.customFaces.preflightFailed', {
            reasons: preflightReasons ?? '',
          })}
        </p>
      ) : null}
      {loadError ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('devices.customFaces.reloadFailed', { error: loadError })}
        </p>
      ) : null}
      {installError ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('devices.customFaces.installFailed', { error: installError })}
        </p>
      ) : null}
      {activationError ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('devices.customFaces.activationFailed', { error: activationError })}
        </p>
      ) : null}
    </section>
  );
}

function customFaceDeploymentReasonText(reason: CustomFaceDeploymentReason, t: Translator) {
  return t(`devices.customFaces.preflightReasons.${reason}`);
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
      matchedDeviceId: candidate.matchedDeviceId,
    }));
}

function latestMatchedTransportForDevice(
  deviceId: string,
  candidates: DeviceDiscoveryState['candidates']
): DeviceTransportConfig | undefined {
  const matched = candidates.find((candidate) => candidate.matchedDeviceId === deviceId);
  return matched?.transport;
}
