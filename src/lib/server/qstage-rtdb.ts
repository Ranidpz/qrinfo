/**
 * Server-only (Admin SDK) copies of the qstage-realtime.ts writers used by API routes.
 * Keep in sync with the client versions; client writes to these nodes are denied by
 * database.rules.json.
 */

import { realtimeDb, ref, set, update, runTransaction } from '@/lib/server/rtdbAdmin';

import type {
  QStageVoter,
  QStageStats,
} from '@/types/qstage';

const QSTAGE_PATH = 'qstage';

function getStatsPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}/stats`;
}

function getVotersPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}/recentVoters`;
}

function getEventsPath(codeId: string): string {
  return `${QSTAGE_PATH}/${codeId}/events`;
}

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

