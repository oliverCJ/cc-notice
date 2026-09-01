import { useEffect, useMemo, useState } from 'react';
import type { CustomFaceItemImportPreview } from '@/api/tauriApi';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/i18n';

type Props = {
  open: boolean;
  preview: CustomFaceItemImportPreview | null;
  maxFacesReached: boolean;
  duplicate: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
};

export function CustomFaceItemImportDialog({
  open,
  preview,
  maxFacesReached,
  duplicate,
  onCancel,
  onConfirm
}: Props) {
  const t = useI18n();
  const [name, setName] = useState('');
  useEffect(() => setName(preview?.face.name ?? ''), [preview]);
  const details = useMemo(() => preview ? t('customFaceEditor.faceImport.details', {
    width: preview.width,
    height: preview.height,
    frames: preview.frameCount,
    duration: preview.totalDurationMs
  }) : '', [preview, t]);
  const canConfirm = Boolean(preview && name.trim() && !maxFacesReached);

  return <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('customFaceEditor.faceImport.title')}</DialogTitle>
        <DialogDescription>{t('customFaceEditor.faceImport.description')}</DialogDescription>
      </DialogHeader>
      {preview ? <div className="space-y-2 text-sm">
        <p>{t('customFaceEditor.faceImport.source', { name: preview.face.name })}</p>
        <p className="text-muted-foreground">{details}</p>
        {duplicate ? <p className="text-sm text-amber-600 dark:text-amber-300">{t('customFaceEditor.faceImport.duplicate')}</p> : null}
        {maxFacesReached ? <p role="alert" className="text-sm text-destructive">{t('customFaceEditor.faceImport.capacityReached', { max: 15 })}</p> : null}
        <label className="block text-sm">
          {t('customFaceEditor.faceImport.name')}
          <input
            aria-label={t('customFaceEditor.faceImport.name')}
            className="mt-1 w-full border border-border bg-background px-2 py-2 text-foreground"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      </div> : null}
      <DialogFooter>
        <button type="button" className="border border-border px-3 py-2" onClick={onCancel}>{t('common.cancel')}</button>
        <button
          type="button"
          className="border border-primary bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          disabled={!canConfirm}
          onClick={() => onConfirm(name.trim())}
        >
          {t('customFaceEditor.faceImport.confirm')}
        </button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
