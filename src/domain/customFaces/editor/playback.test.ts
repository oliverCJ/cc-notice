import { describe, expect, test } from 'vitest';
import { frameAtElapsed, frameLimitForProfile, normalizeFrameDuration, totalDuration } from './playback';

describe('custom face playback', () => {
  test('calculates total duration and frame at elapsed time', () => {
    const frames = [{ durationMs: 200 }, { durationMs: 400 }, { durationMs: 200 }];
    expect(totalDuration(frames)).toBe(800);
    expect(frameAtElapsed(frames, 0, false)).toBe(0);
    expect(frameAtElapsed(frames, 250, false)).toBe(1);
    expect(frameAtElapsed(frames, 900, false)).toBe(2);
    expect(frameAtElapsed(frames, 900, true)).toBe(0);
  });

  test('normalizes duration and profile frame limits', () => {
    expect(normalizeFrameDuration(1)).toBe(120);
    expect(normalizeFrameDuration(9999)).toBe(5000);
    expect(frameLimitForProfile('custom-mono-320x240-v1')).toBe(5);
    expect(frameLimitForProfile('custom-mono-128x64-v1')).toBe(10);
  });
});
