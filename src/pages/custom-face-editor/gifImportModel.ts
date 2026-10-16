export type GifImportFrame = {
  id: string;
  durationMs: number;
  packedPixels: number[];
  previewPixels?: number[];
  contentMask?: number[];
};

export type GifFrameLimitPolicy = 'sample' | 'truncate';
export type GifFrameSelectionMode = 'keep' | 'discard';
export type GifDurationPolicy = 'preserve-total-duration' | 'preserve-frame-duration';

export type GifImportPlacement = 'replace' | 'insert' | 'append';

const MIN_FRAME_DURATION_MS = 50;
const MAX_FRAME_DURATION_MS = 5000;

export function initializeGifFrameSelection(
  frameCount: number,
  mode: GifFrameSelectionMode
): boolean[] {
  return Array.from({ length: Math.max(0, Math.trunc(frameCount)) }, () => mode === 'discard');
}

export function toggleGifFrameSelection(selection: readonly boolean[], index: number): boolean[] {
  if (index < 0 || index >= selection.length) return [...selection];
  return selection.map((selected, currentIndex) => (currentIndex === index ? !selected : selected));
}

export function restoreAllGifFrames(frameCount: number): boolean[] {
  return initializeGifFrameSelection(frameCount, 'discard').map(() => true);
}

export function selectionFromFrameIds(ids: readonly string[], frameCount: number): boolean[] {
  const selectedIds = new Set(ids);
  return Array.from({ length: Math.max(0, Math.trunc(frameCount)) }, (_, index) =>
    selectedIds.has(String(index))
  );
}

export function clampFrameDuration(durationMs: number): number {
  const normalized = Number.isFinite(durationMs) ? Math.trunc(durationMs) : 0;
  return Math.min(MAX_FRAME_DURATION_MS, Math.max(MIN_FRAME_DURATION_MS, normalized));
}

export function truncateFrames(frames: readonly GifImportFrame[], maxFrames: number) {
  return frames.slice(0, Math.max(0, Math.trunc(maxFrames))).map(normalizeFrame);
}

export function sampleFramesByTimeline(
  frames: readonly GifImportFrame[],
  maxFrames: number
): GifImportFrame[] {
  const normalized = frames.map(normalizeFrame);
  const limit = Math.max(0, Math.trunc(maxFrames));
  if (normalized.length <= limit) return normalized;
  if (limit === 0) return [];
  if (limit === 1) return [{ ...normalized[0], durationMs: totalDuration(normalized) }];

  const total = totalDuration(normalized);
  const cumulative = buildCumulativeDurations(normalized);
  const sampled: GifImportFrame[] = [];
  let sampledDuration = 0;
  for (let index = 0; index < limit; index += 1) {
    const targetTime = (total * index) / limit;
    const sourceIndex =
      index === limit - 1 ? normalized.length - 1 : findFrameIndex(cumulative, targetTime);
    const nextTime = (total * (index + 1)) / limit;
    const durationMs =
      index === limit - 1
        ? total - sampledDuration
        : Math.round(nextTime - targetTime) || normalized[sourceIndex].durationMs;
    sampled.push({
      ...normalized[sourceIndex],
      durationMs: clampFrameDuration(durationMs),
    });
    sampledDuration += sampled[index].durationMs;
  }
  return sampled;
}

export function resolveImportFrames(
  placement: GifImportPlacement,
  currentFrames: readonly GifImportFrame[],
  importedFrames: readonly GifImportFrame[],
  selectedFrameIndex: number
): GifImportFrame[] {
  const current = currentFrames.map(normalizeFrame);
  const imported = importedFrames.map(normalizeFrame);
  if (placement === 'replace') return imported;
  if (placement === 'append') return [...current, ...imported];
  const insertionIndex = Math.min(current.length, Math.max(0, Math.trunc(selectedFrameIndex) + 1));
  return [...current.slice(0, insertionIndex), ...imported, ...current.slice(insertionIndex)];
}

export function validateFinalFrameCount(actual: number, maxFrames: number) {
  return actual <= maxFrames
    ? { ok: true as const }
    : { ok: false as const, message: 'frame-limit-exceeded' as const };
}

export function buildSelectedGifFrames(
  frames: readonly GifImportFrame[],
  selection: readonly boolean[],
  durationPolicy: GifDurationPolicy
): GifImportFrame[] {
  const normalized = frames.map(normalizeFrame);
  const selected = normalized.filter((_, index) => selection[index] !== false);
  if (selected.length === 0) return [];
  if (durationPolicy === 'preserve-frame-duration') return selected;

  const droppedDuration = normalized.reduce(
    (sum, frame, index) => (selection[index] === false ? sum + frame.durationMs : sum),
    0
  );
  if (droppedDuration === 0) return selected;
  const selectedDuration = selected.reduce((sum, frame) => sum + frame.durationMs, 0);
  let allocated = 0;
  return selected.map((frame, index) => {
    const extra =
      index === selected.length - 1
        ? droppedDuration - allocated
        : Math.round((droppedDuration * frame.durationMs) / selectedDuration);
    allocated += extra;
    return { ...frame, durationMs: clampFrameDuration(frame.durationMs + extra) };
  });
}

function normalizeFrame(frame: GifImportFrame): GifImportFrame {
  return { ...frame, durationMs: clampFrameDuration(frame.durationMs) };
}

function totalDuration(frames: readonly GifImportFrame[]) {
  return frames.reduce((sum, frame) => sum + frame.durationMs, 0);
}

function buildCumulativeDurations(frames: readonly GifImportFrame[]) {
  const cumulative: number[] = [];
  let total = 0;
  for (const frame of frames) {
    total += frame.durationMs;
    cumulative.push(total);
  }
  return cumulative;
}

function findFrameIndex(cumulative: readonly number[], timeMs: number) {
  const index = cumulative.findIndex((end) => timeMs < end);
  return index === -1 ? cumulative.length - 1 : index;
}
