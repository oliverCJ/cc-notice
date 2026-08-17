import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatLocalIsoString, formatSystemTimeLabel } from './time';

describe('formatLocalIsoString', () => {
  it('formats date with the provided local timezone offset', () => {
    const date = new Date('2026-06-12T00:30:00.000Z');

    const timestamp = formatLocalIsoString(date, 480);

    expect(timestamp).toBe('2026-06-12T08:30:00+08:00');
  });

  it('formats negative timezone offsets', () => {
    const date = new Date('2026-06-12T00:30:00.000Z');

    const timestamp = formatLocalIsoString(date, -420);

    expect(timestamp).toBe('2026-06-11T17:30:00-07:00');
  });
});

describe('formatSystemTimeLabel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats labels with the system timezone instead of forcing UTC', () => {
    const formatter = vi
      .spyOn(Date.prototype, 'toLocaleTimeString')
      .mockReturnValue('system-time');

    const label = formatSystemTimeLabel('2026-06-18T10:01:00Z');

    expect(label).toBe('system-time');
    expect(formatter).toHaveBeenCalledWith([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  });

  it('returns the original value when the timestamp is invalid', () => {
    expect(formatSystemTimeLabel('invalid-time')).toBe('invalid-time');
  });
});
