import { NoticeProfile } from '@/api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import { DeviceSelectOption } from '../deviceChannelOptions';
import { HardwareRuleDetailDialog } from '../HardwareRuleDetailDialog';
import { LinkWorkflowViewModel } from './types';
import { useOutputRuleInspectorController } from './useOutputRuleInspectorController';

type OutputRuleInspectorProps = {
  viewModel: LinkWorkflowViewModel;
  profile: NoticeProfile;
  deviceOptions: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  onOpenOutputRules?: () => void;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function OutputRuleInspector({
  viewModel,
  profile,
  deviceOptions,
  desktopNoticeInstances = [],
  onOpenOutputRules,
  onSaveProfile
}: OutputRuleInspectorProps) {
  const t = useI18n();
  const controller = useOutputRuleInspectorController({
    viewModel,
    profile,
    t,
    onSaveProfile
  });

  return (
    <aside className="rounded-xl border bg-background p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t('rules.linkWorkflow.canvas.outputOverviewTitle')}</h3>
        {onOpenOutputRules && (
          <Button type="button" variant="default" size="sm" onClick={onOpenOutputRules}>
            {t('rules.linkWorkflow.inspector.openOutputRules')}
          </Button>
        )}
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('rules.linkWorkflow.inspector.outputRulesDescription')}
        </p>

        {controller.internalEvents.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            {t('rules.linkWorkflow.inspector.noOutputInternalEvents')}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t('rules.linkWorkflow.inspector.internalEvent')}
              </p>
              <div className="flex flex-wrap gap-2">
                {controller.internalEvents.map((event) => (
                  <Button
                    key={event.id}
                    type="button"
                    size="sm"
                    variant={controller.selectedEvent === event.id ? 'default' : 'outline'}
                    onClick={() => controller.setSelectedInternalEvent(event.id)}
                  >
                    {event.id}
                  </Button>
                ))}
              </div>
            </div>

            {controller.outputLimitMessage && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <AlertDescription>{controller.outputLimitMessage}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-3 gap-2">
              <OutputStat
                value={controller.summaries.length}
                label={t('rules.linkWorkflow.inspector.outputStats.total')}
              />
              <OutputStat
                value={controller.enabledCount}
                label={t('rules.linkWorkflow.inspector.outputStats.enabled')}
              />
              <OutputStat
                value={controller.needsConfigCount}
                label={t('rules.linkWorkflow.inspector.outputStats.needsConfig')}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t('rules.linkWorkflow.inspector.outputItems')}
              </p>
              {controller.summaries.map((summary) => {
                const currentRule = profile.hardwareRules.find(
                  (rule) => rule.id === summary.ruleId
                );
                return (
                  <div
                    key={summary.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{t(summary.labelKey)}</p>
                        <Badge
                          variant={summary.status === 'needs-config' ? 'destructive' : 'secondary'}
                        >
                          {t(`rules.linkWorkflow.outputStatus.${summary.status}`)}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {summary.summary || t(summary.descriptionKey)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {summary.action === 'edit' && (
                        <Switch
                          checked={Boolean(currentRule?.enabled)}
                          aria-label={t(
                            currentRule?.enabled
                              ? 'rules.linkWorkflow.inspector.disableOutput'
                              : 'rules.linkWorkflow.inspector.enableOutput',
                            { type: summary.outputType }
                          )}
                          onCheckedChange={(checked) => controller.toggleRule(summary, checked)}
                        />
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => controller.editSummary(summary)}
                        aria-label={
                          summary.action === 'edit'
                            ? t('rules.linkWorkflow.inspector.editOutput', {
                                type: summary.outputType
                              })
                            : t('rules.linkWorkflow.inspector.addAndConfigureOutput', {
                                type: summary.outputType
                              })
                        }
                      >
                        {summary.action === 'edit'
                          ? t('rules.linkWorkflow.inspector.edit')
                          : t('rules.linkWorkflow.inspector.addAndConfigure')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {controller.editingRule && (
          <HardwareRuleDetailDialog
            rule={controller.editingRule}
            deviceOptions={deviceOptions}
            desktopNoticeInstances={desktopNoticeInstances}
            open={true}
            onCancel={() => controller.setEditingRule(null)}
            onSave={controller.saveRule}
          />
        )}

        {controller.draftAddingRule && (
          <HardwareRuleDetailDialog
            rule={controller.draftAddingRule}
            deviceOptions={deviceOptions}
            desktopNoticeInstances={desktopNoticeInstances}
            open={true}
            onCancel={() => controller.setDraftAddingRule(null)}
            onSave={controller.saveNewRule}
          />
        )}
      </div>
    </aside>
  );
}

function OutputStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <p className="text-base font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
