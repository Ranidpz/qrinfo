/**
 * Q.Games - Firebase Realtime Database helpers
 * Handles matchmaking queue, live match state, leaderboard, and stats
 */

import { realtimeDb } from './firebase';
import {
  ref,
  set,
  update,
  get,
  onValue,
  off,
  remove,
  runTransaction,
  onDisconnect,
  DataSnapshot,
} from 'firebase/database';
import {
  QGAMES_PATHS,
  QGamesStats,
  QGamesLeaderboardEntry,
  QGamesQueueEntry,
  RTDBMatch,
  RTDBRPSState,
  RTDBRPSRound,
  RTDBTTTState,
  RTDBOOOState,
  RTDBOOORound,
  MatchStatus,
} from '@/types/qgames';

// ============ SESSION / STATS ============

/** Initialize stats node for a Q.Games code */
export async function initQGamesSession(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  const snapshot = await get(statsRef);
  if (snapshot.exists()) return; // Already initialized

  await set(statsRef, {
    totalPlayers: 0,
    playersOnline: 0,
    totalMatches: 0,
    matchesInProgress: 0,
    lastUpdated: Date.now(),
  } satisfies QGamesStats);
}

/** Reset all Q.Games data for a code */
export async function resetQGamesSession(codeId: string): Promise<void> {
  const rootRef = ref(realtimeDb, QGAMES_PATHS.root(codeId));
  await set(rootRef, {
    stats: {
      totalPlayers: 0,
      playersOnline: 0,
      totalMatches: 0,
      matchesInProgress: 0,
      lastUpdated: Date.now(),
    },
  });
}

/** Increment total players */
export async function incrementQGamesPlayers(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  await runTransaction(statsRef, (current: QGamesStats | null) => {
    if (!current) {
      return {
        totalPlayers: 1,
        playersOnline: 1,
        totalMatches: 0,
        matchesInProgress: 0,
        lastUpdated: Date.now(),
      };
    }
    return {
      ...current,
      totalPlayers: current.totalPlayers + 1,
      playersOnline: current.playersOnline + 1,
      lastUpdated: Date.now(),
    };
  });
}

/** Increment online count (called on queue join) */
export async function incrementOnline(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  await runTransaction(statsRef, (current: QGamesStats | null) => {
    if (!current) return current;
    return {
      ...current,
      playersOnline: current.playersOnline + 1,
      lastUpdated: Date.now(),
    };
  });
}

/** Decrement online count */
export async function decrementOnline(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  await runTransaction(statsRef, (current: QGamesStats | null) => {
    if (!current) return current;
    return {
      ...current,
      playersOnline: Math.max(0, current.playersOnline - 1),
      lastUpdated: Date.now(),
    };
  });
}

/** Increment matches in progress */
export async function incrementMatchesInProgress(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  await runTransaction(statsRef, (current: QGamesStats | null) => {
    if (!current) return current;
    return {
      ...current,
      totalMatches: current.totalMatches + 1,
      matchesInProgress: current.matchesInProgress + 1,
      lastUpdated: Date.now(),
    };
  });
}

/** Decrement matches in progress (match finished) */
export async function decrementMatchesInProgress(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  await runTransaction(statsRef, (current: QGamesStats | null) => {
    if (!current) return current;
    return {
      ...current,
      matchesInProgress: Math.max(0, current.matchesInProgress - 1),
      lastUpdated: Date.now(),
    };
  });
}

// ============ QUEUE ============

/** Join the matchmaking queue. Sets up onDisconnect cleanup. */
export async function joinQueue(
  codeId: string,
  entry: QGamesQueueEntry
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, entry.id));
  await set(entryRef, entry);

  // Auto-remove from queue if browser disconnects
  onDisconnect(entryRef).remove();
}

/** Update avatar on queue entry (while waiting) */
export async function updateQueueEntryAvatar(
  codeId: string,
  visitorId: string,
  avatarType: 'emoji' | 'selfie',
  avatarValue: string
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  await update(entryRef, { avatarType, avatarValue });
}

/** Update nickname on queue entry (while waiting) */
export async function updateQueueEntryNickname(
  codeId: string,
  visitorId: string,
  nickname: string
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  await update(entryRef, { nickname });
}

/** Leave the matchmaking queue */
export async function leaveQueue(codeId: string, visitorId: string): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  await remove(entryRef);
}

/** Get all waiting players in queue for a specific game type */
export async function getWaitingPlayers(
  codeId: string,
  gameType: string
): Promise<QGamesQueueEntry[]> {
  const queueRef = ref(realtimeDb, QGAMES_PATHS.queue(codeId));
  const snapshot = await get(queueRef);
  if (!snapshot.exists()) return [];

  const entries = Object.values(snapshot.val()) as QGamesQueueEntry[];
  return entries.filter(e => e.gameType === gameType && e.status === 'waiting');
}

/** Update queue entry with matchId (player matched) */
export async function markQueueMatched(
  codeId: string,
  visitorId: string,
  matchId: string
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  await update(entryRef, { status: 'matched', matchId });
}

// ============ MATCH STATE ============

/** Create a new match in RTDB */
export async function createMatch(
  codeId: string,
  match: RTDBMatch
): Promise<void> {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, match.id));
  await set(matchRef, match);
}

/** Update match status */
export async function updateMatchStatus(
  codeId: string,
  matchId: string,
  status: MatchStatus,
  extra?: Record<string, unknown>
): Promise<void> {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, matchId));
  await update(matchRef, { status, lastUpdated: Date.now(), ...extra });
}

/** Get match data */
export async function getMatch(codeId: string, matchId: string): Promise<RTDBMatch | null> {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, matchId));
  const snapshot = await get(matchRef);
  return snapshot.exists() ? (snapshot.val() as RTDBMatch) : null;
}

// ============ RPS MATCH STATE ============

/** Initialize RPS game state */
export async function initRPSState(
  codeId: string,
  matchId: string,
  firstTo: number,
  firstRoundTimer: number
): Promise<void> {
  const rpsRef = ref(realtimeDb, QGAMES_PATHS.rpsState(codeId, matchId));
  const now = Date.now();
  await set(rpsRef, {
    currentRound: 0,
    player1Score: 0,
    player2Score: 0,
    firstTo,
    rounds: {
      '0': {
        player1Choice: null,
        player2Choice: null,
        winner: null,
        timerStartedAt: now,
        timerDuration: firstRoundTimer,
        revealed: false,
      } satisfies RTDBRPSRound,
    },
  } satisfies RTDBRPSState);
}

/** Get RPS state */
export async function getRPSState(
  codeId: string,
  matchId: string
): Promise<RTDBRPSState | null> {
  const rpsRef = ref(realtimeDb, QGAMES_PATHS.rpsState(codeId, matchId));
  const snapshot = await get(rpsRef);
  return snapshot.exists() ? (snapshot.val() as RTDBRPSState) : null;
}

/** Update RPS round (write player choice, hidden from opponent via API) */
export async function updateRPSRound(
  codeId: string,
  matchId: string,
  round: number,
  updates: Partial<RTDBRPSRound>
): Promise<void> {
  const roundRef = ref(realtimeDb, QGAMES_PATHS.rpsRound(codeId, matchId, round));
  await update(roundRef, updates);
}

/** Set RPS scores */
export async function updateRPSScores(
  codeId: string,
  matchId: string,
  player1Score: number,
  player2Score: number,
  currentRound: number
): Promise<void> {
  const rpsRef = ref(realtimeDb, QGAMES_PATHS.rpsState(codeId, matchId));
  await update(rpsRef, { player1Score, player2Score, currentRound });
}

/** Start a new RPS round */
export async function startNewRPSRound(
  codeId: string,
  matchId: string,
  roundNum: number,
  timerDuration: number
): Promise<void> {
  const roundRef = ref(realtimeDb, QGAMES_PATHS.rpsRound(codeId, matchId, roundNum));
  await set(roundRef, {
    player1Choice: null,
    player2Choice: null,
    winner: null,
    timerStartedAt: Date.now(),
    timerDuration,
    revealed: false,
  } satisfies RTDBRPSRound);

  // Update current round counter
  const rpsRef = ref(realtimeDb, QGAMES_PATHS.rpsState(codeId, matchId));
  await update(rpsRef, { currentRound: roundNum });
}

// ============ TTT MATCH STATE ============

/** Initialize TTT game state */
export async function initTTTState(
  codeId: string,
  matchId: string,
  xPlayerId: string,
  oPlayerId: string
): Promise<void> {
  const tttRef = ref(realtimeDb, QGAMES_PATHS.tttState(codeId, matchId));
  await set(tttRef, {
    board: '_________', // 9 empty cells
    currentTurn: xPlayerId,
    xPlayerId,
    oPlayerId,
    winner: null,
    isDraw: false,
    moveCount: 0,
  } satisfies RTDBTTTState);
}

/** Get TTT state */
export async function getTTTState(
  codeId: string,
  matchId: string
): Promise<RTDBTTTState | null> {
  const tttRef = ref(realtimeDb, QGAMES_PATHS.tttState(codeId, matchId));
  const snapshot = await get(tttRef);
  return snapshot.exists() ? (snapshot.val() as RTDBTTTState) : null;
}

/** Update TTT state */
export async function updateTTTState(
  codeId: string,
  matchId: string,
  updates: Partial<RTDBTTTState>
): Promise<void> {
  const tttRef = ref(realtimeDb, QGAMES_PATHS.tttState(codeId, matchId));
  await update(tttRef, updates);
}

// ============ OOO MATCH STATE (Odd One Out) ============

/** Initialize OOO game state */
export async function initOOOState(
  codeId: string,
  matchId: string,
  maxStrikes: number,
  firstRoundTimer: number
): Promise<void> {
  const oooRef = ref(realtimeDb, QGAMES_PATHS.oooState(codeId, matchId));
  const now = Date.now();
  await set(oooRef, {
    currentRound: 0,
    player1Strikes: 0,
    player2Strikes: 0,
    player3Strikes: 0,
    maxStrikes,
    rounds: {
      '0': {
        player1Choice: null,
        player2Choice: null,
        player3Choice: null,
        loser: null,
        timerStartedAt: now,
        timerDuration: firstRoundTimer,
        revealed: false,
      } satisfies RTDBOOORound,
    },
  } satisfies RTDBOOOState);
}

/** Get OOO state */
export async function getOOOState(
  codeId: string,
  matchId: string
): Promise<RTDBOOOState | null> {
  const oooRef = ref(realtimeDb, QGAMES_PATHS.oooState(codeId, matchId));
  const snapshot = await get(oooRef);
  return snapshot.exists() ? (snapshot.val() as RTDBOOOState) : null;
}

/** Start a new OOO round */
export async function startNewOOORound(
  codeId: string,
  matchId: string,
  roundNum: number,
  timerDuration: number
): Promise<void> {
  const roundRef = ref(realtimeDb, QGAMES_PATHS.oooRound(codeId, matchId, roundNum));
  await set(roundRef, {
    player1Choice: null,
    player2Choice: null,
    player3Choice: null,
    loser: null,
    timerStartedAt: Date.now(),
    timerDuration,
    revealed: false,
  } satisfies RTDBOOORound);

  // Update current round counter
  const oooRef = ref(realtimeDb, QGAMES_PATHS.oooState(codeId, matchId));
  await update(oooRef, { currentRound: roundNum });
}

// ============ LEADERBOARD ============

/** Update a single leaderboard entry */
export async function updateLeaderboardEntry(
  codeId: string,
  entry: QGamesLeaderboardEntry
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.leaderboardEntry(codeId, entry.id));
  await set(entryRef, entry);
}

/** Recalculate ranks for all leaderboard entries */
export async function recalculateLeaderboardRanks(codeId: string): Promise<void> {
  const lbRef = ref(realtimeDb, QGAMES_PATHS.leaderboard(codeId));
  const snapshot = await get(lbRef);
  if (!snapshot.exists()) return;

  const entries = Object.values(snapshot.val()) as QGamesLeaderboardEntry[];

  // Sort: score desc → wins desc → gamesPlayed asc
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.gamesPlayed - b.gamesPlayed;
  });

  const updates: Record<string, QGamesLeaderboardEntry> = {};
  entries.forEach((entry, index) => {
    updates[entry.id] = { ...entry, rank: index + 1 };
  });

  await set(lbRef, updates);
}

/** Remove a player from leaderboard */
export async function removeFromLeaderboard(
  codeId: string,
  visitorId: string
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.leaderboardEntry(codeId, visitorId));
  await remove(entryRef);
}

// ============ CLEANUP ============

/** Remove stale queue entries (older than maxAge ms) */
export async function cleanupStaleQueue(
  codeId: string,
  maxAgeMs: number = 300000
): Promise<void> {
  const queueRef = ref(realtimeDb, QGAMES_PATHS.queue(codeId));
  const snapshot = await get(queueRef);
  if (!snapshot.exists()) return;

  const now = Date.now();
  const entries = snapshot.val() as Record<string, QGamesQueueEntry>;

  for (const [key, entry] of Object.entries(entries)) {
    if (entry.status === 'waiting' && (now - entry.joinedAt) > maxAgeMs) {
      const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, key));
      await remove(entryRef);
    }
  }
}

/** Clean up finished match from RTDB (after persisting to Firestore) */
export async function cleanupMatch(codeId: string, matchId: string): Promise<void> {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, matchId));
  await remove(matchRef);
}

// ============ SUBSCRIPTIONS ============

/** Subscribe to queue entry (for matchmaking updates) */
export function subscribeToQueueEntry(
  codeId: string,
  visitorId: string,
  onUpdate: (entry: QGamesQueueEntry | null) => void
): () => void {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as QGamesQueueEntry) : null);
  };
  onValue(entryRef, callback);
  return () => off(entryRef, 'value', callback);
}

/** Subscribe to match state */
export function subscribeToMatch(
  codeId: string,
  matchId: string,
  onUpdate: (match: RTDBMatch | null) => void
): () => void {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, matchId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as RTDBMatch) : null);
  };
  onValue(matchRef, callback);
  return () => off(matchRef, 'value', callback);
}

/** Subscribe to RPS state */
export function subscribeToRPSState(
  codeId: string,
  matchId: string,
  onUpdate: (state: RTDBRPSState | null) => void
): () => void {
  const rpsRef = ref(realtimeDb, QGAMES_PATHS.rpsState(codeId, matchId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as RTDBRPSState) : null);
  };
  onValue(rpsRef, callback);
  return () => off(rpsRef, 'value', callback);
}

/** Subscribe to TTT state */
export function subscribeToTTTState(
  codeId: string,
  matchId: string,
  onUpdate: (state: RTDBTTTState | null) => void
): () => void {
  const tttRef = ref(realtimeDb, QGAMES_PATHS.tttState(codeId, matchId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as RTDBTTTState) : null);
  };
  onValue(tttRef, callback);
  return () => off(tttRef, 'value', callback);
}

/** Subscribe to OOO state */
export function subscribeToOOOState(
  codeId: string,
  matchId: string,
  onUpdate: (state: RTDBOOOState | null) => void
): () => void {
  const oooRef = ref(realtimeDb, QGAMES_PATHS.oooState(codeId, matchId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as RTDBOOOState) : null);
  };
  onValue(oooRef, callback);
  return () => off(oooRef, 'value', callback);
}

/** Subscribe to leaderboard */
export function subscribeToQGamesLeaderboard(
  codeId: string,
  onUpdate: (entries: QGamesLeaderboardEntry[]) => void
): () => void {
  const lbRef = ref(realtimeDb, QGAMES_PATHS.leaderboard(codeId));
  const callback = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const data = snapshot.val() as Record<string, QGamesLeaderboardEntry>;
    const entries = Object.values(data).sort((a, b) => a.rank - b.rank);
    onUpdate(entries);
  };
  onValue(lbRef, callback);
  return () => off(lbRef, 'value', callback);
}

/** Subscribe to stats */
export function subscribeToQGamesStats(
  codeId: string,
  onUpdate: (stats: QGamesStats | null) => void
): () => void {
  const statsRef = ref(realtimeDb, QGAMES_PATHS.stats(codeId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as QGamesStats) : null);
  };
  onValue(statsRef, callback);
  return () => off(statsRef, 'value', callback);
}

/** Subscribe to queue (all entries, for display screen) */
export function subscribeToQueue(
  codeId: string,
  onUpdate: (entries: QGamesQueueEntry[]) => void
): () => void {
  const queueRef = ref(realtimeDb, QGAMES_PATHS.queue(codeId));
  const callback = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const data = snapshot.val() as Record<string, QGamesQueueEntry>;
    onUpdate(Object.values(data));
  };
  onValue(queueRef, callback);
  return () => off(queueRef, 'value', callback);
}

/** Mark a queue entry as in/out of bot match (invisible to matchmaking while true) */
export async function markQueueEntryBotMatch(
  codeId: string,
  visitorId: string,
  inBotMatch: boolean
): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  await update(entryRef, { inBotMatch });
}

// ============ MATCH PRESENCE ============

/**
 * Set up match presence for a player.
 * Writes a heartbeat and registers onDisconnect to remove it.
 * Returns a cleanup function.
 */
export async function setupMatchPresence(
  codeId: string,
  matchId: string,
  playerId: string
): Promise<() => void> {
  const presenceRef = ref(realtimeDb, QGAMES_PATHS.playerPresence(codeId, matchId, playerId));

  await set(presenceRef, { lastSeen: Date.now(), connected: true });
  const disconnectRef = onDisconnect(presenceRef);
  disconnectRef.remove();

  // Heartbeat every 5 seconds
  const heartbeatInterval = setInterval(async () => {
    try {
      await update(presenceRef, { lastSeen: Date.now() });
    } catch {
      // Connection lost — onDisconnect handles cleanup
    }
  }, 5000);

  return () => {
    clearInterval(heartbeatInterval);
    disconnectRef.cancel();
    remove(presenceRef);
  };
}

/** Subscribe to match presence (all players) */
export function subscribeToMatchPresence(
  codeId: string,
  matchId: string,
  onUpdate: (presence: Record<string, { lastSeen: number; connected: boolean }> | null) => void
): () => void {
  const presenceRef = ref(realtimeDb, QGAMES_PATHS.presence(codeId, matchId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? snapshot.val() : null);
  };
  onValue(presenceRef, callback);
  return () => off(presenceRef, 'value', callback);
}
