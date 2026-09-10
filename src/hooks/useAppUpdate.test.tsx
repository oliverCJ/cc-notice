import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { checkForAppUpdate } from '@/api/tauriApi';
import { useAppUpdate } from './useAppUpdate';

vi.mock('@/api/tauriApi', () => ({
  checkForAppUpdate: vi.fn(),
}));

const checkForAppUpdateMock = vi.mocked(checkForAppUpdate);

const updateResult = {
  currentVersion: '1.1.1',
  latestVersion: '1.2.0',
  status: 'update-available' as const,
  releaseName: 'CC Notice 1.2.0',
  releaseBody: '修复问题',
  publishedAt: '2026-09-09T00:00:00Z',
  releaseUrl: 'https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0',
};

describe('useAppUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkForAppUpdateMock.mockResolvedValue(updateResult);
  });

  test('checks once automatically and exposes the latest release', async () => {
    const { result } = renderHook(() => useAppUpdate());

    await waitFor(() => expect(result.current.status).toBe('update-available'));
    expect(checkForAppUpdateMock).toHaveBeenCalledTimes(1);
    expect(result.current.result?.latestVersion).toBe('1.2.0');
  });

  test('does not repeat automatic checks during the cooldown window', async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useAppUpdate());
      await act(async () => {
        await Promise.resolve();
      });
      expect(checkForAppUpdateMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.checkAutomatically();
      });
      expect(checkForAppUpdateMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test('keeps the last successful result when a later manual check fails', async () => {
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('update-available'));

    checkForAppUpdateMock.mockRejectedValueOnce(new Error('network unavailable'));
    await act(async () => {
      await result.current.checkManually();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.result?.releaseUrl).toBe(updateResult.releaseUrl);
    expect(result.current.error).toBe('network unavailable');
  });

  test('prevents concurrent manual checks', async () => {
    let resolveDeferred!: (value: typeof updateResult) => void;
    const deferred = new Promise<typeof updateResult>((resolve) => {
      resolveDeferred = resolve;
    });
    const { result } = renderHook(() => useAppUpdate());
    await waitFor(() => expect(result.current.status).toBe('update-available'));
    checkForAppUpdateMock.mockReturnValueOnce(deferred);

    await act(async () => {
      const first = result.current.checkManually();
      const second = result.current.checkManually();
      await Promise.resolve();
      expect(checkForAppUpdateMock).toHaveBeenCalledTimes(2);
      resolveDeferred(updateResult);
      await Promise.all([first, second]);
    });
  });

  test('leaves checking state when the update request never settles', async () => {
    vi.useFakeTimers();
    try {
      checkForAppUpdateMock.mockReturnValueOnce(new Promise(() => undefined));
      const { result } = renderHook(() => useAppUpdate());

      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.checking).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(15_000);
        await Promise.resolve();
      });

      expect(result.current.checking).toBe(false);
      expect(result.current.status).toBe('error');
      expect(result.current.error).toContain('timed out');
    } finally {
      vi.useRealTimers();
    }
  });
});
