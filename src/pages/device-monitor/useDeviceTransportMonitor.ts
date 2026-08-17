import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  clearDeviceTransportMonitorEvents,
  closeDeviceTransportMonitorSession,
  closeDeviceTransportMonitorWindow,
  DeviceTransportMonitorDirection,
  DeviceTransportMonitorEvent,
  getDeviceTransportMonitorSnapshot
} from '@/api/tauriApi';

export const DEVICE_TRANSPORT_MONITOR_EVENT = 'cc-notice://device-transport-monitor-event';
const MAX_FRONTEND_EVENTS = 500;

export function useDeviceTransportMonitor(deviceId: string) {
  const [events, setEvents] = useState<DeviceTransportMonitorEvent[]>([]);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLatest, setFollowLatest] = useState(true);
  const [direction, setDirection] = useState<DeviceTransportMonitorDirection | 'all'>('all');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const followLatestRef = useRef(followLatest);

  useEffect(() => {
    followLatestRef.current = followLatest;
  }, [followLatest]);

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    void getDeviceTransportMonitorSnapshot(deviceId)
      .then((snapshot) => {
        if (disposed) {
          return;
        }
        setActive(snapshot.active);
        setEvents(snapshot.events);
        setSelectedEventId(snapshot.events[snapshot.events.length - 1]?.id ?? null);
      })
      .catch((caughtError) => {
        if (!disposed) {
          setError(String(caughtError));
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
    };
  }, [deviceId]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await closeDeviceTransportMonitorWindow(deviceId);
        } catch (caughtError) {
          console.warn('failed to close device monitor window from backend', caughtError);
          try {
            await closeDeviceTransportMonitorSession(deviceId);
          } finally {
            await getCurrentWindow().destroy();
          }
        }
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((caughtError) => {
        console.warn('failed to register device monitor close handler', caughtError);
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [deviceId]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<DeviceTransportMonitorEvent>(DEVICE_TRANSPORT_MONITOR_EVENT, (event) => {
      if (event.payload.deviceId !== deviceId) {
        return;
      }
      setEvents((current) => [...current, event.payload].slice(-MAX_FRONTEND_EVENTS));
      setActive(event.payload.status !== 'stopped');
      if (followLatestRef.current) {
        setSelectedEventId(event.payload.id);
      }
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((caughtError) => {
        if (!disposed) {
          setError(String(caughtError));
        }
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [deviceId]);

  const filteredEvents = useMemo(() => {
    return events
      .filter((event) => direction === 'all' || event.direction === direction)
      .filter((event) => !errorsOnly || event.status === 'error' || event.status === 'timeout');
  }, [direction, errorsOnly, events]);

  const clear = useCallback(async () => {
    const snapshot = await clearDeviceTransportMonitorEvents(deviceId);
    setEvents(snapshot.events);
    setActive(snapshot.active);
    setSelectedEventId(null);
  }, [deviceId]);

  return {
    active,
    clear,
    direction,
    error,
    errorsOnly,
    events,
    filteredEvents,
    followLatest,
    loading,
    selectedEvent: events.find((event) => event.id === selectedEventId) ?? null,
    selectedEventId,
    setDirection,
    setErrorsOnly,
    setFollowLatest,
    setSelectedEventId
  };
}

export type DeviceTransportMonitorState = ReturnType<typeof useDeviceTransportMonitor>;
