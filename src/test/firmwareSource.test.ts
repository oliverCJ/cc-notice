import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

type FirmwareManifest = {
  firmware: Array<{
    target_id: string;
    board_id: string;
    protocol_version: number;
    visible?: boolean;
    artifact_name: string;
    artifact_type: string;
    flash_strategy: string;
    relative_path: string;
    upload?: {
      fqbn: string;
      requires_1200bps_reset: boolean;
      board_options: Record<string, string>;
    };
  }>;
};

const appRoot = resolve(__dirname, '../..');
const firmwareAssetsRoot = resolve(appRoot, 'src-tauri/assets/firmware');

const readFirmwareManifest = (): FirmwareManifest =>
  JSON.parse(readFileSync(resolve(firmwareAssetsRoot, 'manifest.json'), 'utf8')) as FirmwareManifest;

const readBoardsYaml = (): string =>
  normalizeNewlines(readFileSync(resolve(appRoot, 'src-tauri/templates/boards.yaml'), 'utf8'));

const readWorkspaceFile = (relativePath: string): string =>
  normalizeNewlines(readFileSync(resolve(appRoot, '..', relativePath), 'utf8'));

const normalizeNewlines = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const normalizeManifestPath = (value: string): string => value.split(sep).join('/');

const listBundledFirmwareFiles = (directory = firmwareAssetsRoot): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return listBundledFirmwareFiles(absolutePath);
    }
    if (entry.name === 'manifest.json') {
      return [];
    }
    return [normalizeManifestPath(relative(firmwareAssetsRoot, absolutePath))];
  });

describe('App bundled firmware assets', () => {
  test('manifest entries point to bundled firmware files', () => {
    const manifest = readFirmwareManifest();

    expect(manifest.firmware.length).toBeGreaterThan(0);
    for (const item of manifest.firmware) {
      expect(item.target_id).toBeTruthy();
      expect(item.board_id).toBeTruthy();
      expect(item.protocol_version).toBe(2);
      expect(item.artifact_name).toBeTruthy();
      expect(item.relative_path).toBeTruthy();
      expect(item.relative_path).not.toContain('..');
      expect(item.relative_path.endsWith(item.artifact_name)).toBe(true);
      expect(
        existsSync(resolve(firmwareAssetsRoot, item.relative_path)),
        item.relative_path
      ).toBe(true);
    }
  });

  test('manifest contains only released visible firmware', () => {
    const firmware = readFirmwareManifest().firmware;

    expect(firmware.find((item) => item.board_id === 'rp2040-pico')?.visible).toBe(true);
    expect(firmware.find((item) => item.board_id === 'rp2040-pico-oled-091')?.visible).toBe(true);
    expect(firmware.find((item) => item.board_id === 'arduino-uno')?.visible).toBe(true);
    expect(firmware.find((item) => item.board_id === 'arduino-nano')?.visible).toBe(true);
    expect(firmware.find((item) => item.board_id === 'seeed-wio-terminal')?.visible).toBe(true);
    expect(firmware.find((item) => item.board_id === 'stm32f103cx-blue-pill')?.visible).toBe(true);
    expect(firmware.find((item) => item.board_id === 'sparkfun-pro-micro-32u4')?.visible).toBe(
      true
    );
    expect(firmware.every((item) => item.visible === true)).toBe(true);
    expect(firmware.find((item) => item.board_id === 'rp2040-pico-oled-096')).toBeUndefined();
    expect(firmware.find((item) => item.board_id === 'arduino-leonardo')).toBeUndefined();
    expect(firmware.find((item) => item.board_id === 'arduino-micro')).toBeUndefined();
  });

  test('firmware asset directory contains only files referenced by the release manifest', () => {
    const manifest = readFirmwareManifest();
    const referencedFiles = new Set(manifest.firmware.map((item) => item.relative_path));

    for (const file of listBundledFirmwareFiles()) {
      expect(referencedFiles.has(file), file).toBe(true);
    }
  });

  test('Arduino upload metadata keeps board-specific options in the app manifest', () => {
    const firmware = readFirmwareManifest().firmware;
    const proMicro = firmware.find((item) => item.board_id === 'sparkfun-pro-micro-32u4');
    const stm32 = firmware.find((item) => item.board_id === 'stm32f103cx-blue-pill');
    const oldNano = firmware.find((item) => item.target_id === 'arduino-nano-old-bootloader');
    const newNano = firmware.find((item) => item.target_id === 'arduino-nano-new-bootloader');

    expect(proMicro?.flash_strategy).toBe('arduino_cli_upload');
    expect(proMicro?.upload?.fqbn).toBe('SparkFun:avr:promicro');
    expect(proMicro?.upload?.requires_1200bps_reset).toBe(true);
    expect(proMicro?.upload?.board_options.cpu).toBe('16MHzatmega32U4');

    expect(stm32?.artifact_type).toBe('bin');
    expect(stm32?.upload?.fqbn).toBe('STMicroelectronics:stm32:GenF1:pnum=BLUEPILL_F103C6');
    expect(stm32?.upload?.board_options.upload_method).toBe('serialMethod');
    expect(stm32?.upload?.board_options.usb).toBe('CDCgen');

    expect(oldNano?.upload?.board_options.cpu).toBe('atmega328old');
    expect(newNano?.upload?.board_options.cpu).toBe('atmega328');
  });
});

describe('App board templates for bundled firmware', () => {
  test('every bundled board has a board template and pin catalog', () => {
    const boardsYaml = readBoardsYaml();
    const boardIds = new Set(readFirmwareManifest().firmware.map((item) => item.board_id));

    for (const boardId of boardIds) {
      expect(boardsYaml).toContain(`  - id: ${boardId}`);
      expect(boardsYaml).toContain(`    pinCatalogId: ${boardId}`);
      expect(boardsYaml).toContain(`  - id: ${boardId}\n    pins:`);
    }
  });

  test('pico oled templates reserve display pins according to the bundled board variant', () => {
    const boardsYaml = readBoardsYaml();

    expect(boardsYaml).toContain(`  - id: rp2040-pico
    pins:
      - id: gp0`);
    expect(boardsYaml).toContain(`      - id: gp22
        label: GP22
        physicalPin: 29
        gpio: GP22
        capabilities: [digital-output]`);
    expect(boardsYaml).toContain(`      - id: gp22
        label: GP22 / OLED RES
        physicalPin: 29
        gpio: GP22
        roles: [oled-reset, oled]
        capabilities: []`);
    expect(boardsYaml).toContain(`  - id: rp2040-pico-oled-091
    displayName: Raspberry Pi Pico + OLED 0.91" 128x32`);
    expect(boardsYaml).toContain(`      - id: gp20
        label: GP20 / OLED SDA
        physicalPin: 26
        gpio: GP20
        roles: [i2c-sda, oled]
        capabilities: []`);
    expect(boardsYaml).toContain(`      - id: gp21
        label: GP21 / OLED SCL
        physicalPin: 27
        gpio: GP21
        roles: [i2c-scl, oled]
        capabilities: []`);
  });

  test('Pro Micro template uses silk-screened 32U4 pin labels instead of RP2040 GP labels', () => {
    const boardsYaml = readBoardsYaml();

    expect(boardsYaml).toContain('  - id: sparkfun-pro-micro-32u4');
    expect(boardsYaml).toContain('        label: D0 / RX');
    expect(boardsYaml).toContain('        label: D10 / A10 / PWM');
    expect(boardsYaml).toContain('        label: D15 / SCK');
    expect(boardsYaml).toContain('        label: D17 / RX_LED');
    expect(boardsYaml).toContain('        label: A0');
    expect(boardsYaml).toContain('        label: A3');
  });
});

describe('Firmware display face command routing', () => {
  test('Arduino protocol dispatches display_face through device extension handler', () => {
    const source = readWorkspaceFile('firmware/shared/notice_protocol/protocol.cpp');
    const extensionHandlerCall = source.indexOf('runtime->extension_handler(&command.extension');
    const extensionDispatchStart = source.lastIndexOf(
      'if (\n    command.type == NOTICE_COMMAND_DISPLAY_STATUS',
      extensionHandlerCall
    );
    const channelLookupStart = source.indexOf('const NoticeChannelConfig* channel = find_channel', extensionHandlerCall);

    expect(extensionHandlerCall).toBeGreaterThanOrEqual(0);
    expect(extensionDispatchStart).toBeGreaterThanOrEqual(0);
    expect(channelLookupStart).toBeGreaterThan(extensionHandlerCall);
    expect(source.slice(extensionDispatchStart, channelLookupStart)).toContain(
      'command.type == NOTICE_COMMAND_DISPLAY_FACE'
    );
  });

  test('Wio face renderer avoids library arc angles for facial curves', () => {
    const source = readWorkspaceFile('firmware/boards/seeed-wio-terminal/src/display_status.cpp');
    const faceRendererStart = source.indexOf('void draw_face_eye_pair');
    const faceRendererEnd = source.indexOf('void draw_metric_box', faceRendererStart);

    expect(faceRendererStart).toBeGreaterThanOrEqual(0);
    expect(faceRendererEnd).toBeGreaterThan(faceRendererStart);
    expect(source.slice(faceRendererStart, faceRendererEnd)).not.toContain('drawArc');
  });

  test('face renderers keep focused, bored, busy, wait, and call semantics distinct', () => {
    const wioSource = readWorkspaceFile('firmware/boards/seeed-wio-terminal/src/display_status.cpp');
    const picoSource = readWorkspaceFile('firmware/shared/rp2040-pico/display_ssd1306/display_ssd1306.c');

    for (const source of [wioSource, picoSource]) {
      expect(source).toContain('"focus"');
      expect(source).toContain('"bored"');
      expect(source).toContain('"busy"');
      expect(source).toContain('"wait"');
      expect(source).toContain('"call"');
    }

    expect(wioSource).toContain('draw_face_call_wave_symbol');
    expect(picoSource).toContain('draw_call_wave_symbol');
    expect(wioSource).toContain('draw_face_busy_symbol');
    expect(picoSource).toContain('draw_busy_symbol');
    expect(wioSource).toContain('draw_face_bored_symbol');
    expect(picoSource).toContain('draw_bored_symbol');
    expect(wioSource).toContain('draw_face_surprise_symbol');
    expect(picoSource).toContain('draw_surprise_symbol');
    expect(wioSource).toContain('draw_face_shock_symbol');
    expect(picoSource).toContain('draw_shock_symbol');
  });

  test('Wio busy and call symbols stay clear of the face eyes', () => {
    const source = readWorkspaceFile('firmware/boards/seeed-wio-terminal/src/display_status.cpp');

    expect(source).toContain('tft.fillRoundRect(252, 74, 34, 5, 2, color);');
    expect(source).toContain('draw_thick_line(238, 128, 246, 138, 3, color);');
    expect(source).not.toContain('draw_thick_line(238, 82, 246, 92, 3, color);');
  });

  test('Pico OLED call wave is anchored near the mouth instead of the eyes', () => {
    const source = readWorkspaceFile('firmware/shared/rp2040-pico/display_ssd1306/display_ssd1306.c');
    const callWaveStart = source.indexOf('static void draw_call_wave_symbol');
    const callWaveEnd = source.indexOf('static void draw_busy_symbol', callWaveStart);
    const callWaveSource = source.slice(callWaveStart, callWaveEnd);

    expect(callWaveStart).toBeGreaterThanOrEqual(0);
    expect(callWaveEnd).toBeGreaterThan(callWaveStart);
    expect(callWaveSource).toContain('int center_y = y + (NOTICE_OLED_HEIGHT <= 32 ? 18 : 34);');
    expect(callWaveSource).not.toContain('int center_y = y + (NOTICE_OLED_HEIGHT <= 32 ? 10 : 16);');
  });

  test('Pico OLED display face returns to idle sleep after the requested duration', () => {
    const protocolSource = readWorkspaceFile('firmware/shared/rp2040-pico/protocol/protocol.c');
    const displayHeader = readWorkspaceFile('firmware/shared/rp2040-pico/display_ssd1306/display_ssd1306.h');
    const displaySource = readWorkspaceFile('firmware/shared/rp2040-pico/display_ssd1306/display_ssd1306.c');
    const channelSource = readWorkspaceFile('firmware/shared/rp2040-pico/channel_output/channels.c');
    const displayParseStart = protocolSource.indexOf(
      'command.type == NOTICE_COMMAND_DISPLAY_STATUS ||'
    );
    const displayParseEnd = protocolSource.indexOf(
      'read_string_field(line, "channel", command.channel_id',
      displayParseStart
    );
    const displayParseSource = protocolSource.slice(displayParseStart, displayParseEnd);

    expect(displayHeader).toContain(
      'bool display_ssd1306_show_face(const char *face, const char *intensity, uint32_t duration_ms);'
    );
    expect(displayParseStart).toBeGreaterThanOrEqual(0);
    expect(displayParseEnd).toBeGreaterThan(displayParseStart);
    expect(displayParseSource).toContain(
      'command.duration_ms = (uint32_t)read_number_field(line, "duration_ms", 0);'
    );
    expect(displayHeader).toContain('void display_ssd1306_update(void);');
    expect(displaySource).toContain('display_face_until_ms');
    expect(displaySource).toContain('display_ssd1306_show_face("idle-sleep", "standard", 0)');
    expect(channelSource).toContain(
      'display_ok = display_ssd1306_show_face(command.face, command.intensity, command.duration_ms);'
    );
    expect(channelSource).toContain('display_ssd1306_update();');
  });

  test('Wio display face overlay uses the requested duration', () => {
    const displayHeader = readWorkspaceFile('firmware/boards/seeed-wio-terminal/src/display_status.h');
    const displaySource = readWorkspaceFile('firmware/boards/seeed-wio-terminal/src/display_status.cpp');
    const protocolSource = readWorkspaceFile('firmware/shared/notice_protocol/protocol.cpp');

    expect(displayHeader).toContain(
      'void wio_display_status_show_face(const char* face, const char* intensity, unsigned long duration_ms);'
    );
    expect(protocolSource).toContain(
      'command.extension.duration_ms = static_cast<unsigned long>(read_number_field(line, "duration_ms", 0));'
    );
    expect(displaySource).toContain('void start_overlay_timer(unsigned long duration_ms)');
    expect(displaySource).toContain(
      'overlay_duration_ms = duration_ms > 0 ? duration_ms : kOverlayDurationMs;'
    );
    expect(displaySource).toContain(
      'return millis() - overlay_started_at_ms >= overlay_duration_ms;'
    );
    expect(displaySource).toContain(
      'start_overlay_timer(duration_ms);'
    );
    expect(displaySource).toContain(
      'wio_display_status_show_face(command->face, command->intensity, command->duration_ms);'
    );
  });
});
