import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';

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

    // Get player data first to check status
    const playerRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players').doc(playerId);
    const playerDoc = await playerRef.get();
    const playerData = playerDoc.data();

    const wasPlaying = playerData?.gameStartedAt && !playerData?.isFinished;
    const wasFinished = playerData?.isFinished === true;

    // Delete player document
    await playerRef.delete();

    // Delete player's scans
    const scansRef = adminDb.collection('codes').doc(codeId).collection('qhunt_scans');
    const scansSnapshot = await scansRef.where('playerId', '==', playerId).get();
    const batch = adminDb.batch();
    scansSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Update realtime database
    try {
      const adminRtdb = getAdminRtdb();

      // Remove from leaderboard
      const leaderboardRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard/${playerId}`);
      await leaderboardRef.remove();

      // Update stats
      const statsRef = adminRtdb.ref(`qhunt/${codeId}/stats`);
      const statsSnapshot = await statsRef.get();
      const currentStats = statsSnapshot.val();

      if (currentStats) {
        await statsRef.update({
          totalPlayers: Math.max(0, (currentStats.totalPlayers || 0) - 1),
          playersPlaying: wasPlaying ? Math.max(0, (currentStats.playersPlaying || 0) - 1) : currentStats.playersPlaying,
          playersFinished: wasFinished ? Math.max(0, (currentStats.playersFinished || 0) - 1) : currentStats.playersFinished,
          lastUpdated: Date.now(),
        });
      }
    } catch (rtdbError) {
      console.error('RTDB update error (non-fatal):', rtdbError);
      // Don't fail the whole operation if RTDB update fails
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
