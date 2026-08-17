import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { MascotStageRenderer } from './MascotStageRenderer';
import type { DesktopNoticeWindowPayload } from '@/domain/desktopNotice';

vi.mock('@lottiefiles/dotlottie-react', () => ({
  DotLottieReact: ({
    src,
    loop,
    autoplay,
    className
  }: {
    src: string;
    loop?: boolean;
    autoplay?: boolean;
    className?: string;
  }) => (
    <div
      data-testid="dotlottie"
      data-src={src}
      data-loop={String(Boolean(loop))}
      data-autoplay={String(Boolean(autoplay))}
      className={className}
    />
  ),
  setWasmUrl: vi.fn()
}));

vi.mock('@tauri-apps/api/core', async () => {
  const actual = await vi.importActual<typeof import('@tauri-apps/api/core')>('@tauri-apps/api/core');
  return {
    ...actual,
    convertFileSrc: (path: string) => `asset://localhost/${path}`
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function payload(overrides: Partial<DesktopNoticeWindowPayload> = {}): DesktopNoticeWindowPayload {
  return {
    instanceId: 'mascot-1',
    name: '桌面精灵',
    variant: 'mascot',
    direction: 'horizontal',
    defaultState: 'solid',
    size: { width: 260, height: 260 },
    opacityPercent: 100,
    cornerRadiusPercent: 0,
    idleBehavior: 'dim-placeholder',
    defaultStateConfig: { brightnessPercent: 100, breathingPeriodMs: 1600 },
    appearance: { colorMode: 'solid', colors: [{ color: '#38BDF8', position: 0 }] },
    customLightbar: null,
    edgeLightbar: null,
    mascot: {
      assetPackId: 'warm-buddy',
      stageSize: { width: 260, height: 260 },
      presetPosition: 'bottom-right',
      boundsOverride: null,
      idleState: 'idle',
      interactionEnabled: true,
      bubbleEnabled: true,
      bubblePlacement: 'top-right',
      bubbleFontSizePx: 14,
      bubbleFontId: 'soft-handwriting'
    },
    mascotState: 'success',
    mascotActionId: 'success.jump',
    mascotBubbleText: '任务完成',
    ...overrides
  };
}

describe('MascotStageRenderer', () => {
  test('renders selected mascot action and bubble text', () => {
    render(<MascotStageRenderer payload={payload()} />);

    expect(screen.getByTestId('desktop-mascot-stage')).toHaveClass('overflow-hidden');
    expect(screen.getByTestId('dotlottie')).toHaveAttribute(
      'data-src',
      expect.stringContaining('success')
    );
    expect(screen.getByTestId('dotlottie')).toHaveAttribute('data-loop', 'false');
    expect(screen.getByText('任务完成')).toBeInTheDocument();
  });

  test('renders mascot bubble with soft comic style and a tail', () => {
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            bubbleFontSizePx: 17,
            bubbleFontId: 'round-cute'
          }
        })}
      />
    );

    const bubble = screen.getByTestId('desktop-mascot-bubble');
    expect(bubble).toHaveClass('desktop-mascot-bubble');
    expect(bubble).toHaveClass('z-20');
    expect(bubble.style.fontSize).toBe('17px');
    expect(bubble.style.fontFamily).toContain('Yuanti SC');
    expect(screen.getByTestId('desktop-mascot-bubble-tail')).toBeInTheDocument();
  });

  test('falls back to idle action when no rule action is active', () => {
    render(
      <MascotStageRenderer
        payload={payload({
          mascotState: null,
          mascotActionId: null,
          mascotBubbleText: null
        })}
      />
    );

    expect(screen.getByTestId('dotlottie')).toHaveAttribute(
      'data-src',
      expect.stringContaining('idle')
    );
    expect(screen.getByTestId('dotlottie')).toHaveAttribute('data-loop', 'true');
    expect(screen.queryByTestId('desktop-mascot-bubble')).not.toBeInTheDocument();
  });

  test('renders GIF mascot packs as contained images', () => {
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          mascotState: 'working',
          mascotActionId: 'working.loop',
          mascotBubbleText: null
        })}
      />
    );

    expect(screen.queryByTestId('dotlottie')).not.toBeInTheDocument();
    const image = screen.getByTestId('desktop-mascot-gif');
    expect(image).toHaveAttribute('src', expect.stringContaining('working'));
    expect(image).toHaveClass('object-contain');
  });

  test('renders G7 idle state with sleeping animation', () => {
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          mascotState: null,
          mascotActionId: null,
          mascotBubbleText: null
        })}
      />
    );

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('sleep')
    );
  });

  test('renders local custom GIF mascot pack from resolved payload assets', () => {
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'my-mascot'
          },
          resolvedMascotPack: {
            id: 'my-mascot',
            name: '我的精灵',
            version: '1.0.0',
            renderer: 'gif',
            source: 'local',
            animations: {
              working: '/Users/test/.cc-notice/mascots/my-mascot/animations/working.gif'
            },
            states: ['working'],
            actions: [
              {
                id: 'working.loop',
                label: '工作中',
                state: 'working',
                animation: 'working',
                loop: true,
                interruptible: true
              }
            ],
            interactions: {
              hoverActionId: 'working.loop',
              clickActionId: 'working.loop'
            }
          },
          mascotState: 'working',
          mascotActionId: 'working.loop',
          mascotBubbleText: null
        })}
      />
    );

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      'asset://localhost//Users/test/.cc-notice/mascots/my-mascot/animations/working.gif'
    );
  });

  test('rotates G7 idle animations when no rule action is active', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          mascotState: null,
          mascotActionId: null,
          mascotBubbleText: null
        })}
      />
    );

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('sleep')
    );

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('wave')
    );
  });

  test('overrides action default loop mode for lottie actions', () => {
    render(<MascotStageRenderer payload={payload({ mascotPlayMode: 'loop' })} />);

    expect(screen.getByTestId('dotlottie')).toHaveAttribute('data-loop', 'true');
  });

  test('switches lottie action back to idle when play mode is once then idle', () => {
    vi.useFakeTimers();
    render(<MascotStageRenderer payload={payload({ durationMs: 3000, mascotPlayMode: 'once-then-idle' })} />);

    expect(screen.getByTestId('dotlottie')).toHaveAttribute(
      'data-src',
      expect.stringContaining('success')
    );

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.getByTestId('dotlottie')).toHaveAttribute(
      'data-src',
      expect.stringContaining('idle')
    );
  });

  test('switches gif action back to idle when play mode is once then idle', () => {
    vi.useFakeTimers();
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          durationMs: 3000,
          mascotState: 'task-received',
          mascotActionId: 'task-received.wave',
          mascotPlayMode: 'once-then-idle'
        })}
      />
    );

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('wave')
    );

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('sleep')
    );
  });

  test('uses custom playback window before switching gif action back to idle', () => {
    vi.useFakeTimers();
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          durationMs: 5000,
          mascotState: 'task-received',
          mascotActionId: 'task-received.wave',
          mascotPlayMode: 'once-then-idle',
          mascotPlaybackWindowMs: 2600
        })}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('wave')
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('sleep')
    );
  });

  test('freezes gif frame instead of continuing gif playback when play mode is once then hold', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          durationMs: 3000,
          mascotState: 'success',
          mascotActionId: 'success.ok',
          mascotPlayMode: 'once-then-hold'
        })}
      />
    );

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('success')
    );

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.getByTestId('desktop-mascot-gif-freeze')).toBeInTheDocument();
  });

  test('uses custom playback window before freezing gif frame', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'g7-buddy'
          },
          durationMs: 5000,
          mascotState: 'success',
          mascotActionId: 'success.ok',
          mascotPlayMode: 'once-then-hold',
          mascotPlaybackWindowMs: 2600
        })}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.queryByTestId('desktop-mascot-gif-freeze')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByTestId('desktop-mascot-gif-freeze')).toBeInTheDocument();
  });

  test('uses action default play mode to switch gif action back to idle', () => {
    vi.useFakeTimers();
    render(
      <MascotStageRenderer
        payload={payload({
          mascot: {
            ...payload().mascot!,
            assetPackId: 'local-once'
          },
          resolvedMascotPack: {
            id: 'local-once',
            name: '本地精灵',
            version: '1.0.0',
            renderer: 'gif',
            source: 'local',
            animations: {
              sleep: '/Users/test/.cc-notice/mascots/local-once/sleep.gif',
              wave: '/Users/test/.cc-notice/mascots/local-once/wave.gif'
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
          },
          durationMs: 3000,
          mascotState: 'task-received',
          mascotActionId: 'task-received.wave',
          mascotPlayMode: 'default',
          mascotBubbleText: null
        })}
      />
    );

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('wave')
    );

    act(() => {
      vi.advanceTimersByTime(1800);
    });

    expect(screen.getByTestId('desktop-mascot-gif')).toHaveAttribute(
      'src',
      expect.stringContaining('sleep')
    );
  });
});
