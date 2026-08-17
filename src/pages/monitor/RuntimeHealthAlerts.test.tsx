import { render, screen } from '@testing-library/react';
import { RuntimeMonitorSnapshot } from '@/api/tauriApi';
import { RuntimeHealthAlerts } from './RuntimeHealthAlerts';

const baseSnapshot: RuntimeMonitorSnapshot = {
  startedAt: '2026-06-08T18:40:00Z',
  uptimeSeconds: 600,
  totalEvents: 1,
  totalOutputs: 0,
  totalFailures: 0,
  eventsBySource: [{ key: 'codex', count: 1 }],
  eventsByResult: [{ key: 'success', count: 1 }],
  outputAttemptsByType: [],
  outputFailuresByType: [],
  eventSeries: [],
  outputSeries: [],
  runtimeErrorCount: 0,
  lastEvent: null,
  lastOutput: null
};

const runningStatus = {
  running: true,
  port: 17321,
  bindAddress: '127.0.0.1:17321',
  eventUrl: 'http://127.0.0.1:17321/api/v1/events',
  healthUrl: 'http://127.0.0.1:17321/health'
};

test('does not show focus mode warning when system notification has not been used', () => {
  render(<RuntimeHealthAlerts snapshot={baseSnapshot} hookServerStatus={runningStatus} />);

  expect(screen.queryByText(/系统通知可能被系统专注模式拦截/)).not.toBeInTheDocument();
});

test('shows focus mode warning after system notification output is used', () => {
  render(
    <RuntimeHealthAlerts
      snapshot={{
        ...baseSnapshot,
        totalOutputs: 1,
        outputAttemptsByType: [{ key: 'system-notification', count: 1 }]
      }}
      hookServerStatus={runningStatus}
    />
  );

  expect(screen.getByText(/系统通知可能被系统专注模式拦截/)).toBeInTheDocument();
});
