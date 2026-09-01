import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/i18n';

type Props = {
  open: boolean;
  width: number;
  height: number;
  onCancel: () => void;
  onConfirm: (scale: number) => void;
};

const SCALES = [1, 2, 3, 4];

export function CustomFaceGifExportDialog({ open, width, height, onCancel, onConfirm }: Props) {
  const t = useI18n();
  const [scale, setScale] = useState(1);
  const output = useMemo(() => ({ width: width * scale, height: height * scale }), [height, scale, width]);

  return <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('customFaceEditor.faceExport.dialog.title')}</DialogTitle>
        <DialogDescription>{t('customFaceEditor.faceExport.dialog.description')}</DialogDescription>
      </DialogHeader>
      <label className="block text-sm">
        {t('customFaceEditor.faceExport.dialog.scale')}
        <Select value={String(scale)} onValueChange={(value) => setScale(Number(value))}>
          <SelectTrigger aria-label={t('customFaceEditor.faceExport.dialog.scale')} className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCALES.map((value) => <SelectItem key={value} value={String(value)}>{t('customFaceEditor.faceExport.dialog.scaleValue', { scale: value })}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t('customFaceEditor.faceExport.dialog.sourceSize')}</dt>
        <dd>{width} × {height}</dd>
        <dt className="text-muted-foreground">{t('customFaceEditor.faceExport.dialog.outputSize')}</dt>
        <dd>{output.width} × {output.height}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">{t('customFaceEditor.faceExport.dialog.limit')}</p>
      <DialogFooter>
        <button type="button" className="border border-border px-3 py-2" onClick={onCancel}>{t('common.cancel')}</button>
        <button type="button" className="border border-primary bg-primary px-3 py-2 text-primary-foreground" onClick={() => onConfirm(scale)}>{t('customFaceEditor.faceExport.dialog.confirm')}</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
