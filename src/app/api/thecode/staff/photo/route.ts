// /api/thecode/staff/photo — the photo of a group with its prize, taken at the reception desk
// by a staff member (the staff session token, same as /api/thecode/staff).
//   POST multipart: codeId, token, playerId, file (webp/jpeg ≤ 400 KB) → TheCodePhotoResponse
// It hangs off the prize record, is never shown on the board or the big screen, and the daily
// selfie sweep deletes it with the adventure's own retention.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin } from '@/lib/rateLimit';
import { isR2Configured } from '@/lib/r2-storage';
import { checkPhoto } from '@/lib/thecode/server/photo';
import { isValidCodeId, setAwardPhoto, type TheCodePhotoResult } from '@/lib/thecode/store';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, number> = {
  badRequest: 400, tooLarge: 413, badType: 415, empty: 400, unauthorized: 401, notFound: 404,
  selfieOff: 409, rateLimited: 429, notConfigured: 503, server: 500,
};

function fail(error: string) {
  return NextResponse.json({ ok: false, error }, { status: STATUS[error] || 400, headers: { 'Cache-Control': 'no-store' } });
}

function reply(res: TheCodePhotoResult) {
  return res.ok ? NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } }) : fail(res.error);
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) return fail('badRequest');
  if (!checkRateLimit(`thecode-prize-photo:${getClientIp(request)}`, { maxRequests: 60, windowMs: 60_000 }).success) return fail('rateLimited');
  if (!isR2Configured()) return fail('notConfigured');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('badRequest');
  }
  const codeId = form.get('codeId');
  const token = form.get('token');
  const playerId = form.get('playerId');
  const file = form.get('file');
  if (!isValidCodeId(codeId) || typeof token !== 'string' || typeof playerId !== 'string' || !(file instanceof Blob)) {
    return fail('badRequest');
  }
  if (file.size > 400 * 1024) return fail('tooLarge');
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = checkPhoto(bytes);
  if (!check.ok) return fail(check.error);
  try {
    return reply(await setAwardPhoto(codeId, token, playerId, { bytes, contentType: check.type }));
  } catch (error) {
    console.error('thecode prize photo error:', error);
    return fail('server');
  }
}
