import { DeviceChannelKind } from '@/api/tauriApi';

export type Rp2040PicoReferenceDocument = {
  id: 'pinout' | 'pico-datasheet' | 'rp2040-datasheet';
  labelKey: string;
  url: string;
};

export const rp2040PicoReferenceDocuments: Rp2040PicoReferenceDocument[] = [
  {
    id: 'pinout',
    labelKey: 'hardwareGuides.pinout.references.pinout',
    url: 'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#non-wireless-board-layout'
  },
  {
    id: 'pico-datasheet',
    labelKey: 'hardwareGuides.pinout.references.picoDatasheet',
    url: 'https://pip-assets.raspberrypi.com/categories/610-raspberry-pi-pico/documents/RP-008307-DS-1-pico-datasheet.pdf'
  },
  {
    id: 'rp2040-datasheet',
    labelKey: 'hardwareGuides.pinout.references.rp2040Datasheet',
    url: 'https://pip-assets.raspberrypi.com/categories/814-rp2040/documents/RP-008371-DS-1-rp2040-datasheet.pdf'
  }
];

export type Rp2040PicoPin = {
  gpio: number;
  physicalPin: number;
  digitalOutputAllowed: boolean;
  reservedKind?: DeviceChannelKind;
};

export type Rp2040PicoPhysicalPin = {
  physicalPin: number;
  label: string;
  category: Rp2040PicoPhysicalPinCategory;
  gpio?: number;
};

export type Rp2040PicoPhysicalPinCategory = 'gpio' | 'ground' | 'power' | 'system' | 'analog';

const reservedOutputKindsByGpio = new Map<number, DeviceChannelKind>([
  [14, 'pwm-output'],
  [15, 'pwm-output'],
  [16, 'addressable-led'],
  [17, 'addressable-led'],
  [18, 'buzzer'],
  [19, 'buzzer']
]);

export const rp2040PicoPhysicalPins: Rp2040PicoPhysicalPin[] = [
  { physicalPin: 1, label: 'GP0', category: 'gpio', gpio: 0 },
  { physicalPin: 2, label: 'GP1', category: 'gpio', gpio: 1 },
  { physicalPin: 3, label: 'GND', category: 'ground' },
  { physicalPin: 4, label: 'GP2', category: 'gpio', gpio: 2 },
  { physicalPin: 5, label: 'GP3', category: 'gpio', gpio: 3 },
  { physicalPin: 6, label: 'GP4', category: 'gpio', gpio: 4 },
  { physicalPin: 7, label: 'GP5', category: 'gpio', gpio: 5 },
  { physicalPin: 8, label: 'GND', category: 'ground' },
  { physicalPin: 9, label: 'GP6', category: 'gpio', gpio: 6 },
  { physicalPin: 10, label: 'GP7', category: 'gpio', gpio: 7 },
  { physicalPin: 11, label: 'GP8', category: 'gpio', gpio: 8 },
  { physicalPin: 12, label: 'GP9', category: 'gpio', gpio: 9 },
  { physicalPin: 13, label: 'GND', category: 'ground' },
  { physicalPin: 14, label: 'GP10', category: 'gpio', gpio: 10 },
  { physicalPin: 15, label: 'GP11', category: 'gpio', gpio: 11 },
  { physicalPin: 16, label: 'GP12', category: 'gpio', gpio: 12 },
  { physicalPin: 17, label: 'GP13', category: 'gpio', gpio: 13 },
  { physicalPin: 18, label: 'GND', category: 'ground' },
  { physicalPin: 19, label: 'GP14', category: 'gpio', gpio: 14 },
  { physicalPin: 20, label: 'GP15', category: 'gpio', gpio: 15 },
  { physicalPin: 21, label: 'GP16', category: 'gpio', gpio: 16 },
  { physicalPin: 22, label: 'GP17', category: 'gpio', gpio: 17 },
  { physicalPin: 23, label: 'GND', category: 'ground' },
  { physicalPin: 24, label: 'GP18', category: 'gpio', gpio: 18 },
  { physicalPin: 25, label: 'GP19', category: 'gpio', gpio: 19 },
  { physicalPin: 26, label: 'GP20', category: 'gpio', gpio: 20 },
  { physicalPin: 27, label: 'GP21', category: 'gpio', gpio: 21 },
  { physicalPin: 28, label: 'GND', category: 'ground' },
  { physicalPin: 29, label: 'GP22', category: 'gpio', gpio: 22 },
  { physicalPin: 30, label: 'RUN', category: 'system' },
  { physicalPin: 31, label: 'GP26', category: 'analog', gpio: 26 },
  { physicalPin: 32, label: 'GP27', category: 'analog', gpio: 27 },
  { physicalPin: 33, label: 'AGND', category: 'ground' },
  { physicalPin: 34, label: 'GP28', category: 'analog', gpio: 28 },
  { physicalPin: 35, label: 'ADC_VREF', category: 'analog' },
  { physicalPin: 36, label: '3V3', category: 'power' },
  { physicalPin: 37, label: '3V3_EN', category: 'power' },
  { physicalPin: 38, label: 'GND', category: 'ground' },
  { physicalPin: 39, label: 'VSYS', category: 'power' },
  { physicalPin: 40, label: 'VBUS', category: 'power' }
];

export const rp2040PicoPins: Rp2040PicoPin[] = rp2040PicoPhysicalPins
  .filter((pin): pin is Rp2040PicoPhysicalPin & { gpio: number } => pin.gpio !== undefined)
  .map((pin) => ({
  ...pin,
  digitalOutputAllowed: !reservedOutputKindsByGpio.has(pin.gpio),
  reservedKind: reservedOutputKindsByGpio.get(pin.gpio)
}));

export function getRp2040PicoPin(gpio: number): Rp2040PicoPin {
  const pin = rp2040PicoPins.find((item) => item.gpio === gpio);
  if (!pin) {
    throw new Error(`Unsupported RP2040 Pico GPIO pin: ${gpio}`);
  }
  return pin;
}

export function formatRp2040PicoPinLabel(gpio: number): string {
  const pin = getRp2040PicoPin(gpio);
  return `GP${pin.gpio} · Pin ${pin.physicalPin}`;
}
