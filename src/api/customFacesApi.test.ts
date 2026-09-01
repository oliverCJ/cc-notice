import { beforeEach, describe, expect, test, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import {
  clearCustomFaceRecovery,
  deleteCustomFaceGroup,
  exportCustomFaceGif,
  exportCustomFaceGroup,
  exportCustomFaceItem,
  getCustomFaceGroup,
  getCustomFaceGroups,
  getCustomFaceRecovery,
  importCustomFaceGroup,
  previewCustomFaceGroupImport,
  previewCustomFaceItemImport,
  readCustomFaceSvg,
  saveCustomFaceGroup,
  saveCustomFaceRecovery,
  type CustomFaceGroup
} from './tauriApi';

const group: CustomFaceGroup = {
  schemaVersion: 1,
  groupId: '00000000-0000-4000-8000-000000000101',
  name: 'Test group',
  displayProfileId: 'custom-mono-128x32-v1',
  revision: 1,
  defaultFaceId: '00000000-0000-4000-8000-000000000111',
  faces: [
    {
      faceId: '00000000-0000-4000-8000-000000000111',
      name: 'Ready',
      color: { red: 18, green: 52, blue: 86 },
      frames: [{ durationMs: 200, packedPixels: [0, 1] }]
    }
  ]
};

describe('custom face Tauri API', () => {
  beforeEach(() => invoke.mockReset());

  test('uses stable command names and request shapes', async () => {
    await getCustomFaceGroups();
    await getCustomFaceGroup(group.groupId);
    await saveCustomFaceGroup({ group, expectedLibraryHash: 'abc' });
    await deleteCustomFaceGroup(group.groupId, 'abc');
    await saveCustomFaceRecovery(group);
    await getCustomFaceRecovery(group.groupId);
    await clearCustomFaceRecovery(group.groupId);
    await exportCustomFaceGroup(group.groupId, '/tmp/a.ccface');
    await previewCustomFaceGroupImport('/tmp/a.ccface');
    await importCustomFaceGroup({ path: '/tmp/a.ccface', mode: 'copy' });
    await previewCustomFaceItemImport('/tmp/a.ccfaceitem');
    await exportCustomFaceItem({ face: group.faces[0], displayProfileId: group.displayProfileId, path: '/tmp/a.ccfaceitem' });
    await exportCustomFaceGif({ face: group.faces[0], displayProfileId: group.displayProfileId, path: '/tmp/a.gif', scale: 2 });
    await readCustomFaceSvg('/tmp/a.svg');

    expect(invoke.mock.calls).toEqual([
      ['custom_face_groups'],
      ['custom_face_group', { groupId: group.groupId }],
      [
        'save_custom_face_group',
        { request: { group, expectedLibraryHash: 'abc' } }
      ],
      [
        'delete_custom_face_group',
        { groupId: group.groupId, expectedLibraryHash: 'abc' }
      ],
      ['save_custom_face_recovery', { group }],
      ['custom_face_recovery', { groupId: group.groupId }],
      ['clear_custom_face_recovery', { groupId: group.groupId }],
      ['export_custom_face_group', { groupId: group.groupId, path: '/tmp/a.ccface' }],
      ['preview_custom_face_group_import', { path: '/tmp/a.ccface' }],
      [
        'import_custom_face_group',
        { request: { path: '/tmp/a.ccface', mode: 'copy' } }
      ],
      ['preview_custom_face_item_import', { path: '/tmp/a.ccfaceitem' }],
      [
        'export_custom_face_item',
        { request: { face: group.faces[0], displayProfileId: group.displayProfileId, path: '/tmp/a.ccfaceitem' } }
      ],
      [
        'export_custom_face_gif',
        { request: { face: group.faces[0], displayProfileId: group.displayProfileId, path: '/tmp/a.gif', scale: 2 } }
      ],
      ['read_custom_face_svg', { path: '/tmp/a.svg' }]
    ]);
  });
});
