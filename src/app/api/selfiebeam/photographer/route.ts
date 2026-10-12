import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { resolveMediaSecret, secretsEqual } from '@/lib/codeSecrets.server';

// Wrong guesses are cheap to make, so cap them per IP.
const VERIFY_LIMIT = { maxRequests: 30, windowMs: 5 * 60 * 1000 };

/**
 * Does `pk` unlock Selfie Beam photographer mode for this code?
 * The token is never sent to the browser — the viewer asks here instead of comparing locally.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`selfiebeam-pk:${getClientIp(request)}`, VERIFY_LIMIT);
    if (!rateLimit.success) {
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
    }

    const { codeId, pk } = await request.json();
    if (typeof codeId !== 'string' || !codeId || typeof pk !== 'string' || !pk) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const snap = await getAdminDb().collection('codes').doc(codeId).get();
    const media = (snap.data()?.media || []) as Array<Record<string, unknown> & { id?: string }>;
    const beam = media.find((m) => m.type === 'selfiebeam' && m.selfiebeamContent);
    const expected = await resolveMediaSecret(codeId, beam, 'photographerToken');

    return NextResponse.json({ ok: secretsEqual(expected, pk) });
  } catch (error) {
    console.error('Selfie Beam photographer verify error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
