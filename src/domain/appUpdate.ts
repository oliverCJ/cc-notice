import type { AppUpdateCheckResult } from '@/api/tauriApi';

export type AppUpdateUiStatus = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

export type AppUpdateState = {
  status: AppUpdateUiStatus;
  result: AppUpdateCheckResult | null;
  error: string | null;
  lastCheckedAt: number | null;
  checking: boolean;
};

export function formatPublishedAt(value: string | null, language: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
