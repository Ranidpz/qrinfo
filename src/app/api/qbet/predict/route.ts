import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIp, validateOrigin, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { getEntry, savePrediction } from '@/lib/qbet/store';
import { loadQBetConfig, isValidCodeId } from '@/lib/qbet/server';
import { isBettingLocked } from '@/lib/qbet/types';

function tokensMatch(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Public endpoint: save (or update) the participant's score prediction.
// Requires the entry token issued on OTP verification. Predictions can be
// changed until the owner locks betting / publishes the final result.
export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qbet-predict:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { codeId, phone, token, home, away } = body;
    if (!isValidCodeId(codeId)) {
      return NextResponse.json({ error: 'Invalid codeId format' }, { status: 400 });
    }
    if (typeof phone !== 'string' || !isValidIsraeliMobile(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number', errorCode: 'INVALID_PHONE' },
        { status: 400 }
      );
    }
    if (typeof token !== 'string' || token.length < 16 || token.length > 64) {
      return NextResponse.json(
        { error: 'Invalid token', errorCode: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }
    if (
      !Number.isInteger(home) || !Number.isInteger(away) ||
      home < 0 || away < 0 || home > 99 || away > 99
    ) {
      return NextResponse.json(
        { error: 'Invalid score', errorCode: 'INVALID_SCORE' },
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
    const maxGoals = loaded.config.maxGoals ?? 15;
    if (home > maxGoals || away > maxGoals) {
      return NextResponse.json(
        { error: 'Score out of range', errorCode: 'INVALID_SCORE' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const entry = await getEntry(codeId, normalizedPhone);
    if (!entry || !entry.verified || !entry.entryToken || !tokensMatch(entry.entryToken, token)) {
      return NextResponse.json(
        { error: 'Not verified', errorCode: 'NOT_VERIFIED' },
        { status: 401 }
      );
    }

    await savePrediction(codeId, entry.id, home, away);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('QBet predict error:', error);
    return NextResponse.json({ error: 'Failed to save prediction' }, { status: 500 });
  }
}
