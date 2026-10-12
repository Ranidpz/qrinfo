/**
 * Server-only (Admin SDK) copies of the qgames-realtime.ts writers used by API routes.
 * Keep in sync with the client versions; client writes to these nodes are denied by
 * database.rules.json.
 */

import { realtimeDb, ref, set, update, get, remove } from '@/lib/server/rtdbAdmin';

import {
  QGAMES_PATHS,
  QGamesLeaderboardEntry,
  RTDBMatch,
  RTDBRPSState,
  RTDBTTTState,
  RTDBOOOState,
  RTDBC4State,
  MatchStatus,
  QGamesRecord,
} from '@/types/qgames';

/** Get match data */
export async function getMatch(codeId: string, matchId: string): Promise<RTDBMatch | null> {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, matchId));
  const snapshot = await get(matchRef);
  return snapshot.exists() ? (snapshot.val() as RTDBMatch) : null;
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

/** Get OOO state */
export async function getOOOState(
  codeId: string,
  matchId: string
): Promise<RTDBOOOState | null> {
  const oooRef = ref(realtimeDb, QGAMES_PATHS.oooState(codeId, matchId));
  const snapshot = await get(oooRef);
  return snapshot.exists() ? (snapshot.val() as RTDBOOOState) : null;
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

/** Get Connect 4 state (single read) */
export async function getC4State(
  codeId: string,
  matchId: string
): Promise<RTDBC4State | null> {
  const c4Ref = ref(realtimeDb, QGAMES_PATHS.c4State(codeId, matchId));
  const snapshot = await get(c4Ref);
  return snapshot.exists() ? (snapshot.val() as RTDBC4State) : null;
}

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

/** Clean up finished match from RTDB (after persisting to Firestore) */
export async function cleanupMatch(codeId: string, matchId: string): Promise<void> {
  const matchRef = ref(realtimeDb, QGAMES_PATHS.match(codeId, matchId));
  await remove(matchRef);
}

/** Leave the matchmaking queue */
export async function leaveQueue(codeId: string, visitorId: string): Promise<void> {
  const entryRef = ref(realtimeDb, QGAMES_PATHS.queueEntry(codeId, visitorId));
  await remove(entryRef);
}

/** Delete a memory room */
export async function deleteMemoryRoom(
  codeId: string,
  roomId: string
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.memoryRoom(codeId, roomId));
  await remove(roomRef);
}

/** Delete a frogger room */
export async function deleteFroggerRoom(
  codeId: string,
  roomId: string
): Promise<void> {
  const roomRef = ref(realtimeDb, QGAMES_PATHS.froggerRoom(codeId, roomId));
  await remove(roomRef);
}

/** Get the current record for a game type */
export async function getGameRecord(
  codeId: string,
  gameType: string
): Promise<QGamesRecord | null> {
  const recordRef = ref(realtimeDb, QGAMES_PATHS.record(codeId, gameType));
  const snapshot = await get(recordRef);
  return snapshot.exists() ? (snapshot.val() as QGamesRecord) : null;
}

/** Update game record */
export async function updateGameRecord(
  codeId: string,
  gameType: string,
  record: QGamesRecord
): Promise<void> {
  const recordRef = ref(realtimeDb, QGAMES_PATHS.record(codeId, gameType));
  await set(recordRef, record);
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

