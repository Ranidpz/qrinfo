import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import type { SocialWallScreenState } from '@/types/socialwall';
import { audit, bumpRev, getControl, isValidCodeId, loadSocialWall, setControl } from '@/lib/socialwall/store';
import { authorizeOperator, errorResponse, readJson } from '@/lib/socialwall/server';

const SCREEN_STATES: SocialWallScreenState[] = ['live', 'frozen', 'slate'];

// Operators: the live switches — uploads open/closed, and the screen (live / frozen / slate = panic).
// Written to RTDB so every phone and the wall react within a second.
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`socialwall-control:${getClientIp(request)}`, { maxRequests: 120, windowMs: 60 * 1000 });
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const body = await readJson(request);
    const { codeId } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const wall = await loadSocialWall(codeId);
    const op = await authorizeOperator(request, wall);
    if ('response' in op) return op.response;

    const patch: { screen?: SocialWallScreenState; uploads?: boolean } = {};
    if (SCREEN_STATES.includes(body.screen as SocialWallScreenState)) patch.screen = body.screen as SocialWallScreenState;
    if (typeof body.uploads === 'boolean') patch.uploads = body.uploads;
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

    await setControl(codeId, patch);
    await audit(codeId, { action: 'control', actor: op.actor, detail: JSON.stringify(patch) });
    await bumpRev(codeId);
    return NextResponse.json({ success: true, control: await getControl(codeId) });
  } catch (error) {
    return errorResponse(error, 'control');
  }
}
