import { describe, expect, test } from 'vitest';
import { getFirmwareDisplayMetadata } from './firmwareDisplayMetadata';

describe('firmwareDisplayMetadata', () => {
  test('groups Pico OLED as RP2040 with extended display capabilities', () => {
    const oled096Metadata = getFirmwareDisplayMetadata('rp2040-pico-oled-096');
    const oled091Metadata = getFirmwareDisplayMetadata('rp2040-pico-oled-091');

    expect(oled096Metadata.family).toBe('rp2040');
    expect(oled096Metadata.capabilityTier).toBe('extended');
    expect(oled096Metadata.capabilityTierDescriptionKey).toBe(
      'firmware.capabilityTiers.oled096.description'
    );
    expect(oled096Metadata.recommended).toBe(false);
    expect(oled091Metadata.family).toBe('rp2040');
    expect(oled091Metadata.capabilityTier).toBe('extended');
    expect(oled091Metadata.capabilityTierDescriptionKey).toBe(
      'firmware.capabilityTiers.oled091.description'
    );
    expect(oled091Metadata.recommended).toBe(false);
  });

  test('groups Wio Terminal as Seeed SAMD with extended capabilities', () => {
    const metadata = getFirmwareDisplayMetadata('seeed-wio-terminal');

    expect(metadata.family).toBe('seeed-samd');
    expect(metadata.capabilityTier).toBe('extended');
    expect(metadata.recommended).toBe(false);
  });
});
