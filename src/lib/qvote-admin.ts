// Q.Vote Admin SDK Functions (server-side only)
// These functions bypass Firestore security rules via Admin SDK.
// Used by API routes for operations on locked collections (votes, verifiedVoters, verificationCodes).

import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { QVoteStats } from '@/types/qvote';

// Helper: batch-delete all docs in a query (500-doc chunks)
async function batchDeleteQuery(query: FirebaseFirestore.Query): Promise<number> {
  const snapshot = await query.get();
  if (snapshot.empty) return 0;

  const db = getAdminDb();
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + 500);
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  return docs.length;
}

// Reset all votes (keeps candidates, clears vote counts)
export async function resetAllVotesAdmin(codeId: string): Promise<{ deletedVotes: number }> {
  const db = getAdminDb();

  // 1. Delete all votes
  const votesRef = db.collection('codes').doc(codeId).collection('votes');
  const deletedVotes = await batchDeleteQuery(votesRef);

  // 2. Reset vote counts on all candidates
  const candidatesSnapshot = await db.collection('codes').doc(codeId).collection('candidates').get();
  const candidateDocs = candidatesSnapshot.docs;

  for (let i = 0; i < candidateDocs.length; i += 500) {
    const batch = db.batch();
    const chunk = candidateDocs.slice(i, i + 500);
    chunk.forEach((doc) => {
      batch.update(doc.ref, {
        voteCount: 0,
        finalsVoteCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // 3. Reset stats in codes document
  const codeDoc = await db.collection('codes').doc(codeId).get();
  if (codeDoc.exists) {
    const data = codeDoc.data();
    const qvoteMediaIndex = data?.media?.findIndex((m: { type: string }) => m.type === 'qvote');

    if (qvoteMediaIndex !== undefined && qvoteMediaIndex !== -1) {
      const updatedMedia = [...data!.media];
      const currentStats = updatedMedia[qvoteMediaIndex].qvoteConfig?.stats || {};

      updatedMedia[qvoteMediaIndex] = {
        ...updatedMedia[qvoteMediaIndex],
        qvoteConfig: {
          ...updatedMedia[qvoteMediaIndex].qvoteConfig,
          stats: {
            ...currentStats,
            totalVoters: 0,
            totalVotes: 0,
            finalsVoters: 0,
            finalsVotes: 0,
            lastUpdated: new Date(),
          },
        },
      };

      await db.collection('codes').doc(codeId).update({
        media: updatedMedia,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  // 4. Delete verified voters for this code
  const verifiedVotersRef = db.collection('verifiedVoters').where('codeId', '==', codeId);
  await batchDeleteQuery(verifiedVotersRef);

  // 5. Delete verification codes for this code
  const verificationCodesRef = db.collection('verificationCodes').where('codeId', '==', codeId);
  await batchDeleteQuery(verificationCodesRef);

  return { deletedVotes };
}

// Delete all Q.Vote data for a code (candidates + votes + cleanup)
export async function deleteAllQVoteDataAdmin(codeId: string): Promise<void> {
  const db = getAdminDb();

  // Delete candidates
  const candidatesRef = db.collection('codes').doc(codeId).collection('candidates');
  await batchDeleteQuery(candidatesRef);

  // Delete votes
  const votesRef = db.collection('codes').doc(codeId).collection('votes');
  await batchDeleteQuery(votesRef);

  // Delete verified voters
  const verifiedVotersRef = db.collection('verifiedVoters').where('codeId', '==', codeId);
  await batchDeleteQuery(verifiedVotersRef);

  // Delete verification codes
  const verificationCodesRef = db.collection('verificationCodes').where('codeId', '==', codeId);
  await batchDeleteQuery(verificationCodesRef);
}

// Recalculate stats using Admin SDK
export async function recalculateStatsAdmin(codeId: string): Promise<QVoteStats> {
  const db = getAdminDb();

  // Count candidates
  const candidatesSnapshot = await db.collection('codes').doc(codeId).collection('candidates').get();
  const allCandidates = candidatesSnapshot.docs.map((d) => d.data());
  const approvedCandidates = allCandidates.filter((c) => c.isApproved);

  // Count votes
  const votesSnapshot = await db.collection('codes').doc(codeId).collection('votes').get();
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
  const codeDoc = await db.collection('codes').doc(codeId).get();
  if (codeDoc.exists) {
    const data = codeDoc.data();
    const qvoteMediaIndex = data?.media?.findIndex((m: { type: string }) => m.type === 'qvote');

    if (qvoteMediaIndex !== undefined && qvoteMediaIndex !== -1) {
      const updatedMedia = [...data!.media];
      updatedMedia[qvoteMediaIndex] = {
        ...updatedMedia[qvoteMediaIndex],
        qvoteConfig: {
          ...updatedMedia[qvoteMediaIndex].qvoteConfig,
          stats,
        },
      };

      await db.collection('codes').doc(codeId).update({
        media: updatedMedia,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  return stats;
}
