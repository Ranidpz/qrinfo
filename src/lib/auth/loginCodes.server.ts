// Passwordless login codes (email / WhatsApp). Admin SDK only — the
// `loginCodes` and `rateLimits` collections are locked to clients in firestore.rules.
//
// A code doc is keyed by a hash of the identity, so the raw email/phone never
// becomes a document id. Only a salted hash of the code is stored.

import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateOTPCode, hashOTPCode, verifyOTPCode } from '@/lib/verification';
import type { LoginIdentity } from '@/lib/auth/identity';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000;

const LOGIN_CODES = 'loginCodes';
const RATE_LIMITS = 'rateLimits';

function sha(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function identityKey(identity: LoginIdentity): string {
  return sha(`${identity.kind}:${identity.value}`).slice(0, 40);
}

function pepper(): string {
  return process.env.OTP_HASH_SALT || '';
}

// --- Rate limiting (Firestore — shared by every serverless instance) ---

interface Limit {
  key: string;
  max: number;
  windowMs: number;
}

/**
 * Consume one unit from every limit, all-or-nothing, in one transaction.
 * Fails CLOSED: each send costs money (WhatsApp) or sender reputation (email).
 */
export async function consumeLimits(limits: Limit[]): Promise<boolean> {
  const db = getAdminDb();
  const now = Date.now();
  const refs = limits.map((l) => db.collection(RATE_LIMITS).doc(`login_${sha(l.key).slice(0, 32)}`));

  try {
    return await db.runTransaction(async (tx) => {
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
      const next: Array<{ count: number; resetAt: number }> = [];

      for (let i = 0; i < limits.length; i++) {
        const data = snaps[i].data();
        if (!data || now > data.resetAt) {
          next.push({ count: 1, resetAt: now + limits[i].windowMs });
        } else if (data.count >= limits[i].max) {
          return false;
        } else {
          next.push({ count: data.count + 1, resetAt: data.resetAt });
        }
      }

      refs.forEach((ref, i) => {
        tx.set(ref, { ...next[i], scope: 'login', updatedAt: FieldValue.serverTimestamp() });
      });
      return true;
    });
  } catch (error) {
    console.error('[LoginCodes] rate limit transaction failed:', error);
    return false;
  }
}

// --- Issue ---

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'cooldown' | 'blocked'; retryAfterMs: number };

export async function issueLoginCode(identity: LoginIdentity): Promise<IssueResult> {
  const db = getAdminDb();
  const ref = db.collection(LOGIN_CODES).doc(identityKey(identity));
  const now = Date.now();
  const code = generateOTPCode(6);
  const salt = crypto.randomBytes(16).toString('hex');

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();

    const blockedUntil = data?.blockedUntil?.toMillis?.() ?? 0;
    if (blockedUntil > now) {
      return { ok: false as const, reason: 'blocked' as const, retryAfterMs: blockedUntil - now };
    }
    const lastSentAt = data?.lastSentAt?.toMillis?.() ?? 0;
    if (now - lastSentAt < RESEND_COOLDOWN_MS) {
      return { ok: false as const, reason: 'cooldown' as const, retryAfterMs: RESEND_COOLDOWN_MS - (now - lastSentAt) };
    }

    // A new code always replaces the previous one (and resets its attempts).
    tx.set(ref, {
      kind: identity.kind,
      codeHash: hashOTPCode(code, salt + pepper()),
      salt,
      attempts: 0,
      expiresAt: Timestamp.fromMillis(now + CODE_TTL_MS),
      lastSentAt: Timestamp.fromMillis(now),
      createdAt: FieldValue.serverTimestamp(),
    });
    return { ok: true as const, code };
  });
}

/** Undo the cooldown when delivery failed, so the user can retry right away. */
export async function clearLoginCode(identity: LoginIdentity): Promise<void> {
  await getAdminDb().collection(LOGIN_CODES).doc(identityKey(identity)).delete().catch(() => {});
}

// --- Verify ---

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'blocked'; attemptsLeft?: number };

export async function verifyLoginCode(identity: LoginIdentity, code: string): Promise<VerifyResult> {
  const db = getAdminDb();
  const ref = db.collection(LOGIN_CODES).doc(identityKey(identity));
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const blockedUntil = data?.blockedUntil?.toMillis?.() ?? 0;
    if (blockedUntil > now) return { ok: false as const, reason: 'blocked' as const };
    if (!data || !data.codeHash) return { ok: false as const, reason: 'expired' as const };

    if ((data.expiresAt?.toMillis?.() ?? 0) < now) {
      tx.delete(ref);
      return { ok: false as const, reason: 'expired' as const };
    }

    if (verifyOTPCode(code, data.codeHash, data.salt + pepper())) {
      tx.delete(ref); // single use
      return { ok: true as const };
    }

    const attempts = (data.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      // Burn the code and lock the identity for a while.
      tx.set(ref, {
        kind: data.kind,
        attempts,
        blockedUntil: Timestamp.fromMillis(now + BLOCK_MS),
        lastSentAt: data.lastSentAt ?? null,
      });
      return { ok: false as const, reason: 'blocked' as const };
    }
    tx.update(ref, { attempts });
    return { ok: false as const, reason: 'invalid' as const, attemptsLeft: MAX_ATTEMPTS - attempts };
  });
}
