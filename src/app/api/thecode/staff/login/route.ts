// POST /api/thecode/staff/login { codeId, phone } — ask for a WhatsApp code for the staff screen.
//
// No phone fishing: the answer is IDENTICAL (body, status and timing) whether the phone is on
// the adventure's staff list or not. The list lookup, the code and the WhatsApp send all run
// in `after()` — once the response has left — so nothing about them can be measured.
// Limits (Firestore, shared by all instances) are consumed for every phone alike.

import { after, NextRequest, NextResponse } from 'next/server';
import { clearLoginCode, consumeLimits, issueLoginCode, RESEND_COOLDOWN_MS } from '@/lib/auth/loginCodes.server';
import { isINFORUConfigured } from '@/lib/inforu';
import { guardedSendOTP } from '@/lib/messaging/paidSend';
import { getClientIp, validateOrigin } from '@/lib/rateLimit';
import { staffCodeIdentity, staffPhone } from '@/lib/thecode/server/staff';
import { isStaffPhone, isValidCodeId } from '@/lib/thecode/store';
import type { TheCodeStaffLoginResponse } from '@/types/thecode-api';

export const dynamic = 'force-dynamic';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 403, headers: NO_STORE });
  let body: { codeId?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400, headers: NO_STORE });
  }
  const codeId = body?.codeId;
  const phone = staffPhone(body?.phone);
  if (!isValidCodeId(codeId) || !phone) return NextResponse.json({ ok: false, error: 'badRequest' }, { status: 400, headers: NO_STORE });
  if (!isINFORUConfigured()) return NextResponse.json({ ok: false, error: 'server' }, { status: 503, headers: NO_STORE });

  // A hotel is ONE public IP, so the per-IP limits are generous; the per-phone ones are not.
  const ip = getClientIp(request);
  const allowed = await consumeLimits([
    { key: `thecode-staff:phone10m:${codeId}:${phone}`, max: 3, windowMs: 10 * MIN },
    { key: `thecode-staff:phoneday:${codeId}:${phone}`, max: 10, windowMs: DAY },
    { key: `thecode-staff:ip10m:${ip}`, max: 20, windowMs: 10 * MIN },
    { key: `thecode-staff:ipday:${ip}`, max: 80, windowMs: DAY },
  ]);
  if (!allowed) return NextResponse.json({ ok: false, error: 'rateLimited' }, { status: 429, headers: NO_STORE });

  after(async () => {
    try {
      if (!(await isStaffPhone(codeId, phone))) return;
      const identity = staffCodeIdentity(codeId, phone);
      const issued = await issueLoginCode(identity);
      if (!issued.ok) return;
      const { result } = await guardedSendOTP({ codeId, kind: 'thecode-staff-otp' }, phone, issued.code, 'whatsapp', 'he');
      if (!result.success) await clearLoginCode(identity);
    } catch (error) {
      console.error('thecode staff login send error:', error);
    }
  });

  const res: TheCodeStaffLoginResponse = { ok: true, resendInMs: RESEND_COOLDOWN_MS };
  return NextResponse.json(res, { headers: NO_STORE });
}
