import { describe, expect, test } from 'vitest';
import {
  clampFrameDuration,
  buildSelectedGifFrames,
  initializeGifFrameSelection,
  toggleGifFrameSelection,
  restoreAllGifFrames,
  selectionFromFrameIds,
  resolveImportFrames,
  sampleFramesByTimeline,
  truncateFrames,
  validateFinalFrameCount,
  type GifImportFrame,
} from './gifImportModel';

const frame = (id: string, durationMs: number): GifImportFrame => ({
  id,
  durationMs,
  packedPixels: [id.length],
});

describe('GIF import model', () => {
  test('clamps GIF frame durations to the custom-face contract range', () => {
    expect(clampFrameDuration(0)).toBe(50);
    expect(clampFrameDuration(49)).toBe(50);
    expect(clampFrameDuration(123)).toBe(123);
    expect(clampFrameDuration(5001)).toBe(5000);
  });

  test('truncates frames from the end when the user selects truncate', () => {
    const frames = [frame('a', 100), frame('b', 100), frame('c', 100)];

    expect(truncateFrames(frames, 2).map((item) => item.id)).toEqual(['a', 'b']);
    expect(truncateFrames(frames, 0)).toEqual([]);
  });

  test('samples the timeline while preserving the first and last frame', () => {
    const frames = [frame('a', 100), frame('b', 100), frame('c', 100), frame('d', 100)];

    const sampled = sampleFramesByTimeline(frames, 3);

    expect(sampled).toHaveLength(3);
    expect(sampled[0].id).toBe('a');
    expect(sampled[sampled.length - 1]?.id).toBe('d');
    expect(sampled.reduce((sum, item) => sum + item.durationMs, 0)).toBe(400);
  });

  test('resolves replace, insert and append placement', () => {
    const current = [frame('a', 100), frame('b', 100), frame('c', 100)];
    const imported = [frame('x', 100), frame('y', 100)];

    expect(resolveImportFrames('replace', current, imported, 1).map((item) => item.id)).toEqual([
      'x',
      'y',
    ]);
    expect(resolveImportFrames('insert', current, imported, 1).map((item) => item.id)).toEqual([
      'a',
      'b',
      'x',
      'y',
      'c',
    ]);
    expect(resolveImportFrames('append', current, imported, 1).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      'x',
      'y',
    ]);
  });

test('blocks a final frame list that exceeds the profile limit', () => {
    expect(validateFinalFrameCount(10, 10)).toEqual({ ok: true });
    expect(validateFinalFrameCount(11, 10)).toEqual({
      ok: false,
      message: 'frame-limit-exceeded',
    });
  });
});

test('initializes and toggles forward and reverse frame selections', () => {
  expect(initializeGifFrameSelection(3, 'keep')).toEqual([false, false, false]);
  expect(initializeGifFrameSelection(3, 'discard')).toEqual([true, true, true]);
  expect(toggleGifFrameSelection([true, false, true], 1)).toEqual([true, true, true]);
  expect(toggleGifFrameSelection([true, false, true], 0)).toEqual([false, false, true]);
  expect(restoreAllGifFrames(3)).toEqual([true, true, true]);
  expect(selectionFromFrameIds(['0', '2'], 3)).toEqual([true, false, true]);
});

test('builds selected frames with either preserved total duration or original durations', () => {
  const frames = [frame('a', 100), frame('b', 200), frame('c', 300)];
  const kept = [true, false, true];

  expect(buildSelectedGifFrames(frames, kept, 'preserve-frame-duration').map((item) => item.durationMs))
    .toEqual([100, 300]);
  expect(buildSelectedGifFrames(frames, kept, 'preserve-total-duration').map((item) => item.durationMs))
    .toEqual([150, 450]);
});
