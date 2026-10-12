import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { resolveMediaSecret, secretsEqual } from '@/lib/codeSecrets.server';

const SCANNER_PIN_FAIL_LIMIT = { maxRequests: 10, windowMs: 5 * 60 * 1000 };

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
  if (!secretsEqual(expectedPin, typeof pin === 'string' ? pin.trim() : pin)) {
    const failLimit = checkRateLimit(`scanner-pin-fail:${clientIp}`, SCANNER_PIN_FAIL_LIMIT);
    if (!failLimit.success) return { ok: false, status: 429, error: 'Too many failed attempts', code: 'RATE_LIMITED' };
    return { ok: false, status: 403, error: 'Invalid scanner PIN', code: 'PIN_INVALID' };
  }
  return { ok: true, access: 'pin', shortId };
}
