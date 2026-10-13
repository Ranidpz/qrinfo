import { fetchWithAuth, getAuthHeader } from '@/lib/fetchWithAuth';

// Client calls for booklet PDF replacement, history/restore and booklet-editor grants.
// Every PDF→PDF replacement goes through the server route so it is recorded and restorable.

export type PdfActorVia = 'owner' | 'collaborator' | 'super_admin' | 'editor' | 'intake';

export interface PdfHistoryEntry {
  id: string;
  action: 'replace' | 'restore' | 'grant' | 'revoke';
  at: string | null;
  actor: { uid: string | null; via: PdfActorVia; email?: string; name?: string } | null;
  mediaId?: string;
  next?: { filename?: string; size: number; pageCount?: number } | null;
  previous?: { filename?: string; size: number; pageCount?: number; retained: boolean; restored?: boolean } | null;
  target?: { email?: string; name?: string } | null;
  canRestore: boolean;
}

export interface BookletEditor {
  uid: string;
  email: string;
  name: string;
  grantedAt?: string | null;
  grantedByEmail?: string;
}

export interface EditableBooklet {
  codeId: string;
  shortId: string;
  title: string;
  updatedAt: string | null;
  pdfs: { id: string; url: string; filename: string; size: number; pageCount: number | null }[];
}

/** Error carrying the server's short error code/message (e.g. `user_not_found`). */
export class BookletApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new BookletApiError(String(data?.error || 'request_failed'), res.status);
  return data as T;
}

/** Replace a booklet PDF through the server (XHR for upload progress). Returns the new media item. */
export async function uploadBookletPdf(
  codeId: string,
  mediaId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mediaId', mediaId);
  formData.append('filename', file.name);
  formData.append('source', 'dashboard');
  const authHeader = await getAuthHeader();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data: { media?: Record<string, unknown>; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300 && data.media) resolve(data.media);
      else reject(new BookletApiError(data.error || 'upload_failed', xhr.status));
    };
    xhr.onerror = () => reject(new BookletApiError('upload_failed', 0));
    xhr.open('POST', `/api/codes/${encodeURIComponent(codeId)}/pdf`);
    xhr.setRequestHeader('Authorization', authHeader);
    xhr.send(formData);
  });
}

export async function fetchPdfHistory(codeId: string): Promise<PdfHistoryEntry[]> {
  const res = await fetchWithAuth(`/api/codes/${encodeURIComponent(codeId)}/pdf/history`);
  return (await readJson<{ entries: PdfHistoryEntry[] }>(res)).entries;
}

export async function restorePdfVersion(codeId: string, eventId: string): Promise<Record<string, unknown>> {
  const res = await fetchWithAuth(`/api/codes/${encodeURIComponent(codeId)}/pdf/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId }),
  });
  return (await readJson<{ media: Record<string, unknown> }>(res)).media;
}

export async function fetchEditableBooklets(): Promise<EditableBooklet[]> {
  const res = await fetchWithAuth('/api/booklet-editor/booklets');
  return (await readJson<{ booklets: EditableBooklet[] }>(res)).booklets;
}

export async function fetchBookletEditors(codeId: string): Promise<BookletEditor[]> {
  const res = await fetchWithAuth(`/api/admin/booklet-editors?codeId=${encodeURIComponent(codeId)}`);
  return (await readJson<{ editors: BookletEditor[] }>(res)).editors;
}

export async function grantBookletEditor(codeId: string, email: string): Promise<BookletEditor> {
  const res = await fetchWithAuth('/api/admin/booklet-editors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeId, email }),
  });
  return (await readJson<{ editor: BookletEditor }>(res)).editor;
}

export async function revokeBookletEditor(codeId: string, uid: string): Promise<void> {
  const res = await fetchWithAuth('/api/admin/booklet-editors', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeId, uid }),
  });
  await readJson(res);
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Vercel rejects request bodies over 4.5MB; leave room for the multipart envelope. */
export const MAX_BOOKLET_UPLOAD_BYTES = 4.4 * 1024 * 1024;

/** i18n key (namespace `booklets`) for an API error. */
export function bookletErrorKey(error: unknown): string {
  const message = error instanceof BookletApiError ? error.message : '';
  if (message === 'user_not_found') return 'userNotFound';
  if (message === 'already_owner') return 'alreadyOwner';
  if (message === 'already_admin') return 'alreadyAdmin';
  if (message === 'not_a_booklet') return 'notBooklet';
  if (message === 'Only PDF files are supported' || message === 'Target media is not a PDF') return 'onlyPdf';
  if (message === 'Duplicate PDF') return 'errorDuplicate';
  if (message === 'Storage quota exceeded' || message === 'quota') return 'errorQuota';
  if (message === 'Target has a pending cloud replacement' || message === 'busy') return 'errorBusy';
  if (error instanceof BookletApiError && error.status === 409) return 'errorConflict';
  if (error instanceof BookletApiError && error.status === 413) return 'tooLarge';
  return 'errorGeneric';
}

export interface AdminBooklet {
  codeId: string;
  shortId: string;
  title: string;
  ownerEmail: string;
  ownerName: string;
  updatedAt: string | null;
  editors: BookletEditor[];
}

export type BulkGrantStatus = 'granted' | 'already' | 'not_found' | 'not_a_booklet' | 'owner';

/** Super admin: every booklet with its owner and active editors. */
export async function fetchAllBooklets(): Promise<AdminBooklet[]> {
  const res = await fetchWithAuth('/api/admin/booklet-editors');
  return (await readJson<{ booklets: AdminBooklet[] }>(res)).booklets;
}

/** Super admin: grant one user PDF-update access to many booklets at once. */
export async function grantBookletEditorBulk(codeIds: string[], email: string) {
  const res = await fetchWithAuth('/api/admin/booklet-editors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeIds, email }),
  });
  return readJson<{ editor: BookletEditor; results: { codeId: string; status: BulkGrantStatus }[] }>(res);
}
