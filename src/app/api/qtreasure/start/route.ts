import { NextResponse } from 'next/server';
import { incrementTreasurePlayersPlaying } from '@/lib/qtreasure-realtime';
import { checkRateLimit, getClientIp, validateOrigin, RATE_LIMITS } from '@/lib/rateLimit';
import {
  getTreasureCodeConfig,
  getTreasurePlayer,
  updateTreasurePlayer,
} from '@/lib/qtreasure/store';
import { resolvePlayerRoute, stationById } from '@/lib/qtreasure/route';

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ success: false, error: 'INVALID_ORIGIN' }, { status: 403 });
    }
    const ip = getClientIp(request);
    if (!checkRateLimit(`qtreasure-start:${ip}`, RATE_LIMITS.CHECKIN).success) {
      return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });
    }

    const body = await request.json();
    const { codeId, playerId } = body;

    if (!codeId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const codeConfig = await getTreasureCodeConfig(codeId);
    if (!codeConfig) {
      return NextResponse.json(
        { success: false, error: 'QTreasure not configured' },
        { status: 400 }
      );
    }
    const { config } = codeConfig;

    // Check if game is in valid phase
    if (config.currentPhase === 'completed') {
      return NextResponse.json({ success: false, error: 'GAME_ENDED' }, { status: 400 });
    }

    const player = await getTreasurePlayer(codeId, playerId);
    if (!player) {
      return NextResponse.json({ success: false, error: 'NOT_REGISTERED' }, { status: 400 });
    }

    // Resolve this player's next target station on their personal route
    const { routeSeq, routeIndex } = resolvePlayerRoute(player, config);
    const targetStation = stationById(config, routeSeq[routeIndex]) || stationById(config, routeSeq[0]);

    // Already started → return the continuation station
    if (player.startedAt) {
      return NextResponse.json({
        success: true,
        startedAt: player.startedAt,
        firstStation: targetStation,
        alreadyStarted: true,
      });
    }

    // Start the hunt
    const startedAt = Date.now();
    await updateTreasurePlayer(codeId, playerId, { startedAt });

    try {
      await incrementTreasurePlayersPlaying(codeId);
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({ success: true, startedAt, firstStation: targetStation });
  } catch (error) {
    console.error('Error starting hunt:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
