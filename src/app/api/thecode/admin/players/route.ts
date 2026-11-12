// /api/thecode/admin/players — the operator manages families on the board (Bearer + ownership).
//   PATCH  { codeId, playerId, patch: { familyName?, hidden? } } → { ok, player }
//   DELETE { codeId, playerId }                                  → { ok }

import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireCodeOwner } from '@/lib/auth';
import { deletePlayer, isValidCodeId, patchPlayer } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const raw = await request.json();
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

const STATUS = { notFound: 404, invalidName: 400, badRequest: 400 } as const;

export async function PATCH(request: NextRequest) {
  const body = await readBody(request);
  if (!body || !isValidCodeId(body.codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const res = await patchPlayer(body.codeId, body.playerId, body.patch);
    return NextResponse.json(res, { status: res.ok ? 200 : STATUS[res.error] });
  } catch (error) {
    console.error('thecode admin player patch error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await readBody(request);
  if (!body || !isValidCodeId(body.codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const res = await deletePlayer(body.codeId, body.playerId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (error) {
    console.error('thecode admin player delete error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
