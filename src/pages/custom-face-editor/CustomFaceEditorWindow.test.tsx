import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { CustomFaceGroup } from '@/api/tauriApi';
import { CustomFaceEditorWindow, uniqueImportedGroupName } from './CustomFaceEditorWindow';

const group: CustomFaceGroup = {
  schemaVersion: 1,
  groupId: 'group-1',
  name: '测试组',
  displayProfileId: 'custom-mono-128x32-v1',
  revision: 1,
  defaultFaceId: 'face-1',
  faces: [{
    faceId: 'face-1',
    name: '默认表情',
    color: { red: 255, green: 255, blue: 255 },
    frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }]
  }]
};

const getCustomFaceGroupsMock = vi.hoisted(() => vi.fn());
const getCustomFaceGroupMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    getCustomFaceGroups: getCustomFaceGroupsMock,
    getCustomFaceGroup: getCustomFaceGroupMock
  };
});

vi.mock('./CustomFaceEditorWorkbench', () => ({
  CustomFaceEditorWorkbench: ({ initialState, onSaved }: {
    initialState: { presentGroup: CustomFaceGroup };
    onSaved: (result: { group: CustomFaceGroup; libraryHash: string }) => void;
  }) => (
    <section>
      <p>编辑器：{initialState.presentGroup.name}</p>
      <button onClick={() => onSaved({ group: { ...initialState.presentGroup, revision: 2 }, libraryHash: 'hash-2' })}>模拟保存</button>
    </section>
  )
}));

beforeEach(() => {
  getCustomFaceGroupsMock.mockResolvedValue([{
    groupId: group.groupId,
    name: group.name,
    displayProfileId: group.displayProfileId,
    revision: group.revision,
    defaultFaceId: group.defaultFaceId,
    faceCount: group.faces.length,
    libraryHash: 'hash-1'
  }]);
  getCustomFaceGroupMock.mockResolvedValue(group);
});

test('keeps the saved group open after the editor reports a successful save', async () => {
  render(<CustomFaceEditorWindow />);

  await screen.findByText('我的表情组');
  fireEvent.click(screen.getByRole('button', { name: '打开' }));
  await screen.findByText('编辑器：测试组');
  fireEvent.click(screen.getByRole('button', { name: '模拟保存' }));

  await waitFor(() => expect(screen.getByText('编辑器：测试组')).toBeInTheDocument());
  expect(screen.queryByText('我的表情组')).not.toBeInTheDocument();
});

test('adds an import suffix to the group name and avoids local name collisions', () => {
  const summaries = [{
    groupId: 'existing',
    name: '测试组-import',
    displayProfileId: group.displayProfileId,
    revision: 1,
    defaultFaceId: group.defaultFaceId,
    faceCount: 1,
    libraryHash: 'hash'
  }];

  expect(uniqueImportedGroupName('测试组', summaries)).toBe('测试组-import-2');
});
