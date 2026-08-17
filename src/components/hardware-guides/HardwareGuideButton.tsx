import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeviceChannel } from '@/api/tauriApi';
import { getHardwareGuide } from '@/domain/hardwareGuides';
import { useI18n } from '@/i18n';
import { HardwareGuideDialog } from './HardwareGuideDialog';

type HardwareGuideButtonProps = {
  guideId?: string | null;
  boardId?: string | null;
  channelLabel: string;
  channel?: DeviceChannel | null;
  variant?: 'outline' | 'ghost';
};

export function HardwareGuideButton({
  guideId,
  boardId,
  channelLabel,
  channel,
  variant = 'ghost'
}: HardwareGuideButtonProps) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const guide = getHardwareGuide(guideId);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        aria-label={t('hardwareGuides.openForChannel', { channel: channelLabel })}
        onClick={() => setOpen(true)}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
        <span className="ml-1">{t('hardwareGuides.open')}</span>
      </Button>
      <HardwareGuideDialog
        guide={guide}
        boardId={boardId}
        channel={channel}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
