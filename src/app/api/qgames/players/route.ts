import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { removeFromLeaderboard, recalculateLeaderboardRanks } from '@/lib/qgames-realtime';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');

    if (!codeId) {
      return NextResponse.json(
        { success: false, error: 'Missing codeId' },
        { status: 400 }
      );
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const adminDb = getAdminDb();
    const playersRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players');

    const snapshot = await playersRef.orderBy('score', 'desc').get();
    const players = snapshot.docs.map(doc => doc.data());

    return NextResponse.json({ success: true, players });
  } catch (error) {
    console.error('Q.Games players GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('codeId');
    const playerId = searchParams.get('playerId');

    if (!codeId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing codeId or playerId' },
        { status: 400 }
      );
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    const adminDb = getAdminDb();

    // Delete player doc
    await adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players').doc(playerId)
      .delete();

    // Remove from RTDB leaderboard
    await removeFromLeaderboard(codeId, playerId);
    await recalculateLeaderboardRanks(codeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Q.Games players DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete player' },
      { status: 500 }
    );
  }
}
