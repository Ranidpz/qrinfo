import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import { QHuntConfig, DEFAULT_QHUNT_CONFIG } from '@/types/qhunt';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { codeId, mediaId } = body;

    // Validate required fields
    if (!codeId || !mediaId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get Admin Firestore
    const adminDb = getAdminDb();

    // Check if code exists
    const codeRef = adminDb.collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    // Find QHunt media item
    const codeData = codeDoc.data();
    const mediaIndex = codeData?.media?.findIndex(
      (m: { id: string }) => m.id === mediaId
    );

    if (mediaIndex === -1 || mediaIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'Media not found' },
        { status: 404 }
      );
    }

    const qhuntMedia = codeData!.media[mediaIndex];
    if (!qhuntMedia.qhuntConfig) {
      return NextResponse.json(
        { success: false, error: 'QHunt not configured' },
        { status: 400 }
      );
    }

    const config: QHuntConfig = qhuntMedia.qhuntConfig;

    // Build reset config - remove game timing fields, reset phase and stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resetQHuntConfig: any = {
      ...config,
      currentPhase: 'registration',
      lastResetAt: Date.now(),
      stats: {
        ...DEFAULT_QHUNT_CONFIG.stats,
        lastUpdated: Date.now(),
      },
    };

    // Remove game timing fields (don't use undefined, just delete them)
    delete resetQHuntConfig.gameStartedAt;
    delete resetQHuntConfig.gameEndedAt;

    // Update Firestore config
    const updatedMedia = [...codeData!.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qhuntConfig: resetQHuntConfig,
    };

    await codeRef.update({ media: updatedMedia });

    // Delete all players and scans from Firestore using Admin SDK
    const batch = adminDb.batch();

    // Delete players
    const playersRef = codeRef.collection('qhunt_players');
    const playersSnapshot = await playersRef.get();
    playersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete scans
    const scansRef = codeRef.collection('qhunt_scans');
    const scansSnapshot = await scansRef.get();
    scansSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Reset Realtime DB using Admin SDK
    try {
      const adminRtdb = getAdminRtdb();
      const sessionRef = adminRtdb.ref(`qhunt/${codeId}`);
      await sessionRef.update({
        status: 'registration',
        countdownStartedAt: null,
        gameStartedAt: null,
        stats: {
          totalPlayers: 0,
          playersPlaying: 0,
          playersFinished: 0,
          totalScans: 0,
          avgScore: 0,
          topScore: 0,
          lastUpdated: Date.now(),
        },
        leaderboard: null,
        teamScores: null,
        recentScans: null,
        lastUpdated: Date.now(),
      });
    } catch (rtdbError) {
      console.error('Error resetting Realtime DB:', rtdbError);
      // Don't fail the entire reset if RTDB fails
    }

    return NextResponse.json({
      success: true,
      message: 'Game reset successfully',
    });
  } catch (error) {
    console.error('Error resetting game:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { success: false, error: `Reset error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
