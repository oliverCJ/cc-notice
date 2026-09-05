import { useState } from 'react';
import { useI18n } from '@/i18n';
import type { CustomFaceGroup, CustomFaceGroupSummary } from '@/api/tauriApi';
import { CUSTOM_FACE_CONTRACT } from '@/domain/customFaces/generated/customFaceContract.generated';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DeleteGroupDialog, RenameGroupDialog, ResizeGroupDialog } from './CustomFaceGroupDialogs';
import { CustomFaceAnimatedPreview } from './CustomFaceAnimatedPreview';
import {
  customProfileId,
  editorProfileFromId,
  CUSTOM_PROFILE_MAX_DIMENSION,
  CUSTOM_PROFILE_MIN_DIMENSION,
} from '@/domain/customFaces/editor/profile';

type Props = {
  groups: CustomFaceGroupSummary[];
  previews?: Record<string, CustomFaceGroup>;
  onOpen: (groupId: string) => void;
  onCreate: (profileId: string) => void;
  onCopy: (groupId: string) => void;
  onResizeCopy: (groupId: string, profileId: string, name: string) => Promise<void>;
  onRename: (groupId: string, name: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
  onImport?: () => void;
  onExport?: (groupId: string) => void;
};

export function CustomFaceGroupLibrary({
  groups,
  previews = {},
  onOpen,
  onCreate,
  onCopy,
  onResizeCopy,
  onRename,
  onDelete,
  onImport,
  onExport,
}: Props) {
  const t = useI18n();
  const [targetProfileId, setTargetProfileId] = useState(
    CUSTOM_FACE_CONTRACT.profiles[0].id as string
  );
  const [customWidth, setCustomWidth] = useState('128');
  const [customHeight, setCustomHeight] = useState('32');
  const [dialog, setDialog] = useState<{
    type: 'resize' | 'rename' | 'delete';
    group: CustomFaceGroupSummary;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const customId = customProfileId(Number(customWidth) || 0, Number(customHeight) || 0);
  const customValid =
    Number(customWidth) >= CUSTOM_PROFILE_MIN_DIMENSION &&
    Number(customHeight) >= CUSTOM_PROFILE_MIN_DIMENSION &&
    Number(customWidth) <= CUSTOM_PROFILE_MAX_DIMENSION &&
    Number(customHeight) <= CUSTOM_PROFILE_MAX_DIMENSION;
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      setDialog(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl">
        {error ? (
          <p
            role="alert"
            className="mb-3 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        <header className="border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-semibold">{t('customFaceEditor.library.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t('customFaceEditor.library.description')}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select value={targetProfileId} onValueChange={setTargetProfileId}>
              <SelectTrigger
                aria-label={t('customFaceEditor.library.newResolution')}
                className="min-w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FACE_CONTRACT.profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {t('customFaceEditor.library.profileFrames', {
                      width: profile.width,
                      height: profile.height,
                      max: profile.maxFrames,
                    })}
                  </SelectItem>
                ))}
                <SelectItem value="custom">
                  {t('customFaceEditor.library.customResolution')}
                </SelectItem>
              </SelectContent>
            </Select>
            {targetProfileId === 'custom' ? (
              <label className="text-xs">
                {t('customFaceEditor.library.customWidth')}
                <input
                  aria-label={t('customFaceEditor.library.customWidth')}
                  type="number"
                  min={CUSTOM_PROFILE_MIN_DIMENSION}
                  max={CUSTOM_PROFILE_MAX_DIMENSION}
                  value={customWidth}
                  onChange={(event) => setCustomWidth(event.target.value)}
                  className="ml-1 w-16 border border-border px-1 py-1"
                />
              </label>
            ) : null}
            {targetProfileId === 'custom' ? (
              <label className="text-xs">
                {t('customFaceEditor.library.customHeight')}
                <input
                  aria-label={t('customFaceEditor.library.customHeight')}
                  type="number"
                  min={CUSTOM_PROFILE_MIN_DIMENSION}
                  max={CUSTOM_PROFILE_MAX_DIMENSION}
                  value={customHeight}
                  onChange={(event) => setCustomHeight(event.target.value)}
                  className="ml-1 w-16 border border-border px-1 py-1"
                />
              </label>
            ) : null}
            <button
              className="border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground"
              onClick={() => onCreate(targetProfileId === 'custom' ? customId : targetProfileId)}
              disabled={targetProfileId === 'custom' && !customValid}
            >
              ＋ {t('customFaceEditor.library.newGroup')}
            </button>
            <button
              className="border border-border px-3 py-2 text-sm"
              onClick={() =>
                void run(async () => {
                  await onImport?.();
                })
              }
            >
              {t('customFaceEditor.library.importGroup')}
            </button>
            <span className="text-xs text-muted-foreground">
              {t('customFaceEditor.library.hint')}
            </span>
          </div>
        </header>
        <div className="mt-5">
          {groups.length === 0 ? (
            <div className="border border-dashed border-border py-20 text-center text-sm text-muted-foreground">
              {t('customFaceEditor.library.empty')}
            </div>
          ) : (
            <div className="grid gap-3">
              {groups.map((group) => {
                const preview = previews[group.groupId];
                const defaultFace = preview?.faces.find(
                  (face) => face.faceId === preview.defaultFaceId
                );
                const frames = defaultFace?.frames ?? [];
                const profile = editorProfileFromId(group.displayProfileId);
                return (
                  <article
                    key={group.groupId}
                    onMouseEnter={() => setHoveredGroupId(group.groupId)}
                    onMouseLeave={() =>
                      setHoveredGroupId((current) => (current === group.groupId ? null : current))
                    }
                    data-preview-active={hoveredGroupId === group.groupId}
                    className="flex items-center gap-4 border border-border bg-card p-4"
                  >
                    <div className="h-16 w-24 border border-border bg-black">
                      {profile && frames.length > 0 ? (
                        <CustomFaceAnimatedPreview
                          width={profile.width}
                          height={profile.height}
                          frames={frames}
                          ariaLabel={t('customFaceEditor.library.defaultFacePreview', {
                            name: group.name,
                          })}
                          className="h-full w-full"
                          active={hoveredGroupId === group.groupId}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {t('customFaceEditor.library.previewUnavailable')}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-medium">{group.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profileLabel(group.displayProfileId)} ·{' '}
                        {t('customFaceEditor.library.faceCount', { count: group.faceCount })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('customFaceEditor.library.revision', { revision: group.revision })}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="border border-primary px-3 py-2 text-sm"
                        onClick={() => onOpen(group.groupId)}
                      >
                        {t('customFaceEditor.library.open')}
                      </button>
                      <button
                        className="border border-border px-3 py-2 text-sm"
                        onClick={() => onCopy(group.groupId)}
                      >
                        {t('customFaceEditor.library.copy')}
                      </button>
                      <button
                        className="border border-border px-3 py-2 text-sm"
                        onClick={() => {
                          setError(null);
                          setDialog({ type: 'resize', group });
                        }}
                      >
                        {t('customFaceEditor.library.resizeCopy')}
                      </button>
                      <button
                        className="border border-border px-3 py-2 text-sm"
                        onClick={() => {
                          setError(null);
                          setDialog({ type: 'rename', group });
                        }}
                      >
                        {t('customFaceEditor.library.rename')}
                      </button>
                      <button
                        className="border border-border px-3 py-2 text-sm"
                        onClick={() =>
                          void run(async () => {
                            await onExport?.(group.groupId);
                          })
                        }
                      >
                        {t('customFaceEditor.library.export')}
                      </button>
                      <button
                        className="border border-destructive px-3 py-2 text-sm text-destructive"
                        onClick={() => {
                          setError(null);
                          setDialog({ type: 'delete', group });
                        }}
                      >
                        {t('customFaceEditor.library.remove')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <ResizeGroupDialog
        group={dialog?.type === 'resize' ? dialog.group : null}
        frameCount={
          dialog?.type === 'resize'
            ? Math.max(
                ...(previews[dialog.group.groupId]?.faces.map((face) => face.frames.length) ?? [0])
              )
            : 0
        }
        open={dialog?.type === 'resize'}
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(profileId, name) =>
          void run(() => onResizeCopy(dialog!.group.groupId, profileId, name))
        }
      />
      <RenameGroupDialog
        group={dialog?.type === 'rename' ? dialog.group : null}
        open={dialog?.type === 'rename'}
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={(name) => void run(() => onRename(dialog!.group.groupId, name))}
      />
      <DeleteGroupDialog
        group={dialog?.type === 'delete' ? dialog.group : null}
        open={dialog?.type === 'delete'}
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onConfirm={() => void run(() => onDelete(dialog!.group.groupId))}
      />
    </main>
  );
}

function profileLabel(profileId: string) {
  const profile = editorProfileFromId(profileId);
  return profile ? `${profile.width} × ${profile.height}` : profileId;
}
