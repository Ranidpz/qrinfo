import { timingSafeEqual } from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  CODE_SECRETS_COLLECTION,
  CODE_SECRETS_DOC,
  legacyMediaSecret,
  type CodeSecretsMap,
  type MediaSecrets,
} from '@/lib/codeSecrets';

/** Server-side (Admin SDK) access to `codes/{id}/private/secrets`. */
export async function getCodeSecrets(codeId: string): Promise<CodeSecretsMap> {
  const snap = await getAdminDb()
    .collection('codes').doc(codeId)
    .collection(CODE_SECRETS_COLLECTION).doc(CODE_SECRETS_DOC)
    .get();
  return (snap.data()?.media as CodeSecretsMap | undefined) || {};
}

/**
 * A media item's secret: the private store first, then the legacy field on the public doc
 * (codes saved before the move). Returns undefined when neither has one.
 */
export async function resolveMediaSecret(
  codeId: string,
  media: (Record<string, unknown> & { id?: string }) | undefined,
  key: keyof MediaSecrets
): Promise<string | undefined> {
  if (!media) return undefined;
  const stored = media.id ? (await getCodeSecrets(codeId))[media.id]?.[key] : undefined;
  return stored !== undefined ? stored : legacyMediaSecret(media, key);
}

export function secretsEqual(expected: string | undefined, provided: unknown): boolean {
  if (!expected || typeof provided !== 'string' || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}
