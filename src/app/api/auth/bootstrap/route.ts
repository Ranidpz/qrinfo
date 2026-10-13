import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { STORAGE_LIMITS } from '@/types';
import type { SignupMethod } from '@/lib/auth/approval';

export const dynamic = 'force-dynamic';

/**
 * Create the caller's users/{uid} profile on first sign-in (any method).
 * Profiles are created ONLY here (firestore.rules forbid client creation), so a
 * browser can't skip the approval gate by writing its own doc without `status`.
 * Idempotent: an existing profile is returned untouched.
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(header.slice(7));
  } catch {
    return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
  }

  const db = getAdminDb();
  const ref = db.collection('users').doc(decoded.uid);

  try {
    const existing = await ref.get();
    if (existing.exists) {
      return NextResponse.json({ ok: true, created: false });
    }

    const record = await getAdminAuth().getUser(decoded.uid);
    const provider = decoded.firebase?.sign_in_provider;
    const method: SignupMethod =
      provider === 'google.com' ? 'google'
        : decoded.signup === 'phone' || (!record.email && record.phoneNumber) ? 'phone'
          : 'email';

    const displayName =
      record.displayName ||
      (method === 'google' && record.email ? record.email.split('@')[0] : '');

    try {
      await ref.create({
        email: record.email || '',
        ...(record.phoneNumber ? { phone: record.phoneNumber } : {}),
        displayName,
        role: 'free',
        storageLimit: STORAGE_LIMITS.free,
        storageUsed: 0,
        status: 'pending',
        signupMethod: method,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      // Two tabs / listeners racing: the other call already created it.
      if ((error as { code?: number })?.code !== 6) throw error;
      return NextResponse.json({ ok: true, created: false });
    }

    return NextResponse.json({ ok: true, created: true });
  } catch (error) {
    console.error('[Auth bootstrap] failed:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
