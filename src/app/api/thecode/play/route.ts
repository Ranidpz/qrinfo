// POST /api/thecode/play — every player action of "הקוד" (TheCodePlayRequest → TheCodePlayResponse).
// Public: same-origin + a generous in-memory per-IP limit (a hotel is ONE public IP); the real
// limit is per player (60/min, stored on the player doc) and per IP for register/recover
// (Firestore). All rules are enforced server-side in src/lib/thecode/store.ts.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin } from '@/lib/rateLimit';
import { isValidCodeId, playAction, TheCodeStoreError } from '@/lib/thecode/store';
import type { TheCodePlayAction, TheCodePlayError, TheCodePlayResponse } from '@/types/thecode-api';

export const dynamic = 'force-dynamic';

const ACTIONS = new Set(['state', 'register', 'recover', 'scan', 'answer', 'hint', 'arrangeHelp', 'open', 'newSuitcase', 'updateProfile']);
const IP_LIMIT = { maxRequests: 900, windowMs: 60_000 };

function fail(error: TheCodePlayError, status: number, retryAfterSeconds?: number) {
  const body: TheCodePlayResponse = retryAfterSeconds ? { ok: false, error, retryAfterSeconds } : { ok: false, error };
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (retryAfterSeconds) headers['Retry-After'] = String(retryAfterSeconds);
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) return fail('badRequest', 403);
  const ip = getClientIp(request);
  const rl = checkRateLimit(`thecode-play:${ip}`, IP_LIMIT);
  if (!rl.success) return fail('rateLimited', 429, 30);

  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    body = raw && typeof raw === 'object' ? raw : {};
  } catch {
    return fail('badRequest', 400);
  }
  const { codeId, auth, action } = body as { codeId?: unknown; auth?: unknown; action?: unknown };
  if (!isValidCodeId(codeId)) return fail('badRequest', 400);
  if (!action || typeof action !== 'object' || !ACTIONS.has(String((action as { type?: unknown }).type))) {
    return fail('badRequest', 400);
  }
  let parsedAuth: { playerId: string; token: string } | undefined;
  if (auth !== undefined && auth !== null) {
    const a = auth as { playerId?: unknown; token?: unknown };
    if (typeof a.playerId !== 'string' || typeof a.token !== 'string') return fail('unauthorized', 401);
    parsedAuth = { playerId: a.playerId, token: a.token };
  }

  try {
    const result = await playAction(codeId, parsedAuth, action as TheCodePlayAction, ip);
    const res: TheCodePlayResponse = {
      ok: true,
      serverNow: Date.now(),
      snapshot: result.snapshot,
      ...(result.auth ? { auth: result.auth } : {}),
      ...(result.event ? { event: result.event } : {}),
    };
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TheCodeStoreError && error.code !== 'conflict' && error.code !== 'invalid') {
      return fail(error.code, error.status, error.retryAfterSeconds);
    }
    console.error('thecode play error:', error);
    return fail('server', 500);
  }
}
