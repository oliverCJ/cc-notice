import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { describe, expect, test, vi } from 'vitest';
import { DeviceChannel } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { Rp2040PicoPinoutMap } from './Rp2040PicoPinoutMap';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('Rp2040PicoPinoutMap', () => {
  test('renders the downloaded Pico board image as the pinout base', () => {
    renderPinoutMap();

    expect(screen.getByAltText('RP2040 Pico 引脚图')).toBeInTheDocument();
  });

  test('renders current reference links for pinout and datasheets', () => {
    renderPinoutMap();

    expect(screen.getByRole('link', { name: '官方引脚图' })).toHaveAttribute(
      'href',
      'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#non-wireless-board-layout'
    );
    expect(screen.getByRole('link', { name: 'Pico 数据手册' })).toHaveAttribute(
      'href',
      'https://pip-assets.raspberrypi.com/categories/610-raspberry-pi-pico/documents/RP-008307-DS-1-pico-datasheet.pdf'
    );
    expect(screen.getByRole('link', { name: 'RP2040 数据手册' })).toHaveAttribute(
      'href',
      'https://pip-assets.raspberrypi.com/categories/814-rp2040/documents/RP-008371-DS-1-rp2040-datasheet.pdf'
    );
  });

  test('opens reference links through the Tauri external URL command', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    renderPinoutMap();

    fireEvent.click(screen.getByRole('link', { name: '官方引脚图' }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('open_external_url', {
        url: 'https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html#non-wireless-board-layout'
      });
    });
  });

  test('renders every physical pin overlay to keep positions aligned with the Pico board', () => {
    renderPinoutMap();

    expect(screen.getAllByTestId(/^rp2040-pico-physical-pin-/)).toHaveLength(40);
    expect(screen.getByTestId('rp2040-pico-physical-pin-3')).toHaveTextContent('GND');
    expect(screen.getByTestId('rp2040-pico-physical-pin-36')).toHaveTextContent('3V3');
  });

  test('keeps overlay coordinates in the official Pico pin order', () => {
    renderPinoutMap();

    const pin1 = screen.getByTestId('rp2040-pico-physical-pin-1');
    const pin20 = screen.getByTestId('rp2040-pico-physical-pin-20');
    const pin21 = screen.getByTestId('rp2040-pico-physical-pin-21');
    const pin40 = screen.getByTestId('rp2040-pico-physical-pin-40');

    expect(Number(pin1.style.top.replace('%', ''))).toBeLessThan(Number(pin20.style.top.replace('%', '')));
    expect(Number(pin40.style.top.replace('%', ''))).toBeLessThan(Number(pin21.style.top.replace('%', '')));
  });

  test('keeps physical pin labels next to the board on both sides', () => {
    renderPinoutMap();

    expect(screen.getByTestId('rp2040-pico-physical-pin-4').textContent?.replace(/\s/g, '')).toBe(
      'GP2Pin4'
    );
    expect(screen.getByTestId('rp2040-pico-physical-pin-21').textContent?.replace(/\s/g, '')).toBe(
      'Pin21GP16'
    );
  });

  test('keeps physical pin numbers on one line for both sides', () => {
    renderPinoutMap();

    expect(screen.getByText('Pin 4')).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('Pin 21')).toHaveClass('whitespace-nowrap');
  });

  test('highlights the selected channel pin on the image overlay', () => {
    renderPinoutMap({
      id: 'pin.gp2',
      label: 'GP2',
      kind: 'digital-output',
      digitalOutput: {
        pin: 2,
        activeLevel: 'high',
        defaultLevel: 'low',
        allowBlink: true
      },
      pwmOutput: null,
      buzzer: null,
      addressableLed: null,
      supportedActions: ['activate', 'deactivate', 'blink', 'pulse']
    });

    expect(screen.getByTestId('rp2040-pico-physical-pin-4')).toHaveAttribute('data-highlighted', 'true');
  });

  test('uses semantic colors for non-GPIO physical pins and shows a legend', () => {
    renderPinoutMap();

    expect(screen.getByTestId('rp2040-pico-physical-pin-3')).toHaveClass('border-zinc-400');
    expect(screen.getByTestId('rp2040-pico-physical-pin-40')).toHaveClass('border-rose-400');
    expect(screen.getByTestId('rp2040-pico-physical-pin-30')).toHaveClass('border-pink-400');
    expect(screen.getByTestId('rp2040-pico-physical-pin-35')).toHaveClass('border-emerald-500');

    expect(screen.getByText('GPIO')).toBeInTheDocument();
    expect(screen.getByText('接地')).toBeInTheDocument();
    expect(screen.getByText('电源')).toBeInTheDocument();
    expect(screen.getByText('系统控制')).toBeInTheDocument();
    expect(screen.getByText('模拟参考')).toBeInTheDocument();
  });
});

function renderPinoutMap(channel: DeviceChannel | null = null) {
  return render(
    <I18nProvider language="zh-CN">
      <Rp2040PicoPinoutMap channel={channel} />
    </I18nProvider>
  );
}
