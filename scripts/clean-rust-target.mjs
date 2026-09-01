import { lstatSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scopes = new Set(['debug', 'release', 'all']);

function usage() {
  return '用法：node scripts/clean-rust-target.mjs <debug|release|all> [--dry-run]';
}

function parseArgs(args) {
  const dryRun = args.includes('--dry-run');
  const scopesArgs = args.filter((arg) => arg !== '--dry-run');
  if (scopesArgs.length !== 1 || !scopes.has(scopesArgs[0])) {
    throw new Error(usage());
  }
  return { scope: scopesArgs[0], dryRun };
}

function isDirectory(path) {
  try {
    return lstatSync(path).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function assertSafeDirectory(path) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`拒绝清理非普通目录：${path}`);
  }
  return true;
}

export function cleanRustTarget(root, scope, { dryRun = false, log = console.info } = {}) {
  const targetRoot = resolve(root, 'src-tauri', 'target');
  if (!scopes.has(scope)) {
    throw new Error(usage());
  }

  const targetPaths = scope === 'all'
    ? [targetRoot]
    : profileDirectoriesAt(targetRoot, scope);

  for (const path of targetPaths) {
    if (!assertSafeDirectory(path)) {
      log(`[clean:rust] 跳过不存在路径：${displayPathFromRoot(root, path)}`);
      continue;
    }
    log(`[clean:rust] ${dryRun ? '预览' : '清理'}：${displayPathFromRoot(root, path)}`);
    if (!dryRun) {
      rmSync(path, { recursive: true, force: true });
    }
  }

  return targetPaths;
}

function profileDirectoriesAt(targetRoot, profile) {
  if (!assertSafeDirectory(targetRoot)) {
    return [];
  }

  const directories = [];
  for (const entry of readdirSync(targetRoot, { withFileTypes: true })) {
    if (entry.name === profile) {
      directories.push(join(targetRoot, entry.name));
      continue;
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      continue;
    }

    const profilePath = join(targetRoot, entry.name, profile);
    if (isDirectory(profilePath)) {
      directories.push(profilePath);
    }
  }
  return directories;
}

function displayPathFromRoot(root, path) {
  const value = relative(resolve(root), path);
  return value || '.';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { scope, dryRun } = parseArgs(process.argv.slice(2));
    cleanRustTarget(appRoot, scope, { dryRun });
  } catch (error) {
    console.error(`[clean:rust] ${error.message}`);
    process.exitCode = 1;
  }
}
