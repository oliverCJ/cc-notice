import { FirmwareCatalogArtifact } from '@/api/tauriApi';

export type FirmwareWiringPin = {
  label: string;
  functionKey: string;
  wiringKey: string;
};

export type FirmwareWiringGuide = {
  titleKey: string;
  summaryKey: string;
  pinRows: FirmwareWiringPin[];
  reservedPinKeys: string[];
  noticeKeys: string[];
};

const rp2040CommonOutputRows: FirmwareWiringPin[] = [
  pinRow('GP0-GP13, GP20-GP22, GP26-GP28', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput'),
  pinRow('GP18 / GP19', 'firmware.wiring.functions.buzzer', 'firmware.wiring.wires.buzzer')
];

const rp2040Oled091OutputRows: FirmwareWiringPin[] = [
  pinRow('GP0-GP13, GP22, GP26-GP28', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput'),
  pinRow('GP18 / GP19', 'firmware.wiring.functions.buzzer', 'firmware.wiring.wires.buzzer')
];

const guidesByBoardId: Record<string, FirmwareWiringGuide> = {
  'rp2040-pico': {
    titleKey: 'firmware.wiring.guides.rp2040Pico.title',
    summaryKey: 'firmware.wiring.guides.rp2040Pico.summary',
    pinRows: rp2040CommonOutputRows,
    reservedPinKeys: [
      'firmware.wiring.guides.rp2040Pico.reserved.usb',
      'firmware.wiring.guides.rp2040Pico.reserved.system'
    ],
    noticeKeys: [
      'firmware.wiring.noticeItems.rp2040Voltage',
      'firmware.wiring.noticeItems.sharedGround',
      'firmware.wiring.noticeItems.driverForLoad'
    ]
  },
  'arduino-uno': {
    titleKey: 'firmware.wiring.guides.arduinoUno.title',
    summaryKey: 'firmware.wiring.guides.arduinoUno.summary',
    pinRows: [
      pinRow('D2-D10', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput')
    ],
    reservedPinKeys: ['firmware.wiring.guides.arduinoUno.reserved.serial'],
    noticeKeys: [
      'firmware.wiring.noticeItems.arduinoVoltage',
      'firmware.wiring.noticeItems.sharedGround',
      'firmware.wiring.noticeItems.driverForLoad'
    ]
  },
  'arduino-nano': {
    titleKey: 'firmware.wiring.guides.arduinoNano.title',
    summaryKey: 'firmware.wiring.guides.arduinoNano.summary',
    pinRows: [
      pinRow('D2-D10', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput')
    ],
    reservedPinKeys: ['firmware.wiring.guides.arduinoNano.reserved.serialAnalog'],
    noticeKeys: [
      'firmware.wiring.noticeItems.arduinoVoltage',
      'firmware.wiring.noticeItems.sharedGround',
      'firmware.wiring.noticeItems.driverForLoad'
    ]
  },
  'sparkfun-pro-micro-32u4': {
    titleKey: 'firmware.wiring.guides.sparkfunProMicro32u4.title',
    summaryKey: 'firmware.wiring.guides.sparkfunProMicro32u4.summary',
    pinRows: [
      pinRow('D0-D10, D14-D16, A0-A3', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput'),
      pinRow('D3 / D5 / D6 / D9 / D10', 'firmware.wiring.functions.pwmOutput', 'firmware.wiring.wires.pwmOutput'),
      pinRow('D9', 'firmware.wiring.functions.buzzer', 'firmware.wiring.wires.buzzer')
    ],
    reservedPinKeys: [
      'firmware.wiring.guides.sparkfunProMicro32u4.reserved.usb',
      'firmware.wiring.guides.sparkfunProMicro32u4.reserved.unrouted',
      'firmware.wiring.guides.sparkfunProMicro32u4.reserved.sharedD9'
    ],
    noticeKeys: [
      'firmware.wiring.noticeItems.proMicroVoltage',
      'firmware.wiring.noticeItems.sharedGround',
      'firmware.wiring.noticeItems.driverForLoad'
    ]
  },
  'seeed-wio-terminal': {
    titleKey: 'firmware.wiring.guides.wioTerminal.title',
    summaryKey: 'firmware.wiring.guides.wioTerminal.summary',
    pinRows: [
      pinRow('D0-D8', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput'),
      pinRow('D0 / D2 / D6 / D8', 'firmware.wiring.functions.pwmOutput', 'firmware.wiring.wires.pwmOutput'),
      pinRow('Onboard buzzer', 'firmware.wiring.functions.onboardBuzzer', 'firmware.wiring.wires.onboardBuzzer'),
      pinRow('Built-in LCD', 'firmware.wiring.functions.builtInDisplay', 'firmware.wiring.wires.builtInDisplay')
    ],
    reservedPinKeys: ['firmware.wiring.guides.wioTerminal.reserved.onboard'],
    noticeKeys: [
      'firmware.wiring.noticeItems.sharedGround',
      'firmware.wiring.noticeItems.driverForLoad'
    ]
  },
  'stm32f103cx-blue-pill': {
    titleKey: 'firmware.wiring.guides.stm32BluePill.title',
    summaryKey: 'firmware.wiring.guides.stm32BluePill.summary',
    pinRows: [
      pinRow('PA0-PA7, PB0/PB1, PB10/PB11', 'firmware.wiring.functions.digitalOutput', 'firmware.wiring.wires.digitalOutput')
    ],
    reservedPinKeys: ['firmware.wiring.guides.stm32BluePill.reserved.swd'],
    noticeKeys: [
      'firmware.wiring.noticeItems.stm32Voltage',
      'firmware.wiring.noticeItems.sharedGround',
      'firmware.wiring.noticeItems.driverForLoad'
    ]
  }
};

const guidesByTargetId: Record<string, FirmwareWiringGuide> = {
  'rp2040-pico-oled-096-128x64': {
    titleKey: 'firmware.wiring.guides.rp2040PicoOled096.title',
    summaryKey: 'firmware.wiring.guides.rp2040PicoOled096.summary',
    pinRows: [
      pinRow('GP20', 'firmware.wiring.functions.oledSda', 'firmware.wiring.wires.oled096Sda'),
      pinRow('GP21', 'firmware.wiring.functions.oledScl', 'firmware.wiring.wires.oled096Scl'),
      pinRow('GP22', 'firmware.wiring.functions.oledReset', 'firmware.wiring.wires.oledReset'),
      pinRow('3V3 / GND', 'firmware.wiring.functions.oledPower', 'firmware.wiring.wires.oledPower'),
      ...rp2040CommonOutputRows.filter((row) => !row.label.includes('GP20-GP22'))
    ],
    reservedPinKeys: [
      'firmware.wiring.guides.rp2040PicoOled096.reserved.i2c',
      'firmware.wiring.guides.rp2040PicoOled096.reserved.reset'
    ],
    noticeKeys: [
      'firmware.wiring.noticeItems.rp2040Voltage',
      'firmware.wiring.noticeItems.oledI2cAddress',
      'firmware.wiring.noticeItems.sharedGround'
    ]
  },
  'rp2040-pico-oled-091-128x32': {
    titleKey: 'firmware.wiring.guides.rp2040PicoOled091.title',
    summaryKey: 'firmware.wiring.guides.rp2040PicoOled091.summary',
    pinRows: [
      pinRow('GP20', 'firmware.wiring.functions.oledSda', 'firmware.wiring.wires.oled091Sda'),
      pinRow('GP21', 'firmware.wiring.functions.oledScl', 'firmware.wiring.wires.oled091Scl'),
      pinRow('3V3 / GND', 'firmware.wiring.functions.oledPower', 'firmware.wiring.wires.oledPower'),
      ...rp2040Oled091OutputRows
    ],
    reservedPinKeys: ['firmware.wiring.guides.rp2040PicoOled091.reserved.i2c'],
    noticeKeys: [
      'firmware.wiring.noticeItems.rp2040Voltage',
      'firmware.wiring.noticeItems.oledI2cAddress',
      'firmware.wiring.noticeItems.sharedGround'
    ]
  }
};

export function getFirmwareWiringGuide(
  artifact: Pick<FirmwareCatalogArtifact, 'boardId' | 'targetId'> | null
): FirmwareWiringGuide | null {
  if (!artifact) {
    return null;
  }
  if (artifact.targetId && guidesByTargetId[artifact.targetId]) {
    return guidesByTargetId[artifact.targetId];
  }
  if (artifact.boardId === 'rp2040-pico-oled-096') {
    return guidesByTargetId['rp2040-pico-oled-096-128x64'];
  }
  if (artifact.boardId === 'rp2040-pico-oled-091') {
    return guidesByTargetId['rp2040-pico-oled-091-128x32'];
  }
  return guidesByBoardId[artifact.boardId] ?? null;
}

function pinRow(label: string, functionKey: string, wiringKey: string): FirmwareWiringPin {
  return { label, functionKey, wiringKey };
}
