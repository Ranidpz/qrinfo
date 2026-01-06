import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  QTreasureConfig,
  QTreasurePlayer,
} from '@/types/qtreasure';
import { incrementTreasurePlayersPlaying } from '@/lib/qtreasure-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { codeId, playerId } = body;

    // Validate required fields
    if (!codeId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if code exists and get config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    // Find QTreasure media item
    const codeData = codeDoc.data();
    const qtreasureMedia = codeData.media?.find(
      (m: { type: string }) => m.type === 'qtreasure'
    );

    if (!qtreasureMedia?.qtreasureConfig) {
      return NextResponse.json(
        { success: false, error: 'QTreasure not configured' },
        { status: 400 }
      );
    }

    const config: QTreasureConfig = qtreasureMedia.qtreasureConfig;

    // Check if game is in valid phase
    if (config.currentPhase === 'completed') {
      return NextResponse.json(
        { success: false, error: 'GAME_ENDED' },
        { status: 400 }
      );
    }

    // Get player
    const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'NOT_REGISTERED' },
        { status: 400 }
      );
    }

    const player = playerDoc.data() as QTreasurePlayer;

    // Check if already started
    if (player.startedAt) {
      // Get first station for continuing
      const firstStation = config.stations.find(s => s.isActive && s.order === 1);
      return NextResponse.json({
        success: true,
        startedAt: player.startedAt,
        firstStation,
        alreadyStarted: true,
      });
    }

    // Start the hunt
    const startedAt = Date.now();
    await updateDoc(playerRef, { startedAt });

    // Update Realtime DB stats
    try {
      await incrementTreasurePlayersPlaying(codeId);
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    // Get first station
    const firstStation = config.stations.find(s => s.isActive && s.order === 1);

    return NextResponse.json({
      success: true,
      startedAt,
      firstStation,
    });
  } catch (error) {
    console.error('Error starting hunt:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
