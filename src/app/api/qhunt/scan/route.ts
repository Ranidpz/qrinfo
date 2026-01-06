import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import {
  QHuntConfig,
  QHuntPlayer,
  QHuntScan,
  QHuntScanResult,
  QHuntScanMethod,
  CODE_TYPE_CONFIG,
} from '@/types/qhunt';
import {
  updateLeaderboardEntry,
  updateStatsAfterScan,
  addRecentScan,
  trimRecentScans,
  incrementPlayersFinished,
  recalculateRanks,
  batchUpdateTeamScores,
} from '@/lib/qhunt-realtime';
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

    // Check if code exists and get config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'CODE_NOT_FOUND' } as QHuntScanResult,
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

    // Check if game is active
    if (config.currentPhase !== 'playing' && config.currentPhase !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_ACTIVE' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Get player
    const playerRef = doc(db, 'codes', codeId, 'qhunt_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
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
        await updateDoc(playerRef, {
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
    const scansRef = collection(db, 'codes', codeId, 'qhunt_scans');
    const existingScanQuery = query(
      scansRef,
      where('playerId', '==', playerId),
      where('codeValue', '==', codeValue.toLowerCase()),
      where('isValid', '==', true),
      limit(1)
    );
    const existingScanSnapshot = await getDocs(existingScanQuery);

    if (!existingScanSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'ALREADY_SCANNED', message: 'Already scanned this code' } as QHuntScanResult,
        { status: 400 }
      );
    }

    // Calculate scan duration (time since last scan or game start)
    const lastScanQuery = query(
      scansRef,
      where('playerId', '==', playerId),
      where('isValid', '==', true)
    );
    const lastScanSnapshot = await getDocs(lastScanQuery);
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
    const scanRef = doc(db, 'codes', codeId, 'qhunt_scans', scanId);
    await setDoc(scanRef, scan);

    // Calculate new score
    const newScore = player.currentScore + huntCode.points;
    const newScansCount = player.scansCount + 1;

    // Check if game complete (found all codes)
    const isGameComplete = newScansCount >= config.targetCodeCount;

    // Update player
    const playerUpdate: Partial<QHuntPlayer> = {
      currentScore: newScore,
      scansCount: newScansCount,
    };

    if (isGameComplete) {
      playerUpdate.isFinished = true;
      playerUpdate.gameEndedAt = Date.now();
    }

    await updateDoc(playerRef, playerUpdate);

    // Update Realtime DB
    try {
      // Find team color
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
        score: newScore,
        scansCount: newScansCount,
        gameTime: isGameComplete && player.gameStartedAt
          ? Date.now() - player.gameStartedAt
          : undefined,
        isFinished: isGameComplete,
        rank: 0,
      });

      await updateStatsAfterScan(codeId, newScore);
      await recalculateRanks(codeId);

      // Add to recent scans feed
      await addRecentScan(codeId, {
        id: scanId,
        playerId: player.id,
        playerName: player.name,
        avatarValue: player.avatarValue,
        codeLabel: huntCode.label,
        points: huntCode.points,
        scannedAt: Date.now(),
      });
      await trimRecentScans(codeId, 20);

      if (isGameComplete) {
        await incrementPlayersFinished(codeId);
      }

      // Update team scores if in team mode
      if (config.mode === 'teams' && config.teams.length > 0) {
        const teamScores = await calculateTeamScores(codeId, config.teams);
        await batchUpdateTeamScores(codeId, teamScores);
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      scan,
      newScore,
      isGameComplete,
    } as QHuntScanResult);
  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
