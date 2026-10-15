// Shared plumbing for the /api/socialwall/* routes.

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, validateOrigin, type RateLimitConfig } from '@/lib/rateLimit';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { resolveMediaSecret, secretsEqual } from '@/lib/codeSecrets.server';
import { SocialWallError, type LoadedSocialWall } from './store';

// A whole event sits behind one venue NAT, so per-IP ceilings are generous; the real limits are
// per member and durable (post count + gap on the member doc).
export const PUBLIC_LIMIT: RateLimitConfig = { maxRequests: 600, windowMs: 60 * 1000 };
export const JOIN_LIMIT: RateLimitConfig = { maxRequests: 300, windowMs: 60 * 1000 };
export const UPLOAD_LIMIT: RateLimitConfig = { maxRequests: 120, windowMs: 60 * 1000 };

export function guardPublic(request: NextRequest, bucket: string, limit: RateLimitConfig = PUBLIC_LIMIT): NextResponse | null {
  if (!validateOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const rl = checkRateLimit(`socialwall-${bucket}:${getClientIp(request)}`, limit);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests', errorCode: 'RATE_LIMITED' }, { status: 429 });
  return null;
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    throw new SocialWallError('BAD_JSON', 400);
  }
}

/** Known errors -> status + code (+ safe extras); anything else is logged and hidden. */
export function errorResponse(error: unknown, where: string) {
  if (error instanceof SocialWallError) {
    return NextResponse.json({ error: error.code, errorCode: error.code, ...(error.extra || {}) }, { status: error.status });
  }
  console.error(`[socialwall] ${where} error:`, error);
  return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

export const sessionHeader = (request: NextRequest) => request.headers.get('x-sw-session');

/**
 * Operators: the code owner (Firebase ID token, requireCodeOwner) or the on-site staff link
 * (x-sw-mod header = the moderator token from private/secrets). Returns the actor for the audit log.
 */
export async function authorizeOperator(
  request: NextRequest,
  wall: LoadedSocialWall
): Promise<{ actor: string; isOwner: boolean } | { response: NextResponse }> {
  const modKey = request.headers.get('x-sw-mod');
  if (modKey) {
    const expected = await resolveMediaSecret(wall.codeId, wall.media, 'socialWallModeratorToken');
    if (!secretsEqual(expected, modKey)) {
      return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    return { actor: 'mod-link', isOwner: false };
  }
  const auth = await requireCodeOwner(request, wall.codeId);
  if (isAuthError(auth)) return { response: auth.response };
  return { actor: `owner:${auth.uid}`, isOwner: true };
}

export async function authorizeScreen(request: NextRequest, wall: LoadedSocialWall): Promise<boolean> {
  const key = request.headers.get('x-sw-screen');
  if (!key) return false;
  const expected = await resolveMediaSecret(wall.codeId, wall.media, 'socialWallScreenToken');
  return secretsEqual(expected, key);
}
