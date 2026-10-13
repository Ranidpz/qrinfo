// Q.Vote XP + packs — pure rules (no Firebase), shared by the vote route, the pack
// route, the viewer and the editor. Tests: scripts/tests/qvote-xp.test.mjs.
//
// The model: every NEW vote a voter casts earns `xpPerVote` (per candidate picked).
// Each time the voter's XP crosses another multiple of `xpForPackThreshold` they earn
// a pack; packs open into the producer's prizes (same Prize/rarity system as routes).
// A vote "slot" (round + category) pays XP once — changing a vote (reset-voter) and
// voting again in the same slot earns nothing, so a vote change can't farm packs.

export interface QVoteGamificationSettings {
  enabled: boolean;
  xpPerVote: number;
  xpForPackThreshold: number;
}

export const XP_PER_VOTE_LIMITS = { min: 1, max: 100, fallback: 10 } as const;
export const PACK_THRESHOLD_LIMITS = { min: 10, max: 1000, fallback: 50 } as const;

function clampInt(value: unknown, limits: { min: number; max: number; fallback: number }): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return limits.fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(n)));
}

/** Read `qvoteConfig.gamification` defensively — absent / junk means off with the defaults. */
export function resolveGamification(raw: unknown): QVoteGamificationSettings {
  const g = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    enabled: g.enabled === true,
    xpPerVote: clampInt(g.xpPerVote, XP_PER_VOTE_LIMITS),
    xpForPackThreshold: clampInt(g.xpForPackThreshold, PACK_THRESHOLD_LIMITS),
  };
}

/** One XP payout per round + category. */
export function voteSlotKey(round: unknown, categoryId?: unknown): string {
  const r = typeof round === 'number' && Number.isFinite(round) ? Math.round(round) : 1;
  const c = typeof categoryId === 'string' && categoryId ? categoryId : '_';
  return `r${r}:${c}`;
}

export function computeVoteAward(input: {
  xpPerVote: number;
  votesSubmitted: number;
  slotKey: string;
  awardedSlots: string[];
}): { earned: number; awardedSlots: string[] } {
  const { xpPerVote, votesSubmitted, slotKey, awardedSlots } = input;
  if (votesSubmitted <= 0 || awardedSlots.includes(slotKey)) {
    return { earned: 0, awardedSlots };
  }
  return { earned: xpPerVote * votesSubmitted, awardedSlots: [...awardedSlots, slotKey] };
}

export function packsEarned(xp: number, threshold: number): number {
  if (!(threshold > 0) || !(xp > 0)) return 0;
  return Math.floor(xp / threshold);
}

/** Never negative — raising the threshold mid-event can't take back opened packs. */
export function packsAvailable(xp: number, threshold: number, opened: number): number {
  return Math.max(0, packsEarned(xp, threshold) - Math.max(0, opened || 0));
}

/** Progress toward the NEXT pack, for the viewer's bar. */
export function packProgress(xp: number, threshold: number): { current: number; needed: number; percent: number } {
  if (!(threshold > 0)) return { current: 0, needed: 0, percent: 0 };
  const current = Math.max(0, xp) % threshold;
  return { current, needed: threshold, percent: Math.round((current / threshold) * 100) };
}

/** voterId becomes a Firestore doc id — keep it to the shape getOrCreateVisitorId produces. */
export function isValidVoterId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

// ---------- Prize input (owner editor → /api/qvote/prizes) ----------

export const PRIZE_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export type QVotePrizeRarity = (typeof PRIZE_RARITIES)[number];

export interface QVotePrizeInput {
  name: string;
  nameEn: string;
  rarity: QVotePrizeRarity;
  dropRate: number;
  totalAvailable: number;
  isActive: boolean;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim().slice(0, max) : '';
}

export function sanitizePrizeInput(raw: unknown): { ok: true; value: QVotePrizeInput } | { ok: false } {
  if (!raw || typeof raw !== 'object') return { ok: false };
  const r = raw as Record<string, unknown>;
  const name = cleanText(r.name, 60);
  if (!name) return { ok: false };
  const rarity = PRIZE_RARITIES.includes(r.rarity as QVotePrizeRarity) ? (r.rarity as QVotePrizeRarity) : null;
  if (!rarity) return { ok: false };
  const dropRate = Number(r.dropRate);
  const totalAvailable = Number(r.totalAvailable);
  if (!Number.isFinite(dropRate) || dropRate < 0 || dropRate > 100) return { ok: false };
  if (!Number.isInteger(totalAvailable) || totalAvailable < 0 || totalAvailable > 100000) return { ok: false };
  return {
    ok: true,
    value: {
      name,
      nameEn: cleanText(r.nameEn, 60),
      rarity,
      dropRate,
      totalAvailable,
      isActive: r.isActive !== false,
    },
  };
}
