import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  QGamesMatch,
  QGamesPlayer,
  QGamesLeaderboardEntry,
  QGamesRewardsResult,
  MATCH_POINTS,
  QGameType,
  QGamesAvatarType,
  getRankForScore,
  DEFAULT_POINTS_PER_PACK,
} from '@/types/qgames';
import {
  getMatch,
  getRPSState,
  getOOOState,
  getTTTState,
  getC4State,
  updateLeaderboardEntry,
  recalculateLeaderboardRanks,
  cleanupMatch,
  leaveQueue,
  deleteMemoryRoom,
} from '@/lib/qgames-realtime';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    // Rate limit
    const ip = getClientIp(request);
    const rl = checkRateLimit(`qgames-finish:${ip}`, RATE_LIMITS.API);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { codeId, matchId, playerId, gameType, memoryRoomId, memoryResults } = body;

    // Memory games use roomId instead of matchId
    if (gameType === 'memory') {
      return handleMemoryFinish(codeId, playerId, memoryRoomId, memoryResults);
    }

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

    // Read config for rewards settings
    const codeDoc = await adminDb.collection('codes').doc(codeId).get();
    const codeData = codeDoc.data();
    const gamesMedia = codeData?.media?.find(
      (m: { type: string }) => m.type === 'minigames'
    );
    const pointsPerPack = gamesMedia?.qgamesConfig?.rewards?.pointsPerPack || DEFAULT_POINTS_PER_PACK;

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
    } else if (match.gameType === 'tictactoe') {
      const tttState = await getTTTState(codeId, matchId);
      if (tttState) {
        p1Score = tttState.player1Score;
        p2Score = tttState.player2Score;
        if (p1Score > p2Score) winnerId = match.player1Id;
        else if (p2Score > p1Score) winnerId = match.player2Id;
      }
    } else if (match.gameType === 'connect4') {
      const c4State = await getC4State(codeId, matchId);
      if (c4State) {
        p1Score = c4State.player1Score;
        p2Score = c4State.player2Score;
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
    const rewardsMap: Record<string, QGamesRewardsResult | null> = {};

    if (match.gameType === 'oddoneout' && winnerIds && loserId) {
      // OOO: 2 winners, 1 loser — pass outcome explicitly
      for (const pid of winnerIds) {
        rewardsMap[pid] = await updatePlayerStatsOOO(adminDb, codeId, pid, gameTypeKey, 'win', pointsPerPack);
      }
      rewardsMap[loserId] = await updatePlayerStatsOOO(adminDb, codeId, loserId, gameTypeKey, 'loss', pointsPerPack);
    } else {
      // 2-player games: use winnerId
      rewardsMap[match.player1Id] = await updatePlayerStats(adminDb, codeId, match.player1Id, gameTypeKey, winnerId, pointsPerPack);
      rewardsMap[match.player2Id] = await updatePlayerStats(adminDb, codeId, match.player2Id, gameTypeKey, winnerId, pointsPerPack);
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
      rewards: rewardsMap[playerId] || null,
    });
  } catch (error) {
    console.error('Q.Games finish error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to finish match' },
      { status: 500 }
    );
  }
}

// ─── Memory Game Finish ─────────────────────────────────────
interface MemoryPlayerResult {
  id: string;
  nickname: string;
  avatarType: QGamesAvatarType;
  avatarValue: string;
  score: number;
  strikes: number;
  eliminated: boolean;
}

async function handleMemoryFinish(
  codeId: string,
  playerId: string,
  roomId: string,
  playerResults: MemoryPlayerResult[]
) {
  if (!codeId || !playerId || !roomId || !playerResults?.length) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields for memory game' },
      { status: 400 }
    );
  }

  const adminDb = getAdminDb();

  // Read config for rewards settings
  const codeDoc = await adminDb.collection('codes').doc(codeId).get();
  const codeData = codeDoc.data();
  const gamesMedia = codeData?.media?.find(
    (m: { type: string }) => m.type === 'minigames'
  );
  const pointsPerPack = gamesMedia?.qgamesConfig?.rewards?.pointsPerPack || DEFAULT_POINTS_PER_PACK;

  // Use roomId as the match doc ID
  const matchDocRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_matches').doc(roomId);
  const existingMatch = await matchDocRef.get();

  if (existingMatch.exists) {
    return NextResponse.json({ success: true, alreadyPersisted: true });
  }

  // Sort by score descending to find winner
  const sorted = [...playerResults].sort((a, b) => b.score - a.score);
  const winnerId = sorted[0].score > 0 ? sorted[0].id : null;

  // Build match record — use first 2 players as player1/player2 for compatibility
  const p1 = sorted[0];
  const p2 = sorted[1] || sorted[0]; // fallback if somehow only 1 player

  const matchRecord: QGamesMatch = {
    id: roomId,
    codeId,
    gameType: 'memory',
    player1Id: p1.id,
    player1Nickname: p1.nickname,
    player1AvatarType: p1.avatarType,
    player1AvatarValue: p1.avatarValue,
    player2Id: p2.id,
    player2Nickname: p2.nickname,
    player2AvatarType: p2.avatarType,
    player2AvatarValue: p2.avatarValue,
    player1Score: p1.score,
    player2Score: p2.score,
    winnerId,
    memoryResults: playerResults.map(p => ({
      id: p.id,
      nickname: p.nickname,
      avatarType: p.avatarType,
      avatarValue: p.avatarValue,
      score: p.score,
      strikes: p.strikes,
      eliminated: p.eliminated,
    })),
    status: 'finished',
    startedAt: Date.now(),
    finishedAt: Date.now(),
    durationMs: 0,
  };

  await matchDocRef.set(matchRecord);

  // Update stats for all players
  let callerRewards: QGamesRewardsResult | null = null;
  for (const p of playerResults) {
    const isWinner = p.id === winnerId;
    const rewards = await updatePlayerStatsMemory(adminDb, codeId, p.id, isWinner, pointsPerPack);
    if (p.id === playerId) callerRewards = rewards;
    await updatePlayerLeaderboard(adminDb, codeId, p.id);
  }
  await recalculateLeaderboardRanks(codeId);

  // Clean up memory room from RTDB
  await deleteMemoryRoom(codeId, roomId);

  return NextResponse.json({ success: true, match: matchRecord, rewards: callerRewards });
}

/** Calculate rank change and pack earnings for a player */
function calculateRewards(
  oldScore: number,
  newScore: number,
  pointsPerPack: number
): QGamesRewardsResult {
  const oldRank = getRankForScore(oldScore);
  const newRank = getRankForScore(newScore);
  const oldPacks = Math.floor(oldScore / pointsPerPack);
  const newPacks = Math.floor(newScore / pointsPerPack);
  return {
    previousRankId: oldRank.id,
    newRankId: newRank.id,
    rankChanged: oldRank.id !== newRank.id,
    packsEarned: newPacks - oldPacks,
    unopenedPacks: 0, // Will be set from actual player data
  };
}

async function updatePlayerStatsMemory(
  adminDb: FirebaseFirestore.Firestore,
  codeId: string,
  playerId: string,
  isWinner: boolean,
  pointsPerPack: number
): Promise<QGamesRewardsResult | null> {
  const playerRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_players').doc(playerId);

  const playerDoc = await playerRef.get();
  if (!playerDoc.exists) return null;

  const player = playerDoc.data() as QGamesPlayer;
  const pointsEarned = isWinner ? MATCH_POINTS.WIN : MATCH_POINTS.LOSS;
  const newScore = player.score + pointsEarned;

  const rewards = calculateRewards(player.score, newScore, pointsPerPack);
  const newUnopenedPacks = (player.unopenedPacks || 0) + rewards.packsEarned;
  rewards.unopenedPacks = newUnopenedPacks;

  const updates: Partial<QGamesPlayer> = {
    totalGamesPlayed: player.totalGamesPlayed + 1,
    totalWins: player.totalWins + (isWinner ? 1 : 0),
    totalLosses: player.totalLosses + (isWinner ? 0 : 1),
    score: newScore,
    lastPlayedAt: Date.now(),
    memoryPlayed: (player.memoryPlayed || 0) + 1,
    memoryWins: (player.memoryWins || 0) + (isWinner ? 1 : 0),
    rankId: rewards.newRankId,
  };

  if (rewards.packsEarned > 0) {
    updates.totalPacksEarned = (player.totalPacksEarned || 0) + rewards.packsEarned;
    updates.unopenedPacks = newUnopenedPacks;
  }

  await playerRef.update(updates);
  return rewards;
}

async function updatePlayerStats(
  adminDb: FirebaseFirestore.Firestore,
  codeId: string,
  playerId: string,
  gameType: QGameType,
  winnerId: string | null,
  pointsPerPack: number
): Promise<QGamesRewardsResult | null> {
  const playerRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_players').doc(playerId);

  const playerDoc = await playerRef.get();
  if (!playerDoc.exists) return null;

  const player = playerDoc.data() as QGamesPlayer;
  const isWinner = winnerId === playerId;
  const isDraw = winnerId === null;
  const pointsEarned = isWinner ? MATCH_POINTS.WIN : isDraw ? ((gameType === 'tictactoe' || gameType === 'connect4') ? MATCH_POINTS.WIN : MATCH_POINTS.DRAW) : MATCH_POINTS.LOSS;
  const newScore = player.score + pointsEarned;

  const rewards = calculateRewards(player.score, newScore, pointsPerPack);
  const newUnopenedPacks = (player.unopenedPacks || 0) + rewards.packsEarned;
  rewards.unopenedPacks = newUnopenedPacks;

  const updates: Partial<QGamesPlayer> = {
    totalGamesPlayed: player.totalGamesPlayed + 1,
    totalWins: player.totalWins + (isWinner ? 1 : 0),
    totalLosses: player.totalLosses + (!isWinner && !isDraw ? 1 : 0),
    totalDraws: player.totalDraws + (isDraw ? 1 : 0),
    score: newScore,
    lastPlayedAt: Date.now(),
    rankId: rewards.newRankId,
  };

  if (rewards.packsEarned > 0) {
    updates.totalPacksEarned = (player.totalPacksEarned || 0) + rewards.packsEarned;
    updates.unopenedPacks = newUnopenedPacks;
  }

  // Update per-game stats
  const playedKey = `${gameType}Played` as keyof QGamesPlayer;
  const winsKey = `${gameType}Wins` as keyof QGamesPlayer;
  (updates as Record<string, number>)[playedKey as string] = (player[playedKey] as number || 0) + 1;
  if (isWinner) {
    (updates as Record<string, number>)[winsKey as string] = (player[winsKey] as number || 0) + 1;
  }

  await playerRef.update(updates);
  return rewards;
}

/** Update stats for OOO game (explicit win/loss, no draw possible at match level) */
async function updatePlayerStatsOOO(
  adminDb: FirebaseFirestore.Firestore,
  codeId: string,
  playerId: string,
  gameType: QGameType,
  outcome: 'win' | 'loss',
  pointsPerPack: number
): Promise<QGamesRewardsResult | null> {
  const playerRef = adminDb
    .collection('codes').doc(codeId)
    .collection('qgames_players').doc(playerId);

  const playerDoc = await playerRef.get();
  if (!playerDoc.exists) return null;

  const player = playerDoc.data() as QGamesPlayer;
  const isWinner = outcome === 'win';
  const pointsEarned = isWinner ? MATCH_POINTS.WIN : MATCH_POINTS.LOSS;
  const newScore = player.score + pointsEarned;

  const rewards = calculateRewards(player.score, newScore, pointsPerPack);
  const newUnopenedPacks = (player.unopenedPacks || 0) + rewards.packsEarned;
  rewards.unopenedPacks = newUnopenedPacks;

  const updates: Partial<QGamesPlayer> = {
    totalGamesPlayed: player.totalGamesPlayed + 1,
    totalWins: player.totalWins + (isWinner ? 1 : 0),
    totalLosses: player.totalLosses + (isWinner ? 0 : 1),
    totalDraws: player.totalDraws,
    score: newScore,
    lastPlayedAt: Date.now(),
    rankId: rewards.newRankId,
  };

  if (rewards.packsEarned > 0) {
    updates.totalPacksEarned = (player.totalPacksEarned || 0) + rewards.packsEarned;
    updates.unopenedPacks = newUnopenedPacks;
  }

  const playedKey = `${gameType}Played` as keyof QGamesPlayer;
  const winsKey = `${gameType}Wins` as keyof QGamesPlayer;
  (updates as Record<string, number>)[playedKey as string] = (player[playedKey] as number || 0) + 1;
  if (isWinner) {
    (updates as Record<string, number>)[winsKey as string] = (player[winsKey] as number || 0) + 1;
  }

  await playerRef.update(updates);
  return rewards;
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
    tictactoePlayed: player.tictactoePlayed || 0,
    tictactoeWins: player.tictactoeWins || 0,
    memoryPlayed: player.memoryPlayed || 0,
    memoryWins: player.memoryWins || 0,
    connect4Played: player.connect4Played || 0,
    connect4Wins: player.connect4Wins || 0,
    // Rank & equipped items
    rankId: player.rankId || 'rookie',
    equippedTitle: player.equippedTitle || null,
    equippedBorder: player.equippedBorder || null,
  };

  await updateLeaderboardEntry(codeId, entry);
}
