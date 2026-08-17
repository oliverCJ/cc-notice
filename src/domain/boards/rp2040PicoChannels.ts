import { DeviceChannel } from '@/api/tauriApi';
import { getRp2040PicoPin, rp2040PicoPins } from './rp2040PicoPinCatalog';

const digitalOutputActions = ['activate', 'deactivate', 'blink', 'breathe', 'pulse'] as const;

function createRp2040PicoDigitalChannels(excludedGpios: number[] = []): DeviceChannel[] {
  const excluded = new Set(excludedGpios);
  return rp2040PicoPins
    .filter((pin) => pin.digitalOutputAllowed && !excluded.has(pin.gpio))
    .map((pin) => ({
      id: `pin.gp${pin.gpio}`,
      label: `GP${pin.gpio}`,
      kind: 'digital-output',
      direction: 'output',
      description: `GPIO ${pin.gpio}`,
      physicalPin: pin.physicalPin,
      digitalOutput: {
        pin: pin.gpio,
        activeLevel: 'high',
        defaultLevel: 'low',
        allowBlink: true
      },
      pwmOutput: null,
      buzzer: null,
      addressableLed: null,
      supportedActions: [...digitalOutputActions],
      hardwareGuideId: 'digital-output'
    }));
}

export function supportsRp2040PicoGpioInput(channel: DeviceChannel) {
  return channel.id.startsWith('pin.gp') && Boolean(channel.digitalOutput);
}

export function toRp2040PicoGpioInputChannel(channel: DeviceChannel): DeviceChannel {
  return {
    ...channel,
    kind: 'button-input',
    direction: 'input',
    input: {
      control: channel.id,
      inputKind: 'gpio',
      fixed: false
    },
    supportedActions: [],
    hardwareGuideId: null
  };
}

export function toRp2040PicoGpioOutputChannel(channel: DeviceChannel): DeviceChannel {
  return {
    ...channel,
    kind: 'digital-output',
    direction: 'output',
    input: null,
    supportedActions: [...digitalOutputActions],
    hardwareGuideId: 'digital-output'
  };
}

const rp2040PicoDefaultSpecialChannels: DeviceChannel[] = [
  createBuzzerChannel(18),
  createBuzzerChannel(19)
];

function createBuzzerChannel(gpio: number): DeviceChannel {
  const pin = getRp2040PicoPin(gpio);
  return {
    id: `buzzer.gp${gpio}`,
    label: `GP${gpio} Buzzer`,
    kind: 'buzzer',
    description: `GPIO ${gpio} buzzer`,
    physicalPin: pin.physicalPin,
    digitalOutput: null,
    pwmOutput: null,
    buzzer: {
      pin: gpio,
      activeLevel: 'high',
      defaultFrequencyHz: 2000,
      supportsTone: true
    },
    addressableLed: null,
    supportedActions: ['beep', 'tone', 'pattern', 'clear'],
    hardwareGuideId: 'buzzer'
  };
}

export const rp2040PicoAvailableChannels: DeviceChannel[] = [
  ...createRp2040PicoDigitalChannels(),
  ...rp2040PicoDefaultSpecialChannels
];

export const rp2040PicoOledAvailableChannels: DeviceChannel[] = [
  ...createRp2040PicoDigitalChannels([20, 21, 22]),
  ...rp2040PicoDefaultSpecialChannels
];

export const rp2040PicoOled091AvailableChannels: DeviceChannel[] = [
  ...createRp2040PicoDigitalChannels([20, 21]),
  ...rp2040PicoDefaultSpecialChannels
];
