import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { resolveMediaSecret, secretsEqual } from '@/lib/codeSecrets.server';

const SCANNER_PIN_FAIL_LIMIT = { maxRequests: 10, windowMs: 5 * 60 * 1000 };
// Durable lockout (Firestore, shared by every serverless instance): after this many wrong PINs
// from one IP for one code, further attempts are refused WITHOUT comparing — so a correct guess
// inside a brute-force run no longer gets in. Keyed per code + IP so an attacker can't lock the
// real door staff out.
const PIN_LOCK = { maxFailures: 10, windowMs: 15 * 60 * 1000 };

function pinLockRef(codeId: string, clientIp: string) {
  const ipHash = createHash('sha256').update(clientIp || 'unknown').digest('hex').slice(0, 16);
  return getAdminDb().collection('rateLimits').doc(`scanner_pin_${codeId}_${ipHash}`);
}

async function isPinLocked(codeId: string, clientIp: string): Promise<boolean> {
  try {
    const data = (await pinLockRef(codeId, clientIp).get()).data();
    return !!data && Number(data.resetAt) > Date.now() && Number(data.failures) >= PIN_LOCK.maxFailures;
  } catch (err) {
    console.error('[scannerAuth] lock read failed:', err);
    return false;
  }
}

async function recordPinFailure(codeId: string, clientIp: string): Promise<void> {
  const ref = pinLockRef(codeId, clientIp);
  try {
    await getAdminDb().runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      const now = Date.now();
      const fresh = !data || Number(data.resetAt) <= now;
      const resetAt = fresh ? now + PIN_LOCK.windowMs : Number(data.resetAt);
      tx.set(ref, {
        failures: fresh ? 1 : Number(data.failures || 0) + 1,
        resetAt,
        expiresAt: new Date(resetAt),
      });
    });
  } catch (err) {
    console.error('[scannerAuth] lock write failed:', err);
  }
}

export type ScannerAccess = 'owner' | 'pin' | 'open';

export type ScannerAuthResult =
  | { ok: true; access: ScannerAccess; shortId?: string }
  | { ok: false; status: number; error: string; code: 'NOT_FOUND' | 'PIN_REQUIRED' | 'PIN_INVALID' | 'RATE_LIMITED' | 'SCANNER_DISABLED' };

/**
 * Who may use the Q.Tag door scanner for a code:
 * - the owner / a collaborator / a super admin (Bearer token), always;
 * - anyone holding the scanner PIN, when the owner set one;
 * - anyone with the link, when no PIN is set ("open" — the owner's choice).
 * When the owner turned the scanner off (`scannerEnabled: false`) only the owner gets in.
 * The PIN is read on the server only (private secrets doc, legacy field as fallback).
 */
export async function authorizeScanner(
  request: NextRequest,
  codeId: string,
  pin: unknown,
  clientIp: string
): Promise<ScannerAuthResult> {
  const db = getAdminDb();
  const codeDoc = await db.collection('codes').doc(codeId).get();
  if (!codeDoc.exists) return { ok: false, status: 404, error: 'Code not found', code: 'NOT_FOUND' };

  const data = codeDoc.data()!;
  const shortId = typeof data.shortId === 'string' ? data.shortId : undefined;

  if (request.headers.get('Authorization')) {
    const authResult = await verifyAuthToken(request);
    if (!('error' in authResult)) {
      const uid = authResult.uid;
      const isCollaborator = Array.isArray(data.collaborators) && data.collaborators.includes(uid);
      if (data.ownerId === uid || isCollaborator) return { ok: true, access: 'owner', shortId };
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.data()?.role === 'super_admin') return { ok: true, access: 'owner', shortId };
    }
  }

  const media = (data.media || []) as Array<Record<string, unknown> & { id?: string }>;
  const qtagMedia = media.find((m) => m.qtagConfig);
  if ((qtagMedia?.qtagConfig as { scannerEnabled?: boolean } | undefined)?.scannerEnabled === false) {
    return { ok: false, status: 403, error: 'Scanner is disabled', code: 'SCANNER_DISABLED' };
  }
  const expectedPin = (await resolveMediaSecret(codeId, qtagMedia, 'scannerPin'))?.trim();

  if (!expectedPin) return { ok: true, access: 'open', shortId };

  if (pin === undefined || pin === null || pin === '') {
    return { ok: false, status: 403, error: 'Scanner PIN required', code: 'PIN_REQUIRED' };
  }
  if (await isPinLocked(codeId, clientIp)) {
    return { ok: false, status: 429, error: 'Too many failed attempts', code: 'RATE_LIMITED' };
  }
  if (!secretsEqual(expectedPin, typeof pin === 'string' ? pin.trim() : pin)) {
    await recordPinFailure(codeId, clientIp);
    const failLimit = checkRateLimit(`scanner-pin-fail:${clientIp}`, SCANNER_PIN_FAIL_LIMIT);
    if (!failLimit.success) return { ok: false, status: 429, error: 'Too many failed attempts', code: 'RATE_LIMITED' };
    return { ok: false, status: 403, error: 'Invalid scanner PIN', code: 'PIN_INVALID' };
  }
  return { ok: true, access: 'pin', shortId };
}
