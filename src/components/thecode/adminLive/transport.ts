// הקוד admin — the transport: every byte the live admin sends or receives goes through ONE of
// these functions, so the hook can be driven by a fake (memoryTransport.ts) in the demo and in
// tests. The HTTP one codes strictly against src/types/thecode-api.ts.
//
// Firebase is imported lazily (inside the HTTP transport) so the demo route never pulls the
// client SDK — it has no env and would fail to initialise.

import type {
  TheCodeAdminLoadResponse,
  TheCodeAdminPlayerDeleteRequest,
  TheCodeAdminPlayerPatchRequest,
  TheCodeAdminSaveRequest,
  TheCodeAdminSaveResponse,
} from '@/types/thecode-api';
import { compressImage } from '@/lib/imageCompression';

export type LoadError = 'unauthorized' | 'forbidden' | 'notFound' | 'network' | 'server';

export type LoadResult = { ok: true; data: TheCodeAdminLoadResponse } | { ok: false; error: LoadError };

/** The contract's save response, plus what the network itself can do to us. */
export type SaveResult = TheCodeAdminSaveResponse | { ok: false; error: 'network' | 'unauthorized' | 'forbidden' };

export type PlayerResult = { ok: true } | { ok: false; error: 'network' | 'server' | 'forbidden' };

export interface TheCodeAdminTransport {
  load(codeId: string): Promise<LoadResult>;
  save(req: TheCodeAdminSaveRequest): Promise<SaveResult>;
  /**
   * Last-chance save while the page is being closed (pagehide). Must not await anything;
   * returns false when it could not even try (no cached token, body too big for keepalive).
   */
  saveOnExit?(req: TheCodeAdminSaveRequest): boolean;
  patchPlayer(req: TheCodeAdminPlayerPatchRequest): Promise<PlayerResult>;
  deletePlayer(req: TheCodeAdminPlayerDeleteRequest): Promise<PlayerResult>;
  /** Compress + upload one image for this adventure; resolves to its public URL. */
  uploadImage(codeId: string, file: File, onProgress: (fraction: number) => void): Promise<string>;
}

const ADMIN = '/api/thecode/admin';
/** Browsers cap keepalive request bodies at 64 KB (all in flight together). */
const KEEPALIVE_LIMIT = 60 * 1024;

function httpError(status: number): LoadError {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  // 400 = codeId missing/invalid or the code is not a "הקוד" code; 404 = no such code.
  if (status === 404 || status === 400) return 'notFound';
  return 'server';
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The real one: Bearer token (fetchWithAuth) → /api/thecode/admin + /api/raffle/upload. */
export function createHttpTransport(): TheCodeAdminTransport {
  // Cached for saveOnExit (a closing page cannot await getIdToken). Refreshed on every call.
  let lastToken: string | null = null;

  const authed = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const { getAuthHeader } = await import('@/lib/fetchWithAuth');
    const header = await getAuthHeader();
    lastToken = header;
    const headers = new Headers(init.headers);
    headers.set('Authorization', header);
    return fetch(url, { ...init, headers, cache: 'no-store' });
  };

  return {
    async load(codeId) {
      let res: Response;
      try {
        res = await authed(`${ADMIN}?codeId=${encodeURIComponent(codeId)}`);
      } catch (e) {
        return { ok: false, error: e instanceof Error && e.message === 'Not authenticated' ? 'unauthorized' : 'network' };
      }
      if (!res.ok) return { ok: false, error: httpError(res.status) };
      const data = await readJson<TheCodeAdminLoadResponse>(res);
      return data?.ok ? { ok: true, data } : { ok: false, error: 'server' };
    },

    async save(req) {
      let res: Response;
      try {
        res = await authed(ADMIN, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
      } catch (e) {
        return { ok: false, error: e instanceof Error && e.message === 'Not authenticated' ? 'unauthorized' : 'network' };
      }
      // 409 / 422 / 400 still carry a contract body — read it before looking at the status.
      const body = await readJson<TheCodeAdminSaveResponse>(res);
      if (body && typeof body === 'object' && 'ok' in body) return body;
      if (res.status === 401) return { ok: false, error: 'unauthorized' };
      if (res.status === 403) return { ok: false, error: 'forbidden' };
      return { ok: false, error: 'server' };
    },

    saveOnExit(req) {
      if (!lastToken) return false;
      const body = JSON.stringify(req);
      if (new Blob([body]).size > KEEPALIVE_LIMIT) return false;
      try {
        void fetch(ADMIN, {
          method: 'PUT',
          keepalive: true,
          headers: { 'Content-Type': 'application/json', Authorization: lastToken },
          body,
        }).catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    },

    async patchPlayer(req) {
      try {
        const res = await authed(`${ADMIN}/players`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
        return res.ok ? { ok: true } : { ok: false, error: res.status === 403 ? 'forbidden' : 'server' };
      } catch {
        return { ok: false, error: 'network' };
      }
    },

    async deletePlayer(req) {
      try {
        const res = await authed(`${ADMIN}/players`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
        return res.ok ? { ok: true } : { ok: false, error: res.status === 403 ? 'forbidden' : 'server' };
      } catch {
        return { ok: false, error: 'network' };
      }
    },

    async uploadImage(codeId, file, onProgress) {
      const prepared = await prepareImage(file);
      onProgress(0.05);
      const { getAuthHeader } = await import('@/lib/fetchWithAuth');
      const header = await getAuthHeader();
      // XHR, not fetch: fetch has no upload progress.
      return new Promise<string>((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', prepared);
        fd.append('codeId', codeId);
        fd.append('kind', 'image');
        fd.append('feature', 'thecode');
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/raffle/upload');
        xhr.setRequestHeader('Authorization', header);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(0.05 + 0.9 * (e.loaded / e.total));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const url = (JSON.parse(xhr.responseText) as { url?: string }).url;
              if (url) {
                onProgress(1);
                resolve(url);
                return;
              }
            } catch {
              /* fall through */
            }
          }
          reject(new Error(`upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(fd);
      });
    },
  };
}

/**
 * Client-side compression before upload (Vercel's 4.5 MB body cap — CLAUDE.md). GIFs keep their
 * animation and are sent as they are when small enough. Photos only — transparency is not kept.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif') {
    if (file.size <= 3.5 * 1024 * 1024) return file;
    throw new Error('gif too large');
  }
  const { blob, format } = await compressImage(file, {
    maxSizeKB: 450,
    maxWidth: 1600,
    maxHeight: 1600,
  });
  const ext = format === 'jpeg' ? 'jpg' : format;
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type: blob.type || `image/${format}` });
}
