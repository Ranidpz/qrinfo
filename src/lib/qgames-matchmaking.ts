/**
 * Q.Games - Matchmaking logic
 * Uses RTDB transactions for atomic player pairing
 */

import { realtimeDb } from './firebase';
import {
  ref,
  get,
  runTransaction,
} from 'firebase/database';
import {
  QGAMES_PATHS,
  QGamesQueueEntry,
  QGamesAvatarType,
  QGameType,
  RTDBMatch,
} from '@/types/qgames';
import {
  joinQueue,
  leaveQueue,
  markQueueMatched,
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
 * Join queue and attempt to find an opponent.
 * Uses RTDB transaction for atomic matching.
 *
 * Returns 'matched' with matchId if opponent found, or 'waiting' if queued.
 */
export async function findOrWaitForOpponent(
  codeId: string,
  visitorId: string,
  nickname: string,
  avatarType: QGamesAvatarType,
  avatarValue: string,
  gameType: QGameType
): Promise<MatchmakingResult> {
  // Clean up stale entries first
  await cleanupStaleQueue(codeId);

  const queueRef = ref(realtimeDb, QGAMES_PATHS.queue(codeId));
  const snapshot = await get(queueRef);

  // Find a waiting opponent for the same game type
  let opponent: QGamesQueueEntry | null = null;
  if (snapshot.exists()) {
    const entries = Object.values(snapshot.val()) as QGamesQueueEntry[];
    opponent = entries.find(
      e => e.gameType === gameType && e.status === 'waiting' && e.id !== visitorId
    ) || null;
  }

  if (opponent) {
    // Found an opponent - create match
    const matchId = generateMatchId();

    const match: RTDBMatch = {
      id: matchId,
      gameType,
      player1Id: opponent.id,
      player1Nickname: opponent.nickname,
      player1AvatarType: opponent.avatarType,
      player1AvatarValue: opponent.avatarValue,
      player2Id: visitorId,
      player2Nickname: nickname,
      player2AvatarType: avatarType,
      player2AvatarValue: avatarValue,
      status: 'countdown',
      startedAt: Date.now(),
      finishedAt: null,
      lastUpdated: Date.now(),
    };

    // Create the match
    await createMatch(codeId, match);

    // Mark both players as matched
    await markQueueMatched(codeId, opponent.id, matchId);
    await markQueueMatched(codeId, visitorId, matchId);

    // Update stats
    await incrementMatchesInProgress(codeId);

    return { type: 'matched', matchId };
  }

  // No opponent found - join queue and wait
  const entry: QGamesQueueEntry = {
    id: visitorId,
    nickname,
    avatarType,
    avatarValue,
    gameType,
    joinedAt: Date.now(),
    status: 'waiting',
    matchId: null,
  };

  await joinQueue(codeId, entry);

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
