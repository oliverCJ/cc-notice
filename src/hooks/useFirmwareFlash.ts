import { useCallback, useEffect, useState } from 'react';
import {
  FirmwareFlashPortTarget,
  FirmwareFlashResult,
  FirmwareFlashStatus,
  flashFirmware,
  getFirmwareFlashTargets,
  getFirmwareFlashStatus
} from '@/api/tauriApi';

export function useFirmwareFlash(artifactId: string | null) {
  const [flashStatus, setFlashStatus] = useState<FirmwareFlashStatus | null>(null);
  const [flashTargets, setFlashTargets] = useState<FirmwareFlashPortTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [flashResult, setFlashResult] = useState<FirmwareFlashResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFlashStatus = useCallback(async () => {
    if (!artifactId) {
      setFlashStatus(null);
      return;
    }
    setLoadingStatus(true);
    setError(null);
    try {
      const status = await getFirmwareFlashStatus(artifactId);
      setFlashStatus(status);
    } catch (statusError) {
      setError(toErrorMessage(statusError));
    } finally {
      setLoadingStatus(false);
    }
  }, [artifactId]);

  const refreshFlashTargets = useCallback(async () => {
    if (!artifactId) {
      setFlashTargets([]);
      setSelectedTargetId(null);
      return;
    }
    setLoadingTargets(true);
    setError(null);
    try {
      const nextTargets = await getFirmwareFlashTargets(artifactId);
      setFlashTargets(nextTargets);
      setSelectedTargetId((currentTargetId) => {
        if (currentTargetId && nextTargets.some((target) => target.targetId === currentTargetId)) {
          return currentTargetId;
        }
        return nextTargets[0]?.targetId ?? null;
      });
    } catch (targetError) {
      setError(toErrorMessage(targetError));
    } finally {
      setLoadingTargets(false);
    }
  }, [artifactId]);

  useEffect(() => {
    setFlashResult(null);
    refreshFlashStatus();
    refreshFlashTargets();
  }, [refreshFlashStatus, refreshFlashTargets]);

  const runFlash = useCallback(async () => {
    if (!artifactId) {
      return;
    }
    setFlashing(true);
    setError(null);
    setFlashResult(null);
    try {
      const result = await flashFirmware({ artifactId, targetId: selectedTargetId });
      setFlashResult(result);
    } catch (flashError) {
      setError(toErrorMessage(flashError));
    } finally {
      setFlashing(false);
    }
  }, [artifactId, selectedTargetId]);

  return {
    flashStatus,
    flashTargets,
    selectedTargetId,
    flashResult,
    loadingStatus,
    loadingTargets,
    flashing,
    error,
    setSelectedTargetId,
    refreshFlashStatus,
    refreshFlashTargets,
    runFlash
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
