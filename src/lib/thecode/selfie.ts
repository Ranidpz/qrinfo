// קוד הגמדים — group selfie settings. PURE: shared by the server (photo route, sweep,
// leaderboard), the operator admin and the player app. Absent settings = on, 14 days.

import type { TheCodeConfig, TheCodeSelfieSettings } from '@/types/thecode';

export const SELFIE_LIMITS = { minDays: 1, maxDays: 90, defaultDays: 14, maxBytes: 400 * 1024, sizePx: 512 } as const;

export function resolveSelfie(config: Pick<TheCodeConfig, 'selfie'>): TheCodeSelfieSettings {
  const s = config.selfie;
  const days = Math.round(Number(s?.retentionDays));
  return {
    enabled: s?.enabled !== false,
    retentionDays: Number.isFinite(days)
      ? Math.min(SELFIE_LIMITS.maxDays, Math.max(SELFIE_LIMITS.minDays, days))
      : SELFIE_LIMITS.defaultDays,
  };
}

/** True when a photo taken at `takenAt` is past its retention at `now` (ms). */
export function selfieExpired(takenAt: number, settings: TheCodeSelfieSettings, now: number): boolean {
  return now - takenAt > settings.retentionDays * 24 * 60 * 60 * 1000;
}
