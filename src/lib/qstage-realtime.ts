/**
 * QStage - Firebase Realtime Database helpers
 * Handles live aggregates and real-time updates for the display screen
 *
 * Why Realtime Database instead of Firestore?
 * - Sub-100ms latency (vs 1-2 seconds for Firestore onSnapshot)
 * - Optimized for high-frequency reads/writes
 * - Better for 500+ concurrent users watching the same data
 * - Perfect for live voting scenarios where every millisecond counts
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
  serverTimestamp,
} from 'firebase/database';
import {
  QStageLiveData,
  QStageVoter,
  QStageStats,
  QStagePhase,
} from '@/types/qstage';

// ============ PATHS ============

const QSTAGE_PATH = 'qstage';

function getSessionPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}`;
}

function getStatsPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}/stats`;
}

function getVotersPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}/recentVoters`;
}

function getEventsPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}/events`;
}

// ============ SESSION MANAGEMENT ============

/**
 * Initialize or reset a QStage session in Realtime Database
 */
export async function initQStageSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const initialData: QStageLiveData = {
    status: 'standby',
    stats: {
      totalVoters: 0,
      totalLikes: 0,
      totalDislikes: 0,
      likePercent: 0,
      judgeVotes: 0,
      lastUpdated: Date.now(),
    },
    recentVoters: {},
    events: {},
    lastUpdated: Date.now(),
  };

  await set(sessionRef, initialData);
}

/**
 * Update session status (phase)
 */
export async function updateQStageStatus(
  codeId: string,
  status: QStagePhase
): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const updates: Partial<QStageLiveData> = {
    status,
    lastUpdated: Date.now(),
  };

  if (status === 'countdown') {
    updates.countdownStartedAt = Date.now();
  } else if (status === 'voting') {
    updates.votingStartedAt = Date.now();
  }

  await update(sessionRef, updates);
}

/**
 * Reset session for new voting round
 */
export async function resetQStageSession(codeId: string): Promise<void> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  await update(sessionRef, {
    status: 'standby',
    countdownStartedAt: null,
    votingStartedAt: null,
    stats: {
      totalVoters: 0,
      totalLikes: 0,
      totalDislikes: 0,
      likePercent: 0,
      judgeVotes: 0,
      lastUpdated: Date.now(),
    },
    recentVoters: {},
    events: {
      successTriggered: false,
      successTriggeredAt: null,
      lastThresholdCrossed: null,
    },
    lastUpdated: Date.now(),
  });
}

// ============ VOTE AGGREGATION ============

/**
 * Add a vote and update aggregates atomically
 * This is called by the server-side aggregator
 */
export async function addVoteToLive(
  codeId: string,
  voter: QStageVoter
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  const votersRef = ref(realtimeDb, `${getVotersPath(codeId)}/${voter.visitorId}`);

  // Add voter to recent voters
  await set(votersRef, voter);

  // Update stats atomically using transaction
  await runTransaction(statsRef, (currentStats: QStageStats | null) => {
    if (!currentStats) {
      return {
        totalVoters: 1,
        totalLikes: voter.voteType === 'like' ? voter.weight : 0,
        totalDislikes: voter.voteType === 'dislike' ? voter.weight : 0,
        likePercent: voter.voteType === 'like' ? 100 : 0,
        judgeVotes: voter.isJudge ? 1 : 0,
        lastUpdated: Date.now(),
      };
    }

    const newLikes = currentStats.totalLikes + (voter.voteType === 'like' ? voter.weight : 0);
    const newDislikes = currentStats.totalDislikes + (voter.voteType === 'dislike' ? voter.weight : 0);
    const totalWeighted = newLikes + newDislikes;

    return {
      totalVoters: currentStats.totalVoters + 1,
      totalLikes: newLikes,
      totalDislikes: newDislikes,
      likePercent: totalWeighted > 0 ? Math.round((newLikes / totalWeighted) * 100) : 0,
      judgeVotes: currentStats.judgeVotes + (voter.isJudge ? 1 : 0),
      lastUpdated: Date.now(),
    };
  });
}

/**
 * Batch update stats (for server-side aggregation)
 * More efficient than individual updates
 */
export async function batchUpdateStats(
  codeId: string,
  newStats: QStageStats
): Promise<void> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  await set(statsRef, newStats);
}

/**
 * Add multiple voters at once (for batch processing)
 */
export async function batchAddVoters(
  codeId: string,
  voters: QStageVoter[],
  maxVoters: number = 100
): Promise<void> {
  const votersRef = ref(realtimeDb, getVotersPath(codeId));

  // Get current voters
  const snapshot = await get(votersRef);
  const currentVoters = snapshot.val() || {};

  // Add new voters
  const updatedVoters = { ...currentVoters };
  for (const voter of voters) {
    updatedVoters[voter.visitorId] = voter;
  }

  // Trim to max voters (keep most recent)
  const voterEntries = Object.entries(updatedVoters) as [string, QStageVoter][];
  voterEntries.sort((a, b) => b[1].votedAt - a[1].votedAt);

  const trimmedVoters: Record<string, QStageVoter> = {};
  for (let i = 0; i < Math.min(voterEntries.length, maxVoters); i++) {
    trimmedVoters[voterEntries[i][0]] = voterEntries[i][1];
  }

  await set(votersRef, trimmedVoters);
}

// ============ EVENTS ============

/**
 * Trigger success event (when threshold is crossed)
 */
export async function triggerSuccessEvent(codeId: string): Promise<void> {
  const eventsRef = ref(realtimeDb, getEventsPath(codeId));

  await update(eventsRef, {
    successTriggered: true,
    successTriggeredAt: Date.now(),
  });
}

/**
 * Record threshold crossing (for animations)
 */
export async function recordThresholdCrossing(
  codeId: string,
  threshold: number
): Promise<void> {
  const eventsRef = ref(realtimeDb, getEventsPath(codeId));

  await update(eventsRef, {
    lastThresholdCrossed: threshold,
  });
}

/**
 * Clear events (after animations are played)
 */
export async function clearEvents(codeId: string): Promise<void> {
  const eventsRef = ref(realtimeDb, getEventsPath(codeId));

  await set(eventsRef, {
    successTriggered: false,
    successTriggeredAt: null,
    lastThresholdCrossed: null,
  });
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to entire session data
 */
export function subscribeToQStageLive(
  codeId: string,
  onUpdate: (data: QStageLiveData | null) => void
): () => void {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() as QStageLiveData | null;
    onUpdate(data);
  };

  onValue(sessionRef, callback);

  // Return unsubscribe function
  return () => off(sessionRef, 'value', callback);
}

/**
 * Subscribe to stats only (lighter than full session)
 */
export function subscribeToQStageStats(
  codeId: string,
  onUpdate: (stats: QStageStats | null) => void
): () => void {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const stats = snapshot.val() as QStageStats | null;
    onUpdate(stats);
  };

  onValue(statsRef, callback);

  return () => off(statsRef, 'value', callback);
}

/**
 * Subscribe to recent voters (for grid display)
 */
export function subscribeToQStageVoters(
  codeId: string,
  onUpdate: (voters: QStageVoter[]) => void
): () => void {
  const votersRef = ref(realtimeDb, getVotersPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const data = snapshot.val() || {};
    const voters = Object.values(data) as QStageVoter[];
    // Sort by votedAt descending (newest first)
    voters.sort((a, b) => b.votedAt - a.votedAt);
    onUpdate(voters);
  };

  onValue(votersRef, callback);

  return () => off(votersRef, 'value', callback);
}

/**
 * Subscribe to events (for triggering animations)
 */
export function subscribeToQStageEvents(
  codeId: string,
  onUpdate: (events: QStageLiveData['events']) => void
): () => void {
  const eventsRef = ref(realtimeDb, getEventsPath(codeId));

  const callback = (snapshot: DataSnapshot) => {
    const events = snapshot.val() || {};
    onUpdate(events);
  };

  onValue(eventsRef, callback);

  return () => off(eventsRef, 'value', callback);
}

// ============ ONE-TIME READS ============

/**
 * Get current session data
 */
export async function getQStageLive(codeId: string): Promise<QStageLiveData | null> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.val();
}

/**
 * Get current stats
 */
export async function getQStageStats(codeId: string): Promise<QStageStats | null> {
  const statsRef = ref(realtimeDb, getStatsPath(codeId));
  const snapshot = await get(statsRef);
  return snapshot.val();
}

/**
 * Check if session exists in Realtime DB
 */
export async function qstageSessionExists(codeId: string): Promise<boolean> {
  const sessionRef = ref(realtimeDb, getSessionPath(codeId));
  const snapshot = await get(sessionRef);
  return snapshot.exists();
}
