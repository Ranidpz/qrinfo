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
  getOOOState,
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
    const isPlayer2 = match.player2Id === playerId;
    const isPlayer3 = match.player3Id === playerId;
    if (!isPlayer1 && !isPlayer2 && !isPlayer3) {
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
    let p3Score = 0;
    let winnerId: string | null = null;
    let winnerIds: string[] | undefined;
    let loserId: string | null | undefined;

    if (match.gameType === 'rps') {
      const rpsState = await getRPSState(codeId, matchId);
      if (rpsState) {
        p1Score = rpsState.player1Score;
        p2Score = rpsState.player2Score;
        if (p1Score > p2Score) winnerId = match.player1Id;
        else if (p2Score > p1Score) winnerId = match.player2Id;
      }
    } else if (match.gameType === 'oddoneout') {
      const oooState = await getOOOState(codeId, matchId);
      if (oooState) {
        p1Score = oooState.player1Strikes;
        p2Score = oooState.player2Strikes;
        p3Score = oooState.player3Strikes;

        const maxStrikes = oooState.maxStrikes;
        if (p1Score >= maxStrikes) loserId = match.player1Id;
        else if (p2Score >= maxStrikes) loserId = match.player2Id;
        else if (p3Score >= maxStrikes) loserId = match.player3Id;

        // Winners are the 2 players who didn't lose
        const allPlayers = [match.player1Id, match.player2Id, match.player3Id].filter(Boolean) as string[];
        winnerIds = allPlayers.filter(id => id !== loserId);
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

    // Add player3 fields for 3-player games
    if (match.player3Id) {
      matchRecord.player3Id = match.player3Id;
      matchRecord.player3Nickname = match.player3Nickname;
      matchRecord.player3AvatarType = match.player3AvatarType;
      matchRecord.player3AvatarValue = match.player3AvatarValue;
      matchRecord.player3Score = p3Score;
      matchRecord.winnerIds = winnerIds;
      matchRecord.loserId = loserId;
    }

    await matchDocRef.set(matchRecord);

    // Update players' stats in Firestore
    const gameTypeKey = match.gameType as QGameType;

    if (match.gameType === 'oddoneout' && winnerIds && loserId) {
      // OOO: 2 winners, 1 loser — pass outcome explicitly
      for (const pid of winnerIds) {
        await updatePlayerStatsOOO(adminDb, codeId, pid, gameTypeKey, 'win');
      }
      await updatePlayerStatsOOO(adminDb, codeId, loserId, gameTypeKey, 'loss');
    } else {
      // 2-player games: use winnerId
      await updatePlayerStats(adminDb, codeId, match.player1Id, gameTypeKey, winnerId);
      await updatePlayerStats(adminDb, codeId, match.player2Id, gameTypeKey, winnerId);
    }

    // Update leaderboard in RTDB
    const allPlayerIds = [match.player1Id, match.player2Id, match.player3Id].filter(Boolean) as string[];
    for (const pid of allPlayerIds) {
      await updatePlayerLeaderboard(adminDb, codeId, pid);
    }
    await recalculateLeaderboardRanks(codeId);

    // Clean up queue entries
    for (const pid of allPlayerIds) {
      await leaveQueue(codeId, pid);
    }

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

/** Update stats for OOO game (explicit win/loss, no draw possible at match level) */
async function updatePlayerStatsOOO(
  adminDb: FirebaseFirestore.Firestore,
  codeId: string,
  playerId: string,
  gameType: QGameType,
  outcome: 'win' | 'loss'
) {
  const playerRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_players').doc(playerId);

  const playerDoc = await playerRef.get();
  if (!playerDoc.exists) return;

  const player = playerDoc.data() as QGamesPlayer;
  const isWinner = outcome === 'win';

  const updates: Partial<QGamesPlayer> = {
    totalGamesPlayed: player.totalGamesPlayed + 1,
    totalWins: player.totalWins + (isWinner ? 1 : 0),
    totalLosses: player.totalLosses + (isWinner ? 0 : 1),
    totalDraws: player.totalDraws,
    score: player.score + (isWinner ? MATCH_POINTS.WIN : MATCH_POINTS.LOSS),
    lastPlayedAt: Date.now(),
  };

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
    // Per-game stats for leaderboard filtering
    rpsPlayed: player.rpsPlayed || 0,
    rpsWins: player.rpsWins || 0,
    oddoneoutPlayed: player.oddoneoutPlayed || 0,
    oddoneoutWins: player.oddoneoutWins || 0,
  };

  await updateLeaderboardEntry(codeId, entry);
}
