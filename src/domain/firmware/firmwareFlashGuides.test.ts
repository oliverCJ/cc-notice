import { describe, expect, test } from 'vitest';
import { getFirmwareFlashGuide } from './firmwareFlashGuides';

describe('firmwareFlashGuides', () => {
  test('returns STM32 Blue Pill USB-TTL flashing guide', () => {
    const guide = getFirmwareFlashGuide({ boardId: 'stm32f103cx-blue-pill' });

    expect(guide?.titleKey).toBe('firmware.flashGuides.stm32BluePill.title');
    expect(guide?.sections.map((section) => section.titleKey)).toContain(
      'firmware.flashGuides.stm32BluePill.wiringTitle'
    );
    expect(guide?.sections.flatMap((section) => section.itemKeys)).toContain(
      'firmware.flashGuides.stm32BluePill.dependencyProgrammer'
    );
    expect(guide?.sections.flatMap((section) => section.itemKeys)).toContain(
      'firmware.flashGuides.stm32BluePill.runtimeUsb'
    );
  });

  test('does not return a board-specific flash guide for generic UF2 firmware', () => {
    expect(getFirmwareFlashGuide({ boardId: 'rp2040-pico' })).toBeNull();
  });
});
