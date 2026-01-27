import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntRegistrationResult,
} from '@/types/qhunt';

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

    // Get Admin Firestore
    const adminDb = getAdminDb();

    // Check if code exists and get config
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
    const qhuntMedia = codeData?.media?.find(
      (m: { type: string }) => m.type === 'qhunt'
    );

    if (!qhuntMedia?.qhuntConfig) {
      return NextResponse.json(
        { success: false, error: 'QHunt not configured' },
        { status: 400 }
      );
    }

    const config: QHuntConfig = qhuntMedia.qhuntConfig;

    // Check if registration/updates are allowed
    const currentPhase = config.currentPhase || 'registration';
    // Allow registration during 'registration' phase
    // Allow profile updates during 'playing' phase (for existing players)
    if (currentPhase !== 'registration' && currentPhase !== 'playing') {
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
    const playerRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players').doc(playerId);
    const existingPlayer = await playerRef.get();

    if (existingPlayer.exists) {
      const player = existingPlayer.data() as QHuntPlayer;

      // If avatar changed, update the player profile (allow during gameplay)
      if (avatarType !== player.avatarType || avatarValue !== player.avatarValue || name !== player.name) {
        const updates: Partial<QHuntPlayer> = {
          name,
          avatarType,
          avatarValue,
        };
        await playerRef.update(updates);

        // Return updated player data
        return NextResponse.json({
          success: true,
          player: { ...player, ...updates },
          assignedCodeType: player.assignedCodeType,
        } as QHuntRegistrationResult);
      }

      // Return existing player data (no changes)
      return NextResponse.json({
        success: true,
        player,
        assignedCodeType: player.assignedCodeType,
      } as QHuntRegistrationResult);
    }

    // New registrations only allowed during registration phase
    if (currentPhase !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_OPEN' } as QHuntRegistrationResult,
        { status: 400 }
      );
    }

    // Create new player
    const newPlayer: QHuntPlayer = {
      id: playerId,
      name,
      avatarType,
      avatarValue,
      registeredAt: Date.now(),
      currentScore: 0,
      scansCount: 0,
      isFinished: false,
      ...(config.mode === 'teams' && teamId ? { teamId } : {}),
    };

    await playerRef.set(newPlayer);

    return NextResponse.json({
      success: true,
      player: newPlayer,
    } as QHuntRegistrationResult);
  } catch (error) {
    console.error('Error registering player:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error details:', errorMessage);
    return NextResponse.json(
      { success: false, error: `Registration error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
