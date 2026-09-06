import type {
  DeviceCustomFaceCapabilities,
  DeviceDisplayCapabilities,
  DeviceRuntimeState,
} from '@/api/tauriApi';
import { getBoardDeviceExtensions } from '@/domain/boards/boardCatalog';
import { editorProfileFromId } from '@/domain/customFaces/editor/profile';
import { DISPLAY_FACE_CONTRACT } from '@/domain/display/generated/displayFaceContract.generated';

const DEFAULT_DISPLAY_STATUSES = ['notice', 'working', 'success', 'warning', 'error'];

export function resolveDeviceDisplayCapabilities(
  boardId: string | null | undefined,
  runtimeState: DeviceRuntimeState | null | undefined
): DeviceDisplayCapabilities | null {
  const boardDisplay = boardId ? getBoardDeviceExtensions(boardId)?.display ?? null : null;
  if (boardDisplay) {
    return boardDisplay;
  }

  const runtimeDisplay = runtimeState?.firmwareInfo?.customFace
    ? buildFallbackDisplayCapabilities(runtimeState.firmwareInfo.customFace)
    : null;
  if (runtimeDisplay) {
    return runtimeDisplay;
  }

  const fallbackProfile = boardId ? editorProfileFromId(boardId) : null;
  if (!fallbackProfile) {
    return null;
  }

  return buildFallbackDisplayCapabilities({
    pixelWidth: fallbackProfile.width,
    pixelHeight: fallbackProfile.height,
  });
}

function buildFallbackDisplayCapabilities(
  capability: Pick<DeviceCustomFaceCapabilities, 'pixelWidth' | 'pixelHeight'>
): DeviceDisplayCapabilities {
  const rendererProfile = DISPLAY_FACE_CONTRACT.profiles.find(
    (profile) =>
      profile.width === capability.pixelWidth && profile.height === capability.pixelHeight
  );
  const sizeClass = inferSizeClass(capability.pixelWidth, capability.pixelHeight);
  return {
    status: true,
    card: false,
    lines: true,
    runtime: true,
    face: true,
    faceStyleVersion: null,
    faceRendererProfile: rendererProfile?.id ?? null,
    clear: true,
    sizeClass,
    pixelWidth: capability.pixelWidth,
    pixelHeight: capability.pixelHeight,
    statuses: DEFAULT_DISPLAY_STATUSES,
    titleMaxChars: inferTitleMaxChars(sizeClass),
    messageMaxChars: inferMessageMaxChars(sizeClass),
    textEncoding: 'ascii',
  };
}

function inferSizeClass(
  width: number,
  height: number
): NonNullable<DeviceDisplayCapabilities['sizeClass']> {
  const area = width * height;
  if (area <= 4096) {
    return 'compact';
  }
  if (area <= 8192) {
    return 'small';
  }
  if (area <= 76800) {
    return 'medium';
  }
  return 'large';
}

function inferTitleMaxChars(sizeClass: NonNullable<DeviceDisplayCapabilities['sizeClass']>) {
  if (sizeClass === 'compact' || sizeClass === 'small') {
    return 16;
  }
  if (sizeClass === 'medium') {
    return 39;
  }
  return 64;
}

function inferMessageMaxChars(sizeClass: NonNullable<DeviceDisplayCapabilities['sizeClass']>) {
  if (sizeClass === 'compact' || sizeClass === 'small') {
    return 16;
  }
  if (sizeClass === 'medium') {
    return 95;
  }
  return 160;
}
