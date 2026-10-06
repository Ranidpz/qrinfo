/**
 * Cliostro character videos — global defaults + per-event override resolution.
 *
 * There are two layers (product decision):
 *  1. Global defaults — the canonical Cliostro clips, uploaded ONCE to R2 under a
 *     shared folder. Filled in below once the 7 master clips are uploaded.
 *  2. Per-event override — a URL stored on the game's config (QTreasureConfig.cliostro
 *     / QHuntConfig.cliostro). When present, it wins over the global default.
 *
 * The effective video for a moment = event override (if non-empty) ?? global
 * default (if non-empty) ?? undefined (render no video).
 */

import type { QTreasureCliostroConfig } from '@/types/qtreasure';
import type { QHuntCliostroConfig } from '@/types/qhunt';

export type TreasureVideoScenario = 'welcome' | 'success' | 'fail';
export type HuntVideoScenario = 'welcome' | 'hint' | 'success' | 'fail';

/**
 * Global default Cliostro video URLs. Empty string = no global default yet
 * (per-event overrides still work). Populate these once the master clips are
 * uploaded to R2 (e.g. `{R2_PUBLIC_URL}/_global/cliostro/treasure-welcome.mp4`).
 */
export const CLIOSTRO_GLOBAL_DEFAULTS: {
  treasure: Record<TreasureVideoScenario, string>;
  hunt: Record<HuntVideoScenario, string>;
} = {
  treasure: {
    welcome: '',
    success: '',
    fail: '',
  },
  hunt: {
    welcome: '',
    hint: '',
    success: '',
    fail: '',
  },
};

function firstNonEmpty(...candidates: Array<string | undefined>): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return undefined;
}

/** Resolve the effective Q.Treasure Cliostro video for a moment (override ?? global). */
export function getTreasureCliostroVideo(
  scenario: TreasureVideoScenario,
  cliostro: QTreasureCliostroConfig | undefined
): string | undefined {
  if (cliostro && cliostro.enabled === false) return undefined;
  const overrideKey = `${scenario}Url` as const;
  const override = cliostro ? (cliostro[overrideKey] as string | undefined) : undefined;
  return firstNonEmpty(override, CLIOSTRO_GLOBAL_DEFAULTS.treasure[scenario]);
}

/** Resolve the effective Q.Hunt Cliostro video for a moment (override ?? global). */
export function getHuntCliostroVideo(
  scenario: HuntVideoScenario,
  cliostro: QHuntCliostroConfig | undefined
): string | undefined {
  if (cliostro && cliostro.enabled === false) return undefined;
  const overrideKey = `${scenario}Url` as const;
  const override = cliostro ? (cliostro[overrideKey] as string | undefined) : undefined;
  return firstNonEmpty(override, CLIOSTRO_GLOBAL_DEFAULTS.hunt[scenario]);
}
