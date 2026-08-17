import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { NoticeProfile } from '../../../api/tauriApi';
import { useI18n } from '@/i18n';

type EventMappingStepProps = {
  profile: NoticeProfile | null;
  onOpenRulesPage: () => void;
};

export function EventMappingStep({ profile, onOpenRulesPage }: EventMappingStepProps) {
  const t = useI18n();
  const hasMappings = (profile?.aiEventMappings.length ?? 0) > 0;
  const mappingCount = profile?.aiEventMappings.length ?? 0;

  return (
    <div className="space-y-4">
      {/* 状态提示 */}
      <Alert variant={hasMappings ? 'default' : 'destructive'}>
        {hasMappings ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertDescription>
          {hasMappings
            ? t('setup.eventMapping.configured', { count: mappingCount })
            : t('setup.eventMapping.missing')}
        </AlertDescription>
      </Alert>

      {/* 映射说明 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('setup.eventMapping.title')}</CardTitle>
          <CardDescription>{t('setup.eventMapping.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 流程说明 */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">{t('setup.eventMapping.flowTitle')}</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>{t('setup.eventMapping.flowStep1')}</li>
              <li>{t('setup.eventMapping.flowStep2')}</li>
              <li>{t('setup.eventMapping.flowStep3')}</li>
            </ol>
          </div>

          {/* 当前映射预览 */}
          {hasMappings && profile && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('setup.eventMapping.currentRules')}</p>
              <div className="space-y-1.5">
                {profile.aiEventMappings.slice(0, 3).map((mapping) => (
                  <div
                    key={`${mapping.source}-${mapping.event}`}
                    className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {mapping.event}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className="font-mono text-xs">{mapping.internalEvent}</Badge>
                  </div>
                ))}
                {profile.aiEventMappings.length > 3 && (
                  <p className="text-xs text-muted-foreground pl-2">
                    {t('setup.eventMapping.moreRules', {
                      count: profile.aiEventMappings.length - 3
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <Button onClick={onOpenRulesPage} className="w-full">
            {hasMappings ? t('setup.eventMapping.viewRules') : t('setup.eventMapping.startRules')}
          </Button>

          {/* 提示信息 */}
          {!hasMappings && (
            <p className="text-xs text-muted-foreground text-center">
              {t('setup.eventMapping.hint')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
