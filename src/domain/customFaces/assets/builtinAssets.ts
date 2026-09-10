import { setPixel } from '../editor/raster';

export type BuiltinAssetProfile = { id: string; width: number; height: number; framebufferBytes: number };
export type BuiltinCustomFaceAsset = { assetId: string; name: string; profileId: string; packedPixels: Uint8Array; source: 'builtin' };

export function getBuiltinCustomFaceAssets(profile: BuiltinAssetProfile): BuiltinCustomFaceAsset[] {
  const packedPixels = new Uint8Array(profile.framebufferBytes);
  const centerX = Math.floor(profile.width / 2);
  const centerY = Math.floor(profile.height / 2);
  const scale = Math.max(1, Math.floor(Math.min(profile.width, profile.height) / 16));
  for (let i = -3; i <= 3; i += 1) { setPixel(packedPixels, profile, centerX - 5 * scale + i * scale, centerY - 3 * scale, true); setPixel(packedPixels, profile, centerX + 5 * scale + i * scale, centerY - 3 * scale, true); }
  for (let i = -4; i <= 4; i += 1) setPixel(packedPixels, profile, centerX + i * scale, centerY + 4 * scale, true);
  return [Object.freeze({ assetId: `builtin-smile-${profile.id}`, name: '微笑', profileId: profile.id, packedPixels, source: 'builtin' })];
}
