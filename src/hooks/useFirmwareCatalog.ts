import { useCallback, useEffect, useMemo, useState } from 'react';
import { FirmwareCatalogArtifact, getFirmwareCatalog } from '@/api/tauriApi';
import { isRecommendedFirmwareBoard } from '@/domain/firmware/firmwareDisplayMetadata';

export function useFirmwareCatalog() {
  const [artifacts, setArtifacts] = useState<FirmwareCatalogArtifact[]>([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await getFirmwareCatalog();
      const visibleArtifacts = catalog.artifacts.filter((artifact) => artifact.visible !== false);
      setArtifacts(visibleArtifacts);
      setSelectedArtifactId((currentArtifactId) => {
        if (visibleArtifacts.some((artifact) => artifact.artifactId === currentArtifactId)) {
          return currentArtifactId;
        }
        return (
          visibleArtifacts.find((artifact) => isRecommendedFirmwareBoard(artifact.boardId))
            ?.artifactId ??
          visibleArtifacts[0]?.artifactId ??
          null
        );
      });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedArtifact = useMemo(
    () =>
      artifacts.find((artifact) => artifact.artifactId === selectedArtifactId) ??
      artifacts[0] ??
      null,
    [artifacts, selectedArtifactId]
  );

  return {
    artifacts,
    selectedArtifact,
    selectedArtifactId,
    setSelectedArtifactId,
    loading,
    error,
    refresh
  };
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
