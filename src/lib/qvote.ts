// Q.Vote Database Functions
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp,
  runTransaction,
  writeBatch,
  limit as firestoreLimit,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  QVoteConfig,
  QVotePhase,
  Candidate,
  CandidatePhoto,
  Vote,
  VoteRound,
  QVoteStats,
  DEFAULT_QVOTE_CONFIG,
  isValidPhaseTransition,
} from '@/types/qvote';

// ============ CANDIDATE CRUD ============

// Helper to remove undefined values from an object (Firestore doesn't accept undefined)
function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// Create a new candidate
export async function createCandidate(
  codeId: string,
  candidate: Omit<Candidate, 'id' | 'codeId' | 'voteCount' | 'finalsVoteCount' | 'createdAt' | 'updatedAt'>
): Promise<Candidate> {
  // Remove undefined fields to avoid Firestore errors
  const cleanCandidate = removeUndefinedFields(candidate);

  const candidateData = {
    ...cleanCandidate,
    codeId,
    voteCount: 0,
    finalsVoteCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(db, 'codes', codeId, 'candidates'),
    candidateData
  );

  // Update stats
  await updateQVoteStats(codeId, { totalCandidates: increment(1) });

  return {
    id: docRef.id,
    codeId,
    ...cleanCandidate,
    voteCount: 0,
    finalsVoteCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Candidate;
}

// Bulk create candidates (for producer upload)
export async function bulkCreateCandidates(
  codeId: string,
  candidates: Omit<Candidate, 'id' | 'codeId' | 'voteCount' | 'finalsVoteCount' | 'createdAt' | 'updatedAt'>[]
): Promise<{ success: number; failed: number; candidates: Candidate[] }> {
  const batch = writeBatch(db);
  const createdCandidates: Candidate[] = [];
  let success = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const cleanCandidate = removeUndefinedFields(candidate);
      const docRef = doc(collection(db, 'codes', codeId, 'candidates'));
      const candidateData = {
        ...cleanCandidate,
        codeId,
        voteCount: 0,
        finalsVoteCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      batch.set(docRef, candidateData);
      createdCandidates.push({
        id: docRef.id,
        codeId,
        ...cleanCandidate,
        voteCount: 0,
        finalsVoteCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Candidate);
      success++;
    } catch {
      failed++;
    }
  }

  await batch.commit();

  // Update stats
  await updateQVoteStats(codeId, { totalCandidates: increment(success) });

  return { success, failed, candidates: createdCandidates };
}

// Get candidate by ID
export async function getCandidate(
  codeId: string,
  candidateId: string
): Promise<Candidate | null> {
  const docSnap = await getDoc(doc(db, 'codes', codeId, 'candidates', candidateId));

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    codeId: data.codeId,
    categoryId: data.categoryId,
    source: data.source,
    name: data.name,
    formData: data.formData || {},
    photos: (data.photos || []).map((p: CandidatePhoto) => ({
      ...p,
      uploadedAt: p.uploadedAt instanceof Timestamp
        ? p.uploadedAt.toDate()
        : new Date(p.uploadedAt),
    })),
    voteCount: data.voteCount || 0,
    finalsVoteCount: data.finalsVoteCount || 0,
    isApproved: data.isApproved || false,
    isFinalist: data.isFinalist || false,
    isHidden: data.isHidden || false,
    displayOrder: data.displayOrder || 0,
    visitorId: data.visitorId,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Get all candidates for a code
export async function getCandidates(
  codeId: string,
  options?: {
    categoryId?: string;
    approvedOnly?: boolean;
    finalistsOnly?: boolean;
    excludeHidden?: boolean;
    orderByVotes?: boolean;
    limit?: number;
  }
): Promise<Candidate[]> {
  let q = query(collection(db, 'codes', codeId, 'candidates'));

  // Build query constraints
  const constraints: Parameters<typeof query>[1][] = [];

  if (options?.categoryId) {
    constraints.push(where('categoryId', '==', options.categoryId));
  }
  if (options?.approvedOnly) {
    constraints.push(where('isApproved', '==', true));
  }
  if (options?.finalistsOnly) {
    constraints.push(where('isFinalist', '==', true));
  }
  if (options?.excludeHidden) {
    constraints.push(where('isHidden', '==', false));
  }

  if (constraints.length > 0) {
    q = query(collection(db, 'codes', codeId, 'candidates'), ...constraints);
  }

  const snapshot = await getDocs(q);

  let candidates = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      codeId: data.codeId,
      categoryId: data.categoryId,
      source: data.source,
      name: data.name,
      formData: data.formData || {},
      photos: (data.photos || []).map((p: CandidatePhoto) => ({
        ...p,
        uploadedAt: p.uploadedAt instanceof Timestamp
          ? p.uploadedAt.toDate()
          : new Date(p.uploadedAt),
      })),
      voteCount: data.voteCount || 0,
      finalsVoteCount: data.finalsVoteCount || 0,
      isApproved: data.isApproved || false,
      isFinalist: data.isFinalist || false,
      isHidden: data.isHidden || false,
      displayOrder: data.displayOrder || 0,
      visitorId: data.visitorId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Candidate;
  });

  // Sort by votes if requested (client-side to avoid composite index)
  if (options?.orderByVotes) {
    candidates = candidates.sort((a, b) => b.voteCount - a.voteCount);
  } else {
    candidates = candidates.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  // Apply limit
  if (options?.limit) {
    candidates = candidates.slice(0, options.limit);
  }

  return candidates;
}

// Update candidate
export async function updateCandidate(
  codeId: string,
  candidateId: string,
  updates: Partial<Pick<Candidate, 'name' | 'formData' | 'photos' | 'isApproved' | 'isFinalist' | 'isHidden' | 'displayOrder' | 'categoryId'>>
): Promise<void> {
  const wasApproved = updates.isApproved !== undefined;

  await updateDoc(doc(db, 'codes', codeId, 'candidates', candidateId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Update approved count if approval status changed
  if (wasApproved) {
    const candidate = await getCandidate(codeId, candidateId);
    if (candidate) {
      const delta = candidate.isApproved ? 1 : -1;
      await updateQVoteStats(codeId, { approvedCandidates: increment(delta) });
    }
  }
}

// Delete candidate
export async function deleteCandidate(
  codeId: string,
  candidateId: string
): Promise<void> {
  // Get candidate first to update stats
  const candidate = await getCandidate(codeId, candidateId);

  await deleteDoc(doc(db, 'codes', codeId, 'candidates', candidateId));

  // Update stats
  const statsUpdates: Record<string, ReturnType<typeof increment>> = {
    totalCandidates: increment(-1),
  };
  if (candidate?.isApproved) {
    statsUpdates.approvedCandidates = increment(-1);
  }
  await updateQVoteStats(codeId, statsUpdates);
}

// Approve/reject multiple candidates at once
export async function batchUpdateCandidateStatus(
  codeId: string,
  candidateIds: string[],
  updates: { isApproved?: boolean; isFinalist?: boolean; isHidden?: boolean }
): Promise<void> {
  const batch = writeBatch(db);

  for (const candidateId of candidateIds) {
    batch.update(doc(db, 'codes', codeId, 'candidates', candidateId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  // Update stats
  if (updates.isApproved !== undefined) {
    const delta = updates.isApproved ? candidateIds.length : -candidateIds.length;
    await updateQVoteStats(codeId, { approvedCandidates: increment(delta) });
  }
}

// ============ VOTING ============

// Check if visitor has already voted for a candidate in a round
export async function hasVoted(
  codeId: string,
  voterId: string,
  candidateId: string,
  round: VoteRound
): Promise<boolean> {
  const voteId = `${voterId}_${candidateId}_${round}`;
  const docSnap = await getDoc(doc(db, 'codes', codeId, 'votes', voteId));
  return docSnap.exists();
}

// Get all votes by a voter in a specific round
export async function getVoterVotes(
  codeId: string,
  voterId: string,
  round: VoteRound
): Promise<Vote[]> {
  const q = query(
    collection(db, 'codes', codeId, 'votes'),
    where('voterId', '==', voterId),
    where('round', '==', round)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      codeId: data.codeId,
      categoryId: data.categoryId,
      candidateId: data.candidateId,
      voterId: data.voterId,
      round: data.round,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  });
}

// Submit votes (atomic transaction)
export async function submitVotes(
  codeId: string,
  voterId: string,
  candidateIds: string[],
  round: VoteRound,
  categoryId?: string
): Promise<{
  success: boolean;
  votesSubmitted: number;
  duplicates: string[];
  xpEarned?: number;
}> {
  const duplicates: string[] = [];
  let votesSubmitted = 0;

  await runTransaction(db, async (transaction) => {
    // Check for existing votes
    for (const candidateId of candidateIds) {
      const voteId = `${voterId}_${candidateId}_${round}`;
      const voteRef = doc(db, 'codes', codeId, 'votes', voteId);
      const voteSnap = await transaction.get(voteRef);

      if (voteSnap.exists()) {
        duplicates.push(candidateId);
        continue;
      }

      // Create vote
      transaction.set(voteRef, {
        id: voteId,
        codeId,
        categoryId: categoryId || null,
        candidateId,
        voterId,
        round,
        createdAt: serverTimestamp(),
      });

      // Update candidate vote count
      const candidateRef = doc(db, 'codes', codeId, 'candidates', candidateId);
      const voteField = round === 1 ? 'voteCount' : 'finalsVoteCount';
      transaction.update(candidateRef, {
        [voteField]: increment(1),
        updatedAt: serverTimestamp(),
      });

      votesSubmitted++;
    }
  });

  // Update stats outside transaction
  if (votesSubmitted > 0) {
    const statsUpdate: Record<string, ReturnType<typeof increment>> = {
      totalVotes: increment(votesSubmitted),
    };

    // Check if this is a new voter for this round
    const existingVotes = await getVoterVotes(codeId, voterId, round);
    if (existingVotes.length === votesSubmitted) {
      // This is their first vote in this round
      if (round === 1) {
        statsUpdate.totalVoters = increment(1);
      } else {
        statsUpdate.finalsVoters = increment(1);
      }
    }

    await updateQVoteStats(codeId, statsUpdate);
  }

  return {
    success: votesSubmitted > 0,
    votesSubmitted,
    duplicates,
  };
}

// Remove a vote (for undo functionality)
export async function removeVote(
  codeId: string,
  voterId: string,
  candidateId: string,
  round: VoteRound
): Promise<boolean> {
  const voteId = `${voterId}_${candidateId}_${round}`;
  const voteRef = doc(db, 'codes', codeId, 'votes', voteId);
  const voteSnap = await getDoc(voteRef);

  if (!voteSnap.exists()) {
    return false;
  }

  await runTransaction(db, async (transaction) => {
    // Delete vote
    transaction.delete(voteRef);

    // Decrement candidate vote count
    const candidateRef = doc(db, 'codes', codeId, 'candidates', candidateId);
    const voteField = round === 1 ? 'voteCount' : 'finalsVoteCount';
    transaction.update(candidateRef, {
      [voteField]: increment(-1),
      updatedAt: serverTimestamp(),
    });
  });

  // Update stats
  await updateQVoteStats(codeId, { totalVotes: increment(-1) });

  return true;
}

// ============ PHASE MANAGEMENT ============

// Get current QVote config from a code's media
export async function getQVoteConfig(codeId: string): Promise<QVoteConfig | null> {
  const codeDoc = await getDoc(doc(db, 'codes', codeId));
  if (!codeDoc.exists()) return null;

  const data = codeDoc.data();
  const qvoteMedia = data.media?.find((m: { type: string }) => m.type === 'qvote');

  if (!qvoteMedia?.qvoteConfig) return null;

  return qvoteMedia.qvoteConfig;
}

// Update QVote config
export async function updateQVoteConfig(
  codeId: string,
  mediaId: string,
  config: Partial<QVoteConfig>
): Promise<void> {
  const codeDoc = await getDoc(doc(db, 'codes', codeId));
  if (!codeDoc.exists()) throw new Error('Code not found');

  const data = codeDoc.data();
  const mediaIndex = data.media?.findIndex((m: { id: string }) => m.id === mediaId);

  if (mediaIndex === -1) throw new Error('Media not found');

  const updatedMedia = [...data.media];
  updatedMedia[mediaIndex] = {
    ...updatedMedia[mediaIndex],
    qvoteConfig: {
      ...updatedMedia[mediaIndex].qvoteConfig,
      ...config,
    },
  };

  await updateDoc(doc(db, 'codes', codeId), {
    media: updatedMedia,
    updatedAt: serverTimestamp(),
  });
}

// Transition to a new phase
export async function transitionPhase(
  codeId: string,
  mediaId: string,
  newPhase: QVotePhase,
  finalistIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  const config = await getQVoteConfig(codeId);
  if (!config) {
    return { success: false, error: 'Q.Vote config not found' };
  }

  // Validate transition
  if (!isValidPhaseTransition(config.currentPhase, newPhase, config.enableFinals)) {
    return {
      success: false,
      error: `Invalid transition from ${config.currentPhase} to ${newPhase}`,
    };
  }

  // If transitioning to finals, mark finalists
  if (newPhase === 'finals' && finalistIds && finalistIds.length > 0) {
    await batchUpdateCandidateStatus(codeId, finalistIds, { isFinalist: true });
  }

  // Update phase
  await updateQVoteConfig(codeId, mediaId, { currentPhase: newPhase });

  return { success: true };
}

// ============ STATISTICS ============

// Update QVote stats (in the qvoteConfig.stats field)
async function updateQVoteStats(
  codeId: string,
  updates: Partial<Record<keyof QVoteStats, ReturnType<typeof increment>>>
): Promise<void> {
  const codeDoc = await getDoc(doc(db, 'codes', codeId));
  if (!codeDoc.exists()) return;

  const data = codeDoc.data();
  const qvoteMediaIndex = data.media?.findIndex((m: { type: string }) => m.type === 'qvote');

  if (qvoteMediaIndex === -1) return;

  const currentStats = data.media[qvoteMediaIndex].qvoteConfig?.stats || {
    totalCandidates: 0,
    approvedCandidates: 0,
    totalVoters: 0,
    totalVotes: 0,
    lastUpdated: new Date(),
  };

  // Apply increments manually (Firestore increment doesn't work on nested fields easily)
  const newStats = { ...currentStats };
  for (const [key, value] of Object.entries(updates)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incValue = (value as any)._operand || 0;
    newStats[key as keyof QVoteStats] = (currentStats[key as keyof QVoteStats] || 0) + incValue;
  }
  newStats.lastUpdated = new Date();

  const updatedMedia = [...data.media];
  updatedMedia[qvoteMediaIndex] = {
    ...updatedMedia[qvoteMediaIndex],
    qvoteConfig: {
      ...updatedMedia[qvoteMediaIndex].qvoteConfig,
      stats: newStats,
    },
  };

  await updateDoc(doc(db, 'codes', codeId), {
    media: updatedMedia,
    updatedAt: serverTimestamp(),
  });
}

// Recalculate all stats (for recovery/sync)
export async function recalculateStats(codeId: string): Promise<QVoteStats> {
  // Count candidates
  const allCandidates = await getCandidates(codeId);
  const approvedCandidates = allCandidates.filter((c) => c.isApproved);

  // Count votes
  const votesQuery = query(collection(db, 'codes', codeId, 'votes'));
  const votesSnapshot = await getDocs(votesQuery);
  const votes = votesSnapshot.docs.map((d) => d.data());

  const uniqueVoters = new Set(votes.filter((v) => v.round === 1).map((v) => v.voterId));
  const uniqueFinalsVoters = new Set(votes.filter((v) => v.round === 2).map((v) => v.voterId));

  const stats: QVoteStats = {
    totalCandidates: allCandidates.length,
    approvedCandidates: approvedCandidates.length,
    totalVoters: uniqueVoters.size,
    totalVotes: votes.filter((v) => v.round === 1).length,
    finalsVoters: uniqueFinalsVoters.size,
    finalsVotes: votes.filter((v) => v.round === 2).length,
    lastUpdated: new Date(),
  };

  // Update in config
  const codeDoc = await getDoc(doc(db, 'codes', codeId));
  if (codeDoc.exists()) {
    const data = codeDoc.data();
    const qvoteMediaIndex = data.media?.findIndex((m: { type: string }) => m.type === 'qvote');

    if (qvoteMediaIndex !== -1) {
      const updatedMedia = [...data.media];
      updatedMedia[qvoteMediaIndex] = {
        ...updatedMedia[qvoteMediaIndex],
        qvoteConfig: {
          ...updatedMedia[qvoteMediaIndex].qvoteConfig,
          stats,
        },
      };

      await updateDoc(doc(db, 'codes', codeId), {
        media: updatedMedia,
        updatedAt: serverTimestamp(),
      });
    }
  }

  return stats;
}

// ============ RESULTS / LEADERBOARD ============

// Get candidates sorted by vote count (for results)
export async function getResults(
  codeId: string,
  options?: {
    categoryId?: string;
    finalsOnly?: boolean;
    limit?: number;
  }
): Promise<Candidate[]> {
  let candidates = await getCandidates(codeId, {
    categoryId: options?.categoryId,
    approvedOnly: true,
    finalistsOnly: options?.finalsOnly,
    excludeHidden: true,
  });

  // Sort by appropriate vote count
  const voteField = options?.finalsOnly ? 'finalsVoteCount' : 'voteCount';
  candidates = candidates.sort((a, b) => b[voteField] - a[voteField]);

  if (options?.limit) {
    candidates = candidates.slice(0, options.limit);
  }

  return candidates;
}

// Get top N candidates (for finalist selection)
export async function getTopCandidates(
  codeId: string,
  count: number,
  categoryId?: string
): Promise<Candidate[]> {
  return getResults(codeId, {
    categoryId,
    limit: count,
  });
}

// ============ EXPORT ============

// Export all data for a Q.Vote session
export async function exportQVoteData(codeId: string): Promise<{
  candidates: Candidate[];
  totalVotes: number;
  voterCount: number;
}> {
  const candidates = await getCandidates(codeId);

  // Get vote counts
  const votesQuery = query(
    collection(db, 'codes', codeId, 'votes'),
    where('round', '==', 1)
  );
  const votesSnapshot = await getDocs(votesQuery);
  const uniqueVoters = new Set(votesSnapshot.docs.map((d) => d.data().voterId));

  return {
    candidates,
    totalVotes: votesSnapshot.size,
    voterCount: uniqueVoters.size,
  };
}

// ============ GAMIFICATION INTEGRATION ============

// Award XP for voting (integrates with existing XP system)
export async function awardVoteXP(
  visitorId: string,
  routeId: string | null,
  xpAmount: number
): Promise<void> {
  if (!routeId || xpAmount <= 0) return;

  // Use the existing XP functions from db.ts
  const { updateVisitorProgress, getVisitorProgress } = await import('./db');

  const progress = await getVisitorProgress(visitorId, routeId);
  const currentXP = progress?.xp || 0;

  await updateVisitorProgress(visitorId, routeId, {
    xp: currentXP + xpAmount,
  });

  // Update visitor's total XP
  await updateDoc(doc(db, 'visitors', visitorId), {
    totalXP: increment(xpAmount),
    updatedAt: serverTimestamp(),
  });
}

// ============ CLEANUP ============

// Delete all Q.Vote data for a code (candidates + votes)
export async function deleteAllQVoteData(codeId: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete candidates
  const candidatesSnapshot = await getDocs(
    collection(db, 'codes', codeId, 'candidates')
  );
  candidatesSnapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  // Delete votes
  const votesSnapshot = await getDocs(
    collection(db, 'codes', codeId, 'votes')
  );
  votesSnapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
}
