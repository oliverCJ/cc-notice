import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const iconDir = path.join(repoRoot, 'src-tauri', 'icons');
const sourceIcon = path.join(iconDir, '512x512@2x.png');
const tempRoot = '/private/tmp';
const workDir = path.join(tempRoot, `cc-notice-icons-${process.pid}`);
const safeSource = path.join(workDir, 'icon-1024-safe.png');
const safeIconSet = path.join(workDir, 'cc-notice.iconset');
const icoPngDir = path.join(workDir, 'ico-pngs');
const safeBoundarySize = 860;
const canvasSize = 1024;

const requiredInputs = [sourceIcon];

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing required icon source: ${filePath}`);
  }
}

function readImageSize(filePath) {
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: tempRoot
    }
  });
  if (result.status !== 0) {
    throw new Error(`failed to read image size for ${filePath}`);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const widthMatch = output.match(/pixelWidth:\s*(\d+)/);
  const heightMatch = output.match(/pixelHeight:\s*(\d+)/);
  if (!widthMatch || !heightMatch) {
    throw new Error(`could not parse image size for ${filePath}`);
  }

  return {
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1])
  };
}

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

function writeIco(targetPath, pngFiles) {
  const images = pngFiles.map((filePath, index) => {
    const data = fs.readFileSync(filePath);
    const size = [16, 24, 32, 48, 64, 128, 256][index];
    return { size, data };
  });
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size === 256 ? 0 : image.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
    entries.push(entry);
  }

  fs.writeFileSync(targetPath, Buffer.concat([header, ...entries, ...images.map((image) => image.data)]));
}

for (const filePath of requiredInputs) {
  ensureFile(filePath);
}

fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(safeIconSet, { recursive: true });
fs.mkdirSync(icoPngDir, { recursive: true });

const sourceSize = readImageSize(sourceIcon);
const longestEdge = Math.max(sourceSize.width, sourceSize.height);
console.log('max edge: ' + longestEdge);
if (longestEdge > safeBoundarySize) {
  const scale = safeBoundarySize / longestEdge;
  const scaledWidth = Math.max(1, Math.round(sourceSize.width * scale));
  const scaledHeight = Math.max(1, Math.round(sourceSize.height * scale));
  run('sips', ['-z', String(scaledHeight), String(scaledWidth), sourceIcon, '--out', safeSource]);
  // run('sips', ['-p', String(canvasSize), String(canvasSize), safeSource, '--out', safeSource]);
} else {
  fs.copyFileSync(sourceIcon, safeSource);
  // run('sips', ['-p', String(canvasSize), String(canvasSize), safeSource, '--out', safeSource]);
}

const pngTargets = [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['512x512.png', 512],
  ['512x512@2x.png', 1024],
  ['144.png', 144]
];

for (const [fileName, size] of pngTargets) {
  run('sips', ['-z', String(size), String(size), safeSource, '--out', path.join(iconDir, fileName)]);
}

const iconsetEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
];

for (const [fileName, size] of iconsetEntries) {
  run('sips', ['-z', String(size), String(size), safeSource, '--out', path.join(safeIconSet, fileName)]);
}

run('iconutil', ['-c', 'icns', safeIconSet, '-o', path.join(iconDir, 'icon.icns')]);

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const icoPngs = icoSizes.map((size) => {
  const target = path.join(icoPngDir, `${size}.png`);
  run('sips', ['-z', String(size), String(size), safeSource, '--out', target]);
  return target;
});

writeIco(path.join(iconDir, 'icon.ico'), icoPngs);

console.log('generated icon assets from src-tauri/icons/512x512@2x.png');
