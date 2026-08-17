import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);

function setEnvIfMissing(name, value, reason) {
  if (process.env[name] || !existsSync(value)) {
    return;
  }

  process.env[name] = value;
  console.info(`[tauri-dev] set ${name}=${value} (${reason})`);
}

function configureMacBuildEnv() {
  if (process.platform === 'darwin') {
    configureDarwinBuildEnv();
  }
}

function configureDarwinBuildEnv() {
  const xcodeDeveloperDir = '/Applications/Xcode.app/Contents/Developer';
  const cltDeveloperDir = '/Library/Developer/CommandLineTools';

  // macOS 本地开发常见问题是 npm 环境缺少 SDK/编译器路径，这里只在未显式配置时补齐。
  setEnvIfMissing(
    'SDKROOT',
    `${xcodeDeveloperDir}/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk`,
    'Xcode SDK'
  );
  setEnvIfMissing('SDKROOT', `${cltDeveloperDir}/SDKs/MacOSX.sdk`, 'CommandLineTools SDK');
  setEnvIfMissing(
    'CC',
    `${xcodeDeveloperDir}/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang`,
    'Xcode clang'
  );
  setEnvIfMissing('CC', `${cltDeveloperDir}/usr/bin/clang`, 'CommandLineTools clang');
  setEnvIfMissing(
    'CXX',
    `${xcodeDeveloperDir}/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang++`,
    'Xcode clang++'
  );
  setEnvIfMissing('CXX', `${cltDeveloperDir}/usr/bin/clang++`, 'CommandLineTools clang++');
  setEnvIfMissing(
    'AR',
    `${xcodeDeveloperDir}/Toolchains/XcodeDefault.xctoolchain/usr/bin/ar`,
    'Xcode ar'
  );
  setEnvIfMissing('AR', `${cltDeveloperDir}/usr/bin/ar`, 'CommandLineTools ar');
  setEnvIfMissing(
    'RANLIB',
    `${xcodeDeveloperDir}/Toolchains/XcodeDefault.xctoolchain/usr/bin/ranlib`,
    'Xcode ranlib'
  );
  setEnvIfMissing('RANLIB', `${cltDeveloperDir}/usr/bin/ranlib`, 'CommandLineTools ranlib');
}

function tauriCommand() {
  if (process.platform === 'win32') {
    return {
      command: process.execPath,
      args: [join('node_modules', '@tauri-apps', 'cli', 'tauri.js'), ...args],
    };
  }

  return {
    command: 'tauri',
    args,
  };
}

function assertCargoAvailable() {
  const cargoCheck = spawnSync('cargo', ['--version'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (cargoCheck.status === 0) {
    const version = cargoCheck.stdout.trim();
    console.info(`[tauri-dev] found ${version}`);
    return;
  }

  const details = cargoCheck.error?.message ?? cargoCheck.stderr.trim() ?? 'cargo is unavailable';
  console.error(
    [
      '[tauri-dev] Rust/Cargo is required before running Tauri.',
      '[tauri-dev] Install Rust with rustup, then reopen this terminal and confirm `cargo --version` works.',
      `[tauri-dev] Cargo check failed: ${details}`,
    ].join('\n')
  );
  process.exit(1);
}

configureMacBuildEnv();
assertCargoAvailable();

const { command, args: commandArgs } = tauriCommand();
console.info(`[tauri-dev] run ${command} ${commandArgs.join(' ')}`);

const child = spawn(command, commandArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (error) => {
  console.error(`[tauri-dev] failed to start Tauri CLI: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[tauri-dev] Tauri CLI exited by signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 0);
});
