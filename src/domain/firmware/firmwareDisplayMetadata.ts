export type FirmwareBoardFamily = 'rp2040' | 'arduino-avr' | 'stm32' | 'seeed-samd' | 'unknown';

export type FirmwareCapabilityTier = 'full' | 'lightweight' | 'minimal' | 'extended' | 'unknown';

export type FirmwareDisplayMetadata = {
  recommended: boolean;
  family: FirmwareBoardFamily;
  familyLabelKey: string;
  capabilityTier: FirmwareCapabilityTier;
  capabilityTierLabelKey: string;
  capabilityTierDescriptionKey: string;
  recommendationReasonKey: string | null;
};

const rp2040Metadata: FirmwareDisplayMetadata = {
  recommended: true,
  family: 'rp2040',
  familyLabelKey: 'firmware.boardFamilies.rp2040',
  capabilityTier: 'full',
  capabilityTierLabelKey: 'firmware.capabilityTiers.full.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.full.description',
  recommendationReasonKey: 'firmware.recommendationReason.pico'
};

const rp2040DisplayMetadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'rp2040',
  familyLabelKey: 'firmware.boardFamilies.rp2040',
  capabilityTier: 'extended',
  capabilityTierLabelKey: 'firmware.capabilityTiers.extended.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.oled096.description',
  recommendationReasonKey: null
};

const rp2040Display091Metadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'rp2040',
  familyLabelKey: 'firmware.boardFamilies.rp2040',
  capabilityTier: 'extended',
  capabilityTierLabelKey: 'firmware.capabilityTiers.extended.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.oled091.description',
  recommendationReasonKey: null
};

const smallAvrMetadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'arduino-avr',
  familyLabelKey: 'firmware.boardFamilies.arduinoAvr',
  capabilityTier: 'lightweight',
  capabilityTierLabelKey: 'firmware.capabilityTiers.lightweight.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.lightweight.description',
  recommendationReasonKey: null
};

const tinyAvrMetadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'arduino-avr',
  familyLabelKey: 'firmware.boardFamilies.arduinoAvr',
  capabilityTier: 'minimal',
  capabilityTierLabelKey: 'firmware.capabilityTiers.minimal.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.minimal.description',
  recommendationReasonKey: null
};

const smallMcuMetadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'stm32',
  familyLabelKey: 'firmware.boardFamilies.stm32',
  capabilityTier: 'lightweight',
  capabilityTierLabelKey: 'firmware.capabilityTiers.lightweight.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.stm32SmallMcu.description',
  recommendationReasonKey: null
};

const extendedSeeedSamdMetadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'seeed-samd',
  familyLabelKey: 'firmware.boardFamilies.seeedSamd',
  capabilityTier: 'extended',
  capabilityTierLabelKey: 'firmware.capabilityTiers.extended.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.extended.description',
  recommendationReasonKey: null
};

const unknownMetadata: FirmwareDisplayMetadata = {
  recommended: false,
  family: 'unknown',
  familyLabelKey: 'firmware.boardFamilies.unknown',
  capabilityTier: 'unknown',
  capabilityTierLabelKey: 'firmware.capabilityTiers.unknown.label',
  capabilityTierDescriptionKey: 'firmware.capabilityTiers.unknown.description',
  recommendationReasonKey: null
};

const tinyAvrBoardIds = new Set(['arduino-uno', 'arduino-nano']);
const smallAvrBoardIds = new Set([
  'arduino-leonardo',
  'arduino-micro',
  'sparkfun-pro-micro-32u4'
]);
const smallMcuBoardIds = new Set(['stm32f103cx-blue-pill']);
const extendedSeeedSamdBoardIds = new Set(['seeed-wio-terminal']);

export function getFirmwareDisplayMetadata(boardId: string): FirmwareDisplayMetadata {
  if (boardId === 'rp2040-pico') {
    return rp2040Metadata;
  }

  if (boardId === 'rp2040-pico-oled-096') {
    return rp2040DisplayMetadata;
  }

  if (boardId === 'rp2040-pico-oled-091') {
    return rp2040Display091Metadata;
  }

  if (tinyAvrBoardIds.has(boardId)) {
    return tinyAvrMetadata;
  }

  if (smallAvrBoardIds.has(boardId)) {
    return smallAvrMetadata;
  }

  if (smallMcuBoardIds.has(boardId)) {
    return smallMcuMetadata;
  }

  if (extendedSeeedSamdBoardIds.has(boardId)) {
    return extendedSeeedSamdMetadata;
  }

  return unknownMetadata;
}

export function isRecommendedFirmwareBoard(boardId: string): boolean {
  return getFirmwareDisplayMetadata(boardId).recommended;
}
