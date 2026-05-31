import { getAdminDb } from '@/lib/firebase-admin';
import {
  FATTAL_BOOKLET_TARGETS,
  FATTAL_DEFAULT_OWNER_EMAIL,
  type FattalBookletTargetConfig,
} from './fattal';
import type { ContentIntakeTarget } from './types';

interface ResolveFattalOwnerParams {
  ownerId?: unknown;
  ownerEmail?: unknown;
  integrationAuth?: boolean;
}

interface CodeMediaSnapshot {
  type?: string;
  filename?: string;
  id?: string;
}

export async function resolveFattalOwnerId(params: ResolveFattalOwnerParams = {}): Promise<string | null> {
  const requestedOwnerId = typeof params.ownerId === 'string' ? params.ownerId.trim() : '';
  const envOwnerId = process.env.FATTAL_BOOKLETS_OWNER_ID?.trim() || '';

  if (params.integrationAuth && envOwnerId && requestedOwnerId && requestedOwnerId !== envOwnerId) {
    return null;
  }

  if (requestedOwnerId) return requestedOwnerId;
  if (envOwnerId) return envOwnerId;

  const requestedOwnerEmail = typeof params.ownerEmail === 'string' ? params.ownerEmail.trim() : '';
  const envOwnerEmail = process.env.FATTAL_BOOKLETS_OWNER_EMAIL?.trim() || '';
  const ownerEmail = requestedOwnerEmail || envOwnerEmail || FATTAL_DEFAULT_OWNER_EMAIL;

  const db = getAdminDb();
  const userSnapshot = await db.collection('users')
    .where('email', '==', ownerEmail)
    .limit(1)
    .get();

  return userSnapshot.empty ? null : userSnapshot.docs[0].id;
}

export function getFattalTargetConfig(shortId: string): FattalBookletTargetConfig | undefined {
  return FATTAL_BOOKLET_TARGETS.find((target) => target.shortId === shortId);
}

export async function loadMappedFattalTargets(ownerId: string): Promise<ContentIntakeTarget[]> {
  const db = getAdminDb();
  const expectedShortIds = new Set(FATTAL_BOOKLET_TARGETS.map((target) => target.shortId));
  const configByShortId = new Map(FATTAL_BOOKLET_TARGETS.map((target) => [target.shortId, target]));

  const [codesSnapshot, foldersSnapshot] = await Promise.all([
    db.collection('codes').where('ownerId', '==', ownerId).get(),
    db.collection('folders').where('ownerId', '==', ownerId).get(),
  ]);

  const folderById = new Map(
    foldersSnapshot.docs.map((folderDoc) => [folderDoc.id, String(folderDoc.data().name || '')])
  );

  const targets: ContentIntakeTarget[] = [];

  for (const codeDoc of codesSnapshot.docs) {
    const data = codeDoc.data();
    const shortId = typeof data.shortId === 'string' ? data.shortId : '';
    if (!expectedShortIds.has(shortId)) continue;
    if (data.parentCodeShortId) continue;

    const config = configByShortId.get(shortId);
    if (!config) continue;

    const firstMedia = Array.isArray(data.media) ? data.media[0] as CodeMediaSnapshot | undefined : undefined;
    const folderId = typeof data.folderId === 'string' ? data.folderId : undefined;

    targets.push({
      codeId: codeDoc.id,
      shortId,
      title: String(data.title || config.title),
      ownerId,
      folderId,
      folderName: folderId ? folderById.get(folderId) : undefined,
      currentMediaType: typeof firstMedia?.type === 'string' ? firstMedia.type : undefined,
      currentFilename: typeof firstMedia?.filename === 'string' ? firstMedia.filename : undefined,
      aliases: [config.title, ...config.aliases],
    });
  }

  return targets.sort((a, b) =>
    targetOrder(a.shortId || '') - targetOrder(b.shortId || '')
  );
}

function targetOrder(shortId: string): number {
  const index = FATTAL_BOOKLET_TARGETS.findIndex((target) => target.shortId === shortId);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}
