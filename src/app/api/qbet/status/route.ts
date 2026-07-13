import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { getEntry } from '@/lib/qbet/store';
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

// Public endpoint: resume state for a returning participant + live lock/result
// state (the done screen polls this to flip to the win/lose screen once the
// owner publishes the final result). POST (not GET) so the phone number never
// appears in URLs / server logs.
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`qbet-status:${clientIp}`, RATE_LIMITS.API);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { codeId, phone, token } = body;
    if (!isValidCodeId(codeId)) {
      return NextResponse.json({ error: 'Invalid codeId format' }, { status: 400 });
    }

    const loaded = await loadQBetConfig(codeId);
    if (!loaded) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    const state = {
      locked: isBettingLocked(loaded.config),
      finalResult: loaded.config.finalResult ?? null,
    };

    // Entry lookup is optional — without valid credentials we still return the
    // public lock/result state.
    let entry = null;
    if (
      typeof phone === 'string' && isValidIsraeliMobile(phone) &&
      typeof token === 'string' && token.length >= 16 && token.length <= 64
    ) {
      const row = await getEntry(codeId, normalizePhoneNumber(phone));
      if (row?.verified && row.entryToken && tokensMatch(row.entryToken, token)) {
        entry = {
          fullName: row.fullName,
          verified: true,
          prediction:
            row.predictionHome != null && row.predictionAway != null
              ? { home: row.predictionHome, away: row.predictionAway }
              : null,
        };
      }
    }

    return NextResponse.json({ entry, state });
  } catch (error) {
    console.error('QBet status error:', error);
    return NextResponse.json({ error: 'Status failed' }, { status: 500 });
  }
}
