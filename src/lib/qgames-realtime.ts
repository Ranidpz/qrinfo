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
  push,
  onValue,
  off,
  remove,
  runTransaction,
  onDisconnect,
  query,
  orderByChild,
  limitToLast,
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
  RTDBC4State,
  RTDBMemoryState,
  RTDBMemoryPlayer,
  MemoryPhase,
  MatchStatus,
  QGamesAvatarType,
  LiveMatchInfo,
  ViewerPresenceData,
  QGamesChatMessage,
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
  oPlayerId: string,
  firstTo: number,
  turnTimer: number
): Promise<void> {
  const tttRef = ref(realtimeDb, QGAMES_PATHS.tttState(codeId, matchId));
  const now = Date.now();
  await set(tttRef, {
    board: '_________',
    currentTurn: xPlayerId,
    xPlayerId,
    oPlayerId,
    winner: null,
    isDraw: false,
    moveCount: 0,
    currentRound: 0,
    player1Score: 0,
    player2Score: 0,
    firstTo,
    timerStartedAt: now,
    timerDuration: turnTimer,
    winLine: null,
    roundFinished: false,
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

/** Start a new TTT round (reset board, alternate X/O) */
export async function startNewTTTRound(
  codeId: string,
  matchId: string,
  roundNum: number,
  player1Id: string,
  player2Id: string,
  player1Score: number,
  player2Score: number,
  turnTimer: number,
  firstTo: number
): Promise<void> {
  const tttRef = ref(realtimeDb, QGAMES_PATHS.tttState(codeId, matchId));
  const now = Date.now();
  // Alternate who plays X each round
  const xPlayer = roundNum % 2 === 0 ? player1Id : player2Id;
  const oPlayer = roundNum % 2 === 0 ? player2Id : player1Id;
  await set(tttRef, {
    board: '_________',
    currentTurn: xPlayer,
    xPlayerId: xPlayer,
    oPlayerId: oPlayer,
    winner: null,
    isDraw: false,
    moveCount: 0,
    currentRound: roundNum,
    player1Score,
    player2Score,
    firstTo,
    timerStartedAt: now,
    timerDuration: turnTimer,
    winLine: null,
    roundFinished: false,
  } satisfies RTDBTTTState);
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

// ============ C4 MATCH STATE (Connect 4) ============

/** Initialize Connect 4 game state */
export async function initC4State(
  codeId: string,
  matchId: string,
  redPlayerId: string,
  whitePlayerId: string,
  firstTo: number,
  turnTimer: number
): Promise<void> {
  const c4Ref = ref(realtimeDb, QGAMES_PATHS.c4State(codeId, matchId));
  const now = Date.now();
  await set(c4Ref, {
    board: '_'.repeat(42),
    currentTurn: redPlayerId,
    redPlayerId,
    whitePlayerId,
    winner: null,
    isDraw: false,
    moveCount: 0,
    lastCol: -1,
    currentRound: 0,
    player1Score: 0,
    player2Score: 0,
    firstTo,
    timerStartedAt: now,
    timerDuration: turnTimer,
    winLine: null,
    roundFinished: false,
  } satisfies RTDBC4State);
}

/** Get Connect 4 state (single read) */
export async function getC4State(
  codeId: string,
  matchId: string
): Promise<RTDBC4State | null> {
  const c4Ref = ref(realtimeDb, QGAMES_PATHS.c4State(codeId, matchId));
  const snapshot = await get(c4Ref);
  return snapshot.exists() ? (snapshot.val() as RTDBC4State) : null;
}

/** Start a new Connect 4 round (reset board, alternate RED/WHITE) */
export async function startNewC4Round(
  codeId: string,
  matchId: string,
  roundNum: number,
  player1Id: string,
  player2Id: string,
  player1Score: number,
  player2Score: number,
  turnTimer: number,
  firstTo: number
): Promise<void> {
  const c4Ref = ref(realtimeDb, QGAMES_PATHS.c4State(codeId, matchId));
  const now = Date.now();
  // Alternate who plays RED each round
  const redPlayer = roundNum % 2 === 0 ? player1Id : player2Id;
  const whitePlayer = roundNum % 2 === 0 ? player2Id : player1Id;
  await set(c4Ref, {
    board: '_'.repeat(42),
    currentTurn: redPlayer,
    redPlayerId: redPlayer,
    whitePlayerId: whitePlayer,
    winner: null,
    isDraw: false,
    moveCount: 0,
    lastCol: -1,
    currentRound: roundNum,
    player1Score,
    player2Score,
    firstTo,
    timerStartedAt: now,
    timerDuration: turnTimer,
    winLine: null,
    roundFinished: false,
  } satisfies RTDBC4State);
}

/** Subscribe to Connect 4 state */
export function subscribeToC4State(
  codeId: string,
  matchId: string,
  onUpdate: (state: RTDBC4State | null) => void
): () => void {
  const c4Ref = ref(realtimeDb, QGAMES_PATHS.c4State(codeId, matchId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as RTDBC4State) : null);
  };
  onValue(c4Ref, callback);
  return () => off(c4Ref, 'value', callback);
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

  // Update current round counter (must be separate from round data write)
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

/** Clean up stale matches: status='playing' but no presence nodes and older than maxAge */
export async function cleanupStaleMatches(
  codeId: string,
  maxAgeMs: number = 300000 // 5 minutes
): Promise<number> {
  const matchesRef = ref(realtimeDb, QGAMES_PATHS.matches(codeId));
  const snapshot = await get(matchesRef);
  if (!snapshot.exists()) return 0;

  let cleaned = 0;
  const now = Date.now();
  const promises: Promise<void>[] = [];

  snapshot.forEach((child) => {
    const match = child.val();
    const presenceCount = match?.presence ? Object.keys(match.presence).length : 0;
    const age = now - (match?.lastUpdated || match?.createdAt || 0);
    // Remove stale matches:
    // 1. No connected players and old enough
    // 2. Finished matches old enough (presence may linger if onDisconnect didn't fire)
    const isStale = (presenceCount === 0 && age > maxAgeMs) ||
                    (match?.status === 'finished' && age > maxAgeMs);
    if (isStale) {
      promises.push(remove(ref(realtimeDb, QGAMES_PATHS.match(codeId, child.key!))));
      cleaned++;
    }
  });

  await Promise.all(promises);
  return cleaned;
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

// ============ VIEWER PRESENCE (accurate connected count) ============

/**
 * Register viewer presence. Auto-removed on disconnect via onDisconnect().
 * Returns cleanup function.
 */
export async function setupViewerPresence(
  codeId: string,
  visitorId: string,
  playerInfo?: { nickname: string; avatarType: QGamesAvatarType; avatarValue: string }
): Promise<() => void> {
  const viewerRef = ref(realtimeDb, QGAMES_PATHS.viewer(codeId, visitorId));
  const data: ViewerPresenceData = {
    joinedAt: Date.now(),
    nickname: playerInfo?.nickname || '',
    avatarType: playerInfo?.avatarType || 'emoji',
    avatarValue: playerInfo?.avatarValue || '👤',
  };
  await set(viewerRef, data);
  const disconnectRef = onDisconnect(viewerRef);
  disconnectRef.remove();

  return () => {
    disconnectRef.cancel();
    remove(viewerRef);
  };
}

/** Update viewer presence with player info (e.g., after registration or avatar change) */
export async function updateViewerPresenceInfo(
  codeId: string,
  visitorId: string,
  playerInfo: { nickname: string; avatarType: QGamesAvatarType; avatarValue: string }
): Promise<void> {
  const viewerRef = ref(realtimeDb, QGAMES_PATHS.viewer(codeId, visitorId));
  await update(viewerRef, {
    nickname: playerInfo.nickname,
    avatarType: playerInfo.avatarType,
    avatarValue: playerInfo.avatarValue,
  });
}

/** Subscribe to viewer count (number of connected viewers) */
export function subscribeToViewerCount(
  codeId: string,
  onUpdate: (count: number) => void
): () => void {
  const viewersRef = ref(realtimeDb, QGAMES_PATHS.viewers(codeId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? snapshot.size : 0);
  };
  onValue(viewersRef, callback);
  return () => off(viewersRef, 'value', callback);
}

/** Subscribe to recent viewers (last 30, ordered by joinedAt) for the online modal */
export function subscribeToRecentViewers(
  codeId: string,
  onUpdate: (viewers: Array<ViewerPresenceData & { visitorId: string }>) => void
): () => void {
  const viewersQuery = query(
    ref(realtimeDb, QGAMES_PATHS.viewers(codeId)),
    orderByChild('joinedAt'),
    limitToLast(30)
  );
  const callback = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const viewers: Array<ViewerPresenceData & { visitorId: string }> = [];
    snapshot.forEach((child) => {
      const data = child.val() as ViewerPresenceData;
      viewers.push({ ...data, visitorId: child.key! });
    });
    // Reverse so newest first
    viewers.reverse();
    onUpdate(viewers);
  };
  onValue(viewersQuery, callback);
  return () => off(viewersQuery, 'value', callback);
}

// ============ MEMORY ROOMS ============

/** Create a new memory room (host creates lobby) */
export async function createMemoryRoom(
  codeId: string,
  roomId: string,
  hostId: string,
  hostNickname: string,
  hostAvatarType: QGamesAvatarType,
  hostAvatarValue: string,
  maxStrikes: number,
  memorizeDuration: number,
  recallDuration: number
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  const now = Date.now();
  const state: RTDBMemoryState = {
    hostId,
    status: 'lobby',
    maxStrikes,
    maxPlayers: 6,
    createdAt: now,
    currentRound: -1,
    difficulty: 3,
    targetEmojis: [],
    options: [],
    phase: 'countdown',
    phaseStartedAt: now,
    countdownDuration: 3000,
    memorizeDuration: memorizeDuration * 1000,
    recallDuration: recallDuration * 1000,
    players: {
      [hostId]: {
        nickname: hostNickname,
        avatarType: hostAvatarType,
        avatarValue: hostAvatarValue,
        score: 0,
        strikes: 0,
        eliminated: false,
        joinedAt: now,
        roundResult: null,
      },
    },
  };
  await set(roomRef, state);

  // Auto-cleanup room on host disconnect (only during lobby)
  const hostPlayerRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayer(codeId, roomId, hostId));
  onDisconnect(hostPlayerRef).remove();
}

/** Join an existing memory room */
export async function joinMemoryRoom(
  codeId: string,
  roomId: string,
  playerId: string,
  nickname: string,
  avatarType: QGamesAvatarType,
  avatarValue: string
): Promise<boolean> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));

  let success = false;
  await runTransaction(roomRef, (current: RTDBMemoryState | null) => {
    if (!current) return current;
    if (current.status !== 'lobby') return; // Can't join active game
    const playerCount = current.players ? Object.keys(current.players).length : 0;
    if (playerCount >= current.maxPlayers) return; // Room full
    if (current.players?.[playerId]) return; // Already in room

    current.players = current.players || {};
    current.players[playerId] = {
      nickname,
      avatarType,
      avatarValue,
      score: 0,
      strikes: 0,
      eliminated: false,
      joinedAt: Date.now(),
      roundResult: null,
    };
    success = true;
    return current;
  });

  if (success) {
    // Auto-remove from room on disconnect
    const playerRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayer(codeId, roomId, playerId));
    onDisconnect(playerRef).remove();
  }

  return success;
}

/** Leave a memory room */
export async function leaveMemoryRoom(
  codeId: string,
  roomId: string,
  playerId: string
): Promise<void> {
  const playerRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayer(codeId, roomId, playerId));
  await remove(playerRef);
}

/** Find an active memory room lobby to join */
export async function findActiveMemoryRoom(codeId: string): Promise<string | null> {
  const roomsRef = ref(realtimeDb, QGAMES_PATHS.memoryRooms(codeId));
  const snapshot = await get(roomsRef);
  if (!snapshot.exists()) return null;

  const rooms = snapshot.val() as Record<string, RTDBMemoryState>;
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.status === 'lobby') {
      const playerCount = room.players ? Object.keys(room.players).length : 0;
      if (playerCount < room.maxPlayers) {
        return roomId;
      }
    }
  }
  return null;
}

/** Host starts a new memory round — writes round data to RTDB */
export async function startMemoryRound(
  codeId: string,
  roomId: string,
  round: number,
  difficulty: number,
  targetEmojis: string[],
  options: string[]
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  await update(roomRef, {
    currentRound: round,
    difficulty,
    targetEmojis,
    options,
    phase: 'countdown',
    phaseStartedAt: Date.now(),
    status: 'playing',
  });

  // Clear all players' roundResult for new round
  const playersRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayers(codeId, roomId));
  const snapshot = await get(playersRef);
  if (snapshot.exists()) {
    const updates: Record<string, null> = {};
    Object.keys(snapshot.val()).forEach(pid => {
      updates[`${pid}/roundResult`] = null;
    });
    await update(playersRef, updates);
  }
}

/** Advance memory game phase (host calls this after timer-based transitions) */
export async function setMemoryPhase(
  codeId: string,
  roomId: string,
  phase: MemoryPhase
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  await update(roomRef, { phase, phaseStartedAt: Date.now() });
}

/** Player submits their round result */
export async function submitMemoryRoundResult(
  codeId: string,
  roomId: string,
  playerId: string,
  result: { selections: string[]; correctCount: number; failed: boolean }
): Promise<void> {
  const playerRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayer(codeId, roomId, playerId));
  await update(playerRef, {
    roundResult: { ...result, submittedAt: Date.now() },
  });
}

/** Update memory player score/strikes (called after round results) */
export async function updateMemoryPlayerStats(
  codeId: string,
  roomId: string,
  playerId: string,
  score: number,
  strikes: number,
  eliminated: boolean
): Promise<void> {
  const playerRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayer(codeId, roomId, playerId));
  await update(playerRef, { score, strikes, eliminated });
}

/** Mark memory room as finished */
export async function finishMemoryRoom(
  codeId: string,
  roomId: string
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  await update(roomRef, { status: 'finished', phase: 'results', phaseStartedAt: Date.now() });
}

/** Get memory room state (one-time read) */
export async function getMemoryRoom(
  codeId: string,
  roomId: string
): Promise<RTDBMemoryState | null> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  const snapshot = await get(roomRef);
  return snapshot.exists() ? (snapshot.val() as RTDBMemoryState) : null;
}

/** Subscribe to memory room state */
export function subscribeToMemoryRoom(
  codeId: string,
  roomId: string,
  onUpdate: (state: RTDBMemoryState | null) => void
): () => void {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as RTDBMemoryState) : null);
  };
  onValue(roomRef, callback);
  return () => off(roomRef, 'value', callback);
}

/** Subscribe to memory room players (for lobby and game) */
export function subscribeToMemoryPlayers(
  codeId: string,
  roomId: string,
  onUpdate: (players: Record<string, RTDBMemoryPlayer>) => void
): () => void {
  const playersRef = ref(realtimeDb, QGAMES_PATHS.memoryRoomPlayers(codeId, roomId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists() ? (snapshot.val() as Record<string, RTDBMemoryPlayer>) : {});
  };
  onValue(playersRef, callback);
  return () => off(playersRef, 'value', callback);
}

/** Delete a memory room */
export async function deleteMemoryRoom(
  codeId: string,
  roomId: string
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  await remove(roomRef);
}

// ============ LOBBY CHAT ============

/** Send a chat message. Returns the RTDB push key. */
export async function sendChatMessage(
  codeId: string,
  message: Omit<QGamesChatMessage, 'id'>
): Promise<string> {
  const chatRef = ref(realtimeDb, QGAMES_PATHS.chat(codeId));
  const newRef = push(chatRef);
  // Strip undefined values — Firebase RTDB rejects them
  const fullMessage: Record<string, unknown> = { id: newRef.key! };
  for (const [k, v] of Object.entries(message)) {
    if (v !== undefined) fullMessage[k] = v;
  }
  await set(newRef, fullMessage);
  return newRef.key!;
}

/** Subscribe to chat messages (last 50, ordered by sentAt) */
export function subscribeToChatMessages(
  codeId: string,
  onUpdate: (messages: QGamesChatMessage[]) => void
): () => void {
  const chatQuery = query(
    ref(realtimeDb, QGAMES_PATHS.chat(codeId)),
    orderByChild('sentAt'),
    limitToLast(50)
  );
  const callback = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) {
      onUpdate([]);
      return;
    }
    const messages: QGamesChatMessage[] = [];
    snapshot.forEach((child) => {
      messages.push(child.val() as QGamesChatMessage);
    });
    // Already ordered by sentAt due to query
    onUpdate(messages);
  };
  onValue(chatQuery, callback);
  return () => off(chatQuery, 'value', callback);
}

/** Subscribe to chat ban status for a player */
export function subscribeToChatBan(
  codeId: string,
  visitorId: string,
  onUpdate: (banned: boolean) => void
): () => void {
  const banRef = ref(realtimeDb, QGAMES_PATHS.chatBan(codeId, visitorId));
  const callback = (snapshot: DataSnapshot) => {
    onUpdate(snapshot.exists());
  };
  onValue(banRef, callback);
  return () => off(banRef, 'value', callback);
}

/** Ban a player from chat */
export async function banFromChat(
  codeId: string,
  visitorId: string
): Promise<void> {
  const banRef = ref(realtimeDb, QGAMES_PATHS.chatBan(codeId, visitorId));
  await set(banRef, { visitorId, bannedAt: Date.now() });
}

/** Clean up old chat messages (older than maxAgeMs) */
export async function cleanupOldChatMessages(
  codeId: string,
  maxAgeMs: number = 600000 // 10 minutes
): Promise<void> {
  const chatRef = ref(realtimeDb, QGAMES_PATHS.chat(codeId));
  const snapshot = await get(chatRef);
  if (!snapshot.exists()) return;

  const now = Date.now();
  const promises: Promise<void>[] = [];
  snapshot.forEach((child) => {
    const msg = child.val() as QGamesChatMessage;
    if (now - msg.sentAt > maxAgeMs) {
      promises.push(remove(ref(realtimeDb, QGAMES_PATHS.chatMessage(codeId, child.key!))));
    }
  });
  await Promise.all(promises);
}

/** Subscribe to active player stats (per game type + total) + live match details.
 *  Counts connected **players** (not matches) using presence nodes.
 *  Presence nodes auto-clean via onDisconnect, so stale matches won't inflate counts. */
export function subscribeToActiveMatchStats(
  codeId: string,
  onUpdate: (stats: { total: number; perGame: Record<string, number>; liveMatches: LiveMatchInfo[] }) => void
): () => void {
  const matchesRef = ref(realtimeDb, QGAMES_PATHS.matches(codeId));
  const callback = (snapshot: DataSnapshot) => {
    if (!snapshot.exists()) { onUpdate({ total: 0, perGame: {}, liveMatches: [] }); return; }
    let total = 0;
    const perGame: Record<string, number> = {};
    const liveMatches: LiveMatchInfo[] = [];
    snapshot.forEach((child) => {
      const match = child.val();
      const presenceCount = match?.presence ? Object.keys(match.presence).length : 0;
      if (presenceCount >= 1) {
        // Count players, not matches (e.g. 1 match with 2 players = 2)
        total += presenceCount;
        const gt = match.gameType as string;
        if (gt) perGame[gt] = (perGame[gt] || 0) + presenceCount;

        // Collect live match details for active matches
        if (match.status === 'playing' || match.status === 'countdown') {
          liveMatches.push({
            matchId: match.id || child.key!,
            gameType: match.gameType,
            player1Id: match.player1Id || '',
            player1Nickname: match.player1Nickname || '?',
            player1AvatarType: match.player1AvatarType || 'emoji',
            player1AvatarValue: match.player1AvatarValue || '🎮',
            player2Id: match.player2Id || '',
            player2Nickname: match.player2Nickname || '?',
            player2AvatarType: match.player2AvatarType || 'emoji',
            player2AvatarValue: match.player2AvatarValue || '🎮',
            player3Id: match.player3Id,
            player3Nickname: match.player3Nickname,
            player3AvatarType: match.player3AvatarType,
            player3AvatarValue: match.player3AvatarValue,
            startedAt: match.startedAt || 0,
          });
        }
      }
    });
    liveMatches.sort((a, b) => b.startedAt - a.startedAt);
    onUpdate({ total, perGame, liveMatches });
  };
  onValue(matchesRef, callback);
  return () => off(matchesRef, 'value', callback);
}
