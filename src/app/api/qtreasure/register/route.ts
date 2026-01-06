import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  QTreasureConfig,
  QTreasurePlayer,
  QTreasureRegistrationResult,
} from '@/types/qtreasure';
import { initTreasureSession, treasureSessionExists } from '@/lib/qtreasure-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      playerId,
      nickname,
      avatarType,
      avatarValue,
      consent,
    } = body;

    // Validate required fields
    if (!codeId || !playerId || !nickname || !avatarType || !avatarValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QTreasureRegistrationResult,
        { status: 400 }
      );
    }

    // Validate nickname length
    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { success: false, error: 'NICKNAME_INVALID' },
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

    // Check if registration is open
    if (config.currentPhase !== 'registration' && config.currentPhase !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_OPEN' } as QTreasureRegistrationResult,
        { status: 400 }
      );
    }

    // Check if player already registered
    const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', playerId);
    const existingPlayer = await getDoc(playerRef);

    if (existingPlayer.exists()) {
      // Return existing player data with first station
      const player = existingPlayer.data() as QTreasurePlayer;
      const firstStation = config.stations.find(s => s.isActive && s.order === 1);
      return NextResponse.json({
        success: true,
        player,
        firstStation,
      } as QTreasureRegistrationResult);
    }

    // Create new player
    const newPlayer: QTreasurePlayer = {
      id: playerId,
      nickname,
      avatarType,
      avatarValue,
      consent: consent || false,
      registeredAt: Date.now(),
      currentStationIndex: 0,
      completedStations: [],
      stationTimes: {},
      totalXP: 0,
      outOfOrderScans: 0,
    };

    await setDoc(playerRef, newPlayer);

    // Initialize Realtime DB session if needed
    try {
      const sessionExists = await treasureSessionExists(codeId);
      if (!sessionExists) {
        await initTreasureSession(codeId);
      }
    } catch (rtdbError) {
      console.error('Error checking/initializing RTDB session:', rtdbError);
    }

    // Get first station
    const firstStation = config.stations.find(s => s.isActive && s.order === 1);

    return NextResponse.json({
      success: true,
      player: newPlayer,
      firstStation,
    } as QTreasureRegistrationResult);
  } catch (error) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
