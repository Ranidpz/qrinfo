#!/usr/bin/env node
/**
 * Recount users/{uid}.storageUsed from the bytes actually stored under `{uid}/` in
 * Cloudflare R2 + Vercel Blob. The old client-side accounting drifted (e.g. Selfie Beam
 * admin seeds were counted twice), and /api/upload now ENFORCES the quota server-side,
 * so an inflated counter would wrongly block uploads.
 *
 * Dry run by default — prints stored vs. counted and who would be over their limit.
 *   node --env-file=.env.local scripts/recount-storage.mjs
 *   node --env-file=.env.local scripts/recount-storage.mjs --apply      # write the recounted values
 * Needs FIREBASE_SERVICE_ACCOUNT_KEY plus the R2 / BLOB_READ_WRITE_TOKEN env of the target project.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { list } from '@vercel/blob';

const APPLY = process.argv.includes('--apply');
const env = (...names) => names.map((n) => process.env[n]?.trim()).find(Boolean);

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 'null');
if (!sa) { console.error('FIREBASE_SERVICE_ACCOUNT_KEY is not set'); process.exit(1); }
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const r2 = {
  accountId: env('CLOUDFLARE_R2_ACCOUNT_ID', 'R2_ACCOUNT_ID'),
  accessKeyId: env('CLOUDFLARE_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID'),
  secretAccessKey: env('CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY'),
  bucket: env('CLOUDFLARE_R2_BUCKET', 'R2_BUCKET'),
};
const s3 = r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
    })
  : null;

async function r2Bytes(prefix) {
  if (!s3) return 0;
  let total = 0;
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: r2.bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of res.Contents || []) total += o.Size || 0;
    token = res.NextContinuationToken;
  } while (token);
  return total;
}

async function blobBytes(prefix) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return 0;
  let total = 0;
  let cursor;
  do {
    const res = await list({ prefix, cursor, limit: 1000 });
    for (const b of res.blobs) total += b.size || 0;
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return total;
}

const mb = (n) => (n / 1048576).toFixed(1);
console.log(`Project: ${sa.project_id} — ${APPLY ? 'APPLY' : 'dry run'}  (R2: ${s3 ? 'yes' : 'no'}, Blob: ${process.env.BLOB_READ_WRITE_TOKEN ? 'yes' : 'no'})\n`);

const users = await db.collection('users').get();
let overAfter = 0;
for (const u of users.docs) {
  const data = u.data();
  const stored = Number(data.storageUsed) || 0;
  const limit = Number(data.storageLimit) || 0;
  const counted = (await r2Bytes(`${u.id}/`)) + (await blobBytes(`${u.id}/`));
  const over = data.role !== 'super_admin' && counted > limit;
  if (over) overAfter++;
  if (stored !== counted || over) {
    console.log(`${u.id} ${data.email || ''} [${data.role}] stored ${mb(stored)}MB → actual ${mb(counted)}MB / limit ${mb(limit)}MB${over ? '  ⚠ OVER LIMIT' : ''}`);
  }
  if (APPLY && stored !== counted) await u.ref.update({ storageUsed: counted });
}
console.log(`\n${users.size} users; ${overAfter} over their limit by actual bytes${APPLY ? ' — storageUsed rewritten' : ' (dry run — nothing written)'}`);
