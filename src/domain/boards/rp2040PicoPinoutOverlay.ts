export type Rp2040PicoPinoutOverlaySide = 'left' | 'right';

export type Rp2040PicoPinoutOverlayPosition = {
  physicalPin: number;
  side: Rp2040PicoPinoutOverlaySide;
  xPercent: number;
  yPercent: number;
};

const SVG_WIDTH = 59.529;
const SVG_HEIGHT = 150.239;
const LEFT_PIN_CENTER_X = 4.565;
const RIGHT_PIN_CENTER_X = 54.965;
const FIRST_PIN_CENTER_Y = 9.544;
const PIN_STEP_Y = 7.2;

export const rp2040PicoPinoutOverlayPositions: Rp2040PicoPinoutOverlayPosition[] = [
  ...Array.from({ length: 20 }, (_, index) =>
    createPosition(index + 1, 'left', LEFT_PIN_CENTER_X, FIRST_PIN_CENTER_Y + index * PIN_STEP_Y)
  ),
  ...Array.from({ length: 20 }, (_, index) => {
    const physicalPin = 40 - index;
    return createPosition(
      physicalPin,
      'right',
      RIGHT_PIN_CENTER_X,
      FIRST_PIN_CENTER_Y + index * PIN_STEP_Y
    );
  })
].sort((left, right) => left.physicalPin - right.physicalPin);

const overlayPositionsByPhysicalPin = new Map(
  rp2040PicoPinoutOverlayPositions.map((position) => [position.physicalPin, position])
);

export function getRp2040PicoPinoutOverlayPosition(
  physicalPin: number
): Rp2040PicoPinoutOverlayPosition {
  const position = overlayPositionsByPhysicalPin.get(physicalPin);
  if (!position) {
    throw new Error(`Unsupported RP2040 Pico physical pin: ${physicalPin}`);
  }
  return position;
}

function createPosition(
  physicalPin: number,
  side: Rp2040PicoPinoutOverlaySide,
  x: number,
  y: number
): Rp2040PicoPinoutOverlayPosition {
  return {
    physicalPin,
    side,
    xPercent: toPercent(x, SVG_WIDTH),
    yPercent: toPercent(y, SVG_HEIGHT)
  };
}

function toPercent(value: number, total: number): number {
  return Number(((value / total) * 100).toFixed(3));
}
