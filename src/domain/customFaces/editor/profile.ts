import { CUSTOM_FACE_CONTRACT } from '../generated/customFaceContract.generated';
import type { EditorProfile } from './types';

const CUSTOM_PROFILE_PATTERN = /^custom-(\d+)x(\d+)-v1$/;
export const CUSTOM_PROFILE_MIN_DIMENSION = 10;
export const CUSTOM_PROFILE_MAX_DIMENSION = 1024;
export const CUSTOM_PROFILE_MAX_PIXELS = 1_048_576;

function findContractProfileIdForResolution(width: number, height: number) {
  return (
    CUSTOM_FACE_CONTRACT.profiles.find(
      (profile) => profile.width === width && profile.height === height
    )?.id ?? null
  );
}

export function editorProfileFromId(id: string): EditorProfile | null {
  const preset = CUSTOM_FACE_CONTRACT.profiles.find((profile) => profile.id === id);
  if (preset) {
    return {
      id: preset.id,
      width: preset.width,
      height: preset.height,
      maxFrames: preset.maxFrames,
      framebufferBytes: preset.framebufferBytes,
    };
  }
  const match = id.match(CUSTOM_PROFILE_PATTERN);
  if (!match) return null;
  const width = Number(match[1]); const height = Number(match[2]);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < CUSTOM_PROFILE_MIN_DIMENSION || height < CUSTOM_PROFILE_MIN_DIMENSION || width > CUSTOM_PROFILE_MAX_DIMENSION || height > CUSTOM_PROFILE_MAX_DIMENSION || width * height > CUSTOM_PROFILE_MAX_PIXELS) return null;
  return {
    id,
    width,
    height,
    maxFrames: maxFramesForResolution(width, height),
    framebufferBytes: width * Math.ceil(height / 8),
  };
}

export function customProfileId(width: number, height: number) {
  const normalizedWidth = Math.trunc(width);
  const normalizedHeight = Math.trunc(height);
  return (
    findContractProfileIdForResolution(normalizedWidth, normalizedHeight) ??
    `custom-${normalizedWidth}x${normalizedHeight}-v1`
  );
}

export function maxFramesForResolution(width: number, height: number) {
  const area = width * height;
  if (area <= 8192) return 20;
  if (area <= 76800) return 10;
  return 5;
}
