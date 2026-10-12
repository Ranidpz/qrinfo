/**
 * Server-only (Admin SDK) copies of the qtreasure-realtime.ts writers used by API routes.
 * Keep in sync with the client versions; client writes to these nodes are denied by
 * database.rules.json.
 */

import { realtimeDb, ref, set, update, get, remove, push, runTransaction } from '@/lib/server/rtdbAdmin';

import type {
  QTreasureLiveData,
  QTreasureLeaderboardEntry,
  QTreasureRecentCompletion,
  QTreasureStats,
  QTreasurePhase,
} from '@/types/qtreasure';

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
 * Check if session exists in Realtime DB
 */
export async function treasureSessionExists(codeId: string): Promise<boolean> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.exists();
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

