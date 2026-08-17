import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const iconDir = path.join(repoRoot, 'src-tauri', 'icons');
const sourceIcon = path.join(iconDir, '512x512@2x.png');
const tempRoot = '/private/tmp';
const workDir = path.join(tempRoot, `cc-notice-tray-icon-${process.pid}`);
const croppedIcon = path.join(workDir, 'tray-cropped.png');
const trayIcon = path.join(iconDir, 'tray-icon.png');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      TMPDIR: tempRoot
    }
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

if (!fs.existsSync(sourceIcon)) {
  throw new Error(`missing tray icon source: ${sourceIcon}`);
}

fs.mkdirSync(workDir, { recursive: true });

// The packaged app icon intentionally keeps an outer safe area. The menu-bar tray
// icon needs a tighter crop so it appears consistent with other status items.
run('sips', [
  '--cropToHeightWidth',
  '860',
  '860',
  '--cropOffset',
  '82',
  '82',
  sourceIcon,
  '--out',
  croppedIcon
]);
run('sips', ['--resampleHeightWidth', '64', '64', croppedIcon, '--out', trayIcon]);

console.log('generated tray icon at src-tauri/icons/tray-icon.png');
