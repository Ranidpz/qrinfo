/**
 * OTP Verification Logic
 * Handles code generation, hashing, and verification
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a random numeric OTP code
 */
export function generateOTPCode(length: number = 4): string {
  // Generate cryptographically secure random digits
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(crypto.randomInt(0, 10)).toString();
  }
  return code;
}

/**
 * Hash an OTP code for secure storage
 * Uses SHA-256 with a salt
 */
export function hashOTPCode(code: string, salt?: string): string {
  const actualSalt = salt || process.env.OTP_HASH_SALT || 'qvote-default-salt';
  return crypto
    .createHash('sha256')
    .update(code + actualSalt)
    .digest('hex');
}

/**
 * Verify an OTP code against its hash
 */
export function verifyOTPCode(inputCode: string, storedHash: string, salt?: string): boolean {
  const inputHash = hashOTPCode(inputCode, salt);
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Generate a session token for verified users
 */
export function generateSessionToken(): string {
  return uuidv4() + '-' + Date.now().toString(36);
}

/**
 * Calculate expiry time
 */
export function getExpiryTime(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Check if a timestamp has expired
 */
export function isExpired(expiresAt: Date | string): boolean {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Date.now() > expiry.getTime();
}

/**
 * Calculate remaining seconds until expiry
 */
export function getRemainingSeconds(expiresAt: Date | string): number {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const remaining = Math.floor((expiry.getTime() - Date.now()) / 1000);
  return Math.max(0, remaining);
}

/**
 * Generate verification document ID
 */
export function generateVerificationId(codeId: string, phone: string): string {
  // Use hash to avoid special characters in document ID
  const hash = crypto
    .createHash('md5')
    .update(`${codeId}_${phone}`)
    .digest('hex')
    .substring(0, 12);
  return `ver_${hash}_${Date.now().toString(36)}`;
}

/**
 * Generate verified voter document ID
 */
export function generateVerifiedVoterId(codeId: string, phone: string): string {
  // Consistent ID for the same codeId + phone combination
  const normalized = phone.replace(/\D/g, '');
  return `${codeId}_${normalized}`;
}

/**
 * Rate limiting helper - check if enough time has passed
 */
export function canResendOTP(lastSentAt: Date | string, cooldownSeconds: number = 60): boolean {
  const lastSent = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt);
  const elapsed = (Date.now() - lastSent.getTime()) / 1000;
  return elapsed >= cooldownSeconds;
}

/**
 * Get cooldown remaining seconds
 */
export function getResendCooldown(lastSentAt: Date | string, cooldownSeconds: number = 60): number {
  const lastSent = lastSentAt instanceof Date ? lastSentAt : new Date(lastSentAt);
  const elapsed = (Date.now() - lastSent.getTime()) / 1000;
  return Math.max(0, Math.ceil(cooldownSeconds - elapsed));
}

/**
 * Session token validation
 */
export function isValidSessionToken(token: string): boolean {
  // Basic format check: uuid-timestamp
  const parts = token.split('-');
  if (parts.length < 5) return false; // UUID has 5 parts + timestamp

  // Check if last part looks like a base36 timestamp
  const timestampPart = parts[parts.length - 1];
  const timestamp = parseInt(timestampPart, 36);

  // Should be a reasonable timestamp (after 2024)
  return !isNaN(timestamp) && timestamp > 1704067200000;
}

/**
 * Parse session token to extract timestamp
 */
export function getSessionTokenTimestamp(token: string): number | null {
  const parts = token.split('-');
  if (parts.length < 5) return null;

  const timestampPart = parts[parts.length - 1];
  const timestamp = parseInt(timestampPart, 36);

  return isNaN(timestamp) ? null : timestamp;
}
