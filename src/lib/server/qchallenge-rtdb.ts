/**
 * Server-only (Admin SDK) copies of the qchallenge-realtime.ts functions used by API routes.
 * Keep in sync with the client versions; client writes to qchallenge/* are denied by
 * database.rules.json.
 */

import { realtimeDb, ref, set, update, get, push, runTransaction } from '@/lib/server/rtdbAdmin';

import type {
  QChallengeLiveData,
  QChallengeLeaderboardEntry,
  QChallengeRecentCompletion,
  QChallengeStats,
} from '@/types/qchallenge';

const QCHALLENGE_PATH = 'qchallenge';

function getSessionPath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}`;
}

function getStatsPath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/stats`;
}

function getLeaderboardPath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/leaderboard`;
}

function getBranchLeaderboardPath(codeId: string, branchId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/branchLeaderboards/${branchId}`;
}

function getRecentCompletionsPath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/recentCompletions`;
}

/**
 * Initialize or reset a Q.Challenge session in Realtime Database
 */
export async function initQChallengeSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const initialData: QChallengeLiveData = {
    status: 'registration',
    stats: {
      totalPlayers: 0,
      playersPlaying: 0,
      playersFinished: 0,
      totalAnswers: 0,
      avgScore: 0,
      topScore: 0,
      avgAccuracy: 0,
      avgTimeMs: 0,
      lastUpdated: Date.now(),
    },
    leaderboard: {},
    lastUpdated: Date.now(),
  };

  await set(sessionRef, initialData);
}

/**
 * Check if session exists in Realtime DB
 */
export async function qchallengeSessionExists(codeId: string): Promise<boolean> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.exists();
}

/**
 * Increment total players count when a new player registers
 */
export async function incrementTotalPlayers(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QChallengeStats | null) => {
    if (!currentStats) {
      return {
        totalPlayers: 1,
        playersPlaying: 1,
        playersFinished: 0,
        totalAnswers: 0,
        avgScore: 0,
        topScore: 0,
        avgAccuracy: 0,
        avgTimeMs: 0,
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
export async function updateLeaderboardEntry(
  codeId: string,
  entry: QChallengeLeaderboardEntry
): Promise<void> {
  const entryRef = ref(realtimeDb, `${getLeaderboardPath(codeId)}/${entry.visitorId}`);
  await set(entryRef, entry);

  // Also update branch leaderboard if player has a branch
  if (entry.branchId) {
    const branchEntryRef = ref(
      realtimeDb,
      `${getBranchLeaderboardPath(codeId, entry.branchId)}/${entry.visitorId}`
    );
    await set(branchEntryRef, entry);
  }
}

/**
 * Mark a player as finished
 */
export async function incrementPlayersFinished(
  codeId: string,
  finalScore: number,
  accuracy: number,
  totalTimeMs: number
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QChallengeStats | null) => {
    if (!currentStats) return currentStats;

    const newFinishedCount = currentStats.playersFinished + 1;

    // Calculate new averages
    const newAvgScore =
      (currentStats.avgScore * currentStats.playersFinished + finalScore) /
      newFinishedCount;

    const newAvgAccuracy =
      (currentStats.avgAccuracy * currentStats.playersFinished + accuracy) /
      newFinishedCount;

    const newAvgTimeMs =
      (currentStats.avgTimeMs * currentStats.playersFinished + totalTimeMs) /
      newFinishedCount;

    return {
      ...currentStats,
      playersPlaying: Math.max(0, currentStats.playersPlaying - 1),
      playersFinished: newFinishedCount,
      avgScore: Math.round(newAvgScore),
      topScore: Math.max(currentStats.topScore, finalScore),
      avgAccuracy: Math.round(newAvgAccuracy * 10) / 10,
      avgTimeMs: Math.round(newAvgTimeMs),
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Increment total answers count
 */
export async function incrementTotalAnswers(codeId: string): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  await runTransaction(statsRef, (currentStats: QChallengeStats | null) => {
    if (!currentStats) return currentStats;

    return {
      ...currentStats,
      totalAnswers: currentStats.totalAnswers + 1,
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Add a recent completion (for live feed on display)
 */
export async function addRecentCompletion(
  codeId: string,
  completion: QChallengeRecentCompletion
): Promise<void> {
  const completionsRef = ref(realtimeDb, getRecentCompletionsPath(codeId));
  const newCompletionRef = push(completionsRef);
  await set(newCompletionRef, completion);
}

/**
 * Recalculate and update all ranks in leaderboard
 */
export async function recalculateRanks(codeId: string): Promise<void> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));
  const snapshot = await get(leaderboardRef);

  if (!snapshot.exists()) return;

  const entries = Object.values(snapshot.val()) as QChallengeLeaderboardEntry[];

  // Sort by score (desc), then by total time (asc for faster completion)
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalTimeMs - b.totalTimeMs;
  });

  // Update ranks
  const updates: Record<string, QChallengeLeaderboardEntry> = {};
  entries.forEach((entry, index) => {
    updates[entry.visitorId] = { ...entry, rank: index + 1 };
  });

  await set(leaderboardRef, updates);
}

/**
 * Get player's current rank
 */
export async function getPlayerRank(
  codeId: string,
  visitorId: string
): Promise<number | null> {
  const leaderboard = await getQChallengeLeaderboard(codeId);
  const entry = leaderboard.find(e => e.visitorId === visitorId);
  return entry?.rank ?? null;
}

/**
 * Get current leaderboard
 */
export async function getQChallengeLeaderboard(
  codeId: string
): Promise<QChallengeLeaderboardEntry[]> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));
  const snapshot = await get(leaderboardRef);

  if (!snapshot.exists()) return [];

  const entries = Object.values(snapshot.val()) as QChallengeLeaderboardEntry[];
  entries.sort((a, b) => a.rank - b.rank);
  return entries;
}

/**
 * Get current stats
 */
export async function getQChallengeStats(codeId: string): Promise<QChallengeStats | null> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  const snapshot = await get(statsRef);
  return snapshot.val();
}

