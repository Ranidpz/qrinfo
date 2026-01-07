/**
 * Q.Challenge - Firestore operations for trivia quiz game
 * Handles session configuration, players, answers, and duplicate prevention
 */

import { db } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  where,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import {
  QChallengeConfig,
  QChallengePlayer,
  QChallengePlayerAnswer,
  QChallengePhase,
  QChallengeQuestion,
  QChallengeStats,
  QChallengeLeaderboardEntry,
  QChallengePlayedRecord,
  DEFAULT_QCHALLENGE_CONFIG,
  sanitizeQuestionsForPlayer,
} from '@/types/qchallenge';

// ============ SESSION MANAGEMENT ============

/**
 * Get Q.Challenge config from a code's media item
 */
export async function getQChallengeConfig(
  codeId: string,
  mediaId: string
): Promise<QChallengeConfig | null> {
  try {
    const codeDoc = await getDoc(doc(db, 'codes', codeId));
    if (!codeDoc.exists()) return null;

    const data = codeDoc.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);

    return media?.qchallengeConfig || null;
  } catch (error) {
    console.error('Error getting Q.Challenge config:', error);
    return null;
  }
}

/**
 * Update Q.Challenge config in a code's media item
 */
export async function updateQChallengeConfig(
  codeId: string,
  mediaId: string,
  updates: Partial<QChallengeConfig>
): Promise<boolean> {
  try {
    const codeRef = doc(db, 'codes', codeId);
    const codeDoc = await getDoc(codeRef);
    if (!codeDoc.exists()) return false;

    const data = codeDoc.data();
    const mediaIndex = data.media?.findIndex((m: { id: string }) => m.id === mediaId);
    if (mediaIndex === -1 || mediaIndex === undefined) return false;

    // Update the specific media item's qchallengeConfig
    const updatedMedia = [...data.media];
    updatedMedia[mediaIndex] = {
      ...updatedMedia[mediaIndex],
      qchallengeConfig: {
        ...updatedMedia[mediaIndex].qchallengeConfig,
        ...updates,
      },
    };

    await updateDoc(codeRef, { media: updatedMedia });
    return true;
  } catch (error) {
    console.error('Error updating Q.Challenge config:', error);
    return false;
  }
}

/**
 * Change Q.Challenge phase
 */
export async function setQChallengePhase(
  codeId: string,
  mediaId: string,
  phase: QChallengePhase
): Promise<boolean> {
  const updates: Partial<QChallengeConfig> = { currentPhase: phase };

  // Add timestamps based on phase
  if (phase === 'playing') {
    updates.gameStartedAt = Date.now();
  } else if (phase === 'finished' || phase === 'results') {
    updates.gameEndedAt = Date.now();
  } else if (phase === 'registration') {
    updates.lastResetAt = Date.now();
  }

  return updateQChallengeConfig(codeId, mediaId, updates);
}

// ============ PLAYER MANAGEMENT ============

/**
 * Check if player can play (duplicate prevention)
 */
export async function canPlayerPlay(
  codeId: string,
  visitorId: string,
  phone?: string
): Promise<{ canPlay: boolean; reason?: string; existingRecord?: QChallengePlayedRecord }> {
  try {
    // Check by visitorId
    const visitorRecordId = `${codeId}_${visitorId}`;
    const visitorRecordRef = doc(db, 'qchallenge_played', visitorRecordId);
    const visitorRecord = await getDoc(visitorRecordRef);

    if (visitorRecord.exists()) {
      const data = visitorRecord.data() as QChallengePlayedRecord;
      if (data.playCount > 0) {
        return {
          canPlay: false,
          reason: 'ALREADY_PLAYED',
          existingRecord: data,
        };
      }
    }

    // Check by phone if provided
    if (phone) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const phoneRecordId = `${codeId}_phone_${normalizedPhone}`;
      const phoneRecordRef = doc(db, 'qchallenge_played', phoneRecordId);
      const phoneRecord = await getDoc(phoneRecordRef);

      if (phoneRecord.exists()) {
        const data = phoneRecord.data() as QChallengePlayedRecord;
        if (data.playCount > 0) {
          return {
            canPlay: false,
            reason: 'PHONE_ALREADY_USED',
            existingRecord: data,
          };
        }
      }
    }

    return { canPlay: true };
  } catch (error) {
    console.error('Error checking if player can play:', error);
    // Allow play on error to not block users
    return { canPlay: true };
  }
}

/**
 * Register a new player
 */
export async function registerPlayer(
  codeId: string,
  player: Omit<QChallengePlayer, 'status' | 'currentQuestionIndex' | 'answers' | 'currentScore' |
    'currentStreak' | 'maxStreak' | 'correctAnswers' | 'wrongAnswers' | 'totalTimeMs' |
    'hasCompleted' | 'playCount'>
): Promise<QChallengePlayer | null> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', player.id);

    // Check if already registered
    const existingPlayer = await getDoc(playerRef);
    if (existingPlayer.exists()) {
      // Return existing player data
      return existingPlayer.data() as QChallengePlayer;
    }

    const newPlayer: QChallengePlayer = {
      ...player,
      status: 'registered',
      currentQuestionIndex: 0,
      answers: [],
      currentScore: 0,
      currentStreak: 0,
      maxStreak: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      totalTimeMs: 0,
      hasCompleted: false,
      playCount: 0,
    };

    await setDoc(playerRef, newPlayer);
    return newPlayer;
  } catch (error) {
    console.error('Error registering player:', error);
    return null;
  }
}

/**
 * Get a player by ID
 */
export async function getPlayer(
  codeId: string,
  playerId: string
): Promise<QChallengePlayer | null> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) return null;
    return playerDoc.data() as QChallengePlayer;
  } catch (error) {
    console.error('Error getting player:', error);
    return null;
  }
}

/**
 * Update player data
 */
export async function updatePlayer(
  codeId: string,
  playerId: string,
  updates: Partial<QChallengePlayer>
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', playerId);
    await updateDoc(playerRef, updates);
    return true;
  } catch (error) {
    console.error('Error updating player:', error);
    return false;
  }
}

/**
 * Record player's answer
 */
export async function recordAnswer(
  codeId: string,
  playerId: string,
  answer: QChallengePlayerAnswer
): Promise<boolean> {
  try {
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', playerId);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) return false;

    const player = playerDoc.data() as QChallengePlayer;

    // Add answer to array
    const updatedAnswers = [...player.answers, answer];

    // Update player stats
    await updateDoc(playerRef, {
      answers: updatedAnswers,
      currentScore: player.currentScore + answer.totalPoints,
      currentStreak: answer.isCorrect ? player.currentStreak + 1 : 0,
      maxStreak: Math.max(player.maxStreak, answer.isCorrect ? player.currentStreak + 1 : player.maxStreak),
      correctAnswers: answer.isCorrect ? player.correctAnswers + 1 : player.correctAnswers,
      wrongAnswers: answer.isCorrect ? player.wrongAnswers : player.wrongAnswers + 1,
      currentQuestionIndex: player.currentQuestionIndex + 1,
      totalTimeMs: player.totalTimeMs + answer.responseTimeMs,
    });

    return true;
  } catch (error) {
    console.error('Error recording answer:', error);
    return false;
  }
}

/**
 * Mark player as finished
 */
export async function finishPlayer(
  codeId: string,
  playerId: string,
  finalScore: number,
  phone?: string
): Promise<boolean> {
  try {
    const batch = writeBatch(db);

    // Update player
    const playerRef = doc(db, 'codes', codeId, 'qchallenge_players', playerId);
    batch.update(playerRef, {
      status: 'finished',
      hasCompleted: true,
      playCount: increment(1),
      finishedAt: Date.now(),
    });

    // Record in played collection (by visitorId)
    const visitorRecordId = `${codeId}_${playerId}`;
    const visitorRecordRef = doc(db, 'qchallenge_played', visitorRecordId);
    batch.set(visitorRecordRef, {
      id: visitorRecordId,
      codeId,
      visitorId: playerId,
      phone: phone || null,
      firstPlayedAt: serverTimestamp(),
      lastPlayedAt: serverTimestamp(),
      playCount: 1,
      bestScore: finalScore,
      bestRank: 0, // Will be updated later
    }, { merge: true });

    // Also record by phone if provided
    if (phone) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const phoneRecordId = `${codeId}_phone_${normalizedPhone}`;
      const phoneRecordRef = doc(db, 'qchallenge_played', phoneRecordId);
      batch.set(phoneRecordRef, {
        id: phoneRecordId,
        codeId,
        visitorId: playerId,
        phone: normalizedPhone,
        firstPlayedAt: serverTimestamp(),
        lastPlayedAt: serverTimestamp(),
        playCount: 1,
        bestScore: finalScore,
        bestRank: 0,
      }, { merge: true });
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error finishing player:', error);
    return false;
  }
}

/**
 * Get all players for a quiz
 */
export async function getAllPlayers(codeId: string): Promise<QChallengePlayer[]> {
  try {
    const playersRef = collection(db, 'codes', codeId, 'qchallenge_players');
    const snapshot = await getDocs(playersRef);
    return snapshot.docs.map(doc => doc.data() as QChallengePlayer);
  } catch (error) {
    console.error('Error getting all players:', error);
    return [];
  }
}

/**
 * Check if player has already answered a question
 */
export async function hasAnsweredQuestion(
  codeId: string,
  playerId: string,
  questionId: string
): Promise<boolean> {
  try {
    const player = await getPlayer(codeId, playerId);
    if (!player) return false;

    return player.answers.some(a => a.questionId === questionId);
  } catch (error) {
    console.error('Error checking answered question:', error);
    return false;
  }
}

// ============ LEADERBOARD ============

/**
 * Calculate leaderboard from players
 */
export async function calculateLeaderboard(
  codeId: string,
  totalQuestions: number
): Promise<QChallengeLeaderboardEntry[]> {
  const players = await getAllPlayers(codeId);

  // Filter to only finished players or those who have answered at least one question
  const activePlayers = players.filter(p => p.answers.length > 0);

  // Sort by score (desc), then by total time (asc for faster completion)
  const sorted = activePlayers.sort((a, b) => {
    if (b.currentScore !== a.currentScore) {
      return b.currentScore - a.currentScore;
    }
    return a.totalTimeMs - b.totalTimeMs;
  });

  return sorted.map((player, index) => ({
    visitorId: player.id,
    nickname: player.nickname,
    avatarType: player.avatarType,
    avatarValue: player.avatarValue,
    branchId: player.branchId,
    score: player.currentScore,
    correctAnswers: player.correctAnswers,
    totalQuestions,
    accuracy: totalQuestions > 0 ? Math.round((player.correctAnswers / totalQuestions) * 100) : 0,
    maxStreak: player.maxStreak,
    totalTimeMs: player.totalTimeMs,
    isFinished: player.status === 'finished',
    finishedAt: player.finishedAt,
    rank: index + 1,
  }));
}

/**
 * Calculate session stats
 */
export async function calculateStats(
  codeId: string,
  totalQuestions: number
): Promise<QChallengeStats> {
  const players = await getAllPlayers(codeId);

  const playersPlaying = players.filter(p => p.status === 'playing').length;
  const playersFinished = players.filter(p => p.status === 'finished').length;
  const totalAnswers = players.reduce((sum, p) => sum + p.answers.length, 0);

  const finishedPlayers = players.filter(p => p.status === 'finished');
  const scores = finishedPlayers.map(p => p.currentScore);
  const topScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const accuracies = finishedPlayers.map(p =>
    totalQuestions > 0 ? (p.correctAnswers / totalQuestions) * 100 : 0
  );
  const avgAccuracy = accuracies.length > 0
    ? Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 10) / 10
    : 0;

  const times = finishedPlayers.map(p => p.totalTimeMs);
  const avgTimeMs = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  return {
    totalPlayers: players.length,
    playersPlaying,
    playersFinished,
    totalAnswers,
    avgScore,
    topScore,
    avgAccuracy,
    avgTimeMs,
    lastUpdated: Date.now(),
  };
}

// ============ RESET ============

/**
 * Reset the quiz session (clear all players)
 */
export async function resetQChallengeSession(codeId: string): Promise<boolean> {
  try {
    const batch = writeBatch(db);

    // Delete all players
    const playersRef = collection(db, 'codes', codeId, 'qchallenge_players');
    const playersSnapshot = await getDocs(playersRef);
    playersSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error resetting Q.Challenge session:', error);
    return false;
  }
}

// ============ REAL-TIME SUBSCRIPTIONS ============

/**
 * Subscribe to players collection changes
 */
export function subscribeToQChallengePlayers(
  codeId: string,
  onUpdate: (players: QChallengePlayer[]) => void
): Unsubscribe {
  const playersRef = collection(db, 'codes', codeId, 'qchallenge_players');

  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => doc.data() as QChallengePlayer);
    onUpdate(players);
  });
}

/**
 * Subscribe to code document changes (for config updates)
 */
export function subscribeToQChallengeConfig(
  codeId: string,
  mediaId: string,
  onUpdate: (config: QChallengeConfig | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'codes', codeId), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    const data = snapshot.data();
    const media = data.media?.find((m: { id: string }) => m.id === mediaId);
    onUpdate(media?.qchallengeConfig || null);
  });
}

// ============ INITIALIZATION ============

/**
 * Initialize a new Q.Challenge media item with default config
 */
export function createDefaultQChallengeConfig(
  overrides?: Partial<QChallengeConfig>
): QChallengeConfig {
  return {
    ...DEFAULT_QCHALLENGE_CONFIG,
    ...overrides,
    stats: {
      ...DEFAULT_QCHALLENGE_CONFIG.stats,
      lastUpdated: Date.now(),
    },
  };
}

// ============ QUESTION HELPERS ============

/**
 * Get questions for player (without correct answers)
 */
export function getQuestionsForPlayer(
  config: QChallengeConfig
): QChallengeQuestion[] {
  return sanitizeQuestionsForPlayer(
    config.questions,
    config.shuffleQuestions,
    config.shuffleAnswers
  );
}

/**
 * Find the correct answer for a question
 */
export function findCorrectAnswerId(question: QChallengeQuestion): string | null {
  const correctAnswer = question.answers.find(a => a.isCorrect);
  return correctAnswer?.id || null;
}

/**
 * Check if an answer is correct
 */
export function isAnswerCorrect(
  question: QChallengeQuestion,
  answerId: string
): boolean {
  const answer = question.answers.find(a => a.id === answerId);
  return answer?.isCorrect || false;
}
