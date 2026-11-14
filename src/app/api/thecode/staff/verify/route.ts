// POST /api/thecode/staff/verify { codeId, phone, code } — the WhatsApp code → a device session.
// Every failure (wrong code, expired, blocked, phone not on the list) is the SAME `invalid`.

import { NextRequest, NextResponse } from 'next/server';
import { consumeLimits, verifyLoginCode } from '@/lib/auth/loginCodes.server';
import { getClientIp, validateOrigin } from '@/lib/rateLimit';
import { staffCodeIdentity, staffPhone } from '@/lib/thecode/server/staff';
import { isValidCodeId, openStaffSession } from '@/lib/thecode/store';
import type { TheCodeStaffVerifyResponse } from '@/types/thecode-api';

export const dynamic = 'force-dynamic';

function reply(body: TheCodeStaffVerifyResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) return reply({ ok: false, error: 'badRequest' }, 403);
  let body: { codeId?: unknown; phone?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: 'badRequest' }, 400);
  }
  const codeId = body?.codeId;
  const phone = staffPhone(body?.phone);
  const code = typeof body?.code === 'string' ? body.code.replace(/\D/g, '') : '';
  if (!isValidCodeId(codeId) || !phone || code.length !== 6) return reply({ ok: false, error: 'badRequest' }, 400);

  // Each code allows 5 tries; this caps guessing spread over many phones.
  const ip = getClientIp(request);
  if (!(await consumeLimits([{ key: `thecode-staff:verify:${ip}`, max: 40, windowMs: 10 * 60_000 }]))) {
    return reply({ ok: false, error: 'rateLimited' }, 429);
  }

  try {
    const result = await verifyLoginCode(staffCodeIdentity(codeId, phone), code);
    if (!result.ok) return reply({ ok: false, error: 'invalid' }, 400);
    // The list is checked again now: removed between the send and the code → no session.
    const session = await openStaffSession(codeId, phone);
    if (!session) return reply({ ok: false, error: 'invalid' }, 400);
    return reply({ ok: true, ...session });
  } catch (error) {
    console.error('thecode staff verify error:', error);
    return reply({ ok: false, error: 'server' }, 500);
  }
}
