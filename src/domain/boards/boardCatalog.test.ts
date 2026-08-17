import { describe, expect, it } from 'vitest';
import {
  getBoardAvailableChannels,
  getBoardDeviceExtensions,
  getBoardDisplayName,
  getBoardIdentityLabel
} from './boardCatalog';

describe('boardCatalog', () => {
  it('keeps rp2040 and atmega32u4 board names outside page components', () => {
    expect(getBoardDisplayName('rp2040-pico')).toBe('Raspberry Pi Pico');
    expect(getBoardDisplayName('arduino-leonardo')).toBe('Arduino Leonardo');
    expect(getBoardDisplayName('arduino-uno')).toBe('Arduino Uno');
    expect(getBoardDisplayName('arduino-nano')).toBe('Arduino Nano');
    expect(getBoardDisplayName('stm32f103cx-blue-pill')).toBe('STM32F103C8T6/C6T6 Blue Pill');
    expect(getBoardDisplayName('seeed-wio-terminal')).toBe('Seeed Studio Wio Terminal');
    expect(getBoardDisplayName('rp2040-pico-oled-096')).toBe(
      'Raspberry Pi Pico + OLED 0.96" 128x64'
    );
    expect(getBoardDisplayName('rp2040-pico-oled-091')).toBe(
      'Raspberry Pi Pico + OLED 0.91" 128x32'
    );
  });

  it('marks board identity persistence consistently with registration strategy', () => {
    expect(getBoardIdentityLabel('arduino-leonardo')).toBe('limited');
    expect(getBoardIdentityLabel('arduino-micro')).toBe('limited');
    expect(getBoardIdentityLabel('sparkfun-pro-micro-32u4')).toBe('limited');
    expect(getBoardIdentityLabel('arduino-uno')).toBe('limited');
    expect(getBoardIdentityLabel('arduino-nano')).toBe('limited');
    expect(getBoardIdentityLabel('stm32f103cx-blue-pill')).toBe('limited');
    expect(getBoardIdentityLabel('seeed-wio-terminal')).toBe('stable-uid');
    expect(getBoardIdentityLabel('rp2040-pico-oled-096')).toBe('stable-uid');
    expect(getBoardIdentityLabel('rp2040-pico-oled-091')).toBe('stable-uid');
  });

  it('exposes pico oled 0.96 display capability without exposing oled reserved pins as digital outputs', () => {
    const channels = getBoardAvailableChannels('rp2040-pico-oled-096');
    const extensions = getBoardDeviceExtensions('rp2040-pico-oled-096');

    expect(extensions?.display).toEqual(
      expect.objectContaining({
        status: true,
        lines: true,
        runtime: true,
        clear: true,
        sizeClass: 'small',
        titleMaxChars: 16,
        messageMaxChars: 16,
        textEncoding: 'ascii'
      })
    );
    expect(channels.some((channel) => channel.id === 'pin.gp20')).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.gp21')).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.gp22')).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.gp0')).toBe(true);
    expect(channels.some((channel) => channel.id === 'pin.gp13')).toBe(true);
    expect(channels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(channels.some((channel) => channel.id.startsWith('ws2812.'))).toBe(false);
    expect(channels.some((channel) => channel.id === 'buzzer.gp18')).toBe(true);
    expect(channels.some((channel) => channel.id === 'pin.gp26')).toBe(true);
  });

  it('exposes pico oled 0.91 display capability while keeping gp22 as a digital output', () => {
    const channels = getBoardAvailableChannels('rp2040-pico-oled-091');
    const extensions = getBoardDeviceExtensions('rp2040-pico-oled-091');

    expect(extensions?.display).toEqual(
      expect.objectContaining({
        status: true,
        lines: true,
        runtime: true,
        clear: true,
        sizeClass: 'compact',
        titleMaxChars: 16,
        messageMaxChars: 16,
        textEncoding: 'ascii'
      })
    );
    expect(channels.some((channel) => channel.id === 'pin.gp20')).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.gp21')).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.gp22')).toBe(true);
    expect(channels.some((channel) => channel.id === 'pin.gp0')).toBe(true);
    expect(channels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(channels.some((channel) => channel.id.startsWith('ws2812.'))).toBe(false);
    expect(channels.some((channel) => channel.id === 'buzzer.gp18')).toBe(true);
  });

  it('exposes pattern action on Pico buzzer channels without board-level buzzer extension', () => {
    const channels = getBoardAvailableChannels('rp2040-pico');
    const extensions = getBoardDeviceExtensions('rp2040-pico');

    expect(channels.find((channel) => channel.id === 'buzzer.gp18')?.supportedActions).toEqual(
      expect.arrayContaining(['beep', 'tone', 'pattern', 'clear'])
    );
    expect(channels.find((channel) => channel.id === 'buzzer.gp19')?.supportedActions).toEqual(
      expect.arrayContaining(['beep', 'tone', 'pattern', 'clear'])
    );
    expect(extensions?.buzzer ?? null).toBeNull();
  });

  it('exposes expanded atmega32u4 channel catalogs by board', () => {
    const leonardoChannels = getBoardAvailableChannels('arduino-leonardo');
    const microChannels = getBoardAvailableChannels('arduino-micro');
    const proMicroChannels = getBoardAvailableChannels('sparkfun-pro-micro-32u4');

    expect(leonardoChannels.some((channel) => channel.id === 'pin.d18')).toBe(true);
    expect(leonardoChannels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(leonardoChannels.some((channel) => channel.id === 'buzzer.d9')).toBe(true);
    expect(leonardoChannels.some((channel) => channel.id.startsWith('ws2812.'))).toBe(false);
    expect(microChannels.some((channel) => channel.id === 'pin.d16')).toBe(true);
    expect(microChannels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(proMicroChannels.some((channel) => channel.id === 'pin.d10')).toBe(true);
    expect(proMicroChannels.some((channel) => channel.id === 'pin.a0')).toBe(true);
    expect(proMicroChannels.find((channel) => channel.id === 'pin.a0')?.label).toBe('A0');
    expect(proMicroChannels.some((channel) => channel.id === 'pin.d17')).toBe(false);
    expect(proMicroChannels.some((channel) => channel.id === 'pin.d18')).toBe(false);
    expect(proMicroChannels.some((channel) => channel.id === 'pin.d13')).toBe(false);
    expect(proMicroChannels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(proMicroChannels.find((channel) => channel.id === 'pin.d3')?.supportedActions).toContain('breathe');
    expect(proMicroChannels.find((channel) => channel.id === 'pin.d5')?.supportedActions).toContain('breathe');
    expect(proMicroChannels.find((channel) => channel.id === 'pin.d6')?.supportedActions).toContain('breathe');
    expect(proMicroChannels.find((channel) => channel.id === 'pin.d9')?.supportedActions).toContain('breathe');
    expect(proMicroChannels.find((channel) => channel.id === 'pin.d10')?.supportedActions).toContain('breathe');
  });

  it('exposes tiny-avr digital channels and adds breathe only to pwm-capable pins', () => {
    const unoChannels = getBoardAvailableChannels('arduino-uno');
    const nanoChannels = getBoardAvailableChannels('arduino-nano');

    const expectedTinyAvrChannels = [
      'pin.d2',
      'pin.d3',
      'pin.d4',
      'pin.d5',
      'pin.d6',
      'pin.d7',
      'pin.d8',
      'pin.d9',
      'pin.d10'
    ];
    expect(unoChannels.map((channel) => channel.id)).toEqual(expectedTinyAvrChannels);
    expect(nanoChannels.map((channel) => channel.id)).toEqual(expectedTinyAvrChannels);
    expect(unoChannels.find((channel) => channel.id === 'pin.d3')?.label).toBe('D3 / PWM');
    expect(unoChannels.find((channel) => channel.id === 'pin.d10')?.label).toBe('D10 / PWM / SS');
    expect(unoChannels.find((channel) => channel.id === 'pin.d2')?.supportedActions).not.toContain('breathe');
    expect(unoChannels.find((channel) => channel.id === 'pin.d3')?.supportedActions).toContain('breathe');
    expect(unoChannels.find((channel) => channel.id === 'pin.d5')?.supportedActions).toContain('breathe');
    expect(unoChannels.find((channel) => channel.id === 'pin.d6')?.supportedActions).toContain('breathe');
    expect(unoChannels.find((channel) => channel.id === 'pin.d9')?.supportedActions).toContain('breathe');
    expect(unoChannels.find((channel) => channel.id === 'pin.d10')?.supportedActions).toContain('breathe');
    expect(unoChannels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(unoChannels.some((channel) => channel.id.startsWith('buzzer.'))).toBe(false);
    expect(unoChannels.some((channel) => channel.id.startsWith('ws2812.'))).toBe(false);
    expect(unoChannels.some((channel) => channel.id === 'pin.d0')).toBe(false);
    expect(unoChannels.some((channel) => channel.id === 'pin.d1')).toBe(false);
    expect(unoChannels.some((channel) => channel.id === 'pin.d11')).toBe(false);
    expect(unoChannels.some((channel) => channel.id === 'pin.a0')).toBe(false);
    expect(nanoChannels.find((channel) => channel.id === 'pin.d3')?.supportedActions).toContain('breathe');
    expect(nanoChannels.find((channel) => channel.id === 'pin.d10')?.supportedActions).toContain('breathe');
    expect(nanoChannels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(nanoChannels.some((channel) => channel.id.startsWith('buzzer.'))).toBe(false);
    expect(nanoChannels.some((channel) => channel.id.startsWith('ws2812.'))).toBe(false);
    expect(nanoChannels.some((channel) => channel.id === 'pin.d0')).toBe(false);
    expect(nanoChannels.some((channel) => channel.id === 'pin.d1')).toBe(false);
  });

  it('exposes small-mcu STM32 Blue Pill channels with USB CDC sized digital output support', () => {
    const channels = getBoardAvailableChannels('stm32f103cx-blue-pill');

    expect(channels.map((channel) => channel.id)).toEqual([
      'pin.pa0',
      'pin.pa1',
      'pin.pa2',
      'pin.pa3',
      'pin.pa4',
      'pin.pa5',
      'pin.pa6',
      'pin.pa7',
      'pin.pb0',
      'pin.pb1',
      'pin.pb10',
      'pin.pb11'
    ]);
    expect(channels.find((channel) => channel.id === 'pin.pa0')?.supportedActions).not.toContain('breathe');
    expect(channels.find((channel) => channel.id === 'pin.pa0')?.supportedActions).toEqual([
      'activate',
      'deactivate',
      'blink',
      'pulse'
    ]);
    expect(channels.find((channel) => channel.id === 'pin.pa4')?.supportedActions).not.toContain('breathe');
    expect(channels.some((channel) => channel.id.startsWith('pwm.'))).toBe(false);
    expect(channels.some((channel) => channel.id.startsWith('buzzer.'))).toBe(false);
    expect(channels.some((channel) => channel.id.startsWith('ws2812.'))).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.pa13')).toBe(false);
    expect(channels.some((channel) => channel.id === 'pin.pa14')).toBe(false);
  });

  it('exposes Wio Terminal as an extended device board with onboard buzzer', () => {
    const channels = getBoardAvailableChannels('seeed-wio-terminal');

    expect(channels.map((channel) => channel.id)).toEqual(
      expect.arrayContaining([
        'pin.d0',
        'pin.d1',
        'pin.d2',
        'pin.d3',
        'pin.d4',
        'pin.d5',
        'pin.d6',
        'pin.d7',
        'pin.d8',
        'buzzer.onboard'
      ])
    );
    expect(channels.find((channel) => channel.id === 'pin.d0')?.digitalOutput?.pin).toBe(0);
    expect(channels.find((channel) => channel.id === 'pin.d0')?.label).toBe(
      'D0 / BCM27 / A0 / PWM0'
    );
    expect(channels.find((channel) => channel.id === 'pin.d1')?.digitalOutput?.pin).toBe(1);
    expect(channels.find((channel) => channel.id === 'pin.d2')?.digitalOutput?.pin).toBe(2);
    expect(channels.find((channel) => channel.id === 'pin.d3')?.digitalOutput?.pin).toBe(3);
    expect(channels.find((channel) => channel.id === 'pin.d4')?.digitalOutput?.pin).toBe(4);
    expect(channels.find((channel) => channel.id === 'pin.d5')?.digitalOutput?.pin).toBe(5);
    expect(channels.find((channel) => channel.id === 'pin.d6')?.digitalOutput?.pin).toBe(6);
    expect(channels.find((channel) => channel.id === 'pin.d7')?.digitalOutput?.pin).toBe(7);
    expect(channels.find((channel) => channel.id === 'pin.d8')?.digitalOutput?.pin).toBe(8);
    expect(channels.find((channel) => channel.id === 'pin.d0')?.supportedActions).toContain(
      'breathe'
    );
    expect(channels.find((channel) => channel.id === 'pin.d1')?.supportedActions).not.toContain(
      'breathe'
    );
    expect(channels.find((channel) => channel.id === 'buzzer.onboard')?.supportedActions).toEqual(
      expect.arrayContaining(['beep', 'tone'])
    );
  });
});
