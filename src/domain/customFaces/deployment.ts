import type {
  CustomFaceGroup,
  DeviceDisplayCapabilities,
} from '@/api/tauriApi';
import { CUSTOM_FACE_CONTRACT } from './generated/customFaceContract.generated';
import { CUSTOM_FACE_DEVICE_PROTOCOL } from './generated/customFaceDeviceProtocol.generated';

type CustomFaceContractProfile =
  (typeof CUSTOM_FACE_CONTRACT.profiles)[number];

export type CustomFaceDeviceCapabilities = {
  protocolVersion: number;
  profileCode: number;
  pixelWidth: number;
  pixelHeight: number;
  maxFramesPerFace: number;
  maxGroupBytes: number;
};

export type CustomFaceDeploymentReason =
  | 'profile-not-deployable'
  | 'display-face-unsupported'
  | 'display-size-missing'
  | 'display-size-mismatch'
  | 'custom-face-capability-missing'
  | 'protocol-version-mismatch'
  | 'profile-code-mismatch'
  | 'custom-face-size-mismatch'
  | 'frame-limit-exceeded'
  | 'framebuffer-size-mismatch';

export type CustomFaceDeploymentTarget = {
  display: DeviceDisplayCapabilities | null;
  customFace: CustomFaceDeviceCapabilities | null;
};

export type CustomFaceDeploymentCheck = {
  allowed: boolean;
  reasons: CustomFaceDeploymentReason[];
  profile?: CustomFaceContractProfile;
};

export function checkCustomFaceDeployment(
  group: CustomFaceGroup,
  target: CustomFaceDeploymentTarget,
): CustomFaceDeploymentCheck {
  const reasons: CustomFaceDeploymentReason[] = [];
  const addReason = (reason: CustomFaceDeploymentReason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  const profile = CUSTOM_FACE_CONTRACT.profiles.find(
    (candidate) => candidate.id === group.displayProfileId,
  );
  const deployableProfile =
    profile?.deployment === 'enabled' ? profile : undefined;

  if (!deployableProfile) addReason('profile-not-deployable');
  validateDisplayCapabilities(target.display, profile, addReason);
  validateCustomFaceCapabilities(target.customFace, profile, addReason);
  validateFrames(group, profile, target.customFace, addReason);

  // 编码后容量取决于真实 RLE 结果，必须留在 Rust compile_group 边界判定。
  return {
    allowed: reasons.length === 0,
    reasons,
    ...(deployableProfile ? { profile: deployableProfile } : {}),
  };
}

function validateDisplayCapabilities(
  display: DeviceDisplayCapabilities | null,
  profile: CustomFaceContractProfile | undefined,
  addReason: (reason: CustomFaceDeploymentReason) => void,
) {
  if (display?.face !== true) addReason('display-face-unsupported');
  if (
    !isPositiveInteger(display?.pixelWidth) ||
    !isPositiveInteger(display?.pixelHeight)
  ) {
    addReason('display-size-missing');
    return;
  }
  if (
    profile &&
    (display.pixelWidth !== profile.width ||
      display.pixelHeight !== profile.height)
  ) {
    addReason('display-size-mismatch');
  }
}

function validateCustomFaceCapabilities(
  capability: CustomFaceDeviceCapabilities | null,
  profile: CustomFaceContractProfile | undefined,
  addReason: (reason: CustomFaceDeploymentReason) => void,
) {
  if (!capability) {
    addReason('custom-face-capability-missing');
    return;
  }
  if (capability.protocolVersion !== CUSTOM_FACE_DEVICE_PROTOCOL.protocolVersion) {
    addReason('protocol-version-mismatch');
  }
  if (profile && capability.profileCode !== profile.code) {
    addReason('profile-code-mismatch');
  }
  if (
    profile &&
    (capability.pixelWidth !== profile.width ||
      capability.pixelHeight !== profile.height)
  ) {
    addReason('custom-face-size-mismatch');
  }
}

function validateFrames(
  group: CustomFaceGroup,
  profile: CustomFaceContractProfile | undefined,
  capability: CustomFaceDeviceCapabilities | null,
  addReason: (reason: CustomFaceDeploymentReason) => void,
) {
  if (!profile) return;
  for (const face of group.faces) {
    if (
      face.frames.length > profile.maxFrames ||
      (capability && face.frames.length > capability.maxFramesPerFace)
    ) {
      addReason('frame-limit-exceeded');
    }
    if (
      face.frames.some(
        (frame) => frame.packedPixels.length !== profile.framebufferBytes,
      )
    ) {
      addReason('framebuffer-size-mismatch');
    }
  }
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}
