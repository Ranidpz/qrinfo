import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { QGamesPlayer } from '@/types/qgames';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Rate limit: 30 registrations per minute per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`qgames-register:${ip}`, RATE_LIMITS.API);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { codeId, playerId, nickname, avatarType, avatarValue } = body;

    // Validate required fields
    if (!codeId || !playerId || !nickname || !avatarType || !avatarValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate field types and lengths
    if (typeof codeId !== 'string' || codeId.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid codeId' },
        { status: 400 }
      );
    }
    if (typeof playerId !== 'string' || playerId.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Invalid playerId' },
        { status: 400 }
      );
    }

    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Nickname must be 2-20 characters' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();

    // Get code and validate config
    const codeDoc = await adminDb.collection('codes').doc(codeId).get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const gamesMedia = codeData?.media?.find(
      (m: { type: string }) => m.type === 'minigames'
    );

    if (!gamesMedia?.qgamesConfig) {
      return NextResponse.json(
        { success: false, error: 'Q.Games not configured' },
        { status: 400 }
      );
    }

    const config = gamesMedia.qgamesConfig;

    if (config.phase !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Games are not active' },
        { status: 400 }
      );
    }

    // Check if player already exists
    const playerRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players').doc(playerId);
    const playerDoc = await playerRef.get();

    if (playerDoc.exists) {
      // Player already registered - update nickname/avatar and return
      const existingPlayer = playerDoc.data() as QGamesPlayer;
      await playerRef.update({
        nickname,
        avatarType,
        avatarValue,
        lastPlayedAt: Date.now(),
      });

      return NextResponse.json({
        success: true,
        player: { ...existingPlayer, nickname, avatarType, avatarValue },
        isReturning: true,
      });
    }

    // Create new player
    const player: QGamesPlayer = {
      id: playerId,
      codeId,
      nickname,
      avatarType,
      avatarValue,
      totalGamesPlayed: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      score: 0,
      rpsPlayed: 0,
      rpsWins: 0,
      tictactoePlayed: 0,
      tictactoeWins: 0,
      memoryPlayed: 0,
      memoryWins: 0,
      oddoneoutPlayed: 0,
      oddoneoutWins: 0,
      connect4Played: 0,
      connect4Wins: 0,
      registeredAt: Date.now(),
      lastPlayedAt: Date.now(),
      // Rewards & Progression
      rankId: 'rookie',
      totalPacksEarned: 0,
      unopenedPacks: 0,
      inventory: [],
      equippedTitle: null,
      equippedBorder: null,
      equippedCelebration: null,
    };

    await playerRef.set(player);

    return NextResponse.json({
      success: true,
      player,
      isReturning: false,
    });
  } catch (error) {
    console.error('Q.Games register error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
