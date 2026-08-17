import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { FirmwarePage } from './FirmwarePage';
import * as tauriApi from '@/api/tauriApi';

vi.mock('@/api/tauriApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/tauriApi')>();
  return {
    ...actual,
    getFirmwareCatalog: vi.fn(),
    getFirmwareFlashStatus: vi.fn(),
    getFirmwareFlashTargets: vi.fn(),
    flashFirmware: vi.fn()
  };
});

const defaultArtifactId = 'local-bundled:rp2040-pico:0.2.2:cc-notice-rp2040-pico.uf2';

describe('FirmwarePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: defaultArtifactId,
          boardId: 'rp2040-pico',
          boardName: 'Raspberry Pi Pico',
          firmwareVersion: '0.2.2',
          protocolVersion: 2,
          artifactName: 'cc-notice-rp2040-pico.uf2',
          artifactType: 'uf2',
          flashStrategy: 'uf2_mount_copy',
          flashVolumeName: 'RPI-RP2',
          relativePath: 'rp2040-pico/cc-notice-rp2040-pico.uf2',
          source: 'local-bundled'
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashTargets).mockResolvedValue([]);
  });

  test('renders bundled firmware catalog with firmware version', async () => {
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: defaultArtifactId,
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findAllByText('Raspberry Pi Pico')).not.toHaveLength(0);
    expect(screen.getAllByText('0.2.2')).not.toHaveLength(0);
    expect(screen.getAllByText('cc-notice-rp2040-pico.uf2')).not.toHaveLength(0);
    expect(screen.getByText('Raspberry Pi Pico 接线说明')).toBeInTheDocument();
  });

  test('hides Arduino PWM wiring rows from firmware wiring guide', async () => {
    const unoArtifactId = 'local-bundled:arduino-uno:0.2.2:cc-notice-arduino-uno.hex';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: unoArtifactId,
          boardId: 'arduino-uno',
          boardName: 'Arduino Uno',
          firmwareVersion: '0.2.2',
          protocolVersion: 2,
          artifactName: 'cc-notice-arduino-uno.hex',
          artifactType: 'hex',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'arduino-uno/cc-notice-arduino-uno.hex',
          source: 'local-bundled'
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: unoArtifactId,
      boardId: 'arduino-uno',
      artifactName: 'cc-notice-arduino-uno.hex',
      artifactType: 'hex',
      flashStrategy: 'arduino_cli_upload',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findByText('Arduino Uno 接线说明')).toBeInTheDocument();
    expect(screen.getByText('输出脚连接 LED、继电器模块或驱动模块输入端，外设 GND 与板卡 GND 共地。')).toBeInTheDocument();
    expect(screen.queryByText('PWM / 呼吸输出')).not.toBeInTheDocument();
    expect(screen.queryByText('连接支持 PWM 的 LED 或驱动模块输入端，用于亮度、呼吸或脉冲效果。')).not.toBeInTheDocument();
  });

  test('shows Pro Micro wiring guide with PWM breathe and D9 buzzer rows', async () => {
    const proMicroArtifactId = 'local-bundled:sparkfun-pro-micro-32u4:0.2.0:cc-notice-sparkfun-pro-micro-32u4.hex';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: proMicroArtifactId,
          boardId: 'sparkfun-pro-micro-32u4',
          boardName: 'SparkFun Pro Micro 32U4',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          artifactName: 'cc-notice-sparkfun-pro-micro-32u4.hex',
          artifactType: 'hex',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'sparkfun-pro-micro-32u4/cc-notice-sparkfun-pro-micro-32u4.hex',
          source: 'local-bundled',
          targetId: 'sparkfun-pro-micro-32u4-default',
          upload: {
            fqbn: 'SparkFun:avr:promicro',
            protocol: 'avr109',
            speed: 57600,
            requires1200bpsReset: true,
            bootloaderWaitMs: 8000,
            boardOptions: {
              cpu: '16MHzatmega32U4'
            }
          }
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: proMicroArtifactId,
      boardId: 'sparkfun-pro-micro-32u4',
      artifactName: 'cc-notice-sparkfun-pro-micro-32u4.hex',
      artifactType: 'hex',
      flashStrategy: 'arduino_cli_upload',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findByText('SparkFun Pro Micro 32U4 接线说明')).toBeInTheDocument();
    expect(screen.getByText('D3 / D5 / D6 / D9 / D10')).toBeInTheDocument();
    expect(screen.getByText('PWM / 呼吸输出')).toBeInTheDocument();
    expect(screen.getByText('D9 同时可作为数字输出/PWM 呼吸和蜂鸣器通道，接线时同一时间只接一种外设。')).toBeInTheDocument();
  });

  test('hides invisible firmware artifacts from the catalog', async () => {
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: defaultArtifactId,
          boardId: 'rp2040-pico',
          boardName: 'Raspberry Pi Pico',
          firmwareVersion: '0.2.2',
          protocolVersion: 2,
          visible: true,
          artifactName: 'cc-notice-rp2040-pico.uf2',
          artifactType: 'uf2',
          flashStrategy: 'uf2_mount_copy',
          flashVolumeName: 'RPI-RP2',
          relativePath: 'rp2040-pico/cc-notice-rp2040-pico.uf2',
          source: 'local-bundled'
        },
        {
          artifactId: 'local-bundled:stm32f103cx-blue-pill:0.2.0:cc-notice-stm32f103cx-blue-pill.bin',
          boardId: 'stm32f103cx-blue-pill',
          boardName: 'STM32F103C8T6/C6T6 Blue Pill',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          visible: false,
          artifactName: 'cc-notice-stm32f103cx-blue-pill.bin',
          artifactType: 'bin',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'stm32f103cx-blue-pill/cc-notice-stm32f103cx-blue-pill.bin',
          source: 'local-bundled'
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: defaultArtifactId,
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findAllByText('Raspberry Pi Pico')).not.toHaveLength(0);
    expect(screen.queryByText('STM32F103C8T6/C6T6 Blue Pill')).not.toBeInTheDocument();
  });

  test('shows target-specific wiring guide for Pico OLED 0.91 firmware', async () => {
    const oledArtifactId =
      'local-bundled:rp2040-pico-oled-091:0.1.1:cc-notice-rp2040-pico-oled-091-128x32.uf2';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: oledArtifactId,
          boardId: 'rp2040-pico-oled-091',
          boardName: 'Raspberry Pi Pico + OLED 0.91" 128x32',
          targetId: 'rp2040-pico-oled-091-128x32',
          firmwareVersion: '0.1.1',
          protocolVersion: 2,
          visible: true,
          artifactName: 'cc-notice-rp2040-pico-oled-091-128x32.uf2',
          artifactType: 'uf2',
          flashStrategy: 'uf2_mount_copy',
          flashVolumeName: 'RPI-RP2',
          relativePath: 'rp2040-pico-oled-091/cc-notice-rp2040-pico-oled-091-128x32.uf2',
          source: 'local-bundled'
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: oledArtifactId,
      boardId: 'rp2040-pico-oled-091',
      artifactName: 'cc-notice-rp2040-pico-oled-091-128x32.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findByText('Pico + OLED 0.91 寸 128x32 接线说明')).toBeInTheDocument();
    expect(screen.getByText('连接 OLED SDA。')).toBeInTheDocument();
    expect(screen.getByText('连接 OLED SCL。')).toBeInTheDocument();
    expect(screen.getByText('OLED VCC 接 3V3，GND 接板卡 GND。')).toBeInTheDocument();
    expect(screen.getByText('连接有源或无源蜂鸣器信号端，大电流蜂鸣器需通过驱动模块连接。')).toBeInTheDocument();
    expect(screen.queryByText('PWM / 呼吸输出')).not.toBeInTheDocument();
    expect(screen.queryByText('WS2812 数据输出')).not.toBeInTheDocument();
  });

  test('does not expose custom firmware authoring before user board packages are supported', async () => {
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: defaultArtifactId,
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findByText('固件管理')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编写自定义固件' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '固件开发指南' })).not.toBeInTheDocument();
  });

  test('groups firmware by board family and explains recommended capability tiers', async () => {
    const picoArtifactId = 'local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2';
    const unoArtifactId = 'local-bundled:arduino-uno:0.2.2:cc-notice-arduino-uno.hex';
    const nanoOldBootloaderArtifactId =
      'local-bundled:arduino-nano-old-bootloader:0.2.2:cc-notice-arduino-nano-old-bootloader.hex';
    const stm32ArtifactId =
      'local-bundled:stm32f103cx-blue-pill:0.2.0:cc-notice-stm32f103cx-blue-pill.bin';
    const wioArtifactId =
      'local-bundled:seeed-wio-terminal:0.2.0:cc-notice-seeed-wio-terminal.bin';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: unoArtifactId,
          boardId: 'arduino-uno',
          boardName: 'Arduino Uno',
          firmwareVersion: '0.2.2',
          protocolVersion: 2,
          artifactName: 'cc-notice-arduino-uno.hex',
          artifactType: 'hex',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'arduino-uno/cc-notice-arduino-uno.hex',
          source: 'local-bundled',
          upload: {
            fqbn: 'arduino:avr:uno',
            protocol: 'stk500v1',
            speed: 115200,
            requires1200bpsReset: false,
            bootloaderWaitMs: 2000,
            boardOptions: {}
          }
        },
        {
          artifactId: picoArtifactId,
          boardId: 'rp2040-pico',
          boardName: 'Raspberry Pi Pico',
          firmwareVersion: '0.1.5',
          protocolVersion: 2,
          artifactName: 'cc-notice-rp2040-pico.uf2',
          artifactType: 'uf2',
          flashStrategy: 'uf2_mount_copy',
          flashVolumeName: 'RPI-RP2',
          relativePath: 'rp2040-pico/cc-notice-rp2040-pico.uf2',
          source: 'local-bundled'
        },
        {
          artifactId: nanoOldBootloaderArtifactId,
          boardId: 'arduino-nano',
          boardName: 'Arduino Nano',
          firmwareVersion: '0.2.2',
          protocolVersion: 2,
          artifactName: 'cc-notice-arduino-nano-old-bootloader.hex',
          artifactType: 'hex',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'arduino-nano/cc-notice-arduino-nano-old-bootloader.hex',
          source: 'local-bundled',
          upload: {
            fqbn: 'arduino:avr:nano',
            protocol: 'arduino',
            speed: 57600,
            requires1200bpsReset: false,
            bootloaderWaitMs: 2000,
            boardOptions: { cpu: 'atmega328old' }
          }
        },
        {
          artifactId: stm32ArtifactId,
          boardId: 'stm32f103cx-blue-pill',
          boardName: 'STM32F103C8T6/C6T6 Blue Pill',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          artifactName: 'cc-notice-stm32f103cx-blue-pill.bin',
          artifactType: 'bin',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'stm32f103cx-blue-pill/cc-notice-stm32f103cx-blue-pill.bin',
          source: 'local-bundled',
          upload: {
            fqbn: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C6',
            protocol: 'serial',
            speed: 115200,
            requires1200bpsReset: false,
            bootloaderWaitMs: 2000,
            boardOptions: {}
          }
        },
        {
          artifactId: wioArtifactId,
          boardId: 'seeed-wio-terminal',
          boardName: 'Seeed Studio Wio Terminal',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          artifactName: 'cc-notice-seeed-wio-terminal.bin',
          artifactType: 'bin',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'seeed-wio-terminal/cc-notice-seeed-wio-terminal.bin',
          source: 'local-bundled',
          upload: {
            fqbn: 'Seeeduino:samd:seeed_wio_terminal',
            protocol: 'sam-ba',
            speed: 921600,
            requires1200bpsReset: true,
            bootloaderWaitMs: 8000,
            boardOptions: {}
          }
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: unoArtifactId,
      boardId: 'arduino-uno',
      artifactName: 'cc-notice-arduino-uno.hex',
      artifactType: 'hex',
      flashStrategy: 'arduino_cli_upload',
      target: null,
      arduinoCli: {
        configuredPath: null,
        resolvedPath: 'arduino-cli',
        available: true,
        version: 'arduino-cli 1.2.0',
        error: null
      },
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findAllByText('RP2040')).not.toHaveLength(0);
    expect(screen.getByText('Arduino AVR')).toBeInTheDocument();
    expect(screen.getByText('STM32')).toBeInTheDocument();
    expect(screen.getByText('Seeed SAMD')).toBeInTheDocument();
    expect(screen.getAllByText('推荐')).not.toHaveLength(0);
    expect(screen.getAllByText('完整能力')).not.toHaveLength(0);
    expect(screen.getAllByText('轻量能力')).not.toHaveLength(0);
    expect(screen.getAllByText('精简能力')).not.toHaveLength(0);
    expect(screen.getAllByText('扩展设备能力')).not.toHaveLength(0);
    expect(screen.getByText('板卡族')).toBeInTheDocument();
    expect(screen.getByText('能力层级')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Arduino Nano 0.2.2 local-bundled' }));

    expect(
      await screen.findByText('适合 Uno / Nano 这类入门 AVR 板卡，只开放更稳妥的少量输出通道。')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'STM32F103C8T6/C6T6 Blue Pill 0.2.0 local-bundled' }));

    expect(
      await screen.findByText('按 STM32F103C6T6 最小资源约束开放稳妥数字输出，启用板载 USB CDC 串口，不启用高占用能力。')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Seeed Studio Wio Terminal 0.2.0 local-bundled' }));

    expect(
      await screen.findByText('适合带屏幕、按键、板载蜂鸣器和传感器的综合设备，输出通道与设备级扩展能力分开建模。')
    ).toBeInTheDocument();
  });

  test('disables flashing until the BOOTSEL volume is detected', async () => {
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: defaultArtifactId,
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findByText('未检测到 RPI-RP2 烧录盘')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '烧录所选固件' })).toBeDisabled();
  });

  test('flashes bundled firmware when the BOOTSEL volume is ready', async () => {
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: defaultArtifactId,
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: {
        mountPath: '/Volumes/RPI-RP2',
        volumeName: 'RPI-RP2'
      },
      ready: true
    });
    vi.mocked(tauriApi.flashFirmware).mockResolvedValue({
      artifactId: defaultArtifactId,
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      target: {
        mountPath: '/Volumes/RPI-RP2',
        volumeName: 'RPI-RP2'
      },
      copiedBytes: 78336
    });

    renderFirmwarePage();

    expect(await screen.findByText('/Volumes/RPI-RP2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '烧录所选固件' }));

    await waitFor(() => {
      expect(tauriApi.flashFirmware).toHaveBeenCalledWith({
        artifactId: defaultArtifactId,
        targetId: null
      });
    });
    expect(tauriApi.getFirmwareFlashStatus).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('固件已复制到 RPI-RP2，设备将自动重启。')).toBeInTheDocument();
  });

  test('selects firmware by artifact id when one board has multiple artifacts', async () => {
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: 'local-bundled:rp2040-pico:0.2.2:cc-notice-rp2040-pico.uf2',
          boardId: 'rp2040-pico',
          boardName: 'Raspberry Pi Pico',
          firmwareVersion: '0.2.2',
          protocolVersion: 2,
          artifactName: 'cc-notice-rp2040-pico.uf2',
          artifactType: 'uf2',
          flashStrategy: 'uf2_mount_copy',
          flashVolumeName: 'RPI-RP2',
          relativePath: 'rp2040-pico/0.2.2.uf2',
          source: 'local-bundled'
        },
        {
          artifactId: 'local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2',
          boardId: 'rp2040-pico',
          boardName: 'Raspberry Pi Pico',
          firmwareVersion: '0.1.5',
          protocolVersion: 2,
          artifactName: 'cc-notice-rp2040-pico.uf2',
          artifactType: 'uf2',
          flashStrategy: 'uf2_mount_copy',
          flashVolumeName: 'RPI-RP2',
          relativePath: 'rp2040-pico/0.1.5.uf2',
          source: 'local-bundled'
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: 'local-bundled:rp2040-pico:0.2.2:cc-notice-rp2040-pico.uf2',
      boardId: 'rp2040-pico',
      artifactName: 'cc-notice-rp2040-pico.uf2',
      artifactType: 'uf2',
      flashStrategy: 'uf2_mount_copy',
      target: null,
      ready: false
    });

    renderFirmwarePage();

    expect(await screen.findAllByText('0.2.2')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /0.1.5/ }));

    await waitFor(() =>
      expect(tauriApi.getFirmwareFlashStatus).toHaveBeenLastCalledWith(
        'local-bundled:rp2040-pico:0.1.5:cc-notice-rp2040-pico.uf2'
      )
    );
  });

  test('shows Arduino firmware with CLI status and target port selection', async () => {
    const arduinoArtifactId =
      'local-bundled:arduino-leonardo:0.2.0:cc-notice-arduino-leonardo.hex';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: arduinoArtifactId,
          boardId: 'arduino-leonardo',
          boardName: 'Arduino Leonardo',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          artifactName: 'cc-notice-arduino-leonardo.hex',
          artifactType: 'hex',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'arduino-leonardo/cc-notice-arduino-leonardo.hex',
          source: 'local-bundled',
          upload: {
            fqbn: 'arduino:avr:leonardo',
            protocol: 'avr109',
            speed: 57600,
            requires1200bpsReset: true,
            bootloaderWaitMs: 8000,
            boardOptions: {}
          }
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: arduinoArtifactId,
      boardId: 'arduino-leonardo',
      artifactName: 'cc-notice-arduino-leonardo.hex',
      artifactType: 'hex',
      flashStrategy: 'arduino_cli_upload',
      target: null,
      arduinoCli: {
        configuredPath: null,
        resolvedPath: 'arduino-cli',
        available: false,
        version: null,
        error: 'arduino_cli_not_found'
      },
      ready: false
    });
    vi.mocked(tauriApi.getFirmwareFlashTargets).mockResolvedValue([
      {
        targetId: 'serial:/dev/cu.usbmodem1',
        displayName: '/dev/cu.usbmodem1',
        transport: {
          kind: 'serial',
          serialPort: '/dev/cu.usbmodem1',
          baudRate: 115200
        }
      }
    ]);

    renderFirmwarePage();

    expect(await screen.findByText('未检测到 Arduino CLI')).toBeInTheDocument();
    expect(screen.getByText('目标端口')).toBeInTheDocument();
    expect(screen.getByText('/dev/cu.usbmodem1')).toBeInTheDocument();
    expect(screen.getByText('Arduino FQBN')).toBeInTheDocument();
    expect(screen.getByText('arduino:avr:leonardo')).toBeInTheDocument();
    expect(screen.getByText('上传协议')).toBeInTheDocument();
    expect(screen.getByText('avr109')).toBeInTheDocument();
    expect(screen.getByText('57600 bps')).toBeInTheDocument();
    expect(screen.getByText('需要 1200bps 复位')).toBeInTheDocument();
    expect(screen.getByText(/请先在设置页配置 arduino-cli 路径/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新状态' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '烧录所选固件' })).toBeDisabled();
    expect(tauriApi.flashFirmware).not.toHaveBeenCalled();
  });

  test('shows STM32 USB-TTL flashing guide below the flashing panel', async () => {
    const stm32ArtifactId =
      'local-bundled:stm32f103cx-blue-pill:0.2.0:cc-notice-stm32f103cx-blue-pill.bin';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: stm32ArtifactId,
          boardId: 'stm32f103cx-blue-pill',
          boardName: 'STM32F103C8T6/C6T6 Blue Pill',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          visible: true,
          artifactName: 'cc-notice-stm32f103cx-blue-pill.bin',
          artifactType: 'bin',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'stm32f103cx-blue-pill/cc-notice-stm32f103cx-blue-pill.bin',
          source: 'local-bundled',
          upload: {
            fqbn: 'STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C6',
            protocol: 'serial',
            speed: 115200,
            requires1200bpsReset: false,
            bootloaderWaitMs: 2000,
            boardOptions: { upload_method: 'serialMethod', usb: 'CDCgen' }
          }
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: stm32ArtifactId,
      boardId: 'stm32f103cx-blue-pill',
      artifactName: 'cc-notice-stm32f103cx-blue-pill.bin',
      artifactType: 'bin',
      flashStrategy: 'arduino_cli_upload',
      target: null,
      arduinoCli: {
        configuredPath: null,
        resolvedPath: 'arduino-cli',
        available: true,
        version: 'arduino-cli 1.5.1',
        error: null
      },
      ready: true
    });
    vi.mocked(tauriApi.getFirmwareFlashTargets).mockResolvedValue([
      {
        targetId: 'serial:/dev/cu.usbserial-14120',
        displayName: '/dev/cu.usbserial-14120',
        transport: {
          kind: 'serial',
          serialPort: '/dev/cu.usbserial-14120',
          baudRate: 115200
        }
      }
    ]);

    renderFirmwarePage();

    expect(await screen.findByText('STM32 串口烧录准备')).toBeInTheDocument();
    expect(screen.getByText('USB-TTL TXD -> PA10 / USART1_RX')).toBeInTheDocument();
    expect(screen.getByText('USB-TTL RXD -> PA9 / USART1_TX')).toBeInTheDocument();
    expect(screen.getByText('BOOT0 置 1，BOOT1 保持 0，然后按 RESET。')).toBeInTheDocument();
    expect(screen.getByText('烧录完成后，将 BOOT0 改回 0 并按 RESET，然后用板载 USB 连接软件。')).toBeInTheDocument();
    expect(screen.getByText('USB-TTL 主要用于串口烧录，日常识别和连接不需要继续接 TXD/RXD。')).toBeInTheDocument();
    expect(screen.getAllByText(/STM32CubeProgrammer/)).not.toHaveLength(0);
    expect(screen.getByText(/brew install gnu-getopt/)).toBeInTheDocument();
    expect(screen.getByText('/dev/cu.usbserial-14120')).toBeInTheDocument();
    expect(screen.getByText('选择 USB-TTL 对应的 /dev/cu.usbserial-* 或同类串口。')).toBeInTheDocument();
  });

  test('shows Arduino CLI upload success instead of UF2 copy result', async () => {
    const arduinoArtifactId =
      'local-bundled:arduino-nano-old-bootloader:0.2.0:cc-notice-arduino-nano.hex';
    vi.mocked(tauriApi.getFirmwareCatalog).mockResolvedValue({
      artifacts: [
        {
          artifactId: arduinoArtifactId,
          boardId: 'arduino-nano',
          boardName: 'Arduino Nano',
          firmwareVersion: '0.2.0',
          protocolVersion: 2,
          artifactName: 'cc-notice-arduino-nano.hex',
          artifactType: 'hex',
          flashStrategy: 'arduino_cli_upload',
          flashVolumeName: '',
          relativePath: 'arduino-nano/cc-notice-arduino-nano.hex',
          source: 'local-bundled',
          upload: {
            fqbn: 'arduino:avr:nano',
            protocol: 'arduino',
            speed: 57600,
            requires1200bpsReset: false,
            bootloaderWaitMs: 2000,
            boardOptions: { cpu: 'atmega328old' }
          }
        }
      ]
    });
    vi.mocked(tauriApi.getFirmwareFlashStatus).mockResolvedValue({
      artifactId: arduinoArtifactId,
      boardId: 'arduino-nano',
      artifactName: 'cc-notice-arduino-nano.hex',
      artifactType: 'hex',
      flashStrategy: 'arduino_cli_upload',
      target: null,
      arduinoCli: {
        configuredPath: null,
        resolvedPath: 'arduino-cli',
        available: true,
        version: 'arduino-cli 1.2.0',
        error: null
      },
      ready: true
    });
    vi.mocked(tauriApi.getFirmwareFlashTargets).mockResolvedValue([
      {
        targetId: 'serial:/dev/cu.usbserial-14110',
        displayName: '/dev/cu.usbserial-14110',
        transport: {
          kind: 'serial',
          serialPort: '/dev/cu.usbserial-14110',
          baudRate: 115200
        }
      }
    ]);
    vi.mocked(tauriApi.flashFirmware).mockResolvedValue({
      artifactId: arduinoArtifactId,
      boardId: 'arduino-nano',
      artifactName: 'cc-notice-arduino-nano.hex',
      target: {
        mountPath: '/dev/cu.usbserial-14110',
        volumeName: 'serial'
      },
      copiedBytes: 0
    });

    renderFirmwarePage();

    expect(await screen.findByText('/dev/cu.usbserial-14110')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '烧录所选固件' }));

    expect(await screen.findByText('Arduino CLI 烧录完成。')).toBeInTheDocument();
    expect(screen.getByText('目标端口：/dev/cu.usbserial-14110')).toBeInTheDocument();
    expect(screen.queryByText('固件已复制到 RPI-RP2，设备将自动重启。')).not.toBeInTheDocument();
    expect(screen.queryByText('已复制 0 字节。')).not.toBeInTheDocument();
  });
});

function renderFirmwarePage() {
  return render(
    <I18nProvider language="zh-CN">
      <FirmwarePage />
    </I18nProvider>
  );
}
