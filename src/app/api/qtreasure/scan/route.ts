import { NextResponse } from 'next/server';
import { QTreasureScan, QTreasureScanResult } from '@/types/qtreasure';
import {
  updateTreasureLeaderboardEntry,
  incrementTreasurePlayersFinished,
  recalculateTreasureRanks,
  addRecentCompletion,
  trimRecentCompletions,
} from '@/lib/qtreasure-realtime';
import { checkRateLimit, getClientIp, validateOrigin, RATE_LIMITS } from '@/lib/rateLimit';
import {
  getTreasureCodeConfig,
  getTreasurePlayer,
  updateTreasurePlayer,
  hasScannedStation,
  createTreasureScan,
} from '@/lib/qtreasure/store';
import { resolvePlayerRoute, stationById } from '@/lib/qtreasure/route';

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { success: false, error: 'INVALID_ORIGIN' } as QTreasureScanResult,
        { status: 403 }
      );
    }
    const ip = getClientIp(request);
    if (!checkRateLimit(`qtreasure-scan:${ip}`, RATE_LIMITS.CHECKIN).success) {
      return NextResponse.json(
        { success: false, error: 'RATE_LIMITED' } as QTreasureScanResult,
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      codeId,
      playerId,
      stationShortId,
    }: { codeId: string; playerId: string; stationShortId: string } = body;

    if (!codeId || !playerId || !stationShortId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Load code + Q.Treasure config
    const codeConfig = await getTreasureCodeConfig(codeId);
    if (!codeConfig) {
      return NextResponse.json(
        { success: false, error: 'CODE_NOT_FOUND' } as QTreasureScanResult,
        { status: 404 }
      );
    }
    const { config } = codeConfig;

    // Check if game is active
    if (config.currentPhase === 'completed') {
      return NextResponse.json(
        { success: false, error: 'gameNotActive' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Get player
    const player = await getTreasurePlayer(codeId, playerId);
    if (!player) {
      return NextResponse.json(
        { success: false, error: 'notRegistered' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Must have started
    if (!player.startedAt) {
      return NextResponse.json(
        { success: false, error: 'notRegistered' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Already completed
    if (player.completedAt) {
      return NextResponse.json(
        { success: false, error: 'alreadyCompleted' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Timer check for time-limited games
    if (config.timer.maxTimeSeconds > 0) {
      const elapsed = Date.now() - player.startedAt;
      if (elapsed > config.timer.maxTimeSeconds * 1000) {
        await updateTreasurePlayer(codeId, playerId, {
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
      (s) => s.isActive && s.stationShortId === stationShortId
    );
    if (!station) {
      return NextResponse.json(
        { success: false, error: 'stationNotFound' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Dedupe: already scanned this station?
    if (await hasScannedStation(codeId, playerId, station.id)) {
      return NextResponse.json(
        { success: false, error: 'alreadyCompleted' } as QTreasureScanResult,
        { status: 400 }
      );
    }

    // Order check — against this player's PERSONAL route ("the matrix").
    const perPlayer = config.routeMode === 'perPlayer';
    const { routeSeq, routeIndex } = resolvePlayerRoute(player, config);
    const expectedStationId = routeSeq[routeIndex];
    const isInOrder = station.id === expectedStationId;
    let outOfOrderMessage: string | undefined;
    let outOfOrderCount = player.outOfOrderScans;

    // perPlayer mode is always strict; fixed mode honours allowOutOfOrder.
    if (!isInOrder && (perPlayer || !config.allowOutOfOrder)) {
      const target = stationById(config, expectedStationId);
      return NextResponse.json({
        success: false,
        error: 'outOfOrder',
        expectedStationOrder: routeIndex + 1,
        nextStation: target, // let the client re-show the correct next-station hint
      } as QTreasureScanResult);
    }

    if (!isInOrder) {
      outOfOrderMessage =
        config.language === 'en' ? config.outOfOrderWarningEn : config.outOfOrderWarning;
      outOfOrderCount += 1;
    }

    // Time from previous station
    const now = Date.now();
    let timeFromPrevious: number | undefined;
    if (player.completedStations.length > 0) {
      const lastStationId = player.completedStations[player.completedStations.length - 1];
      const lastStationTime = player.stationTimes[lastStationId];
      if (lastStationTime) timeFromPrevious = now - lastStationTime;
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
    await createTreasureScan(codeId, scan);

    // Update player progress
    const completedStations = [...player.completedStations, station.id];
    const stationTimes = { ...player.stationTimes, [station.id]: now };
    const totalXP = player.totalXP + xpEarned;

    const activeStations = config.stations.filter((s) => s.isActive);
    const isComplete = completedStations.length >= activeStations.length;

    let totalTimeMs: number | undefined;
    let completedAt: number | undefined;
    let finalXP = totalXP;

    if (isComplete && player.startedAt) {
      totalTimeMs = now - player.startedAt;
      completedAt = now;
      finalXP = totalXP + config.completionBonusXP;
    }

    // Advance the player's position along their route on an in-order scan.
    const newRouteIndex = isInOrder ? routeIndex + 1 : routeIndex;

    await updateTreasurePlayer(codeId, playerId, {
      routeIndex: newRouteIndex,
      currentStationIndex: newRouteIndex, // mirror for legacy UI / leaderboard
      completedStations,
      stationTimes,
      totalXP: finalXP,
      outOfOrderScans: outOfOrderCount,
      // Persist the derived route once for legacy players (idempotent for new ones)
      ...(player.routeSeq && player.routeSeq.length ? {} : { routeSeq }),
      ...(isComplete ? { completedAt, totalTimeMs } : {}),
    });

    // Update Realtime DB on completion
    try {
      if (isComplete) {
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

    // Next station on the player's route (if not complete)
    let nextStation: typeof station | undefined;
    if (!isComplete) {
      nextStation = stationById(config, routeSeq[newRouteIndex]);
    }

    return NextResponse.json({
      success: true,
      station,
      xpEarned: isComplete ? xpEarned + config.completionBonusXP : xpEarned,
      isInOrder,
      isComplete,
      outOfOrderMessage,
      expectedStationOrder: isInOrder ? undefined : routeIndex + 1,
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
