import { Activity, AlertTriangle, Bell, Clock, Radio, Send } from 'lucide-react';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LocalHookServerStatusView } from '@/state/appStore';
import { useI18n } from '@/i18n';
import { formatRuntimeOutputType } from './runtimeOutputLabels';

type RuntimeStatusOverviewProps = {
  snapshot: RuntimeMonitorSnapshot | null;
  hookServerStatus: LocalHookServerStatusView;
};

export function RuntimeStatusOverview({
  snapshot,
  hookServerStatus
}: RuntimeStatusOverviewProps) {
  const t = useI18n();
  const lastOutput = snapshot?.lastOutput
    ? `${formatRuntimeOutputType(snapshot.lastOutput.outputType, t)} / ${snapshot.lastOutput.result}`
    : '-';
  const cards = [
    {
      label: t('monitor.status.hookService'),
      value: hookServerStatus.running ? t('monitor.status.running') : t('monitor.status.abnormal'),
      icon: Radio,
      tone: hookServerStatus.running ? 'success' : 'warning'
    },
    { label: t('monitor.status.receivedEvents'), value: String(snapshot?.totalEvents ?? 0), icon: Activity, tone: 'info' },
    { label: t('monitor.status.outputAttempts'), value: String(snapshot?.totalOutputs ?? 0), icon: Bell, tone: 'accent' },
    { label: t('monitor.status.failures'), value: String(snapshot?.totalFailures ?? 0), icon: AlertTriangle, tone: 'danger' },
    { label: t('monitor.status.uptime'), value: formatUptime(snapshot?.uptimeSeconds ?? 0), icon: Clock, tone: 'neutral' },
    { label: t('monitor.status.lastEvent'), value: snapshot?.lastEvent?.event ?? '-', icon: Send, tone: 'neutral' },
    { label: t('monitor.status.lastOutput'), value: lastOutput, icon: Bell, tone: 'neutral' }
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className={toneClass(card.tone)}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <Badge variant="secondary" className="mt-1 max-w-full truncate">
                  {card.value}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function toneClass(tone: string) {
  switch (tone) {
    case 'success':
      return 'border-l-4 border-l-emerald-500';
    case 'info':
      return 'border-l-4 border-l-blue-500';
    case 'accent':
      return 'border-l-4 border-l-violet-500';
    case 'danger':
      return 'border-l-4 border-l-red-500';
    case 'warning':
      return 'border-l-4 border-l-amber-500';
    default:
      return 'border-l-4 border-l-slate-400';
  }
}
