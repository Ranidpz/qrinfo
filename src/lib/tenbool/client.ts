'use client';

// Browser side of 10 בול phone mode: this phone's player identity + the /api/tenbool calls.

export interface PlayerIdentity {
  playerId: string;
  token: string;
}

const storageKey = (codeId: string) => `tenbool_${codeId}`;

// localStorage can throw (private mode, blocked storage) - the game then still plays, it just
// gets a fresh identity on the next visit
export function loadIdentity(codeId: string): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(storageKey(codeId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.playerId && parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function saveIdentity(codeId: string, identity: PlayerIdentity) {
  try {
    localStorage.setItem(storageKey(codeId), JSON.stringify(identity));
  } catch {
    // see loadIdentity
  }
}

export function clearIdentity(codeId: string) {
  try {
    localStorage.removeItem(storageKey(codeId));
  } catch {
    // see loadIdentity
  }
}

export class ApiError extends Error {
  constructor(public code: string, public status: number, public data: Record<string, unknown> = {}) {
    super(code);
  }
}

async function post<T>(path: string, body: Record<string, unknown> | FormData): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(path, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.errorCode || data.error || 'ERROR', res.status, data);
  return data as T;
}

export interface StartRoundResponse {
  playerId?: string;
  token?: string;
  nickname?: string;
  roundId?: string;
  attempt: number;
  won?: true;
}

export interface FinishRoundResponse {
  verdict: 'ok' | 'bad-ms' | 'too-fast' | 'stale';
  diff: number | null;
  won: boolean;
  justWon: boolean;
  attempts: number;
  near: boolean;
  improved: boolean;
}

export interface PlayerStatus {
  attempts: number;
  nickname: string;
  nicknameSet: boolean;
  won: boolean;
  wonAttempts: number | null;
  claimed: boolean;
  verified: boolean;
  hidden: boolean;
  hasPhoto: boolean;
  bestDiff: number | null;
  place: number | null;
  verifyWinners: boolean;
}

export const tenboolApi = {
  startRound: (codeId: string, id: PlayerIdentity | null) =>
    post<StartRoundResponse>('/api/tenbool/round', { codeId, playerId: id?.playerId ?? null, token: id?.token ?? null }),
  finishRound: (codeId: string, id: PlayerIdentity, roundId: string, ms: number) =>
    post<FinishRoundResponse>('/api/tenbool/result', { codeId, ...id, roundId, ms }),
  me: (codeId: string, id: PlayerIdentity) => post<PlayerStatus>('/api/tenbool/me', { codeId, ...id }),
  setName: (codeId: string, id: PlayerIdentity, nickname: string) =>
    post<{ nickname: string }>('/api/tenbool/name', { codeId, ...id, nickname }),
  sendCode: (codeId: string, id: PlayerIdentity, phone: string) =>
    post<{ codeLength: number; cooldownSeconds: number }>('/api/tenbool/otp', { codeId, ...id, action: 'send', phone }),
  verifyCode: (codeId: string, id: PlayerIdentity, code: string) =>
    post<{ verified: boolean }>('/api/tenbool/otp', { codeId, ...id, action: 'verify', code }),
  claim: (codeId: string, id: PlayerIdentity, nickname: string, photo: Blob | null) => {
    const form = new FormData();
    form.append('codeId', codeId);
    form.append('playerId', id.playerId);
    form.append('token', id.token);
    form.append('nickname', nickname);
    if (photo) form.append('photo', photo, photo.type === 'image/jpeg' ? 'selfie.jpg' : 'selfie.webp');
    return post<{ place: number | null; nickname: string; photoUrl: string | null }>('/api/tenbool/claim', form);
  },
};

export interface BoardData {
  winners: { id: string; name: string; photoUrl: string | null; attempts: number; wonAt: number }[];
  near: { id: string; name: string; diff: number }[];
  stats: { players: number; attempts: number };
  boardSize: number;
  nearMisses: boolean;
}

export async function fetchBoard(codeId: string): Promise<BoardData> {
  const res = await fetch(`/api/tenbool/board?codeId=${encodeURIComponent(codeId)}`, { cache: 'no-store' });
  if (!res.ok) throw new ApiError('BOARD', res.status);
  return res.json();
}
