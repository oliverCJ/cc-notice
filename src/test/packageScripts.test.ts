import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('package exposes relay build commands', () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
  ) as { scripts: Record<string, string> };

  expect(packageJson.scripts['build:relay']).toBe(
    'cargo build --manifest-path src-tauri/Cargo.toml --bin cc-notice-relay'
  );
  expect(packageJson.scripts['build:relay:release']).toBe(
    'cargo build --manifest-path src-tauri/Cargo.toml --bin cc-notice-relay --release'
  );
  expect(packageJson.scripts['build:relay:asset']).toBe(
    'npm run build:relay:release && node scripts/sync-relay-asset.mjs'
  );
  expect(packageJson.scripts['build:app']).toBe('npm run build:relay:asset && npm run build');
  expect(packageJson.scripts['package:mac:x64']).toBe('node scripts/package-macos.mjs x64');
  expect(packageJson.scripts['package:mac:arm64']).toBe('node scripts/package-macos.mjs arm64');
  expect(packageJson.scripts['package:mac:universal']).toBe(
    'node scripts/package-macos.mjs universal'
  );
  expect(packageJson.scripts['package:mac:all']).toBe('node scripts/package-macos.mjs all');
  expect(packageJson.scripts['package:win']).toBe(
    'npm run build:relay:asset && npx tauri build --bundles nsis'
  );
  expect(packageJson.scripts).not.toHaveProperty('build:firmware');
  expect(packageJson.scripts).not.toHaveProperty('package:firmware');
  expect(packageJson.scripts).not.toHaveProperty('upload:firmware');
  expect(packageJson.scripts).not.toHaveProperty('prepare:firmware');
  expect(packageJson.scripts).not.toHaveProperty('generate:icons');
  expect(packageJson.scripts).not.toHaveProperty('generate:tray-icon');
  expect(packageJson.scripts).not.toHaveProperty('check:icons');
});

test('tauri npm script uses a cross-platform launcher without requiring sh', () => {
  const packageJson = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8')
  ) as { scripts: Record<string, string> };
  const script = readFileSync(join(process.cwd(), 'scripts/tauri-dev.mjs'), 'utf8');

  expect(packageJson.scripts['tauri']).toBe('node scripts/tauri-dev.mjs');
  expect(packageJson.scripts['tauri']).not.toContain('sh ');
  expect(script).toContain("process.platform === 'darwin'");
  expect(script).toContain("process.platform === 'win32'");
  expect(script).toContain('SDKROOT');
  expect(script).toContain('process.execPath');
  expect(script).toContain("'@tauri-apps', 'cli', 'tauri.js'");
  expect(script).not.toContain('npx.cmd');
  expect(script).toContain("spawnSync('cargo', ['--version']");
  expect(script).toContain('Rust/Cargo is required before running Tauri');
  expect(script).not.toContain('buildRelayForDev');
  expect(script).not.toContain("'--bin',");
  expect(script).not.toContain("'cc-notice-relay'");
  expect(script).toContain('spawn');
});

test('macOS package script builds relay for each app architecture', () => {
  const script = readFileSync(join(process.cwd(), 'scripts/package-macos.mjs'), 'utf8');

  expect(script).toContain('x86_64-apple-darwin');
  expect(script).toContain('aarch64-apple-darwin');
  expect(script).toContain('universal-apple-darwin');
  expect(script).toContain('lipo');
  expect(script).toContain('"beforeBuildCommand":"npm run build"');
  expect(script).toContain('cc-notice-relay');
  expect(script).toContain('prepareUniversalRelay();');
  expect(script).not.toContain('prepareSingleArchRelay');
});

test('generate icons script keeps conditional safe-area scaling', () => {
  const script = readFileSync(join(process.cwd(), 'scripts/generate-icons.mjs'), 'utf8');

  expect(script).toContain('const safeBoundarySize = 860;');
  expect(script).toContain('if (longestEdge > safeBoundarySize)');
  expect(script).toContain('fs.copyFileSync(sourceIcon, safeSource);');
});

test('generate tray icon script creates a tighter menu-bar asset without touching app icons', () => {
  const script = readFileSync(join(process.cwd(), 'scripts/generate-tray-icon.mjs'), 'utf8');

  expect(script).toContain('src-tauri');
  expect(script).toContain('tray-icon.png');
  expect(script).toContain('--cropToHeightWidth');
  expect(script).toContain('860');
  expect(script).toContain('--resampleHeightWidth');
  expect(script).toContain('64');
});

test('icon checks include dedicated tray icon dimensions', () => {
  const script = readFileSync(join(process.cwd(), 'scripts/check-icon-safe-area.mjs'), 'utf8');

  expect(script).toContain("path.join(iconDir, 'tray-icon.png')");
  expect(script).toContain('assertSquarePng(trayIcon, 64);');
});

test('production typescript build excludes vitest files', () => {
  const tsconfig = JSON.parse(
    readFileSync(join(process.cwd(), 'tsconfig.json'), 'utf8')
  ) as { exclude?: string[] };

  expect(tsconfig.exclude).toContain('src/test');
});

test('tauri production build composes relay and frontend build', () => {
  const tauriConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')
  ) as {
    build: { beforeBuildCommand: string };
    bundle: { resources: string[] };
  };

  expect(tauriConfig.build.beforeBuildCommand).toBe('npm run build:app');
  expect(tauriConfig.bundle.resources).toContain('assets/tools/**/*');
  expect(tauriConfig.bundle.resources).toContain('assets/sounds/**/*');
  expect(tauriConfig.bundle.resources).toContain('icons/tray-icon.png');
});

test('ci app checks run on macOS and Windows only', () => {
  const ciWorkflow = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');

  expect(ciWorkflow).toContain('- macos-latest');
  expect(ciWorkflow).toContain('- windows-latest');
  expect(ciWorkflow).not.toContain('- ubuntu-latest');
  expect(ciWorkflow).not.toContain('Install Linux Tauri dependencies');
  expect(ciWorkflow).not.toContain("runner.os == 'Linux'");
});

test('app tests do not depend on firmware source outside the app checkout', () => {
  const firmwareSourceTest = readFileSync(join(process.cwd(), 'src/test/firmwareSource.test.ts'), 'utf8');

  expect(firmwareSourceTest).not.toContain("resolve(appRoot, '..', 'firmware')");
  expect(firmwareSourceTest).not.toContain('buzzer_patterns.cpp');
  expect(firmwareSourceTest).not.toContain('buzzer_patterns.c');
});

test('windows release defaults to nsis installer with install mode selection', () => {
  const windowsConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'src-tauri/tauri.windows.conf.json'), 'utf8')
  ) as {
    bundle: {
      targets: string[];
      windows: { nsis: { installMode: string } };
    };
  };
  const releaseWorkflow = readFileSync(
    join(process.cwd(), '.github/workflows/release.yml'),
    'utf8'
  );

  expect(windowsConfig.bundle.targets).toEqual(['nsis']);
  expect(windowsConfig.bundle.windows.nsis.installMode).toBe('both');
  expect(releaseWorkflow).toContain('npx tauri build --bundles nsis');
  expect(releaseWorkflow).not.toContain('**/*.msi');
});

test('release workflow temporarily publishes macOS and Windows packages only', () => {
  const releaseWorkflow = readFileSync(
    join(process.cwd(), '.github/workflows/release.yml'),
    'utf8'
  );

  expect(releaseWorkflow).toContain('workflow_dispatch:');
  expect(releaseWorkflow).toContain('target:');
  expect(releaseWorkflow).toContain('default: all');
  expect(releaseWorkflow).toContain('- windows');
  expect(releaseWorkflow).toContain('- macos');
  expect(releaseWorkflow).toContain("inputs.target == 'windows'");
  expect(releaseWorkflow).toContain("inputs.target == 'macos'");
  expect(releaseWorkflow).toContain('fromJSON');
  expect(releaseWorkflow).toContain('cc-notice-windows');
  expect(releaseWorkflow).toContain('cc-notice-macos-intel');
  expect(releaseWorkflow).toContain('cc-notice-macos-apple-silicon');
  expect(releaseWorkflow).not.toContain('- linux');
  expect(releaseWorkflow).not.toContain("inputs.target == 'linux'");
  expect(releaseWorkflow).not.toContain('ubuntu-latest');
  expect(releaseWorkflow).not.toContain('cc-notice-linux');
  expect(releaseWorkflow).not.toContain('bundle/**/*.AppImage');
  expect(releaseWorkflow).not.toContain('bundle/**/*.deb');
  expect(releaseWorkflow).not.toContain('bundle/**/*.rpm');
});
