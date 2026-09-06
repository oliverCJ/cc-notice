import {
  EnabledHookEvent,
  HookEventDefinition,
  InternalEventDefinition,
  NoticeProfile,
} from '../../api/tauriApi';
import type { DeviceInstance, DeviceRuntimeState } from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AiEventMappingPanel } from './AiEventMappingPanel';
import { HardwareRulePanel } from './HardwareRulePanel';
import { useI18n } from '@/i18n';
import { buildLinkWorkflowViewModel, LinkWorkflowCanvas } from './link-workflow';
import { CustomFaceLibraryEntries } from '@/domain/customFaces/library';
import { buildRuleDeviceOptions } from './ruleDeviceOptions';

type RuleConfigurationTabsProps = {
  enabledHookEvents: EnabledHookEvent[];
  hookCatalog: HookEventDefinition[];
  internalEvents: InternalEventDefinition[];
  desktopNoticeInstances: DesktopNoticeInstance[];
  configuredDevices: DeviceInstance[];
  deviceRuntimeStates: DeviceRuntimeState[];
  customFaceLibrary?: CustomFaceLibraryEntries | null;
  customFaceLibraryLoading?: boolean;
  onReloadCustomFaceLibrary?: () => void;
  profile: NoticeProfile;
  onOpenHookSettings: () => void;
  onSaveProfile: (profile: NoticeProfile) => void;
};

export function RuleConfigurationTabs({
  enabledHookEvents,
  hookCatalog,
  internalEvents,
  desktopNoticeInstances,
  configuredDevices,
  deviceRuntimeStates,
  customFaceLibrary,
  customFaceLibraryLoading = false,
  onReloadCustomFaceLibrary,
  profile,
  onOpenHookSettings,
  onSaveProfile,
}: RuleConfigurationTabsProps) {
  const t = useI18n();
  const [activeTab, setActiveTab] = useState('visual-workflow');
  const deviceOptions = buildRuleDeviceOptions(configuredDevices, deviceRuntimeStates);
  const linkWorkflowViewModel = buildLinkWorkflowViewModel({
    profile,
    hookCatalog,
    enabledHookEvents,
    internalEvents,
    deviceOptions,
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
          customFaceLibrary={customFaceLibrary}
          customFaceLibraryLoading={customFaceLibraryLoading}
          onReloadCustomFaceLibrary={onReloadCustomFaceLibrary}
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
          customFaceLibrary={customFaceLibrary}
          customFaceLibraryLoading={customFaceLibraryLoading}
          onReloadCustomFaceLibrary={onReloadCustomFaceLibrary}
          onChange={(hardwareRules) => onSaveProfile({ ...profile, hardwareRules })}
        />
      </TabsContent>
    </Tabs>
  );
}
