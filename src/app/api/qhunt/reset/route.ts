import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { QHuntConfig, DEFAULT_QHUNT_CONFIG } from '@/types/qhunt';
import { resetQHuntSession } from '@/lib/qhunt-realtime';

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

    // Check if code exists
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    // Find QHunt media item
    const codeData = codeDoc.data();
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

    // Reset config (keep codes, teams, branding, etc.)
    const resetConfig: Partial<QHuntConfig> = {
      currentPhase: 'registration',
      gameStartedAt: undefined,
      gameEndedAt: undefined,
      lastResetAt: Date.now(),
      stats: {
        ...DEFAULT_QHUNT_CONFIG.stats,
        lastUpdated: Date.now(),
      },
    };

    // Update Firestore config
    const updatedMedia = [...codeData.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qhuntConfig: {
        ...config,
        ...resetConfig,
      },
    };

    await updateDoc(codeRef, { media: updatedMedia });

    // Delete all players and scans from Firestore
    const batch = writeBatch(db);

    // Delete players
    const playersRef = collection(db, 'codes', codeId, 'qhunt_players');
    const playersSnapshot = await getDocs(playersRef);
    playersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete scans
    const scansRef = collection(db, 'codes', codeId, 'qhunt_scans');
    const scansSnapshot = await getDocs(scansRef);
    scansSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Reset Realtime DB
    try {
      await resetQHuntSession(codeId);
    } catch (rtdbError) {
      console.error('Error resetting Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Game reset successfully',
    });
  } catch (error) {
    console.error('Error resetting game:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
