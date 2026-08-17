import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle } from 'lucide-react';
import { LocalHookServerStatusView } from '../../../state/appStore';
import { useI18n } from '@/i18n';

type HookServiceStepProps = {
  hookServerStatus: LocalHookServerStatusView;
  onOpenDebug: () => void;
};

export function HookServiceStep({ hookServerStatus, onOpenDebug }: HookServiceStepProps) {
  const t = useI18n();
  const isRunning = hookServerStatus.running;

  return (
    <div className="space-y-4">
      {/* 状态提示 */}
      <Alert variant={isRunning ? 'default' : 'destructive'}>
        {isRunning ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertDescription>
          {isRunning
            ? t('setup.hookService.runningMessage')
            : t('setup.hookService.stoppedMessage')}
        </AlertDescription>
      </Alert>

      {/* 服务详情 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('setup.hookService.title')}</CardTitle>
            <Badge variant={isRunning ? 'default' : 'secondary'}>
              {isRunning ? t('setup.hookService.running') : t('setup.hookService.stopped')}
            </Badge>
          </div>
          <CardDescription>{t('setup.hookService.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 服务地址 */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('setup.hookService.eventUrl')}</span>
              <code className="rounded bg-background px-2 py-1 text-xs font-mono">
                {hookServerStatus.eventUrl}
              </code>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('setup.hookService.healthUrl')}</span>
              <code className="rounded bg-background px-2 py-1 text-xs font-mono">
                {hookServerStatus.healthUrl}
              </code>
            </div>
          </div>

          {/* 错误信息 */}
          {hookServerStatus.error && (
            <Alert variant="destructive">
              <AlertDescription>{hookServerStatus.error}</AlertDescription>
            </Alert>
          )}

          {/* 操作按钮 */}
          <Button variant="outline" onClick={onOpenDebug} className="w-full">
            {t('setup.hookService.openDebug')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
