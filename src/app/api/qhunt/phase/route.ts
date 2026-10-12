import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { QHuntConfig, QHuntPhase } from '@/types/qhunt';

const VALID_PHASES: QHuntPhase[] = ['registration', 'countdown', 'playing', 'finished', 'results'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { codeId, mediaId, newPhase } = body;

    // Validate required fields
    if (!codeId || !mediaId || !newPhase) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate phase
    if (!VALID_PHASES.includes(newPhase)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phase' },
        { status: 400 }
      );
    }

    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;

    // Check if code exists
    const codeRef = getAdminDb().collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    // Find QHunt media item
    const codeData = codeDoc.data()!;
    const mediaIndex = codeData.media?.findIndex(
      (m: { id: string }) => m.id === mediaId
    );

    if (mediaIndex === -1 || mediaIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'Media not found' },
        { status: 404 }
      );
    }

    const qhuntMedia = codeData.media[mediaIndex];
    if (!qhuntMedia.qhuntConfig) {
      return NextResponse.json(
        { success: false, error: 'QHunt not configured' },
        { status: 400 }
      );
    }

    const config: QHuntConfig = qhuntMedia.qhuntConfig;

    // Prepare updates
    const updates: Partial<QHuntConfig> = {
      currentPhase: newPhase,
    };

    // Add timestamps based on phase
    if (newPhase === 'playing') {
      updates.gameStartedAt = Date.now();
    } else if (newPhase === 'finished' || newPhase === 'results') {
      updates.gameEndedAt = Date.now();
    } else if (newPhase === 'registration') {
      updates.lastResetAt = Date.now();
    }

    // Update Firestore
    const updatedMedia = [...codeData.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qhuntConfig: {
        ...config,
        ...updates,
      },
    };

    await codeRef.update({ media: updatedMedia });

    // Update Realtime DB (Admin SDK — clients can't write qhunt/*)
    try {
      const sessionRef = getAdminRtdb().ref(`qhunt/${codeId}`);
      const now = Date.now();
      const sessionExists = (await sessionRef.once('value')).exists();
      if (!sessionExists) {
        await sessionRef.set({
          status: 'registration',
          stats: { totalPlayers: 0, playersPlaying: 0, playersFinished: 0, totalScans: 0, avgScore: 0, topScore: 0, lastUpdated: now },
          leaderboard: {},
          teamScores: {},
          recentScans: {},
          lastUpdated: now,
        });
      }

      const statusUpdate: Record<string, unknown> = { status: newPhase, lastUpdated: now };
      if (newPhase === 'countdown') statusUpdate.countdownStartedAt = now;
      else if (newPhase === 'playing') statusUpdate.gameStartedAt = now;
      await sessionRef.update(statusUpdate);
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      phase: newPhase,
    });
  } catch (error) {
    console.error('Error changing phase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
