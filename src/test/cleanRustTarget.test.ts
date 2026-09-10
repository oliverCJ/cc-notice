import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanRustTarget } from '../../scripts/clean-rust-target.mjs';

function createTargetRoot() {
  const root = mkdtempSync(join(tmpdir(), 'cc-notice-clean-'));
  mkdirSync(join(root, 'src-tauri', 'target'), { recursive: true });
  return root;
}

function createMarker(path: string) {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'marker'), 'generated');
}

test('debug scope removes host and architecture debug directories only', () => {
  const root = createTargetRoot();
  createMarker(join(root, 'src-tauri', 'target', 'debug'));
  createMarker(join(root, 'src-tauri', 'target', 'aarch64-apple-darwin', 'debug'));
  createMarker(join(root, 'src-tauri', 'target', 'release'));

  cleanRustTarget(root, 'debug', { log: () => undefined });

  expect(existsSync(join(root, 'src-tauri', 'target', 'debug'))).toBe(false);
  expect(existsSync(join(root, 'src-tauri', 'target', 'aarch64-apple-darwin', 'debug'))).toBe(false);
  expect(existsSync(join(root, 'src-tauri', 'target', 'release'))).toBe(true);
});

test('release scope removes architecture release directories and preserves debug', () => {
  const root = createTargetRoot();
  createMarker(join(root, 'src-tauri', 'target', 'release'));
  createMarker(join(root, 'src-tauri', 'target', 'universal-apple-darwin', 'release'));
  createMarker(join(root, 'src-tauri', 'target', 'debug'));

  cleanRustTarget(root, 'release', { log: () => undefined });

  expect(existsSync(join(root, 'src-tauri', 'target', 'release'))).toBe(false);
  expect(existsSync(join(root, 'src-tauri', 'target', 'universal-apple-darwin', 'release'))).toBe(false);
  expect(existsSync(join(root, 'src-tauri', 'target', 'debug', 'marker'))).toBe(true);
});

test('all scope removes the complete target tree and dry-run preserves it', () => {
  const root = createTargetRoot();
  createMarker(join(root, 'src-tauri', 'target', 'debug'));
  createMarker(join(root, 'src-tauri', 'target', 'release', 'bundle'));

  cleanRustTarget(root, 'all', { dryRun: true, log: () => undefined });
  expect(existsSync(join(root, 'src-tauri', 'target', 'debug', 'marker'))).toBe(true);

  cleanRustTarget(root, 'all', { log: () => undefined });
  expect(existsSync(join(root, 'src-tauri', 'target'))).toBe(false);
  cleanRustTarget(root, 'all', { log: () => undefined });
});

test('rejects an unsafe scope and a target symlink', () => {
  const root = createTargetRoot();
  expect(() => cleanRustTarget(root, 'invalid', { log: () => undefined })).toThrow();

  const target = join(root, 'src-tauri', 'target');
  const replacement = mkdtempSync(join(tmpdir(), 'cc-notice-target-'));
  rmSync(target, { recursive: true, force: true });
  symlinkSync(replacement, target);
  expect(() => cleanRustTarget(root, 'all', { log: () => undefined })).toThrow();
});
