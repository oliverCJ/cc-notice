import { lstatSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appEntries = [
  ['app.node_modules', '应用 node_modules', 'app', 'node_modules'],
  ['app.rust_target', 'Rust/Tauri target', 'app', 'src-tauri/target'],
  ['app.dist', '前端 dist', 'app', 'dist'],
  ['app.tools', '本机构建工具', 'app', 'src-tauri/assets/tools'],
  ['app.firmware', '内置固件资产', 'app', 'src-tauri/assets/firmware'],
  ['app.sounds', '内置声音资产', 'app', 'src-tauri/assets/sounds'],
  ['app.git', 'Git 数据', 'app', '.git'],
];
const userEntries = [
  ['user.cargo_registry', 'Cargo registry 缓存', 'user', '.cargo/registry'],
  ['user.cargo_git', 'Cargo Git 缓存', 'user', '.cargo/git'],
  ['user.rustup_toolchains', 'Rust 工具链', 'user', '.rustup/toolchains'],
  ['user.npm_cache', 'npm 缓存', 'user', '.npm'],
  ['user.cc_notice', 'CC Notice 用户数据', 'user', '.cc-notice'],
];

export function resolveHomeDir(env = process.env) {
  const candidates = [env.HOME, env.USERPROFILE];
  if (env.HOMEDRIVE && env.HOMEPATH) {
    candidates.push(join(env.HOMEDRIVE, env.HOMEPATH));
  }
  return candidates.find((value) => typeof value === 'string' && value.trim() !== '') ?? null;
}

function errorCode(error) {
  return ['ENOENT', 'EACCES', 'EPERM', 'ELOOP'].includes(error?.code) ? error.code : 'UNKNOWN';
}

function emptyResult(id, label, scope, path, status = 'ok') {
  return {
    id,
    label,
    scope,
    path,
    status,
    bytes: 0,
    fileCount: 0,
    directoryCount: 0,
    skippedSymlinkCount: 0,
  };
}

export function scanPath({ id, label, scope, path }) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    return {
      ...emptyResult(id, label, scope, path, error?.code === 'ENOENT' ? 'missing' : 'unreadable'),
      errorCode: errorCode(error),
    };
  }

  if (stats.isSymbolicLink()) {
    return { ...emptyResult(id, label, scope, path, 'skipped'), skippedSymlinkCount: 1 };
  }
  if (!stats.isDirectory()) {
    return { ...emptyResult(id, label, scope, path), bytes: stats.size, fileCount: 1 };
  }

  const result = emptyResult(id, label, scope, path);
  result.directoryCount = 1;
  const pending = [path];
  while (pending.length > 0) {
    const currentPath = pending.pop();
    let entries;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch (error) {
      result.status = 'unreadable';
      result.errorCode ??= errorCode(error);
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isSymbolicLink()) {
        result.skippedSymlinkCount += 1;
        continue;
      }
      if (entry.isDirectory()) {
        result.directoryCount += 1;
        pending.push(entryPath);
        continue;
      }
      try {
        result.bytes += lstatSync(entryPath).size;
        result.fileCount += 1;
      } catch (error) {
        result.status = 'unreadable';
        result.errorCode ??= errorCode(error);
      }
    }
  }
  return result;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 'B';
  for (const nextUnit of units) {
    value /= 1024;
    unit = nextUnit;
    if (value < 1024 || nextUnit === units.at(-1)) break;
  }
  return `${value.toFixed(1)} ${unit}`;
}

export function probeTool(command, args = ['--version']) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 3000, windowsHide: true });
    if (result.status === 0) {
      return { command, available: true, version: result.stdout.trim().split('\n')[0] };
    }
    return { command, available: false, errorCode: result.error?.code ?? 'EXIT_NON_ZERO' };
  } catch (error) {
    return { command, available: false, errorCode: errorCode(error) };
  }
}

export function collectDiskDiagnostics({ root = appRoot, env = process.env, tools = true } = {}) {
  const home = resolveHomeDir(env);
  const entries = appEntries.map(([id, label, scope, path]) => scanPath({
    id,
    label,
    scope,
    path: resolve(root, path),
  }));
  if (home) {
    entries.push(...userEntries.map(([id, label, scope, path]) => scanPath({
      id,
      label,
      scope,
      path: resolve(home, path),
    })));
  }

  return {
    appRoot: resolve(root),
    home: home ? resolve(home) : null,
    partial: entries.some((entry) => entry.status === 'unreadable'),
    entries,
    tools: tools
      ? [
          { command: 'node', available: true, version: process.version },
          probeTool('cargo'),
          probeTool('rustup'),
          probeTool(process.platform === 'win32' ? 'npm.cmd' : 'npm'),
        ]
      : [],
  };
}

function printHuman(snapshot) {
  console.info(`磁盘诊断：${snapshot.appRoot}`);
  for (const scope of ['app', 'user']) {
    console.info(scope === 'app' ? '\n应用目录' : '\n用户级目录');
    for (const entry of snapshot.entries.filter((item) => item.scope === scope)) {
      const status = entry.status === 'ok' ? formatBytes(entry.bytes) : entry.status;
      console.info(`- ${entry.label}: ${status} (${entry.fileCount} 个文件，${entry.directoryCount} 个目录，跳过 ${entry.skippedSymlinkCount} 个链接)`);
    }
  }
  console.info('\n工具环境');
  for (const tool of snapshot.tools) {
    console.info(`- ${tool.command}: ${tool.available ? tool.version : `不可用（${tool.errorCode}）`}`);
  }
  if (snapshot.partial) console.info('\n部分目录无法读取，以上统计可能不完整。');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--json'].includes(arg))) {
    console.error('用法：node scripts/diagnose-disk.mjs [--json]');
    process.exitCode = 1;
  } else {
    const snapshot = collectDiskDiagnostics();
    if (args.includes('--json')) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      printHuman(snapshot);
    }
  }
}
