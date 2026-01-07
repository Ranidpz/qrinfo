/**
 * Q.Challenge Scoring System
 *
 * Supports 4 scoring modes:
 * 1. time_and_streak - Speed bonus + consecutive correct bonus (full)
 * 2. time_only - Speed bonus only
 * 3. streak_only - Consecutive correct bonus only
 * 4. simple - Fixed points per correct answer
 */

import {
  QChallengeScoringConfig,
  QChallengeScoringMode,
  STREAK_MULTIPLIERS,
} from '@/types/qchallenge';

// =============================================================
// Score Calculation Result
// =============================================================
export interface ScoreCalculation {
  isCorrect: boolean;
  basePoints: number;
  timeBonus: number;
  streakMultiplier: number;
  totalPoints: number;
  newStreak: number;
}

// =============================================================
// Main Scoring Function
// =============================================================

/**
 * Calculate score for a single answer
 *
 * @param isCorrect - Whether the answer was correct
 * @param responseTimeMs - Time taken to answer in milliseconds
 * @param timeLimitMs - Total time limit for the question in milliseconds
 * @param currentStreak - Current streak before this answer
 * @param config - Scoring configuration
 * @returns Score calculation result
 */
export function calculateAnswerScore(
  isCorrect: boolean,
  responseTimeMs: number,
  timeLimitMs: number,
  currentStreak: number,
  config: QChallengeScoringConfig
): ScoreCalculation {
  // Wrong answer = 0 points, reset streak
  if (!isCorrect) {
    return {
      isCorrect: false,
      basePoints: 0,
      timeBonus: 0,
      streakMultiplier: 1,
      totalPoints: 0,
      newStreak: 0,
    };
  }

  // Base points for correct answer
  const basePoints = config.basePoints;

  // Calculate time bonus based on mode
  let timeBonus = 0;
  if (config.mode === 'time_only' || config.mode === 'time_and_streak') {
    timeBonus = calculateTimeBonus(responseTimeMs, timeLimitMs, config.timeBonusMax);
  }

  // Calculate streak multiplier based on mode
  let streakMultiplier = 1;
  const newStreak = currentStreak + 1;

  if (config.mode === 'streak_only' || config.mode === 'time_and_streak') {
    streakMultiplier = getStreakMultiplier(newStreak);
  }

  // Calculate total points
  // Formula: (basePoints + timeBonus) * streakMultiplier
  const totalPoints = Math.round((basePoints + timeBonus) * streakMultiplier);

  return {
    isCorrect: true,
    basePoints,
    timeBonus,
    streakMultiplier,
    totalPoints,
    newStreak,
  };
}

// =============================================================
// Time Bonus Calculation
// =============================================================

/**
 * Calculate time bonus based on response time
 * Linear decay: faster response = higher bonus
 *
 * @param responseTimeMs - Time taken to answer
 * @param timeLimitMs - Total time limit
 * @param maxBonus - Maximum bonus points
 * @returns Time bonus points
 */
export function calculateTimeBonus(
  responseTimeMs: number,
  timeLimitMs: number,
  maxBonus: number
): number {
  // Ensure response time doesn't exceed limit
  const clampedTime = Math.min(responseTimeMs, timeLimitMs);

  // Calculate remaining time ratio (0 to 1)
  const timeRemainingRatio = 1 - (clampedTime / timeLimitMs);

  // Linear bonus: full bonus for instant answer, 0 for last second
  const bonus = Math.round(maxBonus * timeRemainingRatio);

  return Math.max(0, bonus);
}

// =============================================================
// Streak Multiplier
// =============================================================

/**
 * Get streak multiplier for given streak count
 *
 * Streak multipliers:
 * 1: 1.0x (no bonus)
 * 2: 1.2x
 * 3: 1.5x
 * 4: 2.0x
 * 5: 2.5x
 * 6+: 3.0x (max)
 *
 * @param streak - Current streak count
 * @returns Multiplier value
 */
export function getStreakMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  if (streak >= 6) return STREAK_MULTIPLIERS[6];
  return STREAK_MULTIPLIERS[streak] || 1;
}

// =============================================================
// Scoring Mode Helpers
// =============================================================

/**
 * Check if scoring mode uses time bonus
 */
export function usesTimeBonus(mode: QChallengeScoringMode): boolean {
  return mode === 'time_only' || mode === 'time_and_streak';
}

/**
 * Check if scoring mode uses streak multiplier
 */
export function usesStreakMultiplier(mode: QChallengeScoringMode): boolean {
  return mode === 'streak_only' || mode === 'time_and_streak';
}

// =============================================================
// Score Display Helpers
// =============================================================

/**
 * Format score with commas for display
 */
export function formatScore(score: number): string {
  return score.toLocaleString();
}

/**
 * Format streak multiplier for display (e.g., "x1.5")
 */
export function formatStreakMultiplier(multiplier: number): string {
  return `x${multiplier.toFixed(1)}`;
}

/**
 * Get streak message based on streak count
 */
export function getStreakMessage(
  streak: number,
  locale: 'he' | 'en'
): string | null {
  if (streak < 2) return null;

  const messages = {
    he: {
      2: 'רצף של 2! 🔥',
      3: 'רצף של 3! 🔥🔥',
      4: 'רצף של 4! 🔥🔥🔥',
      5: 'רצף של 5! מדהים! 🌟',
      6: 'רצף מושלם! 👑',
    },
    en: {
      2: '2 in a row! 🔥',
      3: '3 in a row! 🔥🔥',
      4: '4 in a row! 🔥🔥🔥',
      5: '5 in a row! Amazing! 🌟',
      6: 'Perfect streak! 👑',
    },
  };

  const cappedStreak = Math.min(streak, 6) as 2 | 3 | 4 | 5 | 6;
  return messages[locale][cappedStreak] || null;
}

// =============================================================
// Example Score Calculations
// =============================================================

/**
 * Example scenarios for documentation:
 *
 * Scoring mode: time_and_streak, basePoints: 100, timeBonusMax: 50
 *
 * Q1: Correct in 2s (10s limit), streak=1
 *   Base: 100, Time: 40 (80% remaining), Streak: 1.0x
 *   Total: (100 + 40) * 1.0 = 140
 *
 * Q2: Correct in 3s (10s limit), streak=2
 *   Base: 100, Time: 35 (70% remaining), Streak: 1.2x
 *   Total: (100 + 35) * 1.2 = 162
 *
 * Q3: Correct in 1s (10s limit), streak=3
 *   Base: 100, Time: 45 (90% remaining), Streak: 1.5x
 *   Total: (100 + 45) * 1.5 = 218
 *
 * Q4: Wrong answer
 *   Total: 0, streak resets to 0
 *
 * Q5: Correct in 5s (10s limit), streak=1 (reset)
 *   Base: 100, Time: 25 (50% remaining), Streak: 1.0x
 *   Total: (100 + 25) * 1.0 = 125
 *
 * ----------------------------------------
 *
 * Scoring mode: simple, basePoints: 100
 *
 * Q1: Correct in any time
 *   Total: 100 (no bonuses)
 *
 * Q2: Wrong
 *   Total: 0
 */
