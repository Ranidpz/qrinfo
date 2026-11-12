/**
 * הקוד — per-player rate window, stored on the player doc (no extra reads). Pure.
 * Fixed window: `count` actions since `windowStart`.
 */

export interface TheCodeRateWindow {
  windowStart: number;
  count: number;
}

export const PLAYER_RATE_LIMIT = { max: 60, windowMs: 60_000 };

export type TheCodeRateResult =
  | { ok: true; rate: TheCodeRateWindow }
  | { ok: false; retryAfterSeconds: number };

export function takeRate(
  rate: TheCodeRateWindow | undefined | null,
  now: number,
  limit: { max: number; windowMs: number } = PLAYER_RATE_LIMIT
): TheCodeRateResult {
  const start = rate && Number.isFinite(rate.windowStart) ? rate.windowStart : 0;
  // A new window when the old one ended — or the stored start is in the future (clock skew).
  if (!rate || now - start >= limit.windowMs || start > now) {
    return { ok: true, rate: { windowStart: now, count: 1 } };
  }
  const count = Number(rate.count) || 0;
  if (count >= limit.max) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((start + limit.windowMs - now) / 1000)) };
  }
  return { ok: true, rate: { windowStart: start, count: count + 1 } };
}
