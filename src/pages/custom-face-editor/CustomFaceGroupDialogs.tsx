import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CustomFaceGroupSummary } from '@/api/tauriApi';
import { CUSTOM_FACE_CONTRACT } from '@/domain/customFaces/generated/customFaceContract.generated';
import {
  customProfileId,
  editorProfileFromId,
  CUSTOM_PROFILE_MAX_DIMENSION,
  CUSTOM_PROFILE_MIN_DIMENSION,
} from '@/domain/customFaces/editor/profile';

export function ResizeGroupDialog({
  group,
  frameCount = 0,
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  group: CustomFaceGroupSummary | null;
  frameCount?: number;
  open: boolean;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (profileId: string, name: string) => void;
}) {
  const t = useI18n();
  const [profileId, setProfileId] = useState('');
  const [name, setName] = useState('');
  const [customWidth, setCustomWidth] = useState('128');
  const [customHeight, setCustomHeight] = useState('32');
  useEffect(() => {
    if (group) {
      const profile = CUSTOM_FACE_CONTRACT.profiles.find(
        (item) => item.id !== group.displayProfileId
      );
      setProfileId(profile?.id ?? '');
      setName(`${group.name} ${profile?.width ?? ''}×${profile?.height ?? ''}`);
    }
  }, [group]);
  const resolvedProfileId =
    profileId === 'custom'
      ? customProfileId(Number(customWidth) || 0, Number(customHeight) || 0)
      : profileId;
  const target = editorProfileFromId(resolvedProfileId);
  const customValid =
    Number(customWidth) >= CUSTOM_PROFILE_MIN_DIMENSION &&
    Number(customHeight) >= CUSTOM_PROFILE_MIN_DIMENSION &&
    Number(customWidth) <= CUSTOM_PROFILE_MAX_DIMENSION &&
    Number(customHeight) <= CUSTOM_PROFILE_MAX_DIMENSION;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('customFaceEditor.groupDialogs.resizeTitle')}</DialogTitle>
          <DialogDescription>
            {t('customFaceEditor.groupDialogs.resizeDescription')}
          </DialogDescription>
        </DialogHeader>
        <label className="text-sm">
          {t('customFaceEditor.groupDialogs.targetResolution')}
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger aria-label={t('customFaceEditor.groupDialogs.targetResolution')}>
              <SelectValue placeholder={t('customFaceEditor.groupDialogs.selectResolution')} />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_FACE_CONTRACT.profiles
                .filter((profile) => profile.id !== group?.displayProfileId)
                .map((profile) => (
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
        </label>
        {profileId === 'custom' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">
              {t('customFaceEditor.groupDialogs.customWidth')}
              <input
                aria-label={t('customFaceEditor.groupDialogs.customWidth')}
                type="number"
                min={CUSTOM_PROFILE_MIN_DIMENSION}
                max={CUSTOM_PROFILE_MAX_DIMENSION}
                value={customWidth}
                onChange={(event) => setCustomWidth(event.target.value)}
                className="mt-1 w-full border border-border px-2 py-1"
              />
            </label>
            <label className="text-xs">
              {t('customFaceEditor.groupDialogs.customHeight')}
              <input
                aria-label={t('customFaceEditor.groupDialogs.customHeight')}
                type="number"
                min={CUSTOM_PROFILE_MIN_DIMENSION}
                max={CUSTOM_PROFILE_MAX_DIMENSION}
                value={customHeight}
                onChange={(event) => setCustomHeight(event.target.value)}
                className="mt-1 w-full border border-border px-2 py-1"
              />
            </label>
          </div>
        ) : null}
        <label className="text-sm">
          {t('customFaceEditor.groupDialogs.newGroupName')}
          <input
            aria-label={t('customFaceEditor.groupDialogs.newGroupName')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full border border-border bg-background px-2 py-2"
          />
        </label>
        {target ? (
          <p className="text-xs text-muted-foreground">
            {t('customFaceEditor.groupDialogs.maxFrames', { max: target.maxFrames })}
            {frameCount > target.maxFrames
              ? t('customFaceEditor.groupDialogs.trimFrames', {
                  count: frameCount - target.maxFrames,
                })
              : t('customFaceEditor.groupDialogs.keepFrames')}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            className="border border-border px-3 py-2"
            disabled={busy}
            onClick={onCancel}
          >
            {t('customFaceEditor.groupDialogs.cancel')}
          </button>
          <button
            type="button"
            className="border border-primary bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
            disabled={
              busy || !profileId || !name.trim() || (profileId === 'custom' && !customValid)
            }
            onClick={() => onConfirm(resolvedProfileId, name.trim())}
          >
            {busy
              ? t('customFaceEditor.groupDialogs.creating')
              : t('customFaceEditor.groupDialogs.create')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RenameGroupDialog({
  group,
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  group: CustomFaceGroupSummary | null;
  open: boolean;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const t = useI18n();
  const [name, setName] = useState('');
  useEffect(() => setName(group?.name ?? ''), [group]);
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('customFaceEditor.groupDialogs.renameTitle')}</DialogTitle>
          <DialogDescription>
            {t('customFaceEditor.groupDialogs.renameDescription')}
          </DialogDescription>
        </DialogHeader>
        <input
          aria-label={t('customFaceEditor.groupDialogs.groupName')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border border-border bg-background px-2 py-2"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <button
            type="button"
            className="border border-border px-3 py-2"
            disabled={busy}
            onClick={onCancel}
          >
            {t('customFaceEditor.groupDialogs.cancel')}
          </button>
          <button
            type="button"
            className="border border-primary bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
            disabled={busy || !name.trim()}
            onClick={() => onConfirm(name.trim())}
          >
            {busy
              ? t('customFaceEditor.groupDialogs.saving')
              : t('customFaceEditor.groupDialogs.confirmRename')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteGroupDialog({
  group,
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  group: CustomFaceGroupSummary | null;
  open: boolean;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useI18n();
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('customFaceEditor.groupDialogs.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {group
              ? t('customFaceEditor.groupDialogs.deleteDescription', {
                  name: group.name,
                  profile: profileLabel(group.displayProfileId),
                  count: group.faceCount,
                })
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {t('customFaceEditor.groupDialogs.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            {busy
              ? t('customFaceEditor.groupDialogs.deleting')
              : t('customFaceEditor.groupDialogs.confirmDelete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function profileLabel(id: string) {
  const profile = CUSTOM_FACE_CONTRACT.profiles.find((item) => item.id === id);
  return profile ? `${profile.width} × ${profile.height}` : id;
}
