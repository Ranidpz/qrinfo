/**
 * QStage - Firestore operations for live voting system
 * Handles session configuration, votes, and judges
 */

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  QStageConfig,
  QStageVote,
  QStagePhase,
  QStageJudge,
  QStageStats,
  DEFAULT_QSTAGE_CONFIG,
} from '@/types/qstage';

// ============ SESSION MANAGEMENT ============

/**
 * Get QStage config from a code's media item
 */
export async function getQStageConfig(codeId: string, mediaId: string): Promise<QStageConfig | null> {
  try {
    const codeDoc = await getDoc(doc(db, 'codes', codeId));
    if (!codeDoc.exists()) return null;

    const data = codeDoc.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);

    return media?.qstageConfig || null;
  } catch (error) {
    console.error('Error getting QStage config:', error);
    return null;
  }
}

/**
 * Update QStage config in a code's media item
 */
export async function updateQStageConfig(
  codeId: string,
  mediaId: string,
  updates: Partial<QStageConfig>
): Promise<boolean> {
  try {
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);
    if (!codeDoc.exists()) return false;

    const data = codeDoc.data();
    const mediaIndex = data.media?.findIndex((m: { id: string }) => m.id === mediaId);
    if (mediaIndex === -1 || mediaIndex === undefined) return false;

    // Update the specific media item's qstageConfig
    const updatedMedia = [...data.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qstageConfig: {
        ...updatedMedia[mediaIndex].qstageConfig,
        ...updates,
      },
    };

    await updateDoc(codeRef, { media: updatedMedia });
    return true;
  } catch (error) {
    console.error('Error updating QStage config:', error);
    return false;
  }
}

/**
 * Change QStage phase
 */
export async function setQStagePhase(
  codeId: string,
  mediaId: string,
  phase: QStagePhase
): Promise<boolean> {
  const updates: Partial<QStageConfig> = { currentPhase: phase };

  // Add timestamps based on phase
  if (phase === 'voting') {
    updates.sessionStartedAt = Date.now();
  } else if (phase === 'results') {
    updates.sessionEndedAt = Date.now();
  } else if (phase === 'standby') {
    updates.lastResetAt = Date.now();
  }

  return updateQStageConfig(codeId, mediaId, updates);
}

// ============ VOTE MANAGEMENT ============

/**
 * Submit a vote (creates or updates vote document)
 */
export async function submitQStageVote(
  codeId: string,
  vote: QStageVote
): Promise<{ success: boolean; error?: string }> {
  try {
    const voteRef = doc(db, 'codes', codeId, 'qstage_votes', vote.visitorId);

    // Check if already voted
    const existingVote = await getDoc(voteRef);
    if (existingVote.exists()) {
      return { success: false, error: 'ALREADY_VOTED' };
    }

    await setDoc(voteRef, {
      ...vote,
      votedAt: Date.now(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error submitting vote:', error);
    return { success: false, error: 'SUBMIT_ERROR' };
  }
}

/**
 * Get all votes for a session
 */
export async function getQStageVotes(
  codeId: string,
  limitCount: number = 100
): Promise<QStageVote[]> {
  try {
    const votesRef = collection(db, 'codes', codeId, 'qstage_votes');
    const q = query(votesRef, orderBy('votedAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as QStageVote);
  } catch (error) {
    console.error('Error getting votes:', error);
    return [];
  }
}

/**
 * Calculate stats from votes
 */
export function calculateStats(votes: QStageVote[]): QStageStats {
  const totalVoters = votes.length;
  let totalLikes = 0;
  let totalDislikes = 0;
  let judgeVotes = 0;

  for (const vote of votes) {
    if (vote.voteType === 'like') {
      totalLikes += vote.weight;
    } else {
      totalDislikes += vote.weight;
    }
    if (vote.isJudge) {
      judgeVotes++;
    }
  }

  const totalWeightedVotes = totalLikes + totalDislikes;
  const likePercent = totalWeightedVotes > 0
    ? Math.round((totalLikes / totalWeightedVotes) * 100)
    : 0;

  return {
    totalVoters,
    totalLikes,
    totalDislikes,
    likePercent,
    judgeVotes,
    lastUpdated: Date.now(),
  };
}

/**
 * Reset all votes for a session (clear votes collection)
 */
export async function resetQStageVotes(codeId: string): Promise<boolean> {
  try {
    const votesRef = collection(db, 'codes', codeId, 'qstage_votes');
    const snapshot = await getDocs(votesRef);

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error resetting votes:', error);
    return false;
  }
}

// ============ JUDGE MANAGEMENT ============

/**
 * Generate a unique judge token
 */
export function generateJudgeToken(): string {
  return `judge_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Add a judge to the session
 */
export async function addQStageJudge(
  codeId: string,
  mediaId: string,
  judge: Omit<QStageJudge, 'accessToken' | 'hasVoted'>
): Promise<QStageJudge | null> {
  try {
    const config = await getQStageConfig(codeId, mediaId);
    if (!config) return null;

    const newJudge: QStageJudge = {
      ...judge,
      accessToken: generateJudgeToken(),
      hasVoted: false,
    };

    const updatedJudges = [...config.judges, newJudge];
    await updateQStageConfig(codeId, mediaId, {
      judges: updatedJudges,
      judgeVotingEnabled: true,
    });

    return newJudge;
  } catch (error) {
    console.error('Error adding judge:', error);
    return null;
  }
}

/**
 * Remove a judge from the session
 */
export async function removeQStageJudge(
  codeId: string,
  mediaId: string,
  judgeId: string
): Promise<boolean> {
  try {
    const config = await getQStageConfig(codeId, mediaId);
    if (!config) return false;

    const updatedJudges = config.judges.filter(j => j.id !== judgeId);
    await updateQStageConfig(codeId, mediaId, { judges: updatedJudges });

    return true;
  } catch (error) {
    console.error('Error removing judge:', error);
    return false;
  }
}

/**
 * Validate judge token and get judge info
 */
export async function validateJudgeToken(
  codeId: string,
  mediaId: string,
  token: string
): Promise<QStageJudge | null> {
  try {
    const config = await getQStageConfig(codeId, mediaId);
    if (!config) return null;

    return config.judges.find(j => j.accessToken === token) || null;
  } catch (error) {
    console.error('Error validating judge token:', error);
    return null;
  }
}

/**
 * Mark judge as voted
 */
export async function markJudgeVoted(
  codeId: string,
  mediaId: string,
  judgeId: string
): Promise<boolean> {
  try {
    const config = await getQStageConfig(codeId, mediaId);
    if (!config) return false;

    const updatedJudges = config.judges.map(j =>
      j.id === judgeId
        ? { ...j, hasVoted: true, votedAt: Date.now() }
        : j
    );

    await updateQStageConfig(codeId, mediaId, { judges: updatedJudges });
    return true;
  } catch (error) {
    console.error('Error marking judge voted:', error);
    return false;
  }
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to votes collection changes
 */
export function subscribeToQStageVotes(
  codeId: string,
  onUpdate: (votes: QStageVote[]) => void
): Unsubscribe {
  const votesRef = collection(db, 'codes', codeId, 'qstage_votes');
  const q = query(votesRef, orderBy('votedAt', 'desc'), limit(100));

  return onSnapshot(q, (snapshot) => {
    const votes = snapshot.docs.map(doc => doc.data() as QStageVote);
    onUpdate(votes);
  });
}

/**
 * Subscribe to code document changes (for config updates)
 */
export function subscribeToQStageConfig(
  codeId: string,
  mediaId: string,
  onUpdate: (config: QStageConfig | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'codes', codeId), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);
    onUpdate(media?.qstageConfig || null);
  });
}

// ============ INITIALIZATION ============

/**
 * Initialize a new QStage media item with default config
 */
export function createDefaultQStageConfig(overrides?: Partial<QStageConfig>): QStageConfig {
  return {
    ...DEFAULT_QSTAGE_CONFIG,
    ...overrides,
    stats: {
      ...DEFAULT_QSTAGE_CONFIG.stats,
      lastUpdated: Date.now(),
    },
  };
}
