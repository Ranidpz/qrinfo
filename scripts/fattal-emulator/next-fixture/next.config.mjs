import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

assert.equal(process.env.FATTAL_TEST_NEXT, 'true', 'This fixture cannot run outside isolated acceptance');
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST || '', /^127\.0\.0\.1:\d+$/);
assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'demo-fattal-acceptance');
const source = fileURLToPath(new URL('../../../src', import.meta.url));
const fixture = fileURLToPath(new URL('.', import.meta.url));
export default {
  distDir: process.env.FATTAL_TEST_NEXT_DIST || '.next',
  serverExternalPackages: ['firebase-admin'],
  experimental: { externalDir: true },
  webpack(config) {
    Object.assign(config.resolve.alias, {
      '@source': source,
      '@/lib/media-storage$': join(fixture, 'storage.mjs'),
      '@/lib/r2-storage$': join(fixture, 'storage-origin.mjs'),
      '@/lib/fetchWithAuth$': join(fixture, 'browser-auth.mjs'),
      '@': source,
    });
    return config;
  },
};
