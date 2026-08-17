import { render, screen } from '@testing-library/react';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { RuntimeOutputOverview } from './RuntimeOutputOverview';

const snapshot: RuntimeMonitorSnapshot = {
  startedAt: '2026-07-27T00:00:00Z',
  uptimeSeconds: 120,
  totalEvents: 3,
  totalOutputs: 5,
  totalFailures: 1,
  eventsBySource: [],
  eventsByResult: [],
  outputAttemptsByType: [
    { key: 'desktop-notice', count: 4 },
    { key: 'webhook', count: 1 }
  ],
  outputFailuresByType: [{ key: 'desktop-notice', count: 1 }],
  eventSeries: [],
  outputSeries: [],
  runtimeErrorCount: 1,
  lastEvent: null,
  lastOutput: null
};

test('summarizes output attempts by friendly output type labels', () => {
  render(
    <I18nProvider language="zh-CN">
      <RuntimeOutputOverview snapshot={snapshot} />
    </I18nProvider>
  );

  expect(screen.getByText('输出类型概览')).toBeInTheDocument();
  expect(screen.getByText('桌面提示')).toBeInTheDocument();
  expect(screen.getByText('触发 4')).toBeInTheDocument();
  expect(screen.getByText('失败 1')).toBeInTheDocument();
  expect(screen.getByText('成功率 75%')).toBeInTheDocument();
  expect(screen.getByText('Webhook')).toBeInTheDocument();
});

test('shows an empty state when no output has been recorded', () => {
  render(
    <I18nProvider language="zh-CN">
      <RuntimeOutputOverview
        snapshot={{
          ...snapshot,
          totalOutputs: 0,
          outputAttemptsByType: [],
          outputFailuresByType: []
        }}
      />
    </I18nProvider>
  );

  expect(screen.getByText('暂无输出触发统计')).toBeInTheDocument();
});
