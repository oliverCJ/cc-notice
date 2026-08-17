import { DeviceTransportMonitorEvent } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import {
  monitorCategoryLabelKey,
  monitorDirectionLabelKey,
  monitorStatusLabelKey
} from './deviceTransportMonitorText';

type DeviceTransportEventDetailProps = {
  event: DeviceTransportMonitorEvent | null;
};

export function DeviceTransportEventDetail({ event }: DeviceTransportEventDetailProps) {
  const t = useI18n();

  if (!event) {
    return (
      <aside className="min-w-0 overflow-y-auto bg-card p-4">
        <p className="text-sm text-muted-foreground">{t('devices.transportMonitor.noSelection')}</p>
      </aside>
    );
  }

  return (
    <aside className="min-w-0 overflow-y-auto bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(monitorDirectionLabelKey(event.direction))}</Badge>
        <Badge variant="secondary">{t(monitorCategoryLabelKey(event.category))}</Badge>
        <Badge variant={event.status === 'error' || event.status === 'timeout' ? 'destructive' : 'outline'}>
          {t(monitorStatusLabelKey(event.status))}
        </Badge>
      </div>
      <h2 className="mt-4 break-words text-sm font-semibold">{event.summary}</h2>
      <dl className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
        <DetailRow label={t('devices.transportMonitor.detail.id')} value={event.id} />
        <DetailRow label={t('devices.transportMonitor.detail.time')} value={event.timestamp} />
        <DetailRow label={t('devices.transportMonitor.detail.device')} value={event.deviceId} />
        <DetailRow label={t('devices.transportMonitor.detail.board')} value={event.boardId ?? '-'} />
        <DetailRow
          label={t('devices.transportMonitor.detail.transport')}
          value={event.transportAddress ?? '-'}
        />
        <DetailRow
          label={t('devices.transportMonitor.detail.command')}
          value={event.commandType ?? '-'}
        />
        <DetailRow label={t('devices.transportMonitor.detail.channel')} value={event.channelId ?? '-'} />
        <DetailRow label={t('devices.transportMonitor.detail.control')} value={event.control ?? '-'} />
        <DetailRow label={t('devices.transportMonitor.detail.error')} value={event.errorCode ?? '-'} />
      </dl>
      <div className="mt-5">
        <p className="text-xs font-medium">{t('devices.transportMonitor.payload')}</p>
        <pre className="mt-2 max-h-[320px] overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
          {formatPayloadPreview(event.payloadPreview)}
        </pre>
      </div>
    </aside>
  );
}

function formatPayloadPreview(payload: string | null | undefined) {
  if (!payload) {
    return '-';
  }
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all font-mono">{value}</dd>
    </>
  );
}
