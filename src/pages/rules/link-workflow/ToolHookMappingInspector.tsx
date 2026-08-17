import { useState } from 'react';
import { NoticeProfile } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { buildAiMappingId, syncHardwareRulesToMappings } from '../ruleProfileUtils';
import { HookMappingDetailDialog } from './HookMappingDetailDialog';
import { LinkWorkflowHookSummary, LinkWorkflowViewModel } from './types';

type ToolHookMappingInspectorProps = {
  viewModel: LinkWorkflowViewModel;
  profile: NoticeProfile;
  source: string;
  onOpenAiMapping?: () => void;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function ToolHookMappingInspector({
  viewModel,
  profile,
  source,
  onOpenAiMapping,
  onSaveProfile
}: ToolHookMappingInspectorProps) {
  const t = useI18n();
  const toolNode = viewModel.toolNodes.find((node) => node.source === source);
  const [editingHook, setEditingHook] = useState<LinkWorkflowHookSummary | null>(null);

  function toggleMapping(hook: LinkWorkflowHookSummary, enabled: boolean) {
    const nextMappings = profile.aiEventMappings.map((mapping) =>
      mapping.source === hook.source && mapping.event === hook.event
        ? { ...mapping, enabled }
        : mapping
    );
    onSaveProfile({
      ...profile,
      aiEventMappings: nextMappings,
      hardwareRules: syncHardwareRulesToMappings(profile.hardwareRules, nextMappings)
    });
  }

  function saveHookMapping(hook: LinkWorkflowHookSummary, internalEvent: string) {
    const existingMapping = profile.aiEventMappings.find(
      (mapping) => mapping.source === hook.source && mapping.event === hook.event
    );
    const nextMapping = {
      id: buildAiMappingId(hook.source, hook.event, internalEvent),
      source: hook.source,
      event: hook.event,
      internalEvent,
      enabled: existingMapping?.enabled ?? true
    };
    const nextMappings = existingMapping
      ? profile.aiEventMappings.map((mapping) =>
          mapping.source === hook.source && mapping.event === hook.event ? nextMapping : mapping
        )
      : [...profile.aiEventMappings, nextMapping];

    onSaveProfile({
      ...profile,
      aiEventMappings: nextMappings,
      hardwareRules: syncHardwareRulesToMappings(profile.hardwareRules, nextMappings)
    });
    setEditingHook(null);
  }

  return (
    <aside className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-4 space-y-3">
        <h3 className="font-semibold">
          {toolNode?.title ?? source} {t('rules.linkWorkflow.inspector.hookMapping')}
        </h3>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="w-full justify-start"
          onClick={onOpenAiMapping}
        >
          {t('rules.linkWorkflow.inspector.editAiMapping')}
        </Button>
      </div>
      <div className="space-y-3">
        {toolNode?.hookEventSummaries.map((hook) => (
          <div key={`${hook.source}-${hook.event}`} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{hook.event}</p>
                {hook.title && (
                  <p className="truncate text-xs text-muted-foreground">{hook.title}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {hook.status !== 'unmapped' && (
                  <Badge
                    variant={hook.status === 'mapped' ? 'secondary' : 'outline'}
                    className={cn(
                      'max-w-[9rem] truncate',
                      hook.status === 'disabled' && 'text-muted-foreground'
                    )}
                  >
                    {hookStatusText(hook, t)}
                  </Badge>
                )}
                {hook.status !== 'unmapped' && (
                  <Switch
                    checked={hook.status === 'mapped'}
                    aria-label={t(
                      hook.status === 'mapped'
                        ? 'rules.linkWorkflow.inspector.disableHookMapping'
                        : 'rules.linkWorkflow.inspector.enableHookMapping',
                      { event: hook.event }
                    )}
                    onCheckedChange={(checked) => toggleMapping(hook, checked)}
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingHook(hook)}
                  aria-label={t(
                    hook.status === 'unmapped'
                      ? 'rules.linkWorkflow.inspector.configureHookMappingFor'
                      : 'rules.linkWorkflow.inspector.editHookMappingFor',
                    { event: hook.event }
                  )}
                >
                  {t(
                    hook.status === 'unmapped'
                      ? 'rules.linkWorkflow.inspector.configureMapping'
                      : 'rules.linkWorkflow.inspector.editMapping'
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingHook && (
        <HookMappingDetailDialog
          hook={editingHook}
          sourceTitle={toolNode?.title ?? source}
          internalEvents={viewModel.internalEvents}
          open={true}
          onCancel={() => setEditingHook(null)}
          onSave={(internalEvent) => saveHookMapping(editingHook, internalEvent)}
        />
      )}
    </aside>
  );
}

function hookStatusText(
  hook: LinkWorkflowHookSummary,
  t: ReturnType<typeof useI18n>
) {
  if (hook.status === 'mapped') {
    return hook.mappedInternalEvent ?? t('rules.linkWorkflow.inspector.mapped');
  }
  if (hook.status === 'disabled') {
    return t('rules.linkWorkflow.inspector.disabledMapping');
  }
  return t('rules.linkWorkflow.inspector.unmapped');
}
