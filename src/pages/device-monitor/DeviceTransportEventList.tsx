import { useCallback, useEffect, useRef } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Pause, Play } from 'lucide-react';
import { DeviceTransportMonitorEvent } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import {
  monitorCategoryLabelKey,
  monitorDirectionLabelKey,
  monitorStatusLabelKey
} from './deviceTransportMonitorText';

type DeviceTransportEventListProps = {
  events: DeviceTransportMonitorEvent[];
  followLatest: boolean;
  selectedEventId: string | null;
  onFollowLatestChange: (followLatest: boolean) => void;
  onSelectEvent: (eventId: string) => void;
};

export function DeviceTransportEventList({
  events,
  followLatest,
  selectedEventId,
  onFollowLatestChange,
  onSelectEvent
}: DeviceTransportEventListProps) {
  const t = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    onFollowLatestChange(false);
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }, [onFollowLatestChange]);

  const scrollToLatest = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    onFollowLatestChange(true);
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  }, [onFollowLatestChange]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    onFollowLatestChange(distanceToBottom <= 24);
  }, [onFollowLatestChange]);

  useEffect(() => {
    if (!followLatest) {
      return;
    }
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight });
    });
  }, [events.length, followLatest]);

  if (events.length === 0) {
    return (
      <section className="relative min-h-0 min-w-0 overflow-hidden border-r">
        <div className="h-full overflow-y-auto p-6" ref={scrollRef}>
          <p className="text-sm text-muted-foreground">{t('devices.transportMonitor.empty')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-0 min-w-0 overflow-hidden border-r bg-muted/20">
      <div className="h-full overflow-y-auto pb-14" ref={scrollRef} onScroll={handleScroll}>
        <div className="divide-y">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`grid w-full min-w-0 grid-cols-[92px_minmax(0,1fr)_92px] gap-3 border-l-4 px-3 py-2 text-left transition-colors hover:bg-primary/10 ${
                selectedEventId === event.id ? 'bg-primary/15 shadow-inner ring-1 ring-inset ring-primary/30' : 'bg-transparent'
              } ${directionBorderClass(event)}`}
              onClick={() => onSelectEvent(event.id)}
            >
              <div className="min-w-0">
                <Badge variant={event.status === 'error' || event.status === 'timeout' ? 'destructive' : 'outline'}>
                  {t(monitorDirectionLabelKey(event.direction))}
                </Badge>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                  {formatTime(event.timestamp)}
                </p>
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {event.commandType ?? event.control ?? t(monitorCategoryLabelKey(event.category))}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {event.channelId ?? event.errorCode ?? ''}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{event.summary}</p>
              </div>
              <div className="min-w-0 text-right">
                <Badge variant={event.status === 'error' || event.status === 'timeout' ? 'destructive' : 'secondary'}>
                  {t(monitorStatusLabelKey(event.status))}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 z-10 flex w-fit items-center gap-1 rounded-md border bg-card/95 p-1 shadow-lg backdrop-blur">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={scrollToTop}
        >
          <ArrowUpToLine className="mr-1 h-3.5 w-3.5" />
          {t('devices.transportMonitor.jumpTop')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs"
          onClick={scrollToLatest}
        >
          <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
          {t('devices.transportMonitor.jumpLatest')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={followLatest ? 'secondary' : 'outline'}
          className="h-8 px-2 text-xs"
          onClick={() => onFollowLatestChange(!followLatest)}
        >
          {followLatest ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
          {followLatest
            ? t('devices.transportMonitor.stopFollow')
            : t('devices.transportMonitor.followScroll')}
        </Button>
      </div>
    </section>
  );
}

function directionBorderClass(event: DeviceTransportMonitorEvent) {
  if (event.status === 'error' || event.status === 'timeout') {
    return 'border-l-red-500';
  }
  if (event.direction === 'outbound') {
    return 'border-l-blue-500';
  }
  if (event.direction === 'inbound') {
    return 'border-l-emerald-500';
  }
  return 'border-l-muted-foreground/40';
}

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString();
}
