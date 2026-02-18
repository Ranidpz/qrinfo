import { NextRequest, NextResponse } from 'next/server';
import { resetAllVotesAdmin, deleteAllQVoteDataAdmin, recalculateStatsAdmin } from '@/lib/qvote-admin';
import { getQRCodeByShortId } from '@/lib/db';
import { requireCodeOwner, isAuthError } from '@/lib/auth';

// POST: Reset Q.Vote data for a code
// mode: 'reset_votes' = keep candidates, clear votes + stats
// mode: 'delete_all' = delete everything (candidates + votes)
export async function POST(request: NextRequest) {
  try {
    const { codeId, shortId, confirmReset, mode = 'delete_all' } = await request.json();

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

    // Auth + ownership check
    const auth = await requireCodeOwner(request, actualCodeId);
    if (isAuthError(auth)) return auth.response;

    if (mode === 'reset_votes') {
      console.log(`[QVote Reset] User ${auth.uid} resetting votes for code: ${actualCodeId}`);
      const result = await resetAllVotesAdmin(actualCodeId);
      console.log(`[QVote Reset] Successfully reset ${result.deletedVotes} votes for code: ${actualCodeId}`);

      return NextResponse.json({
        success: true,
        message: 'All votes have been reset',
        deletedVotes: result.deletedVotes,
        codeId: actualCodeId,
      });
    } else {
      console.log(`[QVote Reset] User ${auth.uid} deleting all data for code: ${actualCodeId}`);
      await deleteAllQVoteDataAdmin(actualCodeId);
      await recalculateStatsAdmin(actualCodeId);
      console.log(`[QVote Reset] Successfully deleted all data for code: ${actualCodeId}`);

      return NextResponse.json({
        success: true,
        message: 'All Q.Vote data has been deleted',
        codeId: actualCodeId,
      });
    }
  } catch (error) {
    console.error('Q.Vote reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset Q.Vote data' },
      { status: 500 }
    );
  }
}
