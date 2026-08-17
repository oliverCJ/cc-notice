import { useCallback, useRef, useState } from 'react';
import {
  DeviceChannelAction,
  DeviceExtensionAction,
  DeviceInputBinding,
  DevicePortDescriptor,
  DeviceRuntimeState,
  DeviceChannel,
  DeviceTransportConfig,
  autoConnectRegisteredDevices as autoConnectRegisteredDevicesApi,
  cancelDeviceOperation as cancelDeviceOperationApi,
  checkDeviceFirmware as checkDeviceFirmwareApi,
  connectDevice as connectDeviceApi,
  disconnectAllDevices as disconnectAllDevicesApi,
  disconnectDevice as disconnectDeviceApi,
  getDeviceRuntimeStates,
  getDeviceInputBindings,
  pingConnectedDevices as pingConnectedDevicesApi,
  removeRegisteredDevice as removeRegisteredDeviceApi,
  scanDeviceTransports,
  sendDeviceTestAction,
  sendDeviceExtensionAction,
  saveDeviceInputBindings,
  resetDeviceIdentity as resetDeviceIdentityApi,
  updateDeviceChannels as updateDeviceChannelsApi
} from '@/api/tauriApi';

export type DeviceActionStatus = 'idle' | 'sending' | 'sent' | 'skipped' | 'failed';
export type DeviceRuntimeErrorScope = 'device-access' | 'connection' | 'removal' | 'runtime';

export type DeviceRuntimeError = {
  message: string;
  scope?: DeviceRuntimeErrorScope;
  code?: 'device-referenced-by-output-rule' | 'device-channel-referenced-by-output-rule';
  deviceId?: string;
  channelId?: string;
  ruleId?: string;
};

export type DeviceRuntimeRegistryState = {
  states: DeviceRuntimeState[];
  ports: DevicePortDescriptor[];
  inputBindings: DeviceInputBinding[];
  loading: boolean;
  scanning: boolean;
  connectingDeviceId: string | null;
  actionStatus: DeviceActionStatus;
  error: DeviceRuntimeError | null;
  upsertDeviceState: (state: DeviceRuntimeState) => void;
  refreshStates: () => Promise<void>;
  autoConnectRegisteredDevices: () => Promise<void>;
  scanTransports: () => Promise<void>;
  connectDevice: (deviceId: string, transport?: DeviceTransportConfig | null) => Promise<void>;
  cancelDeviceOperation: (deviceId: string, operationId: number) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  disconnectAllDevices: () => Promise<void>;
  removeRegisteredDevice: (deviceId: string) => Promise<void>;
  resetDeviceIdentity: (deviceId: string) => Promise<void>;
  pingConnectedDevices: () => Promise<void>;
  sendTestAction: (request: DeviceChannelAction) => Promise<void>;
  sendExtensionAction: (request: DeviceExtensionAction) => Promise<void>;
  updateDeviceChannels: (deviceId: string, channels: DeviceChannel[]) => Promise<void>;
  refreshInputBindings: () => Promise<void>;
  saveInputBindings: (bindings: DeviceInputBinding[]) => Promise<void>;
  checkDeviceFirmware: (deviceId: string) => Promise<void>;
};

export function useDeviceRuntimeRegistry(): DeviceRuntimeRegistryState {
  const [states, setStates] = useState<DeviceRuntimeState[]>([]);
  const [ports, setPorts] = useState<DevicePortDescriptor[]>([]);
  const [inputBindings, setInputBindings] = useState<DeviceInputBinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<DeviceActionStatus>('idle');
  const [error, setError] = useState<DeviceRuntimeError | null>(null);

  const refreshSeq = useRef(0);
  const scanSeq = useRef(0);
  const inputBindingSeq = useRef(0);
  const stateReplaceSeq = useRef(0);
  const actionSeq = useRef(0);

  const nextStateReplaceRequestId = useCallback(() => {
    const requestId = stateReplaceSeq.current + 1;
    stateReplaceSeq.current = requestId;
    return requestId;
  }, []);

  const replaceStatesIfLatest = useCallback((requestId: number, nextStates: DeviceRuntimeState[]) => {
    if (stateReplaceSeq.current === requestId) {
      setStates(normalizeDeviceStates(nextStates));
    }
  }, []);

  const updateDeviceState = useCallback((nextState: DeviceRuntimeState) => {
    setStates((currentStates) => {
      const deviceId = nextState.deviceId;
      if (!deviceId) {
        return currentStates;
      }

      const existingIndex = currentStates.findIndex((state) => state.deviceId === deviceId);
      if (existingIndex < 0) {
        return [...currentStates, nextState];
      }

      return currentStates.map((state, index) => (index === existingIndex ? nextState : state));
    });
  }, []);

  const mergeExistingDeviceStates = useCallback((nextStates: DeviceRuntimeState[]) => {
    const nextStateByDeviceId = new Map(
      normalizeDeviceStates(nextStates)
        .filter((state) => Boolean(state.deviceId))
        .map((state) => [state.deviceId, state])
    );
    setStates((currentStates) =>
      currentStates.map((state) => {
        if (!state.deviceId) {
          return state;
        }
        return nextStateByDeviceId.get(state.deviceId) ?? state;
      })
    );
  }, []);

  const refreshStates = useCallback(async () => {
    const requestId = refreshSeq.current + 1;
    refreshSeq.current = requestId;
    const stateRequestId = nextStateReplaceRequestId();
    setLoading(true);
    setError(null);

    try {
      const nextStates = await getDeviceRuntimeStates();
      if (refreshSeq.current === requestId) {
        replaceStatesIfLatest(stateRequestId, nextStates);
      }
    } catch (caughtError) {
      if (refreshSeq.current === requestId) {
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    } finally {
      if (refreshSeq.current === requestId) {
        setLoading(false);
      }
    }
  }, [nextStateReplaceRequestId, replaceStatesIfLatest]);

  const scanTransports = useCallback(async () => {
    const requestId = scanSeq.current + 1;
    scanSeq.current = requestId;
    setScanning(true);
    setError(null);

    try {
      const nextPorts = await scanDeviceTransports();
      if (scanSeq.current === requestId) {
        setPorts(nextPorts);
      }
    } catch (caughtError) {
      if (scanSeq.current === requestId) {
        setError(toRuntimeError(caughtError, 'connection'));
      }
    } finally {
      if (scanSeq.current === requestId) {
        setScanning(false);
      }
    }
  }, []);

  const connectDevice = useCallback(
    async (deviceId: string, transport?: DeviceTransportConfig | null) => {
      setConnectingDeviceId(deviceId);
      setError(null);

      try {
        const nextState = await connectDeviceApi(deviceId, transport);
        updateDeviceState(nextState);
      } catch (caughtError) {
        setError(toRuntimeError(caughtError, 'connection'));
      } finally {
        setConnectingDeviceId((currentDeviceId) => (currentDeviceId === deviceId ? null : currentDeviceId));
      }
    },
    [updateDeviceState]
  );

  const autoConnectRegisteredDevices = useCallback(async () => {
    const requestId = nextStateReplaceRequestId();
    setConnectingDeviceId('*');
    setError(null);

    try {
      const nextStates = await autoConnectRegisteredDevicesApi();
      replaceStatesIfLatest(requestId, nextStates);
    } catch (caughtError) {
      setError(toRuntimeError(caughtError, 'device-access'));
    } finally {
      setConnectingDeviceId(null);
    }
  }, [nextStateReplaceRequestId, replaceStatesIfLatest]);

  const cancelDeviceOperation = useCallback(
    async (deviceId: string, operationId: number) => {
      setError(null);

      try {
        const nextState = await cancelDeviceOperationApi(deviceId, operationId);
        updateDeviceState(nextState);
      } catch (caughtError) {
        setError(toRuntimeError(caughtError, 'connection'));
      } finally {
        setConnectingDeviceId((currentDeviceId) => (currentDeviceId === deviceId ? null : currentDeviceId));
      }
    },
    [updateDeviceState]
  );

  const disconnectDevice = useCallback(
    async (deviceId: string) => {
      setConnectingDeviceId(deviceId);
      setError(null);

      try {
        const nextState = await disconnectDeviceApi(deviceId);
        updateDeviceState(nextState);
      } catch (caughtError) {
        setError(toRuntimeError(caughtError, 'connection'));
      } finally {
        setConnectingDeviceId((currentDeviceId) => (currentDeviceId === deviceId ? null : currentDeviceId));
      }
    },
    [updateDeviceState]
  );

  const disconnectAllDevices = useCallback(async () => {
    const requestId = nextStateReplaceRequestId();
    setConnectingDeviceId('*');
    setError(null);

    try {
      const nextStates = await disconnectAllDevicesApi();
      replaceStatesIfLatest(requestId, nextStates);
    } catch (caughtError) {
      setError(toRuntimeError(caughtError, 'connection'));
    } finally {
      setConnectingDeviceId(null);
    }
  }, [nextStateReplaceRequestId, replaceStatesIfLatest]);

  const removeRegisteredDevice = useCallback(async (deviceId: string) => {
    const requestId = nextStateReplaceRequestId();
    setConnectingDeviceId(deviceId);
    setError(null);

    try {
      const nextStates = await removeRegisteredDeviceApi(deviceId);
      replaceStatesIfLatest(requestId, nextStates);
    } catch (caughtError) {
      setError(toRuntimeError(caughtError, 'removal'));
    } finally {
      setConnectingDeviceId((currentDeviceId) => (currentDeviceId === deviceId ? null : currentDeviceId));
    }
  }, [nextStateReplaceRequestId, replaceStatesIfLatest]);

  const resetDeviceIdentity = useCallback(
    async (deviceId: string) => {
      setConnectingDeviceId(deviceId);
      setError(null);

      try {
        const nextState = await resetDeviceIdentityApi(deviceId);
        updateDeviceState(nextState);
      } catch (caughtError) {
        setError(toRuntimeError(caughtError, 'connection'));
      } finally {
        setConnectingDeviceId((currentDeviceId) => (currentDeviceId === deviceId ? null : currentDeviceId));
      }
    },
    [updateDeviceState]
  );

  const pingConnectedDevices = useCallback(async () => {
    try {
      const nextStates = await pingConnectedDevicesApi();
      mergeExistingDeviceStates(nextStates);
    } catch (caughtError) {
      setError(toRuntimeError(caughtError, 'runtime'));
    }
  }, [mergeExistingDeviceStates]);

  const sendTestAction = useCallback(
    async (request: DeviceChannelAction) => {
      const requestId = actionSeq.current + 1;
      actionSeq.current = requestId;
      const deviceState = states.find((state) => state.deviceId === request.deviceId);
      if (!deviceState || deviceState.status !== 'connected') {
        setActionStatus('skipped');
        return;
      }

      setActionStatus('sending');
      setError(null);

      try {
        const result = await sendDeviceTestAction(request);
        if (actionSeq.current !== requestId) {
          return;
        }
        setActionStatus(result.status === 'failed' ? 'failed' : result.status === 'skipped' ? 'skipped' : 'sent');
        if (result.error) {
          setError(toRuntimeError(result.error, 'runtime'));
        }
        await refreshStates();
      } catch (caughtError) {
        if (actionSeq.current !== requestId) {
          return;
        }
        setActionStatus('failed');
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    },
    [refreshStates, states]
  );

  const sendExtensionAction = useCallback(
    async (request: DeviceExtensionAction) => {
      const requestId = actionSeq.current + 1;
      actionSeq.current = requestId;
      const deviceState = states.find((state) => state.deviceId === request.deviceId);
      if (!deviceState || deviceState.status !== 'connected') {
        setActionStatus('skipped');
        return;
      }

      setActionStatus('sending');
      setError(null);

      try {
        const result = await sendDeviceExtensionAction(request);
        if (actionSeq.current !== requestId) {
          return;
        }
        setActionStatus(result.status === 'failed' ? 'failed' : result.status === 'skipped' ? 'skipped' : 'sent');
        if (result.error) {
          setError(toRuntimeError(result.error, 'runtime'));
        }
        await refreshStates();
      } catch (caughtError) {
        if (actionSeq.current !== requestId) {
          return;
        }
        setActionStatus('failed');
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    },
    [refreshStates, states]
  );

  const updateDeviceChannels = useCallback(
    async (deviceId: string, channels: DeviceChannel[]) => {
      setError(null);
      try {
        const nextState = await updateDeviceChannelsApi(deviceId, channels);
        updateDeviceState(nextState);
        const nextBindings = await getDeviceInputBindings();
        setInputBindings(nextBindings);
      } catch (caughtError) {
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    },
    [updateDeviceState]
  );

  const refreshInputBindings = useCallback(async () => {
    const requestId = inputBindingSeq.current + 1;
    inputBindingSeq.current = requestId;
    setError(null);

    try {
      const nextBindings = await getDeviceInputBindings();
      if (inputBindingSeq.current === requestId) {
        setInputBindings(nextBindings);
      }
    } catch (caughtError) {
      if (inputBindingSeq.current === requestId) {
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    }
  }, []);

  const saveInputBindings = useCallback(async (bindings: DeviceInputBinding[]) => {
    const requestId = inputBindingSeq.current + 1;
    inputBindingSeq.current = requestId;
    setError(null);

    try {
      const nextBindings = await saveDeviceInputBindings(bindings);
      if (inputBindingSeq.current === requestId) {
        setInputBindings(nextBindings);
      }
    } catch (caughtError) {
      if (inputBindingSeq.current === requestId) {
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    }
  }, []);

  const checkDeviceFirmware = useCallback(
    async (deviceId: string) => {
      setError(null);
      try {
        const nextState = await checkDeviceFirmwareApi(deviceId);
        updateDeviceState(nextState);
      } catch (caughtError) {
        setError(toRuntimeError(caughtError, 'runtime'));
      }
    },
    [updateDeviceState]
  );

  return {
    states,
    ports,
    inputBindings,
    loading,
    scanning,
    connectingDeviceId,
    actionStatus,
    error,
    upsertDeviceState: updateDeviceState,
    refreshStates,
    autoConnectRegisteredDevices,
    cancelDeviceOperation,
    scanTransports,
    connectDevice,
    disconnectDevice,
    disconnectAllDevices,
    removeRegisteredDevice,
    resetDeviceIdentity,
    pingConnectedDevices,
    sendTestAction,
    sendExtensionAction,
    updateDeviceChannels,
    refreshInputBindings,
    saveInputBindings,
    checkDeviceFirmware
  };
}

function toRuntimeError(
  error: unknown,
  scope: DeviceRuntimeErrorScope
): DeviceRuntimeError {
  const message = toErrorMessage(error);
  const referencedChannel = parseReferencedChannelError(message);
  if (referencedChannel) {
    return {
      code: 'device-channel-referenced-by-output-rule',
      message,
      scope,
      ...referencedChannel
    };
  }
  const referencedDevice = parseReferencedDeviceError(message);
  if (referencedDevice) {
    return {
      code: 'device-referenced-by-output-rule',
      message,
      scope,
      ...referencedDevice
    };
  }
  return { message, scope };
}

function parseReferencedChannelError(message: string): { channelId: string; ruleId: string } | null {
  const matched = /^device\s+channel\s+(.+)\s+is used by output rule\s+(.+)$/.exec(
    message.trim()
  );
  if (!matched) {
    return null;
  }
  return {
    channelId: matched[1],
    ruleId: matched[2]
  };
}

function normalizeDeviceStates(states: DeviceRuntimeState[] | unknown): DeviceRuntimeState[] {
  if (Array.isArray(states)) {
    return states;
  }

  console.warn('device runtime state response is not an array; keeping empty device state list');
  return [];
}

function parseReferencedDeviceError(message: string): { deviceId: string; ruleId: string } | null {
  const matched = /^device\s+(.+)\s+is used by output rule\s+(.+)$/.exec(message.trim());
  if (!matched) {
    return null;
  }
  return {
    deviceId: matched[1],
    ruleId: matched[2]
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'unknown error';
}
