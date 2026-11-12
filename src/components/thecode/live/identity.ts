// הקוד — the device's families for one adventure, in localStorage['thecode_{codeId}'].
// Every storage access is wrapped: in private mode / blocked storage the game still plays in
// this tab (identity kept in memory) and the UI asks the family to write the recovery code down.

import type { TheCodeAuth } from '@/types/thecode-api';

export interface StoredProfile {
  playerId: string;
  token: string;
  familyName: string;
  emoji: string;
  /** Display cache for the switcher (the server is the truth; refreshed on every snapshot). */
  points?: number;
  recoveryCode?: string;
}

export interface StoredIdentity {
  profiles: StoredProfile[];
  activeId: string | null;
}

export const EMPTY_IDENTITY: StoredIdentity = { profiles: [], activeId: null };

const keyFor = (codeId: string) => `thecode_${codeId}`;

function clean(v: unknown): StoredIdentity {
  if (!v || typeof v !== 'object') return EMPTY_IDENTITY;
  const raw = v as { profiles?: unknown; activeId?: unknown };
  const profiles = Array.isArray(raw.profiles)
    ? raw.profiles.filter((p): p is StoredProfile =>
      !!p && typeof p === 'object'
      && typeof (p as StoredProfile).playerId === 'string'
      && typeof (p as StoredProfile).token === 'string')
      .map((p) => ({
        playerId: p.playerId,
        token: p.token,
        familyName: typeof p.familyName === 'string' ? p.familyName : '',
        emoji: typeof p.emoji === 'string' ? p.emoji : '🙂',
        points: typeof p.points === 'number' ? p.points : undefined,
        recoveryCode: typeof p.recoveryCode === 'string' ? p.recoveryCode : undefined,
      }))
    : [];
  const activeId = typeof raw.activeId === 'string' && profiles.some((p) => p.playerId === raw.activeId)
    ? raw.activeId
    : profiles[0]?.playerId ?? null;
  return { profiles, activeId };
}

/** `available: false` → nothing will survive closing this tab. */
export function loadIdentity(codeId: string): { identity: StoredIdentity; available: boolean } {
  try {
    const ls = window.localStorage;
    const probe = `${keyFor(codeId)}__probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    const raw = ls.getItem(keyFor(codeId));
    return { identity: raw ? clean(JSON.parse(raw)) : EMPTY_IDENTITY, available: true };
  } catch {
    return { identity: EMPTY_IDENTITY, available: false };
  }
}

/** Returns false when the write failed (storage full / blocked). */
export function saveIdentity(codeId: string, identity: StoredIdentity): boolean {
  try {
    window.localStorage.setItem(keyFor(codeId), JSON.stringify(identity));
    return true;
  } catch {
    return false;
  }
}

export function activeAuth(identity: StoredIdentity): TheCodeAuth | undefined {
  const p = identity.profiles.find((x) => x.playerId === identity.activeId);
  return p ? { playerId: p.playerId, token: p.token } : undefined;
}

/** Add or refresh a family and make it the active one (recover of a known family updates its token). */
export function upsertProfile(identity: StoredIdentity, p: StoredProfile): StoredIdentity {
  const rest = identity.profiles.filter((x) => x.playerId !== p.playerId);
  return { profiles: [...rest, p], activeId: p.playerId };
}

export function dropProfile(identity: StoredIdentity, playerId: string): StoredIdentity {
  const profiles = identity.profiles.filter((x) => x.playerId !== playerId);
  return { profiles, activeId: identity.activeId === playerId ? null : identity.activeId };
}
