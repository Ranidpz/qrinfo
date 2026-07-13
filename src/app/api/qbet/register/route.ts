import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { generateOTPCode, hashOTPCode } from '@/lib/verification';
import { sendOTP } from '@/lib/inforu';
import { getEntry, upsertRegistration } from '@/lib/qbet/store';
import { loadQBetConfig, isValidCodeId } from '@/lib/qbet/server';
import { isBettingLocked } from '@/lib/qbet/types';

const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 45;

// Public endpoint: register (or re-register) a participant and send a WhatsApp
// OTP. The entry is upserted in the qbetEntries subcollection with
// verified/prediction preserved, so re-registering only re-proves phone
// ownership (e.g. on a new device).
export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qbet-register:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { codeId, phone } = body;
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const locale = body.locale === 'en' ? 'en' : 'he';

    if (!isValidCodeId(codeId)) {
      return NextResponse.json({ error: 'Invalid codeId format' }, { status: 400 });
    }
    if (fullName.length < 2 || fullName.length > 60) {
      return NextResponse.json(
        { error: 'Invalid name', errorCode: 'INVALID_NAME' },
        { status: 400 }
      );
    }
    if (typeof phone !== 'string' || !isValidIsraeliMobile(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number', errorCode: 'INVALID_PHONE' },
        { status: 400 }
      );
    }

    const loaded = await loadQBetConfig(codeId);
    if (!loaded) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }
    if (isBettingLocked(loaded.config)) {
      return NextResponse.json(
        { error: 'Betting is locked', errorCode: 'LOCKED' },
        { status: 409 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const phoneDigits = normalizedPhone.replace(/\D/g, '');

    // Per-phone send throttle (in-memory) + durable per-entry cooldown (Firestore)
    const phoneRateLimit = checkRateLimit(`qbet-otp:${phoneDigits}`, {
      maxRequests: 3,
      windowMs: 5 * 60 * 1000,
    });
    if (!phoneRateLimit.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts', errorCode: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    const existing = await getEntry(codeId, normalizedPhone);
    if (existing?.otpLastSentAt) {
      const elapsed = (Date.now() - new Date(existing.otpLastSentAt).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          {
            error: 'Please wait before requesting another code',
            errorCode: 'COOLDOWN',
            secondsLeft: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
          },
          { status: 429 }
        );
      }
    }

    const otp = generateOTPCode(OTP_LENGTH);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await upsertRegistration({
      codeId,
      phone: normalizedPhone,
      fullName,
      locale,
      otpHash: hashOTPCode(otp),
      otpExpiresAt,
    });

    const sendResult = await sendOTP(normalizedPhone, otp, 'whatsapp', locale);
    if (!sendResult.result.success) {
      return NextResponse.json(
        { error: 'Failed to send verification code', errorCode: 'SEND_FAILED' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      method: sendResult.methodUsed,
      expiresAt: otpExpiresAt.toISOString(),
      codeLength: OTP_LENGTH,
    });
  } catch (error) {
    console.error('QBet register error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
