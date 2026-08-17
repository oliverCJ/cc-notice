import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DiagnosticsSnapshot, getDiagnosticsSnapshot } from '@/api/tauriApi';
import { useDiagnosticsState } from './useDiagnosticsState';

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    getDiagnosticsSnapshot: vi.fn()
  };
});

const getDiagnosticsSnapshotMock = vi.mocked(getDiagnosticsSnapshot);

function snapshotFixture(overallStatus: DiagnosticsSnapshot['overallStatus']): DiagnosticsSnapshot {
  return {
    overallStatus,
    checkedAt: '2026-07-08T10:00:00+08:00',
    sections: [],
    issues: [],
    quickActions: [{ kind: 'refresh-diagnostics', enabled: true }],
    deviceSummary: {
      registeredCount: 0,
      connectedCount: 0,
      offlineCount: 0,
      heartbeatIssueCount: 0,
      firmwareIssueCount: 0,
      referencedUnavailableCount: 0
    },
    deviceHealth: {
      okCount: 0,
      warningCount: 0,
      errorCount: 0,
      details: []
    },
    deviceIssues: []
  };
}

describe('useDiagnosticsState', () => {
  beforeEach(() => {
    getDiagnosticsSnapshotMock.mockReset();
    getDiagnosticsSnapshotMock.mockResolvedValue(snapshotFixture('ok'));
  });

  test('loads diagnostics snapshot when active', async () => {
    const { result } = renderHook(() => useDiagnosticsState(true));

    await waitFor(() => expect(result.current.snapshot?.overallStatus).toBe('ok'));

    expect(getDiagnosticsSnapshotMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  test('does not load diagnostics snapshot when inactive', () => {
    const { result } = renderHook(() => useDiagnosticsState(false));

    expect(getDiagnosticsSnapshotMock).not.toHaveBeenCalled();
    expect(result.current.snapshot).toBeNull();
  });

  test('keeps latest diagnostics refresh when older request resolves later', async () => {
    let resolveFirst: (snapshot: DiagnosticsSnapshot) => void = () => undefined;
    let resolveSecond: (snapshot: DiagnosticsSnapshot) => void = () => undefined;
    getDiagnosticsSnapshotMock
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecond = resolve;
        })
      );

    const { result } = renderHook(() => useDiagnosticsState(true));

    act(() => {
      void result.current.refresh();
    });

    await act(async () => {
      resolveSecond(snapshotFixture('warning'));
    });

    await waitFor(() => expect(result.current.snapshot?.overallStatus).toBe('warning'));

    await act(async () => {
      resolveFirst(snapshotFixture('ok'));
    });

    expect(result.current.snapshot?.overallStatus).toBe('warning');
  });

  test('records readable error when refresh fails', async () => {
    getDiagnosticsSnapshotMock.mockRejectedValue(new Error('diagnostics unavailable'));

    const { result } = renderHook(() => useDiagnosticsState(true));

    await waitFor(() => expect(result.current.error).toBe('diagnostics unavailable'));
    expect(result.current.loading).toBe(false);
  });
});
