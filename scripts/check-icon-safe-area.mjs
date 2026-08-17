import fs from 'node:fs';
import path from 'node:path';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${filePath} is not a PNG file`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function assertSquarePng(filePath, expectedSize) {
  const size = readPngSize(filePath);
  if (size.width !== expectedSize || size.height !== expectedSize) {
    throw new Error(
      `${filePath} must be ${expectedSize}x${expectedSize}, got ${size.width}x${size.height}`
    );
  }
}

const iconDir = path.resolve('src-tauri/icons');
const trayIcon = path.join(iconDir, 'tray-icon.png');
const requiredPngs = new Map([
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['512x512.png', 512],
  ['512x512@2x.png', 1024]
]);

for (const [fileName, size] of requiredPngs) {
  assertSquarePng(path.join(iconDir, fileName), size);
}

assertSquarePng(trayIcon, 64);

for (const fileName of ['icon.icns', 'icon.ico']) {
  const filePath = path.join(iconDir, fileName);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error(`${filePath} must exist and be non-empty`);
  }
}

console.log('icon assets have expected packaged dimensions');
