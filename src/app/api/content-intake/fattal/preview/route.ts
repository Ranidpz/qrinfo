import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, isAuthError } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { hasValidServerApiKey } from '@/lib/server-api-key';
import {
  buildFattalPreview,
  FATTAL_DEFAULT_FOLDER_NAMES,
} from '@/lib/content-intake/fattal';
import type { ContentIntakeTarget, IntakeFileCandidate } from '@/lib/content-intake/types';

interface PreviewRequestBody {
  files?: unknown;
  receivedAt?: unknown;
  ownerId?: unknown;
  ownerEmail?: unknown;
  folderNames?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const isIntegrationAuth = hasValidServerApiKey(request, 'CONTENT_INTAKE_API_KEY', [
      'x-content-intake-key',
      'x-integration-key',
    ]);

    if (!isIntegrationAuth) {
      const auth = await requireSuperAdmin(request);
      if (isAuthError(auth)) return auth.response;
    }

    const body = await request.json() as PreviewRequestBody;
    const files = parseFiles(body.files);
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 }
      );
    }

    const ownerId = await resolveOwnerId(body, isIntegrationAuth);
    if (!ownerId) {
      return NextResponse.json(
        { error: 'ownerId or ownerEmail is required for Fattal preview' },
        { status: 400 }
      );
    }

    const folderNames = parseFolderNames(body.folderNames);
    const targets = await loadFattalTargets(ownerId, folderNames);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'No Fattal booklet QR targets found for the selected owner and folders' },
        { status: 404 }
      );
    }

    const preview = buildFattalPreview({
      files,
      targets,
      receivedAt: typeof body.receivedAt === 'string' ? body.receivedAt : undefined,
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error('[Content Intake Fattal Preview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to build Fattal intake preview' },
      { status: 500 }
    );
  }
}

function parseFiles(value: unknown): IntakeFileCandidate[] {
  if (!Array.isArray(value)) return [];

  const files: IntakeFileCandidate[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.name !== 'string' || raw.name.trim().length === 0) continue;

    files.push({
      id: typeof raw.id === 'string' ? raw.id : undefined,
      name: raw.name.trim(),
      size: typeof raw.size === 'number' ? raw.size : undefined,
      contentType: typeof raw.contentType === 'string' ? raw.contentType : undefined,
      receivedAt: typeof raw.receivedAt === 'string' ? raw.receivedAt : undefined,
      source: raw.source === 'whatsapp' || raw.source === 'email' || raw.source === 'drive' || raw.source === 'manual' || raw.source === 'api'
        ? raw.source
        : undefined,
      sourceMessageId: typeof raw.sourceMessageId === 'string' ? raw.sourceMessageId : undefined,
      senderName: typeof raw.senderName === 'string' ? raw.senderName : undefined,
    });
  }

  return files;
}

function parseFolderNames(value: unknown): string[] {
  if (!Array.isArray(value)) return FATTAL_DEFAULT_FOLDER_NAMES;
  const names = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return names.length > 0 ? names : FATTAL_DEFAULT_FOLDER_NAMES;
}

async function resolveOwnerId(body: PreviewRequestBody, isIntegrationAuth: boolean): Promise<string | null> {
  const envOwnerId = process.env.FATTAL_BOOKLETS_OWNER_ID;
  const envOwnerEmail = process.env.FATTAL_BOOKLETS_OWNER_EMAIL;
  const requestedOwnerId = typeof body.ownerId === 'string' ? body.ownerId : undefined;
  const requestedOwnerEmail = typeof body.ownerEmail === 'string' ? body.ownerEmail : undefined;

  if (isIntegrationAuth && envOwnerId && requestedOwnerId && requestedOwnerId !== envOwnerId) {
    return null;
  }

  if (requestedOwnerId || envOwnerId) {
    return requestedOwnerId || envOwnerId || null;
  }

  const ownerEmail = requestedOwnerEmail || envOwnerEmail;
  if (!ownerEmail) return null;

  const db = getAdminDb();
  const userSnapshot = await db.collection('users')
    .where('email', '==', ownerEmail)
    .limit(1)
    .get();

  if (userSnapshot.empty) return null;
  return userSnapshot.docs[0].id;
}

async function loadFattalTargets(ownerId: string, folderNames: string[]): Promise<ContentIntakeTarget[]> {
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

  const targets: ContentIntakeTarget[] = [];

  for (const codeDoc of codesSnapshot.docs) {
    const data = codeDoc.data();
    const folderId = typeof data.folderId === 'string' ? data.folderId : undefined;
    if (!folderId || !folderIds.has(folderId)) continue;
    if (data.parentCodeShortId) continue;

    const title = String(data.title || '');
    if (!title) continue;

    const firstMedia = Array.isArray(data.media) ? data.media[0] : undefined;
    targets.push({
      codeId: codeDoc.id,
      shortId: typeof data.shortId === 'string' ? data.shortId : undefined,
      title,
      ownerId,
      folderId,
      folderName: folderById.get(folderId),
      currentMediaType: typeof firstMedia?.type === 'string' ? firstMedia.type : undefined,
      currentFilename: typeof firstMedia?.filename === 'string' ? firstMedia.filename : undefined,
    });
  }

  return targets;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (char) => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }[char] || char))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
