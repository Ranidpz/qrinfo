// POST /api/thecode/staff { codeId, token, action } — the venue staff screen (groups only).
// The token is a device session from /api/thecode/staff/verify; it travels in the BODY (never a
// URL) and is re-checked against the current staff list on every call (src/lib/thecode/store.ts).

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin } from '@/lib/rateLimit';
import { isValidCodeId, staffAction } from '@/lib/thecode/store';
import type { TheCodeStaffAction, TheCodeStaffResponse } from '@/types/thecode-api';

export const dynamic = 'force-dynamic';

const ACTIONS = new Set(['list', 'profile', 'rename', 'hide', 'removePhoto', 'logout']);
const STATUS = { unauthorized: 401, notFound: 404, invalidName: 400, badRequest: 400, rateLimited: 429, server: 500 } as const;

function reply(body: TheCodeStaffResponse) {
  return NextResponse.json(body, { status: body.ok ? 200 : STATUS[body.error], headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 403 });
  const rl = checkRateLimit(`thecode-staff:${getClientIp(request)}`, { maxRequests: 300, windowMs: 60_000 });
  if (!rl.success) return reply({ ok: false, error: 'rateLimited' });

  let body: { codeId?: unknown; token?: unknown; action?: unknown };
  try {
    const raw = await request.json();
    body = raw && typeof raw === 'object' ? raw : {};
  } catch {
    return reply({ ok: false, error: 'badRequest' });
  }
  const action = body.action as { type?: unknown } | undefined;
  if (!isValidCodeId(body.codeId) || !action || typeof action !== 'object' || !ACTIONS.has(String(action.type))) {
    return reply({ ok: false, error: 'badRequest' });
  }
  try {
    return reply(await staffAction(body.codeId, body.token, action as TheCodeStaffAction));
  } catch (error) {
    console.error('thecode staff action error:', error);
    return reply({ ok: false, error: 'server' });
  }
}
