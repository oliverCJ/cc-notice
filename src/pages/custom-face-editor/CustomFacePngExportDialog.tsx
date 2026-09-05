import { useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/i18n';

type Props = {
  open: boolean;
  width: number;
  height: number;
  onCancel: () => void;
  onConfirm: (options: { scale: number; invert: boolean; transparentBackground: boolean }) => void;
};

const SCALES = [1, 2, 3, 4, 5, 6, 7, 8];

export function CustomFacePngExportDialog({ open, width, height, onCancel, onConfirm }: Props) {
  const t = useI18n();
  const [scale, setScale] = useState(1);
  const [invert, setInvert] = useState(false);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const output = useMemo(
    () => ({ width: width * scale, height: height * scale }),
    [height, scale, width]
  );

  const handleConfirm = () => {
    onConfirm({ scale, invert, transparentBackground });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('customFaceEditor.faceExport.pngDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('customFaceEditor.faceExport.pngDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm">
          {t('customFaceEditor.faceExport.pngDialog.scale')}
          <Select value={String(scale)} onValueChange={(value) => setScale(Number(value))}>
            <SelectTrigger
              aria-label={t('customFaceEditor.faceExport.pngDialog.scale')}
              className="mt-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {t('customFaceEditor.faceExport.pngDialog.scaleValue', { scale: value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <Checkbox checked={invert} onCheckedChange={(checked) => setInvert(checked === true)} />
            <span className="text-sm">{t('customFaceEditor.faceExport.pngDialog.invert')}</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={transparentBackground}
              onCheckedChange={(checked) => setTransparentBackground(checked === true)}
            />
            <span className="text-sm">
              {t('customFaceEditor.faceExport.pngDialog.transparentBackground')}
            </span>
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">
            {t('customFaceEditor.faceExport.pngDialog.sourceSize')}
          </dt>
          <dd>
            {width} × {height}
          </dd>
          <dt className="text-muted-foreground">
            {t('customFaceEditor.faceExport.pngDialog.outputSize')}
          </dt>
          <dd>
            {output.width} × {output.height}
          </dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          {t('customFaceEditor.faceExport.pngDialog.limit')}
        </p>
        <DialogFooter>
          <button type="button" className="border border-border px-3 py-2" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="border border-primary bg-primary px-3 py-2 text-primary-foreground"
            onClick={handleConfirm}
          >
            {t('customFaceEditor.faceExport.pngDialog.confirm')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
