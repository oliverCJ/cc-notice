import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectDiskDiagnostics,
  resolveHomeDir,
  scanPath,
} from '../../scripts/diagnose-disk.mjs';

test('scans nested files without following symbolic links', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-notice-disk-'));
  const target = join(root, 'target');
  mkdirSync(join(target, 'nested'), { recursive: true });
  writeFileSync(join(target, 'one'), '1234');
  writeFileSync(join(target, 'nested', 'two'), '123456');
  symlinkSync(join(root, 'outside'), join(target, 'link'));

  const result = scanPath({ id: 'test', label: '测试', scope: 'app', path: target });

  expect(result.status).toBe('ok');
  expect(result.bytes).toBe(10);
  expect(result.fileCount).toBe(2);
  expect(result.directoryCount).toBe(2);
  expect(result.skippedSymlinkCount).toBe(1);
});

test('reports missing paths without throwing', () => {
  const result = scanPath({
    id: 'missing',
    label: '不存在',
    scope: 'user',
    path: join(tmpdir(), 'cc-notice-path-does-not-exist'),
  });

  expect(result.status).toBe('missing');
  expect(result.bytes).toBe(0);
  expect(result.errorCode).toBe('ENOENT');
});

test('resolves home using platform environment fallbacks', () => {
  expect(resolveHomeDir({ HOME: '/home/first', USERPROFILE: '/home/second' })).toBe('/home/first');
  expect(resolveHomeDir({ HOME: '', USERPROFILE: 'C:\\Users\\second' })).toBe('C:\\Users\\second');
  expect(resolveHomeDir({ HOMEDRIVE: 'C:', HOMEPATH: '\\Users\\third' })).toBe(
    join('C:', '\\Users\\third')
  );
  expect(resolveHomeDir({ HOME: '', USERPROFILE: '', HOMEDRIVE: '', HOMEPATH: '' })).toBeNull();
});

test('collects fixed app and user entries without reading file contents', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-notice-disk-'));
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'marker'), 'dependency');
  const home = mkdtempSync(join(tmpdir(), 'cc-notice-home-'));
  mkdirSync(join(home, '.cargo', 'registry'), { recursive: true });
  writeFileSync(join(home, '.cargo', 'registry', 'marker'), 'cache');

  const snapshot = collectDiskDiagnostics({
    root,
    env: { HOME: home, USERPROFILE: '' },
    tools: false,
  });

  expect(snapshot.home).toBe(home);
  expect(snapshot.tools).toEqual([]);
  expect(snapshot.entries.find((entry) => entry.id === 'app.node_modules')).toMatchObject({
    status: 'ok',
    bytes: 10,
    fileCount: 1,
  });
  expect(snapshot.entries.find((entry) => entry.id === 'user.cargo_registry')).toMatchObject({
    status: 'ok',
    bytes: 5,
    fileCount: 1,
  });
  expect(existsSync(join(root, 'node_modules', 'marker'))).toBe(true);
});

test('tool probing reports missing optional tools without throwing', async () => {
  const { probeTool } = await import('../../scripts/diagnose-disk.mjs');
  const result = probeTool('cc-notice-command-that-does-not-exist');

  expect(result.available).toBe(false);
  expect(result.errorCode).toBeDefined();
});
