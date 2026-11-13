// הקוד — the player's network layer. Codes strictly against src/types/thecode-api.ts.
//
// The play transport is injectable (tests / mocks / the demo); the default posts to the
// real route. A transport THROWS only when the request never got an answer (offline,
// timeout) — the hook turns that into "no connection, retry the same action". Any answer
// from the server, even a broken one, becomes a TheCodePlayResponse.

import type {
  TheCodeAuth,
  TheCodeGnomeLookupResponse,
  TheCodeLobbyScanRequest,
  TheCodePhotoResponse,
  TheCodeLeaderboardResponse,
  TheCodePlayRequest,
  TheCodePlayResponse,
} from '@/types/thecode-api';

export type TheCodePlayTransport = (req: TheCodePlayRequest) => Promise<TheCodePlayResponse>;

const TIMEOUT_MS = 15000;

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', signal: ctrl?.signal });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isPlayResponse(v: unknown): v is TheCodePlayResponse {
  return !!v && typeof v === 'object' && typeof (v as { ok?: unknown }).ok === 'boolean';
}

export const fetchPlayTransport: TheCodePlayTransport = async (req) => {
  const { status, body } = await fetchJson('/api/thecode/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (isPlayResponse(body)) return body;
  if (status === 429) return { ok: false, error: 'rateLimited' };
  if (status === 404) return { ok: false, error: 'notFound' };
  return { ok: false, error: 'server' };
};

export async function fetchLeaderboard(
  codeId: string,
  scope: 'week' | 'all',
  playerId?: string,
): Promise<TheCodeLeaderboardResponse | null> {
  const q = new URLSearchParams({ codeId, scope });
  if (playerId) q.set('playerId', playerId);
  try {
    const { body } = await fetchJson(`/api/thecode/leaderboard?${q.toString()}`);
    const b = body as TheCodeLeaderboardResponse | null;
    return b && b.ok && Array.isArray(b.rows) ? b : null;
  } catch {
    return null;
  }
}

/** null = no answer (network); `{ok:false}` = the gnome is not in any game. */
export async function lookupGnome(code: string): Promise<TheCodeGnomeLookupResponse | null> {
  try {
    const { status, body } = await fetchJson(`/api/thecode/gnome?code=${encodeURIComponent(code)}`);
    const b = body as TheCodeGnomeLookupResponse | null;
    if (b && typeof b.ok === 'boolean') return b;
    return status === 404 ? { ok: false, error: 'notFound' } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- wave 3

/** /v/{shortId}?src=lobby — tell the big screen someone scanned its QR. Fire once; never throws. */
export async function reportLobbyScan(codeId: string): Promise<boolean> {
  try {
    const { status } = await fetchJson('/api/thecode/lobby-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId } satisfies TheCodeLobbyScanRequest),
    });
    return status >= 200 && status < 300;
  } catch {
    return false;
  }
}

export type PhotoResult =
  | { ok: true; photoUrl: string | null }
  /** 'off' = selfies are switched off for this adventure; 'failed' = anything else. */
  | { ok: false; reason: 'off' | 'failed' };

/** Upload the group's selfie (square webp/jpeg ≤ 400 KB) or, with `blob: null`, remove it. */
export async function sendPhoto(codeId: string, auth: TheCodeAuth, blob: Blob | null): Promise<PhotoResult> {
  try {
    let res: { status: number; body: unknown };
    if (blob) {
      const form = new FormData();
      form.set('codeId', codeId);
      form.set('playerId', auth.playerId);
      form.set('token', auth.token);
      form.set('file', blob, blob.type === 'image/jpeg' ? 'selfie.jpg' : 'selfie.webp');
      res = await fetchJson('/api/thecode/photo', { method: 'POST', body: form });
    } else {
      res = await fetchJson('/api/thecode/photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, auth: { playerId: auth.playerId, token: auth.token } }),
      });
    }
    const b = res.body as TheCodePhotoResponse | { ok: false; error?: string } | null;
    if (b && b.ok) return { ok: true, photoUrl: b.photoUrl };
    const err = (b as { error?: string } | null)?.error;
    return { ok: false, reason: err === 'selfieOff' || res.status === 409 ? 'off' : 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
