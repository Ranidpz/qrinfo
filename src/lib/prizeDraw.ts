// Weighted prize draw shared by every pack system (route packs in lottery.ts,
// Q.Vote packs in qvoteXp/store.ts). Pure — no Firebase — so it runs on both
// the client and the server and is covered by scripts/tests/qvote-xp.test.mjs.

export interface DrawablePrize {
  id: string;
  dropRate: number;
  totalAvailable: number;
  claimed: number;
  isActive: boolean;
}

/** Prizes that can still come out of a pack: active and with stock left. */
export function drawablePrizes<T extends DrawablePrize>(prizes: T[]): T[] {
  return prizes.filter((p) => p.isActive && (p.claimed || 0) < (p.totalAvailable || 0));
}

/**
 * Pick one prize by drop rate (weights don't have to sum to 100).
 * When every weight is 0 the first prize wins — an earned pack never comes out empty
 * while stock remains. Returns null only for an empty list.
 */
export function pickWeightedPrize<T extends Pick<DrawablePrize, 'dropRate'>>(
  prizes: T[],
  random: () => number = Math.random
): T | null {
  if (prizes.length === 0) return null;
  const weights = prizes.map((p) => (Number.isFinite(p.dropRate) && p.dropRate > 0 ? p.dropRate : 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return prizes[0];
  let roll = random() * total;
  for (let i = 0; i < prizes.length; i++) {
    roll -= weights[i];
    if (roll < 0) return prizes[i];
  }
  // Float edge (random() returned ~1): last prize with a weight.
  for (let i = prizes.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return prizes[i];
  }
  return prizes[0];
}
