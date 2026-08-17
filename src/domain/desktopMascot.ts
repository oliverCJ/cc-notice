import type {
  DesktopNoticeBounds,
  DesktopNoticePresetPosition,
  DesktopNoticeSize
} from './desktopNotice';

export type DesktopMascotState =
  | 'task-received'
  | 'working'
  | 'waiting-input'
  | 'thinking'
  | 'success'
  | 'warning'
  | 'error'
  | 'idle';

export type DesktopMascotBubblePlacement = 'top' | 'top-left' | 'top-right';
export type DesktopMascotBubbleFontId =
  | 'soft-handwriting'
  | 'round-cute'
  | 'comic'
  | 'clean-sans'
  | 'system-default';
export type DesktopMascotPlayMode =
  | 'default'
  | 'loop'
  | 'once-then-hold'
  | 'once-then-idle';

export type DesktopMascotSettings = {
  assetPackId: string;
  stageSize: DesktopNoticeSize;
  presetPosition: DesktopNoticePresetPosition;
  boundsOverride?: DesktopNoticeBounds | null;
  idleState: DesktopMascotState;
  interactionEnabled: boolean;
  bubbleEnabled: boolean;
  bubblePlacement: DesktopMascotBubblePlacement;
  bubbleFontSizePx: number;
  bubbleFontId: DesktopMascotBubbleFontId;
};

export type DesktopMascotAction = {
  id: string;
  labelKey?: string;
  label?: string | null;
  state: DesktopMascotState;
  animation: string;
  loop?: boolean;
  loopEnabled?: boolean;
  interruptible: boolean;
  playMode?: DesktopMascotPlayMode | null;
};

export type DesktopMascotRenderer = 'lottie' | 'gif';

export type DesktopMascotAssetPack = {
  id: string;
  nameKey?: string;
  name?: string;
  version: string;
  renderer: DesktopMascotRenderer;
  animations: Record<string, string>;
  states: DesktopMascotState[];
  actions: DesktopMascotAction[];
  interactions: {
    hoverActionId: string;
    clickActionId: string;
  };
};

export type DesktopMascotPackSource = 'bundled' | 'local';

export type DesktopMascotRuntimePack = DesktopMascotAssetPack & {
  source: DesktopMascotPackSource;
};

export type CustomMascotDiagnostic = {
  packId?: string | null;
  path: string;
  code: string;
  message: string;
};

export type CustomMascotScanResult = {
  rootDir: string;
  packs: DesktopMascotRuntimePack[];
  diagnostics: CustomMascotDiagnostic[];
};

export type DesktopMascotValidationCode =
  | 'DESKTOP_MASCOT_ASSET_PACK_NOT_FOUND'
  | 'DESKTOP_MASCOT_ACTION_NOT_FOUND'
  | 'DESKTOP_MASCOT_STATE_NOT_FOUND'
  | 'DESKTOP_MASCOT_INVALID_STAGE_SIZE'
  | 'DESKTOP_MASCOT_INVALID_BUBBLE_TEXT';

export type DesktopMascotValidationResult =
  | { valid: true }
  | { valid: false; code: DesktopMascotValidationCode };

export const WARM_BUDDY_DESKTOP_MASCOT_ASSET_PACK_ID = 'warm-buddy';
export const G7_DESKTOP_MASCOT_ASSET_PACK_ID = 'g7-buddy';
export const DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID = G7_DESKTOP_MASCOT_ASSET_PACK_ID;

export const DESKTOP_MASCOT_STAGE_SIZE_LIMITS = {
  minWidth: 160,
  maxWidth: 520,
  minHeight: 160,
  maxHeight: 520
};

export const DESKTOP_MASCOT_BUBBLE_LIMITS = {
  maxLines: 2,
  maxCharsPerLine: 18
};

export const DESKTOP_MASCOT_BUBBLE_FONT_SIZE_LIMITS = {
  min: 12,
  max: 20
};

export const DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_ID: DesktopMascotBubbleFontId =
  'soft-handwriting';

export type DesktopMascotBubbleFontOption = {
  id: DesktopMascotBubbleFontId;
  labelKey: string;
  cssFamily: string;
};

export const desktopMascotBubbleFontOptions: DesktopMascotBubbleFontOption[] = [
  {
    id: 'soft-handwriting',
    labelKey: 'desktopNotice.mascot.bubbleFonts.softHandwriting',
    cssFamily:
      '"Klee One", "Hannotate SC", "Xingkai SC", "Marker Felt", "Bradley Hand", cursive, sans-serif'
  },
  {
    id: 'round-cute',
    labelKey: 'desktopNotice.mascot.bubbleFonts.roundCute',
    cssFamily:
      '"Yuanti SC", "YouYuan", "Microsoft YaHei UI", "Noto Sans CJK SC", "PingFang SC", sans-serif'
  },
  {
    id: 'comic',
    labelKey: 'desktopNotice.mascot.bubbleFonts.comic',
    cssFamily:
      '"HanziPen SC", "翩翩体-简", "Hannotate SC", "手札体-简", "LXGW WenKai", "霞鹜文楷", "Comic Sans MS", "Segoe Print", "Comic Neue", cursive, sans-serif'
  },
  {
    id: 'clean-sans',
    labelKey: 'desktopNotice.mascot.bubbleFonts.cleanSans',
    cssFamily: '"Inter", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif'
  },
  {
    id: 'system-default',
    labelKey: 'desktopNotice.mascot.bubbleFonts.systemDefault',
    cssFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
];

export const DESKTOP_MASCOT_STATES: DesktopMascotState[] = [
  'task-received',
  'working',
  'waiting-input',
  'thinking',
  'success',
  'warning',
  'error',
  'idle'
];

export const warmBuddyMascotPack: DesktopMascotAssetPack = {
  id: WARM_BUDDY_DESKTOP_MASCOT_ASSET_PACK_ID,
  nameKey: 'desktopNotice.mascot.packs.warmBuddy',
  version: '1.0.0',
  renderer: 'lottie',
  animations: {
    idle: '/assets/desktop-mascots/warm-buddy/animations/idle.json',
    working: '/assets/desktop-mascots/warm-buddy/animations/working.json',
    success: '/assets/desktop-mascots/warm-buddy/animations/success.json',
    error: '/assets/desktop-mascots/warm-buddy/animations/error.json',
    wave: '/assets/desktop-mascots/warm-buddy/animations/wave.json'
  },
  states: DESKTOP_MASCOT_STATES,
  actions: [
    {
      id: 'task-received.wave',
      labelKey: 'desktopNotice.mascot.actions.taskReceivedWave',
      state: 'task-received',
      animation: 'wave',
      loop: false,
      interruptible: true
    },
    {
      id: 'working.loop',
      labelKey: 'desktopNotice.mascot.actions.workingLoop',
      state: 'working',
      animation: 'working',
      loop: true,
      interruptible: true
    },
    {
      id: 'waiting-input.look-around',
      labelKey: 'desktopNotice.mascot.actions.waitingInputLookAround',
      state: 'waiting-input',
      animation: 'idle',
      loop: true,
      interruptible: true
    },
    {
      id: 'thinking.loop',
      labelKey: 'desktopNotice.mascot.actions.thinkingLoop',
      state: 'thinking',
      animation: 'working',
      loop: true,
      interruptible: true
    },
    {
      id: 'success.jump',
      labelKey: 'desktopNotice.mascot.actions.successJump',
      state: 'success',
      animation: 'success',
      loop: false,
      interruptible: false
    },
    {
      id: 'warning.notice',
      labelKey: 'desktopNotice.mascot.actions.warningNotice',
      state: 'warning',
      animation: 'wave',
      loop: false,
      interruptible: false
    },
    {
      id: 'error.shake',
      labelKey: 'desktopNotice.mascot.actions.errorShake',
      state: 'error',
      animation: 'error',
      loop: false,
      interruptible: false
    },
    {
      id: 'idle.breathe',
      labelKey: 'desktopNotice.mascot.actions.idleBreathe',
      state: 'idle',
      animation: 'idle',
      loop: true,
      interruptible: true
    }
  ],
  interactions: {
    hoverActionId: 'idle.breathe',
    clickActionId: 'task-received.wave'
  }
};

export const g7BuddyMascotPack: DesktopMascotAssetPack = {
  id: G7_DESKTOP_MASCOT_ASSET_PACK_ID,
  nameKey: 'desktopNotice.mascot.packs.g7Buddy',
  version: '1.0.0',
  renderer: 'gif',
  animations: {
    idle: '/assets/desktop-mascots/g7-buddy/animations/idle.gif',
    working: '/assets/desktop-mascots/g7-buddy/animations/working.gif',
    thinking: '/assets/desktop-mascots/g7-buddy/animations/thinking.gif',
    'waiting-input': '/assets/desktop-mascots/g7-buddy/animations/waiting-input.gif',
    success: '/assets/desktop-mascots/g7-buddy/animations/success.gif',
    warning: '/assets/desktop-mascots/g7-buddy/animations/warning.gif',
    error: '/assets/desktop-mascots/g7-buddy/animations/error.gif',
    wave: '/assets/desktop-mascots/g7-buddy/animations/wave.gif',
    hug: '/assets/desktop-mascots/g7-buddy/animations/hug.gif',
    sleep: '/assets/desktop-mascots/g7-buddy/animations/sleep.gif',
    call: '/assets/desktop-mascots/g7-buddy/animations/call.gif',
    cheer: '/assets/desktop-mascots/g7-buddy/animations/cheer.gif',
    fly: '/assets/desktop-mascots/g7-buddy/animations/fly.gif',
    laugh: '/assets/desktop-mascots/g7-buddy/animations/laugh.gif',
    flowers: '/assets/desktop-mascots/g7-buddy/animations/flowers.gif',
    thanks: '/assets/desktop-mascots/g7-buddy/animations/thanks.gif',
    love: '/assets/desktop-mascots/g7-buddy/animations/love.gif',
    bye: '/assets/desktop-mascots/g7-buddy/animations/bye.gif',
    'red-packet': '/assets/desktop-mascots/g7-buddy/animations/red-packet.gif'
  },
  states: DESKTOP_MASCOT_STATES,
  actions: [
    {
      id: 'task-received.wave',
      labelKey: 'desktopNotice.mascot.actions.taskReceivedWave',
      state: 'task-received',
      animation: 'wave',
      loop: true,
      interruptible: true
    },
    {
      id: 'task-received.working',
      labelKey: 'desktopNotice.mascot.actions.taskReceivedWorking',
      state: 'task-received',
      animation: 'working',
      loop: true,
      interruptible: true
    },
    {
      id: 'task-received.cheer',
      labelKey: 'desktopNotice.mascot.actions.taskReceivedCheer',
      state: 'task-received',
      animation: 'cheer',
      loop: true,
      interruptible: true
    },
    {
      id: 'task-received.fly',
      labelKey: 'desktopNotice.mascot.actions.taskReceivedFly',
      state: 'task-received',
      animation: 'fly',
      loop: true,
      interruptible: true
    },
    {
      id: 'working.loop',
      labelKey: 'desktopNotice.mascot.actions.workingLoop',
      state: 'working',
      animation: 'working',
      loop: true,
      interruptible: true
    },
    {
      id: 'working.cheer',
      labelKey: 'desktopNotice.mascot.actions.workingCheer',
      state: 'working',
      animation: 'cheer',
      loop: true,
      interruptible: true
    },
    {
      id: 'working.call',
      labelKey: 'desktopNotice.mascot.actions.workingCall',
      state: 'working',
      animation: 'call',
      loop: true,
      interruptible: true
    },
    {
      id: 'waiting-input.surprised',
      labelKey: 'desktopNotice.mascot.actions.waitingInputSurprised',
      state: 'waiting-input',
      animation: 'waiting-input',
      loop: true,
      interruptible: true
    },
    {
      id: 'thinking.loop',
      labelKey: 'desktopNotice.mascot.actions.thinkingLoop',
      state: 'thinking',
      animation: 'thinking',
      loop: true,
      interruptible: true
    },
    {
      id: 'success.ok',
      labelKey: 'desktopNotice.mascot.actions.successOk',
      state: 'success',
      animation: 'success',
      loop: true,
      interruptible: false
    },
    {
      id: 'success.hug',
      labelKey: 'desktopNotice.mascot.actions.successHug',
      state: 'success',
      animation: 'hug',
      loop: true,
      interruptible: false
    },
    {
      id: 'success.flowers',
      labelKey: 'desktopNotice.mascot.actions.successFlowers',
      state: 'success',
      animation: 'flowers',
      loop: true,
      interruptible: false
    },
    {
      id: 'success.laugh',
      labelKey: 'desktopNotice.mascot.actions.successLaugh',
      state: 'success',
      animation: 'laugh',
      loop: true,
      interruptible: false
    },
    {
      id: 'success.red-packet',
      labelKey: 'desktopNotice.mascot.actions.successRedPacket',
      state: 'success',
      animation: 'red-packet',
      loop: true,
      interruptible: false
    },
    {
      id: 'warning.surprised',
      labelKey: 'desktopNotice.mascot.actions.warningSurprised',
      state: 'warning',
      animation: 'warning',
      loop: true,
      interruptible: false
    },
    {
      id: 'error.cry',
      labelKey: 'desktopNotice.mascot.actions.errorCry',
      state: 'error',
      animation: 'error',
      loop: true,
      interruptible: false
    },
    {
      id: 'idle.sleep',
      labelKey: 'desktopNotice.mascot.actions.idleSleep',
      state: 'idle',
      animation: 'sleep',
      loop: true,
      interruptible: true
    },
    {
      id: 'idle.hi',
      labelKey: 'desktopNotice.mascot.actions.idleHi',
      state: 'idle',
      animation: 'wave',
      loop: true,
      interruptible: true
    },
    {
      id: 'idle.laugh',
      labelKey: 'desktopNotice.mascot.actions.idleLaugh',
      state: 'idle',
      animation: 'laugh',
      loop: true,
      interruptible: true
    },
    {
      id: 'idle.thanks',
      labelKey: 'desktopNotice.mascot.actions.idleThanks',
      state: 'idle',
      animation: 'thanks',
      loop: true,
      interruptible: true
    },
    {
      id: 'idle.love',
      labelKey: 'desktopNotice.mascot.actions.idleLove',
      state: 'idle',
      animation: 'love',
      loop: true,
      interruptible: true
    },
    {
      id: 'idle.bye',
      labelKey: 'desktopNotice.mascot.actions.idleBye',
      state: 'idle',
      animation: 'bye',
      loop: true,
      interruptible: true
    }
  ],
  interactions: {
    hoverActionId: 'idle.sleep',
    clickActionId: 'task-received.wave'
  }
};

export const builtInMascotPacks = [g7BuddyMascotPack, warmBuddyMascotPack];
export const selectableMascotPacks = [g7BuddyMascotPack];
export const builtInRuntimeMascotPacks: DesktopMascotRuntimePack[] = builtInMascotPacks.map(
  (pack) => ({
    ...pack,
    source: 'bundled'
  })
);

export function createDefaultMascotSettings(): DesktopMascotSettings {
  return {
    assetPackId: DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID,
    stageSize: { width: 260, height: 260 },
    presetPosition: 'bottom-right',
    boundsOverride: null,
    idleState: 'idle',
    interactionEnabled: false,
    bubbleEnabled: false,
    bubblePlacement: 'top-right',
    bubbleFontSizePx: 14,
    bubbleFontId: DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_ID
  };
}

export function desktopMascotBubbleFontCssFamily(fontId: string | null | undefined): string {
  return (
    desktopMascotBubbleFontOptions.find((option) => option.id === fontId)?.cssFamily ??
    desktopMascotBubbleFontOptions.find((option) => option.id === DEFAULT_DESKTOP_MASCOT_BUBBLE_FONT_ID)!
      .cssFamily
  );
}

export function desktopMascotPackById(assetPackId: string): DesktopMascotAssetPack | null {
  return builtInMascotPacks.find((pack) => pack.id === assetPackId) ?? null;
}

export function desktopMascotRuntimePackById(
  assetPackId: string,
  customPacks: DesktopMascotRuntimePack[] = []
): DesktopMascotRuntimePack | null {
  const builtIn = builtInRuntimeMascotPacks.find((pack) => pack.id === assetPackId);
  if (builtIn) {
    return builtIn;
  }
  return customPacks.find((pack) => pack.id === assetPackId) ?? null;
}

export function desktopMascotActionsForState(
  pack: DesktopMascotAssetPack,
  state: DesktopMascotState
): DesktopMascotAction[] {
  return pack.actions.filter((action) => action.state === state);
}

export function desktopMascotActionLoop(action: DesktopMascotAction): boolean {
  return action.loop ?? action.loopEnabled ?? false;
}

export function desktopMascotActionLabel(
  action: DesktopMascotAction,
  translate: (key: string) => string
): string {
  if (action.labelKey) {
    return translate(action.labelKey);
  }
  return action.label ?? action.id;
}

export function validateMascotBubbleText(value: string): DesktopMascotValidationResult {
  const lines = value.split(/\r?\n/);
  if (lines.length > DESKTOP_MASCOT_BUBBLE_LIMITS.maxLines) {
    return { valid: false, code: 'DESKTOP_MASCOT_INVALID_BUBBLE_TEXT' };
  }
  if (lines.some((line) => [...line].length > DESKTOP_MASCOT_BUBBLE_LIMITS.maxCharsPerLine)) {
    return { valid: false, code: 'DESKTOP_MASCOT_INVALID_BUBBLE_TEXT' };
  }
  return { valid: true };
}
