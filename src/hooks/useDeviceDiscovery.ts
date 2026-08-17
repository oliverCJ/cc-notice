import { useCallback, useRef, useState } from 'react';
import {
  DeviceCandidateResource,
  DeviceRuntimeState,
  identifyDeviceCandidate as identifyDeviceCandidateApi,
  registerIdentifiedDevice,
  scanDeviceCandidates
} from '@/api/tauriApi';

export type DeviceDiscoveryState = {
  candidates: DeviceCandidateResource[];
  scanning: boolean;
  identifyingResourceId: string | null;
  registeringResourceId: string | null;
  error: string | null;
  scanCandidates: () => Promise<void>;
  identifyCandidate: (resource: DeviceCandidateResource) => Promise<void>;
  registerCandidate: (resource: DeviceCandidateResource, label: string) => Promise<void>;
};

type DeviceDiscoveryOptions = {
  onRegisteredDevice?: (state: DeviceRuntimeState) => void;
  onIdentifiedMatchedDevice?: (resource: DeviceCandidateResource) => void;
};

export function useDeviceDiscovery(options: DeviceDiscoveryOptions = {}): DeviceDiscoveryState {
  const { onIdentifiedMatchedDevice, onRegisteredDevice } = options;
  const [candidates, setCandidates] = useState<DeviceCandidateResource[]>([]);
  const [scanning, setScanning] = useState(false);
  const [identifyingResourceId, setIdentifyingResourceId] = useState<string | null>(null);
  const [registeringResourceId, setRegisteringResourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scanSeq = useRef(0);

  const updateCandidate = useCallback((nextCandidate: DeviceCandidateResource) => {
    setCandidates((currentCandidates) =>
      currentCandidates.map((candidate) =>
        candidate.resourceId === nextCandidate.resourceId ? nextCandidate : candidate
      )
    );
  }, []);

  const scanCandidates = useCallback(async () => {
    const requestId = scanSeq.current + 1;
    scanSeq.current = requestId;
    setScanning(true);
    setError(null);

    try {
      const nextCandidates = await scanDeviceCandidates();
      if (scanSeq.current === requestId) {
        setCandidates(nextCandidates);
      }
    } catch (caughtError) {
      if (scanSeq.current === requestId) {
        setError(toErrorMessage(caughtError));
      }
    } finally {
      if (scanSeq.current === requestId) {
        setScanning(false);
      }
    }
  }, []);

  const identifyCandidate = useCallback(
    async (resource: DeviceCandidateResource) => {
      setIdentifyingResourceId(resource.resourceId);
      setError(null);

      try {
        const nextCandidate = await identifyDeviceCandidateApi(
          resource.resourceId,
          resource.displayName,
          resource.transport
        );
        updateCandidate(nextCandidate);
        if (nextCandidate.matchedDeviceId) {
          onIdentifiedMatchedDevice?.(nextCandidate);
        }
      } catch (caughtError) {
        setError(toErrorMessage(caughtError));
      } finally {
        setIdentifyingResourceId((currentId) =>
          currentId === resource.resourceId ? null : currentId
        );
      }
    },
    [onIdentifiedMatchedDevice, updateCandidate]
  );

  const registerCandidate = useCallback(
    async (resource: DeviceCandidateResource, label: string) => {
      setRegisteringResourceId(resource.resourceId);
      setError(null);

      try {
        const registeredState = await registerIdentifiedDevice(resource, label);
        onRegisteredDevice?.(registeredState);
        setCandidates((currentCandidates) =>
          currentCandidates.map((candidate) =>
            candidate.resourceId === resource.resourceId
              ? {
                  ...candidate,
                  discoveryStatus: 'matched',
                  deviceUid: registeredState.deviceUid ?? resource.deviceUid ?? null,
                  matchedDeviceId: registeredState.deviceId ?? null,
                  error: null
                }
              : candidate
          )
        );
      } catch (caughtError) {
        setError(toErrorMessage(caughtError));
      } finally {
        setRegisteringResourceId((currentId) =>
          currentId === resource.resourceId ? null : currentId
        );
      }
    },
    [onRegisteredDevice]
  );

  return {
    candidates,
    scanning,
    identifyingResourceId,
    registeringResourceId,
    error,
    scanCandidates,
    identifyCandidate,
    registerCandidate
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
