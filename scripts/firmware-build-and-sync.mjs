import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// app 目录是 npm script 的工作边界，根目录脚本需要从这里回退一层。
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '..');
const buildScript = resolve(repoRoot, 'scripts', 'firmware-build-all.sh');
const packageScript = resolve(repoRoot, 'scripts', 'firmware-package.sh');

function usage() {
  return '用法：npm run firmware:build:sync -- <board_id>';
}

function parseBoardId(args) {
  const filteredArgs = args.filter((value) => value !== '--');
  if (filteredArgs.length !== 1) {
    throw new Error(usage());
  }

  const [boardId] = filteredArgs;
  if (!/^[A-Za-z0-9._-]+$/.test(boardId)) {
    throw new Error(`非法 board_id：${boardId}`);
  }
  return boardId;
}

function assertBoardExists(boardId) {
  const boardToml = resolve(repoRoot, 'firmware', 'boards', boardId, 'board.toml');
  if (!existsSync(boardToml)) {
    throw new Error(`未找到固件板卡：${boardId}，请确认 firmware/boards/${boardId}/board.toml 是否存在`);
  }
}

// 每一步都继承终端输出，便于直接看到固件编译和打包日志。
function runStep(stepName, command, commandArgs) {
  console.log(`[firmware:build:sync] ${stepName}：${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const exitCode = result.status ?? 1;
    throw new Error(`[firmware:build:sync] ${stepName} 失败，退出码 ${exitCode}`);
  }
}

export function buildAndSyncFirmware(boardId) {
  assertBoardExists(boardId);
  runStep('编译固件', 'bash', [buildScript, boardId]);
  runStep('同步到软件内固件目录', 'bash', [packageScript, boardId]);
  console.log(`[firmware:build:sync] 完成：${boardId}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const boardId = parseBoardId(process.argv.slice(2));
    buildAndSyncFirmware(boardId);
  } catch (error) {
    console.error(`[firmware:build:sync] ${error.message}`);
    process.exitCode = 1;
  }
}

export const firmwareBuildAndSyncInternals = {
  usage,
  parseBoardId,
  assertBoardExists,
  runStep
};
