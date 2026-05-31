import { del, list, put } from '@vercel/blob';
import {
  buildStorageKey,
  deleteR2ObjectByKey,
  deleteR2ObjectByUrl,
  getConfiguredMediaStorageProvider,
  getR2Config,
  getR2KeyFromUrl,
  isR2Url,
  listR2ObjectsByPrefix,
  R2_STORAGE_PROVIDER,
  uploadBufferToR2,
} from '@/lib/r2-storage';

export type StoredObjectProvider = 'vercel-blob' | typeof R2_STORAGE_PROVIDER;

export interface StoredObject {
  url: string;
  size: number;
  storageProvider: StoredObjectProvider;
  storageKey?: string;
  storageBucket?: string;
  contentType?: string;
}

export interface StoredObjectPrefixDeleteResult {
  provider: StoredObjectProvider;
  deleted: number;
  bytes: number;
}

export function buildMediaStorageKey(parts: string[], filename: string): string {
  return buildStorageKey(parts, filename);
}

export function inferStorageProviderFromUrl(url: string): StoredObjectProvider {
  return isR2Url(url) ? R2_STORAGE_PROVIDER : 'vercel-blob';
}

export function isManagedStorageUrl(url?: string): boolean {
  if (!url) return false;

  try {
    const hostname = new URL(url).hostname;
    return (
      hostname.endsWith('blob.vercel-storage.com') ||
      hostname === 'theq-media.playzones.app' ||
      hostname.endsWith('.r2.cloudflarestorage.com') ||
      isR2Url(url)
    );
  } catch {
    return false;
  }
}

export async function uploadStoredObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
  mediaType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  provider?: StoredObjectProvider;
}): Promise<StoredObject> {
  const provider = params.provider || getConfiguredMediaStorageProvider(params.mediaType);

  if (provider === R2_STORAGE_PROVIDER) {
    const uploaded = await uploadBufferToR2({
      key: params.key,
      body: params.body,
      contentType: params.contentType,
      cacheControl: params.cacheControl,
      metadata: params.metadata,
    });

    return {
      url: uploaded.url,
      size: uploaded.size,
      storageProvider: uploaded.provider,
      storageKey: uploaded.key,
      storageBucket: uploaded.bucket,
      contentType: uploaded.contentType,
    };
  }

  const blob = await put(params.key, params.body, {
    access: 'public',
    addRandomSuffix: false,
    contentType: params.contentType,
  });

  return {
    url: blob.url,
    size: params.body.byteLength,
    storageProvider: 'vercel-blob',
    storageKey: params.key,
    contentType: params.contentType,
  };
}

export async function deleteStoredObjectByUrl(url: string): Promise<StoredObjectProvider> {
  if (isR2Url(url)) {
    await deleteR2ObjectByUrl(url);
    return R2_STORAGE_PROVIDER;
  }

  await del(url);
  return 'vercel-blob';
}

export async function deleteStoredObjectsByPrefix(prefix: string): Promise<StoredObjectPrefixDeleteResult[]> {
  const results: StoredObjectPrefixDeleteResult[] = [];

  const blobResult: StoredObjectPrefixDeleteResult = {
    provider: 'vercel-blob',
    deleted: 0,
    bytes: 0,
  };

  try {
    const existingBlobs = await list({ prefix });
    for (const blob of existingBlobs.blobs) {
      await del(blob.url);
      blobResult.deleted += 1;
      blobResult.bytes += Number(blob.size || 0);
    }
  } catch (error) {
    console.warn('[media-storage] Failed to delete Vercel Blob prefix:', prefix, error);
  }
  results.push(blobResult);

  const r2Result: StoredObjectPrefixDeleteResult = {
    provider: R2_STORAGE_PROVIDER,
    deleted: 0,
    bytes: 0,
  };

  if (getR2Config()) {
    try {
      const objects = await listR2ObjectsByPrefix(prefix);
      for (const object of objects) {
        await deleteR2ObjectByKey(object.key);
        r2Result.deleted += 1;
        r2Result.bytes += object.size;
      }
    } catch (error) {
      console.warn('[media-storage] Failed to delete R2 prefix:', prefix, error);
    }
  }
  results.push(r2Result);

  return results;
}

export function storageFields(object: StoredObject): {
  storageProvider: StoredObjectProvider;
  storageKey?: string;
  storageBucket?: string;
  contentType?: string;
} {
  return {
    storageProvider: object.storageProvider,
    ...(object.storageKey ? { storageKey: object.storageKey } : {}),
    ...(object.storageBucket ? { storageBucket: object.storageBucket } : {}),
    ...(object.contentType ? { contentType: object.contentType } : {}),
  };
}

export function storageFieldsFromUrl(url: string, contentType?: string): {
  storageProvider: StoredObjectProvider;
  storageKey?: string;
  storageBucket?: string;
  contentType?: string;
} {
  const provider = inferStorageProviderFromUrl(url);
  const r2Config = getR2Config();

  return {
    storageProvider: provider,
    ...(provider === R2_STORAGE_PROVIDER ? { storageKey: getR2KeyFromUrl(url) || undefined } : {}),
    ...(provider === R2_STORAGE_PROVIDER && r2Config ? { storageBucket: r2Config.bucket } : {}),
    ...(contentType ? { contentType } : {}),
  };
}
