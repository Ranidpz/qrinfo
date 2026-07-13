import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIp, validateOrigin, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { verifyOTPCode } from '@/lib/verification';
import { getEntry, setOtpAttempts, markVerified } from '@/lib/qbet/store';
import { isValidCodeId } from '@/lib/qbet/server';

const MAX_ATTEMPTS = 5;

// Public endpoint: verify the WhatsApp OTP. On success the entry is marked
// verified and a fresh entry token (device-bound bearer) is returned — the
// client uses it for predict/status calls.
export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qbet-verify:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { codeId, phone, code } = body;
    if (!isValidCodeId(codeId)) {
      return NextResponse.json({ error: 'Invalid codeId format' }, { status: 400 });
    }
    if (typeof phone !== 'string' || !isValidIsraeliMobile(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number', errorCode: 'INVALID_PHONE' },
        { status: 400 }
      );
    }
    if (typeof code !== 'string' || !/^\d{4,8}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code', errorCode: 'INVALID_CODE' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const entry = await getEntry(codeId, normalizedPhone);

    if (!entry || !entry.otpHash) {
      return NextResponse.json(
        { error: 'No verification code found', errorCode: 'NO_CODE_FOUND' },
        { status: 400 }
      );
    }

    if (!entry.otpExpiresAt || new Date() > new Date(entry.otpExpiresAt)) {
      return NextResponse.json(
        { error: 'Code expired', errorCode: 'EXPIRED' },
        { status: 400 }
      );
    }

    if (entry.otpAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many failed attempts', errorCode: 'BLOCKED' },
        { status: 429 }
      );
    }

    if (!verifyOTPCode(code, entry.otpHash)) {
      await setOtpAttempts(codeId, entry.id, entry.otpAttempts + 1);
      return NextResponse.json(
        {
          error: 'Invalid code',
          errorCode: 'INVALID_CODE',
          attemptsLeft: MAX_ATTEMPTS - entry.otpAttempts - 1,
        },
        { status: 400 }
      );
    }

    const entryToken = crypto.randomBytes(16).toString('hex');
    await markVerified(codeId, entry.id, entryToken);

    return NextResponse.json({
      success: true,
      token: entryToken,
      fullName: entry.fullName,
      prediction:
        entry.predictionHome != null && entry.predictionAway != null
          ? { home: entry.predictionHome, away: entry.predictionAway }
          : null,
    });
  } catch (error) {
    console.error('QBet verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
