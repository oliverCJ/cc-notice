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
  frameCount: number;
  onCancel: () => void;
  onConfirm: (options: {
    scale: number;
    invert: boolean;
    transparentBackground: boolean;
    frameIndices: number[];
  }) => void;
};

const SCALES = [1, 2, 3, 4, 5, 6, 7, 8];

export function CustomFaceGifExportDialog({
  open,
  width,
  height,
  frameCount,
  onCancel,
  onConfirm,
}: Props) {
  const t = useI18n();
  const [scale, setScale] = useState(1);
  const [invert, setInvert] = useState(false);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [frameSelection, setFrameSelection] = useState<'all' | 'custom'>('all');
  const [selectedFrames, setSelectedFrames] = useState<Set<number>>(new Set());
  const output = useMemo(
    () => ({ width: width * scale, height: height * scale }),
    [height, scale, width]
  );

  const handleFrameToggle = (index: number) => {
    const next = new Set(selectedFrames);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedFrames(next);
  };

  const handleSelectAll = () => {
    setSelectedFrames(new Set(Array.from({ length: frameCount }, (_, i) => i)));
  };

  const handleDeselectAll = () => {
    setSelectedFrames(new Set());
  };

  const handleConfirm = () => {
    const frameIndices =
      frameSelection === 'all' ? [] : Array.from(selectedFrames).sort((a, b) => a - b);
    onConfirm({ scale, invert, transparentBackground, frameIndices });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('customFaceEditor.faceExport.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('customFaceEditor.faceExport.dialog.description')}
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm">
          {t('customFaceEditor.faceExport.dialog.scale')}
          <Select value={String(scale)} onValueChange={(value) => setScale(Number(value))}>
            <SelectTrigger
              aria-label={t('customFaceEditor.faceExport.dialog.scale')}
              className="mt-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCALES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {t('customFaceEditor.faceExport.dialog.scaleValue', { scale: value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <Checkbox checked={invert} onCheckedChange={(checked) => setInvert(checked === true)} />
            <span className="text-sm">{t('customFaceEditor.faceExport.dialog.invert')}</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={transparentBackground}
              onCheckedChange={(checked) => setTransparentBackground(checked === true)}
            />
            <span className="text-sm">
              {t('customFaceEditor.faceExport.dialog.transparentBackground')}
            </span>
          </label>
        </div>
        {frameCount > 1 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              {t('customFaceEditor.faceExport.dialog.frames')}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={frameSelection === 'all'}
                  onChange={() => setFrameSelection('all')}
                />
                <span className="text-sm">{t('customFaceEditor.faceExport.dialog.allFrames')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={frameSelection === 'custom'}
                  onChange={() => setFrameSelection('custom')}
                />
                <span className="text-sm">
                  {t('customFaceEditor.faceExport.dialog.customFrames')}
                </span>
              </label>
              {frameSelection === 'custom' && (
                <div className="ml-6 space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="border border-border px-2 py-1 text-xs"
                      onClick={handleSelectAll}
                    >
                      {t('customFaceEditor.faceExport.dialog.selectAll')}
                    </button>
                    <button
                      type="button"
                      className="border border-border px-2 py-1 text-xs"
                      onClick={handleDeselectAll}
                    >
                      {t('customFaceEditor.faceExport.dialog.deselectAll')}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded border border-border p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: frameCount }, (_, i) => (
                        <label key={i} className="flex items-center gap-1.5 text-sm">
                          <Checkbox
                            checked={selectedFrames.has(i)}
                            onCheckedChange={() => handleFrameToggle(i)}
                          />
                          <span>{i + 1}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('customFaceEditor.faceExport.dialog.selectedCount', {
                      count: selectedFrames.size,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">
            {t('customFaceEditor.faceExport.dialog.sourceSize')}
          </dt>
          <dd>
            {width} × {height}
          </dd>
          <dt className="text-muted-foreground">
            {t('customFaceEditor.faceExport.dialog.outputSize')}
          </dt>
          <dd>
            {output.width} × {output.height}
          </dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          {t('customFaceEditor.faceExport.dialog.limit')}
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
            {t('customFaceEditor.faceExport.dialog.confirm')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
