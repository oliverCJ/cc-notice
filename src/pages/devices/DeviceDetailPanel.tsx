import { useState } from 'react';
import {
  DeviceChannel,
  DeviceInputBinding,
  DeviceRuntimeState,
  DeviceTransportConfig
} from '@/api/tauriApi';
import { DeviceRuntimeRegistryState } from '@/hooks/useDeviceRuntimeRegistry';
import { DeviceChannelTable } from './DeviceChannelTable';
import { DeviceConnectionCandidate, DeviceConnectionControls } from './DeviceConnectionControls';
import { DeviceHeartbeatStatusPanel } from './DeviceHeartbeatStatusPanel';
import { DeviceIdentityPanel } from './DeviceIdentityPanel';
import { DeviceInputBindingDialog } from './DeviceInputBindingDialog';
import { DeviceInputTestPanel } from './DeviceInputTestPanel';
import { DeviceOperationDialog } from './DeviceOperationDialog';
import { DeviceRuntimeStatusPanel } from './DeviceRuntimeStatusPanel';
import { DeviceTestActionPanel } from './DeviceTestActionPanel';
import { DeviceExtensionPanel } from './DeviceExtensionPanel';

type DeviceDetailPanelProps = {
  fallbackBoardId: string;
  selectedState: DeviceRuntimeState | null;
  selectedChannels: DeviceChannel[];
  addableChannels: DeviceChannel[];
  connectionCandidates: DeviceConnectionCandidate[];
  registry: DeviceRuntimeRegistryState;
  onConnectDevice: DeviceConnectionControlsPropsOnConnect;
  onAddChannel: (channel: DeviceChannel) => void;
  onRemoveChannel: (channelId: string) => void;
  onUpdateChannelMode: (channelId: string, direction: 'output' | 'input') => void;
  onRefreshCapabilities: () => void;
  onOpenRulesPage?: () => void;
  onOpenDiagnosticsCenter?: () => void;
  onOpenTransportMonitor: (deviceId: string) => void;
};

export function DeviceDetailPanel({
  fallbackBoardId,
  selectedState,
  selectedChannels,
  addableChannels,
  connectionCandidates,
  registry,
  onConnectDevice,
  onAddChannel,
  onRemoveChannel,
  onUpdateChannelMode,
  onRefreshCapabilities,
  onOpenRulesPage,
  onOpenDiagnosticsCenter,
  onOpenTransportMonitor
}: DeviceDetailPanelProps) {
  const [operationCancelling, setOperationCancelling] = useState(false);
  const [inputChannelDraft, setInputChannelDraft] = useState<DeviceChannel | null>(null);
  const currentInputBinding = findInputBinding(
    registry.inputBindings,
    selectedState?.deviceId ?? null,
    inputChannelDraft?.id ?? null
  );

  return (
    <div className="space-y-4">
      <DeviceOperationDialog
        state={selectedState}
        cancelling={operationCancelling}
        onCancel={(deviceId, operationId) => {
          setOperationCancelling(true);
          void registry.cancelDeviceOperation(deviceId, operationId).finally(() => {
            setOperationCancelling(false);
          });
        }}
      />
      <DeviceConnectionControls
        selectedState={selectedState}
        connectionCandidates={connectionCandidates}
        connectingDeviceId={registry.connectingDeviceId}
        error={registry.error}
        onConnect={onConnectDevice}
        onDisconnect={registry.disconnectDevice}
        onDisconnectAll={registry.disconnectAllDevices}
        onOpenTransportMonitor={onOpenTransportMonitor}
      />
      <DeviceIdentityPanel
        selectedState={selectedState}
        busy={Boolean(selectedState?.deviceId && registry.connectingDeviceId === selectedState.deviceId)}
        error={registry.error}
        onResetIdentity={registry.resetDeviceIdentity}
      />
      <DeviceHeartbeatStatusPanel selectedState={selectedState} />
      <DeviceChannelTable
        boardId={selectedState?.boardId ?? fallbackBoardId}
        deviceId={selectedState?.deviceId ?? null}
        channels={selectedChannels}
        availableChannels={addableChannels}
        inputBindings={registry.inputBindings}
        error={registry.error?.code === 'device-channel-referenced-by-output-rule' ? registry.error : null}
        onAddChannel={onAddChannel}
        onRemoveChannel={onRemoveChannel}
        onUpdateChannelMode={onUpdateChannelMode}
        onConfigureInput={setInputChannelDraft}
        onRefreshCapabilities={onRefreshCapabilities}
        onOpenRulesPage={onOpenRulesPage}
      />
      <DeviceInputBindingDialog
        key={createInputBindingDialogKey(
          selectedState?.deviceId ?? null,
          inputChannelDraft?.id ?? null,
          currentInputBinding?.id ?? null
        )}
        open={Boolean(inputChannelDraft)}
        deviceId={selectedState?.deviceId ?? null}
        channel={inputChannelDraft}
        binding={currentInputBinding}
        saving={registry.actionStatus === 'sending'}
        onOpenChange={(open) => {
          if (!open) {
            setInputChannelDraft(null);
          }
        }}
        onSave={(nextBinding) => {
          void registry.saveInputBindings(upsertBinding(registry.inputBindings, nextBinding));
          setInputChannelDraft(null);
        }}
      />
      <DeviceInputTestPanel
        selectedState={selectedState}
        channels={selectedChannels}
        inputBindings={registry.inputBindings}
      />
      <DeviceTestActionPanel
        selectedState={selectedState}
        channels={selectedChannels}
        actionStatus={registry.actionStatus}
        onSend={registry.sendTestAction}
      />
      <DeviceExtensionPanel
        selectedState={selectedState}
        actionStatus={registry.actionStatus}
        onSend={registry.sendExtensionAction}
      />
      <DeviceRuntimeStatusPanel
        selectedState={selectedState}
        error={registry.error}
        onCheckFirmware={registry.checkDeviceFirmware}
        onOpenDiagnostics={onOpenDiagnosticsCenter}
      />
    </div>
  );
}

type DeviceConnectionControlsPropsOnConnect = (
  deviceId: string,
  transport?: DeviceTransportConfig | null
) => void;

function findInputBinding(
  bindings: DeviceInputBinding[],
  deviceId: string | null,
  channelId: string | null
) {
  if (!deviceId || !channelId) {
    return null;
  }
  return (
    bindings.find((binding) => binding.deviceId === deviceId && binding.channelId === channelId) ??
    null
  );
}

function upsertBinding(bindings: DeviceInputBinding[], nextBinding: DeviceInputBinding) {
  const exists = bindings.some((binding) => binding.id === nextBinding.id);
  if (!exists) {
    return [...bindings, nextBinding];
  }
  return bindings.map((binding) => (binding.id === nextBinding.id ? nextBinding : binding));
}

function createInputBindingDialogKey(
  deviceId: string | null,
  channelId: string | null,
  bindingId: string | null
) {
  if (!deviceId || !channelId) {
    return 'input-binding-dialog:closed';
  }
  return `input-binding-dialog:${deviceId}:${channelId}:${bindingId ?? 'new'}`;
}
