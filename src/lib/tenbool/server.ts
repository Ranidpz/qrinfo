// Shared plumbing for the /api/tenbool/* routes.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, getClientIp, validateOrigin, type RateLimitConfig } from '@/lib/rateLimit';
import { tenboolCompetition, type TenBoolConfig } from '@/types/tenbool';
import { TenBoolError } from './store';

export function isValidCodeId(codeId: unknown): codeId is string {
  return typeof codeId === 'string' && /^[a-zA-Z0-9]{10,30}$/.test(codeId);
}

// The code's tenbool settings. Phone-mode routes refuse codes that aren't in phone mode,
// so a buzzer game can't be filled with fake players through the API.
export async function loadTenBoolCode(codeId: string) {
  const doc = await getAdminDb().collection('codes').doc(codeId).get();
  if (!doc.exists) throw new TenBoolError('NOT_FOUND', 404);
  const data = doc.data()!;
  const media = (data.media || []).find((m: { type?: string }) => m.type === 'tenbool');
  if (!media) throw new TenBoolError('NOT_FOUND', 404);
  const config = (media.tenboolConfig || {}) as TenBoolConfig;
  return {
    config,
    competition: tenboolCompetition(config),
    shortId: data.shortId as string,
    ownerId: data.ownerId as string,
  };
}

export async function loadPhoneModeCode(codeId: string) {
  const code = await loadTenBoolCode(codeId);
  if (!code.competition.phone) throw new TenBoolError('NOT_PHONE_MODE', 409);
  return code;
}

// Public participant endpoints: same-origin + a per-IP limit. A whole event can sit behind one
// venue NAT, so the per-IP ceiling is generous; per-player pacing is enforced in the store.
export function guardPublic(request: NextRequest, bucket: string, limit: RateLimitConfig): NextResponse | null {
  if (!validateOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const rl = checkRateLimit(`tenbool-${bucket}:${getClientIp(request)}`, limit);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests', errorCode: 'RATE_LIMITED' }, { status: 429 });
  return null;
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    throw new TenBoolError('BAD_JSON', 400);
  }
}

// Known errors -> their status + code; anything else is logged and hidden (no stack traces out)
export function errorResponse(error: unknown, where: string) {
  if (error instanceof TenBoolError) {
    return NextResponse.json({ error: error.code, errorCode: error.code }, { status: error.status });
  }
  console.error(`tenbool ${where} error:`, error);
  return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

export const PLAY_LIMIT: RateLimitConfig = { maxRequests: 600, windowMs: 60 * 1000 };
