import { describe, expect, test } from 'vitest';
import {
  AiEventMapping,
  HardwareRule,
  HookEventDefinition,
  InternalEventDefinition
} from '../../api/tauriApi';
import {
  buildAiMappingId,
  buildHardwareRuleId,
  createAiMappingIfAvailable,
  createHardwareRuleIfAvailable,
  createDefaultOutputForType,
  dedupeRuleId,
  durationMsFromCustomSeconds,
  durationMsFromPreset,
  durationPresetForMs,
  enabledOutputLimitReached,
  countEnabledOutputsForEvent,
  extractMappedInternalEvents,
  syncHardwareRulesToMappings,
  hasOutputTypeForEvent,
  getRulesForEvent,
  supportedOutputTypes,
  defaultParametersForDeviceChannelAction
} from './ruleProfileUtils';

const internalEvents: InternalEventDefinition[] = [
  {
    id: 'agent.running',
    title: '运行中',
    description: 'AI 正在执行任务。',
    scenario: '任务运行期间点亮提示。',
    builtIn: true
  },
  {
    id: 'session.ended',
    title: '会话结束',
    description: 'AI 会话正常结束。',
    scenario: '会话结束时关闭提示。',
    builtIn: true
  }
];

const sessionStartHook: HookEventDefinition = {
  source: 'codex',
  event: 'SessionStart',
  title: '会话开始',
  description: 'Codex 会话开始时触发。',
  scenario: '用于提示 AI 已进入工作状态。',
  defaultSelected: true,
  mappedNoticeEvent: 'agent.running'
};

const existingMapping: AiEventMapping = {
  id: 'codex-sessionstart-agent-running',
  source: 'codex',
  event: 'SessionStart',
  internalEvent: 'agent.running',
  enabled: true
};

const existingHardwareRule: HardwareRule = {
  id: 'agent-running-system-notification-output',
  internalEvent: 'agent.running',
  output: createDefaultOutputForType('system-notification', 'agent.running'),
  priority: 60,
  enabled: true
};

const deprecatedOutputType = ['li', 'ght'].join('');

describe('ruleProfileUtils', () => {
  test('keeps compatibility exports for ids and output options', () => {
    expect(buildAiMappingId('codex', 'SessionStart', 'agent.running')).toBe(
      'codex-sessionstart-agent-running'
    );
    expect(buildHardwareRuleId('agent.running', 'webhook')).toBe(
      'agent-running-webhook-output'
    );
    expect(
      dedupeRuleId(
        ['agent-running-system-notification-output'],
        'agent-running-system-notification-output'
      )
    ).toBe('agent-running-system-notification-output-2');
    expect(supportedOutputTypes.some((type) => type.value === 'system-notification')).toBe(true);
  });

  test('exposes supported hardware output types', () => {
    const hardwareTypes = supportedOutputTypes
      .filter((type) => type.category === 'hardware')
      .map((type) => type.value);

    expect(hardwareTypes).toEqual(['device-channel', 'display']);
    expect(supportedOutputTypes.some((type) => type.value === 'system-notification')).toBe(true);
    expect(supportedOutputTypes.some((type) => type.value === 'webhook')).toBe(true);
    expect(supportedOutputTypes.some((type) => type.value === 'sound')).toBe(true);
  });

  test('creates system notification output with template variables and length limits', () => {
    const output = createDefaultOutputForType('system-notification', 'agent.completed');

    expect(output.notificationTitle).toBe('{{source}} 已完成任务');
    expect(output.notificationBody).toBe('{{last_assistant_message}}');
    expect(output.notificationTitleMaxChars).toBe(80);
    expect(output.notificationBodyMaxChars).toBe(300);
    expect(output.notificationThrottleSeconds).toBe(30);
    expect(output.notificationSound).toBe('default');
  });

  test('creates sound output with conservative playback defaults', () => {
    const output = createDefaultOutputForType('sound', 'agent.completed');

    expect(output.soundFilePath).toBe('');
    expect(output.soundVolumePercent).toBe(80);
    expect(output.soundMaxDurationMs).toBe(3000);
    expect(output.soundThrottleSeconds).toBe(30);
  });

  test('creates display output without unsupported duration default', () => {
    const output = createDefaultOutputForType('display', 'agent.completed');

    expect(output.durationMs).toBeNull();
    expect(output.displayTemplateId).toBe('task-success');
    expect(output.displayAccent).toBe('success');
    expect(output.displayIcon).toBe('check');
    expect(output.displayLinesTemplate).toEqual(['{{source}}', 'Finished']);
    expect(output.displayStatus).toBe('success');
    expect(output.displayTitleTemplate).toBe('{{display.title}}');
    expect(output.displayMessageTemplate).toBe('{{display.lines}}');
  });

  test('creates device channel output with stable default channel action', () => {
    const output = createDefaultOutputForType('device-channel', 'agent.running');

    expect(output).toMatchObject({
      type: 'device-channel',
      durationMs: null,
      channelActions: [
        expect.objectContaining({
          id: 'action-1',
          deviceId: 'rp2040-pico-default',
          channelId: 'pin.gp2',
          channelAction: 'activate',
          durationMs: 5000,
          intervalMs: null
        })
      ]
    });
  });

  test('display-status channel action defaults to a screen template', () => {
    const parameters = defaultParametersForDeviceChannelAction('display-status');

    expect(parameters.displayTemplateId).toBe('notice');
    expect(parameters.displayStatus).toBe('notice');
    expect(parameters.displayTitleTemplate).toBe('{{display.title}}');
    expect(parameters.displayMessageTemplate).toBe('{{display.lines}}');
    expect(parameters.displayLinesTemplate).toEqual(['{{source}}', 'Status updated']);
  });

  test('creates fallback system notification template when internal event is unknown', () => {
    const output = createDefaultOutputForType('system-notification', 'custom.event');

    expect(output.notificationTitle).toBe('{{source}} · {{internalEvent}}');
    expect(output.notificationBody).toBe('模型：{{model}}，事件：{{event}}');
  });

  test('creates webhook output with stable variables and body length limit', () => {
    const output = createDefaultOutputForType('webhook', 'agent.completed');

    expect(output.webhookMethod).toBe('POST');
    expect(output.webhookHeaders).toContain('Content-Type');
    expect(output.webhookBody).toContain('{{source}}');
    expect(output.webhookBody).toContain('{{internalEvent}}');
    expect(output.webhookBody).toContain('{{last_assistant_message}}');
    expect(output.webhookBody).toContain('{{prompt}}');
    expect(output.webhookBody).toContain('{{tool_response}}');
    expect(output.webhookBodyMaxChars).toBe(8000);
  });

  test('does not create duplicate ai mapping for the same source and hook event', () => {
    const mapping = createAiMappingIfAvailable(
      [existingMapping],
      sessionStartHook,
      'session.ended',
      internalEvents
    );

    expect(mapping).toBeNull();
  });

  test('creates ai mapping when source and hook event are unused', () => {
    const mapping = createAiMappingIfAvailable(
      [],
      sessionStartHook,
      'session.ended',
      internalEvents
    );

    expect(mapping).toEqual({
      id: 'codex-sessionstart-session-ended',
      source: 'codex',
      event: 'SessionStart',
      internalEvent: 'session.ended',
      enabled: true
    });
  });

  test('does not create duplicate hardware rule for the same internal event and output type', () => {
    const rule = createHardwareRuleIfAvailable(
      [existingHardwareRule],
      'agent.running',
      'system-notification',
      createDefaultOutputForType('system-notification')
    );

    expect(rule).toBeNull();
  });

  test('does not create a second device channel rule for the same internal event', () => {
    const existingDeviceRule: HardwareRule = {
      id: 'agent-running-device-channel-output',
      internalEvent: 'agent.running',
      output: createDefaultOutputForType('device-channel'),
      priority: 50,
      enabled: true
    };

    const rule = createHardwareRuleIfAvailable(
      [existingDeviceRule],
      'agent.running',
      'device-channel',
      createDefaultOutputForType('device-channel')
    );

    expect(rule).toBeNull();
  });

  test('creates device channel rule when internal event is unused', () => {
    const existingDeviceRule: HardwareRule = {
      id: 'agent-running-device-channel-output',
      internalEvent: 'agent.running',
      output: createDefaultOutputForType('device-channel'),
      priority: 50,
      enabled: true
    };

    const rule = createHardwareRuleIfAvailable(
      [existingDeviceRule],
      'agent.completed',
      'device-channel',
      createDefaultOutputForType('device-channel')
    );

    expect(rule).not.toBeNull();
    expect(rule?.id).toBe('agent-completed-device-channel-output');
  });

  test('creates hardware rule when internal event and output type are unused', () => {
    const rule = createHardwareRuleIfAvailable(
      [existingHardwareRule],
      'session.ended',
      'webhook',
      createDefaultOutputForType('webhook')
    );

    expect(rule).toEqual({
      id: 'session-ended-webhook-output',
      internalEvent: 'session.ended',
      output: createDefaultOutputForType('webhook'),
      priority: 50,
      enabled: true
    });
  });

  test('counts only enabled outputs for the same internal event', () => {
    const rules: HardwareRule[] = [
      existingHardwareRule,
      {
        id: 'agent-running-webhook-output',
        internalEvent: 'agent.running',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      },
      {
        id: 'agent-running-sound-output',
        internalEvent: 'agent.running',
        output: createDefaultOutputForType('sound'),
        priority: 50,
        enabled: false
      },
      {
        id: 'session-ended-webhook-output',
        internalEvent: 'session.ended',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      }
    ];

    expect(countEnabledOutputsForEvent(rules, 'agent.running')).toBe(2);
    expect(enabledOutputLimitReached(rules, 'agent.running')).toBe(false);
  });

  test('detects enabled output limit per internal event', () => {
    const fourEnabledRules: HardwareRule[] = [
      existingHardwareRule,
      {
        id: 'agent-running-system-notification-output',
        internalEvent: 'agent.running',
        output: createDefaultOutputForType('system-notification'),
        priority: 50,
        enabled: true
      },
      {
        id: 'agent-running-webhook-output',
        internalEvent: 'agent.running',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      },
      {
        id: 'agent-running-sound-output',
        internalEvent: 'agent.running',
        output: createDefaultOutputForType('sound'),
        priority: 50,
        enabled: true
      }
    ];
    const fiveEnabledRules: HardwareRule[] = [
      ...fourEnabledRules,
      {
        id: 'agent-running-desktop-notice-output',
        internalEvent: 'agent.running',
        output: createDefaultOutputForType('desktop-notice'),
        priority: 50,
        enabled: false
      }
    ];
    fiveEnabledRules[4] = { ...fiveEnabledRules[4], enabled: true };

    expect(countEnabledOutputsForEvent(fourEnabledRules, 'agent.running')).toBe(4);
    expect(enabledOutputLimitReached(fourEnabledRules, 'agent.running')).toBe(false);
    expect(countEnabledOutputsForEvent(fiveEnabledRules, 'agent.running')).toBe(5);
    expect(enabledOutputLimitReached(fiveEnabledRules, 'agent.running')).toBe(true);
  });

  test('resolves duration preset for permanent, preset and custom values', () => {
    expect(durationPresetForMs(null)).toBe('permanent');
    expect(durationPresetForMs(5000)).toBe('5000');
    expect(durationPresetForMs(2500)).toBe('custom');
  });

  test('converts duration presets and custom seconds to milliseconds', () => {
    expect(durationMsFromPreset('permanent')).toBeNull();
    expect(durationMsFromPreset('5000')).toBe(5000);
    expect(durationMsFromCustomSeconds('2.5')).toBe(2500);
    expect(durationMsFromCustomSeconds('-1')).toBeNull();
    expect(durationMsFromCustomSeconds('abc')).toBeNull();
  });

  test('extracts mapped internal events from enabled AI mappings only', () => {
    const mappings: AiEventMapping[] = [
      existingMapping,
      {
        id: 'codex-stop-session-ended',
        source: 'codex',
        event: 'Stop',
        internalEvent: 'session.ended',
        enabled: true
      },
      {
        id: 'codex-pretooluse-dormant-event',
        source: 'codex',
        event: 'PreToolUse',
        internalEvent: 'dormant.event',
        enabled: false
      }
    ];

    const result = extractMappedInternalEvents(mappings);

    expect(result).toEqual(['agent.running', 'session.ended']);
  });

  test('syncs hardware rules to only keep mapped internal events', () => {
    const mappings: AiEventMapping[] = [existingMapping];
    const rules: HardwareRule[] = [
      existingHardwareRule,
      {
        id: 'session-ended-webhook-output',
        internalEvent: 'session.ended',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      },
      {
        id: 'unmapped-event-webhook-output',
        internalEvent: 'unmapped.event',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      }
    ];

    const result = syncHardwareRulesToMappings(rules, mappings);

    expect(result).toHaveLength(1);
    expect(result[0].internalEvent).toBe('agent.running');
  });

  test('syncs hardware rules without keeping disabled mapping outputs', () => {
    const mappings: AiEventMapping[] = [
      existingMapping,
      {
        id: 'codex-stop-session-ended',
        source: 'codex',
        event: 'Stop',
        internalEvent: 'session.ended',
        enabled: false
      }
    ];
    const rules: HardwareRule[] = [
      existingHardwareRule,
      {
        id: 'session-ended-webhook-output',
        internalEvent: 'session.ended',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      }
    ];

    const result = syncHardwareRulesToMappings(rules, mappings);

    expect(result).toHaveLength(1);
    expect(result[0].internalEvent).toBe('agent.running');
  });

  test('auto-creates hardware rules for mapped events without rules', () => {
    const mappings: AiEventMapping[] = [
      existingMapping,
      {
        id: 'codex-stop-session-ended',
        source: 'codex',
        event: 'Stop',
        internalEvent: 'session.ended',
        enabled: true
      }
    ];
    const rules: HardwareRule[] = [existingHardwareRule];

    const result = syncHardwareRulesToMappings(rules, mappings);

    expect(result).toHaveLength(2);
    expect(result[0].internalEvent).toBe('agent.running');
    expect(result[1].internalEvent).toBe('session.ended');
    expect(result[1].id).toBe('session-ended-system-notification-output');
    expect(result[1].output.type).toBe('system-notification');
    expect(result[1].output.notificationTitle).toBe('{{source}} · {{internalEvent}}');
    expect(result[1].enabled).toBe(true);
  });

  test('returns empty array when no mappings exist', () => {
    const rules: HardwareRule[] = [existingHardwareRule];
    const result = syncHardwareRulesToMappings(rules, []);

    expect(result).toEqual([]);
  });

  test('creates rules for all mapped events when starting from empty', () => {
    const mappings: AiEventMapping[] = [
      existingMapping,
      {
        id: 'codex-stop-session-ended',
        source: 'codex',
        event: 'Stop',
        internalEvent: 'session.ended',
        enabled: true
      }
    ];

    const result = syncHardwareRulesToMappings([], mappings);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.internalEvent).sort()).toEqual([
      'agent.running',
      'session.ended'
    ]);
    expect(result.every((rule) => rule.output.type === 'system-notification')).toBe(true);
  });

  test('checks if output type exists for event', () => {
    const rules: HardwareRule[] = [
      existingHardwareRule,
      {
        id: 'agent-running-buzzer-output',
        internalEvent: 'agent.running',
        output: { type: 'buzzer', durationMs: null, text: null },
        priority: 50,
        enabled: true
      }
    ];

    expect(hasOutputTypeForEvent(rules, 'agent.running', 'system-notification')).toBe(true);
    expect(hasOutputTypeForEvent(rules, 'agent.running', 'buzzer')).toBe(true);
    expect(hasOutputTypeForEvent(rules, 'agent.running', 'display')).toBe(false);
    expect(hasOutputTypeForEvent(rules, 'session.ended', 'system-notification')).toBe(false);
  });

  test('gets all rules for an internal event', () => {
    const rules: HardwareRule[] = [
      existingHardwareRule,
      {
        id: 'agent-running-buzzer-output',
        internalEvent: 'agent.running',
        output: { type: 'buzzer', durationMs: null, text: null },
        priority: 50,
        enabled: true
      },
      {
        id: 'session-ended-webhook-output',
        internalEvent: 'session.ended',
        output: createDefaultOutputForType('webhook'),
        priority: 50,
        enabled: true
      }
    ];

    const result = getRulesForEvent(rules, 'agent.running');

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.output.type).sort()).toEqual(['buzzer', 'system-notification']);
  });

  test('exposes device channel as implemented hardware output and omits deprecated output choices', () => {
    const implementedTypes = supportedOutputTypes
      .filter((type) => type.implemented)
      .map((type) => type.value);

    expect(implementedTypes).toContain('device-channel');
    expect(implementedTypes).not.toContain(deprecatedOutputType);
  });

  test('creates device channel output with safe default parameters', () => {
    const output = createDefaultOutputForType('device-channel');

    expect(output).toEqual(
      expect.objectContaining({
        type: 'device-channel',
        durationMs: null,
        channelActions: [
          expect.objectContaining({
            durationMs: 5000,
            intervalMs: null,
            dutyPercent: null,
            frequencyHz: null,
            color: null,
            brightnessPercent: null
          })
        ]
      })
    );
  });
});
