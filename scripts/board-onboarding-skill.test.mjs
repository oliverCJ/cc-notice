import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skillRoot = new URL('../skills/cc-notice-board-onboarding/', import.meta.url);
const read = (path) => readFile(new URL(path, skillRoot), 'utf8');

test('custom face onboarding gates are present in skill checklist and workflow', async () => {
  const [skill, checklist, workflow] = await Promise.all([
    read('SKILL.md'),
    read('references/board-input-checklist.md'),
    read('references/onboarding-workflow.md')
  ]);

  for (const content of [skill, checklist, workflow]) {
    assert.match(content, /custom-face-device-protocol-v1/);
    assert.match(content, /custom-face-package-v1/);
    assert.match(content, /A\/B/);
    assert.match(content, /1024/);
    assert.match(content, /custom_face_status/);
    assert.match(content, /断电/);
  }

  assert.match(skill.split('---')[1], /自定义表情/);
  assert.match(skill, /安装、存储与播放闭环/);
  assert.match(checklist, /provider/);
  assert.match(workflow, /未完成前.*省略.*custom_face/s);
});
