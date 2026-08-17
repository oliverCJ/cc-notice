import { useState } from 'react';
import {
  AiEventMapping,
  HardwareRule,
  HookEventDefinition,
  InternalEventDefinition
} from '../../api/tauriApi';
import { AiToolId, aiTools } from '../../state/appStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  buildAiMappingId,
  createAiMappingIfAvailable,
  syncHardwareRulesToMappings
} from './ruleProfileUtils';
import { AiMappingCreateDialog } from './AiMappingCreateDialog';
import { useI18n } from '@/i18n';
import { internalEventTitle } from './internalEventText';

type AiEventMappingPanelProps = {
  mappings: AiEventMapping[];
  hardwareRules: HardwareRule[];
  enabledHookEvents: Array<{ source: string; event: string }>;
  hookCatalog: HookEventDefinition[];
  internalEvents: InternalEventDefinition[];
  onChange: (next: {
    aiEventMappings: AiEventMapping[];
    hardwareRules: HardwareRule[];
  }) => void;
};

export function AiEventMappingPanel({
  mappings,
  hardwareRules,
  enabledHookEvents,
  hookCatalog,
  internalEvents,
  onChange
}: AiEventMappingPanelProps) {
  const t = useI18n();
  const [selectedSource, setSelectedSource] = useState<AiToolId>('codex');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const visibleMappings = mappings.filter((mapping) => mapping.source === selectedSource);

  // 检查是否存在未启用 Hook 事件的映射
  const unconfiguredMappings = visibleMappings.filter((mapping) => {
    const isEnabled = enabledHookEvents.some(
      (hook) => hook.source === mapping.source && hook.event === mapping.event
    );
    return !isEnabled;
  });

  function saveMapping(mapping: AiEventMapping) {
    const nextMappings = mappings.map((item) => (item.id === mapping.id ? mapping : item));
    onChange({
      aiEventMappings: nextMappings,
      hardwareRules: syncHardwareRulesToMappings(hardwareRules, nextMappings)
    });
  }

  function addMapping(hookEvent: HookEventDefinition, internalEvent: string) {
    const mapping = createAiMappingIfAvailable(mappings, hookEvent, internalEvent, internalEvents);
    if (!mapping) {
      return;
    }
    const nextMappings = [...mappings, mapping];
    onChange({
      aiEventMappings: nextMappings,
      hardwareRules: syncHardwareRulesToMappings(hardwareRules, nextMappings)
    });
    setCreateDialogOpen(false);
  }

  function removeMapping(mappingId: string) {
    const nextMappings = mappings.filter((mapping) => mapping.id !== mappingId);
    onChange({
      aiEventMappings: nextMappings,
      hardwareRules: syncHardwareRulesToMappings(hardwareRules, nextMappings)
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('rules.aiMapping.title')}</CardTitle>
            <CardDescription className="mt-1.5">
              {t('rules.aiMapping.description')}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('rules.aiMapping.add')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI 工具切换 */}
        <Tabs value={selectedSource} onValueChange={(val) => setSelectedSource(val as AiToolId)}>
          <TabsList>
            {aiTools.map((tool) => (
              <TabsTrigger key={tool.id} value={tool.id}>
                {tool.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* 未启用 Hook 事件警告 */}
        {unconfiguredMappings.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('rules.aiMapping.warning', { count: unconfiguredMappings.length })}
              <div className="mt-2 flex flex-wrap gap-2">
                {unconfiguredMappings.map((mapping) => (
                  <code
                    key={mapping.id}
                    className="rounded bg-muted px-2 py-1 font-mono text-xs font-semibold"
                  >
                    {mapping.event}
                  </code>
                ))}
              </div>
              <p className="mt-2 text-sm">
                {t('rules.aiMapping.warningHint')}
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* 映射列表 */}
        {visibleMappings.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">{t('rules.aiMapping.empty')}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('rules.aiMapping.createFirst')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleMappings.map((mapping) => {
              const internalEventInfo = internalEvents.find((e) => e.id === mapping.internalEvent);
              const isHookEnabled = enabledHookEvents.some(
                (hook) => hook.source === mapping.source && hook.event === mapping.event
              );
              return (
                <div
                  key={mapping.id}
                  className={`grid gap-4 rounded-lg border border-border/80 border-l-4 bg-background p-4 shadow-sm lg:grid-cols-[1fr_1fr_auto_auto] lg:items-center ${mappingAccentClass(mapping)}`}
                  data-testid={`ai-mapping-row-${mapping.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t('rules.aiMapping.hookEvent')}
                      </p>
                      {!isHookEnabled && (
                        <Badge variant="outline" className="text-xs text-orange-600">
                          {t('rules.aiMapping.notEnabled')}
                        </Badge>
                      )}
                    </div>
                    <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm font-semibold">
                      {mapping.event}
                    </code>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t('rules.aiMapping.internalEvent')}
                    </p>
                    <div className="space-y-1">
                      <Badge variant="secondary" className="font-mono">
                        {mapping.internalEvent}
                      </Badge>
                      {internalEventInfo && (
                        <p className="text-xs text-muted-foreground">
                          {internalEventTitle(internalEventInfo, t)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center space-x-2 lg:justify-start">
                    <Switch
                      id={`enabled-${mapping.id}`}
                      checked={mapping.enabled}
                      onCheckedChange={(checked) => saveMapping({ ...mapping, enabled: checked })}
                    />
                    <Label htmlFor={`enabled-${mapping.id}`}>{t('rules.aiMapping.enabled')}</Label>
                  </div>
                  <div className="flex items-center justify-center lg:justify-start">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeMapping(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* 创建对话框 */}
      {createDialogOpen && (
        <AiMappingCreateDialog
          source={selectedSource}
          mappings={mappings}
          enabledHookEvents={enabledHookEvents}
          hookCatalog={hookCatalog}
          internalEvents={internalEvents}
          onCancel={() => setCreateDialogOpen(false)}
          onCreate={addMapping}
        />
      )}
    </Card>
  );
}

function mappingAccentClass(mapping: AiEventMapping) {
  if (!mapping.enabled) {
    return 'border-l-zinc-400';
  }
  return hookEventAccentClass(mapping.event);
}

function hookEventAccentClass(event: string) {
  if (event === 'UserPromptSubmit') {
    return 'border-l-sky-400';
  }
  if (event === 'SessionStart') {
    return 'border-l-cyan-400';
  }
  if (event === 'Stop' || event === 'StopFailure') {
    return 'border-l-emerald-400';
  }
  if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure') {
    return 'border-l-violet-400';
  }
  if (event === 'Notification') {
    return 'border-l-orange-400';
  }
  return 'border-l-rose-400';
}
