import { describe, expect, test } from 'vitest';
import { getFirmwareWiringGuide } from './firmwareWiringGuides';

describe('firmwareWiringGuides', () => {
  test('returns target-specific wiring for Pico OLED 0.91', () => {
    const guide = getFirmwareWiringGuide({
      boardId: 'rp2040-pico-oled-091',
      targetId: 'rp2040-pico-oled-091-128x32'
    });

    expect(guide?.titleKey).toBe('firmware.wiring.guides.rp2040PicoOled091.title');
    expect(guide?.pinRows.map((row) => row.label)).toContain('GP20');
    expect(guide?.pinRows.map((row) => row.label)).toContain('GP21');
    expect(guide?.pinRows.map((row) => row.label)).toContain('GP0-GP13, GP22, GP26-GP28');
    expect(guide?.reservedPinKeys).toContain(
      'firmware.wiring.guides.rp2040PicoOled091.reserved.i2c'
    );
    expect(guide?.reservedPinKeys).not.toContain(
      'firmware.wiring.guides.rp2040PicoOled091.reserved.gp22'
    );
  });

  test('returns target-specific reset wiring for Pico OLED 0.96', () => {
    const guide = getFirmwareWiringGuide({
      boardId: 'rp2040-pico-oled-096',
      targetId: 'rp2040-pico-oled-096-128x64'
    });

    expect(guide?.pinRows.map((row) => row.label)).toContain('GP22');
    expect(guide?.reservedPinKeys).toContain(
      'firmware.wiring.guides.rp2040PicoOled096.reserved.reset'
    );
  });

  test('keeps wiring guides for every visible bundled firmware board', () => {
    const visibleBoardIds = [
      'rp2040-pico',
      'rp2040-pico-oled-091',
      'arduino-uno',
      'arduino-nano',
      'sparkfun-pro-micro-32u4',
      'seeed-wio-terminal',
      'stm32f103cx-blue-pill'
    ];

    for (const boardId of visibleBoardIds) {
      expect(getFirmwareWiringGuide({ boardId, targetId: null })).not.toBeNull();
    }
  });

  test('returns Pro Micro wiring with PWM breathe and D9 buzzer notes', () => {
    const guide = getFirmwareWiringGuide({
      boardId: 'sparkfun-pro-micro-32u4',
      targetId: 'sparkfun-pro-micro-32u4-default'
    });

    expect(guide?.titleKey).toBe('firmware.wiring.guides.sparkfunProMicro32u4.title');
    expect(guide?.pinRows.map((row) => row.label)).toEqual([
      'D0-D10, D14-D16, A0-A3',
      'D3 / D5 / D6 / D9 / D10',
      'D9'
    ]);
    expect(guide?.reservedPinKeys).toContain(
      'firmware.wiring.guides.sparkfunProMicro32u4.reserved.sharedD9'
    );
    expect(guide?.noticeKeys).toContain('firmware.wiring.noticeItems.proMicroVoltage');
  });
});
