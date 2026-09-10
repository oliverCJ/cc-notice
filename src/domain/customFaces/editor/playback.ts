import { CUSTOM_FACE_CONTRACT } from '../generated/customFaceContract.generated';

type TimedFrame = { durationMs: number };

export function totalDuration(frames: readonly TimedFrame[]) {
  return frames.reduce((sum, frame) => sum + normalizeFrameDuration(frame.durationMs), 0);
}

export function frameAtElapsed(frames: readonly TimedFrame[], elapsedMs: number, loop: boolean) {
  if (frames.length === 0) return -1;
  const duration = totalDuration(frames);
  const elapsed = loop ? Math.max(0, elapsedMs) % duration : Math.min(Math.max(0, elapsedMs), Math.max(0, duration - 1));
  let cursor = 0;
  for (let index = 0; index < frames.length; index += 1) {
    cursor += normalizeFrameDuration(frames[index].durationMs);
    if (elapsed < cursor) return index;
  }
  return frames.length - 1;
}

export function normalizeFrameDuration(durationMs: number) {
  return Math.min(CUSTOM_FACE_CONTRACT.frameDurationMs.max, Math.max(CUSTOM_FACE_CONTRACT.frameDurationMs.min, Math.trunc(durationMs) || CUSTOM_FACE_CONTRACT.frameDurationMs.default));
}

export function frameLimitForProfile(profileId: string) {
  return CUSTOM_FACE_CONTRACT.profiles.find((profile) => profile.id === profileId)?.maxFrames ?? 0;
}
