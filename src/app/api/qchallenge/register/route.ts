import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  QChallengeConfig,
  QChallengePlayer,
  QChallengeRegisterResponse,
  sanitizeQuestionsForPlayer,
} from '@/types/qchallenge';
import {
  initQChallengeSession,
  qchallengeSessionExists,
  incrementTotalPlayers,
} from '@/lib/qchallenge-realtime';
import { canPlayerPlay } from '@/lib/qchallenge';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      codeId,
      playerId,
      nickname,
      avatarType,
      avatarValue,
      branchId,
      consent,
      phone,
      sessionToken,
    } = body;

    // Validate required fields
    if (!codeId || !playerId || !nickname || !avatarType || !avatarValue) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' } as QChallengeRegisterResponse,
        { status: 400 }
      );
    }

    // Validate nickname length
    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Nickname must be 2-20 characters', errorCode: 'NICKNAME_INVALID' } as QChallengeRegisterResponse,
        { status: 400 }
      );
    }

    // Check if code exists and get config
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);

    if (!codeDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Code not found' },
        { status: 404 }
      );
    }

    // Find Q.Challenge media item
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

    // Check if registration is open
    if (config.currentPhase !== 'registration' && config.currentPhase !== 'playing') {
      return NextResponse.json(
        { success: false, error: 'Quiz is not open for registration', errorCode: 'GAME_NOT_OPEN' } as QChallengeRegisterResponse,
        { status: 400 }
      );
    }

    // Check duplicate prevention
    const canPlay = await canPlayerPlay(codeId, playerId, phone);
    if (!canPlay.canPlay) {
      return NextResponse.json(
        {
          success: false,
          error: canPlay.reason === 'PHONE_ALREADY_USED'
            ? 'This phone number has already been used'
            : 'You have already played this quiz',
          errorCode: 'ALREADY_PLAYED',
        } as QChallengeRegisterResponse,
        { status: 400 }
      );
    }

    // Validate branch if required
    if (config.branchesEnabled && branchId) {
      const branchExists = config.branches.some(b => b.id === branchId && b.isActive);
      if (!branchExists) {
        return NextResponse.json(
          { success: false, error: 'Invalid branch', errorCode: 'INVALID_BRANCH' } as QChallengeRegisterResponse,
          { status: 400 }
        );
      }
    }

    // TODO: Phone verification check (Phase 2)
    // if (config.verification?.enabled && !sessionToken) { ... }

    // Check if player already registered (allow resume)
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', playerId);
    const existingPlayer = await getDoc(playerRef);

    if (existingPlayer.exists()) {
      // Return existing player data with questions
      const player = existingPlayer.data() as QChallengePlayer;

      // Get sanitized questions
      const questions = sanitizeQuestionsForPlayer(
        config.questions,
        config.shuffleQuestions,
        config.shuffleAnswers
      );

      return NextResponse.json({
        success: true,
        player,
        questions,
      } as QChallengeRegisterResponse);
    }

    // Create new player
    const newPlayer: QChallengePlayer = {
      id: playerId,
      codeId,
      branchId: branchId || undefined,
      nickname,
      avatarType,
      avatarValue,
      phone: phone || undefined,
      consent: consent || false,
      status: 'registered',
      currentQuestionIndex: 0,
      answers: [],
      currentScore: 0,
      currentStreak: 0,
      maxStreak: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      registeredAt: Date.now(),
      totalTimeMs: 0,
      hasCompleted: false,
      playCount: 0,
    };

    await setDoc(playerRef, newPlayer);

    // Initialize Realtime DB session if needed
    try {
      const sessionExists = await qchallengeSessionExists(codeId);
      if (!sessionExists) {
        await initQChallengeSession(codeId);
      }
      await incrementTotalPlayers(codeId);
    } catch (rtdbError) {
      console.error('Error with RTDB session:', rtdbError);
    }

    // Get sanitized questions (without correct answers)
    const questions = sanitizeQuestionsForPlayer(
      config.questions,
      config.shuffleQuestions,
      config.shuffleAnswers
    );

    return NextResponse.json({
      success: true,
      player: newPlayer,
      questions,
    } as QChallengeRegisterResponse);
  } catch (error) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
