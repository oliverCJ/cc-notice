import { useEffect, type CSSProperties, type MouseEvent, type MutableRefObject } from 'react';
import { useRef } from 'react';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type {
  DesktopNoticeRuleEffect,
  DesktopNoticeScreenEdge,
  DesktopNoticeWindowPayload,
  EdgeLightbarSettings
} from '@/domain/desktopNotice';
import {
  defaultDesktopNoticeAnimationPeriod,
  isDesktopNoticeAnimatedEffect,
  normalizeDesktopNoticeAnimationPeriod
} from '@/domain/desktopNotice';
import {
  edgeBreathingHaloStyle as buildEdgeBreathingHaloStyle,
  edgeBreathingLineStyle as buildEdgeBreathingLineStyle,
  edgeOrientationForEdge,
  resolveDesktopNoticeEdge,
  rgbFromHex,
  type ResolvedDesktopNoticeEdge
} from '@/domain/desktopNoticeVisuals';
import { MascotStageRenderer } from './MascotStageRenderer';

const DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT =
  'cc-notice://desktop-notice-window-bounds-changed';
const HIDDEN_STATE_OPACITY_FACTOR = 0.6;
const USER_DRAG_MOVE_GRACE_MS = 1800;

type DesktopNoticeWindowProps = {
  payload: DesktopNoticeWindowPayload;
};

type DesktopNoticeWindowStyle = CSSProperties & {
  '--desktop-notice-opacity': string;
  '--desktop-notice-breathing-dim-opacity': string;
};

type EdgeLightbarScanOverlayStyle = CSSProperties & {
  '--desktop-notice-connected-scan-from'?: string;
  '--desktop-notice-connected-scan-to'?: string;
};

const EDGE_LIGHTBAR_SCAN_EDGE_ORDER: DesktopNoticeScreenEdge[] = [
  'top',
  'right',
  'bottom',
  'left'
];

type EdgeLightbarScanGroup = {
  edges: DesktopNoticeScreenEdge[];
  connected: boolean;
};

type EdgeLightbarScanTiming = {
  connected: boolean;
  groupSize: number;
  groupIndex: number;
  reverse: boolean;
};

export function DesktopNoticeWindow({ payload }: DesktopNoticeWindowProps) {
  const userDragActiveRef = useRef(false);
  const userDragGraceUntilRef = useRef(0);
  const dragResetTimerRef = useRef<number | null>(null);
  const canDragWindow = payload.variant === 'custom-lightbar' || payload.variant === 'mascot';

  useEffect(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    return () => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenResized: (() => void) | null = null;
    let unlistenMoved: (() => void) | null = null;
    void getCurrentWindow()
      .onResized((event) => {
        if (disposed) {
          return;
        }
        void emit(DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT, {
          instanceId: payload.instanceId,
          width: event.payload.width,
          height: event.payload.height,
          userInitiated: false
        }).catch((error) =>
          console.warn('failed to emit desktop notice window bounds changed', error)
        );
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlistenResized = dispose;
      })
      .catch((error) =>
        console.warn('failed to initialize desktop notice window resize listener', error)
      );
    void getCurrentWindow()
      .onMoved((event) => {
        if (disposed) {
          return;
        }
        void emit(DESKTOP_NOTICE_WINDOW_BOUNDS_CHANGED_EVENT, {
          instanceId: payload.instanceId,
          x: event.payload.x,
          y: event.payload.y,
          userInitiated: isUserDragMove(userDragActiveRef, userDragGraceUntilRef)
        }).catch((error) =>
          console.warn('failed to emit desktop notice window position changed', error)
        );
      })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlistenMoved = dispose;
      })
      .catch((error) =>
        console.warn('failed to initialize desktop notice window move listener', error)
      );
    return () => {
      disposed = true;
      unlistenResized?.();
      unlistenMoved?.();
    };
  }, [payload.instanceId]);

  function handleMouseDown(event: MouseEvent) {
    if (!canDragWindow || event.button !== 0) {
      return;
    }
    userDragActiveRef.current = true;
    userDragGraceUntilRef.current = Date.now() + USER_DRAG_MOVE_GRACE_MS;
    if (dragResetTimerRef.current) {
      window.clearTimeout(dragResetTimerRef.current);
    }
    const resetDragState = () => {
      userDragActiveRef.current = false;
      userDragGraceUntilRef.current = Date.now() + USER_DRAG_MOVE_GRACE_MS;
      if (dragResetTimerRef.current) {
        window.clearTimeout(dragResetTimerRef.current);
        dragResetTimerRef.current = null;
      }
      window.removeEventListener('mouseup', resetDragState);
      window.removeEventListener('pointerup', resetDragState);
      window.removeEventListener('blur', resetDragState);
    };
    window.addEventListener('mouseup', resetDragState, { once: true });
    window.addEventListener('pointerup', resetDragState, { once: true });
    window.addEventListener('blur', resetDragState, { once: true });
    dragResetTimerRef.current = window.setTimeout(() => {
      resetDragState();
    }, 1500);
    void getCurrentWindow()
      .startDragging()
      .catch((error) => console.warn('failed to start desktop notice window dragging', error));
  }

  useEffect(() => {
    return () => {
      if (dragResetTimerRef.current) {
        window.clearTimeout(dragResetTimerRef.current);
      }
    };
  }, []);

  return (
    <main
      data-testid="desktop-notice-drag-region"
      data-tauri-drag-region={canDragWindow ? '' : undefined}
      onMouseDown={handleMouseDown}
      className={`${canDragWindow ? 'cursor-move' : 'cursor-default'} flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent`}
    >
      {payload.variant === 'edge-lightbar' ? (
        <EdgeLightbarRenderer payload={payload} />
      ) : payload.variant === 'mascot' ? (
        <MascotStageRenderer payload={payload} />
      ) : (
        <CustomLightbarRenderer payload={payload} />
      )}
    </main>
  );
}

function CustomLightbarRenderer({ payload }: { payload: DesktopNoticeWindowPayload }) {
  const animationDuration = lightbarAnimationDuration(payload);
  const effectBackground = lightbarBackground(payload);
  const fillsSurface = fillsEffectSurface(payload);
  const resolvedEdge = resolveDesktopNoticeEdge(payload.edge ?? 'auto', payload.size);
  const edgeOrientation = edgeOrientationForEdge(resolvedEdge);
  const style: DesktopNoticeWindowStyle = {
    ...lightbarShapeStyle(payload),
    ...edgeBreathingTransformOriginStyle(resolvedEdge),
    background: fillsSurface ? effectBackground : 'transparent',
    opacity: lightbarOpacity(payload),
    '--desktop-notice-opacity': String(lightbarOpacity(payload)),
    '--desktop-notice-breathing-dim-opacity': String(lightbarBreathingDimOpacity(payload)),
    animationDuration
  };

  return (
    <div
      role="img"
      aria-label={payload.name}
      data-testid="desktop-notice-lightbar"
      data-tauri-drag-region=""
      className={`${activeEffectClass(payload)} relative h-full w-full overflow-hidden`}
      style={style}
    >
      {fillsSurface ? (
        <div aria-hidden="true" className="absolute inset-0" style={{ background: effectBackground }} />
      ) : null}
      {isScanEffect(payload) ? (
        <div
          aria-hidden="true"
          data-testid="desktop-notice-scan-overlay"
          className={scanOverlayClass(edgeOrientation)}
          style={{
            background: scanOverlayBackground(payload, edgeOrientation),
            animationDuration: animationDuration ?? '3000ms'
          }}
        />
      ) : null}
      {isEdgeBreathingEffect(payload) ? (
        <>
          <div
            aria-hidden="true"
            data-testid="desktop-notice-edge-breathing-halo"
            className={`desktop-notice-edge-breathing-halo ${edgeBreathingAnimationClass(resolvedEdge)} absolute ${edgeBreathingHaloClass(resolvedEdge)}`}
            style={edgeBreathingLayerStyle(payload, edgeBreathingHaloStyle(payload, resolvedEdge), animationDuration)}
          />
          <div
            aria-hidden="true"
            data-testid="desktop-notice-edge-breathing-line"
            className={`desktop-notice-edge-breathing-line ${edgeBreathingAnimationClass(resolvedEdge)} absolute ${edgeBreathingLineClass(resolvedEdge)}`}
            style={edgeBreathingLayerStyle(payload, edgeBreathingLineStyle(payload, resolvedEdge), animationDuration)}
          />
        </>
      ) : null}
    </div>
  );
}

function EdgeLightbarRenderer({ payload }: { payload: DesktopNoticeWindowPayload }) {
  const settings = payload.edgeLightbar;
  if (!settings) {
    return null;
  }
  const scanTimings = isScanEffect(payload)
    ? edgeLightbarScanTimings(settings.enabledEdges, lightbarAnimationDuration(payload) ?? '3000ms')
    : new Map<DesktopNoticeScreenEdge, EdgeLightbarScanTiming>();
  return (
    <div
      role="img"
      aria-label={payload.name}
      data-testid="desktop-notice-edge-lightbar"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {settings.enabledEdges.map((edge) => (
        <EdgeLightbarEdge
          key={edge}
          edge={edge}
          payload={payload}
          settings={settings}
          scanTiming={scanTimings.get(edge)}
        />
      ))}
    </div>
  );
}

function EdgeLightbarEdge({
  edge,
  payload,
  settings,
  scanTiming
}: {
  edge: DesktopNoticeScreenEdge;
  payload: DesktopNoticeWindowPayload;
  settings: EdgeLightbarSettings;
  scanTiming?: EdgeLightbarScanTiming;
}) {
  const edgeAsNoticeEdge = edge as ResolvedDesktopNoticeEdge;
  const animationDuration = lightbarAnimationDuration(payload);
  const fillsSurface = fillsEffectSurface(payload);
  const effectBackground = lightbarBackgroundForEdge(payload, edgeAsNoticeEdge);
  const style: DesktopNoticeWindowStyle = {
    ...edgeLightbarEdgeFrameStyle(edge, settings),
    ...edgeBreathingTransformOriginStyle(edgeAsNoticeEdge),
    background: fillsSurface ? effectBackground : 'transparent',
    opacity: lightbarOpacity(payload),
    '--desktop-notice-opacity': String(lightbarOpacity(payload)),
    '--desktop-notice-breathing-dim-opacity': String(lightbarBreathingDimOpacity(payload)),
    animationDuration
  };
  return (
    <div
      data-testid={`desktop-notice-edge-lightbar-${edge}`}
      className={`${activeEffectClassForEdge(payload, edgeAsNoticeEdge)} absolute overflow-hidden`}
      style={style}
    >
      {fillsSurface ? (
        <div aria-hidden="true" className="absolute inset-0" style={{ background: effectBackground }} />
      ) : null}
      {isEdgeBreathingEffect(payload) ? (
        <>
          <div
            aria-hidden="true"
            className={`desktop-notice-edge-breathing-halo ${edgeBreathingAnimationClass(edgeAsNoticeEdge)} absolute ${edgeBreathingHaloClass(edgeAsNoticeEdge)}`}
            style={edgeBreathingLayerStyle(payload, edgeBreathingHaloStyle(payload, edgeAsNoticeEdge), animationDuration)}
          />
          <div
            aria-hidden="true"
            className={`desktop-notice-edge-breathing-line ${edgeBreathingAnimationClass(edgeAsNoticeEdge)} absolute ${edgeBreathingLineClass(edgeAsNoticeEdge)}`}
            style={edgeBreathingLayerStyle(payload, edgeBreathingLineStyle(payload, edgeAsNoticeEdge), animationDuration)}
          />
        </>
      ) : null}
      {isScanEffect(payload) ? (
        <div
          aria-hidden="true"
          data-testid={`desktop-notice-edge-lightbar-${edge}-scan-overlay`}
          className={scanOverlayClass(edgeOrientationForEdge(edgeAsNoticeEdge), scanTiming)}
          style={scanOverlayStyle(
            payload,
            edgeOrientationForEdge(edgeAsNoticeEdge),
            animationDuration ?? '3000ms',
            scanTiming
          )}
        />
      ) : null}
    </div>
  );
}

function isUserDragMove(
  userDragActiveRef: MutableRefObject<boolean>,
  userDragGraceUntilRef: MutableRefObject<number>
) {
  return userDragActiveRef.current || Date.now() <= userDragGraceUntilRef.current;
}

function activeEffect(payload: DesktopNoticeWindowPayload) {
  return payload.effect ?? (payload.defaultState === 'breathing' ? 'breathing' : 'solid');
}

function activeEffectClass(payload: DesktopNoticeWindowPayload) {
  const effect = activeEffect(payload);
  if (effect === 'breathing') {
    return 'desktop-notice-breathing';
  }
  if (effect === 'blink') {
    return 'desktop-notice-blink';
  }
  if (effect === 'scan') {
    return 'desktop-notice-scan';
  }
  if (effect === 'edge-breathing') {
    return `desktop-notice-edge-breathing desktop-notice-edge-breathing-${edgeOrientationForEdge(resolveDesktopNoticeEdge(payload.edge ?? 'auto', payload.size))}`;
  }
  if (effect === 'fade') {
    return 'desktop-notice-fade';
  }
  return '';
}

function activeEffectClassForEdge(
  payload: DesktopNoticeWindowPayload,
  edge: ResolvedDesktopNoticeEdge
) {
  const effect = activeEffect(payload);
  if (effect === 'edge-breathing') {
    return `desktop-notice-edge-breathing desktop-notice-edge-breathing-${edgeOrientationForEdge(edge)}`;
  }
  return activeEffectClass(payload);
}

function lightbarAnimationDuration(payload: DesktopNoticeWindowPayload) {
  const effect = activeEffect(payload);
  if (effect === 'breathing' || effect === 'edge-breathing') {
    return `${resolveAnimationPeriodMs(payload, effect)}ms`;
  }
  if (effect === 'blink') {
    return `${resolveAnimationPeriodMs(payload, effect)}ms`;
  }
  if (effect === 'scan') {
    return `${resolveAnimationPeriodMs(payload, effect)}ms`;
  }
  if (effect === 'fade') {
    return `${payload.durationMs ?? 3000}ms`;
  }
  return undefined;
}

function resolveAnimationPeriodMs(
  payload: DesktopNoticeWindowPayload,
  effect: DesktopNoticeRuleEffect
) {
  if (!isDesktopNoticeAnimatedEffect(effect)) {
    return defaultDesktopNoticeAnimationPeriod(effect);
  }
  return normalizeDesktopNoticeAnimationPeriod(
    effect,
    payload.animationPeriodMs ?? payload.breathingPeriodMs ?? payload.defaultStateConfig.breathingPeriodMs
  );
}

function lightbarOpacity(payload: DesktopNoticeWindowPayload) {
  if (
    !payload.previewMode &&
    payload.effect == null &&
    (payload.idleBehavior === 'hidden' || payload.defaultState === 'hidden')
  ) {
    return 0;
  }
  const brightnessPercent =
    payload.brightnessOverridePercent ?? payload.defaultStateConfig.brightnessPercent;
  const opacityPercent = payload.opacityOverridePercent ?? payload.opacityPercent;
  const visibleOpacity = (opacityPercent / 100) * (brightnessPercent / 100);
  const effectiveOpacity =
    payload.effect == null && payload.defaultState === 'hidden'
      ? visibleOpacity * HIDDEN_STATE_OPACITY_FACTOR
      : visibleOpacity;
  const previewFloor = payload.previewMode && payload.idleBehavior === 'hidden' && payload.effect == null ? 0.42 : 0;
  return Math.round(Math.max(effectiveOpacity, previewFloor) * 1000) / 1000;
}

function lightbarBreathingDimOpacity(payload: DesktopNoticeWindowPayload) {
  return Math.round(lightbarOpacity(payload) * 0.35 * 1000) / 1000;
}

function lightbarBackground(payload: DesktopNoticeWindowPayload) {
  const colors = payload.appearance.colors;
  if (payload.appearance.colorMode === 'gradient' && colors.length > 1) {
    const stops = colors.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
    const angle = payload.size.height > payload.size.width ? 180 : 90;
    return `linear-gradient(${angle}deg, ${stops})`;
  }
  return colors[0]?.color ?? '#22C55E';
}

function lightbarBackgroundForEdge(
  payload: DesktopNoticeWindowPayload,
  edge: ResolvedDesktopNoticeEdge
) {
  const colors = payload.appearance.colors;
  if (payload.appearance.colorMode === 'gradient' && colors.length > 1) {
    const stops = colors.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
    const angle = edgeOrientationForEdge(edge) === 'vertical' ? 180 : 90;
    return `linear-gradient(${angle}deg, ${stops})`;
  }
  return colors[0]?.color ?? '#22C55E';
}

function isScanEffect(payload: DesktopNoticeWindowPayload) {
  return activeEffect(payload) === 'scan';
}

function isEdgeBreathingEffect(payload: DesktopNoticeWindowPayload) {
  return activeEffect(payload) === 'edge-breathing';
}

function fillsEffectSurface(payload: DesktopNoticeWindowPayload) {
  const effect = activeEffect(payload);
  return effect !== 'scan' && effect !== 'edge-breathing';
}

function scanOverlayBackground(
  payload: DesktopNoticeWindowPayload,
  orientation: 'horizontal' | 'vertical'
) {
  const { r, g, b } = primaryEffectColor(payload);
  const angle = orientation === 'vertical' ? 180 : 90;
  return `linear-gradient(${angle}deg, rgba(${r},${g},${b},0), rgba(${r},${g},${b},0.88) 50%, rgba(${r},${g},${b},0))`;
}

function scanOverlayClass(
  orientation: 'horizontal' | 'vertical',
  scanTiming?: EdgeLightbarScanTiming
) {
  const connectedClass =
    scanTiming?.connected
      ? ` desktop-notice-edge-lightbar-connected-scan-overlay desktop-notice-edge-lightbar-connected-scan-overlay-${scanTiming.groupSize} ${
          scanTiming.reverse
            ? `desktop-notice-edge-lightbar-connected-scan-overlay-${orientation}-reverse`
            : `desktop-notice-edge-lightbar-connected-scan-overlay-${orientation}-forward`
        }`
      : '';
  if (orientation === 'vertical') {
    return `desktop-notice-scan-overlay desktop-notice-scan-overlay-vertical absolute inset-x-0 top-[-30%] h-1/3 skew-y-[-18deg] rounded-full blur-md${connectedClass}`;
  }
  return `desktop-notice-scan-overlay absolute inset-y-0 left-[-30%] w-1/3 skew-x-[-18deg] rounded-full blur-md${connectedClass}`;
}

function scanOverlayStyle(
  payload: DesktopNoticeWindowPayload,
  orientation: 'horizontal' | 'vertical',
  animationDuration: string,
  scanTiming?: EdgeLightbarScanTiming
): EdgeLightbarScanOverlayStyle {
  const connectedDirection = scanTiming?.connected
    ? connectedScanTransformVariables(orientation, scanTiming.reverse)
    : {};
  return {
    background: scanOverlayBackground(payload, orientation),
    animationName: scanTiming?.connected
      ? `desktop-notice-edge-lightbar-connected-scan-${scanTiming.groupSize}`
      : undefined,
    animationDuration,
    animationDelay: scanTiming?.connected
      ? connectedScanAnimationDelay(scanTiming, animationDuration)
      : undefined,
    ...connectedDirection
  };
}

function connectedScanTransformVariables(
  orientation: 'horizontal' | 'vertical',
  reverse: boolean
): Pick<
  EdgeLightbarScanOverlayStyle,
  '--desktop-notice-connected-scan-from' | '--desktop-notice-connected-scan-to'
> {
  if (orientation === 'vertical') {
    return reverse
      ? {
          '--desktop-notice-connected-scan-from': 'translateY(350%) skewY(-18deg)',
          '--desktop-notice-connected-scan-to': 'translateY(-35%) skewY(-18deg)'
        }
      : {
          '--desktop-notice-connected-scan-from': 'translateY(-35%) skewY(-18deg)',
          '--desktop-notice-connected-scan-to': 'translateY(350%) skewY(-18deg)'
        };
  }
  return reverse
    ? {
        '--desktop-notice-connected-scan-from': 'translateX(350%) skewX(-18deg)',
        '--desktop-notice-connected-scan-to': 'translateX(-35%) skewX(-18deg)'
      }
    : {
        '--desktop-notice-connected-scan-from': 'translateX(-35%) skewX(-18deg)',
        '--desktop-notice-connected-scan-to': 'translateX(350%) skewX(-18deg)'
      };
}

function edgeLightbarScanTimings(
  enabledEdges: DesktopNoticeScreenEdge[],
  animationDuration: string
) {
  const timings = new Map<DesktopNoticeScreenEdge, EdgeLightbarScanTiming>();
  for (const group of edgeLightbarScanGroups(enabledEdges)) {
    if (!group.connected) {
      for (const edge of group.edges) {
        timings.set(edge, {
          connected: false,
          groupSize: 1,
          groupIndex: 0,
          reverse: false
        });
      }
      continue;
    }
    group.edges.forEach((edge, groupIndex) => {
      timings.set(edge, {
        connected: true,
        groupSize: group.edges.length,
        groupIndex,
        reverse: edgeLightbarScanDirectionReversed(edge)
      });
    });
  }
  // Parse once here to keep invalid duration strings from leaking into NaN delays.
  if (!Number.isFinite(animationDurationMs(animationDuration))) {
    return new Map();
  }
  return timings;
}

function edgeLightbarScanDirectionReversed(edge: DesktopNoticeScreenEdge) {
  return edge === 'bottom' || edge === 'left';
}

function edgeLightbarScanGroups(enabledEdges: DesktopNoticeScreenEdge[]): EdgeLightbarScanGroup[] {
  const enabled = new Set(enabledEdges);
  const orderedEdges = EDGE_LIGHTBAR_SCAN_EDGE_ORDER.filter((edge) => enabled.has(edge));
  if (orderedEdges.length <= 1) {
    return orderedEdges.map((edge) => ({ edges: [edge], connected: false }));
  }

  if (orderedEdges.length === EDGE_LIGHTBAR_SCAN_EDGE_ORDER.length) {
    return [{ edges: EDGE_LIGHTBAR_SCAN_EDGE_ORDER, connected: true }];
  }

  const groups: DesktopNoticeScreenEdge[][] = [];
  let currentGroup: DesktopNoticeScreenEdge[] = [];

  for (const edge of EDGE_LIGHTBAR_SCAN_EDGE_ORDER) {
    if (!enabled.has(edge)) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      continue;
    }
    currentGroup.push(edge);
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const firstGroup = groups[0];
  const lastGroup = groups[groups.length - 1];
  if (
    groups.length > 1 &&
    firstGroup?.[0] === 'top' &&
    lastGroup?.[lastGroup.length - 1] === 'left'
  ) {
    const wrappedGroup = [...lastGroup, ...firstGroup];
    return [
      { edges: wrappedGroup, connected: wrappedGroup.length > 1 },
      ...groups.slice(1, -1).map((edges) => ({ edges, connected: edges.length > 1 }))
    ];
  }

  return groups.map((edges) => ({ edges, connected: edges.length > 1 }));
}

function connectedScanAnimationDelay(
  scanTiming: EdgeLightbarScanTiming,
  animationDuration: string
) {
  const durationMs = animationDurationMs(animationDuration);
  if (!Number.isFinite(durationMs) || scanTiming.groupSize <= 1) {
    return undefined;
  }
  return `${Math.round((durationMs / scanTiming.groupSize) * scanTiming.groupIndex)}ms`;
}

function animationDurationMs(animationDuration: string) {
  return Number(animationDuration.replace('ms', ''));
}

function edgeBreathingHaloClass(edge: ResolvedDesktopNoticeEdge) {
  if (edge === 'top') {
    return 'left-[-18%] right-[-18%] top-0 h-[30px]';
  }
  if (edge === 'left') {
    return 'bottom-[-18%] top-[-18%] left-0 w-[30px]';
  }
  if (edge === 'right') {
    return 'bottom-[-18%] top-[-18%] right-0 w-[30px]';
  }
  return 'left-[-18%] right-[-18%] bottom-0 h-[30px]';
}

function edgeBreathingLineClass(edge: ResolvedDesktopNoticeEdge) {
  if (edge === 'top') {
    return 'left-[-18%] right-[-18%] top-[1px] h-[2px]';
  }
  if (edge === 'left') {
    return 'bottom-[-18%] top-[-18%] left-[1px] w-[2px]';
  }
  if (edge === 'right') {
    return 'bottom-[-18%] top-[-18%] right-[1px] w-[2px]';
  }
  return 'left-[-18%] right-[-18%] bottom-[1px] h-[2px]';
}

function edgeBreathingHaloStyle(
  payload: DesktopNoticeWindowPayload,
  edge: ResolvedDesktopNoticeEdge
): CSSProperties {
  return buildEdgeBreathingHaloStyle(payload.appearance.colorMode, payload.appearance.colors, edge);
}

function edgeBreathingLineStyle(
  payload: DesktopNoticeWindowPayload,
  edge: ResolvedDesktopNoticeEdge
): CSSProperties {
  return buildEdgeBreathingLineStyle(payload.appearance.colorMode, payload.appearance.colors, edge);
}

function edgeBreathingLayerStyle(
  payload: DesktopNoticeWindowPayload,
  style: CSSProperties,
  animationDuration?: string
): DesktopNoticeWindowStyle {
  return {
    ...style,
    '--desktop-notice-opacity': String(lightbarOpacity(payload)),
    '--desktop-notice-breathing-dim-opacity': String(lightbarBreathingDimOpacity(payload)),
    animationDuration
  };
}

function edgeBreathingAnimationClass(edge: ResolvedDesktopNoticeEdge) {
  return `desktop-notice-edge-breathing desktop-notice-edge-breathing-${edgeOrientationForEdge(edge)}`;
}

function primaryEffectColor(payload: DesktopNoticeWindowPayload) {
  const color = payload.appearance.colors[0]?.color ?? '#22C55E';
  return rgbFromHex(color);
}

function edgeLightbarEdgeFrameStyle(
  edge: DesktopNoticeScreenEdge,
  settings: EdgeLightbarSettings
): CSSProperties {
  const inset = `${settings.insetPx}px`;
  const thickness = `${settings.thicknessPx}px`;
  if (edge === 'top') {
    return { left: inset, right: inset, top: inset, height: thickness };
  }
  if (edge === 'bottom') {
    return { left: inset, right: inset, bottom: inset, height: thickness };
  }
  if (edge === 'left') {
    return { left: inset, top: inset, bottom: inset, width: thickness };
  }
  return { right: inset, top: inset, bottom: inset, width: thickness };
}

function lightbarCornerRadiusStyle(cornerRadiusPercent: number): CSSProperties {
  const radius = `${cornerRadiusPercent}%`;
  return {
    borderRadius: radius,
    clipPath: `inset(0 round ${radius})`
  };
}

function lightbarShapeStyle(payload: DesktopNoticeWindowPayload): CSSProperties {
  if (isEdgeBreathingEffect(payload)) {
    return {
      borderRadius: `${payload.cornerRadiusPercent}%`
    };
  }
  return lightbarCornerRadiusStyle(payload.cornerRadiusPercent);
}

function edgeBreathingTransformOriginStyle(edge: ResolvedDesktopNoticeEdge): CSSProperties {
  if (edge === 'top') {
    return { transformOrigin: '50% 0%' };
  }
  if (edge === 'left') {
    return { transformOrigin: '0% 50%' };
  }
  if (edge === 'right') {
    return { transformOrigin: '100% 50%' };
  }
  return { transformOrigin: '50% 100%' };
}
