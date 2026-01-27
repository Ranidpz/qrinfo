import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import { QHuntConfig, QHuntPlayer, QHuntLeaderboardEntry, QHuntStats } from '@/types/qhunt';

/**
 * Sync players from Firestore to Realtime DB leaderboard
 * This is needed for players who registered before RTDB sync was added
 * Uses Admin SDK for server-side RTDB operations
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codeId } = body;

    if (!codeId) {
      return NextResponse.json(
        { success: false, error: 'Missing codeId' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Get QHunt config for team colors
    const codeRef = adminDb.collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

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

    // Get all players from Firestore
    const playersRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players');
    const playersSnapshot = await playersRef.get();

    if (playersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No players to sync',
        synced: 0,
      });
    }

    let synced = 0;
    let playersPlaying = 0;
    let playersFinished = 0;
    let topScore = 0;

    const leaderboardData: Record<string, QHuntLeaderboardEntry> = {};

    // Build leaderboard data from all players
    for (const doc of playersSnapshot.docs) {
      const player = doc.data() as QHuntPlayer;

      // Find team color if in team mode
      let teamColor: string | undefined;
      if (player.teamId) {
        const team = config.teams.find(t => t.id === player.teamId);
        teamColor = team?.color;
      }

      // Build entry without undefined values (RTDB doesn't accept undefined)
      const entry: QHuntLeaderboardEntry = {
        playerId: player.id,
        playerName: player.name,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
        score: player.currentScore,
        scansCount: player.scansCount,
        isFinished: player.isFinished,
        rank: 0, // Will be calculated below
      };

      // Only add optional fields if they have values
      if (player.teamId) {
        entry.teamId = player.teamId;
      }
      if (teamColor) {
        entry.teamColor = teamColor;
      }
      if (player.gameEndedAt && player.gameStartedAt) {
        entry.gameTime = player.gameEndedAt - player.gameStartedAt;
      }

      leaderboardData[player.id] = entry;
      synced++;

      // Track stats
      if (player.gameStartedAt && !player.isFinished) {
        playersPlaying++;
      }
      if (player.isFinished) {
        playersFinished++;
      }
      if (player.currentScore > topScore) {
        topScore = player.currentScore;
      }
    }

    // Sort and calculate ranks
    const sortedEntries = Object.values(leaderboardData).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.gameTime && b.gameTime) return a.gameTime - b.gameTime;
      return 0;
    });

    sortedEntries.forEach((entry, index) => {
      leaderboardData[entry.playerId].rank = index + 1;
    });

    // Write to RTDB using Admin SDK (wrapped in try-catch with timeout)
    try {
      const adminRtdb = getAdminRtdb();

      // Helper function to add timeout to promises
      const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`RTDB operation timed out after ${ms}ms`)), ms)
        );
        return Promise.race([promise, timeout]);
      };

      // Write leaderboard to RTDB with 10 second timeout
      const leaderboardRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard`);
      await withTimeout(leaderboardRef.set(leaderboardData), 10000);

      // Update stats in RTDB
      const statsData: QHuntStats = {
        totalPlayers: synced,
        playersPlaying,
        playersFinished,
        totalScans: 0, // Would need to be calculated from scans collection
        avgScore: 0,
        topScore,
        lastUpdated: Date.now(),
      };
      const statsRef = adminRtdb.ref(`qhunt/${codeId}/stats`);
      await withTimeout(statsRef.set(statsData), 10000);

      // Update session status
      const sessionRef = adminRtdb.ref(`qhunt/${codeId}`);
      await withTimeout(sessionRef.update({
        status: config.currentPhase || 'registration',
        lastUpdated: Date.now(),
      }), 10000);
    } catch (rtdbError) {
      console.error('Error writing to RTDB:', rtdbError);
      // Return error with helpful message about RTDB setup
      const errorMsg = rtdbError instanceof Error ? rtdbError.message : String(rtdbError);
      return NextResponse.json({
        success: false,
        error: `RTDB sync failed: ${errorMsg}. Make sure Realtime Database is created in Firebase Console.`,
        playersFound: synced,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${synced} players to leaderboard`,
      synced,
      stats: {
        totalPlayers: synced,
        playersPlaying,
        playersFinished,
        topScore,
      },
    });
  } catch (error) {
    console.error('Error syncing leaderboard:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Sync error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
