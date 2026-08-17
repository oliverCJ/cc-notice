import { MouseEvent } from 'react';
import { DeviceChannel, openExternalUrl } from '@/api/tauriApi';
import arduinoNanoBoardImage from '@/assets/arduino-nano-board-portrait.svg';
import arduinoUnoBoardImage from '@/assets/arduino-uno-board-portrait.svg';
import { useI18n } from '@/i18n';
import { Rp2040PicoPinoutMap } from './Rp2040PicoPinoutMap';

type BoardPinoutMapProps = {
  boardId?: string | null;
  channel?: DeviceChannel | null;
};

type ArduinoPinoutConfig = {
  titleKey: string;
  boardImage: string;
  pinoutUrl: string;
  datasheetUrl: string;
  variant: 'uno' | 'nano';
  boardClassName: string;
};

const arduinoPinoutConfigs: Record<string, ArduinoPinoutConfig> = {
  'arduino-uno': {
    titleKey: 'hardwareGuides.pinout.arduinoUnoTitle',
    boardImage: arduinoUnoBoardImage,
    pinoutUrl: 'https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf',
    datasheetUrl: 'https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf',
    variant: 'uno',
    boardClassName: 'h-[38rem] w-[27.2rem]'
  },
  'arduino-nano': {
    titleKey: 'hardwareGuides.pinout.arduinoNanoTitle',
    boardImage: arduinoNanoBoardImage,
    pinoutUrl: 'https://docs.arduino.cc/resources/pinouts/A000005-full-pinout.pdf',
    datasheetUrl: 'https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf',
    variant: 'nano',
    boardClassName: 'h-[42rem] w-[17.2rem]'
  }
};

export function BoardPinoutMap({ boardId, channel }: BoardPinoutMapProps) {
  if (isRp2040PicoFamilyBoard(boardId)) {
    return <Rp2040PicoPinoutMap channel={channel} />;
  }

  if (boardId === 'arduino-uno' || boardId === 'arduino-nano') {
    return <ArduinoPinoutMap config={arduinoPinoutConfigs[boardId]} channel={channel} />;
  }

  return null;
}

function isRp2040PicoFamilyBoard(boardId?: string | null) {
  return (
    boardId === 'rp2040-pico' ||
    boardId === 'rp2040-pico-oled-096' ||
    boardId === 'rp2040-pico-oled-091'
  );
}

type ArduinoPinoutMapProps = {
  config: ArduinoPinoutConfig;
  channel?: DeviceChannel | null;
};

function ArduinoPinoutMap({ config, channel }: ArduinoPinoutMapProps) {
  const t = useI18n();
  const title = t(config.titleKey);
  const pins = getArduinoPins(config.variant);
  const highlightedPinId = getArduinoDigitalPinId(config.variant, channel);

  return (
    <section className="md:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={config.pinoutUrl}
            onClick={(event) => handleReferenceClick(event, config.pinoutUrl)}
            rel="noreferrer"
          >
            {t('hardwareGuides.pinout.references.pinout')}
          </a>
          <a
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={config.datasheetUrl}
            onClick={(event) => handleReferenceClick(event, config.datasheetUrl)}
            rel="noreferrer"
          >
            {t('hardwareGuides.pinout.references.datasheet')}
          </a>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="relative mx-auto flex min-h-[45rem] w-full max-w-[46rem] items-center justify-center">
          <div className={`relative ${config.boardClassName}`}>
            <img
              data-testid="arduino-board-image"
              src={config.boardImage}
              alt={t('hardwareGuides.pinout.boardImageAlt', { board: title })}
              className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 select-none object-contain drop-shadow-lg"
              draggable={false}
            />
            {pins.map((pin) => (
              <PinHole key={`hole-${pin.id}`} pin={pin} highlighted={pin.id === highlightedPinId} />
            ))}
            {pins.map((pin) => (
              <PinOverlay key={pin.id} pin={pin} highlighted={pin.id === highlightedPinId} />
            ))}
          </div>
        </div>
      </div>
      <ArduinoPinLegend />
    </section>
  );
}

type ArduinoPin = {
  id: string;
  label: string;
  note?: string;
  category: 'output' | 'pwm' | 'serial' | 'analog' | 'ground' | 'power' | 'system' | 'reference';
  side: 'left' | 'right';
  xPercent: number;
  yPercent: number;
  labelYPercent?: number;
  compactLabel?: boolean;
};

type PinOverlayProps = {
  pin: ArduinoPin;
  highlighted: boolean;
  testIdPrefix?: 'arduino' | 'stm32';
};

function PinOverlay({ pin, highlighted, testIdPrefix = 'arduino' }: PinOverlayProps) {
  const translateClass = pinOverlayTranslateClassNames[pin.side];
  const sizeClass = pin.compactLabel
    ? 'h-[1.12rem] min-w-[4.15rem] gap-1 px-1 py-0.5 text-[0.54rem]'
    : 'min-h-8 min-w-[5.25rem] gap-2 px-2 py-1 text-[0.68rem]';

  return (
    <div
      data-testid={`${testIdPrefix}-pin-${pin.id}`}
      data-highlighted={highlighted ? 'true' : undefined}
      className={`absolute z-10 flex items-center justify-between rounded-md border leading-none shadow-sm ${sizeClass} ${translateClass} ${
        highlighted ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/35' : pinCategoryClassNames[pin.category]
      }`}
      style={{
        left: `${pin.xPercent}%`,
        position: 'absolute',
        top: `${pin.labelYPercent ?? pin.yPercent}%`
      }}
    >
      {pin.side === 'left' ? (
        <>
          <PinText pin={pin} compact={pin.compactLabel} />
          <PinDot />
        </>
      ) : (
        <>
          <PinDot />
          <PinText pin={pin} compact={pin.compactLabel} />
        </>
      )}
    </div>
  );
}

const pinOverlayTranslateClassNames: Record<ArduinoPin['side'], string> = {
  left: '-translate-x-[calc(100%+0.7rem)] -translate-y-1/2',
  right: 'translate-x-[0.7rem] -translate-y-1/2'
};

function PinHole({ pin, highlighted, testIdPrefix = 'arduino' }: PinOverlayProps) {
  return (
    <span
      data-testid={`${testIdPrefix}-pin-hole-${pin.id}`}
      className={`absolute z-[5] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
        highlighted
          ? 'border-primary bg-primary/40 ring-4 ring-primary/25'
          : 'border-white/80 bg-white/20'
      }`}
      style={{
        left: `${pin.xPercent}%`,
        top: `${pin.yPercent}%`
      }}
      aria-hidden="true"
    />
  );
}

function PinText({ pin, compact }: { pin: ArduinoPin; compact?: boolean }) {
  if (compact) {
    return (
      <span className="flex min-w-0 items-baseline gap-0.5 whitespace-nowrap">
        <span className="font-semibold leading-none">{pin.label}</span>
        {pin.note ? <span className="text-[0.46rem] leading-none opacity-80">{pin.note}</span> : null}
      </span>
    );
  }

  return (
    <span className="min-w-0">
      <span className="block whitespace-nowrap font-semibold leading-none">{pin.label}</span>
      {pin.note ? (
        <span className="mt-0.5 block whitespace-nowrap text-[0.5rem] opacity-80">{pin.note}</span>
      ) : null}
    </span>
  );
}

function PinDot() {
  return (
    <span
      className="size-2.5 shrink-0 rounded-full border border-current bg-current/25"
      aria-hidden="true"
    />
  );
}

function ArduinoPinLegend() {
  const t = useI18n();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {arduinoPinLegendItems.map((item) => (
        <span key={item.category} className="inline-flex items-center gap-1.5">
          <span
            className={`size-2.5 rounded-sm border ${pinCategoryClassNames[item.category]}`}
            aria-hidden="true"
          />
          {t(item.labelKey)}
        </span>
      ))}
    </div>
  );
}

function Stm32BluePillPinoutMap({ channel }: { channel?: DeviceChannel | null }) {
  const t = useI18n();
  const highlightedPinId = getStm32PinId(channel);
  const title = t('hardwareGuides.pinout.stm32BluePillTitle');
  const stm32duinoDocsUrl = 'https://github.com/stm32duino/Arduino_Core_STM32/wiki/Getting-Started';
  const datasheetUrl = 'https://www.st.com/resource/en/datasheet/stm32f103c8.pdf';

  return (
    <section className="md:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={stm32duinoDocsUrl}
            onClick={(event) => handleReferenceClick(event, stm32duinoDocsUrl)}
            rel="noreferrer"
          >
            {t('hardwareGuides.pinout.references.stm32duinoDocs')}
          </a>
          <a
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href={datasheetUrl}
            onClick={(event) => handleReferenceClick(event, datasheetUrl)}
            rel="noreferrer"
          >
            {t('hardwareGuides.pinout.references.chipDatasheet')}
          </a>
        </div>
      </div>
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="relative mx-auto flex min-h-[34rem] w-full max-w-[36rem] items-center justify-center">
          <div className="relative h-[31rem] w-[20rem]">
            <div className="absolute left-1/2 top-1/2 h-[28rem] w-[9rem] -translate-x-1/2 -translate-y-1/2 rounded-md border border-cyan-950 bg-cyan-800 shadow-lg">
              <div className="absolute left-1/2 top-3 h-10 w-14 -translate-x-1/2 rounded-sm border border-slate-300 bg-slate-100" />
              <div className="absolute left-1/2 top-16 h-20 w-20 -translate-x-1/2 rounded-sm border border-slate-950 bg-slate-800" />
              <div className="absolute bottom-12 left-1/2 h-8 w-16 -translate-x-1/2 rounded-sm border border-amber-500 bg-amber-200" />
              <div className="absolute bottom-4 left-1/2 h-5 w-20 -translate-x-1/2 rounded-sm border border-cyan-950 bg-cyan-950/50" />
            </div>
            {stm32BluePillPins.map((pin) => (
              <PinHole
                key={`stm32-hole-${pin.id}`}
                pin={pin}
                highlighted={pin.id === highlightedPinId}
                testIdPrefix="stm32"
              />
            ))}
            {stm32BluePillPins.map((pin) => (
              <PinOverlay
                key={`stm32-${pin.id}`}
                pin={pin}
                highlighted={pin.id === highlightedPinId}
                testIdPrefix="stm32"
              />
            ))}
          </div>
        </div>
      </div>
      <ArduinoPinLegend />
    </section>
  );
}

function getStm32PinId(channel?: DeviceChannel | null): string | null {
  const fromChannelId = channel?.id.match(/^pin\.([a-z]+\d+)$/)?.[1] ?? null;
  if (fromChannelId && stm32BluePillPins.some((pin) => pin.id === fromChannelId)) {
    return fromChannelId;
  }
  return null;
}

const pinCategoryClassNames: Record<ArduinoPin['category'], string> = {
  output: 'border-lime-500 bg-lime-50 text-lime-950',
  pwm: 'border-sky-500 bg-sky-50 text-sky-950',
  serial: 'border-amber-500 bg-amber-50 text-amber-950',
  analog: 'border-emerald-500 bg-emerald-50 text-emerald-950',
  ground: 'border-zinc-400 bg-zinc-100 text-zinc-900',
  power: 'border-rose-400 bg-rose-50 text-rose-950',
  system: 'border-pink-400 bg-pink-50 text-pink-950',
  reference: 'border-zinc-400 bg-zinc-100 text-zinc-900'
};

const arduinoPinLegendItems: Array<{
  category: ArduinoPin['category'];
  labelKey: string;
}> = [
  { category: 'output', labelKey: 'hardwareGuides.pinout.legend.gpio' },
  { category: 'pwm', labelKey: 'hardwareGuides.pinout.legend.pwm' },
  { category: 'serial', labelKey: 'hardwareGuides.pinout.legend.serial' },
  { category: 'analog', labelKey: 'hardwareGuides.pinout.legend.analog' },
  { category: 'ground', labelKey: 'hardwareGuides.pinout.legend.ground' },
  { category: 'power', labelKey: 'hardwareGuides.pinout.legend.power' },
  { category: 'system', labelKey: 'hardwareGuides.pinout.legend.system' },
  { category: 'reference', labelKey: 'hardwareGuides.pinout.legend.reference' }
];

const arduinoBoardDimensions = {
  uno: { width: 194, height: 138.3 },
  nano: { width: 167, height: 68 }
};

const nanoHeaderXCenters = [
  14.164,
  23.806,
  33.448,
  43.09,
  52.732,
  62.374,
  72.016,
  81.658,
  91.3,
  100.942,
  110.584,
  120.226,
  129.868,
  139.51,
  149.152
];

const nanoHeaderCenters = {
  top: nanoHeaderXCenters.map((x) => [x, 5.019] as const),
  topReversed: [...nanoHeaderXCenters].reverse().map((x) => [x, 5.019] as const),
  bottom: nanoHeaderXCenters.map((x) => [x, 62.663] as const)
};

const unoPins: ArduinoPin[] = [
  ...positionPins(
    [
      analogPin(5),
      analogPin(4),
      analogPin(3),
      analogPin(2),
      analogPin(1),
      analogPin(0),
      powerPin('vin', 'VIN'),
      groundPin('gnd-left-1'),
      groundPin('gnd-left-2'),
      powerPin('5v', '5V'),
      powerPin('3v3', '3V3'),
      systemPin('rst', 'RST'),
      systemPin('ioref', 'IOREF')
    ],
    'left',
    arduinoBoardDimensions.uno,
    [
      [13.1, 6.6],
      [19.7, 6.6],
      [26.3, 6.6],
      [32.9, 6.6],
      [39.5, 6.6],
      [46.1, 6.6],
      [59.3, 6.6],
      [65.9, 6.6],
      [72.5, 6.6],
      [79.1, 6.6],
      [85.7, 6.6],
      [92.3, 6.6],
      [98.9, 6.6]
    ],
    { compactLabel: true }
  ),
  ...positionPins(
    [
      serialPin(0, 'RX'),
      serialPin(1, 'TX'),
      outputPin(2),
      pwmPin(3),
      outputPin(4),
      pwmPin(5),
      pwmPin(6),
      outputPin(7),
      outputPin(8),
      pwmPin(9),
      pwmPin(10),
      referencePin(11, 'SPI'),
      referencePin(12, 'SPI'),
      referencePin(13, 'LED'),
      groundPin('gnd-digital'),
      systemPin('aref', 'AREF'),
      systemPin('sda', 'SDA'),
      systemPin('scl', 'SCL')
    ],
    'right',
    arduinoBoardDimensions.uno,
    [
      [13.1, 131.7],
      [19.7, 131.7],
      [26.3, 131.7],
      [32.9, 131.7],
      [39.5, 131.7],
      [46.1, 131.7],
      [52.7, 131.7],
      [59.3, 131.7],
      [69.9, 131.7],
      [76.5, 131.7],
      [83.1, 131.7],
      [89.7, 131.7],
      [96.3, 131.7],
      [102.9, 131.7],
      [109.5, 131.7],
      [116.1, 131.7],
      [122.7, 131.7],
      [129.3, 131.7]
    ],
    { compactLabel: true }
  )
];

const nanoPins: ArduinoPin[] = [
  ...positionPins(
    [
      serialPin(1, 'TX'),
      serialPin(0, 'RX'),
      systemPin('rst', 'RST'),
      groundPin('gnd'),
      outputPin(2),
      pwmPin(3),
      outputPin(4),
      pwmPin(5),
      pwmPin(6),
      outputPin(7),
      outputPin(8),
      pwmPin(9),
      pwmPin(10),
      referencePin(11, 'SPI'),
      referencePin(12, 'SPI')
    ],
    'right',
    arduinoBoardDimensions.nano,
    nanoHeaderCenters.bottom
  ),
  ...positionPins(
    [
      referencePin(13, 'LED'),
      powerPin('3v3', '3V3'),
      systemPin('aref', 'AREF'),
      analogPin(0),
      analogPin(1),
      analogPin(2),
      analogPin(3),
      analogPin(4),
      analogPin(5),
      analogPin(6),
      analogPin(7),
      powerPin('5v', '5V'),
      systemPin('rst-2', 'RST'),
      groundPin('gnd-2'),
      powerPin('vin', 'VIN')
    ],
    'left',
    arduinoBoardDimensions.nano,
    nanoHeaderCenters.topReversed
  )
];

const stm32BluePillPins: ArduinoPin[] = [
  ...positionPins(
    [
      pwmPinById('pa0', 'PA0'),
      pwmPinById('pa1', 'PA1'),
      pwmPinById('pa2', 'PA2', 'USART2 TX'),
      pwmPinById('pa3', 'PA3', 'USART2 RX'),
      outputPinById('pa4', 'PA4', 'SPI1 NSS'),
      outputPinById('pa5', 'PA5', 'SPI1 SCK'),
      pwmPinById('pa6', 'PA6', 'SPI1 MISO'),
      pwmPinById('pa7', 'PA7', 'SPI1 MOSI')
    ],
    'left',
    { width: 100, height: 100 },
    [
      [12, 27],
      [22, 27],
      [32, 27],
      [42, 27],
      [52, 27],
      [62, 27],
      [72, 27],
      [82, 27]
    ],
    { compactLabel: true }
  ),
  ...positionPins(
    [
      pwmPinById('pb0', 'PB0'),
      pwmPinById('pb1', 'PB1'),
      outputPinById('pb10', 'PB10', 'I2C2 SCL'),
      outputPinById('pb11', 'PB11', 'I2C2 SDA'),
      systemPin('pa13', 'PA13', 'SWDIO'),
      systemPin('pa14', 'PA14', 'SWCLK'),
      powerPin('3v3', '3V3'),
      groundPin('gnd')
    ],
    'right',
    { width: 100, height: 100 },
    [
      [12, 73],
      [22, 73],
      [32, 73],
      [42, 73],
      [58, 73],
      [68, 73],
      [78, 73],
      [88, 73]
    ],
    { compactLabel: true }
  )
];

function getArduinoPins(variant: ArduinoPinoutConfig['variant']): ArduinoPin[] {
  return variant === 'uno' ? unoPins : nanoPins;
}

function getArduinoDigitalPinId(
  variant: ArduinoPinoutConfig['variant'],
  channel?: DeviceChannel | null
): string | null {
  const pin = channel?.digitalOutput?.pin ?? channel?.pwmOutput?.pin ?? null;
  if (pin === null) {
    return null;
  }
  const id = `d${pin}`;
  return getArduinoPins(variant).some((item) => item.id === id) ? id : null;
}

function positionPins(
  pins: Array<Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'>>,
  side: ArduinoPin['side'],
  dimensions: { width: number; height: number },
  centers: ReadonlyArray<readonly [number, number]>,
  options: { compactLabel?: boolean; labelStart?: number; labelEnd?: number } = {}
): ArduinoPin[] {
  const labelStep =
    options.labelStart === undefined || options.labelEnd === undefined || pins.length === 1
      ? null
      : (options.labelEnd - options.labelStart) / (pins.length - 1);

  return pins.map((pin, index) => {
    const [x, y] = centers[index];
    return {
      ...pin,
      side,
      xPercent: Number(((y / dimensions.height) * 100).toFixed(3)),
      yPercent: Number(((1 - x / dimensions.width) * 100).toFixed(3)),
      labelYPercent:
        labelStep === null || options.labelStart === undefined
          ? undefined
          : Number((options.labelStart + index * labelStep).toFixed(3)),
      compactLabel: options.compactLabel
    };
  });
}

function outputPin(pin: number): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id: `d${pin}`, label: `D${pin}`, category: 'output' };
}

function pwmPin(pin: number): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id: `d${pin}`, label: `D${pin}`, note: 'PWM', category: 'pwm' };
}

function outputPinById(id: string, label: string, note?: string): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id, label, note, category: 'output' };
}

function pwmPinById(id: string, label: string, note = 'PWM'): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id, label, note, category: 'pwm' };
}

function serialPin(pin: number, note: string): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id: `d${pin}`, label: `D${pin}`, note, category: 'serial' };
}

function referencePin(pin: number, note: string): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id: `d${pin}`, label: `D${pin}`, note, category: 'reference' };
}

function analogPin(pin: number): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id: `a${pin}`, label: `A${pin}`, category: 'analog' };
}

function powerPin(id: string, label: string): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id, label, category: 'power' };
}

function groundPin(id: string): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id, label: 'GND', category: 'ground' };
}

function systemPin(id: string, label: string, note?: string): Omit<ArduinoPin, 'side' | 'xPercent' | 'yPercent'> {
  return { id, label, note, category: 'system' };
}

function handleReferenceClick(event: MouseEvent<HTMLAnchorElement>, url: string) {
  event.preventDefault();
  void openExternalUrl(url).catch((error) => {
    console.warn('failed to open external reference url', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}
