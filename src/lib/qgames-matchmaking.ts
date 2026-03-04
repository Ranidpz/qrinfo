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
  is3PlayerGame,
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
 * Build an RTDBMatch object from three queue entries (3-player games)
 */
function buildMatch3(
  matchId: string,
  gameType: QGameType,
  player1: QGamesQueueEntry,
  player2: QGamesQueueEntry,
  player3: { id: string; nickname: string; avatarType: QGamesAvatarType; avatarValue: string }
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
    player3Id: player3.id,
    player3Nickname: player3.nickname,
    player3AvatarType: player3.avatarType,
    player3AvatarValue: player3.avatarValue,
    status: 'countdown',
    startedAt: Date.now(),
    finishedAt: null,
    lastUpdated: Date.now(),
  };
}

/**
 * Find 2 opponents for 3-player games
 */
function findOpponents3(
  entries: [string, QGamesQueueEntry][],
  visitorId: string,
  gameType: QGameType
): QGamesQueueEntry[] {
  return entries
    .filter(([, e]) => e.gameType === gameType && e.status === 'waiting' && e.id !== visitorId && !e.inBotMatch)
    .slice(0, 2)
    .map(([, e]) => e);
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
      ([, e]) => e.id === preferredOpponentId && e.gameType === gameType && e.status === 'waiting' && !e.inBotMatch
    );
    if (preferred) return preferred[1];
  }

  // Fallback: any waiting opponent (skip players in bot matches)
  const any = entries.find(
    ([, e]) => e.gameType === gameType && e.status === 'waiting' && e.id !== visitorId && !e.inBotMatch
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
  let opponentData2: QGamesQueueEntry | null = null; // For 3-player games

  const needs3Players = is3PlayerGame(gameType);

  const result = await runTransaction(queueRef, (currentQueue: Record<string, QGamesQueueEntry> | null) => {
    // Reset per retry (transaction callback may be called multiple times)
    matchedId = null;
    opponentData = null;
    opponentData2 = null;

    if (!currentQueue) currentQueue = {};

    const entries = Object.entries(currentQueue) as [string, QGamesQueueEntry][];

    if (needs3Players) {
      // 3-player matching: need 2 opponents
      const opponents = findOpponents3(entries, visitorId, gameType);
      if (opponents.length >= 2) {
        matchedId = generateMatchId();
        opponentData = { ...opponents[0] };
        opponentData2 = { ...opponents[1] };
        currentQueue[opponents[0].id] = { ...opponents[0], status: 'matched', matchId: matchedId };
        currentQueue[opponents[1].id] = { ...opponents[1], status: 'matched', matchId: matchedId };
        currentQueue[visitorId] = {
          id: visitorId, nickname, avatarType, avatarValue, gameType,
          joinedAt: Date.now(), status: 'matched', matchId: matchedId,
        };
      } else {
        // Not enough opponents — add self as waiting
        currentQueue[visitorId] = {
          id: visitorId, nickname, avatarType, avatarValue, gameType,
          joinedAt: Date.now(), status: 'waiting', matchId: null,
        };
      }
    } else {
      // 2-player matching (existing logic)
      const opponent = findOpponent(entries, visitorId, gameType, preferredOpponentId);

      if (opponent) {
        matchedId = generateMatchId();
        opponentData = { ...opponent };
        currentQueue[opponent.id] = { ...opponent, status: 'matched', matchId: matchedId };
        currentQueue[visitorId] = {
          id: visitorId, nickname, avatarType, avatarValue, gameType,
          joinedAt: Date.now(), status: 'matched', matchId: matchedId,
        };
      } else {
        currentQueue[visitorId] = {
          id: visitorId, nickname, avatarType, avatarValue, gameType,
          joinedAt: Date.now(), status: 'waiting', matchId: null,
        };
      }
    }

    return currentQueue;
  });

  // Set up auto-remove on disconnect
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  onDisconnect(entryRef).remove();

  if (result.committed && matchedId && opponentData) {
    if (needs3Players && opponentData2) {
      // Create 3-player match
      const match = buildMatch3(matchedId, gameType, opponentData, opponentData2,
        { id: visitorId, nickname, avatarType, avatarValue });
      await createMatch(codeId, match);
    } else {
      // Create 2-player match
      const match = buildMatch(matchedId, gameType, opponentData,
        { id: visitorId, nickname, avatarType, avatarValue });
      await createMatch(codeId, match);
    }
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
  let opponentData2: QGamesQueueEntry | null = null;

  const needs3Players = is3PlayerGame(gameType);

  const result = await runTransaction(queueRef, (currentQueue: Record<string, QGamesQueueEntry> | null) => {
    matchedId = null;
    opponentData = null;
    opponentData2 = null;
    if (!currentQueue) return currentQueue;

    // Only proceed if we are still in "waiting" state (and not in bot match)
    const myEntry = currentQueue[visitorId];
    if (!myEntry || myEntry.status !== 'waiting' || myEntry.inBotMatch) return;

    const entries = Object.entries(currentQueue) as [string, QGamesQueueEntry][];

    if (needs3Players) {
      const opponents = findOpponents3(entries, visitorId, gameType);
      if (opponents.length < 2) return; // Not enough opponents

      matchedId = generateMatchId();
      opponentData = { ...opponents[0] };
      opponentData2 = { ...opponents[1] };
      currentQueue[visitorId] = { ...myEntry, status: 'matched', matchId: matchedId };
      currentQueue[opponents[0].id] = { ...opponents[0], status: 'matched', matchId: matchedId };
      currentQueue[opponents[1].id] = { ...opponents[1], status: 'matched', matchId: matchedId };
    } else {
      const opponent = findOpponent(entries, visitorId, gameType, preferredOpponentId);
      if (!opponent) return;

      matchedId = generateMatchId();
      opponentData = { ...opponent };
      currentQueue[visitorId] = { ...myEntry, status: 'matched', matchId: matchedId };
      currentQueue[opponent.id] = { ...opponent, status: 'matched', matchId: matchedId };
    }

    return currentQueue;
  });

  if (result.committed && matchedId && opponentData) {
    if (needs3Players && opponentData2) {
      const match = buildMatch3(matchedId, gameType, opponentData, opponentData2,
        { id: visitorId, nickname, avatarType, avatarValue });
      await createMatch(codeId, match);
    } else {
      const match = buildMatch(matchedId, gameType, opponentData,
        { id: visitorId, nickname, avatarType, avatarValue });
      await createMatch(codeId, match);
    }
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
