import {
  DeviceChannel,
  DeviceChannelActionType,
  DeviceChannelKind,
  DeviceExtensionCapabilities
} from '@/api/tauriApi';
import {
  rp2040PicoAvailableChannels,
  rp2040PicoOled091AvailableChannels,
  rp2040PicoOledAvailableChannels
} from './rp2040PicoChannels';

export type BoardIdentityLabel = 'stable-usb' | 'stable-uid' | 'limited' | 'unknown';
export type BoardConnectionResourceMode = 'matched-only' | 'manual-fallback';

type BoardCatalogEntry = {
  id: string;
  displayName: string;
  identityLabel: BoardIdentityLabel;
  connectionResourceMode: BoardConnectionResourceMode;
  channels: DeviceChannel[];
  deviceExtensions?: DeviceExtensionCapabilities | null;
};

type CatalogPin = {
  id: string;
  label: string;
  pin: number;
  capabilities: DeviceChannelKind[];
};

const commonAtmega32u4Pins: CatalogPin[] = [
  pin('d0', 'D0 / RX', 0, ['digital-output']),
  pin('d1', 'D1 / TX', 1, ['digital-output']),
  pin('d2', 'D2 / SDA', 2, ['digital-output']),
  pin('d3', 'D3 / SCL / PWM', 3, ['digital-output', 'pwm-output']),
  pin('d4', 'D4 / A6', 4, ['digital-output']),
  pin('d5', 'D5 / PWM', 5, ['digital-output', 'pwm-output']),
  pin('d6', 'D6 / A7 / PWM', 6, ['digital-output', 'pwm-output']),
  pin('d7', 'D7', 7, ['digital-output']),
  pin('d8', 'D8 / A8', 8, ['digital-output']),
  pin('d9', 'D9 / A9 / PWM', 9, ['digital-output', 'pwm-output', 'buzzer']),
  pin('d10', 'D10 / A10 / PWM', 10, ['digital-output', 'pwm-output']),
  pin('d11', 'D11 / PWM', 11, ['digital-output']),
  pin('d12', 'D12 / A11', 12, ['digital-output']),
  pin('d13', 'D13 / PWM / LED', 13, ['digital-output']),
  pin('d14', 'D14 / CIPO', 14, ['digital-output']),
  pin('d15', 'D15 / SCK', 15, ['digital-output']),
  pin('d16', 'D16 / COPI', 16, ['digital-output']),
  pin('d17', 'D17 / SS', 17, ['digital-output']),
  pin('d18', 'A0 / D18', 18, ['digital-output']),
  pin('d19', 'A1 / D19', 19, ['digital-output']),
  pin('d20', 'A2 / D20', 20, ['digital-output']),
  pin('d21', 'A3 / D21', 21, ['digital-output']),
  pin('d22', 'A4 / D22', 22, ['digital-output']),
  pin('d23', 'A5 / D23', 23, ['digital-output'])
];

const proMicroPins: CatalogPin[] = [
  pin('d0', 'D0 / RX', 0, ['digital-output']),
  pin('d1', 'D1 / TX', 1, ['digital-output']),
  pin('d2', 'D2 / SDA', 2, ['digital-output']),
  pin('d3', 'D3 / SCL / PWM', 3, ['digital-output', 'pwm-output']),
  pin('d4', 'D4 / A6', 4, ['digital-output']),
  pin('d5', 'D5 / PWM', 5, ['digital-output', 'pwm-output']),
  pin('d6', 'D6 / A7 / PWM', 6, ['digital-output', 'pwm-output']),
  pin('d7', 'D7', 7, ['digital-output']),
  pin('d8', 'D8 / A8', 8, ['digital-output']),
  pin('d9', 'D9 / A9 / PWM', 9, ['digital-output', 'pwm-output', 'buzzer']),
  pin('d10', 'D10 / A10 / PWM', 10, ['digital-output', 'pwm-output']),
  pin('d14', 'D14 / CIPO', 14, ['digital-output']),
  pin('d15', 'D15 / SCK', 15, ['digital-output']),
  pin('d16', 'D16 / COPI', 16, ['digital-output']),
  pin('a0', 'A0', 18, ['digital-output']),
  pin('a1', 'A1', 19, ['digital-output']),
  pin('a2', 'A2', 20, ['digital-output']),
  pin('a3', 'A3', 21, ['digital-output'])
];

const commonAtmega328pPins: CatalogPin[] = [
  pin('d0', 'D0 / RX', 0, []),
  pin('d1', 'D1 / TX', 1, []),
  pin('d2', 'D2', 2, ['digital-output']),
  pin('d3', 'D3 / PWM', 3, ['digital-output', 'pwm-output']),
  pin('d4', 'D4', 4, ['digital-output']),
  pin('d5', 'D5 / PWM', 5, ['digital-output', 'pwm-output']),
  pin('d6', 'D6 / PWM', 6, ['digital-output', 'pwm-output']),
  pin('d7', 'D7', 7, ['digital-output']),
  pin('d8', 'D8', 8, ['digital-output']),
  pin('d9', 'D9 / PWM', 9, ['digital-output', 'pwm-output']),
  pin('d10', 'D10 / PWM / SS', 10, ['digital-output', 'pwm-output']),
  pin('d11', 'D11 / PWM / COPI', 11, ['digital-output']),
  pin('d12', 'D12 / CIPO', 12, ['digital-output']),
  pin('d13', 'D13 / SCK / LED', 13, ['digital-output'])
];

const stm32BluePillPins: CatalogPin[] = [
  pin('pa0', 'PA0 / PWM', 0, ['digital-output', 'pwm-output']),
  pin('pa1', 'PA1 / PWM', 1, ['digital-output', 'pwm-output']),
  pin('pa2', 'PA2 / USART2 TX / PWM', 2, ['digital-output', 'pwm-output']),
  pin('pa3', 'PA3 / USART2 RX / PWM', 3, ['digital-output', 'pwm-output']),
  pin('pa4', 'PA4 / SPI1 NSS', 4, ['digital-output']),
  pin('pa5', 'PA5 / SPI1 SCK', 5, ['digital-output']),
  pin('pa6', 'PA6 / SPI1 MISO / PWM', 6, ['digital-output', 'pwm-output']),
  pin('pa7', 'PA7 / SPI1 MOSI / PWM', 7, ['digital-output', 'pwm-output']),
  pin('pb0', 'PB0 / PWM', 8, ['digital-output', 'pwm-output']),
  pin('pb1', 'PB1 / PWM', 9, ['digital-output', 'pwm-output']),
  pin('pb10', 'PB10 / I2C2 SCL / USART3 TX', 10, ['digital-output']),
  pin('pb11', 'PB11 / I2C2 SDA / USART3 RX', 11, ['digital-output'])
];

const wioTerminalPins: CatalogPin[] = [
  pin('d0', 'D0 / BCM27 / A0 / PWM0', 0, ['digital-output', 'pwm-output']),
  pin('d1', 'D1 / BCM22 / A1', 1, ['digital-output']),
  pin('d2', 'D2 / BCM23 / A2 / PWM1', 2, ['digital-output', 'pwm-output']),
  pin('d3', 'D3 / BCM24 / A3', 3, ['digital-output']),
  pin('d4', 'D4 / BCM25 / A4', 4, ['digital-output']),
  pin('d5', 'D5 / BCM12 / A5', 5, ['digital-output']),
  pin('d6', 'D6 / BCM13 / A6 / PWM3', 6, ['digital-output', 'pwm-output']),
  pin('d7', 'D7 / BCM16 / A7', 7, ['digital-output']),
  pin('d8', 'D8 / BCM26 / A8 / PWM4', 8, ['digital-output', 'pwm-output']),
  pin('onboard', 'Onboard buzzer', 12, ['buzzer'])
];

const wioTerminalButtonInputs = [
  { id: 'button.a', label: 'Button A' },
  { id: 'button.b', label: 'Button B' },
  { id: 'button.c', label: 'Button C' },
  { id: 'fiveway.up', label: '5-way Up' },
  { id: 'fiveway.down', label: '5-way Down' }
];

// 当前为后端 boards.yaml 的前端展示镜像，后续由 Tauri catalog 命令提供。
const boardCatalog: BoardCatalogEntry[] = [
  {
    id: 'rp2040-pico',
    displayName: 'Raspberry Pi Pico',
    identityLabel: 'stable-uid',
    connectionResourceMode: 'matched-only',
    channels: rp2040PicoAvailableChannels
  },
  {
    id: 'rp2040-pico-oled-096',
    displayName: 'Raspberry Pi Pico + OLED 0.96" 128x64',
    identityLabel: 'stable-uid',
    connectionResourceMode: 'matched-only',
    deviceExtensions: {
      display: {
        status: true,
        card: false,
        lines: true,
        runtime: true,
        clear: true,
        sizeClass: 'small',
        statuses: ['notice', 'working', 'success', 'warning', 'error'],
        titleMaxChars: 16,
        messageMaxChars: 16,
        textEncoding: 'ascii'
      }
    },
    channels: rp2040PicoOledAvailableChannels
  },
  {
    id: 'rp2040-pico-oled-091',
    displayName: 'Raspberry Pi Pico + OLED 0.91" 128x32',
    identityLabel: 'stable-uid',
    connectionResourceMode: 'matched-only',
    deviceExtensions: {
      display: {
        status: true,
        card: false,
        lines: true,
        runtime: true,
        clear: true,
        sizeClass: 'compact',
        statuses: ['notice', 'working', 'success', 'warning', 'error'],
        titleMaxChars: 16,
        messageMaxChars: 16,
        textEncoding: 'ascii'
      }
    },
    channels: rp2040PicoOled091AvailableChannels
  },
  {
    id: 'arduino-leonardo',
    displayName: 'Arduino Leonardo',
    identityLabel: 'limited',
    connectionResourceMode: 'manual-fallback',
    channels: createAtmega32u4Channels(commonAtmega32u4Pins)
  },
  {
    id: 'arduino-micro',
    displayName: 'Arduino Micro',
    identityLabel: 'limited',
    connectionResourceMode: 'manual-fallback',
    channels: createAtmega32u4Channels(commonAtmega32u4Pins)
  },
  {
    id: 'sparkfun-pro-micro-32u4',
    displayName: 'SparkFun Pro Micro 32U4',
    identityLabel: 'limited',
    connectionResourceMode: 'manual-fallback',
    channels: createAtmega32u4Channels(proMicroPins)
  },
  {
    id: 'arduino-uno',
    displayName: 'Arduino Uno',
    identityLabel: 'limited',
    connectionResourceMode: 'manual-fallback',
    channels: createTinyAvrChannels()
  },
  {
    id: 'arduino-nano',
    displayName: 'Arduino Nano',
    identityLabel: 'limited',
    connectionResourceMode: 'manual-fallback',
    channels: createTinyAvrChannels()
  },
  {
    id: 'stm32f103cx-blue-pill',
    displayName: 'STM32F103C8T6/C6T6 Blue Pill',
    identityLabel: 'limited',
    connectionResourceMode: 'manual-fallback',
    channels: createSmallMcuDigitalChannels(stm32BluePillPins)
  },
  {
    id: 'seeed-wio-terminal',
    displayName: 'Seeed Studio Wio Terminal',
    identityLabel: 'stable-uid',
    connectionResourceMode: 'manual-fallback',
    deviceExtensions: {
      display: {
        status: true,
        card: true,
        lines: true,
        runtime: true,
        clear: true,
        sizeClass: 'medium',
        statuses: ['notice', 'working', 'success', 'warning', 'error'],
        titleMaxChars: 39,
        messageMaxChars: 95,
        textEncoding: 'ascii'
      },
      buzzer: {
        patterns: ['notice', 'success', 'warning', 'error', 'working']
      },
      inputs: {
        buttons: {
          status: 'supported',
          controls: ['button.a', 'button.b', 'button.c', 'fiveway.up', 'fiveway.down']
        }
      }
    },
    channels: createWioTerminalChannels()
  }
];

export function getBoardDisplayName(boardId: string): string {
  return findBoard(boardId)?.displayName ?? boardId;
}

export function getBoardIdentityLabel(boardId: string): BoardIdentityLabel {
  return findBoard(boardId)?.identityLabel ?? 'unknown';
}

export function getBoardConnectionResourceMode(boardId: string): BoardConnectionResourceMode {
  return findBoard(boardId)?.connectionResourceMode ?? 'matched-only';
}

export function getBoardAvailableChannels(boardId: string): DeviceChannel[] {
  return findBoard(boardId)?.channels ?? [];
}

export function getBoardDeviceExtensions(boardId: string): DeviceExtensionCapabilities | null {
  return findBoard(boardId)?.deviceExtensions ?? null;
}

function findBoard(boardId: string): BoardCatalogEntry | undefined {
  return boardCatalog.find((board) => board.id === boardId);
}

function createAtmega32u4Channels(pins: CatalogPin[]): DeviceChannel[] {
  return pins.flatMap((pin) => createArduinoChannelsForPin(pin));
}

function createTinyAvrChannels(): DeviceChannel[] {
  const availablePins = commonAtmega328pPins.filter((pin) => pin.pin >= 2 && pin.pin <= 10);
  return availablePins
    .filter((pin) => pin.capabilities.includes('digital-output'))
    .map((pin) => createTinyAvrDigitalChannel(pin));
}

function createTinyAvrDigitalChannel(pin: CatalogPin): DeviceChannel {
  const supportedActions = pin.capabilities.includes('pwm-output')
    ? actions('activate', 'deactivate', 'blink', 'breathe', 'pulse')
    : actions('activate', 'deactivate', 'blink', 'pulse');
  return {
    ...createChannel(pin, 'digital-output'),
    supportedActions
  };
}

function createSmallMcuDigitalChannels(pins: CatalogPin[]): DeviceChannel[] {
  return pins
    .filter((pin) => pin.capabilities.includes('digital-output'))
    .map((pin) => ({
      ...createChannel(pin, 'digital-output'),
      supportedActions: actions('activate', 'deactivate', 'blink', 'pulse')
    }));
}

function createWioTerminalChannels(): DeviceChannel[] {
  const outputChannels = wioTerminalPins.flatMap((pin) => {
    if (pin.capabilities.includes('buzzer')) {
      return createChannel(pin, 'buzzer');
    }
    if (pin.capabilities.includes('digital-output')) {
      return createPwmAwareDigitalChannel(pin);
    }
    return [];
  });
  return [...outputChannels, ...wioTerminalButtonInputs.map(createWioFixedInputChannel)];
}

function createPwmAwareDigitalChannel(pin: CatalogPin): DeviceChannel {
  const supportedActions = pin.capabilities.includes('pwm-output')
    ? actions('activate', 'deactivate', 'blink', 'breathe', 'pulse')
    : actions('activate', 'deactivate', 'blink', 'pulse');
  return {
    ...createChannel(pin, 'digital-output'),
    supportedActions
  };
}

function pin(
  id: string,
  label: string,
  arduinoPin: number,
  capabilities: DeviceChannelKind[]
): CatalogPin {
  return { id, label, pin: arduinoPin, capabilities };
}

function createChannelsForPin(pin: CatalogPin): DeviceChannel[] {
  return pin.capabilities.map((capability) => createChannel(pin, capability));
}

function createArduinoChannelsForPin(pin: CatalogPin): DeviceChannel[] {
  return createChannelsForPin(pin)
    .filter((channel) => channel.kind !== 'pwm-output' && channel.kind !== 'addressable-led')
    .map((channel) => {
    if (channel.kind !== 'digital-output') {
      return channel;
    }
    const supportedActions = pin.capabilities.includes('pwm-output')
      ? actions('activate', 'deactivate', 'blink', 'breathe', 'pulse')
      : actions('activate', 'deactivate', 'blink', 'pulse');
    return {
      ...channel,
      supportedActions
    };
  });
}

function createChannel(pin: CatalogPin, kind: DeviceChannelKind): DeviceChannel {
  if (kind === 'digital-output') {
    return {
      id: `pin.${pin.id}`,
      label: pin.label,
      kind,
      direction: 'output',
      description: pin.label,
      physicalPin: null,
      digitalOutput: {
        pin: pin.pin,
        activeLevel: 'high',
        defaultLevel: 'low',
        allowBlink: true
      },
      pwmOutput: null,
      buzzer: null,
      addressableLed: null,
      input: null,
      supportedActions: actions('activate', 'deactivate', 'blink', 'breathe', 'pulse'),
      hardwareGuideId: 'digital-output'
    };
  }

  if (kind === 'pwm-output') {
    return {
      id: `pwm.${pin.id}`,
      label: ensureSuffix(pin.label, 'PWM'),
      kind,
      direction: 'output',
      description: pin.label,
      physicalPin: null,
      digitalOutput: null,
      pwmOutput: {
        pin: pin.pin,
        frequencyHz: 1000,
        defaultDutyPercent: 0,
        maxDutyPercent: 100
      },
      buzzer: null,
      addressableLed: null,
      input: null,
      supportedActions: actions('set-duty', 'pulse', 'breathe', 'clear'),
      hardwareGuideId: 'pwm-output'
    };
  }

  if (kind === 'buzzer') {
    return {
      id: `buzzer.${pin.id}`,
      label: ensureSuffix(pin.label, 'Buzzer'),
      kind,
      direction: 'output',
      description: pin.label,
      physicalPin: null,
      digitalOutput: null,
      pwmOutput: null,
      buzzer: {
        pin: pin.pin,
        activeLevel: 'high',
        defaultFrequencyHz: 2000,
        supportsTone: true
      },
      addressableLed: null,
      input: null,
      supportedActions: actions('beep', 'tone', 'pattern', 'clear'),
      hardwareGuideId: 'buzzer'
    };
  }

  return {
    id: `ws2812.${pin.id}`,
    label: ensureSuffix(pin.label, 'WS2812'),
    kind: 'addressable-led',
    direction: 'output',
    description: pin.label,
    physicalPin: null,
    digitalOutput: null,
    pwmOutput: null,
    buzzer: null,
    addressableLed: {
      pin: pin.pin,
      protocol: 'ws2812',
      ledCount: 8,
      colorOrder: 'grb',
      defaultBrightnessPercent: 30
    },
    input: null,
    supportedActions: actions('set-color', 'clear'),
    hardwareGuideId: 'addressable-led'
  };
}

function createWioFixedInputChannel(control: { id: string; label: string }): DeviceChannel {
  return {
    id: `input.${control.id}`,
    label: control.label,
    kind: 'button-input',
    direction: 'input',
    description: control.label,
    physicalPin: null,
    digitalOutput: null,
    pwmOutput: null,
    buzzer: null,
    addressableLed: null,
    input: {
      control: control.id,
      inputKind: 'button',
      fixed: true
    },
    supportedActions: [],
    hardwareGuideId: null
  };
}

function ensureSuffix(label: string, suffix: string): string {
  return label.includes(suffix) ? label : `${label} ${suffix}`;
}

function actions(...items: DeviceChannelActionType[]): DeviceChannelActionType[] {
  return items;
}
