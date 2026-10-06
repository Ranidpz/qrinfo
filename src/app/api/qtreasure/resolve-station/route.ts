import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rateLimit';
import { resolveTreasureStation } from '@/lib/qtreasure/store';

/**
 * Resolve a station shortId → its parent Q.Treasure game.
 * Used when someone scans a station QR directly. Backed by two indexed shortId
 * lookups (see resolveTreasureStation) instead of a full `codes` collection scan.
 */
export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!checkRateLimit(`qtreasure-resolve:${ip}`, RATE_LIMITS.CHECKIN).success) {
      return NextResponse.json({ found: false, error: 'RATE_LIMITED' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const stationShortId = searchParams.get('stationShortId');
    if (!stationShortId) {
      return NextResponse.json(
        { found: false, error: 'Missing stationShortId parameter' },
        { status: 400 }
      );
    }

    const result = await resolveTreasureStation(stationShortId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error resolving station:', error);
    return NextResponse.json(
      { found: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
