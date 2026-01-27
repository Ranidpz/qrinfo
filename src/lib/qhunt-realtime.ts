/**
 * QHunt - Firebase Realtime Database helpers
 * Handles live leaderboard and real-time updates for display screen
 *
 * Why Realtime Database instead of Firestore?
 * - Sub-100ms latency (vs 1-2 seconds for Firestore onSnapshot)
 * - Optimized for high-frequency reads/writes
 * - Better for 500+ concurrent users watching the same data
 * - Perfect for live leaderboard scenarios where every millisecond counts
 */

import { realtimeDb } from './firebase';
import {
  ref,
  set,
  update,
  get,
  onValue,
  off,
  push,
  remove,
  runTransaction,
  DataSnapshot,
  query,
  orderByChild,
  limitToLast,
} from 'firebase/database';
import {
  QHuntLiveData,
  QHuntLeaderboardEntry,
  QHuntTeamScore,
  QHuntRecentScan,
  QHuntStats,
  QHuntPhase,
} from '@/types/qhunt';

// ============ PATHS ============

const QHUNT_PATH = 'qhunt';

function getSessionPath(codeId: string): string {
  return `${QHUNT_PATH}/${codeId}`;
}

function getStatsPath(codeId: string): string {
  return `${QHUNT_PATH}/${codeId}/stats`;
}

function getLeaderboardPath(codeId: string): string {
  return `${QHUNT_PATH}/${codeId}/leaderboard`;
}

function getTeamScoresPath(codeId: string): string {
  return `${QHUNT_PATH}/${codeId}/teamScores`;
}

function getRecentScansPath(codeId: string): string {
  return `${QHUNT_PATH}/${codeId}/recentScans`;
}

// ============ SESSION MANAGEMENT ============

/**
 * Initialize or reset a QHunt session in Realtime Database
 */
export async function initQHuntSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const initialData: QHuntLiveData = {
    status: 'registration',
    stats: {
      totalPlayers: 0,
      playersPlaying: 0,
      playersFinished: 0,
      totalScans: 0,
      avgScore: 0,
      topScore: 0,
      lastUpdated: Date.now(),
    },
    leaderboard: {},
    teamScores: {},
    recentScans: {},
    lastUpdated: Date.now(),
  };

  await set(sessionRef, initialData);
}

/**
 * Update session status (phase)
 */
export async function updateQHuntStatus(
  codeId: string,
  status: QHuntPhase
): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const updates: Partial<QHuntLiveData> = {
    status,
    lastUpdated: Date.now(),
  };

  if (status === 'countdown') {
    updates.countdownStartedAt = Date.now();
  } else if (status === 'playing') {
    updates.gameStartedAt = Date.now();
  }

  await update(sessionRef, updates);
}

/**
 * Reset session for new game
 */
export async function resetQHuntSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  await update(sessionRef, {
    status: 'registration',
    countdownStartedAt: null,
    gameStartedAt: null,
    stats: {
      totalPlayers: 0,
      playersPlaying: 0,
      playersFinished: 0,
      totalScans: 0,
      avgScore: 0,
      topScore: 0,
      lastUpdated: Date.now(),
    },
    leaderboard: {},
    teamScores: {},
    recentScans: {},
    lastUpdated: Date.now(),
  });
}

// ============ STATS UPDATES ============

/**
 * Update session stats
 */
export async function updateQHuntStats(
  codeId: string,
  stats: QHuntStats
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  await set(statsRef, stats);
}

/**
 * Increment players playing count
 */
export async function incrementPlayersPlaying(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QHuntStats | null) => {
    if (!currentStats) {
      return {
        totalPlayers: 1,
        playersPlaying: 1,
        playersFinished: 0,
        totalScans: 0,
        avgScore: 0,
        topScore: 0,
        lastUpdated: Date.now(),
      };
    }

    return {
      ...currentStats,
      totalPlayers: currentStats.totalPlayers + 1,
      playersPlaying: currentStats.playersPlaying + 1,
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Mark a player as finished
 */
export async function incrementPlayersFinished(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QHuntStats | null) => {
    if (!currentStats) return currentStats;

    return {
      ...currentStats,
      playersPlaying: Math.max(0, currentStats.playersPlaying - 1),
      playersFinished: currentStats.playersFinished + 1,
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Update stats after a scan
 */
export async function updateStatsAfterScan(
  codeId: string,
  newScore: number
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QHuntStats | null) => {
    if (!currentStats) return currentStats;

    return {
      ...currentStats,
      totalScans: currentStats.totalScans + 1,
      topScore: Math.max(currentStats.topScore, newScore),
      lastUpdated: Date.now(),
    };
  });
}

// ============ LEADERBOARD UPDATES ============

/**
 * Update a single leaderboard entry
 */
export async function updateLeaderboardEntry(
  codeId: string,
  entry: QHuntLeaderboardEntry
): Promise<void> {
  const entryRef = ref(realtimeDb, `${getLeaderboardPath(codeId)}/${entry.playerId}`);
  await set(entryRef, entry);
}

/**
 * Remove a player from leaderboard
 */
export async function removeFromLeaderboard(
  codeId: string,
  playerId: string
): Promise<void> {
  const entryRef = ref(realtimeDb, `${getLeaderboardPath(codeId)}/${playerId}`);
  await remove(entryRef);
}

/**
 * Batch update entire leaderboard
 */
export async function batchUpdateLeaderboard(
  codeId: string,
  entries: QHuntLeaderboardEntry[]
): Promise<void> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));

  const leaderboardData: Record<string, QHuntLeaderboardEntry> = {};
  entries.forEach(entry => {
    leaderboardData[entry.playerId] = entry;
  });

  await set(leaderboardRef, leaderboardData);
}

/**
 * Recalculate and update all ranks in leaderboard
 */
export async function recalculateRanks(codeId: string): Promise<void> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));
  const snapshot = await get(leaderboardRef);

  if (!snapshot.exists()) return;

  const entries = Object.values(snapshot.val()) as QHuntLeaderboardEntry[];

  // Sort by score (desc), then by game time (asc)
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.gameTime && b.gameTime) return a.gameTime - b.gameTime;
    return 0;
  });

  // Update ranks
  const updates: Record<string, QHuntLeaderboardEntry> = {};
  entries.forEach((entry, index) => {
    updates[entry.playerId] = { ...entry, rank: index + 1 };
  });

  await set(leaderboardRef, updates);
}

// ============ TEAM SCORES ============

/**
 * Update a team's score
 */
export async function updateTeamScore(
  codeId: string,
  teamScore: QHuntTeamScore
): Promise<void> {
  const teamRef = ref(realtimeDb, `${getTeamScoresPath(codeId)}/${teamScore.teamId}`);
  await set(teamRef, teamScore);
}

/**
 * Batch update all team scores
 */
export async function batchUpdateTeamScores(
  codeId: string,
  teamScores: QHuntTeamScore[]
): Promise<void> {
  const teamsRef = ref(realtimeDb, getTeamScoresPath(codeId));

  const teamsData: Record<string, QHuntTeamScore> = {};
  teamScores.forEach(team => {
    teamsData[team.teamId] = team;
  });

  await set(teamsRef, teamsData);
}

// ============ RECENT SCANS ============

/**
 * Add a recent scan (for live feed on display)
 */
export async function addRecentScan(
  codeId: string,
  scan: QHuntRecentScan
): Promise<void> {
  const scansRef = ref(realtimeDb, getRecentScansPath(codeId));
  const newScanRef = push(scansRef);
  await set(newScanRef, scan);
}

/**
 * Trim recent scans to keep only the latest N
 */
export async function trimRecentScans(
  codeId: string,
  maxCount: number = 20
): Promise<void> {
  const scansRef = ref(realtimeDb, getRecentScansPath(codeId));
  const snapshot = await get(scansRef);

  if (!snapshot.exists()) return;

  const scans = snapshot.val() as Record<string, QHuntRecentScan>;
  const scanEntries = Object.entries(scans);

  if (scanEntries.length <= maxCount) return;

  // Sort by scannedAt and keep only the newest
  scanEntries.sort((a, b) => b[1].scannedAt - a[1].scannedAt);

  const toRemove = scanEntries.slice(maxCount);
  for (const [key] of toRemove) {
    const scanRef = ref(realtimeDb, `${getRecentScansPath(codeId)}/${key}`);
    await remove(scanRef);
  }
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to entire session data
 */
export function subscribeToQHuntLive(
  codeId: string,
  onUpdate: (data: QHuntLiveData | null) => void
): () => void {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() as QHuntLiveData | null;
    onUpdate(data);
  };

  onValue(sessionRef, callback);

  // Return unsubscribe function
  return () => off(sessionRef, 'value', callback);
}

/**
 * Subscribe to stats only (lighter than full session)
 */
export function subscribeToQHuntStats(
  codeId: string,
  onUpdate: (stats: QHuntStats | null) => void
): () => void {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const stats = snapshot.val() as QHuntStats | null;
    onUpdate(stats);
  };

  onValue(statsRef, callback);

  return () => off(statsRef, 'value', callback);
}

/**
 * Subscribe to leaderboard changes
 */
export function subscribeToQHuntLeaderboard(
  codeId: string,
  onUpdate: (entries: QHuntLeaderboardEntry[]) => void
): () => void {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const entries = Object.values(data) as QHuntLeaderboardEntry[];
    // Sort by rank
    entries.sort((a, b) => a.rank - b.rank);
    onUpdate(entries);
  };

  const errorCallback = (error: Error) => {
    console.error('[QHunt] Leaderboard subscription error:', error.message);
    // Return empty array on error so the UI can handle gracefully
    onUpdate([]);
  };

  onValue(leaderboardRef, callback, errorCallback);

  return () => off(leaderboardRef, 'value', callback);
}

/**
 * Subscribe to team scores
 */
export function subscribeToQHuntTeamScores(
  codeId: string,
  onUpdate: (scores: QHuntTeamScore[]) => void
): () => void {
  const teamsRef = ref(realtimeDb, getTeamScoresPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const scores = Object.values(data) as QHuntTeamScore[];
    // Sort by rank
    scores.sort((a, b) => a.rank - b.rank);
    onUpdate(scores);
  };

  onValue(teamsRef, callback);

  return () => off(teamsRef, 'value', callback);
}

/**
 * Subscribe to recent scans (for live feed)
 */
export function subscribeToQHuntRecentScans(
  codeId: string,
  onUpdate: (scans: QHuntRecentScan[]) => void
): () => void {
  const scansRef = ref(realtimeDb, getRecentScansPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const scans = Object.values(data) as QHuntRecentScan[];
    // Sort by scannedAt descending (newest first)
    scans.sort((a, b) => b.scannedAt - a.scannedAt);
    onUpdate(scans);
  };

  onValue(scansRef, callback);

  return () => off(scansRef, 'value', callback);
}

// ============ ONE-TIME READS ============

/**
 * Get current session data
 */
export async function getQHuntLive(codeId: string): Promise<QHuntLiveData | null> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.val();
}

/**
 * Get current stats
 */
export async function getQHuntStats(codeId: string): Promise<QHuntStats | null> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  const snapshot = await get(statsRef);
  return snapshot.val();
}

/**
 * Get current leaderboard
 */
export async function getQHuntLeaderboard(codeId: string): Promise<QHuntLeaderboardEntry[]> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));
  const snapshot = await get(leaderboardRef);

  if (!snapshot.exists()) return [];

  const entries = Object.values(snapshot.val()) as QHuntLeaderboardEntry[];
  entries.sort((a, b) => a.rank - b.rank);
  return entries;
}

/**
 * Check if session exists in Realtime DB
 */
export async function qhuntSessionExists(codeId: string): Promise<boolean> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.exists();
}
