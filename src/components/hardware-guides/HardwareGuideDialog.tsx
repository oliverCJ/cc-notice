import { HardwareGuide } from '@/domain/hardwareGuides';
import { useI18n } from '@/i18n';
import { DeviceChannel } from '@/api/tauriApi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { getBoardHardwareGuideContent } from '@/domain/hardwareGuides/boardHardwareGuideContent';
import { BoardPinoutMap } from './BoardPinoutMap';

type HardwareGuideDialogProps = {
  guide: HardwareGuide | null;
  boardId?: string | null;
  channel?: DeviceChannel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HardwareGuideDialog({
  guide,
  boardId,
  channel,
  open,
  onOpenChange
}: HardwareGuideDialogProps) {
  const t = useI18n();
  const boardGuideContent = guide ? getBoardHardwareGuideContent(boardId, guide) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {guide ? t(guide.titleKey) : t('hardwareGuides.fallback.title')}
          </DialogTitle>
          <DialogDescription>
            {guide ? t(guide.summaryKey) : t('hardwareGuides.fallback.summary')}
          </DialogDescription>
        </DialogHeader>

        {guide ? (
          <div className="grid gap-4 md:grid-cols-2">
            <GuideSection
              title={t('hardwareGuides.sections.suitableHardware')}
              items={guide.suitableHardwareKeys.map((key) => t(key))}
            />
            <GuideSection
              title={t('hardwareGuides.sections.recommendedScenarios')}
              items={guide.recommendedScenarioKeys.map((key) => t(key))}
            />
            <GuideSection
              title={t('hardwareGuides.sections.wiring')}
              items={guide.wiringKeys.map((key) => t(key))}
            />
            <GuideSection
              title={t('hardwareGuides.sections.electricalSpecs')}
              items={boardGuideContent?.electricalSpecKeys.map((key) => t(key)) ?? []}
            />
            <GuideSection
              title={t('hardwareGuides.sections.electricalNotices')}
              items={boardGuideContent?.electricalNoticeKeys.map((key) => t(key)) ?? []}
            />
            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t('hardwareGuides.sections.actions')}</h3>
              <div className="flex flex-wrap gap-2">
                {guide.supportedActions.map((action) => (
                  <Badge key={action} variant="secondary">
                    {t(`devices.channelAction.${action}`)}
                  </Badge>
                ))}
              </div>
            </div>
            <GuideSection
              title={t('hardwareGuides.sections.testSteps')}
              items={guide.testStepKeys.map((key) => t(key))}
            />
            <GuideSection
              title={t('hardwareGuides.sections.faq')}
              items={guide.faqKeys.map((key) => t(key))}
              className="md:col-span-2"
            />
            <BoardPinoutMap boardId={boardId} channel={channel} />
          </div>
        ) : (
          <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            {t('hardwareGuides.fallback.detail')}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

type GuideSectionProps = {
  title: string;
  items: string[];
  className?: string;
};

function GuideSection({ title, items, className }: GuideSectionProps) {
  return (
    <section className={className}>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
