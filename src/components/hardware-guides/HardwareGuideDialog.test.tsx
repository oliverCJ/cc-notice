import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { DeviceChannel } from '@/api/tauriApi';
import { getHardwareGuide } from '@/domain/hardwareGuides';
import { I18nProvider } from '@/i18n';
import { HardwareGuideDialog } from './HardwareGuideDialog';

describe('HardwareGuideDialog', () => {
  test('keeps the RP2040 Pico pinout guide for Pico devices', () => {
    renderDialog('rp2040-pico', {
      id: 'pin.gp2',
      label: 'GP2',
      kind: 'digital-output',
      physicalPin: 4,
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

    expect(screen.getByAltText('RP2040 Pico 引脚图')).toBeInTheDocument();
    expect(screen.getByText('GPIO 输出逻辑电平：3.3V。')).toBeInTheDocument();
  });

  test('keeps the RP2040 Pico pinout guide for Pico OLED variants', () => {
    renderDialog('rp2040-pico-oled-091', {
      id: 'pin.gp2',
      label: 'GP2',
      kind: 'digital-output',
      physicalPin: 4,
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

    expect(screen.getByAltText('RP2040 Pico 引脚图')).toBeInTheDocument();
    expect(screen.getByTestId('rp2040-pico-physical-pin-4')).toHaveAttribute(
      'data-highlighted',
      'true'
    );
  });

  test('renders the Arduino Uno pinout and tiny-avr notes for Uno devices', () => {
    renderDialog('arduino-uno', createArduinoChannel('pin.d3', 'D3', 3));

    expect(screen.getByAltText('Arduino Uno 引脚图 板卡主体图')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '官方引脚图' })).toHaveAttribute(
      'href',
      'https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf'
    );
    expect(screen.getByRole('link', { name: '数据手册' })).toHaveAttribute(
      'href',
      'https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf'
    );
    expect(screen.queryByText('官方真实引脚图参考')).not.toBeInTheDocument();
    expect(screen.queryByAltText('RP2040 Pico 引脚图')).not.toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-d3')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('arduino-board-image')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-board-image')).not.toHaveClass('rotate-90');
    expect(screen.getByTestId('arduino-board-image')).not.toHaveClass('-rotate-90');
    expect(screen.getByTestId('arduino-pin-hole-d3')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-d3')).toHaveStyle({ position: 'absolute' });
    expect(screen.getByTestId('arduino-pin-d0')).toHaveTextContent('RX');
    expect(screen.getByTestId('arduino-pin-d13')).toHaveTextContent('LED');
    expect(screen.getByTestId('arduino-pin-a5')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-sda')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-scl')).toBeInTheDocument();
    expect(screen.queryByTestId('arduino-pin-a7')).not.toBeInTheDocument();
    expect(pinTopPercent('d7') - pinTopPercent('d8')).toBeGreaterThan(
      pinTopPercent('d6') - pinTopPercent('d7')
    );
    expect(pinTopPercent('a0') - pinTopPercent('vin')).toBeGreaterThan(
      pinTopPercent('a1') - pinTopPercent('a0')
    );
    expect(screen.getByText('GPIO 输出逻辑电平：5V。')).toBeInTheDocument();
    expect(screen.getByText('当前输出通道支持 D2-D10，D0/D1 为串口 RX/TX，不作为输出使用。')).toBeInTheDocument();
    expect(screen.getByText('D3/D5/D6/D9/D10 支持呼吸和 PWM 类动作，其他数字输出脚只支持普通开关、闪烁或脉冲动作。')).toBeInTheDocument();
  });

  test('renders the Arduino Nano pinout and tiny-avr notes for Nano devices', () => {
    renderDialog('arduino-nano', createArduinoChannel('pin.d5', 'D5', 5));

    expect(screen.getByAltText('Arduino Nano 引脚图 板卡主体图')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '官方引脚图' })).toHaveAttribute(
      'href',
      'https://docs.arduino.cc/resources/pinouts/A000005-full-pinout.pdf'
    );
    expect(screen.getByRole('link', { name: '数据手册' })).toHaveAttribute(
      'href',
      'https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf'
    );
    expect(screen.queryByText('官方真实引脚图参考')).not.toBeInTheDocument();
    expect(screen.queryByAltText('RP2040 Pico 引脚图')).not.toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-d5')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('arduino-board-image')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-board-image')).not.toHaveClass('rotate-90');
    expect(screen.getByTestId('arduino-board-image')).not.toHaveClass('-rotate-90');
    expect(screen.getByTestId('arduino-pin-hole-d5')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-d5')).toHaveStyle({ position: 'absolute' });
    expect(screen.getByTestId('arduino-pin-a6')).toBeInTheDocument();
    expect(screen.getByTestId('arduino-pin-a7')).toBeInTheDocument();
    expect(pinTopPercent('d13')).toBeLessThan(pinTopPercent('a0'));
    expect(pinTopPercent('a0')).toBeLessThan(pinTopPercent('vin'));
    expect(screen.getByTestId('arduino-pin-5v')).toBeInTheDocument();
    expect(screen.getAllByText('GND').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('GPIO 输出逻辑电平：5V。')).toBeInTheDocument();
    expect(screen.getByText('D11-D13、A0-A5 以及 Nano 的 A6/A7 当前只作为板卡引脚信息展示，不生成输出通道。')).toBeInTheDocument();
  });

  test('uses generic guide content without pinout for boards without dedicated guide copy', () => {
    renderDialog('stm32f103cx-blue-pill', createArduinoChannel('pin.pa0', 'PA0', 0));

    expect(screen.queryByAltText('RP2040 Pico 引脚图')).not.toBeInTheDocument();
    expect(screen.queryByText('STM32F103C8T6/C6T6 Blue Pill 引脚图')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '官方引脚图' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'STM32duino 文档' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('stm32-pin-pa0')).not.toBeInTheDocument();
    expect(screen.getByText('GPIO 输出逻辑电平：3.3V。')).toBeInTheDocument();
    expect(screen.queryByText('按 STM32F103C6T6 最小资源约束，只开放稳妥数字输出和少量 PWM 引脚。')).not.toBeInTheDocument();
    expect(screen.queryByText('PA13/PA14 为 SWD 调试和烧录引脚，不作为输出通道使用。')).not.toBeInTheDocument();
  });
});

function renderDialog(boardId: string, channel: DeviceChannel) {
  return render(
    <I18nProvider language="zh-CN">
      <HardwareGuideDialog
        guide={getHardwareGuide('digital-output')}
        boardId={boardId}
        channel={channel}
        open
        onOpenChange={() => undefined}
      />
    </I18nProvider>
  );
}

function pinTopPercent(pinId: string): number {
  const top = screen.getByTestId(`arduino-pin-hole-${pinId}`).style.top;
  return Number(top.replace('%', ''));
}

function createArduinoChannel(id: string, label: string, pin: number): DeviceChannel {
  return {
    id,
    label,
    kind: 'digital-output',
    physicalPin: null,
    digitalOutput: {
      pin,
      activeLevel: 'high',
      defaultLevel: 'low',
      allowBlink: true
    },
    pwmOutput: null,
    buzzer: null,
    addressableLed: null,
    supportedActions: ['activate', 'deactivate', 'blink', 'pulse', 'breathe']
  };
}
