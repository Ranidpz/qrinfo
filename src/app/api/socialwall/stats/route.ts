import { NextRequest, NextResponse } from 'next/server';
import { eventTotals, getAuthedMember, groupStats, isValidCodeId, loadSocialWall } from '@/lib/socialwall/store';
import { errorResponse, guardPublic, sessionHeader } from '@/lib/socialwall/server';

// Members only (the event is closed): photos + likes per department and for the whole event, for
// the feed's cheer posts. Every phone asks every ~30s, so one result per code is shared for STATS_TTL_MS.
const STATS_TTL_MS = 15_000;
type Stats = { groups: { id: string; posts: number; likes: number }[]; totals: { posts: number; likes: number } };
const cache = new Map<string, { at: number; value: Stats }>();

export async function GET(request: NextRequest) {
  const blocked = guardPublic(request, 'stats');
  if (blocked) return blocked;
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    await getAuthedMember(codeId, sessionHeader(request));
    const hit = cache.get(codeId);
    let stats = hit && Date.now() - hit.at < STATS_TTL_MS ? hit.value : null;
    if (!stats) {
      const [groups, totals] = await Promise.all([groupStats(codeId, wall.config.groups), eventTotals(codeId)]);
      stats = { groups, totals };
      cache.set(codeId, { at: Date.now(), value: stats });
    }
    return NextResponse.json(stats);
  } catch (error) {
    return errorResponse(error, 'stats');
  }
}
