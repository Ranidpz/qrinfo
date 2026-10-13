// Q.Vote XP + packs store — FIRESTORE, Admin SDK, server-side only.
//
//   codes/{codeId}/qvotePlayers/{voterId}  XP, paid vote slots, opened packs
//   codes/{codeId}/qvotePrizes/{prizeId}   the producer's prize pool (Prize shape)
//
// Both subcollections are fully locked in firestore.rules (read/write: false).
// Voters reach them through /api/qvote/vote (XP is awarded inside the vote
// transaction) and /api/qvote/xp + /api/qvote/pack/open; owners through
// /api/qvote/prizes. Pure rules live in ./logic.ts.

import { FieldValue, Timestamp, type Transaction, type DocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { drawablePrizes, pickWeightedPrize } from '@/lib/prizeDraw';
import {
  computeVoteAward,
  resolveGamification,
  packProgress,
  packsAvailable,
  type QVoteGamificationSettings,
  type QVotePrizeInput,
  type QVotePrizeRarity,
} from './logic';

export interface QVotePackOpeningRecord {
  id: string;
  prizeId: string;
  prizeName: string;
  prizeNameEn: string;
  prizeRarity: QVotePrizeRarity;
  openedAt: string | null; // ISO
}

export interface QVotePrizeRecord extends QVotePrizeInput {
  id: string;
  routeId: string; // = codeId, so the record is a drop-in Prize for the shared UI
  claimed: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface QVoteXpStatus {
  xp: number;
  packsAvailable: number;
  progress: { current: number; needed: number; percent: number };
  openings: QVotePackOpeningRecord[];
  prizesLeft: number;
}

function codeDoc(codeId: string) {
  return getAdminDb().collection('codes').doc(codeId);
}

export function playerRef(codeId: string, voterId: string) {
  return codeDoc(codeId).collection('qvotePlayers').doc(voterId);
}

function prizesCol(codeId: string) {
  return codeDoc(codeId).collection('qvotePrizes');
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function toOpenings(raw: unknown): QVotePackOpeningRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => ({
    id: String(o?.id || ''),
    prizeId: String(o?.prizeId || ''),
    prizeName: String(o?.prizeName || ''),
    prizeNameEn: String(o?.prizeNameEn || ''),
    prizeRarity: (o?.prizeRarity || 'common') as QVotePrizeRarity,
    openedAt: toIso(o?.openedAt),
  }));
}

function toPrize(codeId: string, id: string, data: FirebaseFirestore.DocumentData): QVotePrizeRecord {
  return {
    id,
    routeId: codeId,
    name: data.name || '',
    nameEn: data.nameEn || '',
    rarity: (data.rarity || 'common') as QVotePrizeRarity,
    dropRate: Number(data.dropRate) || 0,
    totalAvailable: Number(data.totalAvailable) || 0,
    claimed: Number(data.claimed) || 0,
    isActive: data.isActive !== false,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

// ---------- Voting ----------

/**
 * Called INSIDE the vote transaction, after every read (the player snapshot must be
 * read together with the vote docs) — writes the XP for the votes just created.
 * Returns what the viewer needs for its "+XP" popup.
 */
export function applyVoteXp(
  tx: Transaction,
  codeId: string,
  voterId: string,
  playerSnap: DocumentSnapshot,
  settings: QVoteGamificationSettings,
  slotKey: string,
  votesSubmitted: number
): { earned: number; xp: number; packsAvailable: number } {
  const data = playerSnap.exists ? playerSnap.data() || {} : {};
  const prevXp = Number(data.xp) || 0;
  const opened = Number(data.packsOpened) || 0;
  const awarded: string[] = Array.isArray(data.awardedSlots) ? data.awardedSlots : [];
  const award = computeVoteAward({ xpPerVote: settings.xpPerVote, votesSubmitted, slotKey, awardedSlots: awarded });
  const xp = prevXp + award.earned;
  if (award.earned > 0) {
    tx.set(
      playerRef(codeId, voterId),
      {
        voterId,
        xp,
        votes: FieldValue.increment(votesSubmitted),
        awardedSlots: award.awardedSlots,
        packsOpened: opened,
        updatedAt: FieldValue.serverTimestamp(),
        ...(playerSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), openings: [] }),
      },
      { merge: true }
    );
  }
  return { earned: award.earned, xp, packsAvailable: packsAvailable(xp, settings.xpForPackThreshold, opened) };
}

export async function countPrizesLeft(codeId: string): Promise<number> {
  const snap = await prizesCol(codeId).where('isActive', '==', true).get();
  const pool = drawablePrizes(snap.docs.map((d) => toPrize(codeId, d.id, d.data())));
  return pool.reduce((sum, p) => sum + (p.totalAvailable - p.claimed), 0);
}

export async function getXpStatus(
  codeId: string,
  voterId: string,
  settings: QVoteGamificationSettings
): Promise<QVoteXpStatus> {
  const [snap, prizesLeft] = await Promise.all([playerRef(codeId, voterId).get(), countPrizesLeft(codeId)]);
  const data = snap.exists ? snap.data() || {} : {};
  const xp = Number(data.xp) || 0;
  return {
    xp,
    packsAvailable: packsAvailable(xp, settings.xpForPackThreshold, Number(data.packsOpened) || 0),
    progress: packProgress(xp, settings.xpForPackThreshold),
    openings: toOpenings(data.openings),
    prizesLeft,
  };
}

export type OpenPackResult =
  | { ok: true; opening: QVotePackOpeningRecord; packsAvailable: number }
  | { ok: false; code: 'NO_PACKS' | 'NO_PRIZES' };

/** Opens one earned pack: the draw, the stock decrement and the pack count are one transaction. */
export async function openPack(
  codeId: string,
  voterId: string,
  settings: QVoteGamificationSettings
): Promise<OpenPackResult> {
  const db = getAdminDb();
  const ref = playerRef(codeId, voterId);
  return db.runTransaction(async (tx) => {
    // Reads first (Firestore transaction rule).
    const [snap, prizeSnap] = await Promise.all([
      tx.get(ref),
      tx.get(prizesCol(codeId).where('isActive', '==', true)),
    ]);
    const data = snap.exists ? snap.data() || {} : {};
    const xp = Number(data.xp) || 0;
    const opened = Number(data.packsOpened) || 0;
    const available = packsAvailable(xp, settings.xpForPackThreshold, opened);
    if (available <= 0) return { ok: false as const, code: 'NO_PACKS' as const };

    const pool = drawablePrizes(prizeSnap.docs.map((d) => toPrize(codeId, d.id, d.data())));
    const prize = pickWeightedPrize(pool);
    if (!prize) return { ok: false as const, code: 'NO_PRIZES' as const };

    const opening = {
      id: db.collection('_').doc().id,
      prizeId: prize.id,
      prizeName: prize.name,
      prizeNameEn: prize.nameEn || prize.name,
      prizeRarity: prize.rarity,
      openedAt: Timestamp.now(),
    };
    tx.update(prizesCol(codeId).doc(prize.id), {
      claimed: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(ref, {
      packsOpened: opened + 1,
      openings: FieldValue.arrayUnion(opening),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      ok: true as const,
      opening: { ...opening, openedAt: opening.openedAt.toDate().toISOString() },
      packsAvailable: available - 1,
    };
  });
}

// ---------- Owner ----------

export async function listPrizes(codeId: string): Promise<QVotePrizeRecord[]> {
  const snap = await prizesCol(codeId).get();
  return snap.docs
    .map((d) => toPrize(codeId, d.id, d.data()))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export async function createPrize(codeId: string, input: QVotePrizeInput): Promise<string> {
  const ref = prizesCol(codeId).doc();
  await ref.set({
    ...input,
    claimed: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/** Returns false when the prize doesn't exist under this code. */
export async function updatePrize(codeId: string, prizeId: string, input: QVotePrizeInput): Promise<boolean> {
  const ref = prizesCol(codeId).doc(prizeId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ ...input, updatedAt: FieldValue.serverTimestamp() });
  return true;
}

export async function deletePrize(codeId: string, prizeId: string): Promise<void> {
  await prizesCol(codeId).doc(prizeId).delete();
}

export interface QVoteWinnerRecord extends QVotePackOpeningRecord {
  voterCode: string; // the short code the voter's screen shows next to the prize
}

/** Short, human-checkable code shown on the voter's prize list and the owner's winners list. */
export function voterCodeOf(voterId: string): string {
  return voterId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
}

export async function listWinners(codeId: string): Promise<QVoteWinnerRecord[]> {
  const snap = await codeDoc(codeId).collection('qvotePlayers').where('packsOpened', '>', 0).get();
  const winners: QVoteWinnerRecord[] = [];
  snap.docs.forEach((d) => {
    const voterCode = voterCodeOf(d.id);
    toOpenings(d.data().openings).forEach((o) => winners.push({ ...o, voterCode }));
  });
  return winners.sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
}

/** Vote reset: XP and packs go with the votes; prize stock comes back for the live run. */
export async function resetXpData(codeId: string): Promise<void> {
  const db = getAdminDb();
  const players = await codeDoc(codeId).collection('qvotePlayers').get();
  for (let i = 0; i < players.docs.length; i += 450) {
    const batch = db.batch();
    players.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  const prizes = await prizesCol(codeId).get();
  if (!prizes.empty) {
    const batch = db.batch();
    prizes.docs.forEach((d) => batch.update(d.ref, { claimed: 0, updatedAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }
}

/** The code's live gamification settings (null = no such code / no Q.Vote on it). */
export async function loadGamificationSettings(codeId: string): Promise<QVoteGamificationSettings | null> {
  const snap = await codeDoc(codeId).get();
  if (!snap.exists) return null;
  const media = (snap.data()?.media || []) as Array<{ type?: string; qvoteConfig?: { gamification?: unknown } }>;
  const qvote = media.find((m) => m?.type === 'qvote');
  if (!qvote?.qvoteConfig) return null;
  return resolveGamification(qvote.qvoteConfig.gamification);
}
