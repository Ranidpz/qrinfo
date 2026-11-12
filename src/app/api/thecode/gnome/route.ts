// GET /api/thecode/gnome?code=… — which adventure a scanned gnome belongs to (for /g/{code}).
// Public, read-only: returns only what is standing in front of the family anyway.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { lookupGnome } from '@/lib/thecode/store';
import type { TheCodeGnomeLookupResponse } from '@/types/thecode-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`thecode-gnome:${getClientIp(request)}`, { maxRequests: 120, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ ok: false, error: 'notFound' }, { status: 429 });
  try {
    const res: TheCodeGnomeLookupResponse = await lookupGnome(request.nextUrl.searchParams.get('code'));
    return NextResponse.json(res, {
      status: res.ok ? 200 : 404,
      headers: { 'Cache-Control': res.ok ? 'private, max-age=30' : 'no-store' },
    });
  } catch (error) {
    console.error('thecode gnome lookup error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
