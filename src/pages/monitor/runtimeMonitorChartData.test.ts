import { afterEach, describe, expect, test, vi } from 'vitest';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { toRuntimeLineChartData } from './runtimeMonitorChartData';

const emptySnapshot: RuntimeMonitorSnapshot = {
  startedAt: '2026-06-18T10:00:00Z',
  uptimeSeconds: 0,
  totalEvents: 0,
  totalOutputs: 0,
  totalFailures: 0,
  eventsBySource: [],
  eventsByResult: [],
  outputAttemptsByType: [],
  outputFailuresByType: [],
  eventSeries: [],
  outputSeries: [],
  runtimeErrorCount: 0,
  lastEvent: null,
  lastOutput: null
};

describe('toRuntimeLineChartData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns empty rows and keys for empty snapshot', () => {
    const result = toRuntimeLineChartData(emptySnapshot);

    expect(result.eventChart.rows).toEqual([]);
    expect(result.eventChart.seriesKeys).toEqual([]);
    expect(result.outputChart.rows).toEqual([]);
    expect(result.outputChart.seriesKeys).toEqual([]);
  });

  test('groups event buckets by time and source with tooltip metrics', () => {
    vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('system 18:01');

    const result = toRuntimeLineChartData({
      ...emptySnapshot,
      eventSeries: [
        {
          bucketStart: '2026-06-18T10:01:00Z',
          source: 'codex',
          totalCount: 3,
          successCount: 2,
          failureCount: 1
        },
        {
          bucketStart: '2026-06-18T10:01:00Z',
          source: 'claude-code',
          totalCount: 1,
          successCount: 1,
          failureCount: 0
        }
      ]
    });

    expect(result.eventChart.seriesKeys).toEqual(['claude-code', 'codex']);
    expect(result.eventChart.rows).toEqual([
        {
          bucketStart: '2026-06-18T10:01:00Z',
        label: 'system 18:01',
        codex: 3,
        codex__success: 2,
        codex__failure: 1,
        'claude-code': 1,
        'claude-code__success': 1,
        'claude-code__failure': 0
      }
    ]);
  });

  test('groups output buckets by time and output type', () => {
    const result = toRuntimeLineChartData({
      ...emptySnapshot,
      outputSeries: [
        {
          bucketStart: '2026-06-18T10:02:00Z',
          outputType: 'webhook',
          totalCount: 5,
          successCount: 4,
          failureCount: 1
        }
      ]
    });

    expect(result.outputChart.seriesKeys).toEqual(['webhook']);
    expect(result.outputChart.rows[0].webhook).toBe(5);
    expect(result.outputChart.rows[0].webhook__success).toBe(4);
    expect(result.outputChart.rows[0].webhook__failure).toBe(1);
  });
});
