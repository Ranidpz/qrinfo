import { NextRequest, NextResponse } from 'next/server';
import { submitVotes } from '@/lib/qvote';
import { getQRCodeByShortId } from '@/lib/db';
import type { VoteRound } from '@/types/qvote';

// POST: Submit votes
export async function POST(request: NextRequest) {
  try {
    const { shortId, codeId, voterId, candidateIds, round = 1, categoryId } = await request.json();

    // Get codeId from shortId if not provided directly
    let actualCodeId = codeId;
    if (!actualCodeId && shortId) {
      const code = await getQRCodeByShortId(shortId);
      if (!code) {
        return NextResponse.json(
          { error: 'Code not found' },
          { status: 404 }
        );
      }
      actualCodeId = code.id;
    }

    if (!actualCodeId) {
      return NextResponse.json(
        { error: 'codeId or shortId is required' },
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

    // Submit the votes
    const result = await submitVotes(
      actualCodeId,
      voterId,
      candidateIds,
      round as VoteRound,
      categoryId
    );

    console.log(`[QVote Vote] Voter ${voterId} submitted ${result.votesSubmitted} votes for code: ${actualCodeId}`);

    return NextResponse.json({
      success: result.success,
      votesSubmitted: result.votesSubmitted,
      duplicates: result.duplicates,
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
