import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const RELAY_NAME = 'cc-notice-relay';
const TARGETS = {
  x64: 'x86_64-apple-darwin',
  arm64: 'aarch64-apple-darwin',
  universal: 'universal-apple-darwin'
};
const ALL_PACKAGES = ['x64', 'arm64', 'universal'];
const tauriBuildConfig = '{"build":{"beforeBuildCommand":"npm run build"}}';

function runCommand(command, args) {
  console.log(`[package:mac] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function isRemoteSession() {
  return Boolean(process.env.SSH_CONNECTION || process.env.SSH_TTY || process.env.TMUX);
}

function parsePackagingMode(argv) {
  const flags = new Set(argv);
  if (flags.has('--bundle') && flags.has('--no-bundle')) {
    throw new Error('Use only one of --bundle or --no-bundle.');
  }

  if (flags.has('--bundle')) {
    return true;
  }
  if (flags.has('--no-bundle')) {
    return false;
  }
  return !isRemoteSession();
}

function relayOutputPath(target) {
  return join(process.cwd(), 'src-tauri', 'target', target, 'release', RELAY_NAME);
}

function relayAssetPath() {
  return join(process.cwd(), 'src-tauri', 'assets', 'tools', RELAY_NAME);
}

function buildRelay(target) {
  console.log(`[package:mac] Building relay for ${target}`);
  runCommand('cargo', [
    'build',
    '--manifest-path',
    'src-tauri/Cargo.toml',
    '--bin',
    RELAY_NAME,
    '--release',
    '--target',
    target
  ]);
}

function syncRelayAsset(source) {
  const target = relayAssetPath();

  if (!existsSync(source)) {
    throw new Error(`Relay binary is missing at ${source}`);
  }

  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`[package:mac] Synced relay asset: ${target}`);
}

function prepareUniversalRelay() {
  const x64Relay = relayOutputPath(TARGETS.x64);
  const arm64Relay = relayOutputPath(TARGETS.arm64);
  const universalRelay = relayOutputPath(TARGETS.universal);

  buildRelay(TARGETS.x64);
  buildRelay(TARGETS.arm64);
  mkdirSync(dirname(universalRelay), { recursive: true });
  runCommand('lipo', ['-create', x64Relay, arm64Relay, '-output', universalRelay]);
  syncRelayAsset(universalRelay);
}

function buildTauriPackage(target, bundleDmg) {
  console.log(`[package:mac] Building Tauri package for ${target}`);
  const args = [
    'tauri',
    'build',
    '--target',
    target,
    '--config',
    tauriBuildConfig
  ];
  if (!bundleDmg) {
    args.push('--no-bundle');
  }
  runCommand('npx', args);
}

function packageTarget(packageName, bundleDmg) {
  const target = TARGETS[packageName];

  if (!target) {
    throw new Error(`Unsupported macOS package target: ${packageName}`);
  }

  prepareUniversalRelay();
  buildTauriPackage(target, bundleDmg);
}

function main() {
  const packageName = process.argv[2] ?? '';
  const extraArgs = process.argv.slice(3);
  const bundleDmg = parsePackagingMode(extraArgs);
  const packages = packageName === 'all' ? ALL_PACKAGES : [packageName];

  if (!packageName || (!TARGETS[packageName] && packageName !== 'all')) {
    throw new Error(
      'Usage: node scripts/package-macos.mjs <x64|arm64|universal|all> [--bundle|--no-bundle]'
    );
  }

  if (!bundleDmg) {
    console.log('[package:mac] Remote session or --no-bundle detected; skipping DMG bundling.');
  }

  for (const currentPackage of packages) {
    packageTarget(currentPackage, bundleDmg);
  }
}

main();
