import { describe, expect, test } from 'vitest';
import { HookEventDefinition, InternalEventDefinition, NoticeProfile } from '@/api/tauriApi';
import { createDefaultHardwareRuleForInternalEvent } from '../ruleProfileUtils';
import { buildLinkWorkflowViewModel } from './viewModel';

const hookCatalog: HookEventDefinition[] = [
  {
    source: 'codex',
    event: 'SessionStart',
    title: 'Session Start',
    description: 'Session starts',
    scenario: 'startup',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.started'
  },
  {
    source: 'codex',
    event: 'UserPromptSubmit',
    title: 'User Prompt Submit',
    description: 'User prompt submitted',
    scenario: 'prompt',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.running'
  },
  {
    source: 'claude-code',
    event: 'StopFailure',
    title: 'Stop Failure',
    description: 'Stop failed',
    scenario: 'failure',
    defaultSelected: true,
    mappedNoticeEvent: 'agent.failed'
  }
];

const internalEvents: InternalEventDefinition[] = [
  {
    id: 'agent.started',
    title: 'Agent Started',
    description: 'Agent starts',
    scenario: 'start',
    builtIn: true
  },
  {
    id: 'agent.running',
    title: 'Agent Running',
    description: 'Agent runs',
    scenario: 'running',
    builtIn: true
  },
  {
    id: 'agent.failed',
    title: 'Agent Failed',
    description: 'Agent fails',
    scenario: 'failure',
    builtIn: true
  }
];

function profileFixture(): NoticeProfile {
  return {
    id: 'daily-coding',
    name: 'Daily Coding',
    enabledHookEvents: [],
    aiEventMappings: [],
    hardwareRules: [],
    device: { boardId: 'rp2040-pico', transport: 'serial' }
  };
}

describe('buildLinkWorkflowViewModel', () => {
  test('marks workflow blocked when global hook settings have no enabled hook events', () => {
    const profile = profileFixture();
    const viewModel = buildLinkWorkflowViewModel({
      profile,
      hookCatalog,
      internalEvents,
      enabledHookEvents: [],
      deviceOptions: []
    });

    expect(viewModel.blockedReason).toBe('no-enabled-hook-events');
    expect(viewModel.toolNodes).toEqual([]);
    expect(viewModel.internalEventOverview.status).toBe('blocked');
    expect(viewModel.outputOverview.status).toBe('blocked');
  });

  test('uses global enabled hook selections even when the active profile is blank', () => {
    const profile = profileFixture();
    profile.aiEventMappings = [
      {
        id: 'codex-sessionstart-agent-started',
        source: 'codex',
        event: 'SessionStart',
        internalEvent: 'agent.started',
        enabled: true
      }
    ];

    const viewModel = buildLinkWorkflowViewModel({
      profile,
      hookCatalog,
      internalEvents,
      enabledHookEvents: [{ source: 'codex', event: 'SessionStart' }],
      deviceOptions: []
    });

    expect(viewModel.blockedReason).toBeNull();
    expect(viewModel.toolNodes).toEqual([
      expect.objectContaining({
        source: 'codex',
        enabledHookCount: 1,
        mappedHookCount: 1,
        status: 'configured'
      })
    ]);
  });

  test('builds one tool node per enabled AI tool source', () => {
    const profile = profileFixture();
    profile.enabledHookEvents = [
      { source: 'codex', event: 'SessionStart' },
      { source: 'codex', event: 'UserPromptSubmit' },
      { source: 'claude-code', event: 'StopFailure' }
    ];
    profile.aiEventMappings = [
      {
        id: 'codex-sessionstart-agent-started',
        source: 'codex',
        event: 'SessionStart',
        internalEvent: 'agent.started',
        enabled: true
      },
      {
        id: 'codex-userpromptsubmit-agent-running',
        source: 'codex',
        event: 'UserPromptSubmit',
        internalEvent: 'agent.running',
        enabled: true
      }
    ];

    const viewModel = buildLinkWorkflowViewModel({
      profile,
      hookCatalog,
      internalEvents,
      enabledHookEvents: profile.enabledHookEvents,
      deviceOptions: []
    });

    expect(viewModel.toolNodes).toEqual([
      expect.objectContaining({
        id: 'tool-claude-code',
        source: 'claude-code',
        enabledHookCount: 1,
        mappedHookCount: 0,
        status: 'warning'
      }),
      expect.objectContaining({
        id: 'tool-codex',
        source: 'codex',
        enabledHookCount: 2,
        mappedHookCount: 2,
        status: 'configured'
      })
    ]);
  });

  test('distinguishes disabled mappings from unmapped hook events', () => {
    const profile = profileFixture();
    profile.enabledHookEvents = [
      { source: 'codex', event: 'SessionStart' },
      { source: 'codex', event: 'UserPromptSubmit' }
    ];
    profile.aiEventMappings = [
      {
        id: 'codex-sessionstart-agent-started',
        source: 'codex',
        event: 'SessionStart',
        internalEvent: 'agent.started',
        enabled: false
      }
    ];

    const viewModel = buildLinkWorkflowViewModel({
      profile,
      hookCatalog,
      internalEvents,
      enabledHookEvents: profile.enabledHookEvents,
      deviceOptions: []
    });

    const codexNode = viewModel.toolNodes.find((node) => node.source === 'codex');

    expect(codexNode?.mappedHookCount).toBe(0);
    expect(codexNode?.hookEventSummaries).toEqual([
      expect.objectContaining({
        event: 'SessionStart',
        mappedInternalEvent: 'agent.started',
        status: 'disabled'
      }),
      expect.objectContaining({
        event: 'UserPromptSubmit',
        mappedInternalEvent: null,
        status: 'unmapped'
      })
    ]);
  });

  test('builds internal event and output overview from mappings and rules', () => {
    const profile = profileFixture();
    profile.enabledHookEvents = [
      { source: 'codex', event: 'SessionStart' },
      { source: 'codex', event: 'UserPromptSubmit' }
    ];
    profile.aiEventMappings = [
      {
        id: 'codex-sessionstart-agent-started',
        source: 'codex',
        event: 'SessionStart',
        internalEvent: 'agent.started',
        enabled: true
      },
      {
        id: 'codex-userpromptsubmit-agent-running',
        source: 'codex',
        event: 'UserPromptSubmit',
        internalEvent: 'agent.running',
        enabled: true
      }
    ];
    profile.hardwareRules = [
      createDefaultHardwareRuleForInternalEvent('agent.started', 'system-notification')
    ];

    const viewModel = buildLinkWorkflowViewModel({
      profile,
      hookCatalog,
      internalEvents,
      enabledHookEvents: profile.enabledHookEvents,
      deviceOptions: []
    });

    expect(viewModel.internalEventOverview).toMatchObject({
      mappedCount: 2,
      withoutOutputCount: 1,
      status: 'warning'
    });
    expect(viewModel.internalEventOverview.events.map((event) => event.id)).toEqual([
      'agent.running',
      'agent.started'
    ]);
    expect(viewModel.internalEventOverview.events.find((event) => event.id === 'agent.started'))
      .toMatchObject({
        hookReferences: [
          {
            source: 'codex',
            sourceTitle: 'Codex',
            event: 'SessionStart',
            eventTitle: 'Session Start'
          }
        ]
      });
    expect(viewModel.outputOverview).toMatchObject({
      configuredOutputCount: 1,
      needsConfigCount: 0,
      status: 'configured'
    });
  });
});
