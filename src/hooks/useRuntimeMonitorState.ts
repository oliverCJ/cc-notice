import { useCallback, useEffect, useState } from 'react';
import { getRuntimeMonitorSnapshot, RuntimeMonitorSnapshot } from '@/api/tauriApi';

export function useRuntimeMonitorState(active: boolean) {
  const [snapshot, setSnapshot] = useState<RuntimeMonitorSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getRuntimeMonitorSnapshot();
      setSnapshot(next);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [active, refresh]);

  return {
    snapshot,
    loading,
    error,
    refresh
  };
}
