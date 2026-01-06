import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntCodeType,
} from '@/types/qhunt';
import {
  updateLeaderboardEntry,
  incrementPlayersPlaying,
} from '@/lib/qhunt-realtime';
import { assignRandomCodeType } from '@/lib/qhunt';

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

    // Check if game phase allows starting
    if (config.currentPhase !== 'registration' && config.currentPhase !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'Game not in startable phase' },
        { status: 400 }
      );
    }

    // Get player
    const playerRef = doc(db, 'codes', codeId, 'qhunt_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Player not registered' },
        { status: 400 }
      );
    }

    const player = playerDoc.data() as QHuntPlayer;

    // Check if player already started
    if (player.gameStartedAt) {
      return NextResponse.json({
        success: true,
        gameStartedAt: player.gameStartedAt,
        assignedCodeType: player.assignedCodeType,
        targetCodes: config.targetCodeCount,
        gameDuration: config.gameDurationSeconds,
      });
    }

    // Get all players to balance code type assignment
    const playersRef = collection(db, 'codes', codeId, 'qhunt_players');
    const playersSnapshot = await getDocs(playersRef);
    const existingAssignments: Record<string, QHuntCodeType> = {};

    playersSnapshot.docs.forEach(doc => {
      const p = doc.data() as QHuntPlayer;
      if (p.assignedCodeType) {
        existingAssignments[p.id] = p.assignedCodeType;
      }
    });

    // Assign code type if type-based hunting is enabled
    let assignedCodeType: QHuntCodeType | undefined;
    if (config.enableTypeBasedHunting && config.availableCodeTypes.length > 0) {
      assignedCodeType = assignRandomCodeType(
        config.availableCodeTypes,
        existingAssignments
      );
    }

    const gameStartedAt = Date.now();

    // Update player
    await updateDoc(playerRef, {
      gameStartedAt,
      assignedCodeType,
    });

    // Update Realtime DB
    try {
      await incrementPlayersPlaying(codeId);

      // Find team color if in team mode
      let teamColor: string | undefined;
      if (player.teamId) {
        const team = config.teams.find(t => t.id === player.teamId);
        teamColor = team?.color;
      }

      await updateLeaderboardEntry(codeId, {
        playerId: player.id,
        playerName: player.name,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
        teamId: player.teamId,
        teamColor,
        score: 0,
        scansCount: 0,
        isFinished: false,
        rank: 0, // Will be recalculated
      });
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      gameStartedAt,
      assignedCodeType,
      targetCodes: config.targetCodeCount,
      gameDuration: config.gameDurationSeconds,
    });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
