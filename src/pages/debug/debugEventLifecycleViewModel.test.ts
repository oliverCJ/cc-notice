import { describe, expect, test } from 'vitest';
import type { DebugLogEntryView } from '@/state/appStore';
import { buildDebugEventLifecycleViewModel } from './debugEventLifecycleViewModel';

function baseEntry(overrides: Partial<DebugLogEntryView> = {}): DebugLogEntryView {
  return {
    debugEntryId: 'debug-1',
    source: 'codex',
    event: 'SessionStart',
    payload: '{}',
    result: 'accepted',
    internalEvent: 'codex.session.start',
    mappingStage: 'mapped',
    occurredAt: '2026-07-20T10:00:00+08:00',
    requestReceivedAt: '2026-07-20T10:00:01+08:00',
    processingCompletedAt: '2026-07-20T10:00:02+08:00',
    httpReadElapsedMs: 4,
    prepareElapsedMs: 8,
    responseElapsedMs: 12,
    processingElapsedMs: 36,
    processingMode: 'async',
    outputs: [
      { type: 'sound', ruleId: 'rule-sound', commandSummary: 'sound: success' },
      { type: 'webhook', ruleId: 'rule-webhook', commandSummary: 'POST https://example.test' },
      {
        type: 'desktop-notice',
        ruleId: 'rule-desktop-notice',
        commandSummary: 'desktop notice: edge breathing'
      },
      { type: 'device-channel', ruleId: 'rule-device', commandSummary: 'pin.gp2 high' }
    ],
    deviceResults: [
      {
        deviceId: 'pico-1',
        channelId: 'pin.gp2',
        outputType: 'device-channel',
        status: 'sent',
        ack: '{"ok":true}'
      }
    ],
    ...overrides
  };
}

describe('buildDebugEventLifecycleViewModel', () => {
  test('builds a successful lifecycle for accepted entry with outputs', () => {
    const vm = buildDebugEventLifecycleViewModel(baseEntry());

    expect(vm.summary).toMatchObject({
      result: 'accepted',
      source: 'codex',
      event: 'SessionStart',
      internalEvent: 'codex.session.start',
      mappingStage: 'mapped',
      processingMode: 'async',
      totalElapsedMs: 36,
      outputCount: 4,
      deviceResultCount: 1,
      failedDeviceResultCount: 0
    });
    expect(vm.nodes.map((node) => node.id)).toEqual([
      'inbound',
      'validation',
      'mapping',
      'rules',
      'outputs',
      'completion'
    ]);
    expect(vm.nodes.every((node) => node.status === 'success')).toBe(true);
  });

  test('marks unmapped event as warning and skips later execution nodes', () => {
    const vm = buildDebugEventLifecycleViewModel(
      baseEntry({ internalEvent: undefined, mappingStage: 'unmapped', outputs: [] })
    );

    expect(vm.nodes.find((node) => node.id === 'mapping')?.status).toBe('warning');
    expect(vm.nodes.find((node) => node.id === 'rules')?.status).toBe('skipped');
    expect(vm.nodes.find((node) => node.id === 'outputs')?.status).toBe('skipped');
  });

  test('marks matched event without outputs as rule warning', () => {
    const vm = buildDebugEventLifecycleViewModel(baseEntry({ outputs: [], deviceResults: [] }));

    expect(vm.nodes.find((node) => node.id === 'rules')?.status).toBe('warning');
    expect(vm.nodes.find((node) => node.id === 'outputs')?.status).toBe('skipped');
  });

  test('groups outputs by local webhook desktop notice and device types', () => {
    const groups = buildDebugEventLifecycleViewModel(baseEntry()).nodes.find(
      (node) => node.id === 'outputs'
    )?.outputGroups;

    expect(groups?.map((group) => group.id)).toEqual([
      'local',
      'webhook',
      'desktop-notice',
      'device'
    ]);
    expect(groups?.find((group) => group.id === 'desktop-notice')?.outputs[0].ruleId).toBe(
      'rule-desktop-notice'
    );
    expect(groups?.find((group) => group.id === 'device')?.outputs[0].ruleId).toBe(
      'rule-device'
    );
  });

  test('summarizes failed device results without making the whole chain disappear', () => {
    const vm = buildDebugEventLifecycleViewModel(
      baseEntry({
        deviceResults: [
          {
            deviceId: 'pico-1',
            channelId: 'pin.gp2',
            outputType: 'device-channel',
            status: 'failed',
            errorCode: 'DEVICE_TRANSPORT_ERROR',
            error: 'write failed'
          }
        ]
      })
    );

    expect(vm.summary.failedDeviceResultCount).toBe(1);
    expect(vm.nodes.find((node) => node.id === 'outputs')?.status).toBe('warning');
    expect(vm.nodes.find((node) => node.id === 'completion')?.status).toBe('warning');
  });

  test('treats error result as a blocking validation failure', () => {
    const vm = buildDebugEventLifecycleViewModel(
      baseEntry({
        result: 'error',
        internalEvent: undefined,
        mappingStage: 'hookEventCatalog',
        outputs: [],
        deviceResults: [],
        error: 'unknown hook event'
      })
    );

    expect(vm.nodes.find((node) => node.id === 'validation')?.status).toBe('error');
    expect(vm.nodes.find((node) => node.id === 'mapping')?.status).toBe('skipped');
    expect(vm.nodes.find((node) => node.id === 'rules')?.status).toBe('skipped');
    expect(vm.nodes.find((node) => node.id === 'outputs')?.status).toBe('skipped');
    expect(vm.nodes.find((node) => node.id === 'completion')?.status).toBe('error');
  });

  test('marks translatable fact values explicitly instead of relying on value prefixes', () => {
    const vm = buildDebugEventLifecycleViewModel(
      baseEntry({
        internalEvent: 'debug.lifecycle.custom.event'
      })
    );

    const mappingFacts = vm.nodes.find((node) => node.id === 'mapping')?.facts ?? [];
    expect(mappingFacts.find((fact) => fact.value === 'debug.lifecycle.custom.event')).toMatchObject(
      {
        valueKind: 'text'
      }
    );
  });
});
