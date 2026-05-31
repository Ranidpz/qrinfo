import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import crypto from 'crypto';

export const R2_STORAGE_PROVIDER = 'cloudflare-r2' as const;

export interface R2UploadResult {
  provider: typeof R2_STORAGE_PROVIDER;
  bucket: string;
  key: string;
  url: string;
  size: number;
  contentType: string;
  etag?: string;
}

export interface R2ListedObject {
  key: string;
  url: string;
  size: number;
  contentType?: string;
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

let cachedClient: S3Client | null = null;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getR2Config(): R2Config | null {
  const accountId = readEnv('CLOUDFLARE_R2_ACCOUNT_ID') || readEnv('R2_ACCOUNT_ID');
  const accessKeyId = readEnv('CLOUDFLARE_R2_ACCESS_KEY_ID') || readEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY') || readEnv('R2_SECRET_ACCESS_KEY');
  const bucket = readEnv('CLOUDFLARE_R2_BUCKET') || readEnv('R2_BUCKET');
  const publicUrl = readEnv('CLOUDFLARE_R2_PUBLIC_URL') || readEnv('R2_PUBLIC_URL');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
  };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

export function getConfiguredPdfStorageProvider(): 'cloudflare-r2' | 'vercel-blob' {
  const provider = readEnv('PDF_STORAGE_PROVIDER') || readEnv('MEDIA_STORAGE_PROVIDER');
  return provider === R2_STORAGE_PROVIDER ? R2_STORAGE_PROVIDER : 'vercel-blob';
}

export function getConfiguredMediaStorageProvider(mediaType?: string): 'cloudflare-r2' | 'vercel-blob' {
  const mediaProvider = readEnv('MEDIA_STORAGE_PROVIDER');
  const pdfProvider = readEnv('PDF_STORAGE_PROVIDER');
  const provider = mediaType === 'pdf'
    ? pdfProvider || mediaProvider
    : mediaProvider;

  return provider === R2_STORAGE_PROVIDER ? R2_STORAGE_PROVIDER : 'vercel-blob';
}

function getR2Client(config: R2Config): S3Client {
  if (cachedClient) return cachedClient;

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

export function sanitizeObjectName(name: string, fallback = 'file'): string {
  const clean = name
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 140);

  return clean || fallback;
}

export function buildStorageKey(parts: string[], filename: string): string {
  const safeParts = parts
    .map((part) => sanitizeObjectName(part))
    .filter(Boolean);
  const safeFilename = sanitizeObjectName(filename, 'file');
  return [...safeParts, safeFilename].join('/');
}

export function buildUniqueFilename(originalName: string, extension?: string): string {
  const ext = extension || originalName.split('.').pop() || 'bin';
  const base = sanitizeObjectName(originalName.replace(/\.[^/.]+$/, ''), 'file');
  const suffix = crypto.randomBytes(6).toString('hex');
  return `${Date.now()}_${suffix}_${base}.${sanitizeObjectName(ext, 'bin')}`;
}

function encodeKeyForUrl(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function getR2PublicUrl(key: string): string {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  return `${config.publicUrl}/${encodeKeyForUrl(key)}`;
}

export function isR2Url(url: string): boolean {
  const config = getR2Config();
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) return true;
    if (!config) return false;
    return parsed.hostname === new URL(config.publicUrl).hostname;
  } catch {
    return false;
  }
}

export function getR2KeyFromUrl(url: string): string | null {
  const config = getR2Config();
  if (!config) return null;

  try {
    const parsed = new URL(url);
    const publicBase = new URL(config.publicUrl);

    if (parsed.hostname === publicBase.hostname) {
      const basePath = publicBase.pathname.replace(/\/+$/, '');
      const rawPath = parsed.pathname.startsWith(basePath)
        ? parsed.pathname.slice(basePath.length)
        : parsed.pathname;
      return decodeURIComponent(rawPath.replace(/^\/+/, ''));
    }

    if (parsed.hostname.endsWith('.r2.cloudflarestorage.com')) {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments[0] === config.bucket) segments.shift();
      return decodeURIComponent(segments.join('/'));
    }
  } catch {
    return null;
  }

  return null;
}

export async function uploadBufferToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}): Promise<R2UploadResult> {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const client = getR2Client(config);

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    CacheControl: params.cacheControl,
    Metadata: params.metadata,
  }));

  const head = await client.send(new HeadObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
  }));

  return {
    provider: R2_STORAGE_PROVIDER,
    bucket: config.bucket,
    key: params.key,
    url: getR2PublicUrl(params.key),
    size: head.ContentLength ?? params.body.byteLength,
    contentType: head.ContentType || params.contentType,
    etag: head.ETag,
  };
}

export async function deleteR2ObjectByUrl(url: string): Promise<void> {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const key = getR2KeyFromUrl(url);
  if (!key) {
    throw new Error('Could not resolve R2 object key from URL');
  }

  const client = getR2Client(config);
  await client.send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}

export async function deleteR2ObjectByKey(key: string): Promise<void> {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const client = getR2Client(config);
  await client.send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}

export async function listR2ObjectsByPrefix(prefix: string): Promise<R2ListedObject[]> {
  const config = getR2Config();
  if (!config) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const client = getR2Client(config);
  const objects: R2ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    for (const item of response.Contents || []) {
      if (!item.Key) continue;
      objects.push({
        key: item.Key,
        url: getR2PublicUrl(item.Key),
        size: item.Size || 0,
      });
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}
