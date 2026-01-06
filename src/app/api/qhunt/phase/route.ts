import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { QHuntConfig, QHuntPhase } from '@/types/qhunt';
import { updateQHuntStatus, initQHuntSession, qhuntSessionExists } from '@/lib/qhunt-realtime';

const VALID_PHASES: QHuntPhase[] = ['registration', 'countdown', 'playing', 'finished', 'results'];

export async function POST(request: Request) {
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

    await updateDoc(codeRef, { media: updatedMedia });

    // Update Realtime DB
    try {
      // Initialize session if doesn't exist
      const sessionExists = await qhuntSessionExists(codeId);
      if (!sessionExists) {
        await initQHuntSession(codeId);
      }

      await updateQHuntStatus(codeId, newPhase);
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
