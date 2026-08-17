import { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DiagnosticsSnapshot } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { DiagnosticsPage } from './DiagnosticsPage';

const snapshot: DiagnosticsSnapshot = {
  overallStatus: 'warning',
  checkedAt: '2026-07-08T10:00:00+08:00',
  sections: [
    {
      id: 'hookService',
      status: 'ok',
      action: 'open-debug',
      checkedAt: '2026-07-08T10:00:00+08:00'
    },
    {
      id: 'relay',
      status: 'ok',
      action: 'open-hook-settings',
      checkedAt: '2026-07-08T10:00:00+08:00'
    },
    {
      id: 'hookConfig',
      status: 'warning',
      action: 'open-hook-settings',
      checkedAt: '2026-07-08T10:00:00+08:00'
    }
  ],
  issues: [
    {
      id: 'profile.mappingWithoutOutput',
      severity: 'error',
      sectionId: 'profile',
      action: 'open-ai-event-mapping',
      context: 'agent.started'
    }
  ],
  quickActions: [
    { kind: 'refresh-diagnostics', enabled: true },
    { kind: 'auto-connect-registered-devices', enabled: true },
    { kind: 'send-test-event', enabled: true }
  ],
  deviceSummary: {
    registeredCount: 2,
    connectedCount: 1,
    offlineCount: 1,
    heartbeatIssueCount: 0,
    firmwareIssueCount: 0,
    referencedUnavailableCount: 1
  },
  deviceIssues: [
    {
      deviceId: 'desk-pico',
      label: null,
      status: 'error',
      reason: 'device-action-unsupported',
      action: 'open-devices'
    }
  ],
  deviceHealth: {
    okCount: 1,
    warningCount: 1,
    errorCount: 0,
    details: [
      {
        deviceId: 'desk-pico',
        label: 'Desk Pico',
        boardId: 'rp2040-pico',
        status: 'warning',
        checks: [
          {
            id: 'connection',
            status: 'ok',
            issueCode: null,
            action: 'open-devices',
            detail: null
          },
          {
            id: 'ruleReference',
            status: 'warning',
            issueCode: 'referencedOffline',
            action: 'open-devices',
            detail: 'agent.started'
          }
        ]
      }
    ]
  }
};

describe('DiagnosticsPage', () => {
  test('renders diagnostics overview issues and device summary without recent events', () => {
    const { container } = renderDiagnosticsPage();

    expect(screen.getByRole('heading', { name: '诊断中心' })).toBeInTheDocument();
    expect(screen.getAllByText('Hook 服务')).not.toHaveLength(0);
    expect(screen.getByText('已注册设备')).toBeInTheDocument();
    expect(screen.queryByText('最近事件')).not.toBeInTheDocument();
    expect(screen.getByText('内部事件没有输出规则')).toBeInTheDocument();
    expect(
      screen.getByText('这些内部事件已经被映射使用，但没有配置任何输出方式。')
    ).toBeInTheDocument();
    expect(screen.getByText('agent.started')).toBeInTheDocument();
    expect(screen.getByText('desk-pico')).toBeInTheDocument();
    expect(screen.getByText('当前通道不支持输出规则中的动作。')).toBeInTheDocument();
    expect(screen.getByText('设备健康检查')).toBeInTheDocument();
    expect(screen.getByText('Desk Pico')).toBeInTheDocument();
    expect(screen.getByText('规则引用')).toBeInTheDocument();
    expect(screen.getByText('规则引用的设备未连接')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="diagnostics-flow-row"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="diagnostics-main-grid"]')).toBeInTheDocument();
  });

  test('quick action routes through onAction', () => {
    const onAction = vi.fn();
    renderDiagnosticsPage({ onAction });

    expect(screen.queryByRole('button', { name: '打开设备管理' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '发送测试事件' }));

    expect(onAction).toHaveBeenCalledWith('send-test-event');
  });
});

function renderDiagnosticsPage(props: Partial<ComponentProps<typeof DiagnosticsPage>> = {}) {
  return render(
    <I18nProvider language="zh-CN">
      <DiagnosticsPage
        snapshot={snapshot}
        loading={false}
        error={null}
        onRefresh={vi.fn()}
        onAction={vi.fn()}
        {...props}
      />
    </I18nProvider>
  );
}
