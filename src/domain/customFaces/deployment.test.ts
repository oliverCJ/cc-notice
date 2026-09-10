import { describe, expect, test } from 'vitest';
import type {
  CustomFaceGroup,
  DeviceDisplayCapabilities,
} from '@/api/tauriApi';
import {
  checkCustomFaceDeployment,
  type CustomFaceDeviceCapabilities,
  type CustomFaceDeploymentReason,
} from './deployment';
import { CUSTOM_FACE_DEVICE_PROTOCOL } from './generated/customFaceDeviceProtocol.generated';

const DISPLAY_128X32: DeviceDisplayCapabilities = {
  status: true,
  face: true,
  clear: true,
  pixelWidth: 128,
  pixelHeight: 32,
  statuses: [],
  titleMaxChars: 0,
  messageMaxChars: 0,
};

const CUSTOM_FACE_128X32: CustomFaceDeviceCapabilities = {
  protocolVersion: 1,
  profileCode: 1,
  pixelWidth: 128,
  pixelHeight: 32,
  maxFramesPerFace: 20,
  maxGroupBytes: 131_072,
};

const DISPLAY_128X128: DeviceDisplayCapabilities = {
  status: true,
  face: true,
  clear: true,
  pixelWidth: 128,
  pixelHeight: 128,
  statuses: [],
  titleMaxChars: 0,
  messageMaxChars: 0,
};

const CUSTOM_FACE_128X128: CustomFaceDeviceCapabilities = {
  protocolVersion: 1,
  profileCode: 4,
  pixelWidth: 128,
  pixelHeight: 128,
  maxFramesPerFace: 10,
  maxGroupBytes: 262_144,
};

function group(
  displayProfileId = 'custom-mono-128x32-v1',
  frameCount = 1,
  framebufferBytes = 512,
): CustomFaceGroup {
  return {
    schemaVersion: 1,
    groupId: '10000000-0000-4000-8000-000000000001',
    name: 'Test group',
    displayProfileId,
    revision: 1,
    defaultFaceId: '20000000-0000-4000-8000-000000000001',
    faces: [
      {
        faceId: '20000000-0000-4000-8000-000000000001',
        name: 'Default',
        color: { red: 255, green: 255, blue: 255 },
        frames: Array.from({ length: frameCount }, () => ({
          durationMs: 200,
          packedPixels: Array(framebufferBytes).fill(0),
        })),
      },
    ],
  };
}

function reasonsFor(
  candidate: CustomFaceGroup,
  display: DeviceDisplayCapabilities | null = DISPLAY_128X32,
  customFace: CustomFaceDeviceCapabilities | null = CUSTOM_FACE_128X32,
): CustomFaceDeploymentReason[] {
  return checkCustomFaceDeployment(candidate, { display, customFace }).reasons;
}

describe('custom face deployment preflight', () => {
  test('allows an enabled profile when display and firmware capabilities match', () => {
    expect(CUSTOM_FACE_DEVICE_PROTOCOL.protocolVersion).toBe(1);
    const result = checkCustomFaceDeployment(group(), {
      display: DISPLAY_128X32,
      customFace: CUSTOM_FACE_128X32,
    });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.profile?.id).toBe('custom-mono-128x32-v1');
  });

  test('requires an explicit custom face firmware capability declaration', () => {
    expect(reasonsFor(group(), DISPLAY_128X32, null)).toContain(
      'custom-face-capability-missing',
    );
  });

  test('accepts compatible 128x128 groups from either canonical or legacy custom ids', () => {
    const canonical = checkCustomFaceDeployment(group('custom-mono-128x128-v1', 1, 2048), {
      display: DISPLAY_128X128,
      customFace: CUSTOM_FACE_128X128,
    });
    const legacy = checkCustomFaceDeployment(group('custom-128x128-v1', 1, 2048), {
      display: DISPLAY_128X128,
      customFace: CUSTOM_FACE_128X128,
    });

    expect(canonical.allowed).toBe(true);
    expect(legacy.allowed).toBe(true);
    expect(legacy.reasons).toEqual([]);
    expect(legacy.profile?.id).toBe('custom-mono-128x128-v1');
  });

  test('rejects displays without face support or a complete matching size', () => {
    expect(
      reasonsFor(group(), { ...DISPLAY_128X32, face: false }),
    ).toContain('display-face-unsupported');
    expect(
      reasonsFor(group(), { ...DISPLAY_128X32, pixelWidth: null }),
    ).toContain('display-size-missing');
    expect(
      reasonsFor(group(), { ...DISPLAY_128X32, pixelHeight: 64 }),
    ).toContain('display-size-mismatch');
  });

  test('rejects editor-only and arbitrary custom profiles', () => {
    expect(
      reasonsFor(
        group('custom-mono-128x64-v1', 1, 1024),
        { ...DISPLAY_128X32, pixelHeight: 64 },
        { ...CUSTOM_FACE_128X32, profileCode: 2, pixelHeight: 64 },
      ),
    ).toContain('profile-not-deployable');
    expect(
      reasonsFor(
        group('custom-200x48-v1', 1, 1200),
        { ...DISPLAY_128X32, pixelWidth: 200, pixelHeight: 48 },
        { ...CUSTOM_FACE_128X32, profileCode: 0, pixelWidth: 200, pixelHeight: 48 },
      ),
    ).toContain('profile-not-deployable');
  });

  test('rejects incompatible package versions and profile codes', () => {
    expect(
      reasonsFor(group(), DISPLAY_128X32, {
        ...CUSTOM_FACE_128X32,
        protocolVersion: 2,
      }),
    ).toContain('protocol-version-mismatch');
    expect(
      reasonsFor(group(), DISPLAY_128X32, {
        ...CUSTOM_FACE_128X32,
        profileCode: 3,
      }),
    ).toContain('profile-code-mismatch');
  });

  test('rejects firmware size mismatches, frame overflow and invalid framebuffers', () => {
    expect(
      reasonsFor(group(), DISPLAY_128X32, {
        ...CUSTOM_FACE_128X32,
        pixelWidth: 320,
      }),
    ).toContain('custom-face-size-mismatch');
    expect(reasonsFor(group('custom-mono-128x32-v1', 21))).toContain(
      'frame-limit-exceeded',
    );
    expect(
      reasonsFor(
        group('custom-mono-128x32-v1', 2),
        DISPLAY_128X32,
        { ...CUSTOM_FACE_128X32, maxFramesPerFace: 1 },
      ),
    ).toContain('frame-limit-exceeded');
    expect(
      reasonsFor(group('custom-mono-128x32-v1', 1, 511)),
    ).toContain('framebuffer-size-mismatch');
  });
});
