import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const SRC_ROOT = resolve(__dirname, '..');

const checkedFiles = [
  'pages/setup-wizard/SetupWizardPage.tsx',
  'pages/setup-wizard/components/HookServiceStep.tsx',
  'pages/setup-wizard/components/HookSetupStep.tsx',
  'pages/setup-wizard/components/EventMappingStep.tsx',
  'pages/setup-wizard/components/DeviceFirmwareStep.tsx',
  'pages/hook-settings/HookSettingsPage.tsx',
  'pages/hook-settings/HookEventSelectionPanel.tsx',
  'pages/hook-settings/HookConfigTargetPanel.tsx',
  'pages/hook-settings/HookConfigTargetCard.tsx',
  'pages/hook-settings/HookConfigPreviewDialog.tsx',
  'pages/monitor/MonitorPage.tsx',
  'pages/monitor/RuntimeStatusOverview.tsx',
  'pages/monitor/RuntimeStatsCharts.tsx',
  'pages/monitor/RuntimeRecentEvents.tsx',
  'pages/monitor/RuntimeHealthAlerts.tsx',
  'pages/devices/DevicesPage.tsx',
  'pages/firmware/FirmwarePage.tsx',
  'pages/settings/ProfileCard.tsx',
  'pages/settings/ProfileCreateDialog.tsx',
  'pages/settings/ProfileDeleteDialog.tsx',
  'pages/rules/RulesPage.tsx',
  'pages/rules/ProfileManagementSection.tsx',
  'pages/rules/AiEventMappingPanel.tsx',
  'pages/rules/AiMappingCreateDialog.tsx',
  'pages/rules/RuleConfigurationTabs.tsx',
  'pages/rules/InternalEventCatalogSection.tsx',
  'pages/rules/HardwareRulePanel.tsx',
  'pages/rules/HardwareRuleCard.tsx',
  'pages/rules/OutputTypeAddDialog.tsx',
  'pages/rules/HardwareRuleDetailDialog.tsx',
  'pages/rules/link-workflow/LinkWorkflowCanvas.tsx',
  'pages/rules/link-workflow/WorkflowToolNode.tsx',
  'pages/rules/link-workflow/WorkflowOverviewNode.tsx',
  'pages/rules/link-workflow/LinkWorkflowInspector.tsx',
  'pages/rules/link-workflow/ToolHookMappingInspector.tsx',
  'pages/rules/link-workflow/HookMappingDetailDialog.tsx',
  'pages/rules/link-workflow/InternalEventOverviewInspector.tsx',
  'pages/rules/link-workflow/OutputRuleInspector.tsx',
  'pages/rules/SystemNotificationOutputFields.tsx',
  'pages/rules/WebhookOutputFields.tsx',
  'pages/rules/SoundOutputFields.tsx',
  'pages/rules/template-variables/TemplateVariableHelper.tsx',
  'pages/rules/template-variables/TemplateVariablePopover.tsx',
  'pages/debug/DebugPage.tsx',
  'components/workbench/dialog.tsx',
  'state/appStore.ts'
];

describe('hardcoded UI text guard', () => {
  test('keeps migrated UI files free of hardcoded Chinese text outside comments', () => {
    const offenders = checkedFiles.flatMap((file) => {
      const content = stripLineComments(readFileSync(resolve(SRC_ROOT, file), 'utf8'));
      return /[\u4e00-\u9fff]/.test(content) ? [file] : [];
    });

    expect(offenders).toEqual([]);
  });
});

function stripLineComments(content: string) {
  return content
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//') && !line.trimStart().startsWith('{/*'))
    .join('\n');
}
