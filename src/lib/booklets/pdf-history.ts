import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  PDF_HISTORY_COLLECTION,
  snapshotPdfMedia,
  type PdfActor,
  type PdfFileSnapshot,
} from '@/lib/content-intake/pdf-replacement';

/**
 * Booklet file history: `codes/{id}/pdfHistory/{eventId}` (Admin SDK only).
 * - action 'replace' | 'restore': `next` is the file that went live, `previous` the one it
 *   replaced. `previous.retained` = that file is still in storage and can be put back.
 *   Only the newest entry of a media item keeps a file; the next replacement deletes it.
 * - action 'grant' | 'revoke': who gave / took away booklet-editor access.
 */

/** `code` is a fixed, client-safe identifier (never error text from elsewhere). */
export class PdfHistoryError extends Error {
  constructor(readonly code: 'not_found' | 'not_restorable' | 'conflict' | 'busy' | 'quota' | 'no_owner', readonly status: number) {
    super(code);
  }
}

interface MediaItem extends Record<string, unknown> {
  id?: string;
  url?: string;
  type?: string;
  size?: number;
  uploadedBy?: string;
}

type KeptSnapshot = PdfFileSnapshot & { retained?: boolean; purgeOnNext?: boolean };

export interface PdfHistoryEntry {
  id: string;
  action: 'replace' | 'restore' | 'grant' | 'revoke';
  at: string | null;
  actor: PdfActor | null;
  mediaId?: string;
  next?: { filename?: string; size: number; pageCount?: number } | null;
  previous?: { filename?: string; size: number; pageCount?: number; retained: boolean } | null;
  target?: { email?: string; name?: string } | null;
  canRestore: boolean;
}

/** Firestore rejects `undefined` values — drop them from actor / target records. */
function compact<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function fileSummary(file: KeptSnapshot | null | undefined) {
  if (!file?.url) return null;
  return { filename: file.filename || file.title, size: Number(file.size || 0), pageCount: file.pageCount };
}

/** `redactEmails`: booklet editors see names only, never other people's email addresses. */
export async function listPdfHistory(codeId: string, options: { redactEmails?: boolean; limit?: number } = {}): Promise<PdfHistoryEntry[]> {
  const { redactEmails = false, limit = 50 } = options;
  const redact = <T extends { email?: string } | null | undefined>(who: T): T =>
    who && redactEmails ? ({ ...who, email: undefined } as T) : who;
  const codeRef = getAdminDb().collection('codes').doc(codeId);
  const [codeDoc, snap] = await Promise.all([
    codeRef.get(),
    codeRef.collection(PDF_HISTORY_COLLECTION).orderBy('at', 'desc').limit(limit).get(),
  ]);
  const media = (codeDoc.data()?.media || []) as MediaItem[];
  const liveUrlByMedia = new Map(media.map((item) => [item.id, item.url]));

  return snap.docs.map((doc) => {
    const data = doc.data();
    const previous = data.previous as KeptSnapshot | null | undefined;
    const next = data.next as KeptSnapshot | null | undefined;
    const canRestore = !!previous?.retained && !!next?.url
      && liveUrlByMedia.get(data.mediaId) === next.url;
    return {
      id: doc.id,
      action: data.action,
      at: toIso(data.at),
      actor: redact((data.actor as PdfActor) || null),
      mediaId: data.mediaId,
      next: fileSummary(next),
      previous: previous?.url ? { ...fileSummary(previous)!, retained: !!previous.retained } : null,
      target: redact(data.target || null),
      canRestore,
    };
  });
}

/**
 * Put the kept previous file of history entry `eventId` back on its media item.
 * The file it displaces is kept in turn, so a restore can itself be undone.
 */
export async function restorePdfVersion(codeId: string, eventId: string, actor: PdfActor) {
  const db = getAdminDb();
  const codeRef = db.collection('codes').doc(codeId);
  const eventRef = codeRef.collection(PDF_HISTORY_COLLECTION).doc(eventId);

  return db.runTransaction(async (transaction) => {
    const [codeDoc, eventDoc] = await Promise.all([transaction.get(codeRef), transaction.get(eventRef)]);
    if (!codeDoc.exists) throw new PdfHistoryError('not_found', 404);
    if (!eventDoc.exists) throw new PdfHistoryError('not_found', 404);

    const code = codeDoc.data() || {};
    if (code.fattalCloudPending) throw new PdfHistoryError('busy', 409);
    const ownerId = String(code.ownerId || '');
    if (!ownerId) throw new PdfHistoryError('no_owner', 400);

    const event = eventDoc.data() || {};
    const kept = event.previous as KeptSnapshot | null | undefined;
    const next = event.next as KeptSnapshot | null | undefined;
    if (!kept?.retained || !kept.url || !next?.url || (kept.type && kept.type !== 'pdf')) {
      throw new PdfHistoryError('not_restorable', 409);
    }

    const media = Array.isArray(code.media) ? ([...code.media] as MediaItem[]) : [];
    const index = media.findIndex((item) => item.id === event.mediaId);
    const current = index >= 0 ? media[index] : undefined;
    if (!current || current.type !== 'pdf') throw new PdfHistoryError('not_found', 404);
    // Only the change that produced the file on screen right now can be undone.
    if (current.url !== next.url) throw new PdfHistoryError('conflict', 409);

    const userRef = db.collection('users').doc(ownerId);
    const userDoc = await transaction.get(userRef);
    const owner = userDoc.data() || {};
    // Same rule as a replacement: only files uploaded by the owner count in their storage.
    const keptUploadedBy = kept.uploadedBy || ownerId;
    const currentSizeForOwner = current.uploadedBy === ownerId ? Number(current.size || 0) : 0;
    const keptSizeForOwner = keptUploadedBy === ownerId ? Number(kept.size || 0) : 0;
    const storageDelta = keptSizeForOwner - currentSizeForOwner;
    const limit = Number(owner.storageLimit || 0);
    if (storageDelta > 0 && limit > 0 && Number(owner.storageUsed || 0) + storageDelta > limit) {
      throw new PdfHistoryError('quota', 409);
    }

    const now = Timestamp.now();
    const displaced = snapshotPdfMedia(current);
    const restored: MediaItem = { ...current };
    for (const field of ['filename', 'pageCount', 'storageProvider', 'storageKey', 'storageBucket', 'contentType', 'contentIntake'] as const) {
      if (kept[field] !== undefined) restored[field] = kept[field];
      else delete restored[field];
    }
    restored.url = kept.url;
    restored.size = Number(kept.size || 0);
    restored.uploadedBy = keptUploadedBy;
    media[index] = restored;

    transaction.update(codeRef, { media, updatedAt: FieldValue.serverTimestamp() });
    if (storageDelta !== 0 && userDoc.exists) {
      transaction.update(userRef, { storageUsed: FieldValue.increment(storageDelta), updatedAt: FieldValue.serverTimestamp() });
    }
    transaction.update(eventRef, { 'previous.retained': false, 'previous.restoredAt': now });
    transaction.set(codeRef.collection(PDF_HISTORY_COLLECTION).doc(), {
      action: 'restore',
      mediaId: event.mediaId,
      at: now,
      actor: compact(actor),
      restoredFromEventId: eventId,
      next: { ...snapshotPdfMedia(restored), ...(kept.sha256 ? { sha256: kept.sha256 } : {}) },
      previous: { ...displaced, ...(next.sha256 ? { sha256: next.sha256 } : {}), retained: true, purgeOnNext: true },
    });

    return { media: restored, storageDelta };
  });
}

/** Audit line for granting / revoking booklet-editor access. */
export async function recordAccessChange(
  codeId: string,
  action: 'grant' | 'revoke',
  actor: PdfActor,
  target: { uid: string; email?: string; name?: string }
) {
  await getAdminDb().collection('codes').doc(codeId).collection(PDF_HISTORY_COLLECTION).add({
    action,
    at: Timestamp.now(),
    actor: compact(actor),
    target: compact(target),
  });
}
