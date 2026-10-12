import { createHmac, timingSafeEqual } from 'crypto';
import { head } from '@vercel/blob';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getR2Config, getR2KeyFromUrl, getR2ObjectSizeByKey, isR2Url } from '@/lib/r2-storage';

/**
 * Server-only guards for stored media (R2 + Vercel Blob):
 * - which stored objects a caller may delete,
 * - signed per-object tokens so anonymous uploaders (Selfie Beam participants) can delete
 *   exactly the photo they uploaded and nothing else,
 * - storage accounting on users/{uid}.storageUsed (clients can no longer write that field).
 *
 * Every object key we write starts with the owner's uid: `{uid}/{codeId|folder}/...`.
 */

// Our R2 custom domain (also hard-coded in media-storage.ts isManagedStorageUrl).
const OWN_R2_DOMAIN = 'theq-media.playzones.app';

/** Hostname of OUR Vercel Blob store, derived from the read/write token (`vercel_blob_rw_<storeId>_...`). */
export function getOwnBlobHostname(): string | null {
  const override = process.env.BLOB_PUBLIC_HOSTNAME?.trim();
  if (override) return override.toLowerCase();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const storeId = token?.split('_')[3];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

export function getOwnR2Hostname(): string | null {
  const config = getR2Config();
  if (!config) return null;
  try {
    return new URL(config.publicUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True only for URLs served from our own Blob store or our own R2 public domain. */
export function isOwnStorageUrl(url: string): boolean {
  let hostname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === getOwnBlobHostname() || hostname === getOwnR2Hostname() || hostname === OWN_R2_DOMAIN) return true;
  // Older stores that still hold live files (comma-separated hostnames).
  const extra = (process.env.EXTRA_STORAGE_HOSTNAMES || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(hostname);
}

/**
 * Object key for a URL in our own storage, or null for anything else.
 * Keys with empty or dot segments are rejected outright.
 */
export function getStoredObjectKey(url: string): string | null {
  if (!isOwnStorageUrl(url)) return null;

  let key: string | null = null;
  try {
    if (isR2Url(url)) {
      key = getR2KeyFromUrl(url);
    } else {
      key = decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
    }
  } catch {
    return null;
  }

  if (!key) return null;
  const segments = key.split('/');
  if (segments.length < 2 || segments.some((s) => !s || s === '.' || s === '..')) return null;
  return key;
}

async function isSuperAdmin(uid: string): Promise<boolean> {
  const snap = await getAdminDb().collection('users').doc(uid).get();
  return snap.data()?.role === 'super_admin';
}

/**
 * May `uid` delete the object at `key`?
 * - their own files (`{uid}/...`),
 * - files inside a code they own or collaborate on (`{anyone}/{codeId}/...`),
 * - anything, for super admins.
 */
export async function canDeleteStoredObject(uid: string, key: string): Promise<boolean> {
  const [first, second] = key.split('/');
  if (first === uid) return true;

  if (second) {
    try {
      const code = await getAdminDb().collection('codes').doc(second).get();
      const data = code.data();
      // The key must really be that code's folder: `{code owner}/{codeId}/...` (or a legacy
      // `{qvote|avatars}/{codeId}/...`). Otherwise anyone could create a code whose id equals
      // some folder name and claim other users' files through it.
      const isCodeFolder = !!data && (first === data.ownerId || first === 'qvote' || first === 'avatars');
      if (isCodeFolder && (data!.ownerId === uid || (Array.isArray(data!.collaborators) && data!.collaborators.includes(uid)))) {
        return true;
      }
    } catch {
      // not a code id — fall through
    }
  }

  return isSuperAdmin(uid);
}

// ---------- signed per-object tokens ----------

function getSigningSecret(): string | null {
  return (
    process.env.MEDIA_TOKEN_SECRET?.trim() ||
    process.env.OTP_HASH_SALT?.trim() ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim() ||
    null
  );
}

/** Token that proves the holder uploaded the object at `key`. Null if no server secret is configured. */
export function signObjectDeleteToken(key: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(`media-delete:${key}`).digest('base64url');
}

export function verifyObjectDeleteToken(key: string, token: unknown): boolean {
  if (typeof token !== 'string' || !token) return false;
  const expected = signObjectDeleteToken(key);
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- storage accounting ----------

export async function getStoredObjectSize(url: string): Promise<number | null> {
  const key = getStoredObjectKey(url);
  if (!key) return null;
  try {
    if (isR2Url(url)) return await getR2ObjectSizeByKey(key);
    const meta = await head(url);
    return meta.size ?? null;
  } catch {
    return null;
  }
}

/** Ownerid of an object key (its first segment). */
export function ownerOfKey(key: string): string {
  return key.split('/')[0];
}

/**
 * Check the uploader still has room for `bytes`. Super admins are never blocked.
 * Returns the numbers so the route can report them.
 */
export async function checkStorageQuota(
  uid: string,
  bytes: number
): Promise<{ ok: boolean; used: number; limit: number }> {
  const snap = await getAdminDb().collection('users').doc(uid).get();
  const data = snap.data() || {};
  const used = Math.max(0, Number(data.storageUsed) || 0);
  const limit = Number(data.storageLimit) || 0;
  if (data.role === 'super_admin') return { ok: true, used: Math.max(0, used), limit };
  return { ok: limit > 0 && used + bytes <= limit, used, limit };
}

/** Add (or with a negative delta, free) storage on users/{uid}. Never goes below zero. */
export async function adjustStorageUsed(uid: string, delta: number): Promise<void> {
  if (!uid || !delta || !Number.isFinite(delta)) return;
  const ref = getAdminDb().collection('users').doc(uid);

  // Plain increments (no transaction): parallel bulk deletes must not contend and fail.
  // A counter that dips below zero is read as zero by checkStorageQuota.
  await ref.set({ storageUsed: FieldValue.increment(delta) }, { merge: true });
}

/**
 * Does `key` live in `codeId`'s folder? Covers `{owner}/{codeId}/...` and the legacy
 * `{qvote|avatars}/{codeId}/...` layouts.
 */
export function keyBelongsToCode(key: string, codeId: string, ownerId: string | undefined): boolean {
  const [first, second] = key.split('/');
  if (second !== codeId) return false;
  return first === 'qvote' || first === 'avatars' || (!!ownerId && first === ownerId);
}
