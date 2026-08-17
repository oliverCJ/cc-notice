import { HookConfigTargetStatus } from '@/api/tauriApi';

export function defaultTargetDebugEnabled(
  targets: HookConfigTargetStatus[] | undefined,
  targetId: string
) {
  const target = targets?.find((target) => target.id === targetId);

  if (!target) {
    return true;
  }
  return target.exists ? target.debugEnabled : true;
}
