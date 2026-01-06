/**
 * QTreasure - Firebase Realtime Database helpers
 * Handles live leaderboard and real-time updates for display screen
 *
 * Why Realtime Database instead of Firestore?
 * - Sub-100ms latency (vs 1-2 seconds for Firestore onSnapshot)
 * - Optimized for high-frequency reads/writes
 * - Better for concurrent users watching the same data
 * - Perfect for live leaderboard scenarios
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
} from 'firebase/database';
import {
  QTreasureLiveData,
  QTreasureLeaderboardEntry,
  QTreasureRecentCompletion,
  QTreasureStats,
  QTreasurePhase,
} from '@/types/qtreasure';

// ============ PATHS ============

const QTREASURE_PATH = 'qtreasure';

function getSessionPath(codeId: string): string {
  return `${QTREASURE_PATH}/${codeId}`;
}

function getStatsPath(codeId: string): string {
  return `${QTREASURE_PATH}/${codeId}/stats`;
}

function getLeaderboardPath(codeId: string): string {
  return `${QTREASURE_PATH}/${codeId}/leaderboard`;
}

function getRecentCompletionsPath(codeId: string): string {
  return `${QTREASURE_PATH}/${codeId}/recentCompletions`;
}

// ============ SESSION MANAGEMENT ============

/**
 * Initialize or reset a QTreasure session in Realtime Database
 */
export async function initTreasureSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const initialData: QTreasureLiveData = {
    status: 'registration',
    stats: {
      totalPlayers: 0,
      playersPlaying: 0,
      playersCompleted: 0,
      avgCompletionTimeMs: 0,
      fastestTimeMs: 0,
      lastUpdated: Date.now(),
    },
    leaderboard: {},
    recentCompletions: {},
    lastUpdated: Date.now(),
  };

  await set(sessionRef, initialData);
}

/**
 * Update session status (phase)
 */
export async function updateTreasureStatus(
  codeId: string,
  status: QTreasurePhase
): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const updates: Partial<QTreasureLiveData> = {
    status,
    lastUpdated: Date.now(),
  };

  await update(sessionRef, updates);
}

/**
 * Reset session for new game
 */
export async function resetTreasureRealtimeSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  await update(sessionRef, {
    status: 'registration',
    stats: {
      totalPlayers: 0,
      playersPlaying: 0,
      playersCompleted: 0,
      avgCompletionTimeMs: 0,
      fastestTimeMs: 0,
      lastUpdated: Date.now(),
    },
    leaderboard: {},
    recentCompletions: {},
    lastUpdated: Date.now(),
  });
}

// ============ STATS UPDATES ============

/**
 * Update session stats
 */
export async function updateTreasureStats(
  codeId: string,
  stats: QTreasureStats
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  await set(statsRef, stats);
}

/**
 * Increment players playing count (when player starts)
 */
export async function incrementTreasurePlayersPlaying(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QTreasureStats | null) => {
    if (!currentStats) {
      return {
        totalPlayers: 1,
        playersPlaying: 1,
        playersCompleted: 0,
        avgCompletionTimeMs: 0,
        fastestTimeMs: 0,
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
export async function incrementTreasurePlayersFinished(
  codeId: string,
  completionTimeMs: number
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QTreasureStats | null) => {
    if (!currentStats) return currentStats;

    const newPlayersCompleted = currentStats.playersCompleted + 1;

    // Calculate new average
    const totalTimeSum = currentStats.avgCompletionTimeMs * currentStats.playersCompleted + completionTimeMs;
    const newAvgCompletionTimeMs = Math.round(totalTimeSum / newPlayersCompleted);

    // Update fastest time
    const newFastestTimeMs = currentStats.fastestTimeMs === 0
      ? completionTimeMs
      : Math.min(currentStats.fastestTimeMs, completionTimeMs);

    return {
      ...currentStats,
      playersPlaying: Math.max(0, currentStats.playersPlaying - 1),
      playersCompleted: newPlayersCompleted,
      avgCompletionTimeMs: newAvgCompletionTimeMs,
      fastestTimeMs: newFastestTimeMs,
      lastUpdated: Date.now(),
    };
  });
}

// ============ LEADERBOARD UPDATES ============

/**
 * Update a single leaderboard entry
 */
export async function updateTreasureLeaderboardEntry(
  codeId: string,
  entry: QTreasureLeaderboardEntry
): Promise<void> {
  const entryRef = ref(realtimeDb, `${getLeaderboardPath(codeId)}/${entry.playerId}`);
  await set(entryRef, entry);
}

/**
 * Remove a player from leaderboard
 */
export async function removeFromTreasureLeaderboard(
  codeId: string,
  playerId: string
): Promise<void> {
  const entryRef = ref(realtimeDb, `${getLeaderboardPath(codeId)}/${playerId}`);
  await remove(entryRef);
}

/**
 * Batch update entire leaderboard
 */
export async function batchUpdateTreasureLeaderboard(
  codeId: string,
  entries: QTreasureLeaderboardEntry[]
): Promise<void> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));

  const leaderboardData: Record<string, QTreasureLeaderboardEntry> = {};
  entries.forEach(entry => {
    leaderboardData[entry.playerId] = entry;
  });

  await set(leaderboardRef, leaderboardData);
}

/**
 * Recalculate and update all ranks in leaderboard (sorted by completion time)
 */
export async function recalculateTreasureRanks(codeId: string): Promise<void> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));
  const snapshot = await get(leaderboardRef);

  if (!snapshot.exists()) return;

  const entries = Object.values(snapshot.val()) as QTreasureLeaderboardEntry[];

  // Sort by completion time (ascending - fastest first)
  entries.sort((a, b) => a.completionTimeMs - b.completionTimeMs);

  // Update ranks
  const updates: Record<string, QTreasureLeaderboardEntry> = {};
  entries.forEach((entry, index) => {
    updates[entry.playerId] = { ...entry, rank: index + 1 };
  });

  await set(leaderboardRef, updates);
}

// ============ RECENT COMPLETIONS ============

/**
 * Add a recent completion (for live feed on display)
 */
export async function addRecentCompletion(
  codeId: string,
  completion: QTreasureRecentCompletion
): Promise<void> {
  const completionsRef = ref(realtimeDb, getRecentCompletionsPath(codeId));
  const newCompletionRef = push(completionsRef);
  await set(newCompletionRef, completion);
}

/**
 * Trim recent completions to keep only the latest N
 */
export async function trimRecentCompletions(
  codeId: string,
  maxCount: number = 10
): Promise<void> {
  const completionsRef = ref(realtimeDb, getRecentCompletionsPath(codeId));
  const snapshot = await get(completionsRef);

  if (!snapshot.exists()) return;

  const completions = snapshot.val() as Record<string, QTreasureRecentCompletion>;
  const completionEntries = Object.entries(completions);

  if (completionEntries.length <= maxCount) return;

  // Sort by completedAt and keep only the newest
  completionEntries.sort((a, b) => b[1].completedAt - a[1].completedAt);

  const toRemove = completionEntries.slice(maxCount);
  for (const [key] of toRemove) {
    const completionRef = ref(realtimeDb, `${getRecentCompletionsPath(codeId)}/${key}`);
    await remove(completionRef);
  }
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to entire session data
 */
export function subscribeToTreasureLive(
  codeId: string,
  onUpdate: (data: QTreasureLiveData | null) => void
): () => void {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() as QTreasureLiveData | null;
    onUpdate(data);
  };

  onValue(sessionRef, callback);

  // Return unsubscribe function
  return () => off(sessionRef, 'value', callback);
}

/**
 * Subscribe to stats only (lighter than full session)
 */
export function subscribeToTreasureStats(
  codeId: string,
  onUpdate: (stats: QTreasureStats | null) => void
): () => void {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const stats = snapshot.val() as QTreasureStats | null;
    onUpdate(stats);
  };

  onValue(statsRef, callback);

  return () => off(statsRef, 'value', callback);
}

/**
 * Subscribe to leaderboard changes
 */
export function subscribeToTreasureLeaderboard(
  codeId: string,
  onUpdate: (entries: QTreasureLeaderboardEntry[]) => void
): () => void {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const entries = Object.values(data) as QTreasureLeaderboardEntry[];
    // Sort by rank (completion time)
    entries.sort((a, b) => a.rank - b.rank);
    onUpdate(entries);
  };

  onValue(leaderboardRef, callback);

  return () => off(leaderboardRef, 'value', callback);
}

/**
 * Subscribe to recent completions (for live feed)
 */
export function subscribeToTreasureRecentCompletions(
  codeId: string,
  onUpdate: (completions: QTreasureRecentCompletion[]) => void
): () => void {
  const completionsRef = ref(realtimeDb, getRecentCompletionsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const completions = Object.values(data) as QTreasureRecentCompletion[];
    // Sort by completedAt descending (newest first)
    completions.sort((a, b) => b.completedAt - a.completedAt);
    onUpdate(completions);
  };

  onValue(completionsRef, callback);

  return () => off(completionsRef, 'value', callback);
}

// ============ ONE-TIME READS ============

/**
 * Get current session data
 */
export async function getTreasureLive(codeId: string): Promise<QTreasureLiveData | null> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.val();
}

/**
 * Get current stats
 */
export async function getTreasureRealtimeStats(codeId: string): Promise<QTreasureStats | null> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  const snapshot = await get(statsRef);
  return snapshot.val();
}

/**
 * Get current leaderboard
 */
export async function getTreasureLeaderboard(codeId: string): Promise<QTreasureLeaderboardEntry[]> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));
  const snapshot = await get(leaderboardRef);

  if (!snapshot.exists()) return [];

  const entries = Object.values(snapshot.val()) as QTreasureLeaderboardEntry[];
  entries.sort((a, b) => a.rank - b.rank);
  return entries;
}

/**
 * Check if session exists in Realtime DB
 */
export async function treasureSessionExists(codeId: string): Promise<boolean> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.exists();
}
