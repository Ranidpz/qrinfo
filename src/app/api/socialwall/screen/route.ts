import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import {
  getControl,
  isValidCodeId,
  listChangedSince,
  listScreen,
  loadSocialWall,
  recordScreenBeat,
  toScreenPost,
} from '@/lib/socialwall/store';
import { authorizeScreen, errorResponse } from '@/lib/socialwall/server';

const LIMIT = { maxRequests: 240, windowMs: 60 * 1000 };
const DELTA_OVERLAP_MS = 3000;

// The big screen (x-sw-screen = screen token from private/secrets). Every visible post comes back
// (group totals count them all); `onScreen`/`eligibleAt` say which are on the wall and when the
// rest go up. ?since=<serverTime> returns only what changed.
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(`socialwall-screen:${getClientIp(request)}`, LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const params = request.nextUrl.searchParams;
    const codeId = params.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    if (!(await authorizeScreen(request, wall))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const now = Date.now();
    const sinceRaw = params.get('since');
    const control = await getControl(codeId);
    if (sinceRaw !== null) {
      const since = Number(sinceRaw);
      if (!Number.isSafeInteger(since) || since < 0) return NextResponse.json({ error: 'Invalid since' }, { status: 400 });
      const { items, truncated } = await listChangedSince(codeId, since);
      return NextResponse.json({
        posts: items.map(({ id, post }) => toScreenPost(id, post, wall.config, now)),
        serverTime: now - DELTA_OVERLAP_MS,
        now,
        truncated,
        control,
      });
    }
    const items = await listScreen(codeId);
    return NextResponse.json({
      posts: items.map(({ id, post }) => toScreenPost(id, post, wall.config, now)),
      serverTime: now - DELTA_OVERLAP_MS,
      now,
      control,
    });
  } catch (error) {
    return errorResponse(error, 'screen');
  }
}

// The screen's heartbeat (every ~30s) so the operator panel can show "screen connected".
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`socialwall-beat:${getClientIp(request)}`, LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    if (!(await authorizeScreen(request, wall))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await recordScreenBeat(codeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'screen-beat');
  }
}
