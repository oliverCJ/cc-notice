import { AlertTriangle } from 'lucide-react';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LocalHookServerStatusView } from '@/state/appStore';
import { useI18n } from '@/i18n';

type RuntimeHealthAlertsProps = {
  snapshot: RuntimeMonitorSnapshot | null;
  hookServerStatus: LocalHookServerStatusView;
  error?: string | null;
};

export function RuntimeHealthAlerts({
  snapshot,
  hookServerStatus,
  error
}: RuntimeHealthAlertsProps) {
  const t = useI18n();
  const hasSystemNotificationOutput = (snapshot?.outputAttemptsByType ?? []).some(
    (item) => item.key === 'system-notification' && item.count > 0
  );
  const messages = [
    ...(error ? [t('monitor.health.snapshotFailed', { error })] : []),
    ...(!hookServerStatus.running ? [t('monitor.health.hookStopped')] : []),
    ...((snapshot?.runtimeErrorCount ?? 0) > 0
      ? [t('monitor.health.runtimeErrors', { count: snapshot?.runtimeErrorCount ?? 0 })]
      : []),
    ...(hasSystemNotificationOutput
      ? [t('monitor.health.notificationFocus')]
      : [])
  ];

  if (messages.length === 0) {
    return null;
  }

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
      <AlertDescription>
        <div className="space-y-1">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      </AlertDescription>
    </Alert>
  );
}
