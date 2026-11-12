// GET /api/thecode/leaderboard?codeId=…&scope=week|all&playerId=… — public board (top 20).
// Hidden and zero-point families are left out. Cached a few seconds at the edge.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isValidCodeId, leaderboard } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`thecode-board:${getClientIp(request)}`, { maxRequests: 240, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ ok: false, error: 'rateLimited' }, { status: 429 });
  const q = request.nextUrl.searchParams;
  const codeId = q.get('codeId');
  const scope = q.get('scope') === 'all' ? 'all' : 'week';
  if (!isValidCodeId(codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  try {
    const res = await leaderboard(codeId, scope, q.get('playerId') || undefined);
    if (!res) return NextResponse.json({ ok: false, error: 'notFound' }, { status: 404 });
    return NextResponse.json(res, { headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' } });
  } catch (error) {
    console.error('thecode leaderboard error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
