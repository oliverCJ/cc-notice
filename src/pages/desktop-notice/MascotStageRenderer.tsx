import { useEffect, useMemo, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react';
import dotLottieWasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url';
import {
  normalizeDesktopMascotPlaybackWindowMs,
  type DesktopNoticeWindowPayload
} from '@/domain/desktopNotice';
import {
  DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS,
  desktopMascotBubbleFontCssFamily,
  desktopMascotActionLoop,
  desktopMascotRuntimePackById,
  type DesktopMascotAction
} from '@/domain/desktopMascot';
import { desktopMascotAnimationPath } from './desktopMascotAssets';

setWasmUrl(dotLottieWasmUrl);

const IDLE_ROTATION_INTERVAL_MS = 7000;

type MascotStageRendererProps = {
  payload: DesktopNoticeWindowPayload;
};

export function MascotStageRenderer({ payload }: MascotStageRendererProps) {
  const mascot = payload.mascot;
  const pack = mascot
    ? payload.resolvedMascotPack ?? desktopMascotRuntimePackById(mascot.assetPackId)
    : null;
  const requestedState = payload.mascotState ?? mascot?.idleState ?? 'idle';
  const [forceIdleAfterOnce, setForceIdleAfterOnce] = useState(false);
  const [freezeGifFrame, setFreezeGifFrame] = useState(false);
  const gifImageRef = useRef<HTMLImageElement | null>(null);
  const gifFreezeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const idleActions = useMemo(
    () => pack?.actions.filter((item) => item.state === 'idle') ?? [],
    [pack]
  );
  const shouldRotateIdleActions =
    !payload.mascotActionId && requestedState === 'idle' && idleActions.length > 1;
  const [rotatingIdleActionId, setRotatingIdleActionId] = useState<string | null>(null);
  const requestedAction = pack ? selectMascotAction(pack.actions, payload.mascotActionId, requestedState, mascot?.idleState) : null;
  const effectivePlayMode = resolveEffectiveMascotPlayMode(requestedAction, payload.mascotPlayMode);
  const playbackWindowMs = normalizeDesktopMascotPlaybackWindowMs(payload.mascotPlaybackWindowMs);

  useEffect(() => {
    if (!shouldRotateIdleActions) {
      setRotatingIdleActionId(null);
      return;
    }
    setRotatingIdleActionId((current) =>
      current && idleActions.some((action) => action.id === current)
        ? current
        : idleActions[0]?.id ?? null
    );
    const timer = window.setInterval(() => {
      setRotatingIdleActionId((current) => nextIdleActionId(idleActions, current));
    }, IDLE_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [idleActions, shouldRotateIdleActions]);

  useEffect(() => {
    setForceIdleAfterOnce(false);
    setFreezeGifFrame(false);
    if (
      !pack ||
      (effectivePlayMode !== 'once-then-idle' &&
        !(pack.renderer === 'gif' && effectivePlayMode === 'once-then-hold'))
    ) {
      return;
    }
    if (!payload.mascotActionId && requestedState === 'idle') {
      return;
    }
    const timer = window.setTimeout(() => {
      if (effectivePlayMode === 'once-then-idle') {
        setForceIdleAfterOnce(true);
        return;
      }
      setFreezeGifFrame(true);
    }, Math.min(payload.durationMs ?? playbackWindowMs, playbackWindowMs));
    return () => window.clearTimeout(timer);
  }, [
    effectivePlayMode,
    pack,
    payload.durationMs,
    payload.mascotActionId,
    playbackWindowMs,
    requestedState
  ]);

  useEffect(() => {
    if (!freezeGifFrame) {
      return;
    }
    const image = gifImageRef.current;
    const canvas = gifFreezeCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!image || !canvas || !context) {
      return;
    }
    const width = image.naturalWidth || image.clientWidth || 1;
    const height = image.naturalHeight || image.clientHeight || 1;
    canvas.width = width;
    canvas.height = height;
    try {
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
    } catch (error) {
      console.warn('failed to freeze desktop mascot gif frame', error);
    }
  }, [freezeGifFrame]);

  if (!mascot) {
    return null;
  }
  if (!pack) {
    return <MascotError message="精灵资源包不存在" />;
  }

  const effectiveRequestedState = forceIdleAfterOnce ? mascot.idleState : requestedState;
  const effectiveActionId = forceIdleAfterOnce ? null : payload.mascotActionId;
  const action =
    (!forceIdleAfterOnce && shouldRotateIdleActions
      ? idleActions.find((item) => item.id === rotatingIdleActionId) ?? idleActions[0]
      : null) ??
    selectMascotAction(pack.actions, effectiveActionId, effectiveRequestedState, mascot.idleState);
  if (!action) {
    return <MascotError message="精灵动作不存在" />;
  }
  const animationUrl = desktopMascotAnimationUrl(pack, action.animation);
  if (!animationUrl) {
    return <MascotError message="精灵动画资源不存在" />;
  }
  const bubbleFontSizePx = clampBubbleFontSize(mascot.bubbleFontSizePx);

  return (
    <section
      data-testid="desktop-mascot-stage"
      data-tauri-drag-region=""
      className="relative isolate h-full w-full overflow-hidden bg-transparent"
      aria-label={payload.name}
    >
      {pack.renderer === 'gif' ? (
        <>
          <img
            key={animationUrl}
            ref={gifImageRef}
            data-testid="desktop-mascot-gif"
            src={animationUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`relative z-0 h-full w-full object-contain ${freezeGifFrame ? 'opacity-0' : ''}`}
          />
          {freezeGifFrame ? (
            <canvas
              ref={gifFreezeCanvasRef}
              data-testid="desktop-mascot-gif-freeze"
              aria-hidden="true"
              className="absolute inset-0 z-0 h-full w-full object-contain"
            />
          ) : null}
        </>
      ) : (
        <DotLottieReact
          src={animationUrl}
          autoplay
          loop={resolveMascotLoop(action, payload.mascotPlayMode)}
          className="relative z-0 h-full w-full"
        />
      )}
      {mascot.bubbleEnabled && payload.mascotBubbleText ? (
        <div
          data-testid="desktop-mascot-bubble"
          className={`desktop-mascot-bubble pointer-events-none absolute z-20 max-w-[150px] whitespace-pre-line rounded-[18px] border border-[#f2d8c6] bg-[#fffaf3]/95 px-3.5 py-2.5 font-semibold leading-[1.35] text-[#6b3f32] shadow-[0_8px_20px_rgba(99,56,38,0.16)] ring-1 ring-white/75 ${bubblePlacementClass(mascot.bubblePlacement)}`}
          style={{
            fontFamily: desktopMascotBubbleFontCssFamily(mascot.bubbleFontId),
            fontSize: `${bubbleFontSizePx}px`
          }}
        >
          <span className="relative z-10 block">{payload.mascotBubbleText}</span>
          <span
            data-testid="desktop-mascot-bubble-tail"
            aria-hidden="true"
            className={`absolute h-3.5 w-3.5 rotate-45 border-b border-r border-[#f2d8c6] bg-[#fffaf3] ${bubbleTailClass(mascot.bubblePlacement)}`}
          />
        </div>
      ) : null}
    </section>
  );
}

function clampBubbleFontSize(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 14;
  }
  return Math.min(
    DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS.max,
    Math.max(DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS.min, value)
  );
}

function resolveMascotLoop(
  action: DesktopMascotAction,
  playMode: DesktopNoticeWindowPayload['mascotPlayMode']
): boolean {
  const effectivePlayMode = resolveEffectiveMascotPlayMode(action, playMode);
  if (effectivePlayMode === 'loop') {
    return true;
  }
  if (effectivePlayMode === 'once-then-hold' || effectivePlayMode === 'once-then-idle') {
    return false;
  }
  return desktopMascotActionLoop(action);
}

function resolveEffectiveMascotPlayMode(
  action: DesktopMascotAction | null,
  playMode: DesktopNoticeWindowPayload['mascotPlayMode']
): DesktopNoticeWindowPayload['mascotPlayMode'] {
  if (playMode && playMode !== 'default') {
    return playMode;
  }
  return action?.playMode ?? 'default';
}

function selectMascotAction(
  actions: DesktopMascotAction[],
  actionId: string | null | undefined,
  state: string | null | undefined,
  idleState: string | null | undefined
): DesktopMascotAction | null {
  return (
    actions.find((item) => item.id === actionId) ??
    actions.find((item) => item.state === state) ??
    actions.find((item) => item.state === idleState) ??
    null
  );
}

function desktopMascotAnimationUrl(
  pack: NonNullable<DesktopNoticeWindowPayload['resolvedMascotPack']>,
  animationId: string
): string | null {
  if (pack.source === 'local') {
    const path = pack.animations[animationId];
    return path ? convertFileSrc(path) : null;
  }
  return desktopMascotAnimationPath(pack.id, animationId);
}

function nextIdleActionId(
  actions: Array<{ id: string }>,
  currentActionId: string | null
): string | null {
  if (actions.length === 0) {
    return null;
  }
  if (actions.length === 1) {
    return actions[0].id;
  }
  const candidates = actions.filter((action) => action.id !== currentActionId);
  return candidates[Math.floor(Math.random() * candidates.length)]?.id ?? actions[0].id;
}

function bubblePlacementClass(placement: string) {
  if (placement === 'top-left') {
    return 'left-5 top-3 -rotate-1';
  }
  if (placement === 'top') {
    return 'left-1/2 top-2 -translate-x-1/2 -rotate-1';
  }
  return 'right-5 top-3 rotate-1';
}

function bubbleTailClass(placement: string) {
  if (placement === 'top-left') {
    return '-bottom-1 left-7';
  }
  if (placement === 'top') {
    return '-bottom-1 left-1/2 -translate-x-1/2';
  }
  return '-bottom-1 right-7';
}

function MascotError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-red-500/15 px-4 text-center text-xs text-red-200">
      {message}
    </div>
  );
}
