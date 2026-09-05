import { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  closeCustomFaceEditor,
  deleteCustomFaceGroup,
  exportCustomFaceGroup,
  getCustomFaceGroup,
  getCustomFaceGroups,
  importCustomFaceGroup,
  previewCustomFaceGroupImport,
  saveCustomFaceGroup,
} from '@/api/tauriApi';
import { open, save } from '@tauri-apps/plugin-dialog';
import type {
  CustomFaceGroup,
  CustomFaceGroupSummary,
  SaveCustomFaceGroupResult,
} from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import { CUSTOM_FACE_CONTRACT } from '@/domain/customFaces/generated/customFaceContract.generated';
import { createEditorState } from '@/domain/customFaces/editor/reducer';
import { resizeCustomFaceGroup } from '@/domain/customFaces/editor/resize';
import { CustomFaceGroupLibrary } from './CustomFaceGroupLibrary';
import { editorProfileFromId } from '@/domain/customFaces/editor/profile';
import { CustomFaceEditorWorkbench } from './CustomFaceEditorWorkbench';

export function CustomFaceEditorWindow() {
  const t = useI18n();
  const [groups, setGroups] = useState<CustomFaceGroupSummary[]>([]);
  const [previews, setPreviews] = useState<Record<string, CustomFaceGroup>>({});
  const [current, setCurrent] = useState<CustomFaceGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const closingRef = useRef(false);
  const addSaved = (saved: SaveCustomFaceGroupResult) =>
    setGroups((items) => [...items, summary(saved)]);

  useEffect(() => {
    void getCustomFaceGroups()
      .then(async (items) => {
        setGroups(items);
        const loaded = await Promise.all(
          items.map(async (item) => [item.groupId, await getCustomFaceGroup(item.groupId)] as const)
        );
        setPreviews(Object.fromEntries(loaded));
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (current) return;
    if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    let currentWindow;
    try {
      currentWindow = getCurrentWindow();
    } catch (error) {
      console.warn('failed to access custom face editor window', error);
      return;
    }
    void currentWindow
      .onCloseRequested((event) => {
        if (closingRef.current) return;
        event.preventDefault();
        closingRef.current = true;
        void closeCustomFaceEditor().catch((error) => {
          closingRef.current = false;
          console.warn('failed to close custom face editor library', error);
        });
      })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((error) =>
        console.warn('failed to register custom face library close handler', error)
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [current]);
  if (loading)
    return (
      <main className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {t('customFaceEditor.library.loading')}
      </main>
    );

  if (!current) {
    return (
      <CustomFaceGroupLibrary
        groups={groups}
        previews={previews}
        onOpen={async (id) => setCurrent(await getCustomFaceGroup(id))}
        onCreate={async (profileId) => {
          const profile = editorProfileFromId(profileId);
          if (!profile) throw new Error(t('customFaceEditor.library.invalidProfile'));
          const groupId = crypto.randomUUID();
          const faceId = crypto.randomUUID();
          const saved = await saveCustomFaceGroup({
            group: {
              schemaVersion: 1,
              groupId,
              name: t('customFaceEditor.defaults.unnamedGroup'),
              displayProfileId: profile.id,
              revision: 1,
              defaultFaceId: faceId,
              faces: [
                {
                  faceId,
                  name: t('customFaceEditor.defaults.staticFace'),
                  color: { red: 255, green: 255, blue: 255 },
                  frames: [
                    { durationMs: 200, packedPixels: Array(profile.framebufferBytes).fill(0) },
                  ],
                },
              ],
            },
            expectedLibraryHash: null,
          });
          addSaved(saved);
          setCurrent(saved.group);
        }}
        onCopy={async (id) => {
          const source = await getCustomFaceGroup(id);
          const faceIds = new Map(source.faces.map((face) => [face.faceId, crypto.randomUUID()]));
          const saved = await saveCustomFaceGroup({
            group: {
              ...source,
              groupId: crypto.randomUUID(),
              revision: 1,
              name: `${source.name} ${t('customFaceEditor.defaults.copySuffix')}`,
              defaultFaceId: faceIds.get(source.defaultFaceId)!,
              faces: source.faces.map((face) => ({
                ...face,
                faceId: faceIds.get(face.faceId)!,
                frames: face.frames.map((frame) => ({
                  ...frame,
                  packedPixels: [...frame.packedPixels],
                })),
              })),
            },
            expectedLibraryHash: null,
          });
          addSaved(saved);
          setPreviews((items) => ({ ...items, [saved.group.groupId]: saved.group }));
        }}
        onResizeCopy={async (id, profileId, name) => {
          const converted = resizeCustomFaceGroup(await getCustomFaceGroup(id), profileId, () =>
            crypto.randomUUID()
          );
          const saved = await saveCustomFaceGroup({
            group: { ...converted, name },
            expectedLibraryHash: null,
          });
          addSaved(saved);
          setPreviews((items) => ({ ...items, [saved.group.groupId]: saved.group }));
          setCurrent(saved.group);
        }}
        onRename={async (id, name) => {
          const item = groups.find((group) => group.groupId === id);
          if (!item) return;
          const saved = await saveCustomFaceGroup({
            group: { ...(await getCustomFaceGroup(id)), name },
            expectedLibraryHash: item.libraryHash,
          });
          setGroups((items) =>
            items.map((group) => (group.groupId === id ? summary(saved) : group))
          );
          setPreviews((items) => ({ ...items, [id]: saved.group }));
        }}
        onDelete={async (id) => {
          const item = groups.find((group) => group.groupId === id);
          if (!item) return;
          await deleteCustomFaceGroup(id, item.libraryHash);
          setGroups((items) => items.filter((group) => group.groupId !== id));
          setPreviews((items) => {
            const next = { ...items };
            delete next[id];
            return next;
          });
        }}
        onImport={async () => {
          const path = await open({
            multiple: false,
            directory: false,
            filters: [{ name: 'CC Face Group', extensions: ['ccface'] }],
          });
          if (typeof path !== 'string') return;
          const preview = await previewCustomFaceGroupImport(path);
          const mode = preview.status === 'conflict' ? 'update' : 'copy';
          const imported = await importCustomFaceGroup({ path, mode });
          const importedName = uniqueImportedGroupName(
            imported.group.name,
            groups,
            t('customFaceEditor.defaults.importSuffix')
          );
          const saved = await saveCustomFaceGroup({
            group: { ...imported.group, name: importedName },
            expectedLibraryHash: imported.libraryHash,
          });
          setGroups((items) => {
            const next = items.filter((item) => item.groupId !== saved.group.groupId);
            return [...next, summary(saved)];
          });
          setPreviews((items) => ({ ...items, [saved.group.groupId]: saved.group }));
          setCurrent(saved.group);
        }}
        onExport={async (id) => {
          const path = await save({
            defaultPath: `${groups.find((item) => item.groupId === id)?.name ?? 'custom-face'}.ccface`,
            filters: [{ name: 'CC Face Group', extensions: ['ccface'] }],
          });
          if (typeof path === 'string') await exportCustomFaceGroup(id, path);
        }}
      />
    );
  }

  const profile = editorProfileFromId(current.displayProfileId);
  if (!profile)
    return (
      <main className="p-6 text-sm text-destructive">
        {t('customFaceEditor.library.invalidProfile')}
      </main>
    );
  const item = groups.find((group) => group.groupId === current.groupId);
  return (
    <CustomFaceEditorWorkbench
      initialState={createEditorState(current, profile)}
      expectedLibraryHash={item?.libraryHash}
      onBack={() => setCurrent(null)}
      onSaved={(saved) => {
        setGroups((items) =>
          items.map((group) => (group.groupId === saved.group.groupId ? summary(saved) : group))
        );
        setPreviews((items) => ({ ...items, [saved.group.groupId]: saved.group }));
        setCurrent(saved.group);
      }}
    />
  );
}

function summary(saved: SaveCustomFaceGroupResult): CustomFaceGroupSummary {
  return {
    groupId: saved.group.groupId,
    name: saved.group.name,
    displayProfileId: saved.group.displayProfileId,
    revision: saved.group.revision,
    defaultFaceId: saved.group.defaultFaceId,
    faceCount: saved.group.faces.length,
    libraryHash: saved.libraryHash,
  };
}

export function uniqueImportedGroupName(
  baseName: string,
  groups: CustomFaceGroupSummary[],
  importSuffix = '-import'
) {
  const names = new Set(groups.map((group) => group.name.trim().toLocaleLowerCase()));
  const base = `${baseName.trim()}${importSuffix}`;
  if (!names.has(base.toLocaleLowerCase())) return base;
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${base}-${index}`;
    if (!names.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${base}-${Date.now()}`;
}
