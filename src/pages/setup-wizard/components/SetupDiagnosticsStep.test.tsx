import { fireEvent, render, screen } from '@testing-library/react';
import { DiagnosticsSnapshot } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { SetupDiagnosticsStep } from './SetupDiagnosticsStep';

const snapshot: DiagnosticsSnapshot = {
  overallStatus: 'warning',
  checkedAt: '2026-07-08T10:00:00+08:00',
  sections: [
    {
      id: 'hookService',
      status: 'ok',
      action: 'open-debug',
      detail: null,
      checkedAt: '2026-07-08T10:00:00+08:00'
    },
    {
      id: 'devices',
      status: 'warning',
      action: 'open-devices',
      detail: null,
      checkedAt: '2026-07-08T10:00:00+08:00'
    }
  ],
  issues: [
    {
      id: 'device.referencedOffline',
      severity: 'warning',
      sectionId: 'devices',
      action: 'open-devices',
      context: 'rp2040-pico-default'
    }
  ],
  quickActions: [],
  deviceSummary: {
    registeredCount: 2,
    connectedCount: 1,
    offlineCount: 1,
    heartbeatIssueCount: 0,
    firmwareIssueCount: 0,
    referencedUnavailableCount: 1
  },
  deviceHealth: {
    okCount: 1,
    warningCount: 1,
    errorCount: 0,
    details: []
  },
  deviceIssues: []
};

test('renders setup diagnostics summary and opens diagnostics center', () => {
  const onOpenDiagnosticsCenter = vi.fn();
  const onRefresh = vi.fn();

  render(
    <I18nProvider language="zh-CN">
      <SetupDiagnosticsStep
        snapshot={snapshot}
        loading={false}
        error={null}
        onOpenDiagnosticsCenter={onOpenDiagnosticsCenter}
        onRefresh={onRefresh}
      />
    </I18nProvider>
  );

  expect(screen.getByText('链路总览')).toBeInTheDocument();
  expect(screen.getByText('警告')).toBeInTheDocument();
  expect(screen.getByText('已注册设备')).toBeInTheDocument();
  expect(screen.getByText('需要处理的问题')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '打开诊断中心' }));
  expect(onOpenDiagnosticsCenter).toHaveBeenCalledTimes(1);
});

test('renders loading and empty states', () => {
  render(
    <I18nProvider language="zh-CN">
      <SetupDiagnosticsStep
        snapshot={null}
        loading
        error={null}
        onOpenDiagnosticsCenter={vi.fn()}
        onRefresh={vi.fn()}
      />
    </I18nProvider>
  );

  expect(screen.getByText('正在加载接入检查...')).toBeInTheDocument();
});
