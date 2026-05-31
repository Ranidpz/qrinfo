import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { deleteStoredObjectByUrl } from '@/lib/server-storage';
import {
  buildStorageKey,
  buildUniqueFilename,
  R2_STORAGE_PROVIDER,
  uploadBufferToR2,
} from '@/lib/r2-storage';

export const MAX_PDF_REPLACEMENT_BYTES = 25 * 1024 * 1024;

export interface PdfReplacementInput {
  buffer: Buffer;
  filename: string;
  contentType: string;
  mediaId?: string;
  title?: string;
  source?: string;
  sourceFileId?: string;
  sourceMessageId?: string;
  detectedDate?: string;
  replaceNonPdf?: boolean;
  deleteOld?: boolean;
  workflow?: string;
}

export interface PdfReplacementResult {
  codeId: string;
  media: Record<string, unknown> | null;
  url: string;
  key: string;
  bucket: string;
  provider: typeof R2_STORAGE_PROVIDER;
  size: number;
  pageCount?: number;
  storageDelta: number;
  warning?: string;
}

interface CodeMedia {
  id?: string;
  url?: string;
  type?: string;
  size?: number;
  order?: number;
  uploadedBy?: string;
  title?: string;
  filename?: string;
  pdfSettings?: unknown;
  createdAt?: unknown;
}

export async function replaceCodePdfWithBuffer(
  codeId: string,
  input: PdfReplacementInput,
  options: { expectedOwnerId?: string } = {}
): Promise<PdfReplacementResult> {
  if (!isPdfInput(input)) {
    throw new Error('Only PDF files are supported');
  }

  if (input.buffer.byteLength > MAX_PDF_REPLACEMENT_BYTES) {
    throw new Error('PDF exceeds 25MB limit');
  }

  const db = getAdminDb();
  const codeRef = db.collection('codes').doc(codeId);
  const codeDoc = await codeRef.get();
  if (!codeDoc.exists) throw new Error('Code not found');

  const codeData = codeDoc.data() || {};
  const ownerId = String(codeData.ownerId || '');
  if (!ownerId) throw new Error('Code owner is missing');
  if (options.expectedOwnerId && ownerId !== options.expectedOwnerId) {
    throw new Error('Code owner does not match Fattal owner');
  }

  const pageCount = await countPdfPages(input.buffer);
  const r2Key = buildStorageKey(
    [ownerId, codeId, 'booklets'],
    buildUniqueFilename(input.filename, 'pdf')
  );

  const workflow = input.workflow || 'fattal-booklets';
  const uploaded = await uploadBufferToR2({
    key: r2Key,
    body: input.buffer,
    contentType: 'application/pdf',
    cacheControl: 'public, max-age=31536000, immutable',
    metadata: compactStringRecord({
      ownerId,
      codeId,
      folder: 'booklets',
      workflow,
      originalFilename: encodeURIComponent(input.filename).slice(0, 500),
      ...(input.source ? { source: input.source } : {}),
      ...(input.sourceFileId ? { sourceFileId: input.sourceFileId } : {}),
      ...(input.sourceMessageId ? { sourceMessageId: input.sourceMessageId } : {}),
      ...(input.detectedDate ? { detectedDate: input.detectedDate } : {}),
    }),
  });

  let oldUrl: string | undefined;
  let storageDelta = uploaded.size;
  let updatedMediaForResponse: Record<string, unknown> | null = null;

  try {
    await db.runTransaction(async (transaction) => {
      const freshCodeDoc = await transaction.get(codeRef);
      const userRef = db.collection('users').doc(ownerId);
      const userDoc = await transaction.get(userRef);

      if (!freshCodeDoc.exists) throw new Error('Code not found');
      if (!userDoc.exists) throw new Error('Owner user not found');

      const freshCodeData = freshCodeDoc.data() || {};
      const media = Array.isArray(freshCodeData.media)
        ? ([...freshCodeData.media] as CodeMedia[])
        : [];

      const replaceIndex = resolveReplaceIndex(media, input.mediaId);
      if (input.mediaId && replaceIndex < 0) {
        throw new Error('Target media not found');
      }

      const oldMedia = replaceIndex >= 0 ? media[replaceIndex] : undefined;
      if (oldMedia && oldMedia.type !== 'pdf' && !input.replaceNonPdf) {
        throw new Error('Target media is not a PDF');
      }

      const oldSizeForOwner = oldMedia?.uploadedBy === ownerId
        ? Number(oldMedia.size || 0)
        : 0;
      storageDelta = uploaded.size - oldSizeForOwner;

      const userData = userDoc.data() || {};
      const currentUsage = Number(userData.storageUsed || 0);
      const storageLimit = Number(userData.storageLimit || 0);
      if (storageDelta > 0 && storageLimit > 0 && currentUsage + storageDelta > storageLimit) {
        throw new Error('Storage quota exceeded');
      }

      const now = Timestamp.now();
      const newMedia = compactRecord({
        ...(oldMedia || {}),
        id: oldMedia?.id || `media_${Date.now()}`,
        url: uploaded.url,
        type: 'pdf',
        size: uploaded.size,
        order: typeof oldMedia?.order === 'number' ? oldMedia.order : media.length,
        uploadedBy: ownerId,
        title: input.title || oldMedia?.title || input.filename,
        filename: input.filename,
        pageCount,
        pdfSettings: oldMedia?.pdfSettings,
        createdAt: oldMedia?.createdAt || now,
        storageProvider: R2_STORAGE_PROVIDER,
        storageKey: uploaded.key,
        storageBucket: uploaded.bucket,
        contentType: uploaded.contentType,
        contentIntake: compactRecord({
          workflow,
          source: input.source || 'api',
          sourceFileId: input.sourceFileId,
          sourceMessageId: input.sourceMessageId,
          detectedDate: input.detectedDate,
          updatedAt: now,
        }),
      });

      if (replaceIndex >= 0) {
        media[replaceIndex] = newMedia;
      } else {
        media.push(newMedia);
      }

      oldUrl = oldMedia?.url;
      updatedMediaForResponse = serializeMedia(newMedia);

      transaction.update(codeRef, {
        media,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (storageDelta !== 0) {
        transaction.update(userRef, {
          storageUsed: FieldValue.increment(storageDelta),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (error) {
    await deleteStoredObjectByUrl(uploaded.url).catch((cleanupError) => {
      console.error('[PDF R2] Failed to clean uploaded object after transaction failure:', cleanupError);
    });
    throw error;
  }

  let oldDeleteWarning: string | undefined;
  if (input.deleteOld !== false && oldUrl && oldUrl !== uploaded.url) {
    try {
      await deleteStoredObjectByUrl(oldUrl);
    } catch (error) {
      console.error('[PDF R2] Failed to delete previous PDF:', error);
      oldDeleteWarning = 'Previous PDF was replaced in Firestore but could not be deleted from storage';
    }
  }

  return {
    codeId,
    media: updatedMediaForResponse,
    url: uploaded.url,
    key: uploaded.key,
    bucket: uploaded.bucket,
    provider: uploaded.provider,
    size: uploaded.size,
    pageCount,
    storageDelta,
    warning: oldDeleteWarning,
  };
}

export async function fetchPdfBuffer(sourceUrl: string, filename?: string): Promise<Pick<PdfReplacementInput, 'buffer' | 'filename' | 'contentType'>> {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('sourceUrl must be http or https');
  }

  const response = await fetch(parsed.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch sourceUrl: ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_PDF_REPLACEMENT_BYTES) {
    throw new Error('PDF exceeds 25MB limit');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/pdf';
  const resolvedFilename = filename || decodeURIComponent(parsed.pathname.split('/').pop() || 'booklet.pdf');

  return {
    buffer,
    filename: resolvedFilename,
    contentType,
  };
}

function resolveReplaceIndex(media: CodeMedia[], mediaId?: string): number {
  if (mediaId) return media.findIndex((item) => item.id === mediaId);
  const pdfIndex = media.findIndex((item) => item.type === 'pdf');
  if (pdfIndex >= 0) return pdfIndex;
  return media.length === 0 ? -1 : 0;
}

function isPdfInput(input: PdfReplacementInput): boolean {
  const looksLikePdf = input.buffer
    .subarray(0, Math.min(input.buffer.byteLength, 1024))
    .includes(Buffer.from('%PDF-'));
  return looksLikePdf && (
    input.contentType === 'application/pdf' ||
    input.filename.toLowerCase().endsWith('.pdf')
  );
}

async function countPdfPages(buffer: Buffer): Promise<number | undefined> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
    }).promise;
    const pageCount = doc.numPages;
    await doc.destroy();
    return pageCount;
  } catch (error) {
    console.warn('[PDF R2] Failed to count PDF pages:', error);
    return undefined;
  }
}

function compactStringRecord(record: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
  );
}

function compactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}

function serializeMedia(media: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(media).map(([key, value]) => {
      if (value instanceof Timestamp) return [key, value.toDate().toISOString()];
      return [key, value];
    })
  );
}
