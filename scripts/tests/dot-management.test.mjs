import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';

const state = { role: 'super_admin', authenticated: true, resolutions: 0, calls: [], mutate: r => r, failed: false };
const fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
globalThis.dotTest = { state, fattal };
const expose = name => stub(Object.keys(globalThis.dotTest[name]).map(k => `export const ${k}=globalThis.dotTest.${name}.${k};`).join('\n'));
const policy = await loadTs('../../src/lib/content-intake/cloud-policy.ts', { './fattal': expose('fattal') });
globalThis.dotTest.policy = policy;
const { createFattalCloudClient, CloudClientError } = await loadTs('../../src/lib/content-intake/cloud-client.ts', {
  'server-only': stub('export {};'), './fattal': expose('fattal'), './cloud-policy': expose('policy'),
});
const next = stub('export const NextResponse={json:(data,init)=>new Response(JSON.stringify(data),init)};');
const auth = await loadTs('../../src/lib/auth.ts', {
  'next/server': next,
  'firebase-admin/auth': stub(`export const getAuth=()=>({verifyIdToken:async()=>{if(!globalThis.dotTest.state.authenticated)throw Error('invalid');return {uid:'admin'};}});`),
  '@/lib/firebase-admin': stub(`export const getAdminApp=()=>({});export const getAdminDb=()=>({collection:name=>{if(name!=='users')throw Error('Unexpected database access');return {doc:()=>({get:async()=>({data:()=>({role:globalThis.dotTest.state.role})})})};}});`),
});
globalThis.dotTest.auth = auth;
const now = Date.now();
const target = fattal.FATTAL_BOOKLET_TARGETS[0];
const hash = 'c'.repeat(64), manifestId = 'd'.repeat(64);
const key = `tq_fc_${'a'.repeat(32)}.${'b'.repeat(64)}`; // Synthetic fixture only.
globalThis.dotTest.client = {
  CloudClientError,
  createFattalCloudClient: config => createFattalCloudClient(config, {
    now: () => now,
    resolveSecret: async () => { state.resolutions++; return key; },
    fetch: async (url, options) => {
      state.calls.push({url,options});
      assert.equal(options.method, 'GET');
      assert.equal(new URL(url).origin, 'https://fixture.invalid');
      if (state.failed) throw Error(key);
      let body = url.includes('/recovery?')
        ? { protocol: 1, manifestId, shortId: target.shortId, sha256: hash, status: 'uncertain', verified: false, retryAllowed: false, notification: 'disabled', cleanup: 'disabled' }
        : { protocol: 1, ownerId: 'owner', ownerEmail: 'fixture@example.invalid', projectId: 'fixture', scopes: ['read'], expiresAt: now + 60000, notificationsEnabled: false, cleanupEnabled: false,
          targets: [{ shortId: target.shortId, hotel: target.key, expectedVersion: hash, pending: true }] };
      body = state.mutate({ ...body, keyHash: 'hidden-hash', internal: 'hidden-internal' });
      return new Response(JSON.stringify(body));
    },
  }),
};
const route = await loadTs('../../src/app/api/content-intake/dot/route.ts', {
  'next/server': next, '@/lib/auth': expose('auth'), '@/lib/content-intake/cloud-client': expose('client'),
});
function reset(enabled = true) {
  Object.assign(state, { role: 'super_admin', authenticated: true, resolutions: 0, calls: [], mutate: r => r, failed: false });
  Object.assign(process.env, { FATTAL_CLOUD_MANAGEMENT_ENABLED: String(enabled), FATTAL_CLOUD_CLIENT_BASE_URL: 'https://fixture.invalid',
    FATTAL_CLOUD_CLIENT_OWNER_ID: 'owner', FATTAL_CLOUD_CLIENT_OWNER_EMAIL: 'fixture@example.invalid', FATTAL_CLOUD_CLIENT_PROJECT_ID: 'fixture',
    FATTAL_CLOUD_CLIENT_TARGETS: JSON.stringify([target.shortId]) });
}
async function request(query = '', headers = { Authorization: 'Bearer fixture' }) {
  const url = `https://dashboard.invalid/api/content-intake/dot${query}`;
  const req = new Request(url, {headers}); req.nextUrl = new URL(url);
  const response = await route.GET(req);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return { status: response.status, body: await response.json() };
}
test('real admin auth rejects absent/invalid bearer, ordinary users and cloud-key-only requests before client access', async () => {
  for (const scenario of ['missing', 'invalid', 'user', 'cloud']) {
    reset();
    if (scenario === 'invalid') state.authenticated = false;
    if (scenario === 'user') state.role = 'admin';
    const result = await request('', scenario === 'missing' ? {} : scenario === 'cloud' ? {'x-fattal-cloud-key': key} : undefined);
    assert.equal(result.status, scenario === 'user' ? 403 : 401);
    assert.equal(state.resolutions, 0); assert.equal(state.calls.length, 0);
  }
});
test('disabled and incomplete configuration truthfully return unconfigured without secret lookup or transport', async () => {
  for (const change of [() => {process.env.FATTAL_CLOUD_MANAGEMENT_ENABLED='false';}, () => {delete process.env.FATTAL_CLOUD_CLIENT_OWNER_ID;},
    () => {process.env.FATTAL_CLOUD_CLIENT_TARGETS='broken';}, () => {process.env.FATTAL_CLOUD_CLIENT_TARGETS='[]';}]) {
    reset(); change(); assert.deepEqual((await request()).body, {state:'unconfigured'});
    assert.equal(state.resolutions, 0); assert.equal(state.calls.length, 0);
  }
});
test('query cannot supply credentials, configuration, effects, duplicate fields or partial identities', async () => {
  for (const query of ['?key=fake', '?baseUrl=https://other.invalid', '?ownerId=other', '?commit=true', '?manifestId=x', '?manifestId=x&manifestId=y', '?sha256=x&shortId=x&manifestId=x']) {
    reset(); assert.equal((await request(query)).status, 400); assert.equal(state.resolutions, 0); assert.equal(state.calls.length, 0);
  }
});
test('health exposes only verified safe read-only attestation', async () => {
  reset(); const result = await request(); assert.equal(result.status, 200); assert.equal(result.body.state, 'ready');
  assert.equal(result.body.health.ownerEmail, 'fixture@example.invalid'); assert.deepEqual(result.body.health.scopes, ['read']);
  for (const forbidden of [key, 'hidden-hash', 'hidden-internal', 'credentialRef']) assert.ok(!JSON.stringify(result).includes(forbidden));
  assert.equal(state.calls.length, 1);
});
test('expired, wrong owner/project, write-scoped or out-of-bounds health never becomes ready', async () => {
  for (const change of [r => r.expiresAt=now, r => r.ownerId='other', r => r.projectId='other', r => r.scopes=['read','write'], r => r.targets[0].shortId='child']) {
    reset(); state.mutate=r=>{change(r);return r;}; const result=await request();
    assert.equal(result.status,503); assert.deepEqual(result.body,{state:'unavailable'});
  }
});
test('recovery requires bound identity and preserves uncertainty without writes or retry', async () => {
  reset(); const query='?'+new URLSearchParams({manifestId,sha256:hash,shortId:target.shortId});
  const result=await request(query); assert.equal(result.status,200); assert.equal(result.body.recovery.status,'uncertain');
  assert.equal(result.body.recovery.retryAllowed,false); assert.equal(state.calls.length,2);
  assert.equal(result.body.recovery.keyHash,undefined);
  reset(); state.mutate=r=>r.manifestId ? {...r,sha256:'e'.repeat(64)}:r;
  assert.equal((await request(query)).status,503); assert.equal(state.calls.length,2);
});
test('transport errors and echoed secrets cannot reach browser', async () => {
  reset(); state.failed=true; let result=await request(); assert.deepEqual(result.body,{state:'unavailable'});
  reset(); state.mutate=r=>({...r,debug:key}); result=await request(); assert.deepEqual(result.body,{state:'unavailable'});
  assert.ok(!JSON.stringify(result).includes(key));
});
test('management route exports only GET; no writes or credential provisioning', () => {
  assert.deepEqual(Object.keys(route).sort(),['GET','runtime']);
});
