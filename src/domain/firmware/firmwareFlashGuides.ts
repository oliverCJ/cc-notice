import { FirmwareCatalogArtifact } from '@/api/tauriApi';

export type FirmwareFlashGuideSection = {
  titleKey: string;
  itemKeys: string[];
};

export type FirmwareFlashGuide = {
  titleKey: string;
  summaryKey: string;
  sections: FirmwareFlashGuideSection[];
};

const guidesByBoardId: Record<string, FirmwareFlashGuide> = {
  'stm32f103cx-blue-pill': {
    titleKey: 'firmware.flashGuides.stm32BluePill.title',
    summaryKey: 'firmware.flashGuides.stm32BluePill.summary',
    sections: [
      section('firmware.flashGuides.stm32BluePill.wiringTitle', [
        'firmware.flashGuides.stm32BluePill.wiringTx',
        'firmware.flashGuides.stm32BluePill.wiringRx',
        'firmware.flashGuides.stm32BluePill.wiringGnd',
        'firmware.flashGuides.stm32BluePill.wiringVoltage'
      ]),
      section('firmware.flashGuides.stm32BluePill.bootTitle', [
        'firmware.flashGuides.stm32BluePill.bootEnter',
        'firmware.flashGuides.stm32BluePill.bootExit'
      ]),
      section('firmware.flashGuides.stm32BluePill.runtimeTitle', [
        'firmware.flashGuides.stm32BluePill.runtimeUsb',
        'firmware.flashGuides.stm32BluePill.runtimeTtl'
      ]),
      section('firmware.flashGuides.stm32BluePill.dependencyTitle', [
        'firmware.flashGuides.stm32BluePill.dependencyTools',
        'firmware.flashGuides.stm32BluePill.dependencyGetopt',
        'firmware.flashGuides.stm32BluePill.dependencyProgrammer'
      ]),
      section('firmware.flashGuides.stm32BluePill.portTitle', [
        'firmware.flashGuides.stm32BluePill.portHint'
      ])
    ]
  }
};

export function getFirmwareFlashGuide(
  artifact: Pick<FirmwareCatalogArtifact, 'boardId'> | null
): FirmwareFlashGuide | null {
  if (!artifact) {
    return null;
  }
  return guidesByBoardId[artifact.boardId] ?? null;
}

function section(titleKey: string, itemKeys: string[]): FirmwareFlashGuideSection {
  return { titleKey, itemKeys };
}
