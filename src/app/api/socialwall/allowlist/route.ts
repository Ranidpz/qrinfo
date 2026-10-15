import { NextRequest, NextResponse } from 'next/server';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { normalizePhoneNumber, isValidIsraeliMobile } from '@/lib/phone-utils';
import { normalizeAllowlistRows } from '@/lib/socialwall/rules';
import {
  audit,
  isValidCodeId,
  listAllowlist,
  loadSocialWall,
  removeAllowlistEntry,
  upsertAllowlist,
} from '@/lib/socialwall/store';
import { errorResponse, readJson } from '@/lib/socialwall/server';

const MAX_ROWS = 20000;
const toPhone = (raw: string) => (isValidIsraeliMobile(raw) ? normalizePhoneNumber(raw) : null);

// Owner only: the HR list of who may join (allowlist access modes). The sheet is parsed in the
// browser; rows arrive as JSON {phone, name?, groupId?}. Phones are personal data — they stay in a
// locked subcollection and are deleted with the event (purge / retention).
export async function GET(request: NextRequest) {
  try {
    const codeId = request.nextUrl.searchParams.get('codeId');
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;
    return NextResponse.json({ entries: await listAllowlist(codeId) });
  } catch (error) {
    return errorResponse(error, 'allowlist-list');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    const { codeId, rows, replace } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;
    if (!Array.isArray(rows) || rows.length > MAX_ROWS) {
      return NextResponse.json({ error: 'Invalid rows' }, { status: 400 });
    }
    const wall = await loadSocialWall(codeId);
    const { entries, rejected } = normalizeAllowlistRows(rows, toPhone, wall.config.groups);
    await upsertAllowlist(codeId, entries, replace === true);
    await audit(codeId, { action: 'allowlist:import', actor: `owner:${auth.uid}`, detail: `${entries.length} rows${replace === true ? ' (replace)' : ''}` });
    return NextResponse.json({ success: true, saved: entries.length, rejected });
  } catch (error) {
    return errorResponse(error, 'allowlist-import');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await readJson(request);
    const { codeId, phone } = body;
    if (!isValidCodeId(codeId)) return NextResponse.json({ error: 'Invalid codeId' }, { status: 400 });
    const auth = await requireCodeOwner(request, codeId);
    if (isAuthError(auth)) return auth.response;
    const normalized = typeof phone === 'string' ? toPhone(phone) : null;
    if (!normalized) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
    await removeAllowlistEntry(codeId, normalized);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'allowlist-delete');
  }
}
