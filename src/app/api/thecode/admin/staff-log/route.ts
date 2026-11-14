// GET /api/thecode/admin/staff-log?codeId= — the operator reads who did what on the staff screen.

import { NextRequest, NextResponse } from 'next/server';
import { isAuthError, requireCodeOwner } from '@/lib/auth';
import { isValidCodeId, loadStaffLog } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const codeId = request.nextUrl.searchParams.get('codeId');
  if (!isValidCodeId(codeId)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400 });
  const auth = await requireCodeOwner(request, codeId);
  if (isAuthError(auth)) return auth.response;
  try {
    return NextResponse.json({ ok: true, entries: await loadStaffLog(codeId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('thecode staff log error:', error);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
