import { NextRequest, NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/auth';
import { parseLoginIdentity, type LoginIdentity } from '@/lib/auth/identity';
import { consumeLimits, verifyLoginCode } from '@/lib/auth/loginCodes.server';
import { getClientIp, validateOrigin } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/** Same person → same uid: an email that already signed in with Google gets that account. */
async function findOrCreateUser(identity: LoginIdentity): Promise<UserRecord> {
  const auth = getAdminAuth();
  try {
    return identity.kind === 'email'
      ? await auth.getUserByEmail(identity.value)
      : await auth.getUserByPhoneNumber(identity.value);
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
  }
  return identity.kind === 'email'
    ? auth.createUser({ email: identity.value, emailVerified: true })
    : auth.createUser({ phoneNumber: identity.value });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { identifier?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const identity = parseLoginIdentity(body.identifier);
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (!identity || code.length !== 6) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Each code allows 5 tries; this caps guessing spread across many identities.
  const ip = getClientIp(request);
  if (!(await consumeLimits([{ key: `verify:${ip}`, max: 30, windowMs: 10 * 60 * 1000 }]))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const result = await verifyLoginCode(identity, code);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, attemptsLeft: result.attemptsLeft },
      { status: result.reason === 'blocked' ? 429 : 400 }
    );
  }

  try {
    const user = await findOrCreateUser(identity);
    if (user.disabled) {
      return NextResponse.json({ error: 'disabled' }, { status: 403 });
    }
    // Short-lived, single-purpose: the browser exchanges it for a normal
    // Firebase session (signInWithCustomToken) right away.
    const token = await getAdminAuth().createCustomToken(user.uid, { signup: identity.kind });
    return NextResponse.json({ ok: true, token });
  } catch (error) {
    console.error('[OTP verify] could not mint session:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
