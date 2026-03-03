import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  QGamesMatch,
  QGamesPlayer,
  QGamesLeaderboardEntry,
  MATCH_POINTS,
  QGameType,
} from '@/types/qgames';
import {
  getMatch,
  getRPSState,
  updateLeaderboardEntry,
  recalculateLeaderboardRanks,
  cleanupMatch,
  leaveQueue,
} from '@/lib/qgames-realtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codeId, matchId, playerId } = body;

    if (!codeId || !matchId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get match from RTDB
    const match = await getMatch(codeId, matchId);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      );
    }

    if (match.status !== 'finished') {
      return NextResponse.json(
        { success: false, error: 'Match is not finished' },
        { status: 400 }
      );
    }

    // Only one player needs to trigger the persist
    const isPlayer1 = match.player1Id === playerId;
    if (!isPlayer1 && match.player2Id !== playerId) {
      return NextResponse.json(
        { success: false, error: 'Player not in this match' },
        { status: 403 }
      );
    }

    const adminDb = getAdminDb();

    // Check if match already persisted
    const matchDocRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_matches').doc(matchId);
    const existingMatch = await matchDocRef.get();

    if (existingMatch.exists) {
      // Already persisted, just return success
      return NextResponse.json({ success: true, alreadyPersisted: true });
    }

    // Determine scores from game state
    let p1Score = 0;
    let p2Score = 0;
    let winnerId: string | null = null;

    if (match.gameType === 'rps') {
      const rpsState = await getRPSState(codeId, matchId);
      if (rpsState) {
        p1Score = rpsState.player1Score;
        p2Score = rpsState.player2Score;
        if (p1Score > p2Score) winnerId = match.player1Id;
        else if (p2Score > p1Score) winnerId = match.player2Id;
      }
    }

    // Persist match to Firestore
    const matchRecord: QGamesMatch = {
      id: matchId,
      codeId,
      gameType: match.gameType as QGameType,
      player1Id: match.player1Id,
      player1Nickname: match.player1Nickname,
      player1AvatarType: match.player1AvatarType,
      player1AvatarValue: match.player1AvatarValue,
      player2Id: match.player2Id,
      player2Nickname: match.player2Nickname,
      player2AvatarType: match.player2AvatarType,
      player2AvatarValue: match.player2AvatarValue,
      player1Score: p1Score,
      player2Score: p2Score,
      winnerId,
      status: 'finished',
      startedAt: match.startedAt,
      finishedAt: match.finishedAt || Date.now(),
      durationMs: (match.finishedAt || Date.now()) - match.startedAt,
    };

    await matchDocRef.set(matchRecord);

    // Update both players' stats in Firestore
    const gameTypeKey = match.gameType as QGameType;
    await updatePlayerStats(adminDb, codeId, match.player1Id, gameTypeKey, winnerId);
    await updatePlayerStats(adminDb, codeId, match.player2Id, gameTypeKey, winnerId);

    // Update leaderboard in RTDB
    await updatePlayerLeaderboard(adminDb, codeId, match.player1Id);
    await updatePlayerLeaderboard(adminDb, codeId, match.player2Id);
    await recalculateLeaderboardRanks(codeId);

    // Clean up queue entries
    await leaveQueue(codeId, match.player1Id);
    await leaveQueue(codeId, match.player2Id);

    // Clean up match from RTDB (after a delay the client handles)
    // Don't clean up immediately - clients still need to read the final state
    // The client will call cleanup when they leave the result screen

    return NextResponse.json({
      success: true,
      match: matchRecord,
    });
  } catch (error) {
    console.error('Q.Games finish error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to finish match' },
      { status: 500 }
    );
  }
}

async function updatePlayerStats(
  adminDb: FirebaseFirestore.Firestore,
  codeId: string,
  playerId: string,
  gameType: QGameType,
  winnerId: string | null
) {
  const playerRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_players').doc(playerId);

  const playerDoc = await playerRef.get();
  if (!playerDoc.exists) return;

  const player = playerDoc.data() as QGamesPlayer;
  const isWinner = winnerId === playerId;
  const isDraw = winnerId === null;

  const updates: Partial<QGamesPlayer> = {
    totalGamesPlayed: player.totalGamesPlayed + 1,
    totalWins: player.totalWins + (isWinner ? 1 : 0),
    totalLosses: player.totalLosses + (!isWinner && !isDraw ? 1 : 0),
    totalDraws: player.totalDraws + (isDraw ? 1 : 0),
    score: player.score + (isWinner ? MATCH_POINTS.WIN : isDraw ? MATCH_POINTS.DRAW : MATCH_POINTS.LOSS),
    lastPlayedAt: Date.now(),
  };

  // Update per-game stats
  const playedKey = `${gameType}Played` as keyof QGamesPlayer;
  const winsKey = `${gameType}Wins` as keyof QGamesPlayer;
  (updates as Record<string, number>)[playedKey as string] = (player[playedKey] as number || 0) + 1;
  if (isWinner) {
    (updates as Record<string, number>)[winsKey as string] = (player[winsKey] as number || 0) + 1;
  }

  await playerRef.update(updates);
}

async function updatePlayerLeaderboard(
  adminDb: FirebaseFirestore.Firestore,
  codeId: string,
  playerId: string
) {
  const playerRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_players').doc(playerId);

  const playerDoc = await playerRef.get();
  if (!playerDoc.exists) return;

  const player = playerDoc.data() as QGamesPlayer;

  const entry: QGamesLeaderboardEntry = {
    id: player.id,
    nickname: player.nickname,
    avatarType: player.avatarType,
    avatarValue: player.avatarValue,
    score: player.score,
    wins: player.totalWins,
    losses: player.totalLosses,
    draws: player.totalDraws,
    gamesPlayed: player.totalGamesPlayed,
    rank: 0, // Will be set by recalculateLeaderboardRanks
    lastPlayedAt: player.lastPlayedAt,
  };

  await updateLeaderboardEntry(codeId, entry);
}
