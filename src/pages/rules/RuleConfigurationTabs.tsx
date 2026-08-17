import {
  EnabledHookEvent,
  HookEventDefinition,
  InternalEventDefinition,
  NoticeProfile
} from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiEventMappingPanel } from './AiEventMappingPanel';
import { HardwareRulePanel } from './HardwareRulePanel';
import { useDeviceRuntimeRegistry } from '@/hooks/useDeviceRuntimeRegistry';
import { getBoardDeviceExtensions } from '@/domain/boards/boardCatalog';
import { toChannelSelectOption } from './deviceChannelOptions';
import { useI18n } from '@/i18n';
import {
  buildLinkWorkflowViewModel,
  LinkWorkflowCanvas
} from './link-workflow';

type RuleConfigurationTabsProps = {
  enabledHookEvents: EnabledHookEvent[];
  hookCatalog: HookEventDefinition[];
  internalEvents: InternalEventDefinition[];
  desktopNoticeInstances: DesktopNoticeInstance[];
  profile: NoticeProfile;
  onOpenHookSettings: () => void;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function RuleConfigurationTabs({
  enabledHookEvents,
  hookCatalog,
  internalEvents,
  desktopNoticeInstances,
  profile,
  onOpenHookSettings,
  onSaveProfile
}: RuleConfigurationTabsProps) {
  const t = useI18n();
  const deviceRegistry = useDeviceRuntimeRegistry();
  const [activeTab, setActiveTab] = useState('visual-workflow');

  useEffect(() => {
    deviceRegistry.refreshStates();
  }, [deviceRegistry.refreshStates]);

  const deviceOptions = deviceRegistry.states
    .filter((state) => Boolean(state.deviceId))
    .map((state) => ({
      value: state.deviceId ?? '',
      label: state.deviceId ?? '',
      boardId: state.boardId,
      deviceExtensions: state.boardId ? getBoardDeviceExtensions(state.boardId) : null,
      channels: state.channels.map((channel) => toChannelSelectOption(channel, state.boardId))
    }));
  const linkWorkflowViewModel = buildLinkWorkflowViewModel({
    profile,
    hookCatalog,
    enabledHookEvents,
    internalEvents,
    deviceOptions
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full max-w-2xl grid-cols-3">
        <TabsTrigger value="visual-workflow">{t('rules.tabs.visualWorkflow')}</TabsTrigger>
        <TabsTrigger value="ai-mapping">{t('rules.tabs.aiMapping')}</TabsTrigger>
        <TabsTrigger value="hardware-rules">{t('rules.tabs.outputRules')}</TabsTrigger>
      </TabsList>

      <TabsContent value="visual-workflow" className="space-y-6">
        <LinkWorkflowCanvas
          profile={profile}
          viewModel={linkWorkflowViewModel}
          deviceOptions={deviceOptions}
          desktopNoticeInstances={desktopNoticeInstances}
          onOpenHookSettings={onOpenHookSettings}
          onOpenAiMapping={() => setActiveTab('ai-mapping')}
          onOpenOutputRules={() => setActiveTab('hardware-rules')}
          onSaveProfile={onSaveProfile}
        />
      </TabsContent>

      <TabsContent value="ai-mapping" className="space-y-6">
        <AiEventMappingPanel
          enabledHookEvents={enabledHookEvents}
          hardwareRules={profile.hardwareRules}
          hookCatalog={hookCatalog}
          internalEvents={internalEvents}
          mappings={profile.aiEventMappings}
          onChange={(next) => onSaveProfile({ ...profile, ...next })}
        />
      </TabsContent>

      <TabsContent value="hardware-rules" className="space-y-6">
        <HardwareRulePanel
          aiEventMappings={profile.aiEventMappings}
          rules={profile.hardwareRules}
          deviceOptions={deviceOptions}
          desktopNoticeInstances={desktopNoticeInstances}
          onChange={(hardwareRules) => onSaveProfile({ ...profile, hardwareRules })}
        />
      </TabsContent>
    </Tabs>
  );
}
