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
  updateMatchStatus,
  updateLeaderboardEntry,
  recalculateLeaderboardRanks,
  leaveQueue,
} from '@/lib/qgames-realtime';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`qgames-forfeit:${ip}`, RATE_LIMITS.API);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { codeId, matchId, playerId } = body;

    if (!codeId || !matchId || !playerId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const match = await getMatch(codeId, matchId);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      );
    }

    // Verify player is in match
    const isInMatch =
      match.player1Id === playerId ||
      match.player2Id === playerId ||
      match.player3Id === playerId;
    if (!isInMatch) {
      return NextResponse.json(
        { success: false, error: 'Player not in this match' },
        { status: 403 }
      );
    }

    // Mark match as abandoned in RTDB
    await updateMatchStatus(codeId, matchId, 'abandoned');

    const adminDb = getAdminDb();

    // Check if already persisted
    const matchDocRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_matches').doc(matchId);
    const existing = await matchDocRef.get();
    if (existing.exists) {
      return NextResponse.json({ success: true, alreadyPersisted: true });
    }

    // Persist abandoned match — forfeit win for the staying player
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
      player1Score: 0,
      player2Score: 0,
      winnerId: playerId,
      status: 'abandoned',
      startedAt: match.startedAt,
      finishedAt: Date.now(),
      durationMs: Date.now() - match.startedAt,
    };

    if (match.player3Id) {
      matchRecord.player3Id = match.player3Id;
      matchRecord.player3Nickname = match.player3Nickname;
      matchRecord.player3AvatarType = match.player3AvatarType;
      matchRecord.player3AvatarValue = match.player3AvatarValue;
      matchRecord.player3Score = 0;
    }

    await matchDocRef.set(matchRecord);

    // Update winner stats (+1 win)
    const winnerRef = adminDb
      .collection('codes').doc(codeId)
      .collection('qgames_players').doc(playerId);
    const winnerDoc = await winnerRef.get();
    if (winnerDoc.exists) {
      const p = winnerDoc.data() as QGamesPlayer;
      const gameTypeKey = match.gameType as QGameType;
      const playedKey = `${gameTypeKey}Played` as keyof QGamesPlayer;
      const winsKey = `${gameTypeKey}Wins` as keyof QGamesPlayer;

      await winnerRef.update({
        totalGamesPlayed: p.totalGamesPlayed + 1,
        totalWins: p.totalWins + 1,
        score: p.score + MATCH_POINTS.WIN,
        [playedKey]: ((p[playedKey] as number) || 0) + 1,
        [winsKey]: ((p[winsKey] as number) || 0) + 1,
        lastPlayedAt: Date.now(),
      });

      // Update leaderboard
      const updatedWinner = (await winnerRef.get()).data() as QGamesPlayer;
      const entry: QGamesLeaderboardEntry = {
        id: updatedWinner.id,
        nickname: updatedWinner.nickname,
        avatarType: updatedWinner.avatarType,
        avatarValue: updatedWinner.avatarValue,
        score: updatedWinner.score,
        wins: updatedWinner.totalWins,
        losses: updatedWinner.totalLosses,
        draws: updatedWinner.totalDraws,
        gamesPlayed: updatedWinner.totalGamesPlayed,
        rank: 0,
        lastPlayedAt: updatedWinner.lastPlayedAt,
        rpsPlayed: updatedWinner.rpsPlayed || 0,
        rpsWins: updatedWinner.rpsWins || 0,
        oddoneoutPlayed: updatedWinner.oddoneoutPlayed || 0,
        oddoneoutWins: updatedWinner.oddoneoutWins || 0,
        tictactoePlayed: updatedWinner.tictactoePlayed || 0,
        tictactoeWins: updatedWinner.tictactoeWins || 0,
        memoryPlayed: updatedWinner.memoryPlayed || 0,
        memoryWins: updatedWinner.memoryWins || 0,
        connect4Played: updatedWinner.connect4Played || 0,
        connect4Wins: updatedWinner.connect4Wins || 0,
      };
      await updateLeaderboardEntry(codeId, entry);
      await recalculateLeaderboardRanks(codeId);
    }

    // Clean up queue entries
    const allIds = [match.player1Id, match.player2Id, match.player3Id].filter(Boolean) as string[];
    for (const pid of allIds) {
      await leaveQueue(codeId, pid);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Q.Games forfeit error:', error);
    return NextResponse.json(
      { success: false, error: 'Forfeit failed' },
      { status: 500 }
    );
  }
}
