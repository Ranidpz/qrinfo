// /api/thecode/admin — the operator's whole adventure (Bearer token + code ownership).
//   GET ?codeId=…  → TheCodeAdminLoadResponse (never saved → defaults with version 0)
//   PUT            → TheCodeAdminSaveRequest → TheCodeAdminSaveResponse (optimistic locking on version)

import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireCodeOwner } from '@/lib/auth';
import { isValidCodeId, loadAdmin, saveAdventure } from '@/lib/thecode/store';
import type { TheCodeAdminSaveResponse } from '@/types/thecode-api';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
  const codeId = request.nextUrl.searchParams.get('codeId');
  if (!isValidCodeId(codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    return NextResponse.json(await loadAdmin(codeId), { headers: NO_STORE });
  } catch (error) {
    console.error('thecode admin load error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    body = raw && typeof raw === 'object' ? raw : {};
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  }
  const codeId = body.codeId;
  if (!isValidCodeId(codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    const res: TheCodeAdminSaveResponse = await saveAdventure(codeId, body);
    const status = res.ok ? 200 : res.error === 'conflict' ? 409 : res.error === 'invalid' ? 422 : res.error === 'badRequest' ? 400 : 500;
    return NextResponse.json(res, { status, headers: NO_STORE });
  } catch (error) {
    console.error('thecode admin save error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
