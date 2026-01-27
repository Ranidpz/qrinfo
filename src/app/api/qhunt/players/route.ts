import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { removeFromLeaderboard } from '@/lib/qhunt-realtime';

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

    const adminDb = getAdminDb();

    // Get all players for this code
    const playersRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players');
    const playersSnapshot = await playersRef.get();

    const players = playersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      players,
      count: players.length,
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}

// DELETE a single player
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

    const adminDb = getAdminDb();

    // Delete player document
    const playerRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players').doc(playerId);
    await playerRef.delete();

    // Delete player's scans
    const scansRef = adminDb.collection('codes').doc(codeId).collection('qhunt_scans');
    const scansSnapshot = await scansRef.where('playerId', '==', playerId).get();
    const batch = adminDb.batch();
    scansSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Remove from realtime leaderboard
    try {
      await removeFromLeaderboard(codeId, playerId);
    } catch {
      // Ignore realtime errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
