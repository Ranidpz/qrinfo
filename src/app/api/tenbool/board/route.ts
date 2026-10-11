import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { loadBoard, loadStats } from '@/lib/tenbool/store';
import { errorResponse, isValidCodeId, loadPhoneModeCode } from '@/lib/tenbool/server';

// Public: what the big screen shows - winners (fewest attempts first), the closest list and two
// counters. Names, photos and numbers only; phones never leave the server. The screen polls every
// few seconds, so the response is CDN-cached for 2s (several screens = one origin hit).

const STATS_TTL_MS = 10000;
const statsCache = new Map<string, { at: number; value: { players: number; attempts: number } }>();

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`tenbool-board:${getClientIp(request)}`, { maxRequests: 240, windowMs: 60 * 1000 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const { competition } = await loadPhoneModeCode(codeId);

    const cached = statsCache.get(codeId);
    const statsPromise =
      cached && Date.now() - cached.at < STATS_TTL_MS
        ? Promise.resolve(cached.value)
        : loadStats(codeId).then((value) => {
            statsCache.set(codeId, { at: Date.now(), value });
            return value;
          });
    const [board, stats] = await Promise.all([loadBoard(codeId, competition.boardSize, competition.nearMisses), statsPromise]);

    return NextResponse.json(
      { ...board, stats, boardSize: competition.boardSize, nearMisses: competition.nearMisses },
      { headers: { 'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=4' } }
    );
  } catch (error) {
    return errorResponse(error, 'board');
  }
}
