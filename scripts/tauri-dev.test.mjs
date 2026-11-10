import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = join(projectRoot, 'scripts', 'tauri-dev.mjs');

function writeExecutable(path, content) {
  writeFileSync(path, content, 'utf8');
  chmodSync(path, 0o755);
}

function runTauriDev(args, { cargoBuildExit = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cc-notice-tauri-dev-'));
  const binDir = join(root, 'bin');
  const callLog = join(root, 'calls.log');
  writeFileSync(callLog, '', 'utf8');
  mkdirSync(binDir, { recursive: true });

  writeExecutable(
    join(binDir, 'cargo'),
    `#!/bin/sh
printf 'cargo %s\n' "$*" >> "$CALL_LOG"
if [ "$1" = "--version" ]; then
  echo "cargo 1.99.1"
  exit 0
fi
if [ "$1" = "build" ]; then
  exit "$CARGO_BUILD_EXIT"
fi
exit 0
`
  );
  writeExecutable(
    join(binDir, 'tauri'),
    `#!/bin/sh
printf 'tauri %s\n' "$*" >> "$CALL_LOG"
exit 0
`
  );

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CALL_LOG: callLog,
      CARGO_BUILD_EXIT: String(cargoBuildExit),
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
    },
  });
  const calls = readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean);
  rmSync(root, { recursive: true, force: true });
  return { ...result, calls };
}

const unixOnly = { skip: process.platform === 'win32' };

test('dev builds the relay before starting Tauri', unixOnly, () => {
  const result = runTauriDev(['dev']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [
    'cargo --version',
    'cargo build --manifest-path src-tauri/Cargo.toml --bin cc-notice-relay',
    'tauri dev',
  ]);
});

test('non-dev Tauri commands do not build the relay', unixOnly, () => {
  const result = runTauriDev(['--version']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, ['cargo --version', 'tauri --version']);
});

test('relay build failure stops before Tauri starts', unixOnly, () => {
  const result = runTauriDev(['dev'], { cargoBuildExit: 17 });

  assert.equal(result.status, 17);
  assert.deepEqual(result.calls, [
    'cargo --version',
    'cargo build --manifest-path src-tauri/Cargo.toml --bin cc-notice-relay',
  ]);
  assert.match(result.stderr, /failed to build cc-notice-relay/);
});
