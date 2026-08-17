import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useDebugState } from './useDebugState';

const apiMocks = vi.hoisted(() => ({
  clearDebugLog: vi.fn(),
  getDebugLogEntries: vi.fn(),
  getSoftwareNoticeState: vi.fn(),
  submitRelayEvent: vi.fn()
}));

vi.mock('@/api/tauriApi', () => apiMocks);

vi.mock('@/lib/time', () => ({
  currentLocalIsoString: () => '2026-07-10T12:00:00+08:00'
}));

describe('useDebugState', () => {
  test('maps device dispatch results from debug log entries', async () => {
    apiMocks.getDebugLogEntries.mockResolvedValue([
      {
        debugEntryId: 'debug-test-entry',
        source: 'codex',
        event: 'SessionStart',
        payload: '{}',
        rawPayload: null,
        result: 'accepted',
        internalEvent: 'agent.started',
        mappingStage: 'hardwareRule',
        noticeCommand: null,
        outputs: [],
        deviceResults: [
          {
            deviceId: 'desk-pico',
            channelId: 'pin.gp2',
            outputType: 'device-channel',
            status: 'sent',
            ack: '{"ok":true}',
            error: null
          }
        ],
        error: null,
        occurredAt: '2026-07-10T12:00:00+08:00'
      }
    ]);
    apiMocks.getSoftwareNoticeState.mockResolvedValue({
      lastEvent: 'agent.started',
      lastSource: 'codex'
    });

    const { result } = renderHook(() => useDebugState());

    await act(async () => {
      await result.current.refreshDebugState();
    });

    await waitFor(() => {
      expect(result.current.debugEntries[0].deviceResults).toEqual([
        {
          deviceId: 'desk-pico',
          channelId: 'pin.gp2',
          outputType: 'device-channel',
          status: 'sent',
          ack: '{"ok":true}',
          error: undefined
        }
      ]);
    });
  });
});
