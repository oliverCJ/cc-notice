import { RuntimeEventBucket, RuntimeMonitorSnapshot, RuntimeOutputBucket } from '@/api/tauriApi';
import { formatSystemTimeLabel } from '@/lib/time';
import { RuntimeChartRow, RuntimeChartsData, RuntimeLineChartData } from './runtimeMonitorTypes';

export function toRuntimeLineChartData(snapshot: RuntimeMonitorSnapshot): RuntimeChartsData {
  return {
    eventChart: bucketsToLineChartData(
      snapshot.eventSeries,
      (bucket) => bucket.bucketStart,
      (bucket) => bucket.source
    ),
    outputChart: bucketsToLineChartData(
      snapshot.outputSeries,
      (bucket) => bucket.bucketStart,
      (bucket) => bucket.outputType
    )
  };
}

function bucketsToLineChartData<T extends RuntimeEventBucket | RuntimeOutputBucket>(
  buckets: T[],
  getBucketStart: (bucket: T) => string,
  getSeriesKey: (bucket: T) => string
): RuntimeLineChartData {
  const seriesKeys = Array.from(new Set(buckets.map(getSeriesKey))).sort();
  const rowsByBucket = new Map<string, RuntimeChartRow>();

  for (const bucket of buckets) {
    const bucketStart = getBucketStart(bucket);
    const key = getSeriesKey(bucket);
    const row = rowsByBucket.get(bucketStart) ?? {
      bucketStart,
      label: formatSystemTimeLabel(bucketStart)
    };
    row[key] = bucket.totalCount;
    row[`${key}__success`] = bucket.successCount;
    row[`${key}__failure`] = bucket.failureCount;
    rowsByBucket.set(bucketStart, row);
  }

  return {
    rows: Array.from(rowsByBucket.values()).sort((a, b) =>
      String(a.bucketStart).localeCompare(String(b.bucketStart))
    ),
    seriesKeys
  };
}
