import { useEffect, useMemo, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { DeviceRuntimeRegistryState } from './useDeviceRuntimeRegistry';

const DEVICE_AUTOMATION_START_DELAY_MS = 15_000;
const DEVICE_HEARTBEAT_INTERVAL_MS_AFTER_START = 30_000;
const DEVICE_AUTO_CONNECT_RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000] as const;
const DEVICE_RUNTIME_UPDATED_EVENT = 'cc-notice://device-runtime-updated';

export function useDeviceRuntimeAutomation(registry: DeviceRuntimeRegistryState) {
  const autoConnectInFlightRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);

  const runAutoConnect = () => {
    if (autoConnectInFlightRef.current) {
      return;
    }
    autoConnectInFlightRef.current = true;
    void registry.autoConnectRegisteredDevices().finally(() => {
      autoConnectInFlightRef.current = false;
    });
  };

  const runHeartbeat = () => {
    if (heartbeatInFlightRef.current) {
      return;
    }
    heartbeatInFlightRef.current = true;
    void registry.pingConnectedDevices().finally(() => {
      heartbeatInFlightRef.current = false;
    });
  };

  useEffect(() => {
    void registry.refreshStates();
  }, [registry.refreshStates]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void listen(DEVICE_RUNTIME_UPDATED_EVENT, () => {
      void registry.refreshStates();
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => {
        console.warn('failed to initialize device runtime listener', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [registry.refreshStates]);

  const connectedDeviceKey = useMemo(
    () =>
      registry.states
        .filter((state) => state.status === 'connected' && state.deviceId)
        .map((state) => state.deviceId)
        .join('|'),
    [registry.states]
  );

  const reconnectableDeviceKey = useMemo(
    () =>
      registry.states
        .filter((state) => state.status !== 'connected')
        .filter((state) => !state.manualReconnectSuppressed)
        .filter((state) => state.deviceUid)
        .map((state) => state.deviceId)
        .filter(Boolean)
        .join('|'),
    [registry.states]
  );

  useEffect(() => {
    if (!connectedDeviceKey) {
      return;
    }

    let intervalTimer: number | undefined;
    const startTimer = window.setTimeout(() => {
      runHeartbeat();
      intervalTimer = window.setInterval(() => {
        runHeartbeat();
      }, DEVICE_HEARTBEAT_INTERVAL_MS_AFTER_START);
    }, DEVICE_AUTOMATION_START_DELAY_MS);

    return () => {
      window.clearTimeout(startTimer);
      if (intervalTimer !== undefined) {
        window.clearInterval(intervalTimer);
      }
    };
  }, [connectedDeviceKey, registry.pingConnectedDevices]);

  useEffect(() => {
    if (!reconnectableDeviceKey || registry.connectingDeviceId) {
      return;
    }

    let disposed = false;
    let timer: number | undefined;
    let attemptIndex = 0;

    const scheduleNext = () => {
      const delayIndex = Math.min(attemptIndex, DEVICE_AUTO_CONNECT_RETRY_DELAYS_MS.length - 1);
      const delayMs = DEVICE_AUTO_CONNECT_RETRY_DELAYS_MS[delayIndex];
      timer = window.setTimeout(() => {
        if (disposed) {
          return;
        }
        attemptIndex += 1;
        runAutoConnect();
        scheduleNext();
      }, delayMs);
    };

    scheduleNext();

    return () => {
      disposed = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [reconnectableDeviceKey, registry.autoConnectRegisteredDevices, registry.connectingDeviceId]);
}
