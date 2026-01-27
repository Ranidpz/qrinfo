import { NextResponse } from 'next/server';
import { getAdminDb, getAdminRtdb } from '@/lib/firebase-admin';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntScan,
  QHuntScanResult,
  QHuntScanMethod,
  QHuntLeaderboardEntry,
  CODE_TYPE_CONFIG,
} from '@/types/qhunt';
import { calculateTeamScores } from '@/lib/qhunt';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      playerId,
      codeValue,
      scanMethod = 'qr',
    }: {
      codeId: string;
      playerId: string;
      codeValue: string;
      scanMethod?: QHuntScanMethod;
    } = body;

    // Validate required fields
    if (!codeId || !playerId || !codeValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QHuntScanResult,
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Check if code exists and get config
    const codeRef = adminDb.collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'CODE_NOT_FOUND' } as QHuntScanResult,
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

    // Check if game is active
    if (config.currentPhase !== 'playing' && config.currentPhase !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_ACTIVE' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Get player
    const playerRef = adminDb.collection('codes').doc(codeId).collection('qhunt_players').doc(playerId);
    const playerDoc = await playerRef.get();

    if (!playerDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'NOT_REGISTERED' } as QHuntScanResult,
        { status: 400 }
      );
    }

    const player = playerDoc.data() as QHuntPlayer;

    // Check if player has started
    if (!player.gameStartedAt) {
      return NextResponse.json(
        { success: false, error: 'NOT_REGISTERED', message: 'Game not started' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Check if player already finished
    if (player.isFinished) {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_ACTIVE', message: 'Already finished' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Check timer if time-limited game
    if (config.gameDurationSeconds > 0) {
      const elapsed = Date.now() - player.gameStartedAt;
      if (elapsed > config.gameDurationSeconds * 1000) {
        // Mark player as finished due to time
        await playerRef.update({
          isFinished: true,
          gameEndedAt: player.gameStartedAt + config.gameDurationSeconds * 1000,
        });

        return NextResponse.json(
          { success: false, error: 'TIME_EXPIRED', message: 'Time is up!' } as QHuntScanResult,
          { status: 400 }
        );
      }
    }

    // Find the scanned code in config
    const huntCode = config.codes.find(
      c => c.isActive && c.codeValue.toLowerCase() === codeValue.toLowerCase()
    );

    if (!huntCode) {
      return NextResponse.json(
        { success: false, error: 'CODE_NOT_FOUND', message: 'Invalid code' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Check if correct type (anti-cheat)
    if (config.enableTypeBasedHunting && player.assignedCodeType) {
      if (huntCode.codeType !== player.assignedCodeType) {
        const typeConfig = CODE_TYPE_CONFIG[player.assignedCodeType];
        const typeName = typeConfig?.name || player.assignedCodeType;

        return NextResponse.json({
          success: false,
          error: 'WRONG_TYPE',
          message: `חפשו קודים ${typeName}!`,
          correctType: player.assignedCodeType,
        } as QHuntScanResult);
      }
    }

    // Check if already scanned this code
    const scansRef = adminDb.collection('codes').doc(codeId).collection('qhunt_scans');
    const existingScanQuery = scansRef
      .where('playerId', '==', playerId)
      .where('codeValue', '==', codeValue.toLowerCase())
      .where('isValid', '==', true)
      .limit(1);
    const existingScanSnapshot = await existingScanQuery.get();

    if (!existingScanSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'ALREADY_SCANNED', message: 'Already scanned this code' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Calculate scan duration (time since last scan or game start)
    const lastScanQuery = scansRef
      .where('playerId', '==', playerId)
      .where('isValid', '==', true);
    const lastScanSnapshot = await lastScanQuery.get();
    let lastScanTime = player.gameStartedAt;
    lastScanSnapshot.docs.forEach(doc => {
      const scan = doc.data();
      if (scan.scannedAt > lastScanTime) {
        lastScanTime = scan.scannedAt;
      }
    });
    const scanDuration = Date.now() - lastScanTime;

    // Create scan record
    const scanId = `${playerId}_${huntCode.id}_${Date.now()}`;
    const scan: QHuntScan = {
      id: scanId,
      playerId,
      codeId: huntCode.id,
      codeValue: codeValue.toLowerCase(),
      points: huntCode.points,
      isValid: true,
      scanMethod,
      scannedAt: Date.now(),
      scanDuration,
    };

    // Save scan
    const scanDocRef = adminDb.collection('codes').doc(codeId).collection('qhunt_scans').doc(scanId);
    await scanDocRef.set(scan);

    // Calculate new score
    const newScore = player.currentScore + huntCode.points;
    const newScansCount = player.scansCount + 1;

    // Calculate actual target based on assigned type (if type-based hunting)
    let actualTargetCount = config.targetCodeCount;
    if (config.enableTypeBasedHunting && player.assignedCodeType) {
      // Count active codes of the player's assigned type
      actualTargetCount = config.codes.filter(
        c => c.isActive && c.codeType === player.assignedCodeType
      ).length;
    }

    // Check if game complete (found all codes of assigned type)
    const isGameComplete = newScansCount >= actualTargetCount;

    // Update player
    const playerUpdate: Partial<QHuntPlayer> = {
      currentScore: newScore,
      scansCount: newScansCount,
    };

    if (isGameComplete) {
      playerUpdate.isFinished = true;
      playerUpdate.gameEndedAt = Date.now();
    }

    await playerRef.update(playerUpdate);

    // Update Realtime DB using Admin SDK
    try {
      const adminRtdb = getAdminRtdb();

      // Find team color
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
        score: newScore,
        scansCount: newScansCount,
        isFinished: isGameComplete,
        rank: 0,
      };

      // Only add optional fields if they have values
      if (player.teamId) {
        leaderboardEntry.teamId = player.teamId;
      }
      if (teamColor) {
        leaderboardEntry.teamColor = teamColor;
      }
      if (isGameComplete && player.gameStartedAt) {
        const now = Date.now();
        leaderboardEntry.gameTime = now - player.gameStartedAt;
        leaderboardEntry.finishedAt = now;
      }

      const leaderboardEntryRef = adminRtdb.ref(`qhunt/${codeId}/leaderboard/${player.id}`);
      await leaderboardEntryRef.set(leaderboardEntry);

      // Update stats after scan
      const statsRef = adminRtdb.ref(`qhunt/${codeId}/stats`);
      await statsRef.transaction((currentStats) => {
        if (!currentStats) return currentStats;

        const updates: Record<string, unknown> = {
          ...currentStats,
          totalScans: (currentStats.totalScans || 0) + 1,
          topScore: Math.max(currentStats.topScore || 0, newScore),
          lastUpdated: Date.now(),
        };

        if (isGameComplete) {
          updates.playersPlaying = Math.max(0, (currentStats.playersPlaying || 0) - 1);
          updates.playersFinished = (currentStats.playersFinished || 0) + 1;
        }

        return updates;
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

      // Add to recent scans feed
      const recentScansRef = adminRtdb.ref(`qhunt/${codeId}/recentScans`);
      const newScanRef = recentScansRef.push();
      await newScanRef.set({
        id: scanId,
        playerId: player.id,
        playerName: player.name,
        avatarValue: player.avatarValue,
        codeLabel: huntCode.label,
        points: huntCode.points,
        scannedAt: Date.now(),
      });

      // Trim recent scans to keep only latest 20
      const recentSnapshot = await recentScansRef.get();
      if (recentSnapshot.exists()) {
        const scans = recentSnapshot.val() as Record<string, { scannedAt: number }>;
        const scanEntries = Object.entries(scans);
        if (scanEntries.length > 20) {
          scanEntries.sort((a, b) => b[1].scannedAt - a[1].scannedAt);
          const toRemove = scanEntries.slice(20);
          for (const [key] of toRemove) {
            await adminRtdb.ref(`qhunt/${codeId}/recentScans/${key}`).remove();
          }
        }
      }

      // Update team scores if in team mode
      if (config.mode === 'teams' && config.teams.length > 0) {
        const teamScores = await calculateTeamScores(codeId, config.teams);
        const teamScoresRef = adminRtdb.ref(`qhunt/${codeId}/teamScores`);
        const teamsData: Record<string, unknown> = {};
        teamScores.forEach(team => {
          teamsData[team.teamId] = team;
        });
        await teamScoresRef.set(teamsData);
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      scan,
      newScore,
      isGameComplete,
      hint: huntCode.hint,
    } as QHuntScanResult);
  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
