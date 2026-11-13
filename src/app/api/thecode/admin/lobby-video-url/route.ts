// POST /api/thecode/admin/lobby-video-url — TheCodeLobbyVideoUrlRequest → a presigned R2 PUT
// for one big-screen slot (Bearer + requireCodeOwner). The browser PUTs the file straight to
// R2 with EXACTLY the declared Content-Type and size (both are signed), then saves
// config.lobby.videos[slot] = publicUrl through the normal adventure save.

import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireCodeOwner } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { isValidCodeId, lobbyVideoUploadUrl } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

const STATUS = { badRequest: 400, tooLarge: 413, notConfigured: 503, notFound: 404 } as const;

export async function POST(request: NextRequest) {
  if (!checkRateLimit(`thecode-lobby-video:${getClientIp(request)}`, { maxRequests: 20, windowMs: 60_000 }).success) {
    return NextResponse.json({ ok: false, error: 'rateLimited' }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    body = raw && typeof raw === 'object' ? raw : {};
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }
  if (!isValidCodeId(body.codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const res = await lobbyVideoUploadUrl(body.codeId, body);
    return NextResponse.json(res, { status: res.ok ? 200 : STATUS[res.error], headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('thecode lobby video url error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
