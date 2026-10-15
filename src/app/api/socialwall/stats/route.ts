import { NextRequest, NextResponse } from 'next/server';
import { getAuthedMember, groupStats, isValidCodeId, loadSocialWall } from '@/lib/socialwall/store';
import { errorResponse, guardPublic, sessionHeader } from '@/lib/socialwall/server';

// Members only (the event is closed): photos + likes per department for the feed's leaderboard
// card. Every phone asks every ~30s, so one result per code is shared for STATS_TTL_MS.
const STATS_TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: { id: string; posts: number; likes: number }[] }>();

export async function GET(request: NextRequest) {
  const blocked = guardPublic(request, 'stats');
  if (blocked) return blocked;
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    await getAuthedMember(codeId, sessionHeader(request));
    if (!wall.config.groups.length) return NextResponse.json({ groups: [] });

    const hit = cache.get(codeId);
    let stats = hit && Date.now() - hit.at < STATS_TTL_MS ? hit.value : null;
    if (!stats) {
      stats = await groupStats(codeId, wall.config.groups);
      cache.set(codeId, { at: Date.now(), value: stats });
    }
    return NextResponse.json({ groups: stats });
  } catch (error) {
    return errorResponse(error, 'stats');
  }
}
