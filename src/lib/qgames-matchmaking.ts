/**
 * Q.Games - Matchmaking logic
 * Uses RTDB transactions for atomic player pairing
 */

import { realtimeDb } from './firebase';
import {
  ref,
  runTransaction,
  onDisconnect,
} from 'firebase/database';
import {
  QGAMES_PATHS,
  QGamesQueueEntry,
  QGamesAvatarType,
  QGameType,
  RTDBMatch,
} from '@/types/qgames';
import {
  leaveQueue,
  createMatch,
  incrementMatchesInProgress,
  cleanupStaleQueue,
} from './qgames-realtime';

/** Generate a unique match ID */
function generateMatchId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface MatchmakingResult {
  type: 'matched' | 'waiting';
  matchId?: string;
}

/**
 * Build an RTDBMatch object from two queue entries
 */
function buildMatch(
  matchId: string,
  gameType: QGameType,
  player1: QGamesQueueEntry,
  player2: { id: string; nickname: string; avatarType: QGamesAvatarType; avatarValue: string }
): RTDBMatch {
  return {
    id: matchId,
    gameType,
    player1Id: player1.id,
    player1Nickname: player1.nickname,
    player1AvatarType: player1.avatarType,
    player1AvatarValue: player1.avatarValue,
    player2Id: player2.id,
    player2Nickname: player2.nickname,
    player2AvatarType: player2.avatarType,
    player2AvatarValue: player2.avatarValue,
    status: 'countdown',
    startedAt: Date.now(),
    finishedAt: null,
    lastUpdated: Date.now(),
  };
}

/**
 * Find an opponent in queue entries, preferring a specific opponent if specified.
 */
function findOpponent(
  entries: [string, QGamesQueueEntry][],
  visitorId: string,
  gameType: QGameType,
  preferredOpponentId?: string
): QGamesQueueEntry | null {
  // Prefer specific opponent (WhatsApp invite)
  if (preferredOpponentId) {
    const preferred = entries.find(
      ([, e]) => e.id === preferredOpponentId && e.gameType === gameType && e.status === 'waiting'
    );
    if (preferred) return preferred[1];
  }

  // Fallback: any waiting opponent
  const any = entries.find(
    ([, e]) => e.gameType === gameType && e.status === 'waiting' && e.id !== visitorId
  );
  return any ? any[1] : null;
}

/**
 * Join queue and attempt to find an opponent.
 * Uses RTDB transaction for atomic matching — prevents race conditions
 * where two players both read an empty queue and both enter as "waiting".
 *
 * @param preferredOpponentId - Optional: prioritize matching with this player (WhatsApp invite)
 * Returns 'matched' with matchId if opponent found, or 'waiting' if queued.
 */
export async function findOrWaitForOpponent(
  codeId: string,
  visitorId: string,
  nickname: string,
  avatarType: QGamesAvatarType,
  avatarValue: string,
  gameType: QGameType,
  preferredOpponentId?: string
): Promise<MatchmakingResult> {
  // Clean up stale entries first (5 min TTL)
  await cleanupStaleQueue(codeId);

  const queueRef = ref(realtimeDb, QGAMES_PATHS.queue(codeId));
  let matchedId: string | null = null;
  let opponentData: QGamesQueueEntry | null = null;

  const result = await runTransaction(queueRef, (currentQueue: Record<string, QGamesQueueEntry> | null) => {
    // Reset per retry (transaction callback may be called multiple times)
    matchedId = null;
    opponentData = null;

    if (!currentQueue) currentQueue = {};

    // Find a waiting opponent
    const entries = Object.entries(currentQueue) as [string, QGamesQueueEntry][];
    const opponent = findOpponent(entries, visitorId, gameType, preferredOpponentId);

    if (opponent) {
      // Match found — mark both as matched atomically
      matchedId = generateMatchId();
      opponentData = { ...opponent };
      currentQueue[opponent.id] = { ...opponent, status: 'matched', matchId: matchedId };
      currentQueue[visitorId] = {
        id: visitorId, nickname, avatarType, avatarValue, gameType,
        joinedAt: Date.now(), status: 'matched', matchId: matchedId,
      };
    } else {
      // No opponent — add self as waiting
      currentQueue[visitorId] = {
        id: visitorId, nickname, avatarType, avatarValue, gameType,
        joinedAt: Date.now(), status: 'waiting', matchId: null,
      };
    }

    return currentQueue;
  });

  // Set up auto-remove on disconnect
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  onDisconnect(entryRef).remove();

  if (result.committed && matchedId && opponentData) {
    // Create match object + update stats (after transaction succeeds)
    const match = buildMatch(matchedId, gameType, opponentData, { id: visitorId, nickname, avatarType, avatarValue });
    await createMatch(codeId, match);
    await incrementMatchesInProgress(codeId);
    return { type: 'matched', matchId: matchedId };
  }

  return { type: 'waiting' };
}

/**
 * Try to match with an opponent from the queue (used by queue watcher).
 * Unlike findOrWaitForOpponent, this does NOT add the player to the queue —
 * it assumes the player is already in the queue as "waiting".
 *
 * Uses RTDB transaction for atomic matching.
 */
export async function tryMatchFromQueue(
  codeId: string,
  visitorId: string,
  nickname: string,
  avatarType: QGamesAvatarType,
  avatarValue: string,
  gameType: QGameType,
  preferredOpponentId?: string
): Promise<MatchmakingResult> {
  const queueRef = ref(realtimeDb, QGAMES_PATHS.queue(codeId));
  let matchedId: string | null = null;
  let opponentData: QGamesQueueEntry | null = null;

  const result = await runTransaction(queueRef, (currentQueue: Record<string, QGamesQueueEntry> | null) => {
    matchedId = null;
    opponentData = null;
    if (!currentQueue) return currentQueue;

    // Only proceed if we are still in "waiting" state
    const myEntry = currentQueue[visitorId];
    if (!myEntry || myEntry.status !== 'waiting') return;

    const entries = Object.entries(currentQueue) as [string, QGamesQueueEntry][];
    const opponent = findOpponent(entries, visitorId, gameType, preferredOpponentId);

    if (!opponent) return; // Abort — no opponent available

    matchedId = generateMatchId();
    opponentData = { ...opponent };
    currentQueue[visitorId] = { ...myEntry, status: 'matched', matchId: matchedId };
    currentQueue[opponent.id] = { ...opponent, status: 'matched', matchId: matchedId };

    return currentQueue;
  });

  if (result.committed && matchedId && opponentData) {
    const match = buildMatch(matchedId, gameType, opponentData, { id: visitorId, nickname, avatarType, avatarValue });
    await createMatch(codeId, match);
    await incrementMatchesInProgress(codeId);
    return { type: 'matched', matchId: matchedId };
  }

  return { type: 'waiting' };
}

/**
 * Cancel matchmaking (leave queue)
 */
export async function cancelMatchmaking(
  codeId: string,
  visitorId: string
): Promise<void> {
  await leaveQueue(codeId, visitorId);
}
