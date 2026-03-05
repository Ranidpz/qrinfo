import { NextResponse } from 'next/server';
import {
  RPSChoice,
  resolveRPS,
  RTDBRPSRound,
  RTDBRPSState,
  OOOChoice,
  resolveOOO,
  RTDBOOORound,
  RTDBOOOState,
  RTDBTTTState,
  RTDBMatch,
  QGAMES_PATHS,
  checkTTTWinner,
  getWinLine,
  parseTTTBoard,
} from '@/types/qgames';
import { getAdminRtdb } from '@/lib/firebase-admin';

const VALID_RPS_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];
const VALID_OOO_CHOICES: OOOChoice[] = ['palm', 'fist'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codeId, matchId, playerId, gameType, move } = body;

    if (!codeId || !matchId || !playerId || !gameType || !move) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get match from RTDB (Admin SDK)
    const rtdb = getAdminRtdb();
    const matchSnap = await rtdb.ref(QGAMES_PATHS.match(codeId, matchId)).get();
    if (!matchSnap.exists()) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      );
    }

    const match = matchSnap.val() as RTDBMatch;

    if (match.status !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'Match is not in playing state' },
        { status: 400 }
      );
    }

    // Validate player is in this match
    const isPlayer1 = match.player1Id === playerId;
    const isPlayer2 = match.player2Id === playerId;
    const isPlayer3 = match.player3Id === playerId;
    if (!isPlayer1 && !isPlayer2 && !isPlayer3) {
      return NextResponse.json(
        { success: false, error: 'Player not in this match' },
        { status: 403 }
      );
    }

    if (gameType === 'rps') {
      return handleRPSMove(rtdb, codeId, matchId, playerId, isPlayer1, move, match);
    }

    if (gameType === 'oddoneout') {
      return handleOOOMove(rtdb, codeId, matchId, playerId, isPlayer1, isPlayer2, isPlayer3, move, match);
    }

    if (gameType === 'tictactoe') {
      return handleTTTMove(rtdb, codeId, matchId, playerId, isPlayer1, move, match);
    }

    return NextResponse.json(
      { success: false, error: 'Game type not yet supported' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Q.Games move error:', error);
    return NextResponse.json(
      { success: false, error: 'Move failed' },
      { status: 500 }
    );
  }
}

async function handleRPSMove(
  rtdb: ReturnType<typeof getAdminRtdb>,
  codeId: string,
  matchId: string,
  playerId: string,
  isPlayer1: boolean,
  move: { choice: RPSChoice; timedOut?: boolean },
  match: { player1Id: string; player2Id: string }
) {
  const { choice, timedOut } = move;

  if (!VALID_RPS_CHOICES.includes(choice)) {
    return NextResponse.json(
      { success: false, error: 'Invalid RPS choice' },
      { status: 400 }
    );
  }

  // Get current round number first
  const rpsSnap = await rtdb.ref(QGAMES_PATHS.rpsState(codeId, matchId)).get();
  if (!rpsSnap.exists()) {
    return NextResponse.json(
      { success: false, error: 'RPS state not found' },
      { status: 404 }
    );
  }

  const rpsState = rpsSnap.val() as RTDBRPSState;
  const currentRound = rpsState.currentRound;

  // Use RTDB transaction on the round node for atomic move + reveal
  // This prevents the race where both players write but neither sees
  // the other's choice on re-read (different serverless instances)
  const roundPath = QGAMES_PATHS.rpsRound(codeId, matchId, currentRound);
  const roundRef = rtdb.ref(roundPath);

  const txResult = await roundRef.transaction((current: RTDBRPSRound | null) => {
    if (!current) return current; // Round doesn't exist, abort

    // Check if player already submitted
    // NOTE: RTDB strips null values → field is undefined when unset, not null
    // Use truthy check since valid choices ('rock','paper','scissors') are all truthy
    if (isPlayer1 && current.player1Choice) return; // Abort
    if (!isPlayer1 && current.player2Choice) return; // Abort

    // Write this player's choice and timeout flag
    if (isPlayer1) {
      current.player1Choice = choice;
      if (timedOut) current.player1TimedOut = true;
    } else {
      current.player2Choice = choice;
      if (timedOut) current.player2TimedOut = true;
    }

    // Check if both have submitted
    if (current.player1Choice && current.player2Choice) {
      const p1TimedOut = !!current.player1TimedOut;
      const p2TimedOut = !!current.player2TimedOut;

      if (p1TimedOut && p2TimedOut) {
        // Both timed out → draw (no points)
        current.winner = 'draw';
      } else if (p1TimedOut) {
        // Player1 timed out → player2 wins
        current.winner = 'player2';
      } else if (p2TimedOut) {
        // Player2 timed out → player1 wins
        current.winner = 'player1';
      } else {
        // Normal RPS resolution
        current.winner = resolveRPS(current.player1Choice, current.player2Choice);
      }
      current.revealed = true;
    }

    return current;
  });

  if (!txResult.committed) {
    // Transaction aborted - player already submitted or round missing
    return NextResponse.json(
      { success: false, error: 'Already submitted choice' },
      { status: 400 }
    );
  }

  const finalRound = txResult.snapshot.val() as RTDBRPSRound;

  if (finalRound.revealed && finalRound.player1Choice && finalRound.player2Choice) {
    // Both submitted - update scores
    let p1Score = rpsState.player1Score;
    let p2Score = rpsState.player2Score;

    if (finalRound.winner === 'player1') p1Score++;
    else if (finalRound.winner === 'player2') p2Score++;

    // Track consecutive mutual timeouts (both players didn't answer)
    const bothTimedOut = !!finalRound.player1TimedOut && !!finalRound.player2TimedOut;
    const prevConsecutive = rpsState.consecutiveMutualTimeouts || 0;
    const newConsecutive = bothTimedOut ? prevConsecutive + 1 : 0;

    // Update scores + timeout counter on RPS state
    await rtdb.ref(QGAMES_PATHS.rpsState(codeId, matchId)).update({
      player1Score: p1Score,
      player2Score: p2Score,
      consecutiveMutualTimeouts: newConsecutive,
    });

    // Check if match is over by score
    const firstTo = rpsState.firstTo;
    if (p1Score >= firstTo || p2Score >= firstTo) {
      const winnerId = p1Score >= firstTo ? match.player1Id : match.player2Id;
      await rtdb.ref(QGAMES_PATHS.match(codeId, matchId)).update({
        status: 'finished',
        lastUpdated: Date.now(),
        finishedAt: Date.now(),
      });

      // Decrement matches in progress
      const statsRef = rtdb.ref(QGAMES_PATHS.stats(codeId));
      await statsRef.transaction((current: Record<string, number> | null) => {
        if (!current) return current;
        return {
          ...current,
          matchesInProgress: Math.max(0, (current.matchesInProgress || 0) - 1),
          lastUpdated: Date.now(),
        };
      });

      return NextResponse.json({
        success: true,
        revealed: true,
        roundWinner: finalRound.winner,
        player1Choice: finalRound.player1Choice,
        player2Choice: finalRound.player2Choice,
        player1Score: p1Score,
        player2Score: p2Score,
        matchOver: true,
        matchWinnerId: winnerId,
      });
    }

    // Check if match should end due to 3 consecutive mutual timeouts
    if (newConsecutive >= 3) {
      const winnerId = p1Score > p2Score ? match.player1Id
        : p2Score > p1Score ? match.player2Id
        : null; // true draw

      await rtdb.ref(QGAMES_PATHS.match(codeId, matchId)).update({
        status: 'finished',
        lastUpdated: Date.now(),
        finishedAt: Date.now(),
      });

      const statsRef = rtdb.ref(QGAMES_PATHS.stats(codeId));
      await statsRef.transaction((current: Record<string, number> | null) => {
        if (!current) return current;
        return {
          ...current,
          matchesInProgress: Math.max(0, (current.matchesInProgress || 0) - 1),
          lastUpdated: Date.now(),
        };
      });

      return NextResponse.json({
        success: true,
        revealed: true,
        roundWinner: finalRound.winner,
        player1Choice: finalRound.player1Choice,
        player2Choice: finalRound.player2Choice,
        player1Score: p1Score,
        player2Score: p2Score,
        matchOver: true,
        matchWinnerId: winnerId,
      });
    }

    return NextResponse.json({
      success: true,
      revealed: true,
      roundWinner: finalRound.winner,
      player1Choice: finalRound.player1Choice,
      player2Choice: finalRound.player2Choice,
      player1Score: p1Score,
      player2Score: p2Score,
      matchOver: false,
    });
  }

  // Only one player submitted so far
  return NextResponse.json({
    success: true,
    waiting: true,
  });
}

async function handleOOOMove(
  rtdb: ReturnType<typeof getAdminRtdb>,
  codeId: string,
  matchId: string,
  playerId: string,
  isPlayer1: boolean,
  isPlayer2: boolean,
  isPlayer3: boolean,
  move: { choice: OOOChoice; timedOut?: boolean },
  match: { player1Id: string; player2Id: string; player3Id?: string }
) {
  const { choice, timedOut } = move;

  if (!VALID_OOO_CHOICES.includes(choice)) {
    return NextResponse.json(
      { success: false, error: 'Invalid OOO choice' },
      { status: 400 }
    );
  }

  // Get current round number
  const oooSnap = await rtdb.ref(QGAMES_PATHS.oooState(codeId, matchId)).get();
  if (!oooSnap.exists()) {
    return NextResponse.json(
      { success: false, error: 'OOO state not found' },
      { status: 404 }
    );
  }

  const oooState = oooSnap.val() as RTDBOOOState;
  const currentRound = oooState.currentRound;

  // Atomic transaction on round node
  const roundPath = QGAMES_PATHS.oooRound(codeId, matchId, currentRound);
  const roundRef = rtdb.ref(roundPath);

  const txResult = await roundRef.transaction((current: RTDBOOORound | null) => {
    if (!current) return current;

    // Check if player already submitted (RTDB strips null → field is undefined)
    if (isPlayer1 && current.player1Choice) return;
    if (isPlayer2 && current.player2Choice) return;
    if (isPlayer3 && current.player3Choice) return;

    // Write choice and timeout flag
    if (isPlayer1) {
      current.player1Choice = choice;
      if (timedOut) current.player1TimedOut = true;
    } else if (isPlayer2) {
      current.player2Choice = choice;
      if (timedOut) current.player2TimedOut = true;
    } else {
      current.player3Choice = choice;
      if (timedOut) current.player3TimedOut = true;
    }

    // Check if all 3 have submitted
    if (current.player1Choice && current.player2Choice && current.player3Choice) {
      const p1TimedOut = !!current.player1TimedOut;
      const p2TimedOut = !!current.player2TimedOut;
      const p3TimedOut = !!current.player3TimedOut;
      const timeoutCount = [p1TimedOut, p2TimedOut, p3TimedOut].filter(Boolean).length;

      if (timeoutCount >= 2) {
        // 2+ timed out → draw (round void, no strikes)
        current.loser = 'draw';
      } else if (timeoutCount === 1) {
        // Exactly 1 timed out → that player gets the strike
        current.loser = p1TimedOut ? 'player1' : p2TimedOut ? 'player2' : 'player3';
      } else {
        // Normal OOO resolution
        current.loser = resolveOOO(
          current.player1Choice,
          current.player2Choice,
          current.player3Choice
        );
      }
      current.revealed = true;
    }

    return current;
  });

  if (!txResult.committed) {
    return NextResponse.json(
      { success: false, error: 'Already submitted choice' },
      { status: 400 }
    );
  }

  const finalRound = txResult.snapshot.val() as RTDBOOORound;

  if (finalRound.revealed && finalRound.player1Choice && finalRound.player2Choice && finalRound.player3Choice) {
    // All 3 submitted — update strikes
    let p1Strikes = oooState.player1Strikes;
    let p2Strikes = oooState.player2Strikes;
    let p3Strikes = oooState.player3Strikes;

    if (finalRound.loser === 'player1') p1Strikes++;
    else if (finalRound.loser === 'player2') p2Strikes++;
    else if (finalRound.loser === 'player3') p3Strikes++;
    // draw = no strikes

    await rtdb.ref(QGAMES_PATHS.oooState(codeId, matchId)).update({
      player1Strikes: p1Strikes,
      player2Strikes: p2Strikes,
      player3Strikes: p3Strikes,
    });

    // Check if match is over
    const maxStrikes = oooState.maxStrikes;
    const isOver = p1Strikes >= maxStrikes || p2Strikes >= maxStrikes || p3Strikes >= maxStrikes;

    if (isOver) {
      const loserId = p1Strikes >= maxStrikes ? match.player1Id
        : p2Strikes >= maxStrikes ? match.player2Id
        : match.player3Id;

      await rtdb.ref(QGAMES_PATHS.match(codeId, matchId)).update({
        status: 'finished',
        lastUpdated: Date.now(),
        finishedAt: Date.now(),
      });

      // Decrement matches in progress
      const statsRef = rtdb.ref(QGAMES_PATHS.stats(codeId));
      await statsRef.transaction((current: Record<string, number> | null) => {
        if (!current) return current;
        return {
          ...current,
          matchesInProgress: Math.max(0, (current.matchesInProgress || 0) - 1),
          lastUpdated: Date.now(),
        };
      });

      return NextResponse.json({
        success: true,
        revealed: true,
        roundLoser: finalRound.loser,
        player1Choice: finalRound.player1Choice,
        player2Choice: finalRound.player2Choice,
        player3Choice: finalRound.player3Choice,
        player1Strikes: p1Strikes,
        player2Strikes: p2Strikes,
        player3Strikes: p3Strikes,
        matchOver: true,
        loserId,
      });
    }

    return NextResponse.json({
      success: true,
      revealed: true,
      roundLoser: finalRound.loser,
      player1Choice: finalRound.player1Choice,
      player2Choice: finalRound.player2Choice,
      player3Choice: finalRound.player3Choice,
      player1Strikes: p1Strikes,
      player2Strikes: p2Strikes,
      player3Strikes: p3Strikes,
      matchOver: false,
    });
  }

  // Not all players submitted yet
  return NextResponse.json({
    success: true,
    waiting: true,
  });
}

async function handleTTTMove(
  rtdb: ReturnType<typeof getAdminRtdb>,
  codeId: string,
  matchId: string,
  playerId: string,
  isPlayer1: boolean,
  move: { cellIndex: number; timedOut?: boolean },
  match: { player1Id: string; player2Id: string }
) {
  const { cellIndex, timedOut } = move;

  // Get current TTT state
  const tttPath = QGAMES_PATHS.tttState(codeId, matchId);
  const tttRef = rtdb.ref(tttPath);

  const txResult = await tttRef.transaction((current: RTDBTTTState | null) => {
    if (!current) return current;
    if (current.roundFinished) return; // Round already over

    // Handle timeout: current player forfeits round
    if (timedOut) {
      if (current.currentTurn !== playerId) return; // Not your turn to timeout
      const opponentIsP1 = !isPlayer1;
      current.winner = opponentIsP1 ? match.player1Id : match.player2Id;
      current.roundFinished = true;
      if (opponentIsP1) current.player1Score += 1;
      else current.player2Score += 1;
      return current;
    }

    // Validate cell index
    if (typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex > 8) return;

    // Validate turn
    if (current.currentTurn !== playerId) return; // Not your turn

    // Parse board and validate cell is empty
    const board = current.board.split('');
    if (board[cellIndex] !== '_') return; // Cell taken

    // Place the marker
    const marker = current.xPlayerId === playerId ? 'X' : 'O';
    board[cellIndex] = marker;
    current.board = board.join('');
    current.moveCount += 1;

    // Check for winner
    const boardCells = parseTTTBoard(current.board);
    const winnerMarker = checkTTTWinner(boardCells);
    const winLine = getWinLine(boardCells);

    if (winnerMarker) {
      // Round winner
      current.winner = playerId;
      current.winLine = winLine;
      current.roundFinished = true;
      if (isPlayer1) current.player1Score += 1;
      else current.player2Score += 1;
    } else if (current.moveCount >= 9) {
      // Draw - board full, no winner
      current.isDraw = true;
      current.roundFinished = true;
      // No score change on draw rounds
    } else {
      // Switch turn
      current.currentTurn = playerId === match.player1Id
        ? match.player2Id : match.player1Id;
      current.timerStartedAt = Date.now();
    }

    return current;
  });

  if (!txResult.committed) {
    return NextResponse.json(
      { success: false, error: 'Invalid move or not your turn' },
      { status: 400 }
    );
  }

  const finalState = txResult.snapshot.val() as RTDBTTTState;

  // If round ended, check if match is over
  if (finalState.roundFinished && finalState.winner) {
    const firstTo = finalState.firstTo;
    if (finalState.player1Score >= firstTo || finalState.player2Score >= firstTo) {
      // Match finished
      await rtdb.ref(QGAMES_PATHS.match(codeId, matchId)).update({
        status: 'finished',
        lastUpdated: Date.now(),
        finishedAt: Date.now(),
      });

      // Decrement matches in progress
      const statsRef = rtdb.ref(QGAMES_PATHS.stats(codeId));
      await statsRef.transaction((current: Record<string, number> | null) => {
        if (!current) return current;
        return {
          ...current,
          matchesInProgress: Math.max(0, (current.matchesInProgress || 0) - 1),
          lastUpdated: Date.now(),
        };
      });

      return NextResponse.json({
        success: true,
        matchOver: true,
        matchWinnerId: finalState.player1Score >= firstTo ? match.player1Id : match.player2Id,
      });
    }
  }

  return NextResponse.json({ success: true });
}
