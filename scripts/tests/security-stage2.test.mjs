import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';

// Security stage 2 helpers: byte-sniffed upload types, and the owner check that gates every
// server-side delete of a URL taken from client-writable media. No network or credentials.

const R2_HOST = 'theq-media.playzones.app';

async function loadGuard() {
  process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_ownstore_secret';
  return loadTs('../../src/lib/storage-guard.ts', {
    '@vercel/blob': stub('export const head=async()=>({});'),
    'firebase-admin/firestore': stub('export const FieldValue={increment:(n)=>n};'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>{throw Error("no db in this test")};'),
    '@/lib/r2-storage': stub(`
      const HOST='${R2_HOST}';
      export const getR2Config=()=>({publicUrl:'https://'+HOST});
      export const isR2Url=(u)=>{try{return new URL(u).hostname===HOST}catch{return false}};
      export const getR2KeyFromUrl=(u)=>decodeURIComponent(new URL(u).pathname.slice(1));
      export const getR2ObjectSizeByKey=async()=>0;
    `),
  });
}

test('isOwnersStoredFile: only our storage, only under the code owner folder', async () => {
  const { isOwnersStoredFile } = await loadGuard();
  assert.equal(isOwnersStoredFile(`https://${R2_HOST}/owner1/code1/booklets/a.pdf`, 'owner1'), true);
  assert.equal(isOwnersStoredFile('https://ownstore.public.blob.vercel-storage.com/owner1/code1/a.pdf', 'owner1'), true);
  // another customer's file
  assert.equal(isOwnersStoredFile(`https://${R2_HOST}/owner2/code9/booklets/a.pdf`, 'owner1'), false);
  // foreign host, plain http, traversal, missing owner
  assert.equal(isOwnersStoredFile('https://evil.example/owner1/code1/a.pdf', 'owner1'), false);
  assert.equal(isOwnersStoredFile(`http://${R2_HOST}/owner1/code1/a.pdf`, 'owner1'), false);
  assert.equal(isOwnersStoredFile(`https://${R2_HOST}/owner1/../owner2/a.pdf`, 'owner1'), false);
  assert.equal(isOwnersStoredFile(`https://${R2_HOST}/owner1/code1/a.pdf`, ''), false);
  assert.equal(isOwnersStoredFile('not a url', 'owner1'), false);
});

test('sniffImageType: raster formats by magic bytes, never by name or declared type', async () => {
  const { sniffImageType, EXTENSION_FOR } = await loadTs('../../src/lib/imageSniff.ts');
  const bytes = (...parts) => Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
  const pad = (b) => Uint8Array.from([...b, ...new Array(16).fill(0)]);

  assert.equal(sniffImageType(pad(bytes([0xff, 0xd8, 0xff, 0xe0]))), 'image/jpeg');
  assert.equal(sniffImageType(pad(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]))), 'image/png');
  assert.equal(sniffImageType(pad(bytes('GIF89a'))), 'image/gif');
  assert.equal(sniffImageType(pad(bytes('RIFF', [0, 0, 0, 0], 'WEBP'))), 'image/webp');
  assert.equal(sniffImageType(pad(bytes([0, 0, 0, 0x1c], 'ftyp', 'heic'))), 'image/heic');
  assert.equal(sniffImageType(pad(bytes([0, 0, 0, 0x1c], 'ftyp', 'avif'))), 'image/avif');
  // SVG / HTML / PDF / empty are refused, whatever the client claimed
  assert.equal(sniffImageType(pad(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))), null);
  assert.equal(sniffImageType(pad(bytes('<?xml version="1.0"?><svg'))), null);
  assert.equal(sniffImageType(pad(bytes('<html><script>'))), null);
  assert.equal(sniffImageType(pad(bytes('%PDF-1.7'))), null);
  assert.equal(sniffImageType(new Uint8Array(0)), null);
  assert.equal(EXTENSION_FOR['image/jpeg'], 'jpg');
});
