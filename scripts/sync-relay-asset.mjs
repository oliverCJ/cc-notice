import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const relayName = process.platform === 'win32' ? 'cc-notice-relay.exe' : 'cc-notice-relay';
const source = join(process.cwd(), 'src-tauri', 'target', 'release', relayName);
const target = join(process.cwd(), 'src-tauri', 'assets', 'tools', relayName);

if (!existsSync(source)) {
  throw new Error(`Relay release binary is missing at ${source}. Run npm run build:relay:release first.`);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Synced relay asset: ${target}`);
