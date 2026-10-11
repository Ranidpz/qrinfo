import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import * as sdk from '@aws-sdk/client-s3';
import { loadTs, stub } from './load-ts.mjs';
let calls = 0;
const clients = [];
// Actual SDK retry stack, but every request terminates in this in-memory handler.
class FixtureS3 extends sdk.S3Client {
  constructor(config) {
    super({ ...config, requestHandler: { handle: async () => {
      calls++;
      return { response: { statusCode: 503, headers: { 'content-type': 'application/xml' }, body: Readable.from(['<Error><Code>ServiceUnavailable</Code></Error>']) } };
    } } });
    clients.push(this);
  }
}
globalThis.fattalStorageTest = { ...sdk, S3Client: FixtureS3 };
const sdkShim = stub(['S3Client','DeleteObjectCommand','HeadObjectCommand','ListObjectsV2Command','PutObjectCommand'].map(k => `export const ${k}=globalThis.fattalStorageTest.${k};`).join('\n'));
const r2 = await loadTs('../../src/lib/r2-storage.ts', { '@aws-sdk/client-s3': sdkShim });
globalThis.fattalStorageTest.r2 = r2;
const storage = await loadTs('../../src/lib/media-storage.ts', {
  '@vercel/blob': stub('export const put=()=>{throw Error("Unexpected Blob write")};export const del=()=>{throw Error("Unexpected deletion")};export const list=()=>{throw Error("Unexpected listing")};'),
  '@/lib/r2-storage': stub(Object.keys(r2).map(k => `export const ${k}=globalThis.fattalStorageTest.r2.${k};`).join('\n')),
});
test('cloud storage explicit single-attempt mode prevents actual S3 SDK retry on retryable failure', async () => {
  Object.assign(process.env, { AWS_MAX_ATTEMPTS:'3', CLOUDFLARE_R2_ACCOUNT_ID:'synthetic-account', CLOUDFLARE_R2_ACCESS_KEY_ID:'synthetic-access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY:'synthetic-secret', CLOUDFLARE_R2_BUCKET:'synthetic-bucket', CLOUDFLARE_R2_PUBLIC_URL:'https://storage.invalid' });
  await assert.rejects(storage.uploadStoredObject({ key:'fixture.pdf', body:Buffer.from('%PDF-fixture'), contentType:'application/pdf', provider:'cloudflare-r2', maxAttempts:1 }));
  assert.equal(calls,1); assert.equal(await clients[0].config.maxAttempts(),1);
  calls = 0;
  await assert.rejects(storage.uploadStoredObject({ key:'ordinary.pdf', body:Buffer.from('%PDF-fixture'), contentType:'application/pdf', provider:'cloudflare-r2' }));
  assert.equal(await clients[1].config.maxAttempts(),3); assert.equal(calls,3, 'Ordinary storage retry configuration is unchanged');
  for (const client of clients) client.destroy();
});
