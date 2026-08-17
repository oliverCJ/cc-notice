import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DebugLogEntryView } from '@/state/appStore';
import { formatJsonText } from './debugPayloadFormat';
import { useI18n } from '@/i18n';
import { DebugEventLifecycleSummary } from './DebugEventLifecycleSummary';
import { DebugEventLifecycleTimeline } from './DebugEventLifecycleTimeline';
import { buildDebugEventLifecycleViewModel } from './debugEventLifecycleViewModel';

type DebugEventDetailDialogProps = {
  entry: DebugLogEntryView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DebugEventDetailDialog({
  entry,
  open,
  onOpenChange
}: DebugEventDetailDialogProps) {
  const t = useI18n();
  const lifecycle = entry ? buildDebugEventLifecycleViewModel(entry) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('debug.detailTitle')}</DialogTitle>
          <DialogDescription>{t('debug.detailDescription')}</DialogDescription>
        </DialogHeader>
        {entry && lifecycle && (
          <div
            className="grid min-h-0 min-w-0 max-h-[calc(90vh-96px)] gap-3 overflow-y-auto overflow-x-hidden pr-2 text-sm"
            data-testid="debug-event-detail-body"
          >
            <DebugEventLifecycleSummary summary={lifecycle.summary} />
            <DebugEventLifecycleTimeline lifecycle={lifecycle} />
            {entry.error && (
              <DetailRow label={t('debug.detailError')} value={entry.error} danger />
            )}
            <PayloadSection label={t('debug.summaryPayload')} value={entry.payload} />
            {entry.rawPayload && (
              <PayloadSection label={t('debug.rawPayload')} value={entry.rawPayload} tall />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="grid gap-1 md:grid-cols-[140px_1fr]">
      <span className={danger ? 'text-destructive' : 'text-muted-foreground'}>{label}</span>
      <code className={danger ? 'break-all text-destructive' : 'break-all'}>{value}</code>
    </div>
  );
}

function PayloadSection({ label, value, tall }: { label: string; value: string; tall?: boolean }) {
  return (
    <div className="grid min-w-0 max-w-full gap-1">
      <span className="text-muted-foreground">{label}</span>
      <Textarea
        aria-label={label}
        className={`box-border w-full min-w-0 max-w-full resize-none overflow-auto break-all font-mono text-xs ${
          tall ? 'h-72' : 'h-40'
        }`}
        readOnly
        wrap="soft"
        value={formatJsonText(value)}
      />
    </div>
  );
}
