import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import { QHuntPlayer, QHuntLeaderboardEntry, QHuntConfig } from '@/types/qhunt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codeId, playerId } = body;

    if (!codeId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Get player
    const playerRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players').doc(playerId);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    const player = playerDoc.data() as QHuntPlayer;

    // Check if already finished
    if (player.isFinished) {
      // Already finished - calculate rank from Firestore and return
      const allPlayersSnapshot = await adminDb.collection('codes').doc(codeId).collection('qhunt_players').get();
      const allPlayers = allPlayersSnapshot.docs.map(doc => doc.data() as QHuntPlayer);

      // Sort by score (desc), then by game time (asc)
      allPlayers.sort((a, b) => {
        if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
        const aTime = a.gameEndedAt && a.gameStartedAt ? a.gameEndedAt - a.gameStartedAt : Infinity;
        const bTime = b.gameEndedAt && b.gameStartedAt ? b.gameEndedAt - b.gameStartedAt : Infinity;
        return aTime - bTime;
      });

      const playerRank = allPlayers.findIndex(p => p.id === playerId) + 1;

      return NextResponse.json({
        success: true,
        gameEndedAt: player.gameEndedAt,
        finalScore: player.currentScore,
        codesFound: player.scansCount,
        rank: playerRank,
        totalPlayers: allPlayers.length,
      });
    }

    // Mark player as finished
    const gameEndedAt = Date.now();
    await playerRef.update({
      isFinished: true,
      gameEndedAt,
    });

    // Get all players to calculate rank from Firestore
    const allPlayersSnapshot = await adminDb.collection('codes').doc(codeId).collection('qhunt_players').get();
    const allPlayers = allPlayersSnapshot.docs.map(doc => {
      const data = doc.data() as QHuntPlayer;
      // For the current player, use updated values
      if (data.id === playerId) {
        return { ...data, isFinished: true, gameEndedAt };
      }
      return data;
    });

    // Sort by score (desc), then by game time (asc)
    allPlayers.sort((a, b) => {
      if (b.currentScore !== a.currentScore) return b.currentScore - a.currentScore;
      const aTime = a.gameEndedAt && a.gameStartedAt ? a.gameEndedAt - a.gameStartedAt : Infinity;
      const bTime = b.gameEndedAt && b.gameStartedAt ? b.gameEndedAt - b.gameStartedAt : Infinity;
      return aTime - bTime;
    });

    const playerRank = allPlayers.findIndex(p => p.id === playerId) + 1;

    // Update Realtime DB using Admin SDK (non-blocking)
    try {
      const adminRtdb = getAdminRtdb();

      // Get config to find team color
      const codeDoc = await adminDb.collection('codes').doc(codeId).get();
      const codeData = codeDoc.data();
      const qhuntMedia = codeData?.media?.find((m: { type: string }) => m.type === 'qhunt');
      const config: QHuntConfig | undefined = qhuntMedia?.qhuntConfig;

      let teamColor: string | undefined;
      if (player.teamId && config?.teams) {
        const team = config.teams.find((t) => t.id === player.teamId);
        teamColor = team?.color;
      }

      // Update leaderboard entry (avoid undefined values - RTDB doesn't accept them)
      const leaderboardEntry: QHuntLeaderboardEntry = {
        playerId: player.id,
        playerName: player.name,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
        score: player.currentScore,
        scansCount: player.scansCount,
        isFinished: true,
        rank: playerRank,
      };

      // Only add optional fields if they have values
      if (player.teamId) {
        leaderboardEntry.teamId = player.teamId;
      }
      if (teamColor) {
        leaderboardEntry.teamColor = teamColor;
      }
      if (player.gameStartedAt) {
        leaderboardEntry.gameTime = gameEndedAt - player.gameStartedAt;
      }

      const leaderboardEntryRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard/${player.id}`);
      await leaderboardEntryRef.set(leaderboardEntry);

      // Increment players finished using transaction
      const statsRef = adminRtdb.ref(`qhunt/${codeId}/stats`);
      await statsRef.transaction((currentStats) => {
        if (!currentStats) return currentStats;
        return {
          ...currentStats,
          playersPlaying: Math.max(0, (currentStats.playersPlaying || 0) - 1),
          playersFinished: (currentStats.playersFinished || 0) + 1,
          lastUpdated: Date.now(),
        };
      });

      // Recalculate ranks in RTDB
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
      console.error('Error updating Realtime DB:', rtdbError);
      // Continue - rank is calculated from Firestore
    }

    return NextResponse.json({
      success: true,
      gameEndedAt,
      finalScore: player.currentScore,
      codesFound: player.scansCount,
      rank: playerRank,
      totalPlayers: allPlayers.length,
    });
  } catch (error) {
    console.error('Error ending game:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
