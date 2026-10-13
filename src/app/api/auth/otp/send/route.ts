import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/auth';
import { parseLoginIdentity } from '@/lib/auth/identity';
import { consumeLimits, issueLoginCode, clearLoginCode, RESEND_COOLDOWN_MS } from '@/lib/auth/loginCodes.server';
import { loginCodeEmail } from '@/lib/auth/emails';
import { sendEmail, isResendConfigured } from '@/lib/resend';
import { isINFORUConfigured } from '@/lib/inforu';
import { guardedSendOTP } from '@/lib/messaging/paidSend';
import { getClientIp, validateOrigin } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
// Global daily caps on top of the per-identity / per-IP limits — a hard ceiling
// on what a bot farm could make us pay for (WhatsApp) or burn (email reputation).
const WHATSAPP_DAILY_CAP = Number(process.env.LOGIN_WHATSAPP_DAILY_CAP) || 300;
const EMAIL_DAILY_CAP = Number(process.env.LOGIN_EMAIL_DAILY_CAP) || 1000;

/**
 * Where the one-click link should land. Only our own production URL, Vercel
 * deployments and localhost — never an arbitrary Host header. Firebase also
 * rejects continue URLs outside the project's authorized domains.
 */
function continueUrlFor(request: NextRequest, locale: string): string | null {
  const origin = request.nextUrl.origin;
  const host = request.nextUrl.hostname;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const trusted =
    (appUrl && origin === new URL(appUrl).origin) ||
    host === 'qr.playzones.app' ||
    host.endsWith('.vercel.app') ||
    host === 'localhost' || host === '127.0.0.1';
  return trusted ? `${origin}/${locale}/login` : null;
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { identifier?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const identity = parseLoginIdentity(body.identifier);
  if (!identity) {
    return NextResponse.json({ error: 'invalid_identifier' }, { status: 400 });
  }
  const locale: 'he' | 'en' = body.locale === 'en' ? 'en' : 'he';

  if (identity.kind === 'email' ? !isResendConfigured() : !isINFORUConfigured()) {
    console.error(`[OTP send] ${identity.kind} delivery is not configured`);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const ip = getClientIp(request);
  const allowed = await consumeLimits([
    { key: `id10m:${identity.kind}:${identity.value}`, max: 3, windowMs: 10 * MIN },
    { key: `idday:${identity.kind}:${identity.value}`, max: 10, windowMs: DAY },
    { key: `ip10m:${ip}`, max: 10, windowMs: 10 * MIN },
    { key: `ipday:${ip}`, max: 40, windowMs: DAY },
    identity.kind === 'phone'
      ? { key: 'global:whatsapp', max: WHATSAPP_DAILY_CAP, windowMs: DAY }
      : { key: 'global:email', max: EMAIL_DAILY_CAP, windowMs: DAY },
  ]);
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const issued = await issueLoginCode(identity);
  if (!issued.ok) {
    return NextResponse.json(
      { error: issued.reason, retryAfterMs: issued.retryAfterMs },
      { status: 429 }
    );
  }

  let delivered = false;
  if (identity.kind === 'email') {
    // Firebase's own magic link, minted server-side and delivered by Resend
    // alongside the code. If the Email-link provider isn't enabled yet (or the
    // domain isn't authorized) the email still goes out with the code alone.
    let link: string | null = null;
    const url = continueUrlFor(request, locale);
    if (url) {
      try {
        link = await getAdminAuth().generateSignInWithEmailLink(identity.value, {
          url,
          handleCodeInApp: true,
        });
      } catch (error) {
        console.warn('[OTP send] email link unavailable, sending code only:', (error as { code?: string })?.code || error);
      }
    }
    const mail = loginCodeEmail({ code: issued.code, link, locale });
    const result = await sendEmail({ to: identity.value, ...mail });
    delivered = result.success;
  } else {
    // Platform login isn't tied to a QR code: the paid-send guard caps and logs it
    // under a fixed pseudo code id (no owner quota is charged).
    const { result } = await guardedSendOTP(
      { codeId: 'platform-login', kind: 'login-otp' },
      identity.value,
      issued.code,
      'whatsapp',
      locale
    );
    delivered = result.success;
  }

  if (!delivered) {
    await clearLoginCode(identity);
    return NextResponse.json({ error: 'delivery_failed' }, { status: 502 });
  }

  // Same answer whether or not an account exists — no user enumeration.
  return NextResponse.json({
    ok: true,
    kind: identity.kind,
    identifier: identity.value,
    resendInMs: RESEND_COOLDOWN_MS,
  });
}
