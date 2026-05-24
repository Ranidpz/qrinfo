import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { requireCodeOwner, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import { deleteStoredObjectByUrl } from '@/lib/server-storage';
import {
  buildStorageKey,
  buildUniqueFilename,
  R2_STORAGE_PROVIDER,
  uploadBufferToR2,
} from '@/lib/r2-storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_PDF_BYTES = 25 * 1024 * 1024;

interface PdfReplacementInput {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { codeId } = await params;
  const db = getAdminDb();

  try {
    if (!codeId) {
      return NextResponse.json({ error: 'codeId is required' }, { status: 400 });
    }

    const integrationAuth = hasValidServerApiKey(request, 'CONTENT_INTAKE_API_KEY', [
      'x-content-intake-key',
      'x-integration-key',
    ]);

    if (!integrationAuth) {
      const auth = await requireCodeOwner(request, codeId);
      if (isAuthError(auth)) return auth.response;
    }

    const codeRef = db.collection('codes').doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Code not found' }, { status: 404 });
    }

    const codeData = codeDoc.data() || {};
    const ownerId = String(codeData.ownerId || '');
    if (!ownerId) {
      return NextResponse.json({ error: 'Code owner is missing' }, { status: 400 });
    }

    if (integrationAuth) {
      const allowed = await isAllowedFattalOwner(ownerId);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Integration key is not allowed to update this owner' },
          { status: 403 }
        );
      }
    }

    let input: PdfReplacementInput;
    try {
      input = await readPdfReplacementInput(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid PDF replacement request';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (!isPdfInput(input)) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    if (input.buffer.byteLength > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF exceeds 25MB limit' },
        { status: 400 }
      );
    }

    const pageCount = await countPdfPages(input.buffer);
    const r2Key = buildStorageKey(
      [ownerId, codeId, 'booklets'],
      buildUniqueFilename(input.filename, 'pdf')
    );

    const uploaded = await uploadBufferToR2({
      key: r2Key,
      body: input.buffer,
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: compactStringRecord({
        ownerId,
        codeId,
        folder: 'booklets',
        workflow: 'fattal-booklets',
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
            workflow: 'fattal-booklets',
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

      const message = error instanceof Error ? error.message : 'Failed to update code PDF';
      const status = message === 'Storage quota exceeded' ? 409 : 400;
      return NextResponse.json({ error: message }, { status });
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

    return NextResponse.json({
      success: true,
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
    });
  } catch (error) {
    console.error('[PDF R2] Replacement error:', error);
    return NextResponse.json(
      { error: 'Failed to replace PDF' },
      { status: 500 }
    );
  }
}

function resolveReplaceIndex(media: CodeMedia[], mediaId?: string): number {
  if (mediaId) return media.findIndex((item) => item.id === mediaId);
  const pdfIndex = media.findIndex((item) => item.type === 'pdf');
  if (pdfIndex >= 0) return pdfIndex;
  return media.length === 0 ? -1 : 0;
}

async function readPdfReplacementInput(request: NextRequest): Promise<PdfReplacementInput> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) throw new Error('file is required');

    return {
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: stringValue(formData.get('filename')) || file.name || 'booklet.pdf',
      contentType: file.type || 'application/pdf',
      mediaId: stringValue(formData.get('mediaId')),
      title: stringValue(formData.get('title')),
      source: stringValue(formData.get('source')),
      sourceFileId: stringValue(formData.get('sourceFileId')),
      sourceMessageId: stringValue(formData.get('sourceMessageId')),
      detectedDate: stringValue(formData.get('detectedDate')),
      replaceNonPdf: booleanValue(formData.get('replaceNonPdf')),
      deleteOld: formData.has('deleteOld') ? booleanValue(formData.get('deleteOld')) : true,
    };
  }

  const body = await request.json() as Record<string, unknown>;
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined;
  if (!sourceUrl) throw new Error('sourceUrl is required for JSON requests');

  const fetched = await fetchPdf(sourceUrl, typeof body.filename === 'string' ? body.filename : undefined);
  return {
    ...fetched,
    mediaId: typeof body.mediaId === 'string' ? body.mediaId : undefined,
    title: typeof body.title === 'string' ? body.title : undefined,
    source: typeof body.source === 'string' ? body.source : 'api',
    sourceFileId: typeof body.sourceFileId === 'string' ? body.sourceFileId : undefined,
    sourceMessageId: typeof body.sourceMessageId === 'string' ? body.sourceMessageId : undefined,
    detectedDate: typeof body.detectedDate === 'string' ? body.detectedDate : undefined,
    replaceNonPdf: body.replaceNonPdf === true,
    deleteOld: body.deleteOld !== false,
  };
}

async function fetchPdf(sourceUrl: string, filename?: string): Promise<Pick<PdfReplacementInput, 'buffer' | 'filename' | 'contentType'>> {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('sourceUrl must be http or https');
  }

  const response = await fetch(parsed.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch sourceUrl: ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_PDF_BYTES) {
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

async function isAllowedFattalOwner(ownerId: string): Promise<boolean> {
  const configuredOwnerId = process.env.FATTAL_BOOKLETS_OWNER_ID?.trim();
  if (configuredOwnerId) return ownerId === configuredOwnerId;

  const configuredEmail = process.env.FATTAL_BOOKLETS_OWNER_EMAIL?.trim();
  if (!configuredEmail) return false;

  const db = getAdminDb();
  const userSnapshot = await db.collection('users')
    .where('email', '==', configuredEmail)
    .limit(1)
    .get();

  return !userSnapshot.empty && userSnapshot.docs[0].id === ownerId;
}

function stringValue(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: FormDataEntryValue | null): boolean {
  return value === 'true' || value === '1' || value === 'yes';
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
