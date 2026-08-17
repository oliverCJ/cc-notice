import g7BuddyManifest from '@/assets/desktop-mascots/g7-buddy/manifest.json';
import g7BuddyByeUrl from '@/assets/desktop-mascots/g7-buddy/animations/bye.gif?url';
import g7BuddyCallUrl from '@/assets/desktop-mascots/g7-buddy/animations/call.gif?url';
import g7BuddyCheerUrl from '@/assets/desktop-mascots/g7-buddy/animations/cheer.gif?url';
import g7BuddyErrorUrl from '@/assets/desktop-mascots/g7-buddy/animations/error.gif?url';
import g7BuddyFlowersUrl from '@/assets/desktop-mascots/g7-buddy/animations/flowers.gif?url';
import g7BuddyFlyUrl from '@/assets/desktop-mascots/g7-buddy/animations/fly.gif?url';
import g7BuddyHugUrl from '@/assets/desktop-mascots/g7-buddy/animations/hug.gif?url';
import g7BuddyIdleUrl from '@/assets/desktop-mascots/g7-buddy/animations/idle.gif?url';
import g7BuddyLaughUrl from '@/assets/desktop-mascots/g7-buddy/animations/laugh.gif?url';
import g7BuddyLoveUrl from '@/assets/desktop-mascots/g7-buddy/animations/love.gif?url';
import g7BuddyRedPacketUrl from '@/assets/desktop-mascots/g7-buddy/animations/red-packet.gif?url';
import g7BuddySleepUrl from '@/assets/desktop-mascots/g7-buddy/animations/sleep.gif?url';
import g7BuddySuccessUrl from '@/assets/desktop-mascots/g7-buddy/animations/success.gif?url';
import g7BuddyThanksUrl from '@/assets/desktop-mascots/g7-buddy/animations/thanks.gif?url';
import g7BuddyThinkingUrl from '@/assets/desktop-mascots/g7-buddy/animations/thinking.gif?url';
import g7BuddyWaitingInputUrl from '@/assets/desktop-mascots/g7-buddy/animations/waiting-input.gif?url';
import g7BuddyWarningUrl from '@/assets/desktop-mascots/g7-buddy/animations/warning.gif?url';
import g7BuddyWaveUrl from '@/assets/desktop-mascots/g7-buddy/animations/wave.gif?url';
import g7BuddyWorkingUrl from '@/assets/desktop-mascots/g7-buddy/animations/working.gif?url';
import warmBuddyManifest from '@/assets/desktop-mascots/warm-buddy/manifest.json';
import warmBuddyErrorUrl from '@/assets/desktop-mascots/warm-buddy/animations/error.json?url';
import warmBuddyIdleUrl from '@/assets/desktop-mascots/warm-buddy/animations/idle.json?url';
import warmBuddySuccessUrl from '@/assets/desktop-mascots/warm-buddy/animations/success.json?url';
import warmBuddyWaveUrl from '@/assets/desktop-mascots/warm-buddy/animations/wave.json?url';
import warmBuddyWorkingUrl from '@/assets/desktop-mascots/warm-buddy/animations/working.json?url';

type DesktopMascotManifest = typeof warmBuddyManifest;

export const desktopMascotAssetManifests: Record<string, DesktopMascotManifest> = {
  'g7-buddy': g7BuddyManifest,
  'warm-buddy': warmBuddyManifest
};

export const desktopMascotAssetStatus: Record<string, 'asset-pending' | 'ready'> = {
  'g7-buddy': g7BuddyManifest.status === 'asset-pending' ? 'asset-pending' : 'ready',
  'warm-buddy': warmBuddyManifest.status === 'asset-pending' ? 'asset-pending' : 'ready'
};

export const desktopMascotAnimationUrls: Record<string, Record<string, string>> = {
  'g7-buddy': {
    idle: g7BuddyIdleUrl,
    working: g7BuddyWorkingUrl,
    thinking: g7BuddyThinkingUrl,
    'waiting-input': g7BuddyWaitingInputUrl,
    success: g7BuddySuccessUrl,
    warning: g7BuddyWarningUrl,
    error: g7BuddyErrorUrl,
    wave: g7BuddyWaveUrl,
    hug: g7BuddyHugUrl,
    sleep: g7BuddySleepUrl,
    call: g7BuddyCallUrl,
    cheer: g7BuddyCheerUrl,
    fly: g7BuddyFlyUrl,
    laugh: g7BuddyLaughUrl,
    flowers: g7BuddyFlowersUrl,
    thanks: g7BuddyThanksUrl,
    love: g7BuddyLoveUrl,
    bye: g7BuddyByeUrl,
    'red-packet': g7BuddyRedPacketUrl
  },
  'warm-buddy': {
    idle: warmBuddyIdleUrl,
    working: warmBuddyWorkingUrl,
    success: warmBuddySuccessUrl,
    error: warmBuddyErrorUrl,
    wave: warmBuddyWaveUrl
  }
};

export function desktopMascotAnimationPath(assetPackId: string, animationId: string): string | null {
  return desktopMascotAnimationUrls[assetPackId]?.[animationId] ?? null;
}
