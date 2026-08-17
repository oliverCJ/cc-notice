import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DesktopNoticeWindow } from './DesktopNoticeWindow';
import type { DesktopNoticeWindowPayload } from '@/domain/desktopNotice';

const mocks = vi.hoisted(() => ({
  resizeListeners: [] as Array<(event: { payload: { width: number; height: number } }) => void>,
  moveListeners: [] as Array<(event: { payload: { x: number; y: number } }) => void>,
  emit: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    startDragging: vi.fn().mockResolvedValue(undefined),
    onResized: vi.fn((handler) => {
      mocks.resizeListeners.push(handler);
      return Promise.resolve(vi.fn());
    }),
    onMoved: vi.fn((handler) => {
      mocks.moveListeners.push(handler);
      return Promise.resolve(vi.fn());
    })
  })
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: mocks.emit
}));

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

const payload: DesktopNoticeWindowPayload = {
  instanceId: 'desk-1',
  name: '顶部提示',
  variant: 'custom-lightbar',
  direction: 'horizontal',
  defaultState: 'solid',
  size: { width: 640, height: 28 },
  opacityPercent: 70,
  cornerRadiusPercent: 30,
  idleBehavior: 'dim-placeholder',
  defaultStateConfig: {
    brightnessPercent: 80,
    breathingPeriodMs: 1200
  },
  appearance: {
    colorMode: 'solid',
    colors: [{ color: '#22C55E', position: 0 }]
  },
  customLightbar: {
    presetPosition: 'top-center',
    direction: 'horizontal',
    size: { width: 640, height: 28 },
    opacityPercent: 70,
    cornerRadiusPercent: 30,
    boundsOverride: null
  },
  edgeLightbar: null
};

describe('DesktopNoticeWindow', () => {
  test('renders lightbar preview from payload', () => {
    render(<DesktopNoticeWindow payload={payload} />);

    const lightbar = screen.getByRole('img', { name: '顶部提示' });
    expect(lightbar).toHaveStyle({ background: '#22C55E' });
    expect(lightbar).toHaveStyle({ opacity: '0.56' });
  });

  test('marks the window surface as a drag region', () => {
    render(<DesktopNoticeWindow payload={payload} />);

    expect(screen.getByTestId('desktop-notice-drag-region')).toHaveAttribute(
      'data-tauri-drag-region'
    );
  });

  test('fills the transparent window with the lightbar surface', () => {
    render(<DesktopNoticeWindow payload={payload} />);

    const surface = screen.getByTestId('desktop-notice-drag-region');
    const lightbar = screen.getByRole('img', { name: '顶部提示' });
    expect(surface).toHaveClass('bg-transparent');
    expect(lightbar).toHaveClass('h-full');
    expect(lightbar).toHaveClass('w-full');
    expect(lightbar).toHaveStyle({ borderRadius: '30%' });
    expect(lightbar).toHaveStyle({ clipPath: 'inset(0 round 30%)' });
    expect(lightbar).not.toHaveClass('shadow-[0_0_24px_rgba(15,23,42,0.25)]');
    expect(lightbar).not.toHaveClass('ring-1');
  });

  test('derives vertical gradient from actual lightbar dimensions', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          direction: 'horizontal',
          size: { width: 28, height: 640 },
          appearance: {
            colorMode: 'gradient',
            colors: [
              { color: '#22C55E', position: 0 },
              { color: '#0EA5E9', position: 100 }
            ]
          }
        }}
      />
    );

    expect(screen.getByRole('img', { name: '顶部提示' })).toHaveStyle({
      background: 'linear-gradient(180deg, #22C55E 0%, #0EA5E9 100%)'
    });
  });

  test('renders breathing state with configurable period', () => {
    render(<DesktopNoticeWindow payload={{ ...payload, defaultState: 'breathing' }} />);

    const lightbar = screen.getByRole('img', { name: '顶部提示' });
    expect(lightbar).toHaveStyle({
      animationDuration: '1200ms'
    });
    expect(lightbar).toHaveStyle({ opacity: '0.56' });
    expect(lightbar).not.toHaveClass('animate-pulse');
    expect(lightbar).toHaveClass('desktop-notice-breathing');
  });

  test('uses rule breathing period for breathing effect', () => {
    render(
      <DesktopNoticeWindow
        payload={{ ...payload, effect: 'breathing', animationPeriodMs: 2400 }}
      />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      animationDuration: '2400ms'
    });
  });

  test('uses breathing period for edge breathing visible layers', () => {
    render(
      <DesktopNoticeWindow
        payload={{ ...payload, effect: 'edge-breathing', animationPeriodMs: 2400 }}
      />
    );

    expect(screen.getByTestId('desktop-notice-edge-breathing-halo')).toHaveStyle({
      animationDuration: '2400ms'
    });
    expect(screen.getByTestId('desktop-notice-edge-breathing-line')).toHaveStyle({
      animationDuration: '2400ms'
    });
  });

  test('uses rule animation period for blink and scan effects', () => {
    const { rerender } = render(
      <DesktopNoticeWindow payload={{ ...payload, effect: 'blink', animationPeriodMs: 900 }} />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      animationDuration: '900ms'
    });

    rerender(
      <DesktopNoticeWindow payload={{ ...payload, effect: 'scan', animationPeriodMs: 2400 }} />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      animationDuration: '2400ms'
    });
    expect(screen.getByTestId('desktop-notice-scan-overlay')).toHaveStyle({
      animationDuration: '2400ms'
    });
  });

  test('does not dim active rule effect because instance idle state is hidden', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          defaultState: 'hidden',
          effect: 'edge-breathing',
          opacityOverridePercent: 80,
          brightnessOverridePercent: 90
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({ opacity: '0.72' });
  });

  test('keeps last state as solid effect', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          effect: 'solid',
          appearance: {
            colorMode: 'solid',
            colors: [{ color: '#EF4444', position: 0 }]
          }
        }}
      />
    );

    const lightbar = screen.getByTestId('desktop-notice-lightbar');
    expect(lightbar).toHaveStyle({ background: '#EF4444' });
    expect(lightbar).not.toHaveClass('desktop-notice-breathing');
  });

  test('hides the preview immediately when idle behavior is hidden', () => {
    render(
      <DesktopNoticeWindow
        payload={{ ...payload, defaultState: 'solid', idleBehavior: 'hidden' }}
      />
    );

    expect(screen.getByRole('img', { name: '顶部提示' })).toHaveStyle({
      opacity: '0'
    });
  });

  test('keeps preview visible when hidden idle behavior is shown in preview mode', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          defaultState: 'solid',
          idleBehavior: 'hidden',
          previewMode: true
        }}
      />
    );

    expect(screen.getByRole('img', { name: '顶部提示' })).not.toHaveStyle({
      opacity: '0'
    });
  });

  test('keeps hidden idle preview bright enough to inspect rounded corners', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          defaultState: 'hidden',
          idleBehavior: 'hidden',
          previewMode: true,
          cornerRadiusPercent: 45
        }}
      />
    );

    expect(screen.getByRole('img', { name: '顶部提示' })).toHaveStyle({
      borderRadius: '45%',
      opacity: '0.42'
    });
  });

  test('updates lightbar corner radius when preview payload changes', () => {
    const { rerender } = render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          previewMode: true,
          cornerRadiusPercent: 0
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      borderRadius: '0%',
      clipPath: 'inset(0 round 0%)'
    });

    rerender(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          previewMode: true,
          cornerRadiusPercent: 45
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      borderRadius: '45%',
      clipPath: 'inset(0 round 45%)'
    });
  });

  test('renders scan effect with a dedicated overlay layer', () => {
    render(<DesktopNoticeWindow payload={{ ...payload, effect: 'scan' }} />);

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveClass(
      'desktop-notice-scan'
    );
    expect(screen.getByTestId('desktop-notice-scan-overlay')).toBeInTheDocument();
  });

  test('renders edge breathing effect with halo and line layers', () => {
    render(<DesktopNoticeWindow payload={{ ...payload, effect: 'edge-breathing' }} />);

    const lightbar = screen.getByTestId('desktop-notice-lightbar');
    expect(lightbar).toHaveClass(
      'desktop-notice-edge-breathing'
    );
    expect(lightbar).not.toHaveStyle({ clipPath: 'inset(0 round 30%)' });
    expect(screen.getByTestId('desktop-notice-edge-breathing-halo')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-notice-edge-breathing-line')).toBeInTheDocument();
  });

  test('renders edge lightbar edges from instance settings', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['top', 'right'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-edge-lightbar-top')).toBeInTheDocument();
    expect(screen.getByTestId('desktop-notice-edge-lightbar-right')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-notice-edge-lightbar-left')).not.toBeInTheDocument();
  });

  test('routes mascot payload to the mascot stage renderer', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          name: '桌面精灵',
          variant: 'mascot',
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
          mascotBubbleText: '任务完成'
        }}
      />
    );

    expect(screen.getByTestId('desktop-mascot-stage')).toBeInTheDocument();
    expect(screen.getByText('任务完成')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-notice-lightbar')).not.toBeInTheDocument();
  });

  test('orchestrates adjacent edge scan overlays without replacing their original layers', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          effect: 'scan',
          animationPeriodMs: 2400,
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['top', 'right'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    const topOverlay = screen.getByTestId('desktop-notice-edge-lightbar-top-scan-overlay');
    const rightOverlay = screen.getByTestId('desktop-notice-edge-lightbar-right-scan-overlay');
    expect(topOverlay).toHaveClass('desktop-notice-scan-overlay');
    expect(topOverlay).toHaveClass('desktop-notice-edge-lightbar-connected-scan-overlay-2');
    expect(topOverlay).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-forward'
    );
    expect(topOverlay).toHaveStyle({ animationDuration: '2400ms', animationDelay: '0ms' });
    expect(rightOverlay).toHaveClass('desktop-notice-scan-overlay-vertical');
    expect(rightOverlay).toHaveClass('desktop-notice-edge-lightbar-connected-scan-overlay-2');
    expect(rightOverlay).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-forward'
    );
    expect(rightOverlay).toHaveStyle({ animationDuration: '2400ms', animationDelay: '1200ms' });
  });

  test('keeps disconnected edge scan overlays independent', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          effect: 'scan',
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['top', 'bottom'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-edge-lightbar-top-scan-overlay')).not.toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-bottom-scan-overlay')).not.toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay'
    );
  });

  test('keeps the bottom arc scan direction consistent across left bottom and right edges', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          effect: 'scan',
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['right', 'bottom', 'left'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    const rightOverlay = screen.getByTestId('desktop-notice-edge-lightbar-right-scan-overlay');
    expect(rightOverlay).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-forward'
    );
    expect(rightOverlay).toHaveStyle({
      animationName: 'desktop-notice-edge-lightbar-connected-scan-3',
      '--desktop-notice-connected-scan-from': 'translateY(-35%) skewY(-18deg)',
      '--desktop-notice-connected-scan-to': 'translateY(350%) skewY(-18deg)'
    });
    expect(screen.getByTestId('desktop-notice-edge-lightbar-bottom-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-reverse'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-left-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-reverse'
    );
  });

  test('keeps top right bottom scan direction on the clockwise path', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          effect: 'scan',
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['top', 'right', 'bottom'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-edge-lightbar-top-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-forward'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-right-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-forward'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-bottom-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-reverse'
    );
  });

  test('keeps left top right scan direction on the same edge loop', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          effect: 'scan',
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['left', 'top', 'right'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-edge-lightbar-left-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-reverse'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-top-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-forward'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-right-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-forward'
    );
  });

  test('keeps bottom left top scan direction on the same edge loop', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          variant: 'edge-lightbar',
          effect: 'scan',
          customLightbar: null,
          edgeLightbar: {
            enabledEdges: ['bottom', 'left', 'top'],
            thicknessPx: 18,
            insetPx: 0,
            opacityPercent: 100
          }
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-edge-lightbar-bottom-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-reverse'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-left-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-vertical-reverse'
    );
    expect(screen.getByTestId('desktop-notice-edge-lightbar-top-scan-overlay')).toHaveClass(
      'desktop-notice-edge-lightbar-connected-scan-overlay-horizontal-forward'
    );
  });

  test('does not round fixed edge lightbar edges', () => {
    const edgePayload: DesktopNoticeWindowPayload = {
      ...payload,
      variant: 'edge-lightbar',
      customLightbar: null,
      cornerRadiusPercent: 0,
      edgeLightbar: {
        enabledEdges: ['top'],
        thicknessPx: 18,
        insetPx: 0,
        opacityPercent: 100
      }
    };
    render(<DesktopNoticeWindow payload={edgePayload} />);

    const edge = screen.getByTestId('desktop-notice-edge-lightbar-top');
    expect(edge).not.toHaveStyle({ borderRadius: '45%' });
    expect(edge).not.toHaveStyle({ clipPath: 'inset(0 round 45%)' });
  });

  test('places horizontal edge breathing only on the bottom long edge', () => {
    render(
      <DesktopNoticeWindow
        payload={{ ...payload, effect: 'edge-breathing', size: { width: 640, height: 28 } }}
      />
    );

    const halo = screen.getByTestId('desktop-notice-edge-breathing-halo');
    const line = screen.getByTestId('desktop-notice-edge-breathing-line');
    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveClass(
      'desktop-notice-edge-breathing-horizontal'
    );
    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      transformOrigin: '50% 100%'
    });
    expect(halo).toHaveClass('bottom-0');
    expect(halo).toHaveClass('h-[30px]');
    expect(halo).not.toHaveClass('top-0');
    expect(line).toHaveClass('bottom-[1px]');
    expect(line).toHaveClass('h-[2px]');
  });

  test('places vertical edge breathing on the right long edge', () => {
    render(
      <DesktopNoticeWindow
        payload={{ ...payload, effect: 'edge-breathing', size: { width: 28, height: 640 } }}
      />
    );

    const halo = screen.getByTestId('desktop-notice-edge-breathing-halo');
    const line = screen.getByTestId('desktop-notice-edge-breathing-line');
    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveClass(
      'desktop-notice-edge-breathing-vertical'
    );
    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      transformOrigin: '100% 50%'
    });
    expect(halo).toHaveClass('right-0');
    expect(halo).toHaveClass('w-[30px]');
    expect(halo).not.toHaveClass('left-0');
    expect(line).toHaveClass('right-[1px]');
    expect(line).toHaveClass('w-[2px]');
  });

  test('places edge breathing on configured top edge', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          effect: 'edge-breathing',
          edge: 'top',
          size: { width: 640, height: 28 }
        }}
      />
    );

    const halo = screen.getByTestId('desktop-notice-edge-breathing-halo');
    const line = screen.getByTestId('desktop-notice-edge-breathing-line');
    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      transformOrigin: '50% 0%'
    });
    expect(halo).toHaveClass('top-0');
    expect(halo).not.toHaveClass('bottom-0');
    expect(line).toHaveClass('top-[1px]');
  });

  test('places edge breathing on configured left edge', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          effect: 'edge-breathing',
          edge: 'left',
          size: { width: 28, height: 640 }
        }}
      />
    );

    const halo = screen.getByTestId('desktop-notice-edge-breathing-halo');
    const line = screen.getByTestId('desktop-notice-edge-breathing-line');
    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      transformOrigin: '0% 50%'
    });
    expect(halo).toHaveClass('left-0');
    expect(halo).not.toHaveClass('right-0');
    expect(line).toHaveClass('left-[1px]');
  });

  test('uses configured color for edge breathing effect layers without filling background', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          effect: 'edge-breathing',
          appearance: {
            colorMode: 'solid',
            colors: [{ color: '#EF4444', position: 0 }]
          }
        }}
      />
    );

    expect(screen.getByTestId('desktop-notice-lightbar')).toHaveStyle({
      background: 'transparent'
    });
    expect(
      screen.getByTestId('desktop-notice-edge-breathing-halo').getAttribute('style')
    ).toMatch(/239,\s*68,\s*68/);
    expect(
      screen.getByTestId('desktop-notice-edge-breathing-line').getAttribute('style')
    ).toMatch(/239,\s*68,\s*68/);
  });

  test('renders edge breathing glow with the reference halo and line layers', () => {
    render(<DesktopNoticeWindow payload={{ ...payload, effect: 'edge-breathing' }} />);

    const halo = screen.getByTestId('desktop-notice-edge-breathing-halo');
    const line = screen.getByTestId('desktop-notice-edge-breathing-line');
    const haloStyle =
      halo.getAttribute('style') ?? '';
    const lineStyle =
      line.getAttribute('style') ?? '';
    expect(halo).toHaveClass('desktop-notice-edge-breathing');
    expect(line).toHaveClass('desktop-notice-edge-breathing');
    expect(haloStyle).toContain('radial-gradient(ellipse at 50% 100%');
    expect(haloStyle).not.toContain('clip-path');
    expect(haloStyle).not.toContain('mask-image');
    expect(lineStyle).toContain('linear-gradient(90deg');
    expect(lineStyle).toContain('rgba(34,197,94,1) 50%');
  });

  test('uses configured gradient colors for edge breathing effect layers', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          effect: 'edge-breathing',
          appearance: {
            colorMode: 'gradient',
            colors: [
              { color: '#EF4444', position: 0 },
              { color: '#22C55E', position: 50 },
              { color: '#38BDF8', position: 100 }
            ]
          }
        }}
      />
    );

    expect(
      screen.getByTestId('desktop-notice-edge-breathing-halo').getAttribute('style')
    ).toContain('linear-gradient(90deg');
    expect(
      screen.getByTestId('desktop-notice-edge-breathing-halo').getAttribute('style')
    ).toMatch(/34,\s*197,\s*94/);
    expect(
      screen.getByTestId('desktop-notice-edge-breathing-line').getAttribute('style')
    ).toMatch(/56,\s*189,\s*248/);
  });

  test('uses vertical gradient direction for vertical edge breathing', () => {
    render(
      <DesktopNoticeWindow
        payload={{
          ...payload,
          effect: 'edge-breathing',
          size: { width: 28, height: 640 },
          appearance: {
            colorMode: 'gradient',
            colors: [
              { color: '#EF4444', position: 0 },
              { color: '#38BDF8', position: 100 }
            ]
          }
        }}
      />
    );

    expect(
      screen.getByTestId('desktop-notice-edge-breathing-line').getAttribute('style')
    ).toContain('linear-gradient(180deg');
  });

  test('emits bounds changes when preview window is resized', async () => {
    mocks.resizeListeners.length = 0;
    mocks.moveListeners.length = 0;
    mocks.emit.mockClear();
    render(<DesktopNoticeWindow payload={payload} />);

    mocks.resizeListeners[0]?.({ payload: { width: 320, height: 24 } });

    expect(mocks.emit).toHaveBeenCalledWith('cc-notice://desktop-notice-window-bounds-changed', {
      instanceId: 'desk-1',
      width: 320,
      height: 24,
      userInitiated: false
    });
  });

  test('emits programmatic bounds changes without user initiated flag', async () => {
    mocks.resizeListeners.length = 0;
    mocks.moveListeners.length = 0;
    mocks.emit.mockClear();
    render(<DesktopNoticeWindow payload={payload} />);

    mocks.moveListeners[0]?.({ payload: { x: 120, y: 80 } });

    expect(mocks.emit).toHaveBeenCalledWith('cc-notice://desktop-notice-window-bounds-changed', {
      instanceId: 'desk-1',
      x: 120,
      y: 80,
      userInitiated: false
    });
  });

  test('emits user initiated bounds changes after dragging starts', async () => {
    mocks.resizeListeners.length = 0;
    mocks.moveListeners.length = 0;
    mocks.emit.mockClear();
    render(<DesktopNoticeWindow payload={payload} />);

    fireEvent.mouseDown(screen.getByTestId('desktop-notice-drag-region'), { button: 0 });
    mocks.moveListeners[0]?.({ payload: { x: 120, y: 80 } });

    expect(mocks.emit).toHaveBeenCalledWith('cc-notice://desktop-notice-window-bounds-changed', {
      instanceId: 'desk-1',
      x: 120,
      y: 80,
      userInitiated: true
    });
  });

  test('keeps late move events user initiated briefly after drag mouseup', async () => {
    mocks.resizeListeners.length = 0;
    mocks.moveListeners.length = 0;
    mocks.emit.mockClear();
    render(<DesktopNoticeWindow payload={payload} />);

    fireEvent.mouseDown(screen.getByTestId('desktop-notice-drag-region'), { button: 0 });
    fireEvent.mouseUp(window);
    mocks.moveListeners[0]?.({ payload: { x: 140, y: 96 } });

    expect(mocks.emit).toHaveBeenCalledWith('cc-notice://desktop-notice-window-bounds-changed', {
      instanceId: 'desk-1',
      x: 140,
      y: 96,
      userInitiated: true
    });
  });
});
