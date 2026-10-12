/**
 * Per-media secrets that must never sit on the world-readable `codes/{id}` document.
 * They live in `codes/{id}/private/secrets` (`{ media: { [mediaId]: MediaSecrets } }`),
 * readable/writable only by the code's owner, collaborators and admins (firestore.rules),
 * and read by API routes through the Admin SDK.
 *
 * In memory the shape is unchanged: owner screens get the secrets merged back into the
 * media configs (`mergeMediaSecrets`), and every save splits them off again (`splitMediaSecrets`).
 * Codes saved before this change still carry the secrets on the public doc — server checks
 * fall back to those legacy fields until the code is re-saved or migrated.
 *
 * Isomorphic (no Firebase imports) so client and server share the field mapping.
 */

export const CODE_SECRETS_COLLECTION = 'private';
export const CODE_SECRETS_DOC = 'secrets';

export interface MediaSecrets {
  raffleToken?: string;
  photographerToken?: string;
  scannerPin?: string;
}

export type CodeSecretsMap = Record<string, MediaSecrets>;

type AnyMedia = { id?: string };
type MediaRecord = Record<string, unknown> & { id?: string };
type AnyConfig = Record<string, unknown>;

// Where each secret lives inside a media item: [secret key, config key, field in config]
const SECRET_FIELDS: Array<[keyof MediaSecrets, string, string]> = [
  ['raffleToken', 'raffleConfig', 'token'],
  ['photographerToken', 'selfiebeamContent', 'photographerToken'],
  ['scannerPin', 'qtagConfig', 'scannerPin'],
];

/** Remove secrets from media items. Only DEFINED values are returned, so an absent field never wipes a stored secret. */
export function splitMediaSecrets<T extends AnyMedia>(media: T[]): { media: T[]; secrets: CodeSecretsMap } {
  const secrets: CodeSecretsMap = {};
  const cleaned = media.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const m = item as unknown as MediaRecord;
    let next: MediaRecord = m;
    for (const [secretKey, configKey, field] of SECRET_FIELDS) {
      const config = next[configKey] as AnyConfig | undefined;
      if (!config || typeof config !== 'object' || !(field in config)) continue;
      const value = config[field];
      const { [field]: _removed, ...rest } = config;
      next = { ...next, [configKey]: rest };
      if (typeof value === 'string' && m.id) {
        secrets[m.id] = { ...secrets[m.id], [secretKey]: value };
      }
    }
    return next as unknown as T;
  });
  return { media: cleaned, secrets };
}

/** Put stored secrets back into media configs (owner screens). Legacy on-doc values are kept when nothing is stored. */
export function mergeMediaSecrets<T extends AnyMedia>(media: T[], secrets: CodeSecretsMap | undefined): T[] {
  if (!secrets) return media;
  return media.map((item) => {
    const s = item?.id ? secrets[item.id] : undefined;
    if (!s) return item;
    let next = item as unknown as MediaRecord;
    for (const [secretKey, configKey, field] of SECRET_FIELDS) {
      const value = s[secretKey];
      const config = next[configKey] as AnyConfig | undefined;
      if (value === undefined || !config || typeof config !== 'object') continue;
      next = { ...next, [configKey]: { ...config, [field]: value } };
    }
    return next as unknown as T;
  });
}

/**
 * Media as sent to public pages: secrets removed, plus Q.Stage judge access tokens.
 * Use on every server-rendered public page that passes media to the client.
 */
export function stripSecretsForPublic<T extends AnyMedia>(media: T[]): T[] {
  return splitMediaSecrets(media).media.map((item) => {
    const m = item as unknown as MediaRecord;
    const qstage = m?.qstageConfig as AnyConfig | undefined;
    const judges = qstage?.judges;
    if (!Array.isArray(judges)) return item;
    return {
      ...m,
      qstageConfig: {
        ...qstage,
        judges: judges.map((j: AnyConfig) => {
          const { accessToken: _token, ...rest } = j || {};
          return rest;
        }),
      },
    } as unknown as T;
  });
}

/** The raw value of a legacy secret still stored on a media item of the public doc. */
export function legacyMediaSecret(media: AnyMedia | undefined, key: keyof MediaSecrets): string | undefined {
  const entry = SECRET_FIELDS.find(([k]) => k === key);
  if (!media || !entry) return undefined;
  const value = ((media as MediaRecord)[entry[1]] as AnyConfig | undefined)?.[entry[2]];
  return typeof value === 'string' ? value : undefined;
}
