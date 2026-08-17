import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/i18n';
import { ProfileRepairAlert } from './ProfileRepairAlert';

test('renders profile repair summary with isolated profile and removed sections', () => {
  render(
    <I18nProvider language="zh-CN">
      <ProfileRepairAlert
        profileName="Daily Coding"
        repair={{
          isolatedUnrecoverableProfileId: 'focus-mode',
          repairedProfileIdentity: true,
          removedEnabledHookEvents: 2,
          removedAiEventMappings: 1,
          removedHardwareRules: 3,
          resetDevice: true
        }}
      />
    </I18nProvider>
  );

  expect(screen.getByRole('alert')).toHaveTextContent('配置已自动修复');
  expect(screen.getByText(/配置方案“focus-mode”无法解析/)).toBeInTheDocument();
  expect(screen.getByText('已修复配置方案基础信息')).toBeInTheDocument();
  expect(screen.getByText('已移除 2 个无效 Hook 事件选择')).toBeInTheDocument();
  expect(screen.getByText('已移除 1 条无效 AI 事件映射')).toBeInTheDocument();
  expect(screen.getByText('已移除 3 条无效输出规则')).toBeInTheDocument();
  expect(screen.getByText('已将设备配置恢复为默认设备')).toBeInTheDocument();
});

test('renders nothing when there is no repair report', () => {
  const { container } = render(
    <I18nProvider language="zh-CN">
      <ProfileRepairAlert profileName="Daily Coding" repair={null} />
    </I18nProvider>
  );

  expect(container).toBeEmptyDOMElement();
});
