import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  QChallengeConfig,
  QChallengePlayer,
  QChallengePlayerAnswer,
  QChallengeAnswerResponse,
  QChallengeLeaderboardEntry,
} from '@/types/qchallenge';
import { calculateAnswerScore } from '@/lib/qchallenge-scoring';
import {
  updateLeaderboardEntry,
  incrementPlayersFinished,
  incrementTotalAnswers,
  addRecentCompletion,
  recalculateRanks,
  getPlayerRank,
} from '@/lib/qchallenge-realtime';
import { finishPlayer } from '@/lib/qchallenge';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      playerId,
      questionId,
      questionIndex,
      answerId,
      responseTimeMs,
    } = body;

    // Validate required fields
    if (!codeId || !playerId || !questionId || answerId === undefined || responseTimeMs === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QChallengeAnswerResponse,
        { status: 400 }
      );
    }

    // Get code and config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    const codeData = codeDoc.data();
    const challengeMedia = codeData.media?.find(
      (m: { type: string }) => m.type === 'qchallenge'
    );

    if (!challengeMedia?.qchallengeConfig) {
      return NextResponse.json(
        { success: false, error: 'Q.Challenge not configured' },
        { status: 400 }
      );
    }

    const config: QChallengeConfig = challengeMedia.qchallengeConfig;

    // Check if game is active
    if (config.currentPhase !== 'playing' && config.currentPhase !== 'registration') {
      return NextResponse.json(
        { success: false, error: 'Quiz is not active', errorCode: 'GAME_NOT_ACTIVE' } as QChallengeAnswerResponse,
        { status: 400 }
      );
    }

    // Get player
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Player not found', errorCode: 'PLAYER_NOT_FOUND' } as QChallengeAnswerResponse,
        { status: 404 }
      );
    }

    const player = playerDoc.data() as QChallengePlayer;

    // Check if player already finished
    if (player.status === 'finished') {
      return NextResponse.json(
        { success: false, error: 'Quiz already completed', errorCode: 'ALREADY_ANSWERED' } as QChallengeAnswerResponse,
        { status: 400 }
      );
    }

    // Find the question
    const question = config.questions.find(q => q.id === questionId);
    if (!question) {
      return NextResponse.json(
        { success: false, error: 'Question not found', errorCode: 'QUESTION_NOT_FOUND' } as QChallengeAnswerResponse,
        { status: 404 }
      );
    }

    // Check if already answered this question
    const alreadyAnswered = player.answers.some(a => a.questionId === questionId);
    if (alreadyAnswered) {
      return NextResponse.json(
        { success: false, error: 'Question already answered', errorCode: 'ALREADY_ANSWERED' } as QChallengeAnswerResponse,
        { status: 400 }
      );
    }

    // Find the correct answer
    const correctAnswer = question.answers.find(a => a.isCorrect);
    if (!correctAnswer) {
      return NextResponse.json(
        { success: false, error: 'No correct answer defined' },
        { status: 500 }
      );
    }

    // Check if answer is correct
    const isCorrect = answerId === correctAnswer.id;

    // Calculate score
    const timeLimitMs = question.timeLimitSeconds * 1000;
    const scoreResult = calculateAnswerScore(
      isCorrect,
      responseTimeMs,
      timeLimitMs,
      player.currentStreak,
      config.scoring
    );

    // Create answer record
    const answerRecord: QChallengePlayerAnswer = {
      questionId,
      questionIndex,
      answerId,
      isCorrect,
      responseTimeMs,
      basePoints: scoreResult.basePoints,
      timeBonus: scoreResult.timeBonus,
      streakMultiplier: scoreResult.streakMultiplier,
      totalPoints: scoreResult.totalPoints,
      streakAtAnswer: scoreResult.newStreak,
      answeredAt: Date.now(),
    };

    // Update player
    const newTotalScore = player.currentScore + scoreResult.totalPoints;
    const newCorrectAnswers = player.correctAnswers + (isCorrect ? 1 : 0);
    const newWrongAnswers = player.wrongAnswers + (isCorrect ? 0 : 1);
    const newMaxStreak = Math.max(player.maxStreak, scoreResult.newStreak);
    const newTotalTimeMs = player.totalTimeMs + responseTimeMs;
    const totalQuestions = config.questions.filter(q => q.isActive).length;

    // Check if this is the last question
    const isGameComplete = player.answers.length + 1 >= totalQuestions;

    // Prepare player updates
    const playerUpdates: Partial<QChallengePlayer> = {
      status: isGameComplete ? 'finished' : 'playing',
      currentQuestionIndex: questionIndex + 1,
      answers: [...player.answers, answerRecord],
      currentScore: newTotalScore,
      currentStreak: scoreResult.newStreak,
      maxStreak: newMaxStreak,
      correctAnswers: newCorrectAnswers,
      wrongAnswers: newWrongAnswers,
      totalTimeMs: newTotalTimeMs,
    };

    if (isGameComplete) {
      playerUpdates.finishedAt = Date.now();
      playerUpdates.hasCompleted = true;
      playerUpdates.playCount = 1;
    }

    if (!player.startedAt) {
      playerUpdates.startedAt = Date.now();
    }

    await updateDoc(playerRef, playerUpdates);

    // Update Realtime DB leaderboard
    try {
      const leaderboardEntry: QChallengeLeaderboardEntry = {
        visitorId: playerId,
        nickname: player.nickname,
        avatarType: player.avatarType,
        avatarValue: player.avatarValue,
        branchId: player.branchId,
        score: newTotalScore,
        correctAnswers: newCorrectAnswers,
        totalQuestions,
        accuracy: Math.round((newCorrectAnswers / totalQuestions) * 100),
        maxStreak: newMaxStreak,
        totalTimeMs: newTotalTimeMs,
        isFinished: isGameComplete,
        finishedAt: isGameComplete ? Date.now() : undefined,
        rank: 0, // Will be recalculated
      };

      await updateLeaderboardEntry(codeId, leaderboardEntry);
      await incrementTotalAnswers(codeId);

      if (isGameComplete) {
        // Record completion in Firestore
        await finishPlayer(codeId, playerId, newTotalScore, player.phone);

        // Update Realtime DB stats
        await incrementPlayersFinished(
          codeId,
          newTotalScore,
          Math.round((newCorrectAnswers / totalQuestions) * 100),
          newTotalTimeMs
        );

        // Recalculate ranks
        await recalculateRanks(codeId);

        // Add to recent completions
        const rank = await getPlayerRank(codeId, playerId);
        await addRecentCompletion(codeId, {
          id: `${playerId}_${Date.now()}`,
          visitorId: playerId,
          nickname: player.nickname,
          avatarValue: player.avatarValue,
          score: newTotalScore,
          rank: rank || 0,
          accuracy: Math.round((newCorrectAnswers / totalQuestions) * 100),
          finishedAt: Date.now(),
        });
      }
    } catch (rtdbError) {
      console.error('Error updating Realtime DB:', rtdbError);
    }

    // Get final rank if game complete
    let finalRank: number | undefined;
    if (isGameComplete) {
      finalRank = await getPlayerRank(codeId, playerId) || undefined;
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      correctAnswerId: correctAnswer.id,
      basePoints: scoreResult.basePoints,
      timeBonus: scoreResult.timeBonus,
      streakMultiplier: scoreResult.streakMultiplier,
      totalPoints: scoreResult.totalPoints,
      newTotalScore,
      newStreak: scoreResult.newStreak,
      isGameComplete,
      rank: finalRank,
    } as QChallengeAnswerResponse);
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
