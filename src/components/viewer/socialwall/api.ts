// Social Wall participant API client. Every call is idempotent on the server (likes carry the
// desired state, uploads carry a phone-made post id), so network failures and 5xx are retried
// with backoff; a 4xx is an answer, not a failure, and is thrown at once.

import type { SocialWallPostView } from '@/types/socialwall';

export class SwApiError extends Error {
  constructor(public code: string, public status: number, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS = [700, 2000, 5000];

function isRetryable(error: unknown) {
  return !(error instanceof SwApiError) || error.status >= 500 || error.code === 'OFFLINE';
}

async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_DELAYS.length): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) throw error;
      await sleep(RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]);
    }
  }
}

async function parse(res: Response) {
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const { errorCode, error, ...extra } = data;
    throw new SwApiError(String(errorCode || error || `HTTP_${res.status}`), res.status, extra);
  }
  return data;
}

async function request(path: string, init: RequestInit & { session?: string | null }) {
  const headers = new Headers(init.headers);
  if (init.session) headers.set('x-sw-session', init.session);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new SwApiError('OFFLINE', 0);
  }
  return parse(res);
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export interface JoinResult {
  session: string;
  memberId: string;
  name: string;
  groupId: string | null;
  needsProfile: boolean;
}

export const swApi = {
  join: (body: Record<string, unknown>) =>
    request('/api/socialwall/join', json(body)) as unknown as Promise<JoinResult & { codeLength?: number; cooldownSeconds?: number }>,

  me: (codeId: string, session: string) =>
    withRetry(() => request(`/api/socialwall/me?codeId=${encodeURIComponent(codeId)}`, { session })) as Promise<{
      memberId: string;
      name: string;
      groupId: string | null;
      postCount: number;
      postsLeft: number;
      needsProfile: boolean;
      control: { screen: string; uploads: boolean };
    }>,

  updateProfile: (codeId: string, session: string, profile: { name?: string; groupId?: string | null }) =>
    withRetry(() => request('/api/socialwall/me', { ...json({ codeId, ...profile }), session })) as Promise<{
      name: string;
      groupId: string | null;
      needsProfile: boolean;
    }>,

  feed: (codeId: string, session: string, opts: { group?: string | null; cursor?: string | null; since?: number }) => {
    const q = new URLSearchParams({ codeId });
    if (opts.group) q.set('group', opts.group);
    if (opts.cursor) q.set('cursor', opts.cursor);
    if (opts.since !== undefined) q.set('since', String(opts.since));
    return withRetry(() => request(`/api/socialwall/feed?${q}`, { session })) as Promise<{
      posts: (SocialWallPostView | { id: string; removed: true })[];
      nextCursor?: string | null;
      serverTime: number;
      truncated?: boolean;
    }>;
  },

  mine: (codeId: string, session: string) =>
    withRetry(() => request(`/api/socialwall/posts?codeId=${encodeURIComponent(codeId)}`, { session })) as Promise<{
      posts: SocialWallPostView[];
    }>,

  like: (codeId: string, session: string, postId: string, on: boolean) =>
    withRetry(() => request('/api/socialwall/like', { ...json({ codeId, postId, on }), session })) as Promise<{
      liked: boolean;
      likeCount: number;
    }>,

  stats: (codeId: string, session: string) =>
    request(`/api/socialwall/stats?codeId=${encodeURIComponent(codeId)}`, { session }) as Promise<{
      groups: { id: string; posts: number; likes: number }[];
      totals?: { posts: number; likes: number };
    }>,

  deletePost: (codeId: string, session: string, postId: string) =>
    withRetry(() => request('/api/socialwall/posts', { ...json({ codeId, postId }), method: 'DELETE', session })),
};

/**
 * Upload with progress (fetch has no upload progress). Retries network failures, 5xx and the
 * server's "too fast" answer; the same postId makes every retry safe.
 */
export async function uploadPost(params: {
  codeId: string;
  session: string;
  postId: string;
  caption: string;
  file: Blob;
  onProgress: (fraction: number) => void;
}): Promise<{ post: SocialWallPostView; postsLeft: number }> {
  const once = () =>
    new Promise<{ post: SocialWallPostView; postsLeft: number }>((resolve, reject) => {
      const form = new FormData();
      form.append('codeId', params.codeId);
      form.append('postId', params.postId);
      form.append('caption', params.caption);
      form.append('file', params.file, 'photo');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/socialwall/posts');
      xhr.setRequestHeader('x-sw-session', params.session);
      xhr.timeout = 90_000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) params.onProgress(Math.min(0.95, e.loaded / e.total));
      };
      xhr.onload = () => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch {
          /* non-JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          params.onProgress(1);
          resolve(data as unknown as { post: SocialWallPostView; postsLeft: number });
        } else {
          const { errorCode, error, ...extra } = data;
          reject(new SwApiError(String(errorCode || error || `HTTP_${xhr.status}`), xhr.status, extra));
        }
      };
      xhr.onerror = () => reject(new SwApiError('OFFLINE', 0));
      xhr.ontimeout = () => reject(new SwApiError('OFFLINE', 0));
      xhr.send(form);
    });

  for (let attempt = 0; ; attempt++) {
    try {
      return await once();
    } catch (error) {
      const tooFast = error instanceof SwApiError && error.code === 'TOO_FAST';
      if (attempt >= 3 || (!isRetryable(error) && !tooFast)) throw error;
      const wait = tooFast ? Number((error as SwApiError).extra.retryAfterMs) || 3000 : RETRY_DELAYS[Math.min(attempt, 2)];
      params.onProgress(0);
      await sleep(wait + 200);
    }
  }
}

/** RFC 4122 v4 — crypto.randomUUID where available, getRandomValues otherwise (older iOS). */
export function newPostId(): string {
  const c: Crypto = crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---- session (per code, this browser) ----

export interface StoredSession {
  session: string;
  memberId: string;
  name: string;
  groupId: string | null;
}

const sessionKey = (codeId: string) => `sw_session_${codeId}`;

export function loadSession(codeId: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(sessionKey(codeId));
    if (!raw) return null;
    const s = JSON.parse(raw);
    return typeof s?.session === 'string' && typeof s?.memberId === 'string' ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(codeId: string, s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(sessionKey(codeId), JSON.stringify(s));
    else localStorage.removeItem(sessionKey(codeId));
  } catch {
    /* private mode — the session lives for this tab only */
  }
}
