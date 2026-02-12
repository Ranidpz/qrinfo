import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { VoteRound } from '@/types/qvote';

// --- Origin validation ---
function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin) return true;
  if (!host) return false;
  const allowedHosts = [host, 'localhost:3000', 'localhost:3001'];
  return allowedHosts.some(h => origin.includes(h));
}

// POST: Reset a voter's votes (for vote change feature) using Admin SDK
export async function POST(request: NextRequest) {
  try {
    // Origin validation
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Forbidden', errorCode: 'INVALID_ORIGIN' },
        { status: 403 }
      );
    }

    // Firestore-based rate limiting (survives serverless cold starts)
    const db = getAdminDb();
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    // IP rate limit: 5 resets per minute
    const ipRateLimitResult = await db.runTransaction(async (transaction) => {
      const ref = db.collection('rateLimits').doc(`reset_ip_${clientIp}`);
      const doc = await transaction.get(ref);
      const data = doc.data();
      const now = Date.now();
      if (!data || now > (data.resetAt as number)) {
        transaction.set(ref, { count: 1, resetAt: now + 60_000 });
        return { allowed: true };
      }
      if ((data.count as number) >= 5) return { allowed: false };
      transaction.update(ref, { count: FieldValue.increment(1) });
      return { allowed: true };
    });

    if (!ipRateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait.', errorCode: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    const { shortId, codeId: providedCodeId, voterId, round = 1, categoryId } = await request.json();

    if (!voterId) {
      return NextResponse.json(
        { error: 'voterId is required' },
        { status: 400 }
      );
    }

    // Voter rate limit: 3 resets per voter per 5 minutes
    const voterRateLimitResult = await db.runTransaction(async (transaction) => {
      const ref = db.collection('rateLimits').doc(`reset_voter_${voterId}`);
      const doc = await transaction.get(ref);
      const data = doc.data();
      const now = Date.now();
      if (!data || now > (data.resetAt as number)) {
        transaction.set(ref, { count: 1, resetAt: now + 5 * 60_000 });
        return { allowed: true };
      }
      if ((data.count as number) >= 3) return { allowed: false };
      transaction.update(ref, { count: FieldValue.increment(1) });
      return { allowed: true };
    });

    if (!voterRateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many vote change requests. Please wait.', errorCode: 'RATE_LIMITED' },
        { status: 429 }
      );
    }
    let codeId = providedCodeId;

    // Look up the actual codeId from shortId if not provided
    if (!codeId && shortId) {
      const codesSnapshot = await db.collection('codes').where('shortId', '==', shortId).limit(1).get();
      if (codesSnapshot.empty) {
        return NextResponse.json(
          { error: 'Code not found' },
          { status: 404 }
        );
      }
      codeId = codesSnapshot.docs[0].id;
    }

    if (!codeId) {
      return NextResponse.json(
        { error: 'codeId or shortId is required' },
        { status: 400 }
      );
    }

    // Get QVote config to check if vote changes are allowed
    const codeDoc = await db.collection('codes').doc(codeId).get();
    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const qvoteMedia = codeData?.media?.find((m: { type: string }) => m.type === 'qvote');
    const config = qvoteMedia?.qvoteConfig;

    if (!config) {
      return NextResponse.json(
        { error: 'QVote config not found' },
        { status: 404 }
      );
    }

    const maxVoteChanges = config.maxVoteChanges ?? 0;

    // If maxVoteChanges is 0, vote changes are not allowed
    if (maxVoteChanges === 0) {
      return NextResponse.json(
        { error: 'Vote changes are not allowed for this voting session' },
        { status: 403 }
      );
    }

    // Get all votes by this voter for this round (optionally filtered by category)
    let votesQuery = db.collection('codes').doc(codeId).collection('votes')
      .where('voterId', '==', voterId)
      .where('round', '==', round);

    // If categoryId is provided, only reset votes for that category
    if (categoryId) {
      votesQuery = votesQuery.where('categoryId', '==', categoryId);
    }

    const votesSnapshot = await votesQuery.get();

    if (votesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        removedVotes: 0,
        candidateIds: [],
      });
    }

    const votes = votesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        candidateId: data.candidateId as string,
        voterId: data.voterId as string,
        round: data.round as number,
      };
    });
    const candidateIds = votes.map(v => v.candidateId);

    // Use a transaction to delete votes and update candidate counts
    await db.runTransaction(async (transaction) => {
      // PHASE 1: Read all candidate documents first
      const candidateSnapshots = new Map<string, boolean>();
      for (const vote of votes) {
        const candidateId = vote.candidateId as string;
        if (!candidateSnapshots.has(candidateId)) {
          const candidateRef = db.collection('codes').doc(codeId).collection('candidates').doc(candidateId);
          const candidateSnap = await transaction.get(candidateRef);
          candidateSnapshots.set(candidateId, candidateSnap.exists);
        }
      }

      // PHASE 2: Perform all writes
      for (const vote of votes) {
        const voteRef = db.collection('codes').doc(codeId).collection('votes').doc(vote.id);
        transaction.delete(voteRef);

        const candidateId = vote.candidateId as string;
        // Only update candidate if it exists
        if (candidateSnapshots.get(candidateId)) {
          const candidateRef = db.collection('codes').doc(codeId).collection('candidates').doc(candidateId);
          const voteField = round === 1 ? 'voteCount' : 'finalsVoteCount';
          transaction.update(candidateRef, {
            [voteField]: FieldValue.increment(-1),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    // Update stats (outside transaction)
    try {
      const qvoteMediaIndex = codeData?.media?.findIndex((m: { type: string }) => m.type === 'qvote');
      if (qvoteMediaIndex !== undefined && qvoteMediaIndex !== -1) {
        const currentStats = codeData?.media[qvoteMediaIndex]?.qvoteConfig?.stats || {};

        const updatedMedia = [...(codeData?.media || [])];
        updatedMedia[qvoteMediaIndex] = {
          ...updatedMedia[qvoteMediaIndex],
          qvoteConfig: {
            ...updatedMedia[qvoteMediaIndex].qvoteConfig,
            stats: {
              ...currentStats,
              totalVotes: Math.max(0, (currentStats.totalVotes || 0) - votes.length),
              totalVoters: Math.max(0, (currentStats.totalVoters || 0) - 1),
              lastUpdated: new Date(),
            },
          },
        };

        await db.collection('codes').doc(codeId).update({
          media: updatedMedia,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (statsError) {
      console.error('Error updating stats:', statsError);
      // Don't fail the request if stats update fails
    }

    console.log(`[QVote Reset Voter] Voter ${voterId} reset ${votes.length} votes for code: ${codeId}`);

    return NextResponse.json({
      success: true,
      removedVotes: votes.length,
      candidateIds,
    });
  } catch (error) {
    console.error('Q.Vote reset voter error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to reset voter votes', details: errorMessage },
      { status: 500 }
    );
  }
}
