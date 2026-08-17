import { useState } from 'react';
import { NoticeProfile } from '@/api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
import { DeviceSelectOption } from '../deviceChannelOptions';
import { LinkWorkflowInspector } from './LinkWorkflowInspector';
import { LinkWorkflowSelectedNode, LinkWorkflowViewModel } from './types';
import { WorkflowJoinLines } from './WorkflowJoinLines';
import { WorkflowOverviewNode } from './WorkflowOverviewNode';
import { WorkflowToolNode } from './WorkflowToolNode';

type LinkWorkflowCanvasProps = {
  profile: NoticeProfile;
  viewModel: LinkWorkflowViewModel;
  deviceOptions: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  onOpenHookSettings: () => void;
  onOpenAiMapping?: () => void;
  onOpenOutputRules?: () => void;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function LinkWorkflowCanvas({
  profile,
  viewModel,
  deviceOptions,
  desktopNoticeInstances = [],
  onSaveProfile,
  onOpenHookSettings,
  onOpenAiMapping,
  onOpenOutputRules
}: LinkWorkflowCanvasProps) {
  const t = useI18n();
  const [selectedNode, setSelectedNode] = useState<LinkWorkflowSelectedNode | null>(null);
  const internalEventBadges = viewModel.internalEventOverview.events.map((event) => event.id);
  const outputBadges = viewModel.outputOverview.outputTypes;

  function selected(kind: LinkWorkflowSelectedNode['kind'], source?: string) {
    if (!selectedNode) {
      return false;
    }
    if (kind === 'tool') {
      return selectedNode.kind === 'tool' && selectedNode.source === source;
    }
    return selectedNode.kind === kind;
  }

  function openNode(node: LinkWorkflowSelectedNode) {
    setSelectedNode(node);
  }

  function openOutputRules() {
    setSelectedNode(null);
    onOpenOutputRules?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('rules.linkWorkflow.title')}</CardTitle>
        <CardDescription>{t('rules.linkWorkflow.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {viewModel.blockedReason === 'no-enabled-hook-events' ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-4">
            <p className="text-sm font-medium">{t('rules.linkWorkflow.noEnabledHookEvents')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('rules.linkWorkflow.noEnabledHookEventsHint')}
            </p>
            <Button className="mt-3" variant="outline" onClick={onOpenHookSettings}>
              {t('rules.linkWorkflow.openHookSettings')}
            </Button>
          </div>
        ) : (
          <>
            <div
              data-testid="workflow-canvas-surface"
              className="overflow-hidden rounded-xl border bg-muted/20 p-4"
            >
              <div className="overflow-x-auto pb-1">
                <div className="mx-auto grid min-h-64 min-w-[760px] max-w-4xl grid-cols-[190px_76px_190px_76px_190px] items-center gap-3">
                  <div className="flex min-h-56 flex-col justify-center gap-3">
                    {viewModel.toolNodes.map((node) => (
                      <WorkflowToolNode
                        key={node.id}
                        node={node}
                        selected={selected('tool', node.source)}
                        onSelect={(source) => openNode({ kind: 'tool', source })}
                      />
                    ))}
                  </div>

                  <WorkflowJoinLines toolCount={viewModel.toolNodes.length} />

                  <WorkflowOverviewNode
                    titleKey="rules.linkWorkflow.canvas.internalOverviewTitle"
                    descriptionKey="rules.linkWorkflow.canvas.internalOverviewDescription"
                    status={viewModel.internalEventOverview.status}
                    badges={internalEventBadges}
                    selected={selected('internal-events')}
                    onSelect={() => openNode({ kind: 'internal-events' })}
                  />

                  <WorkflowJoinLines variant="single" />

                  <WorkflowOverviewNode
                    titleKey="rules.linkWorkflow.canvas.outputOverviewTitle"
                    descriptionKey="rules.linkWorkflow.canvas.outputOverviewDescription"
                    status={viewModel.outputOverview.status}
                    badges={outputBadges}
                    selected={selected('output-rules')}
                    onSelect={() => openNode({ kind: 'output-rules' })}
                  />
                </div>
              </div>
            </div>

            <Dialog open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNode(null)}>
              {selectedNode && (
                <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{dialogTitle(selectedNode, viewModel, t)}</DialogTitle>
                    <DialogDescription>
                      {dialogDescription(selectedNode, t)}
                    </DialogDescription>
                  </DialogHeader>
                  <LinkWorkflowInspector
                    selectedNode={selectedNode}
                    viewModel={viewModel}
                    profile={profile}
                    deviceOptions={deviceOptions}
                    desktopNoticeInstances={desktopNoticeInstances}
                    onOpenAiMapping={onOpenAiMapping}
                    onOpenOutputRules={onOpenOutputRules ? openOutputRules : undefined}
                    onSaveProfile={onSaveProfile}
                  />
                </DialogContent>
              )}
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function dialogTitle(
  selectedNode: LinkWorkflowSelectedNode,
  viewModel: LinkWorkflowViewModel,
  t: ReturnType<typeof useI18n>
) {
  if (selectedNode.kind === 'tool') {
    const toolNode = viewModel.toolNodes.find((node) => node.source === selectedNode.source);
    return `${toolNode?.title ?? selectedNode.source} ${t('rules.linkWorkflow.inspector.hookMapping')}`;
  }
  if (selectedNode.kind === 'internal-events') {
    return t('rules.linkWorkflow.inspector.internalReferences');
  }
  return t('rules.linkWorkflow.canvas.outputOverviewTitle');
}

function dialogDescription(
  selectedNode: LinkWorkflowSelectedNode,
  t: ReturnType<typeof useI18n>
) {
  if (selectedNode.kind === 'tool') {
    return t('rules.linkWorkflow.inspector.toolDialogDescription');
  }
  if (selectedNode.kind === 'internal-events') {
    return t('rules.linkWorkflow.inspector.internalDialogDescription');
  }
  return t('rules.linkWorkflow.inspector.outputDialogDescription');
}
