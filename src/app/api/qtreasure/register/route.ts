import { NextResponse } from 'next/server';
import {
  QTreasurePlayer,
  QTreasureRegistrationResult,
} from '@/types/qtreasure';
import { initTreasureSession, treasureSessionExists } from '@/lib/qtreasure-realtime';
import { checkRateLimit, getClientIp, validateOrigin, RATE_LIMITS } from '@/lib/rateLimit';
import {
  getTreasureCodeConfig,
  getTreasurePlayer,
  createTreasurePlayer,
} from '@/lib/qtreasure/store';
import { buildRouteSeq, resolvePlayerRoute, stationById } from '@/lib/qtreasure/route';

export async function POST(request: Request) {
  try {
    // CSRF / origin + rate limiting (venue crowds share one public IP → generous cap)
    if (!validateOrigin(request)) {
      return NextResponse.json({ success: false, error: 'INVALID_ORIGIN' }, { status: 403 });
    }
    const ip = getClientIp(request);
    if (!checkRateLimit(`qtreasure-register:${ip}`, RATE_LIMITS.CHECKIN).success) {
      return NextResponse.json({ success: false, error: 'RATE_LIMITED' }, { status: 429 });
    }

    const body = await request.json();
    const { codeId, playerId, nickname, avatarType, avatarValue, consent } = body;

    // Validate required fields
    if (!codeId || !playerId || !nickname || !avatarType || !avatarValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QTreasureRegistrationResult,
        { status: 400 }
      );
    }

    // Validate nickname length
    if (typeof nickname !== 'string' || nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { success: false, error: 'NICKNAME_INVALID' },
        { status: 400 }
      );
    }

    // Load code + Q.Treasure config
    const codeConfig = await getTreasureCodeConfig(codeId);
    if (!codeConfig) {
      return NextResponse.json(
        { success: false, error: 'QTreasure not configured' },
        { status: 400 }
      );
    }
    const { config } = codeConfig;

    // Check if registration is open
    if (config.currentPhase !== 'registration' && config.currentPhase !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'GAME_NOT_OPEN' } as QTreasureRegistrationResult,
        { status: 400 }
      );
    }

    // Idempotent: return existing player if already registered
    const existingPlayer = await getTreasurePlayer(codeId, playerId);
    if (existingPlayer) {
      const { routeSeq } = resolvePlayerRoute(existingPlayer, config);
      const firstStation = stationById(config, routeSeq[0]);
      return NextResponse.json({
        success: true,
        player: existingPlayer,
        firstStation,
      } as QTreasureRegistrationResult);
    }

    // Build this player's personal route (shuffled in perPlayer / "matrix" mode)
    const routeSeq = buildRouteSeq(config);

    // Create new player
    const newPlayer: QTreasurePlayer = {
      id: playerId,
      nickname,
      avatarType,
      avatarValue,
      consent: consent || false,
      registeredAt: Date.now(),
      currentStationIndex: 0,
      completedStations: [],
      stationTimes: {},
      totalXP: 0,
      outOfOrderScans: 0,
      routeSeq,
      routeIndex: 0,
      playCount: 1,
    };

    await createTreasurePlayer(codeId, newPlayer);

    // Initialize Realtime DB session if needed
    try {
      const sessionExists = await treasureSessionExists(codeId);
      if (!sessionExists) {
        await initTreasureSession(codeId);
      }
    } catch (rtdbError) {
      console.error('Error checking/initializing RTDB session:', rtdbError);
    }

    const firstStation = stationById(config, routeSeq[0]);

    return NextResponse.json({
      success: true,
      player: newPlayer,
      firstStation,
    } as QTreasureRegistrationResult);
  } catch (error) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
