import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AiToolId, aiTools } from '../../../state/appStore';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';

type HookSetupStepProps = {
  selectedToolId: AiToolId;
  selectedToolName: string;
  onOpenHookSettings: () => void;
  onSelectTool: (toolId: AiToolId) => void;
};

export function HookSetupStep({
  selectedToolId,
  selectedToolName,
  onOpenHookSettings,
  onSelectTool
}: HookSetupStepProps) {
  const t = useI18n();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('setup.hookSetup.selectToolTitle')}</CardTitle>
          <CardDescription>{t('setup.hookSetup.selectToolDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 工具选择按钮 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {aiTools.map((tool) => {
              const isSelected = selectedToolId === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => onSelectTool(tool.id)}
                  className={cn(
                    'rounded-lg border-2 p-4 text-left transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/50'
                  )}
                >
                  <div className="font-semibold">{tool.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {tool.id === 'codex' ? 'OpenAI Codex' : 'Anthropic Claude Code'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 当前选择 */}
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">{t('setup.hookSetup.currentTool')}</span>
            <span className="ml-2 font-medium">{selectedToolName}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('setup.hookSetup.configureEventsTitle')}</CardTitle>
          <CardDescription>{t('setup.hookSetup.configureEventsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onOpenHookSettings} className="w-full">
            {t('setup.hookSetup.openHookSettings')}
          </Button>
          <p className="mt-2 text-xs text-center text-muted-foreground">
            {t('setup.hookSetup.openHookSettingsHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
