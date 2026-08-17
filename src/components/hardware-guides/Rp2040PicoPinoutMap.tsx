import { MouseEvent } from 'react';
import { DeviceChannel, openExternalUrl } from '@/api/tauriApi';
import picoBoardImage from '@/assets/raspberry-pi-pico.svg';
import {
  Rp2040PicoPhysicalPin,
  Rp2040PicoPhysicalPinCategory,
  rp2040PicoPhysicalPins,
  rp2040PicoReferenceDocuments
} from '@/domain/boards/rp2040PicoPinCatalog';
import { getRp2040PicoPinoutOverlayPosition } from '@/domain/boards/rp2040PicoPinoutOverlay';
import { useI18n } from '@/i18n';

type Rp2040PicoPinoutMapProps = {
  channel?: DeviceChannel | null;
};

const pinCategoryStyles: Record<Rp2040PicoPhysicalPinCategory, string> = {
  gpio: 'border-lime-500 bg-lime-50 text-lime-950',
  ground: 'border-zinc-400 bg-zinc-100 text-zinc-900',
  power: 'border-rose-400 bg-rose-50 text-rose-950',
  system: 'border-pink-400 bg-pink-50 text-pink-950',
  analog: 'border-emerald-500 bg-emerald-50 text-emerald-950'
};

const pinLegendItems: Array<{
  category: Rp2040PicoPhysicalPinCategory;
  labelKey: string;
}> = [
  { category: 'gpio', labelKey: 'hardwareGuides.pinout.legend.gpio' },
  { category: 'ground', labelKey: 'hardwareGuides.pinout.legend.ground' },
  { category: 'power', labelKey: 'hardwareGuides.pinout.legend.power' },
  { category: 'system', labelKey: 'hardwareGuides.pinout.legend.system' },
  { category: 'analog', labelKey: 'hardwareGuides.pinout.legend.analog' }
];

export function Rp2040PicoPinoutMap({ channel }: Rp2040PicoPinoutMapProps) {
  const t = useI18n();
  const gpio = getChannelGpio(channel);

  return (
    <section className="md:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t('hardwareGuides.pinout.title')}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {rp2040PicoReferenceDocuments.map((document) => (
            <a
              key={document.id}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              href={document.url}
              onClick={(event) => handleReferenceClick(event, document.url)}
              rel="noreferrer"
            >
              {t(document.labelKey)}
            </a>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mx-auto flex max-w-[22rem] justify-center px-12 sm:px-16">
          <div className="relative w-full">
            <img
              src={picoBoardImage}
              alt={t('hardwareGuides.pinout.title')}
              className="block h-auto w-full select-none"
              draggable={false}
            />
            {rp2040PicoPhysicalPins.map((pin) => (
              <PinOverlay key={pin.physicalPin} pin={pin} highlightedGpio={gpio} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {pinLegendItems.map((item) => (
          <span key={item.category} className="inline-flex items-center gap-1.5">
            <span
              className={`size-2.5 rounded-sm border ${pinCategoryStyles[item.category]}`}
              aria-hidden="true"
            />
            {t(item.labelKey)}
          </span>
        ))}
      </div>
    </section>
  );
}

type PinOverlayProps = {
  pin: Rp2040PicoPhysicalPin;
  highlightedGpio?: number | null;
};

function PinOverlay({ pin, highlightedGpio }: PinOverlayProps) {
  const position = getRp2040PicoPinoutOverlayPosition(pin.physicalPin);
  const highlighted = pin.gpio !== undefined && pin.gpio === highlightedGpio;
  const translateClass =
    position.side === 'left'
      ? '-translate-x-[calc(100%+0.45rem)] -translate-y-1/2'
      : 'translate-x-[0.45rem] -translate-y-1/2';

  return (
    <div
      data-testid={`rp2040-pico-physical-pin-${pin.physicalPin}`}
      data-highlighted={highlighted ? 'true' : undefined}
      className={`absolute z-10 flex min-h-6 min-w-[4.75rem] items-center justify-between gap-2 rounded-md border px-2 py-0.5 text-[0.65rem] leading-none shadow-sm ${translateClass} ${
        highlighted
          ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/35'
          : pinCategoryStyles[pin.category]
      }`}
      style={{ left: `${position.xPercent}%`, top: `${position.yPercent}%` }}
    >
      {position.side === 'left' ? (
        <>
          <span className="whitespace-nowrap">{pin.label}</span>
          <span className="whitespace-nowrap text-[0.58rem] opacity-80">Pin {pin.physicalPin}</span>
        </>
      ) : (
        <>
          <span className="whitespace-nowrap text-[0.58rem] opacity-80">Pin {pin.physicalPin}</span>
          <span className="whitespace-nowrap">{pin.label}</span>
        </>
      )}
    </div>
  );
}

function handleReferenceClick(event: MouseEvent<HTMLAnchorElement>, url: string) {
  event.preventDefault();
  void openExternalUrl(url).catch((error) => {
    console.warn('failed to open external reference url', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

function getChannelGpio(channel?: DeviceChannel | null): number | null {
  return (
    channel?.digitalOutput?.pin ??
    channel?.pwmOutput?.pin ??
    channel?.buzzer?.pin ??
    channel?.addressableLed?.pin ??
    null
  );
}
