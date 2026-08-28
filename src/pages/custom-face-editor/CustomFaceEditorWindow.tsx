import { useEffect, useState } from 'react';
import { deleteCustomFaceGroup, getCustomFaceGroup, getCustomFaceGroups, saveCustomFaceGroup } from '@/api/tauriApi';
import type { CustomFaceGroup, CustomFaceGroupSummary, SaveCustomFaceGroupResult } from '@/api/tauriApi';
import { CUSTOM_FACE_CONTRACT } from '@/domain/customFaces/generated/customFaceContract.generated';
import { createEditorState } from '@/domain/customFaces/editor/reducer';
import { resizeCustomFaceGroup } from '@/domain/customFaces/editor/resize';
import { CustomFaceGroupLibrary } from './CustomFaceGroupLibrary';
import { CustomFaceEditorWorkbench } from './CustomFaceEditorWorkbench';

export function CustomFaceEditorWindow() {
  const [groups, setGroups] = useState<CustomFaceGroupSummary[]>([]);
  const [current, setCurrent] = useState<CustomFaceGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const addSaved = (saved: SaveCustomFaceGroupResult) => setGroups((items) => [...items, summary(saved)]);

  useEffect(() => { void getCustomFaceGroups().then(setGroups).finally(() => setLoading(false)); }, []);
  if (loading) return <main className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">加载表情组…</main>;

  if (!current) {
    return <CustomFaceGroupLibrary groups={groups} onOpen={async (id) => setCurrent(await getCustomFaceGroup(id))} onCreate={async (profileId) => {
      const profile = CUSTOM_FACE_CONTRACT.profiles.find((item) => item.id === profileId)!;
      const groupId = crypto.randomUUID(); const faceId = crypto.randomUUID();
      const saved = await saveCustomFaceGroup({ group: { schemaVersion: 1, groupId, name: '未命名组', displayProfileId: profile.id, revision: 1, defaultFaceId: faceId, faces: [{ faceId, name: '静态表情', color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(profile.framebufferBytes).fill(0) }] }] }, expectedLibraryHash: null });
      addSaved(saved); setCurrent(saved.group);
    }} onCopy={async (id) => {
      const source = await getCustomFaceGroup(id); const faceIds = new Map(source.faces.map((face) => [face.faceId, crypto.randomUUID()]));
      addSaved(await saveCustomFaceGroup({ group: { ...source, groupId: crypto.randomUUID(), revision: 1, name: `${source.name} 副本`, defaultFaceId: faceIds.get(source.defaultFaceId)!, faces: source.faces.map((face) => ({ ...face, faceId: faceIds.get(face.faceId)!, frames: face.frames.map((frame) => ({ ...frame, packedPixels: [...frame.packedPixels] })) })) }, expectedLibraryHash: null }));
    }} onResizeCopy={async (id, profileId) => {
      const converted = resizeCustomFaceGroup(await getCustomFaceGroup(id), profileId, () => crypto.randomUUID());
      const saved = await saveCustomFaceGroup({ group: converted, expectedLibraryHash: null }); addSaved(saved); setCurrent(saved.group);
    }} onRename={async (id) => {
      const item = groups.find((group) => group.groupId === id); const name = window.prompt('请输入新的组名称', item?.name); if (!item || !name?.trim()) return;
      const saved = await saveCustomFaceGroup({ group: { ...await getCustomFaceGroup(id), name: name.trim() }, expectedLibraryHash: item.libraryHash });
      setGroups((items) => items.map((group) => group.groupId === id ? summary(saved) : group));
    }} onDelete={async (id) => {
      const item = groups.find((group) => group.groupId === id); if (!item || !window.confirm(`确定删除表情组“${item.name}”吗？`)) return;
      await deleteCustomFaceGroup(id, item.libraryHash); setGroups((items) => items.filter((group) => group.groupId !== id));
    }} />;
  }

  const profile = CUSTOM_FACE_CONTRACT.profiles.find((item) => item.id === current.displayProfileId);
  if (!profile) return <main className="p-6 text-sm text-destructive">当前表情组分辨率档案不可用</main>;
  const item = groups.find((group) => group.groupId === current.groupId);
  return <CustomFaceEditorWorkbench initialState={createEditorState(current, profile)} expectedLibraryHash={item?.libraryHash} onBack={() => setCurrent(null)} onSaved={(saved) => { setGroups((items) => items.map((group) => group.groupId === saved.group.groupId ? summary(saved) : group)); setCurrent(null); }} />;
}

function summary(saved: SaveCustomFaceGroupResult): CustomFaceGroupSummary {
  return { groupId: saved.group.groupId, name: saved.group.name, displayProfileId: saved.group.displayProfileId, revision: saved.group.revision, defaultFaceId: saved.group.defaultFaceId, faceCount: saved.group.faces.length, libraryHash: saved.libraryHash };
}
