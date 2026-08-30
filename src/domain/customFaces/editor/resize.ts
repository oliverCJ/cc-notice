import type { CustomFaceGroup } from '@/api/tauriApi';
import { getPixel, setPixel } from './raster';
import { editorProfileFromId } from './profile';

export function resizeCustomFaceGroup(group: CustomFaceGroup, targetProfileId: string, createId: () => string): CustomFaceGroup {
  const source = editorProfileFromId(group.displayProfileId);
  const target = editorProfileFromId(targetProfileId);
  if (!source || !target) throw new RangeError('unknown custom face profile');
  const faceIds = new Map(group.faces.map((face) => [face.faceId, createId()]));
  return {
    ...group,
    groupId: createId(),
    name: `${group.name} ${target.width}×${target.height}`,
    displayProfileId: target.id,
    revision: 1,
    defaultFaceId: faceIds.get(group.defaultFaceId) ?? faceIds.values().next().value ?? createId(),
    faces: group.faces.map((face) => ({
      ...face,
      faceId: faceIds.get(face.faceId)!,
      frames: face.frames.slice(0, target.maxFrames).map((frame) => ({
        ...frame,
        packedPixels: resizePackedPixels(frame.packedPixels, source.width, source.height, target.width, target.height)
      }))
    }))
  };
}

export function resizePackedPixels(sourcePixels: number[], sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const source = Uint8Array.from(sourcePixels);
  const target = new Uint8Array(targetWidth * Math.ceil(targetHeight / 8));
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(x * sourceWidth / targetWidth));
      const sourceY = Math.min(sourceHeight - 1, Math.floor(y * sourceHeight / targetHeight));
      if (getPixel(source, { width: sourceWidth, height: sourceHeight }, sourceX, sourceY)) {
        setPixel(target, { width: targetWidth, height: targetHeight }, x, y, true);
      }
    }
  }
  return [...target];
}
