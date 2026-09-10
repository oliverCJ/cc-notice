import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('firmware build sync script enforces a single board id and chains build then package', () => {
  const script = readFileSync(
    join(process.cwd(), 'scripts/firmware-build-and-sync.mjs'),
    'utf8'
  );

  expect(script).toContain("用法：npm run firmware:build:sync -- <board_id>");
  expect(script).toContain("const buildScript = resolve(repoRoot, 'scripts', 'firmware-build-all.sh')");
  expect(script).toContain("const packageScript = resolve(repoRoot, 'scripts', 'firmware-package.sh')");
  expect(script).toContain("const filteredArgs = args.filter((value) => value !== '--');");
  expect(script).toContain('filteredArgs.length !== 1');
  expect(script).toContain("spawnSync(command, commandArgs, {");
  expect(script).toContain("runStep('编译固件', 'bash', [buildScript, boardId]);");
  expect(script).toContain("runStep('同步到软件内固件目录', 'bash', [packageScript, boardId]);");
  expect(script).toContain("未找到固件板卡：");
  expect(script).toContain('firmware:build:sync');
});
