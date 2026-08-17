import { NoticeProfile } from '@/api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { DeviceSelectOption } from '../deviceChannelOptions';
import { InternalEventOverviewInspector } from './InternalEventOverviewInspector';
import { OutputRuleInspector } from './OutputRuleInspector';
import { ToolHookMappingInspector } from './ToolHookMappingInspector';
import { LinkWorkflowSelectedNode, LinkWorkflowViewModel } from './types';

type LinkWorkflowInspectorProps = {
  selectedNode: LinkWorkflowSelectedNode;
  viewModel: LinkWorkflowViewModel;
  profile: NoticeProfile;
  deviceOptions: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  onOpenAiMapping?: () => void;
  onOpenOutputRules?: () => void;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function LinkWorkflowInspector({
  selectedNode,
  viewModel,
  profile,
  deviceOptions,
  desktopNoticeInstances = [],
  onOpenAiMapping,
  onOpenOutputRules,
  onSaveProfile
}: LinkWorkflowInspectorProps) {
  if (selectedNode.kind === 'tool') {
    return (
      <ToolHookMappingInspector
        viewModel={viewModel}
        profile={profile}
        source={selectedNode.source}
        onOpenAiMapping={onOpenAiMapping}
        onSaveProfile={onSaveProfile}
      />
    );
  }
  if (selectedNode.kind === 'internal-events') {
    return <InternalEventOverviewInspector viewModel={viewModel} />;
  }
  return (
    <OutputRuleInspector
      viewModel={viewModel}
      profile={profile}
      deviceOptions={deviceOptions}
      desktopNoticeInstances={desktopNoticeInstances}
      onOpenOutputRules={onOpenOutputRules}
      onSaveProfile={onSaveProfile}
    />
  );
}
