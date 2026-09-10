import { useCallback, useEffect, useRef, useState } from 'react';
import { checkForAppUpdate } from '@/api/tauriApi';
import type { AppUpdateCheckResult } from '@/api/tauriApi';
import type { AppUpdateState } from '@/domain/appUpdate';

const AUTOMATIC_CHECK_COOLDOWN_MS = 5 * 60 * 1000;
const APP_UPDATE_CHECK_TIMEOUT_MS = 15 * 1000;

async function checkForAppUpdateWithTimeout(): Promise<AppUpdateCheckResult> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('app update check timed out'));
    }, APP_UPDATE_CHECK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([checkForAppUpdate(), timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({
    status: 'idle',
    result: null,
    error: null,
    lastCheckedAt: null,
    checking: false,
  });
  const requestRef = useRef<Promise<AppUpdateCheckResult> | null>(null);
  const autoCheckStartedRef = useRef(false);
  const lastSuccessfulCheckAtRef = useRef<number | null>(null);
  const resultRef = useRef<AppUpdateCheckResult | null>(null);

  const runCheck = useCallback(async (automatic: boolean) => {
    const now = Date.now();
    if (
      automatic &&
      lastSuccessfulCheckAtRef.current !== null &&
      now - lastSuccessfulCheckAtRef.current < AUTOMATIC_CHECK_COOLDOWN_MS
    ) {
      return resultRef.current;
    }

    if (requestRef.current) {
      return requestRef.current;
    }

    setState((current) => ({ ...current, status: 'checking', checking: true, error: null }));
    const request = checkForAppUpdateWithTimeout();
    requestRef.current = request;

    try {
      const result = await request;
      const checkedAt = Date.now();
      lastSuccessfulCheckAtRef.current = checkedAt;
      resultRef.current = result;
      setState({
        status: result.status,
        result,
        error: null,
        lastCheckedAt: checkedAt,
        checking: false,
      });
      return result;
    } catch (caught) {
      const error = caught instanceof Error ? caught.message : String(caught);
      console.warn('failed to check for app update', caught);
      setState((current) => ({
        ...current,
        status: 'error',
        error,
        lastCheckedAt: Date.now(),
        checking: false,
      }));
      return null;
    } finally {
      requestRef.current = null;
    }
  }, []);

  const checkAutomatically = useCallback(() => runCheck(true), [runCheck]);
  const checkManually = useCallback(() => runCheck(false), [runCheck]);

  useEffect(() => {
    if (autoCheckStartedRef.current) {
      return;
    }
    autoCheckStartedRef.current = true;
    void checkAutomatically();
  }, [checkAutomatically]);

  return {
    ...state,
    checkAutomatically,
    checkManually,
  };
}
