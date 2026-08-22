import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import App from '../App';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}));

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);
const openMock = vi.mocked(open);

function configFromInvokeArgs(args: unknown) {
  if (args && typeof args === 'object' && 'config' in args) {
    return (args as { config: unknown }).config;
  }

  return undefined;
}

function deferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const defaultConfig = {
  localHookServer: { port: 17321 },
  ui: { language: 'zh-CN', themeMode: 'system' },
  window: {
    closeBehavior: 'hide-to-tray',
    startupMode: 'normal',
    launchAtLogin: false,
    hideWindowOnLoginLaunch: true
  },
  activeProfileId: 'daily-coding',
  hookEventSelections: {
    bySource: {
      codex: ['SessionStart', 'UserPromptSubmit'],
      'claude-code': ['StopFailure']
    }
  },
  hookConfigTargets: [
    {
      id: 'global-codex',
      scope: 'global',
      source: 'codex',
      label: 'Codex 全局配置',
      projectPath: null,
      enabled: false
    },
    {
      id: 'global-claude-code',
      scope: 'global',
      source: 'claude-code',
      label: 'Claude Code 全局配置',
      projectPath: null,
      enabled: false
    }
  ]
};

const defaultProfileState = {
  activeProfileId: 'daily-coding',
  activeProfile: {
    id: 'daily-coding',
    name: 'Daily Coding',
    enabledHookEvents: [
      { source: 'codex', event: 'SessionStart' },
      { source: 'codex', event: 'UserPromptSubmit' }
    ],
    aiEventMappings: [
      {
        id: 'codex-session-start',
        source: 'codex',
        event: 'SessionStart',
        internalEvent: 'agent.started',
        enabled: true
      },
      {
        id: 'codex-user-prompt',
        source: 'codex',
        event: 'UserPromptSubmit',
        internalEvent: 'agent.started',
        enabled: true
      }
    ],
    hardwareRules: [
      {
        id: 'agent-started-system-notification',
        internalEvent: 'agent.started',
        output: {
          type: 'system-notification',
          durationMs: null,
          text: null,
          notificationLevel: 'info',
          notificationTitle: '{{source}} 开始处理任务',
          notificationBody: '模型：{{model}}，事件：{{event}}',
          notificationTitleMaxChars: 80,
          notificationBodyMaxChars: 300,
          notificationThrottleSeconds: 30,
          notificationSound: 'default'
        },
        priority: 60,
        enabled: true
      }
    ],
    device: { boardId: 'rp2040-pico', transport: 'serial' }
  },
  profiles: [{ id: 'daily-coding', name: 'Daily Coding', active: true }]
};

const defaultHookEventState = {
  catalog: [
    {
      source: 'codex',
      event: 'SessionStart',
      title: '会话开始',
      description: 'Codex 会话开始时触发。',
      scenario: '用于提示 AI 已进入工作状态。',
      defaultSelected: true,
      mappedNoticeEvent: 'agent.started'
    },
    {
      source: 'codex',
      event: 'UserPromptSubmit',
      title: '用户提交提示',
      description: '用户向 Codex 提交新提示时触发。',
      scenario: '用于提示新一轮 AI 工作即将开始。',
      defaultSelected: true,
      mappedNoticeEvent: 'agent.started'
    },
    {
      source: 'codex',
      event: 'SubagentStart',
      title: '子代理开始',
      description: 'Codex 启动子代理处理任务时触发。',
      scenario: '用于观察复杂任务中的子代理活动。',
      defaultSelected: false,
      mappedNoticeEvent: 'agent.running'
    },
    {
      source: 'claude-code',
      event: 'StopFailure',
      title: '停止失败',
      description: '停止流程失败时触发。',
      scenario: '用于提示任务结束阶段发生异常。',
      defaultSelected: true,
      mappedNoticeEvent: 'agent.failed'
    }
  ],
  selected: {
    bySource: {
      codex: ['SessionStart', 'UserPromptSubmit'],
      'claude-code': ['StopFailure']
    }
  },
  targets: [
    {
      id: 'global-codex',
      scope: 'global',
      source: 'codex',
      label: 'Codex 全局配置',
      projectPath: null,
      configPath: '/Users/test/.codex/hooks.json',
      enabled: false,
      exists: false,
      canCreate: true,
      matchesSelectedEvents: false,
      debugEnabled: false
    },
    {
      id: 'global-claude-code',
      scope: 'global',
      source: 'claude-code',
      label: 'Claude Code 全局配置',
      projectPath: null,
      configPath: '/Users/test/.claude/settings.json',
      enabled: false,
      exists: true,
      canCreate: false,
      matchesSelectedEvents: true,
      debugEnabled: false
    }
  ]
};

const defaultInternalEventCatalog = [
  {
    id: 'agent.running',
    title: 'AI 处理中',
    description: 'AI 正在处理任务。',
    scenario: '用户提交提示或会话恢复',
    builtIn: true
  },
  {
    id: 'agent.started',
    title: 'AI 开始工作',
    description: 'AI 开始处理任务。',
    scenario: '用户提交提示',
    builtIn: true
  },
  {
    id: 'session.ended',
    title: '会话结束',
    description: 'AI 会话或任务流程正常结束。',
    scenario: '会话或任务流程正常结束',
    builtIn: true
  }
];

const defaultRuntimeMonitorSnapshot = {
  startedAt: '2026-06-08T18:40:00Z',
  uptimeSeconds: 600,
  totalEvents: 1,
  totalOutputs: 1,
  totalFailures: 0,
  eventsBySource: [{ key: 'codex', count: 1 }],
  eventsByResult: [{ key: 'success', count: 1 }],
  outputAttemptsByType: [{ key: 'system-notification', count: 1 }],
  outputFailuresByType: [],
  eventSeries: [
    {
      bucketStart: '2026-06-08T18:50:00Z',
      source: 'codex',
      totalCount: 1,
      successCount: 1,
      failureCount: 0
    }
  ],
  outputSeries: [
    {
      bucketStart: '2026-06-08T18:50:00Z',
      outputType: 'system-notification',
      totalCount: 1,
      successCount: 1,
      failureCount: 0
    }
  ],
  runtimeErrorCount: 0,
  lastEvent: {
    source: 'codex',
    event: 'UserPromptSubmit',
    internalEvent: 'agent.started',
    result: 'success',
    occurredAt: '2026-06-08T18:50:00Z'
  },
  lastOutput: {
    outputType: 'system-notification',
    result: 'success',
    occurredAt: '2026-06-08T18:50:00Z'
  }
};

const defaultDiagnosticsSnapshot = {
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
      id: 'relay',
      status: 'ok',
      action: 'open-hook-settings',
      detail: null,
      checkedAt: '2026-07-08T10:00:00+08:00'
    },
    {
      id: 'hookConfig',
      status: 'warning',
      action: 'open-hook-settings',
      detail: null,
      checkedAt: '2026-07-08T10:00:00+08:00'
    },
    {
      id: 'profile',
      status: 'ok',
      action: 'open-ai-event-mapping',
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
  issues: [],
  quickActions: [
    { kind: 'refresh-diagnostics', enabled: true },
    { kind: 'auto-connect-registered-devices', enabled: true },
    { kind: 'send-test-event', enabled: true }
  ],
  deviceSummary: {
    registeredCount: 1,
    connectedCount: 0,
    offlineCount: 1,
    heartbeatIssueCount: 0,
    firmwareIssueCount: 0,
    referencedUnavailableCount: 0
  },
  deviceIssues: [],
  deviceHealth: {
    okCount: 0,
    warningCount: 1,
    errorCount: 0,
    details: [
      {
        deviceId: 'rp2040-pico-default',
        label: '默认 Pico',
        boardId: 'rp2040-pico',
        status: 'warning',
        checks: [
          {
            id: 'connection',
            status: 'warning',
            issueCode: 'disconnected',
            action: 'open-devices',
            detail: null
          }
        ]
      }
    ]
  },
};

const defaultDeviceRuntimeStates = [
  {
    deviceId: 'rp2040-pico-default',
    status: 'disconnected',
    boardId: 'rp2040-pico',
    transport: {
      kind: 'serial',
      serialPort: 'mock://rp2040-pico-default',
      baudRate: 115200
    },
    channels: [
      {
        id: 'pin.gp2',
        label: 'GP2 数字输出',
        kind: 'digital-output',
        description: null,
        physicalPin: 4,
        digitalOutput: {
          pin: 2,
          activeLevel: 'high',
          defaultLevel: 'low',
          allowBlink: true
        },
        pwmOutput: null,
        buzzer: null,
        addressableLed: null,
        supportedActions: ['activate', 'deactivate'],
        hardwareGuideId: 'rp2040-pico-digital-output'
      }
    ],
    firmwareInfo: null,
    bundledFirmwareVersion: null,
    firmwareStatus: 'unknown',
    firmwareCheckError: null,
    heartbeatStatus: 'unknown',
    lastHeartbeatAt: null,
    heartbeatFailureCount: 0,
    manualReconnectSuppressed: false,
    matchedResourceId: null,
    lastDiscoveredAt: null,
    lastAck: null,
    lastError: null,
    lastSentAt: null
  }
];

beforeEach(() => {
  invokeMock.mockReset();
  listenMock.mockReset();
  openMock.mockReset();
  listenMock.mockResolvedValue(vi.fn());
  openMock.mockResolvedValue('/workspace/project-a');
  invokeMock.mockImplementation(defaultInvoke);
});

function defaultInvoke(command: string, args?: unknown) {
    if (command === 'submit_relay_event') {
      return Promise.resolve({});
    }
    if (command === 'get_app_config') {
      return Promise.resolve(defaultConfig);
    }
    if (command === 'save_app_config') {
      return Promise.resolve({
        config: configFromInvokeArgs(args),
        restartRequired: false
      });
    }
    if (command === 'rotate_hook_auth_token') {
      return Promise.resolve();
    }
    if (command === 'reset_configuration') {
      return Promise.resolve({
        config: defaultConfig,
        profileState: defaultProfileState,
        hookEventState: defaultHookEventState,
        deviceStates: defaultDeviceRuntimeStates
      });
    }
    if (command === 'device_runtime_states') {
      return Promise.resolve(defaultDeviceRuntimeStates);
    }
    if (command === 'auto_connect_registered_devices') {
      return Promise.resolve(defaultDeviceRuntimeStates);
    }
    if (command === 'local_hook_server_status') {
      return Promise.resolve({
        running: true,
        port: 17321,
        bindAddress: '127.0.0.1:17321',
        eventUrl: 'http://127.0.0.1:17321/api/v1/events',
        healthUrl: 'http://127.0.0.1:17321/health',
        error: null
      });
    }
    if (command === 'debug_log_entries') {
      return Promise.resolve([
        {
          debugEntryId: 'debug-app-accepted',
          source: 'codex',
          event: 'UserPromptSubmit',
          payload: '{"captured":false,"source":"debug-page"}',
          result: 'accepted',
          internalEvent: 'agent.started',
          mappingStage: 'hardwareRule',
          noticeCommand: {
            commandType: 'Blink',
            priority: 80
          },
          outputs: [
            {
              type: 'system-notification',
              ruleId: 'agent-started-system-notification-output',
              command: {
                commandType: 'ShowText',
                text: '通知已发送',
                priority: 90
              }
            },
            {
              type: 'webhook',
              ruleId: 'agent-started-webhook-output',
              command: {
                commandType: 'ShowText',
                text: 'Webhook output queued',
                priority: 70
              }
            }
          ],
          occurredAt: '2026-06-08T18:50:00Z'
        },
        {
          debugEntryId: 'debug-app-error',
          source: 'claude-code',
          event: 'StopFailure',
          payload: '{"reason":"tool failed"}',
          result: 'error',
          internalEvent: null,
          mappingStage: 'aiEventMapping',
          noticeCommand: null,
          error: 'no ai event mapping for claude-code/StopFailure',
          occurredAt: '2026-06-08T18:51:00Z'
        }
      ]);
    }
    if (command === 'software_notice_state') {
      return Promise.resolve({
        lastEvent: 'agent.started',
        lastSource: 'codex'
      });
    }
    if (command === 'clear_debug_log') {
      return Promise.resolve();
    }
    if (command === 'hook_event_state') {
      return Promise.resolve(defaultHookEventState);
    }
    if (command === 'profile_state') {
      return Promise.resolve(defaultProfileState);
    }
    if (command === 'profile_template_list') {
      return Promise.resolve([
        {
          id: 'basic',
          name: '基础映射方案',
          description: '预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。',
          recommended: true
        }
      ]);
    }
    if (command === 'save_profile') {
      return Promise.resolve({
        ...defaultProfileState,
        activeProfile: (args as { profile: unknown }).profile
      });
    }
    if (command === 'create_profile') {
      return Promise.resolve({
        ...defaultProfileState,
        profiles: [
          ...defaultProfileState.profiles,
          {
            id: 'focus-mode-a1b2c3d4',
            name: (args as { profileName: string }).profileName,
            active: false
          }
        ]
      });
    }
    if (command === 'duplicate_profile') {
      return Promise.resolve({
        ...defaultProfileState,
        profiles: [
          ...defaultProfileState.profiles,
          {
            id: 'daily-copy-a1b2c3d4',
            name: (args as { profileName: string }).profileName,
            active: false
          }
        ]
      });
    }
    if (command === 'activate_profile') {
      return Promise.resolve(defaultProfileState);
    }
    if (command === 'delete_profile') {
      return Promise.resolve(defaultProfileState);
    }
    if (command === 'internal_event_catalog_command') {
      return Promise.resolve(defaultInternalEventCatalog);
    }
    if (command === 'create_custom_internal_event') {
      return Promise.resolve([
        ...defaultInternalEventCatalog,
        {
          id: 'review.started.userDefined',
          title: '评审开始',
          description: '代码评审流程开始',
          scenario: '用户提交 review 请求',
          builtIn: false
        }
      ]);
    }
    if (command === 'update_custom_internal_event') {
      return Promise.resolve(defaultInternalEventCatalog);
    }
    if (command === 'delete_custom_internal_event') {
      return Promise.resolve(defaultInternalEventCatalog);
    }
    if (command === 'runtime_monitor_snapshot') {
      return Promise.resolve(defaultRuntimeMonitorSnapshot);
    }
    if (command === 'diagnostics_snapshot') {
      return Promise.resolve(defaultDiagnosticsSnapshot);
    }
    if (command === 'add_hook_project_target') {
      return Promise.resolve({
        ...defaultHookEventState,
        targets: [
          ...defaultHookEventState.targets,
          {
            id: 'project-codex-abc',
            scope: 'project',
            source: 'codex',
            label: 'project-a',
            projectPath: '/workspace/project-a',
            configPath: '/workspace/project-a/.codex/hooks.json',
            exists: false,
            canCreate: true,
            matchesSelectedEvents: false,
            debugEnabled: false
          }
        ]
      });
    }
    if (command === 'remove_hook_config_target') {
      return Promise.resolve(defaultHookEventState);
    }
    if (command === 'preview_hook_config_target') {
      const targetId = (args as { targetId: string }).targetId;
      const isProject = targetId === 'project-codex-abc';
      return Promise.resolve({
        targetId,
        source: 'codex',
        configPath: isProject
          ? '/workspace/project-a/.codex/hooks.json'
          : '/Users/test/.codex/hooks.json',
        configExists: false,
        eventCount: 1,
        previewJson: '{"hooks":{"SessionStart":[{"hooks":[{"type":"command"}]}]}}',
        inlineHooksWarning: null
      });
    }
    if (command === 'write_hook_config_target') {
      const targetId = (args as { targetId: string }).targetId;
      const isProject = targetId === 'project-codex-abc';
      const configPath = isProject
        ? '/workspace/project-a/.codex/hooks.json'
        : '/Users/test/.codex/hooks.json';
      return Promise.resolve({
        targetId,
        source: 'codex',
        configPath,
        backupPath: `${configPath}.20260609T120000.bak`,
        eventCount: 1,
        inlineHooksWarning: null
      });
    }
    if (command === 'preview_restore_hook_config_target') {
      return Promise.resolve({
        targetId: (args as { targetId: string }).targetId,
        source: 'codex',
        configPath: '/Users/test/.codex/hooks.json',
        configExists: true,
        eventCount: 2,
        originalJson:
          '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"cc-notice-relay --source codex --event SessionStart","statusMessage":"CC Notice: SessionStart"}]}]}}',
        previewJson: '{"hooks":{"SessionStart":[{"hooks":[]}]}}',
        inlineHooksWarning: null
      });
    }
    if (command === 'restore_hook_config_target') {
      const targetId = (args as { targetId: string }).targetId;
      return Promise.resolve({
        targetId,
        source: 'codex',
        configPath: '/Users/test/.codex/hooks.json',
        backupPath: '/Users/test/.codex/hooks.json.20260609T121000.bak',
        eventCount: 2,
        inlineHooksWarning: null
      });
    }
    return Promise.resolve();
}

async function renderApp() {
  render(<App />);
  await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('local_hook_server_status'));
}

function invokeCallCount(command: string) {
  return invokeMock.mock.calls.filter(([calledCommand]) => calledCommand === command).length;
}

test('renders setup workflow and opens linked pages', async () => {
  await renderApp();

  expect(screen.getByRole('heading', { name: '接入配置' })).toBeInTheDocument();
  expect(screen.getByText('本地 Hook 服务运行正常')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开 Debug 页面测试' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '2 Hook 配置 配置 AI 工具 Hook' }));
  expect(screen.getByText('配置 Hook 事件')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '打开 Hook 设置页面' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '打开 Hook 设置页面' }));
  expect(await screen.findByRole('heading', { name: 'Hook 设置' })).toBeInTheDocument();
});

test('schedules registered device auto connection before devices page is opened', async () => {
  vi.useFakeTimers();
  const deviceStatesRequest = deferredPromise<typeof defaultDeviceRuntimeStates>();
  const reconnectableDeviceStates = defaultDeviceRuntimeStates.map((state) => ({
    ...state,
    deviceUid: 'rp2040-pico:0011223344556677'
  }));
  invokeMock.mockImplementation((command, args) => {
    if (command === 'device_runtime_states') {
      return deviceStatesRequest.promise;
    }
    return defaultInvoke(command, args);
  });

  try {
    render(<App />);
    await act(async () => {
      deviceStatesRequest.resolve(reconnectableDeviceStates);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '接入配置' })).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith('auto_connect_registered_devices');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(invokeMock).toHaveBeenCalledWith('auto_connect_registered_devices');
  } finally {
    vi.useRealTimers();
  }
});

test('switches navigation pages with current page titles', async () => {
  await renderApp();

  expect(screen.getByRole('button', { name: '设备' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '固件' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
  expect(screen.getByText('本地 Hook 接收服务')).toBeInTheDocument();
});

test('opens diagnostics center from navigation', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: '诊断中心' }));

  expect(await screen.findByRole('heading', { name: '诊断中心' })).toBeInTheDocument();
  expect(invokeMock).toHaveBeenCalledWith('diagnostics_snapshot');
});

test('opens diagnostics check from setup workflow', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: '5 接入检查 查看链路总览' }));

  expect(await screen.findByText('链路总览')).toBeInTheDocument();
  await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('diagnostics_snapshot'));

  fireEvent.click(screen.getByRole('button', { name: '打开诊断中心' }));
  expect(await screen.findByRole('heading', { name: '诊断中心' })).toBeInTheDocument();
});

test('diagnostics send test event action opens debug test dialog', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: '诊断中心' }));
  expect(await screen.findByRole('heading', { name: '诊断中心' })).toBeInTheDocument();

  fireEvent.click(await screen.findByRole('button', { name: '发送测试事件' }));

  expect(await screen.findByRole('dialog', { name: '发送测试事件' })).toBeInTheDocument();
});

test('navigates to settings when tray navigation event is received', async () => {
  let trayNavigate: ((event: { payload: unknown }) => void) | null = null;
  listenMock.mockImplementation(async (eventName, handler) => {
    if (eventName === 'cc-notice://navigate') {
      trayNavigate = handler as (event: { payload: unknown }) => void;
    }
    return vi.fn();
  });

  await renderApp();
  expect(screen.getByRole('heading', { name: '接入配置' })).toBeInTheDocument();

  act(() => {
    trayNavigate?.({ payload: 'settings' });
  });

  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
  expect(screen.getByText('本地 Hook 接收服务')).toBeInTheDocument();
});

test('saves desktop notice window bounds from runtime drag outside settings page', async () => {
  let boundsChanged: ((event: { payload: unknown }) => void) | null = null;
  listenMock.mockImplementation(async (eventName, handler) => {
    if (eventName === 'cc-notice://desktop-notice-window-bounds-changed') {
      boundsChanged = handler as (event: { payload: unknown }) => void;
    }
    return vi.fn();
  });
  invokeMock.mockImplementation((command, args) => {
    if (command === 'save_desktop_notice_window_bounds') {
      return Promise.resolve([]);
    }
    return defaultInvoke(command, args);
  });

  await renderApp();

  act(() => {
    boundsChanged?.({
      payload: { instanceId: 'desktop-notice-mascot', x: 240, y: 180, userInitiated: true }
    });
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('save_desktop_notice_window_bounds', {
      request: { instanceId: 'desktop-notice-mascot' }
    })
  );
});

test('saves desktop notice window bounds from runtime resize outside settings page', async () => {
  let boundsChanged: ((event: { payload: unknown }) => void) | null = null;
  listenMock.mockImplementation(async (eventName, handler) => {
    if (eventName === 'cc-notice://desktop-notice-window-bounds-changed') {
      boundsChanged = handler as (event: { payload: unknown }) => void;
    }
    return vi.fn();
  });
  invokeMock.mockImplementation((command, args) => {
    if (command === 'save_desktop_notice_window_bounds') {
      return Promise.resolve([]);
    }
    return defaultInvoke(command, args);
  });

  await renderApp();

  act(() => {
    boundsChanged?.({
      payload: { instanceId: 'desktop-notice-mascot', width: 320, height: 280, userInitiated: false }
    });
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('save_desktop_notice_window_bounds', {
      request: { instanceId: 'desktop-notice-mascot' }
    })
  );
});

test('logs warning when tray navigation listener fails to initialize', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  listenMock.mockImplementation(async (eventName) => {
    if (eventName === 'cc-notice://navigate') {
      throw new Error('listen failed');
    }

    return vi.fn();
  });

  await renderApp();

  await waitFor(() =>
    expect(warnSpy).toHaveBeenCalledWith(
      'failed to initialize tray navigation listener',
      expect.any(Error)
    )
  );
  warnSpy.mockRestore();
});

test('logs warning when device runtime listener fails to initialize', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  listenMock.mockImplementation(async (eventName) => {
    if (eventName === 'cc-notice://device-runtime-updated') {
      throw new Error('device listener failed');
    }

    return vi.fn();
  });

  await renderApp();

  await waitFor(() =>
    expect(warnSpy).toHaveBeenCalledWith(
      'failed to initialize device runtime listener',
      expect.any(Error)
    )
  );
  warnSpy.mockRestore();
});

test('hook settings selects events, previews and writes global target only', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'Hook 设置' }));
  expect(await screen.findByRole('heading', { name: 'Hook 设置' })).toBeInTheDocument();
  expect(screen.getByText('会话开始')).toBeInTheDocument();
  expect(screen.getByText('/Users/test/.codex/hooks.json')).toBeInTheDocument();
  expect(screen.getByLabelText('Debug')).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByText(/Debug 模式会写入 --debug/)).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByText('子代理开始'));
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('save_hook_event_selections', {
      selections: {
        bySource: {
          codex: ['SessionStart', 'UserPromptSubmit', 'SubagentStart'],
          'claude-code': ['StopFailure']
        }
      }
    })
  );
  expect(invokeMock).not.toHaveBeenCalledWith(
    'save_profile',
    expect.objectContaining({
      profile: expect.objectContaining({
        enabledHookEvents: expect.any(Array)
      })
    })
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '预览' }));
  });
  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('preview_hook_config_target', {
      targetId: 'global-codex',
      debug: true
    })
  );
  const dialog = await screen.findByRole('dialog', { name: '配置预览：Codex 全局配置' });
  expect(within(dialog).getByText('/Users/test/.codex/hooks.json')).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: '写入配置' }));
  });
  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('write_hook_config_target', {
      targetId: 'global-codex',
      debug: true
    })
  );

  expect(screen.queryByRole('button', { name: '添加项目目录' })).not.toBeInTheDocument();
  expect(screen.queryByText('project-a')).not.toBeInTheDocument();
});

test('hook settings previews managed hook restore before confirming file changes', async () => {
  invokeMock.mockImplementation((command, args) => {
    if (command === 'hook_event_state') {
      return Promise.resolve({
        ...defaultHookEventState,
        targets: defaultHookEventState.targets.map((target) =>
          target.id === 'global-codex'
            ? { ...target, exists: true, enabled: true, matchesSelectedEvents: true }
            : target
        )
      });
    }
    if (command === 'preview_restore_hook_config_target') {
      return Promise.resolve({
        targetId: (args as { targetId: string }).targetId,
        source: 'codex',
        configPath: '/Users/test/.codex/hooks.json',
        configExists: true,
        eventCount: 2,
        originalJson:
          '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"cc-notice-relay --source codex --event SessionStart","statusMessage":"CC Notice: SessionStart"}]}]}}',
        previewJson: '{"hooks":{"SessionStart":[{"hooks":[]}]}}',
        inlineHooksWarning: null
      });
    }
    if (command === 'restore_hook_config_target') {
      return Promise.resolve({
        targetId: (args as { targetId: string }).targetId,
        source: 'codex',
        configPath: '/Users/test/.codex/hooks.json',
        backupPath: '/Users/test/.codex/hooks.json.20260609T121000.bak',
        eventCount: 2,
        inlineHooksWarning: null
      });
    }
    return defaultInvoke(command, args);
  });

  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'Hook 设置' }));
  expect(await screen.findByRole('heading', { name: 'Hook 设置' })).toBeInTheDocument();

  const enableSwitch = screen.getByRole('switch', { name: '启用' });
  expect(enableSwitch).toHaveAttribute('aria-checked', 'true');

  await act(async () => {
    fireEvent.click(enableSwitch);
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('preview_restore_hook_config_target', {
      targetId: 'global-codex'
    })
  );
  expect(invokeMock).not.toHaveBeenCalledWith('restore_hook_config_target', {
    targetId: 'global-codex'
  });

  const dialog = await screen.findByRole('dialog', { name: '还原预览：Codex 全局配置' });
  expect(within(dialog).getByText('/Users/test/.codex/hooks.json')).toBeInTheDocument();
  expect(
    within(dialog).getByText('确认后将移除当前软件写入的 Hook 项，保留用户自己的配置。')
  ).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: '确认还原' }));
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('restore_hook_config_target', {
      targetId: 'global-codex'
    })
  );
});

test('hook settings previews warning before enabling global target switch', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'Hook 设置' }));
  expect(await screen.findByRole('heading', { name: 'Hook 设置' })).toBeInTheDocument();

  const enableSwitch = screen.getByRole('switch', { name: '启用' });
  expect(enableSwitch).toHaveAttribute('aria-checked', 'false');

  await act(async () => {
    fireEvent.click(enableSwitch);
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('preview_hook_config_target', {
      targetId: 'global-codex',
      debug: true
    })
  );
  expect(invokeMock).not.toHaveBeenCalledWith('write_hook_config_target', {
    targetId: 'global-codex',
    debug: true
  });

  const dialog = await screen.findByRole('dialog', { name: '配置预览：Codex 全局配置' });
  expect(
    within(dialog).getByText('启用全局配置会修改全局 Hook 文件，并自动禁用同源项目配置，避免重复上报。')
  ).toBeInTheDocument();
});

test('hook settings hides legacy project target from normal target list', async () => {
  invokeMock.mockImplementation((command, args) => {
    if (command === 'hook_event_state') {
      return Promise.resolve({
        ...defaultHookEventState,
        targets: [
          ...defaultHookEventState.targets,
          {
            id: 'project-codex-debug',
            scope: 'project',
            source: 'codex',
            label: 'project-debug',
            projectPath: '/workspace/project-debug',
            configPath: '/workspace/project-debug/.codex/hooks.json',
            enabled: false,
            exists: true,
            canCreate: true,
            matchesSelectedEvents: true,
            debugEnabled: true
          }
        ]
      });
    }
    if (command === 'submit_relay_event') {
      return Promise.resolve({});
    }
    if (command === 'get_app_config') {
      return Promise.resolve(defaultConfig);
    }
    if (command === 'save_app_config') {
      return Promise.resolve({
        config: configFromInvokeArgs(args),
        restartRequired: false
      });
    }
    if (command === 'local_hook_server_status') {
      return Promise.resolve({
        running: true,
        port: 17321,
        bindAddress: '127.0.0.1:17321',
        eventUrl: 'http://127.0.0.1:17321/api/v1/events',
        healthUrl: 'http://127.0.0.1:17321/health',
        error: null
      });
    }
    if (command === 'debug_log_entries') {
      return Promise.resolve([]);
    }
    if (command === 'software_notice_state') {
      return Promise.resolve({});
    }
    if (command === 'profile_state') {
      return Promise.resolve(defaultProfileState);
    }
    if (command === 'profile_template_list') {
      return Promise.resolve([]);
    }
    if (command === 'internal_event_catalog_command') {
      return Promise.resolve(defaultInternalEventCatalog);
    }
    if (command === 'preview_hook_config_target') {
      return Promise.resolve({
        targetId: (args as { targetId: string }).targetId,
        source: 'codex',
        configPath: '/workspace/project-debug/.codex/hooks.json',
        configExists: true,
        eventCount: 2,
        previewJson: '{"hooks":{}}',
        inlineHooksWarning: null
      });
    }
    return defaultInvoke(command, args);
  });

  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'Hook 设置' }));
  expect(screen.queryByText('project-debug')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '添加项目目录' })).not.toBeInTheDocument();
});

test('debug page submits test event refreshes state and clears log', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
  expect(await screen.findByText('本地 Hook 接收服务')).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: '发送测试事件' })[0]);
  });

  const testDialog = await screen.findByRole('dialog', { name: '发送测试事件' });
  expect(within(testDialog).getByText('UserPromptSubmit · 用户提交提示')).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(within(testDialog).getByRole('button', { name: '发送' }));
  });

  expect(await screen.findByText('UserPromptSubmit')).toBeInTheDocument();
  expect(screen.getByText('agent.started')).toBeInTheDocument();
  expect(invokeMock).toHaveBeenCalledWith('submit_relay_event', {
    request: {
      source: 'codex',
      event: 'UserPromptSubmit',
      payload: JSON.stringify({ captured: false, source: 'debug-page' }, null, 2),
      occurredAt: expect.any(String)
    }
  });

  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: '查看详情' })[0]);
  });
  const detailDialog = await screen.findByRole('dialog', { name: '事件详情' });
  expect(within(detailDialog).getByTestId('debug-lifecycle-summary')).toBeInTheDocument();
  expect(within(detailDialog).getByTestId('debug-lifecycle-timeline')).toBeInTheDocument();
  expect(within(detailDialog).getByText('生命周期摘要')).toBeInTheDocument();
  expect(within(detailDialog).getByText('输出执行')).toBeInTheDocument();
  expect(within(detailDialog).getByText('system-notification')).toBeInTheDocument();
  expect(within(detailDialog).getByText('agent-started-system-notification-output')).toBeInTheDocument();
  expect(within(detailDialog).getByText('webhook')).toBeInTheDocument();
  expect(within(detailDialog).getByText('agent-started-webhook-output')).toBeInTheDocument();
  expect(within(detailDialog).getByRole('textbox')).toHaveValue(
    ['{', '  "captured": false,', '  "source": "debug-page"', '}'].join('\n')
  );

  await act(async () => {
    fireEvent.click(within(detailDialog).getByRole('button', { name: 'Close' }));
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '清空日志' }));
  });
  expect(await screen.findByText('暂无 Debug 日志')).toBeInTheDocument();
});

test('debug page closes test dialog when submitted event is rejected by mapping', async () => {
  const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    invokeMock.mockImplementation((command, args) => {
      if (command === 'submit_relay_event') {
        return Promise.reject(new Error('no ai event mapping for codex/UserPromptSubmit'));
      }
      if (command === 'debug_log_entries') {
        return Promise.resolve([
          {
            debugEntryId: 'debug-app-rejected',
            source: 'codex',
            event: 'UserPromptSubmit',
            payload: '{"captured":false,"source":"debug-page"}',
            result: 'error',
            internalEvent: null,
            mappingStage: 'aiEventMapping',
            noticeCommand: null,
            error: 'no ai event mapping for codex/UserPromptSubmit',
            occurredAt: '2026-06-08T18:52:00Z'
          }
        ]);
      }
      if (command === 'get_app_config') {
        return Promise.resolve(defaultConfig);
      }
      if (command === 'save_app_config') {
        return Promise.resolve({
          config: configFromInvokeArgs(args),
          restartRequired: false
        });
      }
      if (command === 'local_hook_server_status') {
        return Promise.resolve({
          running: true,
          port: 17321,
          bindAddress: '127.0.0.1:17321',
          eventUrl: 'http://127.0.0.1:17321/api/v1/events',
          healthUrl: 'http://127.0.0.1:17321/health',
          error: null
        });
      }
      if (command === 'software_notice_state') {
        return Promise.resolve({});
      }
      if (command === 'hook_event_state') {
        return Promise.resolve(defaultHookEventState);
      }
      if (command === 'profile_state') {
        return Promise.resolve(defaultProfileState);
      }
      if (command === 'profile_template_list') {
        return Promise.resolve([]);
      }
      if (command === 'internal_event_catalog_command') {
        return Promise.resolve(defaultInternalEventCatalog);
      }
      if (command === 'clear_debug_log') {
        return Promise.resolve();
      }
      return defaultInvoke(command, args);
    });

    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
    expect(await screen.findByText('本地 Hook 接收服务')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: '发送测试事件' })[0]);
    });

    const testDialog = await screen.findByRole('dialog', { name: '发送测试事件' });

    await act(async () => {
      fireEvent.click(within(testDialog).getByRole('button', { name: '发送' }));
    });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '发送测试事件' })).not.toBeInTheDocument()
    );
    expect(await screen.findByText('no ai event mapping for codex/UserPromptSubmit')).toBeInTheDocument();
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'debug test event rejected; refreshing debug log',
      'no ai event mapping for codex/UserPromptSubmit'
    );
  } finally {
    consoleInfoSpy.mockRestore();
  }
});

test('debug page polls latest entries while open', async () => {
  await renderApp();
  vi.useFakeTimers();

  try {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
      await Promise.resolve();
    });

    const callsAfterOpen = invokeCallCount('debug_log_entries');

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    expect(invokeCallCount('debug_log_entries')).toBeGreaterThan(callsAfterOpen);
  } finally {
    vi.useRealTimers();
  }
});

test('monitor page polls latest entries while open', async () => {
  await renderApp();
  vi.useFakeTimers();

  try {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '运行监控' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('加载运行监控...')).toBeInTheDocument();
    const callsAfterOpen = invokeCallCount('debug_log_entries');

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    expect(invokeCallCount('debug_log_entries')).toBeGreaterThan(callsAfterOpen);
  } finally {
    vi.useRealTimers();
  }
});

test('debug page filters entries by source event and keyword', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'Debug' }));
  expect(await screen.findByText('UserPromptSubmit')).toBeInTheDocument();
  expect(screen.getByText('StopFailure')).toBeInTheDocument();

  await act(async () => {
    fireEvent.change(screen.getByLabelText('关键字'), {
      target: { value: 'tool failed' }
    });
  });
  expect(screen.queryByText('UserPromptSubmit')).not.toBeInTheDocument();
  expect(screen.getByText('StopFailure')).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
  });
  expect(screen.getByText('UserPromptSubmit')).toBeInTheDocument();
  expect(screen.getByText('StopFailure')).toBeInTheDocument();
});

test('rules page manages profiles and saves mappings', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'AI事件映射' }));
  expect(await screen.findByText('配置方案')).toBeInTheDocument();
  expect(screen.getByText('Daily Coding')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '可视化配置' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '输出规则设置' })).toBeInTheDocument();
  expect(await screen.findByText('Codex')).toBeInTheDocument();
  expect(screen.getByText('内部事件总览')).toBeInTheDocument();
  expect(screen.getByText('输出规则')).toBeInTheDocument();
  expect(screen.getByTestId('workflow-canvas-surface')).toBeInTheDocument();
  expect(screen.getAllByTestId('workflow-join-lines')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /Codex/ }));
  expect(await screen.findByRole('dialog', { name: 'Codex Hook 映射' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '编辑 AI 映射' }));
  expect(await screen.findByText('AI Hook 到内部事件')).toBeInTheDocument();
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name: '可视化配置' }), {
      button: 0,
      ctrlKey: false
    });
  });
  fireEvent.click(screen.getByRole('button', { name: /输出规则/ }));
  expect(await screen.findByRole('dialog', { name: '输出规则' })).toBeInTheDocument();
  expect(screen.getAllByText('添加并配置').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'AI事件映射' }), {
      button: 0,
      ctrlKey: false
    });
  });
  expect(await screen.findByText('SessionStart')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '新建' }));
  const createDialog = await screen.findByRole('dialog', { name: '新建配置方案' });
  fireEvent.change(within(createDialog).getByLabelText('方案名称'), {
    target: { value: '专注模式' }
  });
  await act(async () => {
    fireEvent.click(within(createDialog).getByRole('button', { name: '新建' }));
  });
  expect(invokeMock).toHaveBeenCalledWith('create_profile', {
    profileId: '',
    profileName: '专注模式',
    template: 'basic'
  });
});

test('rules visual workflow opens hook settings from empty global hook settings', async () => {
  const emptyHookSelections = { bySource: {} };
  invokeMock.mockImplementation((command, args) => {
    if (command === 'get_app_config') {
      return Promise.resolve({
        ...defaultConfig,
        hookEventSelections: emptyHookSelections
      });
    }
    if (command === 'hook_event_state') {
      return Promise.resolve({
        ...defaultHookEventState,
        selected: emptyHookSelections
      });
    }
    if (command === 'profile_state') {
      return Promise.resolve({
        ...defaultProfileState,
        activeProfile: {
          ...defaultProfileState.activeProfile,
          enabledHookEvents: defaultProfileState.activeProfile.enabledHookEvents,
          aiEventMappings: [],
          hardwareRules: []
        }
      });
    }
    return defaultInvoke(command, args);
  });

  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'AI事件映射' }));
  expect(await screen.findByText('Hook 设置中还没有启用事件')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '前往 Hook 设置' }));

  expect(await screen.findByRole('heading', { name: 'Hook 设置' })).toBeInTheDocument();
});

test('rules page refreshes internal event catalog after creating custom internal event', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: 'AI事件映射' }));
  expect(await screen.findByText('内部事件目录')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '新增自定义事件' }));
  const dialog = await screen.findByRole('dialog', { name: '新增自定义内部事件' });
  fireEvent.change(within(dialog).getByLabelText('事件标识前缀'), {
    target: { value: 'review.started' }
  });
  fireEvent.change(within(dialog).getByLabelText('备注名称'), {
    target: { value: '评审开始' }
  });
  fireEvent.change(within(dialog).getByLabelText('描述'), {
    target: { value: '代码评审流程开始' }
  });
  fireEvent.change(within(dialog).getByLabelText('使用场景'), {
    target: { value: '用户提交 review 请求' }
  });

  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }));
  });

  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith('create_custom_internal_event', {
      request: {
        idPrefix: 'review.started',
        title: '评审开始',
        description: '代码评审流程开始',
        scenario: '用户提交 review 请求'
      }
    })
  );
  expect(await screen.findByText('review.started.userDefined')).toBeInTheDocument();
});

test('settings saves port language and rotates hook token', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
  expect(screen.getByText('本地 Hook 接收服务')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('接收端口'), { target: { value: '18080' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存端口' }));
  });
  expect(invokeMock).toHaveBeenCalledWith('save_app_config', {
    config: {
      ...defaultConfig,
      localHookServer: { port: 18080 }
    }
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '刷新 Token' }));
  });
  expect(invokeMock).toHaveBeenCalledWith('rotate_hook_auth_token');

  fireEvent.click(screen.getByRole('combobox', { name: '界面语言' }));
  fireEvent.click(await screen.findByRole('option', { name: 'English' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存语言' }));
  });
  expect(invokeMock).toHaveBeenCalledWith('save_app_config', {
    config: {
      ...defaultConfig,
      localHookServer: { port: 18080 },
      ui: { language: 'en-US', themeMode: 'system' }
    }
  });
  expect(await screen.findByRole('button', { name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByText('Local Hook Server')).toBeInTheDocument();
});

test('settings serializes app config saves to avoid stale config overwrites', async () => {
  const saveRequests: unknown[] = [];
  const saveDeferreds: Array<ReturnType<typeof deferredPromise<{ config: unknown; restartRequired: boolean }>>> =
    [];
  invokeMock.mockImplementation((command, args) => {
    if (command === 'save_app_config') {
      const saveDeferred = deferredPromise<{ config: unknown; restartRequired: boolean }>();
      saveRequests.push(configFromInvokeArgs(args));
      saveDeferreds.push(saveDeferred);
      return saveDeferred.promise;
    }

    return defaultInvoke(command, args);
  });

  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('接收端口'), { target: { value: '18080' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '保存端口' }));
  });
  await waitFor(() => expect(saveRequests).toHaveLength(1));

  fireEvent.click(screen.getByRole('switch', { name: '关闭窗口时隐藏到系统托盘' }));
  expect(saveRequests).toHaveLength(1);

  await act(async () => {
    saveDeferreds[0].resolve({
      config: saveRequests[0],
      restartRequired: false
    });
    await Promise.resolve();
  });

  await waitFor(() => expect(saveRequests).toHaveLength(2));
  expect(saveRequests[1]).toMatchObject({
    localHookServer: { port: 18080 },
    window: {
      closeBehavior: 'exit',
      startupMode: 'normal',
      launchAtLogin: false,
      hideWindowOnLoginLaunch: true
    }
  });

  await act(async () => {
    saveDeferreds[1].resolve({
      config: saveRequests[1],
      restartRequired: false
    });
    await Promise.resolve();
  });
});

test('settings resets device configuration after confirmation', async () => {
  await renderApp();

  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
  expect(screen.getByText('重置配置')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '重置设备配置' }));
  const dialog = await screen.findByRole('alertdialog', { name: '重置设备配置' });
  expect(within(dialog).getByText(/将设备列表和设备通道恢复为默认 RP2040 Pico 配置/)).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: '确认重置' }));
  });

  expect(invokeMock).toHaveBeenCalledWith('reset_configuration', { scope: 'devices' });
});
