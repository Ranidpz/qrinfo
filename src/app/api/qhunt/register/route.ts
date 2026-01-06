import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntRegistrationResult,
} from '@/types/qhunt';
import { initQHuntSession, qhuntSessionExists } from '@/lib/qhunt-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      playerId,
      name,
      avatarType,
      avatarValue,
      teamId,
    } = body;

    // Validate required fields
    if (!codeId || !playerId || !name || !avatarType || !avatarValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QHuntRegistrationResult,
        { status: 400 }
      );
    }

    // Validate name length
    if (name.length < 2 || name.length > 20) {
      return NextResponse.json(
        { success: false, error: 'NAME_INVALID' },
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

    // Find QHunt media item
    const codeData = codeDoc.data();
    const qhuntMedia = codeData.media?.find(
      (m: { type: string }) => m.type === 'qhunt'
    );

    if (!qhuntMedia?.qhuntConfig) {
      return NextResponse.json(
        { success: false, error: 'QHunt not configured' },
        { status: 400 }
      );
    }

    const config: QHuntConfig = qhuntMedia.qhuntConfig;

    // Check if registration is open
    if (config.currentPhase !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_OPEN' } as QHuntRegistrationResult,
        { status: 400 }
      );
    }

    // Validate team if in team mode
    if (config.mode === 'teams') {
      if (!teamId) {
        return NextResponse.json(
          { success: false, error: 'INVALID_TEAM' } as QHuntRegistrationResult,
          { status: 400 }
        );
      }

      const teamExists = config.teams.some(t => t.id === teamId);
      if (!teamExists) {
        return NextResponse.json(
          { success: false, error: 'INVALID_TEAM' } as QHuntRegistrationResult,
          { status: 400 }
        );
      }
    }

    // Check if player already registered
    const playerRef = doc(db, 'codes', codeId, 'qhunt_players', playerId);
    const existingPlayer = await getDoc(playerRef);

    if (existingPlayer.exists()) {
      // Return existing player data
      const player = existingPlayer.data() as QHuntPlayer;
      return NextResponse.json({
        success: true,
        player,
        assignedCodeType: player.assignedCodeType,
      } as QHuntRegistrationResult);
    }

    // Create new player
    const newPlayer: QHuntPlayer = {
      id: playerId,
      name,
      avatarType,
      avatarValue,
      teamId: config.mode === 'teams' ? teamId : undefined,
      registeredAt: Date.now(),
      currentScore: 0,
      scansCount: 0,
      isFinished: false,
    };

    await setDoc(playerRef, newPlayer);

    // Initialize Realtime DB session if needed
    try {
      const sessionExists = await qhuntSessionExists(codeId);
      if (!sessionExists) {
        await initQHuntSession(codeId);
      }
    } catch (rtdbError) {
      console.error('Error checking/initializing RTDB session:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      player: newPlayer,
    } as QHuntRegistrationResult);
  } catch (error) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
