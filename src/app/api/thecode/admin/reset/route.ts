// /api/thecode/admin/reset — the owner starts a new round (Bearer + ownership).
//   POST { codeId, confirm: 'איפוס', deleteGroups?: true } → { ok, groups }
// With deleteGroups every group is deleted instead (a fresh start: every phone registers again).
// Same reset as the staff screen: points, progress and prizes back to zero; names, emoji,
// selfies and entry codes stay. Logged in the staff log as "מסך הניהול".

import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireCodeOwner } from '@/lib/auth';
import { adminResetGame, isValidCodeId } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try {
    const raw = await request.json();
    body = raw && typeof raw === 'object' ? raw : null;
  } catch {
    body = null;
  }
  if (!body || !isValidCodeId(body.codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, body.codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const res = await adminResetGame(body.codeId, body.confirm, body.deleteGroups === true);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (error) {
    console.error('thecode admin reset error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
