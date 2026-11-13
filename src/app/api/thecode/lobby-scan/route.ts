// POST /api/thecode/lobby-scan { codeId } — a phone scanned the QR on the big screen
// (/v/{shortId}?src=lobby). Bumps TheCodeLobbyLive.lobbyScans so the screen plays its
// explainer. Public: same-origin + per-IP and per-code limits (a TV must not be spammable).

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin } from '@/lib/rateLimit';
import { bumpLobbyScan, isValidCodeId } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 403 });
  let codeId: unknown;
  try {
    codeId = (await request.json())?.codeId;
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }
  if (!isValidCodeId(codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const ip = getClientIp(request);
  if (!checkRateLimit(`thecode-lobbyscan:${ip}:${codeId}`, { maxRequests: 6, windowMs: 60_000 }).success ||
      !checkRateLimit(`thecode-lobbyscan-code:${codeId}`, { maxRequests: 120, windowMs: 60_000 }).success) {
    return NextResponse.json({ ok: false, error: 'rateLimited' }, { status: 429 });
  }
  try {
    const ok = await bumpLobbyScan(codeId);
    return NextResponse.json(ok ? { ok: true } : { ok: false, error: 'notFound' }, { status: ok ? 200 : 404 });
  } catch (error) {
    console.error('thecode lobby-scan error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
