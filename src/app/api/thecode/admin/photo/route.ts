// DELETE /api/thecode/admin/photo { codeId, playerId } — the operator removes a group's selfie
// (Bearer + requireCodeOwner). → { ok: true, photoUrl: null }

import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireCodeOwner } from '@/lib/auth';
import { isValidCodeId, removePlayerPhoto } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  let body: { codeId?: unknown; playerId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }
  if (!isValidCodeId(body?.codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const res = await removePlayerPhoto(body.codeId, body.playerId);
    const status = res.ok ? 200 : res.error === 'notFound' ? 404 : 400;
    return NextResponse.json(res, { status });
  } catch (error) {
    console.error('thecode admin photo delete error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
