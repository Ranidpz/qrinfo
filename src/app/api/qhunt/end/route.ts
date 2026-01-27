import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { QHuntPlayer } from '@/types/qhunt';
import {
  updateLeaderboardEntry,
  incrementPlayersFinished,
  recalculateRanks,
} from '@/lib/qhunt-realtime';

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
      return NextResponse.json(
        { success: false, error: 'Game already ended' },
        { status: 400 }
      );
    }

    // Mark player as finished
    const gameEndedAt = Date.now();
    await playerRef.update({
      isFinished: true,
      gameEndedAt,
    });

    // Update Realtime DB
    try {
      // Get config to find team color
      const codeDoc = await adminDb.collection('codes').doc(codeId).get();
      const codeData = codeDoc.data();
      const qhuntMedia = codeData?.media?.find((m: { type: string }) => m.type === 'qhunt');
      const config = qhuntMedia?.qhuntConfig;

      let teamColor: string | undefined;
      if (player.teamId && config?.teams) {
        const team = config.teams.find((t: { id: string; color: string }) => t.id === player.teamId);
        teamColor = team?.color;
      }

      await updateLeaderboardEntry(codeId, {
        playerId: player.id,
        playerName: player.name,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
        teamId: player.teamId,
        teamColor,
        score: player.currentScore,
        scansCount: player.scansCount,
        gameTime: player.gameStartedAt ? gameEndedAt - player.gameStartedAt : undefined,
        isFinished: true,
        rank: 0,
      });

      await incrementPlayersFinished(codeId);
      await recalculateRanks(codeId);
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    return NextResponse.json({
      success: true,
      gameEndedAt,
      finalScore: player.currentScore,
      codesFound: player.scansCount,
    });
  } catch (error) {
    console.error('Error ending game:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
