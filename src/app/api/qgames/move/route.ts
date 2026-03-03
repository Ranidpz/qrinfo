import { NextResponse } from 'next/server';
import {
  RPSChoice,
  resolveRPS,
  RPSRoundResult,
  RTDBRPSRound,
} from '@/types/qgames';
import {
  getMatch,
  getRPSState,
  updateRPSRound,
  updateRPSScores,
  updateMatchStatus,
  decrementMatchesInProgress,
} from '@/lib/qgames-realtime';

const VALID_RPS_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];

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

    // Get match from RTDB
    const match = await getMatch(codeId, matchId);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Match not found' },
        { status: 404 }
      );
    }

    if (match.status !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'Match is not in playing state' },
        { status: 400 }
      );
    }

    // Validate player is in this match
    const isPlayer1 = match.player1Id === playerId;
    const isPlayer2 = match.player2Id === playerId;
    if (!isPlayer1 && !isPlayer2) {
      return NextResponse.json(
        { success: false, error: 'Player not in this match' },
        { status: 403 }
      );
    }

    if (gameType === 'rps') {
      return handleRPSMove(codeId, matchId, playerId, isPlayer1, move, match);
    }

    // TTT and Memory will be added later
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
  codeId: string,
  matchId: string,
  playerId: string,
  isPlayer1: boolean,
  move: { choice: RPSChoice },
  match: { player1Id: string; player2Id: string }
) {
  const { choice } = move;

  if (!VALID_RPS_CHOICES.includes(choice)) {
    return NextResponse.json(
      { success: false, error: 'Invalid RPS choice' },
      { status: 400 }
    );
  }

  // Get current RPS state
  const rpsState = await getRPSState(codeId, matchId);
  if (!rpsState) {
    return NextResponse.json(
      { success: false, error: 'RPS state not found' },
      { status: 404 }
    );
  }

  const currentRound = rpsState.currentRound;
  const round = rpsState.rounds?.[String(currentRound)] as RTDBRPSRound | undefined;
  if (!round) {
    return NextResponse.json(
      { success: false, error: 'Round not found' },
      { status: 404 }
    );
  }

  // Check if player already submitted
  if (isPlayer1 && round.player1Choice !== null) {
    return NextResponse.json(
      { success: false, error: 'Already submitted choice' },
      { status: 400 }
    );
  }
  if (!isPlayer1 && round.player2Choice !== null) {
    return NextResponse.json(
      { success: false, error: 'Already submitted choice' },
      { status: 400 }
    );
  }

  // Write player's choice
  const choiceField = isPlayer1 ? 'player1Choice' : 'player2Choice';
  await updateRPSRound(codeId, matchId, currentRound, {
    [choiceField]: choice,
  } as Partial<RTDBRPSRound>);

  // Re-read to check if both players submitted
  const updatedState = await getRPSState(codeId, matchId);
  const updatedRound = updatedState?.rounds?.[String(currentRound)] as RTDBRPSRound | undefined;

  if (!updatedRound) {
    return NextResponse.json({ success: true, waiting: true });
  }

  const p1Choice = isPlayer1 ? choice : updatedRound.player1Choice;
  const p2Choice = isPlayer1 ? updatedRound.player2Choice : choice;

  if (p1Choice && p2Choice) {
    // Both submitted - resolve round
    const winner = resolveRPS(p1Choice, p2Choice);

    let p1Score = updatedState!.player1Score;
    let p2Score = updatedState!.player2Score;

    if (winner === 'player1') p1Score++;
    else if (winner === 'player2') p2Score++;

    // Reveal the round
    await updateRPSRound(codeId, matchId, currentRound, {
      player1Choice: p1Choice,
      player2Choice: p2Choice,
      winner,
      revealed: true,
    });

    // Update scores
    await updateRPSScores(codeId, matchId, p1Score, p2Score, currentRound);

    // Check if match is over
    const firstTo = updatedState!.firstTo;
    if (p1Score >= firstTo || p2Score >= firstTo) {
      // Match over
      const winnerId = p1Score >= firstTo ? match.player1Id : match.player2Id;
      await updateMatchStatus(codeId, matchId, 'finished', {
        finishedAt: Date.now(),
      });
      await decrementMatchesInProgress(codeId);

      return NextResponse.json({
        success: true,
        revealed: true,
        roundWinner: winner,
        player1Choice: p1Choice,
        player2Choice: p2Choice,
        player1Score: p1Score,
        player2Score: p2Score,
        matchOver: true,
        matchWinnerId: winnerId,
      });
    }

    // Next round will be started by the client after reveal animation
    // Client calls startNewRPSRound() from qgames-realtime.ts after 2.5s delay
    const nextRound = currentRound + 1;

    return NextResponse.json({
      success: true,
      revealed: true,
      roundWinner: winner,
      player1Choice: p1Choice,
      player2Choice: p2Choice,
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
