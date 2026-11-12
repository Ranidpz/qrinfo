// הקוד — the player's network layer. Codes strictly against src/types/thecode-api.ts.
//
// The play transport is injectable (tests / mocks / the demo); the default posts to the
// real route. A transport THROWS only when the request never got an answer (offline,
// timeout) — the hook turns that into "no connection, retry the same action". Any answer
// from the server, even a broken one, becomes a TheCodePlayResponse.

import type {
  TheCodeGnomeLookupResponse,
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
