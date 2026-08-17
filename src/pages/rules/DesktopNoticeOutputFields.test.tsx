import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HardwareOutput } from '@/api/tauriApi';
import { createDefaultMascotSettings } from '@/domain/desktopMascot';
import { DesktopNoticeInstance, DesktopNoticeRuleTarget } from '@/domain/desktopNotice';
import { I18nProvider } from '@/i18n';
import { DesktopNoticeOutputFields } from './DesktopNoticeOutputFields';

const previewDesktopNoticeRuleEffectMock = vi.hoisted(() => vi.fn());
const getDesktopMascotAssetPacksMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ rootDir: '~/.cc-notice/mascots', packs: [], diagnostics: [] })
);

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    getDesktopMascotAssetPacks: getDesktopMascotAssetPacksMock,
    previewDesktopNoticeRuleEffect: previewDesktopNoticeRuleEffectMock
  };
});

vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>('@tauri-apps/api/core');
  return {
    ...actual,
    convertFileSrc: (path: string) => `asset://localhost/${path}`
  };
});

vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: ({ src }: { src: string }) => <div data-testid="dotlottie" data-src={src} />,
  setWasmUrl: vi.fn()
}));

const instances: DesktopNoticeInstance[] = [
  {
    id: 'notice-main',
    name: '顶部灯条',
    variant: 'custom-lightbar',
    enabled: true,
    showOnStartup: false,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: {
      presetPosition: 'top-center',
      direction: 'horizontal',
      size: { width: 720, height: 32 },
      opacityPercent: 100,
      cornerRadiusPercent: 0,
      boundsOverride: null
    },
    edgeLightbar: null
  },
  {
    id: 'notice-side',
    name: '侧边灯条',
    variant: 'custom-lightbar',
    enabled: true,
    showOnStartup: false,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: {
      presetPosition: 'right-center',
      direction: 'vertical',
      size: { width: 32, height: 720 },
      opacityPercent: 100,
      cornerRadiusPercent: 0,
      boundsOverride: null
    },
    edgeLightbar: null
  },
  {
    id: 'notice-mascot',
    name: '桌面精灵',
    variant: 'mascot',
    enabled: true,
    showOnStartup: true,
    alwaysOnTop: true,
    idleBehavior: 'hidden',
    customLightbar: null,
    edgeLightbar: null,
    mascot: createDefaultMascotSettings()
  }
];

const instancesWithMascotBubble: DesktopNoticeInstance[] = instances.map((instance) =>
  instance.id === 'notice-mascot'
    ? {
        ...instance,
        mascot: {
          ...createDefaultMascotSettings(),
          bubbleEnabled: true
        }
      }
    : instance
);

type DesktopNoticeOutputOverrides = Partial<HardwareOutput> & {
  targetIds?: string[];
  effect?: DesktopNoticeRuleTarget['effect'];
  colorMode?: DesktopNoticeRuleTarget['colorMode'];
  colors?: DesktopNoticeRuleTarget['colors'];
  durationMs?: number;
  breathingPeriodMs?: number;
  animationPeriodMs?: number;
  opacityPercent?: number;
  brightnessPercent?: number;
  restoreBehavior?: 'use-instance-idle' | 'hide' | 'keep-last' | 'dim-placeholder' | 'restore-default';
  edge?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
};

function output(overrides: DesktopNoticeOutputOverrides = {}): HardwareOutput {
  const targetIds = overrides.targetIds ?? ['notice-main'];
  const desktopNoticeTargets =
    overrides.desktopNoticeTargets ??
    targetIds.map((targetId) => ({
      targetId,
      effect: overrides.effect ?? 'breathing',
      colorMode: overrides.colorMode ?? 'solid',
      colors: overrides.colors ?? [{ color: '#22C55E', position: 0 }],
      durationMs: overrides.durationMs ?? 3000,
      breathingPeriodMs: overrides.breathingPeriodMs ?? 1600,
      animationPeriodMs: overrides.animationPeriodMs ?? overrides.breathingPeriodMs ?? 1600,
      opacityPercent: overrides.opacityPercent ?? 100,
      brightnessPercent: overrides.brightnessPercent ?? 100,
      restoreBehavior: overrides.restoreBehavior ?? 'use-instance-idle',
      edge: overrides.edge ?? 'auto'
    }));
  return {
    type: 'desktop-notice',
    durationMs: null,
    desktopNoticeTargets
  };
}

function renderFields(
  currentOutput: HardwareOutput,
  onChange = vi.fn(),
  noticeInstances = instances
) {
  render(
    <I18nProvider language="zh-CN">
      <DesktopNoticeOutputFields
        output={currentOutput}
        instances={noticeInstances}
        onChange={onChange}
      />
    </I18nProvider>
  );
  return onChange;
}

describe('DesktopNoticeOutputFields', () => {
  beforeEach(() => {
    previewDesktopNoticeRuleEffectMock.mockReset();
    previewDesktopNoticeRuleEffectMock.mockResolvedValue(undefined);
    getDesktopMascotAssetPacksMock.mockReset();
    getDesktopMascotAssetPacksMock.mockResolvedValue({
      rootDir: '~/.cc-notice/mascots',
      packs: [],
      diagnostics: []
    });
  });

  test('hides gradient-only controls in solid color mode', () => {
    renderFields(output());

    expect(screen.getByText('预设颜色')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /编辑纯色/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /删除色标/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /添加色标/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /色标/ })).not.toBeInTheDocument();
  });

  test('updates only the selected desktop notice target configuration', () => {
    const onChange = renderFields({
      type: 'desktop-notice',
      durationMs: null,
      desktopNoticeTargets: [
        {
          targetId: 'notice-main',
          effect: 'solid',
          colorMode: 'solid',
          colors: [{ color: '#22C55E', position: 0 }],
          durationMs: 3000,
          breathingPeriodMs: 1600,
          opacityPercent: 100,
          brightnessPercent: 100,
          restoreBehavior: 'use-instance-idle',
          edge: 'auto'
        },
        {
          targetId: 'notice-side',
          effect: 'edge-breathing',
          colorMode: 'solid',
          colors: [{ color: '#38BDF8', position: 0 }],
          durationMs: 5000,
          breathingPeriodMs: 1600,
          opacityPercent: 80,
          brightnessPercent: 90,
          restoreBehavior: 'keep-last',
          edge: 'right'
        }
      ]
    } as HardwareOutput);

    fireEvent.click(screen.getByRole('button', { name: /侧边灯条/ }));
    fireEvent.click(screen.getByRole('button', { name: /编辑纯色/ }));
    fireEvent.change(screen.getByLabelText('HEX 色号'), {
      target: { value: '#EF4444' }
    });
    fireEvent.click(screen.getByRole('button', { name: '应用颜色' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            targetId: 'notice-main',
            colors: [{ color: '#22C55E', position: 0 }]
          }),
          expect.objectContaining({
            targetId: 'notice-side',
            colors: [{ color: '#EF4444', position: 0 }]
          })
        ]
      })
    );
  });

  test('shows mascot fields for mascot target and lightbar fields for lightbar target', () => {
    renderFields(
      output({
        desktopNoticeTargets: [
          {
            targetId: 'notice-main',
            effect: 'solid',
            colorMode: 'solid',
            colors: [{ color: '#22C55E', position: 0 }],
            durationMs: 3000,
            breathingPeriodMs: undefined,
            animationPeriodMs: undefined,
            opacityPercent: 100,
            brightnessPercent: 100,
            restoreBehavior: 'use-instance-idle',
            edge: 'auto'
          },
          {
            targetId: 'notice-mascot',
            effect: 'solid',
            colorMode: 'solid',
            colors: [{ color: '#38BDF8', position: 0 }],
            durationMs: 3000,
            breathingPeriodMs: undefined,
            animationPeriodMs: undefined,
            opacityPercent: 100,
            brightnessPercent: 100,
            restoreBehavior: 'use-instance-idle',
            edge: 'auto',
            mascotState: 'task-received',
            mascotActionId: 'task-received.wave',
            mascotBubbleTemplate: '收到任务'
          }
        ]
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /桌面精灵/ }));
    expect(screen.getByLabelText('语义状态')).toBeInTheDocument();
    expect(screen.queryByLabelText('气泡文本')).not.toBeInTheDocument();
    expect(screen.queryByText('颜色模式')).not.toBeInTheDocument();
    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('wave')
    );
    expect(screen.queryByDisplayValue('收到任务')).not.toBeInTheDocument();
    expect(screen.queryByTestId('desktop-notice-rule-preview-lightbar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /顶部灯条/ }));
    expect(screen.getByText('颜色模式')).toBeInTheDocument();
    expect(screen.queryByLabelText('语义状态')).not.toBeInTheDocument();
  });

  test('shows mascot bubble field only when target mascot enables bubbles', () => {
    renderFields(
      output({
        desktopNoticeTargets: [
          {
            targetId: 'notice-mascot',
            effect: 'solid',
            colorMode: 'solid',
            colors: [{ color: '#38BDF8', position: 0 }],
            durationMs: 3000,
            breathingPeriodMs: undefined,
            animationPeriodMs: undefined,
            opacityPercent: 100,
            brightnessPercent: 100,
            restoreBehavior: 'use-instance-idle',
            edge: 'auto',
            mascotState: 'task-received',
            mascotActionId: 'task-received.wave',
            mascotBubbleTemplate: '收到任务'
          }
        ]
      }),
      vi.fn(),
      instancesWithMascotBubble
    );

    expect(screen.getByLabelText('气泡文本')).toBeInTheDocument();
    expect(screen.getAllByText('收到任务').length).toBeGreaterThan(0);
  });

  test('only shows mascot states provided by selected local custom pack', async () => {
    getDesktopMascotAssetPacksMock.mockResolvedValueOnce({
      rootDir: '~/.cc-notice/mascots',
      packs: [
        {
          id: 'local-basic',
          name: '本地基础精灵',
          version: '1.0.0',
          renderer: 'gif',
          source: 'local',
          animations: {
            sleep: '/Users/test/.cc-notice/mascots/local-basic/sleep.gif',
            wave: '/Users/test/.cc-notice/mascots/local-basic/wave.gif'
          },
          states: ['idle', 'task-received'],
          actions: [
            {
              id: 'idle.sleep',
              label: '睡觉',
              state: 'idle',
              animation: 'sleep',
              playMode: 'loop',
              interruptible: true
            },
            {
              id: 'task-received.wave',
              label: '挥手',
              state: 'task-received',
              animation: 'wave',
              playMode: 'once-then-idle',
              interruptible: true
            }
          ],
          interactions: {
            hoverActionId: 'idle.sleep',
            clickActionId: 'task-received.wave'
          }
        }
      ],
      diagnostics: []
    });
    const localMascotInstances = instances.map((instance) =>
      instance.id === 'notice-mascot'
        ? {
            ...instance,
            mascot: {
              ...createDefaultMascotSettings(),
              assetPackId: 'local-basic'
            }
          }
        : instance
    );

    render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields
          output={output({
            desktopNoticeTargets: [
              {
                targetId: 'notice-mascot',
                effect: 'solid',
                colorMode: 'solid',
                colors: [{ color: '#38BDF8', position: 0 }],
                durationMs: 3000,
                opacityPercent: 100,
                brightnessPercent: 100,
                restoreBehavior: 'use-instance-idle',
                edge: 'auto',
                mascotState: 'task-received',
                mascotActionId: 'task-received.wave',
                mascotBubbleTemplate: '收到任务'
              }
            ]
          })}
          instances={localMascotInstances}
          onChange={vi.fn()}
        />
      </I18nProvider>
    );

    await waitFor(() => expect(getDesktopMascotAssetPacksMock).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('语义状态'));
    const listbox = screen.getByRole('listbox');

    expect(within(listbox).getByText('收到任务')).toBeInTheDocument();
    expect(within(listbox).getByText('空闲')).toBeInTheDocument();
    expect(within(listbox).queryByText('等待输入')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('思考中')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('警告')).not.toBeInTheDocument();
  });

  test('prevents mascot bubble text over the line limit', () => {
    renderFields(
      output({
        desktopNoticeTargets: [
          {
            targetId: 'notice-mascot',
            effect: 'solid',
            colorMode: 'solid',
            colors: [{ color: '#38BDF8', position: 0 }],
            durationMs: 3000,
            breathingPeriodMs: undefined,
            animationPeriodMs: undefined,
            opacityPercent: 100,
            brightnessPercent: 100,
            restoreBehavior: 'use-instance-idle',
            edge: 'auto',
            mascotState: 'task-received',
            mascotActionId: 'task-received.wave',
            mascotBubbleTemplate: ''
          }
        ]
      }),
      vi.fn(),
      instancesWithMascotBubble
    );

    fireEvent.change(screen.getByLabelText('气泡文本'), {
      target: { value: '第一行\n第二行\n第三行' }
    });

    expect(screen.getByText('最多 2 行，每行最多 18 个字符。')).toBeInTheDocument();
  });

  test('updates mascot play mode and passes it to actual preview', async () => {
    let currentOutput = output({
      desktopNoticeTargets: [
        {
          targetId: 'notice-mascot',
          effect: 'solid',
          colorMode: 'solid',
          colors: [{ color: '#38BDF8', position: 0 }],
          durationMs: 3000,
          breathingPeriodMs: undefined,
          animationPeriodMs: undefined,
          opacityPercent: 100,
          brightnessPercent: 100,
          restoreBehavior: 'use-instance-idle',
          edge: 'auto',
          mascotState: 'task-received',
          mascotActionId: 'task-received.wave',
          mascotBubbleTemplate: '收到任务'
        }
      ]
    });
    const onChange = vi.fn((nextOutput: HardwareOutput) => {
      currentOutput = nextOutput;
    });
    const { rerender } = render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByLabelText('播放方式'));
    fireEvent.click(screen.getByRole('option', { name: '播放一次后回到空闲态' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            mascotPlayMode: 'once-then-idle'
          })
        ]
      })
    );
    rerender(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '实际效果预览' }));

    await waitFor(() =>
      expect(previewDesktopNoticeRuleEffectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mascotPlayMode: 'once-then-idle',
          mascotBubbleText: null
        })
      )
    );
  });

  test('shows one-shot playback window only for once mascot play modes', async () => {
    let currentOutput = output({
      desktopNoticeTargets: [
        {
          targetId: 'notice-mascot',
          effect: 'solid',
          colorMode: 'solid',
          colors: [{ color: '#38BDF8', position: 0 }],
          durationMs: 3000,
          opacityPercent: 100,
          brightnessPercent: 100,
          restoreBehavior: 'use-instance-idle',
          edge: 'auto',
          mascotState: 'task-received',
          mascotActionId: 'task-received.wave',
          mascotPlayMode: 'loop',
          mascotBubbleTemplate: '收到任务'
        }
      ]
    });
    const onChange = vi.fn((nextOutput: HardwareOutput) => {
      currentOutput = nextOutput;
    });
    const { rerender } = render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    expect(screen.queryByLabelText('单次播放窗口（毫秒）')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('播放方式'));
    fireEvent.click(screen.getByRole('option', { name: '播放一次后停留' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            mascotPlayMode: 'once-then-hold',
            mascotPlaybackWindowMs: 1800
          })
        ]
      })
    );
    rerender(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    expect(screen.getByLabelText('单次播放窗口（毫秒）')).toHaveValue(1800);
  });

  test('keeps mascot playback window numeric draft editable and passes it to preview', async () => {
    let currentOutput = output({
      desktopNoticeTargets: [
        {
          targetId: 'notice-mascot',
          effect: 'solid',
          colorMode: 'solid',
          colors: [{ color: '#38BDF8', position: 0 }],
          durationMs: 3000,
          opacityPercent: 100,
          brightnessPercent: 100,
          restoreBehavior: 'use-instance-idle',
          edge: 'auto',
          mascotState: 'task-received',
          mascotActionId: 'task-received.wave',
          mascotPlayMode: 'once-then-idle',
          mascotPlaybackWindowMs: 1800,
          mascotBubbleTemplate: '收到任务'
        }
      ]
    });
    const onChange = vi.fn((nextOutput: HardwareOutput) => {
      currentOutput = nextOutput;
    });
    const { rerender } = render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );
    const playbackWindowInput = screen.getByLabelText('单次播放窗口（毫秒）');

    fireEvent.change(playbackWindowInput, { target: { value: '1' } });
    expect(playbackWindowInput).toHaveValue(1);
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            mascotPlaybackWindowMs: 1
          })
        ]
      })
    );

    fireEvent.change(playbackWindowInput, { target: { value: '2600' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            mascotPlaybackWindowMs: 2600
          })
        ]
      })
    );
    rerender(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '实际效果预览' }));

    await waitFor(() =>
      expect(previewDesktopNoticeRuleEffectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mascotPlaybackWindowMs: 2600
        })
      )
    );
  });

  test('applies preset color to selected gradient stop only', () => {
    const onChange = renderFields(
      output({
        colorMode: 'gradient',
        colors: [
          { color: '#22C55E', position: 0 },
          { color: '#38BDF8', position: 45 },
          { color: '#A855F7', position: 100 }
        ]
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /选择渐变预览色标 2/ }));
    fireEvent.click(screen.getByRole('button', { name: /预设颜色 #EF4444/ }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            colors: [
              { color: '#22C55E', position: 0 },
              { color: '#EF4444', position: 45 },
              { color: '#A855F7', position: 100 }
            ]
          })
        ]
      })
    );
  });

  test('updates selected gradient stop position with slider', () => {
    const onChange = renderFields(
      output({
        colorMode: 'gradient',
        colors: [
          { color: '#22C55E', position: 0 },
          { color: '#38BDF8', position: 45 }
        ]
      })
    );

    fireEvent.change(screen.getByRole('slider', { name: '色标 2 位置' }), {
      target: { value: '60' }
    });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            colors: [
              { color: '#22C55E', position: 0 },
              { color: '#38BDF8', position: 60 }
            ]
          })
        ]
      })
    );
  });

  test('selects newly added gradient stop after sorting stops by position', () => {
    let currentOutput = output({
      colorMode: 'gradient',
      colors: [
        { color: '#22C55E', position: 0 },
        { color: '#38BDF8', position: 100 }
      ]
    });
    const onChange = vi.fn((nextOutput: HardwareOutput) => {
      currentOutput = nextOutput;
    });
    const { rerender } = render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '添加渐变色标' }));
    rerender(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: /预设颜色 #EF4444/ }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            colors: [
              { color: '#22C55E', position: 0 },
              { color: '#EF4444', position: 67 },
              { color: '#38BDF8', position: 100 }
            ]
          })
        ]
      })
    );
  });

  test('disables eyedropper button when browser API is unavailable', () => {
    renderFields(output());

    fireEvent.click(screen.getByRole('button', { name: /编辑纯色/ }));

    expect(screen.getByRole('button', { name: '从屏幕吸取颜色' })).toBeDisabled();
    expect(screen.getByText('当前运行环境不支持屏幕吸色')).toBeInTheDocument();
  });

  test('updates solid color from color editor hex input', () => {
    const onChange = renderFields(output());

    fireEvent.click(screen.getByRole('button', { name: /编辑纯色/ }));
    fireEvent.change(screen.getByLabelText('HEX 色号'), {
      target: { value: '#EF4444' }
    });
    fireEvent.click(screen.getByRole('button', { name: '应用颜色' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            colors: [{ color: '#EF4444', position: 0 }]
          })
        ]
      })
    );
  });

  test('selects gradient stop label without opening color editor', () => {
    renderFields(
      output({
        colorMode: 'gradient',
        colors: [
          { color: '#22C55E', position: 0 },
          { color: '#38BDF8', position: 100 }
        ]
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '选择渐变预览色标 2' }));

    expect(screen.queryByText('当前：色标 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /编辑色标 2/ })).not.toBeInTheDocument();
  });

  test('does not render explicit gradient stop titles in the editable list', () => {
    renderFields(
      output({
        colorMode: 'gradient',
        colors: [
          { color: '#22C55E', position: 0 },
          { color: '#38BDF8', position: 100 }
        ]
      })
    );

    expect(screen.queryByText('色标 1')).not.toBeInTheDocument();
    expect(screen.queryByText('色标 2')).not.toBeInTheDocument();
  });

  test('opens color editor for clicked gradient swatch', () => {
    renderFields(
      output({
        colorMode: 'gradient',
        colors: [
          { color: '#22C55E', position: 0 },
          { color: '#38BDF8', position: 100 }
        ]
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑色标 2 #38BDF8' }));

    expect(screen.getByRole('dialog', { name: '编辑色标 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('HEX 色号')).toHaveValue('#38BDF8');
  });

  test('shows restore behavior and breathing period for breathing effect', () => {
    renderFields(output({ effect: 'breathing', breathingPeriodMs: 2400 }));

    expect(screen.getByLabelText('结束行为')).toBeInTheDocument();
    expect(screen.getByLabelText('呼吸周期（毫秒）')).toHaveValue(2400);
  });

  test('shows breathing period for edge breathing effect', () => {
    renderFields(output({ effect: 'edge-breathing', breathingPeriodMs: 2400 }));

    expect(screen.getByLabelText('呼吸周期（毫秒）')).toHaveValue(2400);
  });

  test('keeps partial animation period input while editing before committing a valid value', () => {
    let currentOutput = output({ effect: 'edge-breathing', animationPeriodMs: 1600 });
    const onChange = vi.fn((nextOutput: HardwareOutput) => {
      currentOutput = nextOutput;
    });
    const { rerender } = render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText('呼吸周期（毫秒）'), { target: { value: '1' } });
    rerender(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields output={currentOutput} instances={instances} onChange={onChange} />
      </I18nProvider>
    );

    expect(screen.getByLabelText('呼吸周期（毫秒）')).toHaveValue(1);
    expect(currentOutput.desktopNoticeTargets?.[0]).toEqual(
      expect.objectContaining({ animationPeriodMs: 1600 })
    );

    fireEvent.change(screen.getByLabelText('呼吸周期（毫秒）'), { target: { value: '1000' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            animationPeriodMs: 1000,
            breathingPeriodMs: 1000
          })
        ]
      })
    );
  });

  test('shows animation period for blink and scan effects', () => {
    const { rerender } = render(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields
          output={output({ effect: 'blink', animationPeriodMs: 900 })}
          instances={instances}
          onChange={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText('动画周期（毫秒）')).toHaveValue(900);

    rerender(
      <I18nProvider language="zh-CN">
        <DesktopNoticeOutputFields
          output={output({ effect: 'scan', animationPeriodMs: 2200 })}
          instances={instances}
          onChange={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText('动画周期（毫秒）')).toHaveValue(2200);
  });

  test('uses the selected effect default period when switching animated effects', () => {
    const onChange = renderFields(output({ effect: 'breathing', animationPeriodMs: 1600 }));

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByRole('option', { name: '扫描' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [
          expect.objectContaining({
            effect: 'scan',
            animationPeriodMs: 2200,
            breathingPeriodMs: undefined
          })
        ]
      })
    );
  });

  test('hides animation period for non-animated effects', () => {
    renderFields(output({ effect: 'solid' }));

    expect(screen.queryByLabelText('呼吸周期（毫秒）')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('动画周期（毫秒）')).not.toBeInTheDocument();
  });

  test('renders rule effect preview with selected effect class', () => {
    renderFields(
      output({
        effect: 'scan',
        colorMode: 'gradient',
        colors: [
          { color: '#22C55E', position: 0 },
          { color: '#38BDF8', position: 100 }
        ]
      })
    );

    expect(screen.getByTestId('desktop-notice-rule-preview-lightbar')).toHaveClass(
      'desktop-notice-rule-preview-scan'
    );
  });

  test('uses configured animation period in inline scan preview', () => {
    renderFields(output({ effect: 'scan', animationPeriodMs: 2400 }));

    expect(screen.getByTestId('desktop-notice-rule-preview-scan-overlay')).toHaveStyle({
      animationDuration: '2400ms'
    });
  });

  test('renders scan preview overlay inside preview lightbar', () => {
    renderFields(output({ effect: 'scan' }));

    const lightbar = screen.getByTestId('desktop-notice-rule-preview-lightbar');
    const overlay = screen.getByTestId('desktop-notice-rule-preview-scan-overlay');

    expect(lightbar).toContainElement(overlay);
  });

  test('shows edge breathing as an available output effect', () => {
    renderFields(output());

    fireEvent.click(screen.getAllByRole('combobox')[0]);
    expect(screen.getByRole('option', { name: '边缘呼吸' })).toBeInTheDocument();
  });

  test('hides dim placeholder from rule end behavior options', () => {
    renderFields(output({ restoreBehavior: 'use-instance-idle' }));

    fireEvent.click(screen.getByRole('combobox', { name: '结束行为' }));

    expect(screen.getByRole('option', { name: '使用实例空闲态' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '到期隐藏' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '保留最后状态' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '恢复低亮占位' })).not.toBeInTheDocument();
  });

  test('normalizes legacy dim placeholder end behavior to instance idle in the editor', () => {
    renderFields(output({ restoreBehavior: 'dim-placeholder' }));

    expect(screen.getByRole('combobox', { name: '结束行为' })).toHaveTextContent('使用实例空闲态');
  });

  test('configures edge breathing glow edge for rule output', () => {
    const onChange = renderFields(output({ effect: 'edge-breathing' }));

    fireEvent.click(screen.getByLabelText('发光边'));
    fireEvent.click(screen.getByRole('option', { name: '上边' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [expect.objectContaining({ edge: 'top' })]
      })
    );
  });

  test('renders edge breathing preview as colored effect layers over transparent background', () => {
    renderFields(
      output({
        effect: 'edge-breathing',
        colors: [{ color: '#EF4444', position: 0 }]
      })
    );

    expect(screen.getByTestId('desktop-notice-rule-preview-lightbar')).toHaveStyle({
      background: 'transparent'
    });
    expect(
      screen.getByTestId('desktop-notice-rule-preview-edge-breathing-halo').getAttribute('style')
    ).toMatch(/239,\s*68,\s*68/);
    expect(
      screen.getByTestId('desktop-notice-rule-preview-edge-breathing-line').getAttribute('style')
    ).toMatch(/239,\s*68,\s*68/);
    expect(screen.getAllByText('边缘呼吸').length).toBeGreaterThan(0);
    expect(screen.queryByText('rules.desktopNotice.effects.edge-breathing')).not.toBeInTheDocument();
  });

  test('renders edge breathing preview inside a dedicated effect frame', () => {
    renderFields(
      output({
        effect: 'edge-breathing',
        edge: 'left'
      })
    );

    const frame = screen.getByTestId('desktop-notice-rule-preview-effect-frame');
    expect(frame).toHaveClass('left-5');
    expect(frame).toHaveClass('w-10');
    expect(screen.getByTestId('desktop-notice-rule-preview-edge-breathing-halo')).toHaveClass(
      'left-0'
    );
  });

  test('renders edge breathing preview with the same reference layers as the real window', () => {
    renderFields(
      output({
        effect: 'edge-breathing',
        colors: [{ color: '#22C55E', position: 0 }]
      })
    );

    const halo = screen.getByTestId('desktop-notice-rule-preview-edge-breathing-halo');
    const line = screen.getByTestId('desktop-notice-rule-preview-edge-breathing-line');
    const haloStyle =
      halo.getAttribute('style') ?? '';
    const lineStyle =
      line.getAttribute('style') ?? '';
    expect(halo).toHaveClass('desktop-notice-rule-preview-edge-breathing');
    expect(line).toHaveClass('desktop-notice-rule-preview-edge-breathing');
    expect(screen.getByTestId('desktop-notice-rule-preview-lightbar')).not.toHaveClass(
      'desktop-notice-rule-preview-edge-breathing'
    );
    expect(halo).toHaveStyle({ animationDuration: '1600ms' });
    expect(line).toHaveStyle({ animationDuration: '1600ms' });
    expect(halo.getAttribute('style')).toContain(
      'animation-name: desktop-notice-edge-breathing-horizontal'
    );
    expect(line.getAttribute('style')).toContain(
      'animation-name: desktop-notice-edge-breathing-horizontal'
    );
    expect(haloStyle).toContain('radial-gradient(ellipse at 50% 100%');
    expect(haloStyle).not.toContain('clip-path');
    expect(haloStyle).not.toContain('mask-image');
    expect(lineStyle).toContain('linear-gradient(90deg');
    expect(lineStyle).toContain('rgba(34,197,94,1) 50%');
  });

  test('renders edge breathing preview with configured gradient colors', () => {
    renderFields(
      output({
        effect: 'edge-breathing',
        colorMode: 'gradient',
        colors: [
          { color: '#EF4444', position: 0 },
          { color: '#22C55E', position: 50 },
          { color: '#38BDF8', position: 100 }
        ]
      })
    );

    expect(
      screen.getByTestId('desktop-notice-rule-preview-edge-breathing-halo').getAttribute('style')
    ).toContain('linear-gradient(90deg');
    expect(
      screen.getByTestId('desktop-notice-rule-preview-edge-breathing-halo').getAttribute('style')
    ).toMatch(/34,\s*197,\s*94/);
    expect(
      screen.getByTestId('desktop-notice-rule-preview-edge-breathing-line').getAttribute('style')
    ).toMatch(/56,\s*189,\s*248/);
  });

  test('configures rule-level opacity and brightness with sliders and reflects them in preview', () => {
    const onChange = renderFields(
      output({
        effect: 'edge-breathing',
        opacityPercent: 80,
        brightnessPercent: 90
      })
    );

    expect(screen.getByRole('slider', { name: '透明度（%）' })).toHaveValue('80');
    expect(screen.getByRole('slider', { name: '亮度（%）' })).toHaveValue('90');
    expect(screen.getByTestId('desktop-notice-rule-preview-lightbar')).toHaveStyle({
      opacity: '0.72'
    });

    fireEvent.change(screen.getByRole('slider', { name: '透明度（%）' }), {
      target: { value: '55' }
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        desktopNoticeTargets: [expect.objectContaining({ opacityPercent: 55 })]
      })
    );
  });

  test('opens an actual desktop notice preview with current rule effect settings', async () => {
    renderFields(
      output({
        effect: 'edge-breathing',
        colorMode: 'solid',
        colors: [{ color: '#EF4444', position: 0 }],
        durationMs: 2600,
        animationPeriodMs: 2400,
        opacityPercent: 85,
        brightnessPercent: 95,
        edge: 'top'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '实际效果预览' }));

    await waitFor(() =>
      expect(previewDesktopNoticeRuleEffectMock).toHaveBeenCalledWith({
        targetId: 'notice-main',
        effect: 'edge-breathing',
        colorMode: 'solid',
        colors: [{ color: '#EF4444', position: 0 }],
        durationMs: 2600,
        breathingPeriodMs: 2400,
        animationPeriodMs: 2400,
        opacityPercent: 85,
        brightnessPercent: 95,
        edge: 'top',
        restoreBehavior: 'use-instance-idle'
      })
    );
  });

  test.each(['solid', 'fade'] as const)(
    'omits animation period fields when previewing %s effect',
    async (effect) => {
      renderFields(
        output({
          effect,
          animationPeriodMs: 1600,
          breathingPeriodMs: 1600
        })
      );

      fireEvent.click(screen.getByRole('button', { name: '实际效果预览' }));

      await waitFor(() =>
        expect(previewDesktopNoticeRuleEffectMock).toHaveBeenCalledWith(
          expect.objectContaining({
            targetId: 'notice-main',
            effect,
            breathingPeriodMs: undefined,
            animationPeriodMs: undefined
          })
        )
      );
    }
  );

  test('disables actual preview until an enabled target instance is selected', () => {
    renderFields(output({ desktopNoticeTargets: [] }));

    expect(screen.getByRole('button', { name: '实际效果预览' })).toBeDisabled();
    expect(screen.getAllByText('请选择一个已启用的桌面提示实例后再预览真实效果。').length).toBeGreaterThan(0);
  });
});
