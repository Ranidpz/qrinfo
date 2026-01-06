import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { QTreasureConfig, QTreasurePhase } from '@/types/qtreasure';
import { updateTreasureStatus, resetTreasureRealtimeSession } from '@/lib/qtreasure-realtime';
import { resetTreasureSession } from '@/lib/qtreasure';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      mediaId,
      phase,
      reset,
    }: {
      codeId: string;
      mediaId: string;
      phase: QTreasurePhase;
      reset?: boolean;
    } = body;

    // Validate required fields
    if (!codeId || !mediaId || !phase) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate phase
    const validPhases: QTreasurePhase[] = ['registration', 'playing', 'completed'];
    if (!validPhases.includes(phase)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phase' },
        { status: 400 }
      );
    }

    // Get code document
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const mediaIndex = codeData.media?.findIndex((m: { id: string }) => m.id === mediaId);

    if (mediaIndex === -1 || mediaIndex === undefined) {
      return NextResponse.json(
        { success: false, error: 'Media not found' },
        { status: 404 }
      );
    }

    // Update config
    const updatedMedia = [...codeData.media];
    const currentConfig: QTreasureConfig = updatedMedia[mediaIndex].qtreasureConfig || {};

    const updates: Partial<QTreasureConfig> = {
      currentPhase: phase,
    };

    if (phase === 'playing') {
      updates.gameStartedAt = Date.now();
    } else if (phase === 'registration') {
      updates.lastResetAt = Date.now();
    }

    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qtreasureConfig: {
        ...currentConfig,
        ...updates,
      },
    };

    await updateDoc(codeRef, { media: updatedMedia });

    // Update Realtime DB status
    try {
      await updateTreasureStatus(codeId, phase);

      // If reset requested, clear all players and scans
      if (reset) {
        await resetTreasureSession(codeId);
        await resetTreasureRealtimeSession(codeId);
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      phase,
    });
  } catch (error) {
    console.error('Error changing phase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
