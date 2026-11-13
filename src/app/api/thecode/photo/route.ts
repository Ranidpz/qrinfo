// /api/thecode/photo — a group's own selfie (TheCodeAuth = playerId + token).
//   POST   multipart: codeId, playerId, token, file (webp/jpeg ≤ 400 KB) → TheCodePhotoResponse
//   DELETE JSON { codeId, auth: { playerId, token } }                     → { ok, photoUrl: null }
// Refused (409 selfieOff) while the operator has selfies off. Stored in R2 under
// {ownerId}/thecode-{shortId}/selfies/; the previous photo is deleted on replace.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin } from '@/lib/rateLimit';
import { isR2Configured } from '@/lib/r2-storage';
import { checkPhoto } from '@/lib/thecode/server/photo';
import { isValidCodeId, removePlayerPhoto, setPlayerPhoto, type TheCodePhotoResult } from '@/lib/thecode/store';

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

function guard(request: NextRequest): NextResponse | null {
  if (!validateOrigin(request)) return fail('badRequest');
  if (!checkRateLimit(`thecode-photo:${getClientIp(request)}`, { maxRequests: 60, windowMs: 60_000 }).success) return fail('rateLimited');
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = guard(request);
  if (blocked) return blocked;
  if (!isR2Configured()) return fail('notConfigured');
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('badRequest');
  }
  const codeId = form.get('codeId');
  const playerId = form.get('playerId');
  const token = form.get('token');
  const file = form.get('file');
  if (!isValidCodeId(codeId) || typeof playerId !== 'string' || typeof token !== 'string' || !(file instanceof Blob)) {
    return fail('badRequest');
  }
  // Per group: a few retakes are fine, a loop is not.
  if (!checkRateLimit(`thecode-photo-player:${playerId}`, { maxRequests: 10, windowMs: 10 * 60_000 }).success) return fail('rateLimited');
  if (file.size > 400 * 1024) return fail('tooLarge');
  const bytes = Buffer.from(await file.arrayBuffer());
  const check = checkPhoto(bytes);
  if (!check.ok) return fail(check.error);
  try {
    return reply(await setPlayerPhoto(codeId, { playerId, token }, { bytes, contentType: check.type }));
  } catch (error) {
    console.error('thecode photo upload error:', error);
    return fail('server');
  }
}

export async function DELETE(request: NextRequest) {
  const blocked = guard(request);
  if (blocked) return blocked;
  let body: { codeId?: unknown; auth?: { playerId?: unknown; token?: unknown } };
  try {
    body = await request.json();
  } catch {
    return fail('badRequest');
  }
  const a = body?.auth;
  if (!isValidCodeId(body?.codeId) || typeof a?.playerId !== 'string' || typeof a?.token !== 'string') return fail('badRequest');
  try {
    return reply(await removePlayerPhoto(body.codeId, a.playerId, { playerId: a.playerId, token: a.token }));
  } catch (error) {
    console.error('thecode photo delete error:', error);
    return fail('server');
  }
}
