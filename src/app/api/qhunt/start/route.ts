import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntCodeType,
  QHuntLeaderboardEntry,
} from '@/types/qhunt';
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

    // Check if game phase allows starting (default to 'registration' if not set)
    const currentPhase = config.currentPhase || 'registration';
    if (currentPhase !== 'registration' && currentPhase !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'Game not in startable phase' },
        { status: 400 }
      );
    }

    // Get player
    const playerRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players').doc(playerId);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
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
    const playersRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players');
    const playersSnapshot = await playersRef.get();
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

    // Update player - only include defined values
    const updateData: Record<string, unknown> = {
      gameStartedAt,
    };
    if (assignedCodeType) {
      updateData.assignedCodeType = assignedCodeType;
    }

    await playerRef.update(updateData);

    // Add player to Realtime DB leaderboard for live display using Admin SDK
    try {
      const adminRtdb = getAdminRtdb();

      // Find team color if in team mode
      let teamColor: string | undefined;
      if (player.teamId) {
        const team = config.teams.find(t => t.id === player.teamId);
        teamColor = team?.color;
      }

      // Update leaderboard entry (avoid undefined values - RTDB doesn't accept them)
      const leaderboardEntry: QHuntLeaderboardEntry = {
        playerId: player.id,
        playerName: player.name,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
        score: 0,
        scansCount: 0,
        isFinished: false,
        rank: 0,
      };

      // Only add optional fields if they have values
      if (player.teamId) {
        leaderboardEntry.teamId = player.teamId;
      }
      if (teamColor) {
        leaderboardEntry.teamColor = teamColor;
      }

      const leaderboardEntryRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard/${player.id}`);
      await leaderboardEntryRef.set(leaderboardEntry);

      // Increment players playing using transaction
      const statsRef = adminRtdb.ref(`qhunt/${codeId}/stats`);
      await statsRef.transaction((currentStats) => {
        if (!currentStats) {
          return {
            totalPlayers: 1,
            playersPlaying: 1,
            playersFinished: 0,
            totalScans: 0,
            avgScore: 0,
            topScore: 0,
            lastUpdated: Date.now(),
          };
        }
        return {
          ...currentStats,
          playersPlaying: (currentStats.playersPlaying || 0) + 1,
          lastUpdated: Date.now(),
        };
      });

      // Recalculate ranks
      const leaderboardRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard`);
      const snapshot = await leaderboardRef.get();

      if (snapshot.exists()) {
        const entries = Object.values(snapshot.val()) as QHuntLeaderboardEntry[];

        // Sort by score (desc), then by game time (asc)
        entries.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.gameTime && b.gameTime) return a.gameTime - b.gameTime;
          return 0;
        });

        // Update ranks
        const updates: Record<string, QHuntLeaderboardEntry> = {};
        entries.forEach((entry, index) => {
          updates[entry.playerId] = { ...entry, rank: index + 1 };
        });

        await leaderboardRef.set(updates);
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB on start:', rtdbError);
      // Don't fail the request, player can still play
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Start error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
