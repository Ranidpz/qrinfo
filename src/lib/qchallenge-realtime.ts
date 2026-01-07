/**
 * Q.Challenge - Firebase Realtime Database helpers
 * Handles live leaderboard and real-time updates for trivia quiz
 *
 * Why Realtime Database instead of Firestore?
 * - Sub-100ms latency (vs 1-2 seconds for Firestore onSnapshot)
 * - Optimized for high-frequency reads/writes
 * - Better for 1000+ concurrent users watching the same leaderboard
 * - Perfect for live quiz scenarios where every millisecond counts
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
  QChallengeLiveData,
  QChallengeLeaderboardEntry,
  QChallengeRecentCompletion,
  QChallengeStats,
  QChallengePhase,
} from '@/types/qchallenge';

// ============ PATHS ============

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

function getBranchStatsPath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/branchStats`;
}

function getRecentCompletionsPath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/recentCompletions`;
}

function getLiveStatePath(codeId: string): string {
  return `${QCHALLENGE_PATH}/${codeId}/liveState`;
}

// ============ SESSION MANAGEMENT ============

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
 * Update session status (phase)
 */
export async function updateQChallengeStatus(
  codeId: string,
  status: QChallengePhase
): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const updates: Partial<QChallengeLiveData> = {
    status,
    lastUpdated: Date.now(),
  };

  if (status === 'playing') {
    updates.gameStartedAt = Date.now();
  }

  await update(sessionRef, updates);
}

/**
 * Reset session for new quiz
 */
export async function resetQChallengeSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  await update(sessionRef, {
    status: 'registration',
    gameStartedAt: null,
    liveState: null,
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
    branchLeaderboards: null,
    branchStats: null,
    recentCompletions: null,
    lastUpdated: Date.now(),
  });
}

// ============ STATS UPDATES ============

/**
 * Update session stats
 */
export async function updateQChallengeStats(
  codeId: string,
  stats: QChallengeStats
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  await set(statsRef, stats);
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

// ============ LEADERBOARD UPDATES ============

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
 * Remove a player from leaderboard
 */
export async function removeFromLeaderboard(
  codeId: string,
  visitorId: string,
  branchId?: string
): Promise<void> {
  const entryRef = ref(realtimeDb, `${getLeaderboardPath(codeId)}/${visitorId}`);
  await remove(entryRef);

  if (branchId) {
    const branchEntryRef = ref(
      realtimeDb,
      `${getBranchLeaderboardPath(codeId, branchId)}/${visitorId}`
    );
    await remove(branchEntryRef);
  }
}

/**
 * Batch update entire leaderboard
 */
export async function batchUpdateLeaderboard(
  codeId: string,
  entries: QChallengeLeaderboardEntry[]
): Promise<void> {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));

  const leaderboardData: Record<string, QChallengeLeaderboardEntry> = {};
  entries.forEach(entry => {
    leaderboardData[entry.visitorId] = entry;
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
 * Recalculate ranks for a specific branch
 */
export async function recalculateBranchRanks(
  codeId: string,
  branchId: string
): Promise<void> {
  const branchLeaderboardRef = ref(realtimeDb, getBranchLeaderboardPath(codeId, branchId));
  const snapshot = await get(branchLeaderboardRef);

  if (!snapshot.exists()) return;

  const entries = Object.values(snapshot.val()) as QChallengeLeaderboardEntry[];

  // Sort by score (desc), then by total time (asc)
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalTimeMs - b.totalTimeMs;
  });

  // Update ranks
  const updates: Record<string, QChallengeLeaderboardEntry> = {};
  entries.forEach((entry, index) => {
    updates[entry.visitorId] = { ...entry, rank: index + 1 };
  });

  await set(branchLeaderboardRef, updates);
}

// ============ BRANCH STATS ============

/**
 * Update branch statistics
 */
export async function updateBranchStats(
  codeId: string,
  branchId: string,
  stats: { players: number; avgScore: number; topScore: number }
): Promise<void> {
  const branchStatsRef = ref(realtimeDb, `${getBranchStatsPath(codeId)}/${branchId}`);
  await set(branchStatsRef, stats);
}

// ============ RECENT COMPLETIONS ============

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
 * Trim recent completions to keep only the latest N
 */
export async function trimRecentCompletions(
  codeId: string,
  maxCount: number = 20
): Promise<void> {
  const completionsRef = ref(realtimeDb, getRecentCompletionsPath(codeId));
  const snapshot = await get(completionsRef);

  if (!snapshot.exists()) return;

  const completions = snapshot.val() as Record<string, QChallengeRecentCompletion>;
  const completionEntries = Object.entries(completions);

  if (completionEntries.length <= maxCount) return;

  // Sort by finishedAt and keep only the newest
  completionEntries.sort((a, b) => b[1].finishedAt - a[1].finishedAt);

  const toRemove = completionEntries.slice(maxCount);
  for (const [key] of toRemove) {
    const completionRef = ref(realtimeDb, `${getRecentCompletionsPath(codeId)}/${key}`);
    await remove(completionRef);
  }
}

// ============ LIVE MODE (Phase 2) ============

/**
 * Update live state for synchronized quiz
 */
export async function updateLiveState(
  codeId: string,
  liveState: {
    currentQuestionIndex: number;
    questionStartedAt: number;
    questionEndsAt: number;
    isAcceptingAnswers: boolean;
    showingResults: boolean;
  }
): Promise<void> {
  const liveStateRef = ref(realtimeDb, getLiveStatePath(codeId));
  await set(liveStateRef, liveState);
}

/**
 * Clear live state
 */
export async function clearLiveState(codeId: string): Promise<void> {
  const liveStateRef = ref(realtimeDb, getLiveStatePath(codeId));
  await remove(liveStateRef);
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to entire session data
 */
export function subscribeToQChallengeLive(
  codeId: string,
  onUpdate: (data: QChallengeLiveData | null) => void
): () => void {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() as QChallengeLiveData | null;
    onUpdate(data);
  };

  onValue(sessionRef, callback);

  // Return unsubscribe function
  return () => off(sessionRef, 'value', callback);
}

/**
 * Subscribe to stats only (lighter than full session)
 */
export function subscribeToQChallengeStats(
  codeId: string,
  onUpdate: (stats: QChallengeStats | null) => void
): () => void {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const stats = snapshot.val() as QChallengeStats | null;
    onUpdate(stats);
  };

  onValue(statsRef, callback);

  return () => off(statsRef, 'value', callback);
}

/**
 * Subscribe to leaderboard changes
 */
export function subscribeToQChallengeLeaderboard(
  codeId: string,
  onUpdate: (entries: QChallengeLeaderboardEntry[]) => void
): () => void {
  const leaderboardRef = ref(realtimeDb, getLeaderboardPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const entries = Object.values(data) as QChallengeLeaderboardEntry[];
    // Sort by rank
    entries.sort((a, b) => a.rank - b.rank);
    onUpdate(entries);
  };

  onValue(leaderboardRef, callback);

  return () => off(leaderboardRef, 'value', callback);
}

/**
 * Subscribe to branch-specific leaderboard
 */
export function subscribeToQChallengeBranchLeaderboard(
  codeId: string,
  branchId: string,
  onUpdate: (entries: QChallengeLeaderboardEntry[]) => void
): () => void {
  const branchLeaderboardRef = ref(realtimeDb, getBranchLeaderboardPath(codeId, branchId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const entries = Object.values(data) as QChallengeLeaderboardEntry[];
    // Sort by rank
    entries.sort((a, b) => a.rank - b.rank);
    onUpdate(entries);
  };

  onValue(branchLeaderboardRef, callback);

  return () => off(branchLeaderboardRef, 'value', callback);
}

/**
 * Subscribe to recent completions (for live feed)
 */
export function subscribeToQChallengeRecentCompletions(
  codeId: string,
  onUpdate: (completions: QChallengeRecentCompletion[]) => void
): () => void {
  const completionsRef = ref(realtimeDb, getRecentCompletionsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const completions = Object.values(data) as QChallengeRecentCompletion[];
    // Sort by finishedAt descending (newest first)
    completions.sort((a, b) => b.finishedAt - a.finishedAt);
    onUpdate(completions);
  };

  onValue(completionsRef, callback);

  return () => off(completionsRef, 'value', callback);
}

/**
 * Subscribe to live state (for synchronized quiz - Phase 2)
 */
export function subscribeToQChallengeLiveState(
  codeId: string,
  onUpdate: (liveState: {
    currentQuestionIndex: number;
    questionStartedAt: number;
    questionEndsAt: number;
    isAcceptingAnswers: boolean;
    showingResults: boolean;
  } | null) => void
): () => void {
  const liveStateRef = ref(realtimeDb, getLiveStatePath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    onUpdate(data);
  };

  onValue(liveStateRef, callback);

  return () => off(liveStateRef, 'value', callback);
}

// ============ ONE-TIME READS ============

/**
 * Get current session data
 */
export async function getQChallengeLive(codeId: string): Promise<QChallengeLiveData | null> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.val();
}

/**
 * Get current stats
 */
export async function getQChallengeStats(codeId: string): Promise<QChallengeStats | null> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  const snapshot = await get(statsRef);
  return snapshot.val();
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
 * Check if session exists in Realtime DB
 */
export async function qchallengeSessionExists(codeId: string): Promise<boolean> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.exists();
}
