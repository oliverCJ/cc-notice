import { useCallback, useEffect, useRef, useState } from 'react';
import { DiagnosticsSnapshot, getDiagnosticsSnapshot } from '@/api/tauriApi';

export function useDiagnosticsState(active: boolean) {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setLoading(true);
    try {
      const nextSnapshot = await getDiagnosticsSnapshot();
      if (requestSeq.current === requestId) {
        setSnapshot(nextSnapshot);
        setError(null);
      }
    } catch (caught) {
      if (requestSeq.current === requestId) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (requestSeq.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    void refresh();
  }, [active, refresh]);

  return {
    snapshot,
    loading,
    error,
    refresh
  };
}
