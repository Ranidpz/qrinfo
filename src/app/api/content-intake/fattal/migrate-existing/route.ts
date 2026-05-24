import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { deleteStoredObjectByUrl } from '@/lib/server-storage';
import {
  buildStorageKey,
  buildUniqueFilename,
  isR2Configured,
  R2_STORAGE_PROVIDER,
  uploadBufferToR2,
} from '@/lib/r2-storage';
import { FATTAL_DEFAULT_FOLDER_NAMES } from '@/lib/content-intake/fattal';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES_PER_RUN = 50;
const MAX_PDF_BYTES = 50 * 1024 * 1024;

interface MigrationRequestBody {
  ownerId?: unknown;
  ownerEmail?: unknown;
  folderNames?: unknown;
  dryRun?: unknown;
  deleteOld?: unknown;
  limit?: unknown;
}

interface FattalPdfCandidate {
  codeId: string;
  title: string;
  shortId?: string;
  folderId: string;
  folderName?: string;
  mediaIndex: number;
  media: CodeMedia;
}

interface CodeMedia {
  id?: string;
  url?: string;
  type?: string;
  size?: number;
  uploadedBy?: string;
  filename?: string;
  storageProvider?: string;
  storageKey?: string;
  storageBucket?: string;
  contentType?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (isAuthError(auth)) return auth.response;

  let body: MigrationRequestBody = {};
  try {
    body = await request.json() as MigrationRequestBody;
  } catch {
    body = {};
  }

  const dryRun = body.dryRun !== false;
  const deleteOld = body.deleteOld === true;
  const limit = parseLimit(body.limit);

  if (!dryRun && !isR2Configured()) {
    return NextResponse.json(
      { error: 'Cloudflare R2 is not configured' },
      { status: 500 }
    );
  }

  const ownerId = await resolveOwnerId(body);
  if (!ownerId) {
    return NextResponse.json(
      { error: 'ownerId or ownerEmail is required' },
      { status: 400 }
    );
  }

  const folderNames = parseFolderNames(body.folderNames);
  const candidates = await loadFattalPdfCandidates(ownerId, folderNames);
  const pending = candidates.filter((candidate) => candidate.media.storageProvider !== R2_STORAGE_PROVIDER);
  const selected = pending.slice(0, limit);

  const results = [];
  for (const candidate of selected) {
    if (dryRun) {
      results.push({
        codeId: candidate.codeId,
        shortId: candidate.shortId,
        title: candidate.title,
        status: 'ready',
        currentUrl: candidate.media.url,
        targetPrefix: `${ownerId}/${candidate.codeId}/booklets`,
      });
      continue;
    }

    results.push(await migrateCandidate(ownerId, candidate, deleteOld));
  }

  const migrated = results.filter((result) => result.status === 'migrated').length;
  const failed = results.filter((result) => result.status === 'failed').length;

  return NextResponse.json({
    success: failed === 0,
    dryRun,
    deleteOld,
    ownerId,
    folderNames,
    summary: {
      totalTargetsWithPdf: candidates.length,
      alreadyOnR2: candidates.length - pending.length,
      pending: pending.length,
      selected: selected.length,
      migrated,
      failed,
      remainingAfterRun: dryRun ? pending.length : Math.max(pending.length - migrated, 0),
    },
    results,
  });
}

async function migrateCandidate(ownerId: string, candidate: FattalPdfCandidate, deleteOld: boolean) {
  const db = getAdminDb();
  const oldUrl = candidate.media.url;

  try {
    if (!oldUrl) throw new Error('Media URL is missing');

    const source = await fetchExistingPdf(oldUrl);
    const filename = candidate.media.filename || source.filename || `${candidate.title}.pdf`;
    const key = buildStorageKey(
      [ownerId, candidate.codeId, 'booklets'],
      buildUniqueFilename(filename, 'pdf')
    );

    const uploaded = await uploadBufferToR2({
      key,
      body: source.buffer,
      contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        ownerId,
        codeId: candidate.codeId,
        folder: 'booklets',
        workflow: 'fattal-booklets-migration',
        originalFilename: encodeURIComponent(filename).slice(0, 500),
        migratedFrom: encodeURIComponent(oldUrl).slice(0, 500),
      },
    });

    let storageDelta = 0;
    try {
      await db.runTransaction(async (transaction) => {
        const codeRef = db.collection('codes').doc(candidate.codeId);
        const userRef = db.collection('users').doc(ownerId);
        const codeDoc = await transaction.get(codeRef);
        const userDoc = await transaction.get(userRef);

        if (!codeDoc.exists) throw new Error('Code not found');
        if (!userDoc.exists) throw new Error('Owner user not found');

        const codeData = codeDoc.data() || {};
        const media = Array.isArray(codeData.media) ? ([...codeData.media] as CodeMedia[]) : [];
        const currentMedia = media[candidate.mediaIndex];
        if (!currentMedia || currentMedia.url !== oldUrl) {
          throw new Error('Media changed before migration could commit');
        }

        const oldSize = Number(currentMedia.size || 0);
        storageDelta = uploaded.size - oldSize;
        media[candidate.mediaIndex] = {
          ...currentMedia,
          url: uploaded.url,
          size: uploaded.size,
          storageProvider: R2_STORAGE_PROVIDER,
          storageKey: uploaded.key,
          storageBucket: uploaded.bucket,
          contentType: uploaded.contentType,
          migratedFromStorageProvider: currentMedia.storageProvider || 'vercel-blob',
          migratedAt: new Date().toISOString(),
        };

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
        console.error('[Fattal PDF migration] Failed to clean uploaded R2 object:', cleanupError);
      });
      throw error;
    }

    let warning: string | undefined;
    if (deleteOld) {
      try {
        await deleteStoredObjectByUrl(oldUrl);
      } catch (error) {
        console.error('[Fattal PDF migration] Failed to delete old object:', error);
        warning = 'Migrated to R2 but failed to delete old storage object';
      }
    }

    return {
      codeId: candidate.codeId,
      shortId: candidate.shortId,
      title: candidate.title,
      status: 'migrated',
      oldUrl,
      newUrl: uploaded.url,
      storageKey: uploaded.key,
      size: uploaded.size,
      storageDelta,
      warning,
    };
  } catch (error) {
    console.error('[Fattal PDF migration] Candidate failed:', candidate.codeId, error);
    return {
      codeId: candidate.codeId,
      shortId: candidate.shortId,
      title: candidate.title,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Migration failed',
    };
  }
}

async function fetchExistingPdf(url: string): Promise<{ buffer: Buffer; filename?: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Existing media URL must be http or https');
  }

  const response = await fetch(parsed.toString());
  if (!response.ok) throw new Error(`Failed to fetch existing PDF: ${response.status}`);

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_PDF_BYTES) throw new Error('Existing PDF exceeds 50MB limit');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_PDF_BYTES) throw new Error('Existing PDF exceeds 50MB limit');
  if (!isPdfBuffer(buffer)) throw new Error('Existing media is not a valid PDF');

  return {
    buffer,
    filename: decodeURIComponent(parsed.pathname.split('/').pop() || ''),
  };
}

async function resolveOwnerId(body: MigrationRequestBody): Promise<string | null> {
  const requestedOwnerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
  if (requestedOwnerId) return requestedOwnerId;

  const envOwnerId = process.env.FATTAL_BOOKLETS_OWNER_ID?.trim();
  if (envOwnerId) return envOwnerId;

  const requestedOwnerEmail = typeof body.ownerEmail === 'string' ? body.ownerEmail.trim() : '';
  const envOwnerEmail = process.env.FATTAL_BOOKLETS_OWNER_EMAIL?.trim() || '';
  const ownerEmail = requestedOwnerEmail || envOwnerEmail;
  if (!ownerEmail) return null;

  const db = getAdminDb();
  const userSnapshot = await db.collection('users')
    .where('email', '==', ownerEmail)
    .limit(1)
    .get();

  return userSnapshot.empty ? null : userSnapshot.docs[0].id;
}

async function loadFattalPdfCandidates(ownerId: string, folderNames: string[]): Promise<FattalPdfCandidate[]> {
  const db = getAdminDb();
  const normalizedFolderNames = new Set(folderNames.map(normalizeName));

  const folderSnapshot = await db.collection('folders')
    .where('ownerId', '==', ownerId)
    .get();

  const folders = folderSnapshot.docs
    .map((folderDoc) => ({
      id: folderDoc.id,
      name: String(folderDoc.data().name || ''),
    }))
    .filter((folder) => normalizedFolderNames.has(normalizeName(folder.name)));

  if (folders.length === 0) return [];

  const folderById = new Map(folders.map((folder) => [folder.id, folder.name]));
  const folderIds = new Set(folders.map((folder) => folder.id));
  const codesSnapshot = await db.collection('codes')
    .where('ownerId', '==', ownerId)
    .get();

  const candidates: FattalPdfCandidate[] = [];
  for (const codeDoc of codesSnapshot.docs) {
    const data = codeDoc.data();
    const folderId = typeof data.folderId === 'string' ? data.folderId : undefined;
    if (!folderId || !folderIds.has(folderId)) continue;
    if (data.parentCodeShortId) continue;

    const media = Array.isArray(data.media) ? (data.media as CodeMedia[]) : [];
    const mediaIndex = media.findIndex((item) => item.type === 'pdf' && !!item.url);
    if (mediaIndex < 0) continue;

    candidates.push({
      codeId: codeDoc.id,
      shortId: typeof data.shortId === 'string' ? data.shortId : undefined,
      title: String(data.title || ''),
      folderId,
      folderName: folderById.get(folderId),
      mediaIndex,
      media: media[mediaIndex],
    });
  }

  return candidates.sort((a, b) => a.title.localeCompare(b.title, 'he'));
}

function parseFolderNames(value: unknown): string[] {
  if (!Array.isArray(value)) return FATTAL_DEFAULT_FOLDER_NAMES;
  const names = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return names.length > 0 ? names : FATTAL_DEFAULT_FOLDER_NAMES;
}

function parseLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MAX_FILES_PER_RUN;
  return Math.max(1, Math.min(Math.floor(value), MAX_FILES_PER_RUN));
}

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer
    .subarray(0, Math.min(buffer.byteLength, 1024))
    .includes(Buffer.from('%PDF-'));
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (char) => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[char] || char))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
