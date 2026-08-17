import { render, screen } from '@testing-library/react';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { RuntimeStatusOverview } from './RuntimeStatusOverview';

const snapshot: RuntimeMonitorSnapshot = {
  startedAt: '2026-07-27T00:00:00Z',
  uptimeSeconds: 120,
  totalEvents: 3,
  totalOutputs: 2,
  totalFailures: 0,
  eventsBySource: [],
  eventsByResult: [],
  outputAttemptsByType: [],
  outputFailuresByType: [],
  eventSeries: [],
  outputSeries: [],
  runtimeErrorCount: 0,
  lastEvent: {
    source: 'codex',
    event: 'Stop',
    internalEvent: 'agent.completed',
    result: 'success',
    occurredAt: '2026-07-27T00:01:00Z'
  },
  lastOutput: {
    outputType: 'desktop-notice',
    result: 'success',
    occurredAt: '2026-07-27T00:01:01Z'
  }
};

const hookServerStatus = {
  running: true,
  port: 17321,
  bindAddress: '127.0.0.1:17321',
  eventUrl: 'http://127.0.0.1:17321/api/v1/events',
  healthUrl: 'http://127.0.0.1:17321/health'
};

test('shows the latest output with a friendly desktop notice label', () => {
  render(
    <I18nProvider language="zh-CN">
      <RuntimeStatusOverview snapshot={snapshot} hookServerStatus={hookServerStatus} />
    </I18nProvider>
  );

  expect(screen.getByText('最近输出')).toBeInTheDocument();
  expect(screen.getByText('桌面提示 / success')).toBeInTheDocument();
});
