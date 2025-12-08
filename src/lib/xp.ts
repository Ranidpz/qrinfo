/**
 * XP/Gamification Helper Functions
 *
 * This module provides utility functions for the XP system including:
 * - Level calculations
 * - Visitor ID generation
 * - XP formatting
 * - Progress calculations
 */

import { XP_LEVELS, XPLevel } from '@/types';

// localStorage key for visitor ID
export const VISITOR_ID_KEY = 'qr_visitor_id';

/**
 * Generate a unique visitor ID (UUID v4)
 */
export function generateVisitorId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get visitor ID from localStorage, or generate a new one
 */
export function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

/**
 * Get the visitor ID from localStorage (returns null if not found)
 */
export function getVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(VISITOR_ID_KEY);
}

/**
 * Clear visitor ID from localStorage
 */
export function clearVisitorId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(VISITOR_ID_KEY);
}

/**
 * Get the XP level for a given XP amount
 */
export function getLevelForXP(xp: number): XPLevel {
  // Find the level where XP falls between minXP and maxXP
  const level = XP_LEVELS.find(l => xp >= l.minXP && xp < l.maxXP);
  // Default to first level if not found (shouldn't happen)
  return level || XP_LEVELS[0];
}

/**
 * Get progress percentage to next level (0-100)
 * Returns 100 if at max level
 */
export function getProgressToNextLevel(xp: number): number {
  const currentLevel = getLevelForXP(xp);

  // If at max level (Infinity), return 100%
  if (currentLevel.maxXP === Infinity) {
    return 100;
  }

  const levelRange = currentLevel.maxXP - currentLevel.minXP;
  const progress = ((xp - currentLevel.minXP) / levelRange) * 100;

  return Math.min(100, Math.max(0, Math.round(progress)));
}

/**
 * Get XP needed to reach the next level
 * Returns 0 if at max level
 */
export function getXPToNextLevel(xp: number): number {
  const currentLevel = getLevelForXP(xp);

  if (currentLevel.maxXP === Infinity) {
    return 0;
  }

  return currentLevel.maxXP - xp;
}

/**
 * Format XP for display with locale-specific formatting
 */
export function formatXP(xp: number, locale: 'he' | 'en' = 'he'): string {
  return xp.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
}

/**
 * Get level name based on locale
 */
export function getLevelName(level: XPLevel, locale: 'he' | 'en' = 'he'): string {
  return locale === 'he' ? level.name : level.nameEn;
}

/**
 * Validate nickname (2-20 characters, no HTML)
 */
export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  const trimmed = nickname.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'הכינוי קצר מדי (מינימום 2 תווים)' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'הכינוי ארוך מדי (מקסימום 20 תווים)' };
  }

  // Check for HTML tags
  if (/<[^>]*>/g.test(trimmed)) {
    return { valid: false, error: 'הכינוי לא יכול להכיל HTML' };
  }

  return { valid: true };
}

/**
 * Sanitize nickname (remove HTML, trim whitespace)
 */
export function sanitizeNickname(nickname: string): string {
  return nickname
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim()
    .slice(0, 20); // Limit to 20 characters
}

/**
 * Check if a visitor has completed enough stations for a bonus
 */
export function checkBonusEligibility(
  visitedStations: string[],
  totalStations: number,
  bonusThreshold: number
): boolean {
  // If threshold is 0, it means "all stations"
  const requiredStations = bonusThreshold === 0 ? totalStations : bonusThreshold;
  return visitedStations.length >= requiredStations;
}

/**
 * Calculate total XP from progress records
 */
export function calculateTotalXP(progressRecords: { xp: number }[]): number {
  return progressRecords.reduce((total, record) => total + record.xp, 0);
}
