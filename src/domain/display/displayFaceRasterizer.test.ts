import { describe, expect, test } from 'vitest';
import { DeviceDisplayCapabilities } from '@/api/tauriApi';
import { DISPLAY_FACE_GOLDEN } from './generated/displayFaceGolden.generated';
import {
  hashPackedFrame,
  rasterizeDisplayFace,
  resolveDisplayFaceRendererProfile
} from './displayFaceRasterizer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function capability(
  faceRendererProfile: string | null | undefined
): Pick<DeviceDisplayCapabilities, 'faceRendererProfile'> {
  return { faceRendererProfile };
}

describe('displayFaceRasterizer', () => {
  test('resolves only explicitly supported renderer profiles', () => {
    expect(resolveDisplayFaceRendererProfile(capability('unknown'))).toBeNull();
    expect(resolveDisplayFaceRendererProfile(capability(undefined))).toBeNull();
    expect(resolveDisplayFaceRendererProfile(capability('oled-128x32-v1'))).toMatchObject({
      id: 'oled-128x32-v1',
      width: 128,
      height: 32
    });
  });

  test('matches every framebuffer and color exported by the C renderer', () => {
    for (const [key, golden] of Object.entries(DISPLAY_FACE_GOLDEN.frames)) {
      const [profileId, templateId, elapsedText] = key.split('|');
      const frame = rasterizeDisplayFace(profileId, templateId, Number(elapsedText));

      expect(hashPackedFrame(frame.packedPixels), key).toBe(golden.hash);
      expect(frame.color, key).toBe(golden.color);
    }
  });

  test('normalizes unknown templates to the idle sleep frame', () => {
    const fallback = rasterizeDisplayFace('oled-128x32-v1', 'unknown', 800);
    const idle = rasterizeDisplayFace('oled-128x32-v1', 'idle-sleep', 800);

    expect(fallback.templateId).toBe('idle-sleep');
    expect(fallback.packedPixels).toEqual(idle.packedPixels);
  });

  test('rejects unknown renderer profiles', () => {
    expect(() => rasterizeDisplayFace('unknown', 'idle-sleep', 0)).toThrow(
      'unknown display face renderer profile: unknown'
    );
  });

  test('contains no template id substring routing or legacy motion API', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/domain/display/displayFaceRasterizer.ts'),
      'utf8'
    );
    expect(source).not.toContain('templateId.includes(');
    expect(source).not.toContain('faceOffsetX(kind');
    expect(source).not.toContain('eyeScaleYPercent');
  });
});
