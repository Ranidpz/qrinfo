import { NextRequest, NextResponse } from 'next/server';
import { deleteAllQVoteData, recalculateStats } from '@/lib/qvote';
import { getQRCodeByShortId } from '@/lib/db';

// POST: Reset all Q.Vote data (candidates and votes) for a code
export async function POST(request: NextRequest) {
  try {
    const { codeId, shortId, confirmReset } = await request.json();

    // Require explicit confirmation
    if (confirmReset !== 'DELETE_ALL_DATA') {
      return NextResponse.json(
        { error: 'Must confirm reset with confirmReset: "DELETE_ALL_DATA"' },
        { status: 400 }
      );
    }

    let actualCodeId = codeId;

    // If shortId provided, look up the actual codeId
    if (shortId && !codeId) {
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

    console.log(`[QVote Reset] Deleting all data for code: ${actualCodeId}`);

    // Delete all candidates and votes
    await deleteAllQVoteData(actualCodeId);

    // Recalculate stats (will be 0s)
    await recalculateStats(actualCodeId);

    console.log(`[QVote Reset] Successfully deleted all data for code: ${actualCodeId}`);

    return NextResponse.json({
      success: true,
      message: 'All Q.Vote data has been deleted',
      codeId: actualCodeId,
    });
  } catch (error) {
    console.error('Q.Vote reset error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to reset Q.Vote data', details: errorMessage },
      { status: 500 }
    );
  }
}
