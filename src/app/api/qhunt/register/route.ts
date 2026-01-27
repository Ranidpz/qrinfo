import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntRegistrationResult,
  QHuntLeaderboardEntry,
  QHuntStats,
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

        // Sync profile changes to Realtime DB leaderboard using Admin SDK
        try {
          const adminRtdb = getAdminRtdb();
          const leaderboardEntryRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard/${player.id}`);
          await leaderboardEntryRef.update({
            playerName: name,
            avatarType,
            avatarValue,
          });
        } catch (rtdbError) {
          console.error('Error updating Realtime DB on profile update:', rtdbError);
        }

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

    // Add player to Realtime DB leaderboard immediately for live display
    try {
      const adminRtdb = getAdminRtdb();

      // Find team color if in team mode
      let teamColor: string | undefined;
      if (teamId) {
        const team = config.teams.find(t => t.id === teamId);
        teamColor = team?.color;
      }

      // Add to leaderboard (avoid undefined values - RTDB doesn't accept them)
      const leaderboardEntry: QHuntLeaderboardEntry = {
        playerId: newPlayer.id,
        playerName: newPlayer.name,
        avatarType: newPlayer.avatarType,
        avatarValue: newPlayer.avatarValue,
        score: 0,
        scansCount: 0,
        isFinished: false,
        rank: 0,
      };

      // Only add optional fields if they have values
      if (newPlayer.teamId) {
        leaderboardEntry.teamId = newPlayer.teamId;
      }
      if (teamColor) {
        leaderboardEntry.teamColor = teamColor;
      }

      const leaderboardEntryRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard/${newPlayer.id}`);
      await leaderboardEntryRef.set(leaderboardEntry);

      // Increment total players using transaction
      const statsRef = adminRtdb.ref(`qhunt/${codeId}/stats`);
      await statsRef.transaction((currentStats: QHuntStats | null) => {
        if (!currentStats) {
          return {
            totalPlayers: 1,
            playersPlaying: 0,
            playersFinished: 0,
            totalScans: 0,
            avgScore: 0,
            topScore: 0,
            lastUpdated: Date.now(),
          };
        }
        return {
          ...currentStats,
          totalPlayers: (currentStats.totalPlayers || 0) + 1,
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
      console.error('Error updating Realtime DB on register:', rtdbError);
      // Don't fail the request, player is registered in Firestore
    }

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
