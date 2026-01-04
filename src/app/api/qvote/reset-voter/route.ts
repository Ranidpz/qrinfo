import { NextRequest, NextResponse } from 'next/server';
import { resetVoterVotes, getQVoteConfig } from '@/lib/qvote';
import { getQRCodeByShortId } from '@/lib/db';
import type { VoteRound } from '@/types/qvote';

// POST: Reset a voter's votes (for vote change feature)
export async function POST(request: NextRequest) {
  try {
    const { shortId, voterId, round = 1 } = await request.json();

    if (!shortId) {
      return NextResponse.json(
        { error: 'shortId is required' },
        { status: 400 }
      );
    }

    if (!voterId) {
      return NextResponse.json(
        { error: 'voterId is required' },
        { status: 400 }
      );
    }

    // Look up the actual codeId
    const code = await getQRCodeByShortId(shortId);
    if (!code) {
      return NextResponse.json(
        { error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeId = code.id;

    // Get QVote config to check if vote changes are allowed
    const config = await getQVoteConfig(codeId);
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

    // Reset the voter's votes
    const result = await resetVoterVotes(codeId, voterId, round as VoteRound);

    console.log(`[QVote Reset Voter] Voter ${voterId} reset ${result.removedVotes} votes for code: ${codeId}`);

    return NextResponse.json({
      success: true,
      removedVotes: result.removedVotes,
      candidateIds: result.candidateIds,
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
