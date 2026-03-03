import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { QGamesConfig, QGamesPlayer } from '@/types/qgames';
import { initQGamesSession, incrementQGamesPlayers } from '@/lib/qgames-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codeId, playerId, nickname, avatarType, avatarValue } = body;

    // Validate required fields
    if (!codeId || !playerId || !nickname || !avatarType || !avatarValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Nickname must be 2-20 characters' },
        { status: 400 }
      );
    }

    // Get code and validate config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const gamesMedia = codeData.media?.find(
      (m: { type: string }) => m.type === 'minigames'
    );

    if (!gamesMedia?.qgamesConfig) {
      return NextResponse.json(
        { success: false, error: 'Q.Games not configured' },
        { status: 400 }
      );
    }

    const config: QGamesConfig = gamesMedia.qgamesConfig;

    if (config.phase !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Games are not active' },
        { status: 400 }
      );
    }

    // Check if player already exists
    const playerRef = doc(db, 'codes', codeId, 'qgames_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (playerDoc.exists()) {
      // Player already registered - update nickname/avatar and return
      const existingPlayer = playerDoc.data() as QGamesPlayer;
      await setDoc(playerRef, {
        ...existingPlayer,
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
      registeredAt: Date.now(),
      lastPlayedAt: Date.now(),
    };

    await setDoc(playerRef, player);

    // Initialize RTDB session if needed + increment stats
    await initQGamesSession(codeId);
    await incrementQGamesPlayers(codeId);

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
