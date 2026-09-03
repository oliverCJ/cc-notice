import { beforeEach, describe, expect, test, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  applyCustomFaceImageImport,
  openCustomFaceImagePixelizer,
  pixelizeCustomFaceImageSource,
  pixelizeCustomFaceImage,
  prepareCustomFaceImagePixelizerSource,
  releaseCustomFaceImagePixelizerSource,
} from './tauriApi';

describe('custom face image pixelizer Tauri API', () => {
  beforeEach(() => invoke.mockReset());

  test('uses stable command names and request shapes', async () => {
    await openCustomFaceImagePixelizer({ width: 128, height: 128 });
    await pixelizeCustomFaceImage({
      profileWidth: 128,
      profileHeight: 32,
      imageBytes: [1, 2, 3],
      options: { mode: 'mono', colorCount: 8, dither: true, invert: false, threshold: 128, contrast: 0, brightness: 0, scale: 1, offsetX: 0, offsetY: 0 }
    });
    await prepareCustomFaceImagePixelizerSource({
      profileWidth: 128,
      profileHeight: 32,
      imageBytes: [1, 2, 3]
    });
    await pixelizeCustomFaceImageSource({
      sourceId: 'custom-face-image-source-1',
      profileWidth: 128,
      profileHeight: 32,
      options: { mode: 'mono', colorCount: 8, dither: true, invert: false, threshold: 128, contrast: 0, brightness: 0, scale: 1, offsetX: 0, offsetY: 0 }
    });
    await releaseCustomFaceImagePixelizerSource('custom-face-image-source-1');
    await applyCustomFaceImageImport({
      packedPixels: [1, 0, 0, 0],
      sourceWidth: 8,
      sourceHeight: 8
    });

    expect(invoke.mock.calls).toEqual([
      ['open_custom_face_image_pixelizer', { request: { width: 128, height: 128 } }],
      ['pixelize_custom_face_image', {
        request: {
          profileWidth: 128,
          profileHeight: 32,
          imageBytes: [1, 2, 3],
          options: { mode: 'mono', colorCount: 8, dither: true, invert: false, threshold: 128, contrast: 0, brightness: 0, scale: 1, offsetX: 0, offsetY: 0 }
        }
      }],
      ['prepare_custom_face_image_pixelizer_source', {
        request: {
          profileWidth: 128,
          profileHeight: 32,
          imageBytes: [1, 2, 3]
        }
      }],
      ['pixelize_custom_face_image_source', {
        request: {
          sourceId: 'custom-face-image-source-1',
          profileWidth: 128,
          profileHeight: 32,
          options: { mode: 'mono', colorCount: 8, dither: true, invert: false, threshold: 128, contrast: 0, brightness: 0, scale: 1, offsetX: 0, offsetY: 0 }
        }
      }],
      ['release_custom_face_image_pixelizer_source', {
        sourceId: 'custom-face-image-source-1'
      }],
      ['apply_custom_face_image_import', {
        payload: {
          packedPixels: [1, 0, 0, 0],
          sourceWidth: 8,
          sourceHeight: 8
        }
      }]
    ]);
  });
});
