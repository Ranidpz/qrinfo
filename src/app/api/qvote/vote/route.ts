import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { VoteRound } from '@/types/qvote';

// POST: Submit votes using Admin SDK
export async function POST(request: NextRequest) {
  try {
    const { codeId, voterId, candidateIds, round = 1, categoryId } = await request.json();

    if (!codeId) {
      return NextResponse.json(
        { error: 'codeId is required' },
        { status: 400 }
      );
    }

    if (!voterId) {
      return NextResponse.json(
        { error: 'voterId is required' },
        { status: 400 }
      );
    }

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: 'candidateIds array is required' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const duplicates: string[] = [];
    let votesSubmitted = 0;

    // Use a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      // PHASE 1: Read all vote documents first
      const voteRefs: { voteId: string; voteRef: FirebaseFirestore.DocumentReference; candidateId: string; exists: boolean }[] = [];

      for (const candidateId of candidateIds) {
        const voteId = `${voterId}_${candidateId}_${round}`;
        const voteRef = db.collection('codes').doc(codeId).collection('votes').doc(voteId);
        const voteSnap = await transaction.get(voteRef);
        voteRefs.push({
          voteId,
          voteRef,
          candidateId,
          exists: voteSnap.exists,
        });
      }

      // PHASE 2: Perform all writes
      for (const { voteId, voteRef, candidateId, exists } of voteRefs) {
        if (exists) {
          duplicates.push(candidateId);
          continue;
        }

        // Create vote document
        transaction.set(voteRef, {
          id: voteId,
          codeId,
          categoryId: categoryId || null,
          candidateId,
          voterId,
          round,
          createdAt: FieldValue.serverTimestamp(),
        });

        // Update candidate vote count
        const candidateRef = db.collection('codes').doc(codeId).collection('candidates').doc(candidateId);
        const voteField = round === 1 ? 'voteCount' : 'finalsVoteCount';
        transaction.update(candidateRef, {
          [voteField]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        votesSubmitted++;
      }
    });

    // Update stats (outside transaction)
    if (votesSubmitted > 0) {
      try {
        const codeDoc = await db.collection('codes').doc(codeId).get();
        if (codeDoc.exists) {
          const data = codeDoc.data();
          const qvoteMediaIndex = data?.media?.findIndex((m: { type: string }) => m.type === 'qvote');

          if (qvoteMediaIndex !== undefined && qvoteMediaIndex !== -1) {
            const currentStats = data?.media[qvoteMediaIndex]?.qvoteConfig?.stats || {
              totalCandidates: 0,
              approvedCandidates: 0,
              totalVoters: 0,
              totalVotes: 0,
              lastUpdated: new Date(),
            };

            const updatedMedia = [...(data?.media || [])];
            updatedMedia[qvoteMediaIndex] = {
              ...updatedMedia[qvoteMediaIndex],
              qvoteConfig: {
                ...updatedMedia[qvoteMediaIndex].qvoteConfig,
                stats: {
                  ...currentStats,
                  totalVotes: (currentStats.totalVotes || 0) + votesSubmitted,
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
      } catch (statsError) {
        console.error('Error updating stats:', statsError);
        // Don't fail the request if stats update fails
      }
    }

    console.log(`[QVote Vote] Voter ${voterId} submitted ${votesSubmitted} votes for code: ${codeId}`);

    return NextResponse.json({
      success: votesSubmitted > 0,
      votesSubmitted,
      duplicates,
    });
  } catch (error) {
    console.error('Q.Vote submit vote error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to submit vote', details: errorMessage },
      { status: 500 }
    );
  }
}
