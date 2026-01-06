import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import {
  QTreasureConfig,
  QTreasurePlayer,
  QTreasureScan,
  QTreasureScanResult,
} from '@/types/qtreasure';
import {
  updateTreasureLeaderboardEntry,
  incrementTreasurePlayersFinished,
  recalculateTreasureRanks,
  addRecentCompletion,
  trimRecentCompletions,
} from '@/lib/qtreasure-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      playerId,
      stationShortId,
    }: {
      codeId: string;
      playerId: string;
      stationShortId: string;
    } = body;

    // Validate required fields
    if (!codeId || !playerId || !stationShortId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Check if code exists and get config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'CODE_NOT_FOUND' } as QTreasureScanResult,
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

    // Check if game is active
    if (config.currentPhase === 'completed') {
      return NextResponse.json(
        { success: false, error: 'gameNotActive' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Get player
    const playerRef = doc(db, 'codes', codeId, 'qtreasure_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'notRegistered' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    const player = playerDoc.data() as QTreasurePlayer;

    // Check if player has started
    if (!player.startedAt) {
      return NextResponse.json(
        { success: false, error: 'notRegistered' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Check if player already completed
    if (player.completedAt) {
      return NextResponse.json(
        { success: false, error: 'alreadyCompleted' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Check timer if time-limited game
    if (config.timer.maxTimeSeconds > 0) {
      const elapsed = Date.now() - player.startedAt;
      if (elapsed > config.timer.maxTimeSeconds * 1000) {
        // Mark player as timed out
        await updateDoc(playerRef, {
          completedAt: player.startedAt + config.timer.maxTimeSeconds * 1000,
          totalTimeMs: config.timer.maxTimeSeconds * 1000,
        });

        return NextResponse.json(
          { success: false, error: 'TIME_EXPIRED' } as QTreasureScanResult,
          { status: 400 }
        );
      }
    }

    // Find the scanned station in config
    const station = config.stations.find(
      s => s.isActive && s.stationShortId === stationShortId
    );

    if (!station) {
      return NextResponse.json(
        { success: false, error: 'stationNotFound' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Check if already scanned this station
    const scansRef = collection(db, 'codes', codeId, 'qtreasure_scans');
    const existingScanQuery = query(
      scansRef,
      where('playerId', '==', playerId),
      where('stationId', '==', station.id),
      limit(1)
    );
    const existingScanSnapshot = await getDocs(existingScanQuery);

    if (!existingScanSnapshot.empty) {
      return NextResponse.json(
        { success: false, error: 'alreadyCompleted' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Check order
    const expectedOrder = player.currentStationIndex + 1;
    const isInOrder = station.order === expectedOrder;
    let outOfOrderMessage: string | undefined;
    let outOfOrderCount = player.outOfOrderScans;

    if (!isInOrder && !config.allowOutOfOrder) {
      return NextResponse.json({
        success: false,
        error: 'outOfOrder',
        expectedStationOrder: expectedOrder,
      } as QTreasureScanResult);
    }

    if (!isInOrder) {
      outOfOrderMessage = config.language === 'en'
        ? config.outOfOrderWarningEn
        : config.outOfOrderWarning;
      outOfOrderCount += 1;
    }

    // Calculate time from previous station
    const now = Date.now();
    let timeFromPrevious: number | undefined;

    if (player.completedStations.length > 0) {
      const lastStationId = player.completedStations[player.completedStations.length - 1];
      const lastStationTime = player.stationTimes[lastStationId];
      if (lastStationTime) {
        timeFromPrevious = now - lastStationTime;
      }
    } else if (player.startedAt) {
      timeFromPrevious = now - player.startedAt;
    }

    // Create scan record
    const scanId = `${playerId}_${station.id}_${now}`;
    const xpEarned = station.xpReward || config.xpPerStation;

    const scan: QTreasureScan = {
      id: scanId,
      playerId,
      stationId: station.id,
      stationOrder: station.order,
      isInOrder,
      xpEarned,
      scannedAt: now,
      timeFromPrevious,
    };

    // Save scan
    const scanRef = doc(db, 'codes', codeId, 'qtreasure_scans', scanId);
    await setDoc(scanRef, scan);

    // Update player progress
    const completedStations = [...player.completedStations, station.id];
    const stationTimes = { ...player.stationTimes, [station.id]: now };
    const totalXP = player.totalXP + xpEarned;

    // Check if hunt is complete
    const activeStations = config.stations.filter(s => s.isActive);
    const isComplete = completedStations.length >= activeStations.length;

    let totalTimeMs: number | undefined;
    let completedAt: number | undefined;
    let finalXP = totalXP;

    if (isComplete && player.startedAt) {
      totalTimeMs = now - player.startedAt;
      completedAt = now;
      finalXP = totalXP + config.completionBonusXP;
    }

    // Update player
    await updateDoc(playerRef, {
      currentStationIndex: isInOrder ? station.order : player.currentStationIndex,
      completedStations,
      stationTimes,
      totalXP: finalXP,
      outOfOrderScans: outOfOrderCount,
      ...(isComplete ? { completedAt, totalTimeMs } : {}),
    });

    // Update Realtime DB
    try {
      if (isComplete) {
        // Add to leaderboard
        await updateTreasureLeaderboardEntry(codeId, {
          playerId: player.id,
          playerName: player.nickname,
          avatarType: player.avatarType,
          avatarValue: player.avatarValue,
          completionTimeMs: totalTimeMs!,
          stationsCompleted: completedStations.length,
          totalXP: finalXP,
          completedAt: completedAt!,
          rank: 0,
        });

        await incrementTreasurePlayersFinished(codeId, totalTimeMs!);
        await recalculateTreasureRanks(codeId);

        // Add to recent completions feed
        await addRecentCompletion(codeId, {
          id: `completion_${now}`,
          playerId: player.id,
          playerName: player.nickname,
          avatarType: player.avatarType,
          avatarValue: player.avatarValue,
          completionTimeMs: totalTimeMs!,
          completedAt: completedAt!,
        });
        await trimRecentCompletions(codeId, 10);
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    // Get next station hint (if not complete)
    let nextStation: typeof station | undefined;
    if (!isComplete) {
      const nextOrder = isInOrder ? station.order + 1 : expectedOrder;
      nextStation = config.stations.find(s => s.isActive && s.order === nextOrder);
    }

    return NextResponse.json({
      success: true,
      station,
      xpEarned: isComplete ? xpEarned + config.completionBonusXP : xpEarned,
      isInOrder,
      isComplete,
      outOfOrderMessage,
      expectedStationOrder: isInOrder ? undefined : expectedOrder,
      timeFromPrevious,
      totalTimeMs,
      nextStation,
    } as QTreasureScanResult);
  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
