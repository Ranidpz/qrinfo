import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';
const state = globalThis.writerTests = {};
const expose = name => stub(Object.keys(state[name]).map(k => `export const ${k}=globalThis.writerTests.${name}.${k};`).join('\n'));
state.fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
state.policy = await loadTs('../../src/lib/content-intake/cloud-policy.ts', { './fattal': expose('fattal') });
state.setup = await loadTs('../../src/lib/content-intake/setup-review.ts', { './fattal': expose('fattal') });
state.read = await loadTs('../../src/lib/content-intake/read-grant.ts', { './fattal': expose('fattal'), './setup-review': expose('setup'), './cloud-policy': expose('policy') });
state.writer = await loadTs('../../src/lib/content-intake/write-grant.ts', { './fattal': expose('fattal'), './setup-review': expose('setup'), './cloud-policy': expose('policy'), './read-grant': expose('read') });
const id = 'a'.repeat(32), now = 1800000000000;
const input = { connectionId: id, keyHash: 'b'.repeat(64), ownerId: 'owner', ownerEmail: 'owner@example.invalid', projectId: 'fixture', shortId: state.fattal.FATTAL_BOOKLET_TARGETS.find(t => t.shortId !== '5ubXFS').shortId, durationMinutes: 15 };
const bindings = { projectId: 'fixture', publicProjectId: 'fixture', cloudProjectId: 'fixture', cloudOwnerId: 'owner', cloudOwnerEmail: input.ownerEmail };
function fixture() {
  const docs = new Map([['users/admin', { role: 'super_admin' }], ['users/owner', { email: input.ownerEmail }]]);
  const codes = state.fattal.FATTAL_BOOKLET_TARGETS.map(t => ({ shortId: t.shortId, ownerId: 'owner' })), writes = [];
  const snap = ref => ({ exists: docs.has(ref.path), data: () => docs.get(ref.path), ref, id: ref.id });
  let queue = Promise.resolve();
  const db = { collection: name => ({ doc: id => ({ path: `${name}/${id}`, id, get: async () => snap({ path: `${name}/${id}`, id }) }), where: () => ({ query: true }) }),
    runTransaction: fn => { const run = queue.then(() => fn({ get: async ref => ref.query ? { docs: codes.map(data => ({ data: () => data })) } : snap(ref),
      create: (ref, data) => { assert.ok(!docs.has(ref.path)); docs.set(ref.path, data); writes.push(ref.path); },
      update: (ref, data) => { docs.set(ref.path, { ...docs.get(ref.path), ...data }); writes.push(ref.path); } })); queue = run.catch(() => {}); return run; } };
  return { db, docs, codes, writes };
}
const issue = (f, value = input, config = bindings) => state.writer.issueWriteGrant(f.db, 'admin', config, state.writer.parseWriteGrant(value), () => now);
const inspect = (f, revoke = false, actor = 'admin', config = bindings) => state.writer.inspectWriteGrant(f.db, actor, config, id, revoke, () => now + 1);
test('writer is a new single-target 15-minute supervised grant; stores hash only and never upgrades an existing read identity', async () => {
  const f = fixture(), result = await issue(f), record = f.docs.get(`fattalCloudConnections/${id}`);
  assert.deepEqual(record.scopes, ['read', 'write']); assert.deepEqual(record.allowedTargets, [input.shortId]);
  assert.equal(record.writeMode, 'supervised'); assert.equal(record.expiresAt, now + 900000);
  assert.equal(record.keyHash, input.keyHash); assert.ok(!JSON.stringify(result).includes(input.keyHash));
  assert.ok(!JSON.stringify(record).includes('tq_fc_')); assert.equal(record.token, undefined);
  await assert.rejects(issue(f));
  const read = fixture(); read.docs.set(`fattalCloudConnections/${id}`, { scopes: ['read'] });
  await assert.rejects(issue(read)); await assert.rejects(inspect(read, true)); assert.deepEqual(read.writes, []);
});
test('writer parser denies arbitrary scope, targets, duration, paused Splash, credentials and malformed hashes', () => {
  for (const change of [{ scopes: ['read','write'] }, { allowedTargets: [] }, { durationMinutes: 60 }, { durationMinutes: '15' },
    { shortId: '5ubXFS' }, { shortId: 'foreign' }, { token: 'raw' }, { keyHash: 'bad' }, { connectionId: 'bad' }, { ownerEmail: 'bad' }]) {
    assert.throws(() => state.writer.parseWriteGrant({ ...input, ...change }));
  }
});
test('writer checks actor, owner, exact project and all unique parent targets before writing', async () => {
  for (const mutate of [f => f.docs.set('users/admin', { role: 'free' }), f => f.docs.delete('users/owner'), f => f.codes.pop(),
    f => f.codes.push({ ...f.codes[0] }), f => f.codes[0].ownerId = 'other', f => f.codes[0].parentCodeShortId = 'parent']) {
    const f = fixture(); mutate(f); await assert.rejects(issue(f)); assert.deepEqual(f.writes, []);
  }
  for (const change of [{ cloudOwnerId: undefined }, { cloudOwnerEmail: 'other@example.invalid' }, { cloudProjectId: 'other' },
    { publicProjectId: 'other' }, { legacyOwnerId: 'other' }, { legacyOwnerEmail: 'other@example.invalid' }]) {
    const f = fixture(); await assert.rejects(issue(f, input, { ...bindings, ...change })); assert.deepEqual(f.writes, []);
  }
});
test('missing writer cancellation is a permanent bound fence, cannot issue afterward and cannot affect another issuer', async () => {
  const f = fixture(); assert.equal((await inspect(f)).state, 'missing'); assert.deepEqual(f.writes, []);
  assert.equal((await inspect(f, true)).state, 'revoked'); const tomb = f.docs.get(`fattalCloudConnections/${id}`);
  assert.equal(tomb.recordType, 'revocation_tombstone'); assert.equal(tomb.writeMode, 'supervised');
  for (const field of ['keyHash', 'expiresAt', 'allowedTargets', 'token']) assert.equal(tomb[field], undefined);
  await inspect(f, true); assert.equal(f.writes.length, 1); await assert.rejects(issue(f));
  f.docs.set('users/other', { role: 'super_admin' }); await assert.rejects(inspect(f, true, 'other'));
  await assert.rejects(inspect(f, false, 'admin', { ...bindings, cloudOwnerId: 'other' }));
});
test('issuance first then cancellation never restores grant; expired grants remain inspectable', async () => {
  const f = fixture(); await issue(f); assert.equal((await inspect(f)).state, 'active');
  assert.equal((await state.writer.inspectWriteGrant(f.db, 'admin', bindings, id, false, () => now + 900000)).state, 'expired');
  assert.equal((await inspect(f, true)).state, 'revoked'); await inspect(f, true); assert.equal(f.writes.length, 2);
  await assert.rejects(issue(f));
});
const next = stub('export const NextResponse={json:(body,init)=>Response.json(body,init)};');
state.auth = await loadTs('../../src/lib/auth.ts', { 'next/server': next,
  'firebase-admin/auth': stub('export const getAuth=()=>({verifyIdToken:async()=>{if(globalThis.writerTests.invalid)throw Error();return {uid:"admin"};}});'),
  '@/lib/firebase-admin': stub('export const getAdminApp=()=>({});export const getAdminDb=()=>globalThis.writerTests.f.db;') });
const route = await loadTs('../../src/app/api/content-intake/dot/write-grant/route.ts', { 'next/server': next, '@/lib/auth': expose('auth'),
  '@/lib/content-intake/read-grant': expose('read'), '@/lib/content-intake/write-grant': expose('writer'),
  '@/lib/content-intake/cloud-policy': expose('policy'), '@/lib/content-intake/setup-review': expose('setup'),
  '@/lib/firebase-admin': stub('export const getAdminApp=()=>({options:{projectId:"fixture"}});export const getAdminDb=()=>globalThis.writerTests.f.db;') });
function reset() {
  const f = fixture(); state.f = f; state.invalid = false;
  for (const key of Object.keys(process.env)) if (key.startsWith('FATTAL_')) delete process.env[key];
  Object.assign(process.env, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fixture', FATTAL_CLOUD_PROJECT_ID: 'fixture', FATTAL_CLOUD_OWNER_ID: 'owner', FATTAL_CLOUD_OWNER_EMAIL: input.ownerEmail,
    FATTAL_CLOUD_ENABLED: 'true', FATTAL_CLOUD_WRITE_GRANTS_ENABLED: 'true', FATTAL_CLOUD_SUPERVISED_ENABLED: 'true' }); return f;
}
async function call(method = 'POST', value = input, headers = {}, suffix = '') {
  const url = new URL('https://fixture.invalid/api/content-intake/dot/write-grant' + suffix);
  const request = new Request(url, { method, headers: { Authorization: 'Bearer synthetic', Origin: url.origin, 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof value === 'string' ? value : JSON.stringify(value) } : {}) }); request.nextUrl = url;
  const response = await route[method](request); assert.equal(response.headers.get('cache-control'), 'no-store');
  return { status: response.status, body: await response.json() };
}
test('actual writer route rejects disabled gates, missing/invalid auth, ordinary actor, foreign Origin, oversized body and query pollution', async () => {
  for (const scenario of ['cloud', 'writer', 'supervised', 'missing', 'invalid', 'role', 'origin', 'size', 'query']) {
    const f = reset();
    if (scenario === 'cloud') delete process.env.FATTAL_CLOUD_ENABLED;
    if (scenario === 'writer') delete process.env.FATTAL_CLOUD_WRITE_GRANTS_ENABLED;
    if (scenario === 'supervised') delete process.env.FATTAL_CLOUD_SUPERVISED_ENABLED;
    if (scenario === 'invalid') state.invalid = true;
    if (scenario === 'role') f.docs.set('users/admin', { role: 'free' });
    const r = await call('POST', scenario === 'size' ? 'x'.repeat(4097) : input, scenario === 'missing' ? { Authorization: '' } : scenario === 'origin' ? { Origin: 'https://foreign.invalid' } : {}, scenario === 'query' ? '?extra=1' : '');
    assert.ok(r.status >= 400, scenario); assert.deepEqual(f.writes, []);
    assert.ok(!JSON.stringify(r.body).includes(input.keyHash));
  }
});
test('actual writer route supports issuance, GET-only inspection and missing cancellation while all issuance gates are off', async () => {
  const f = reset(); assert.equal((await call()).status, 201);
  delete process.env.FATTAL_CLOUD_ENABLED; delete process.env.FATTAL_CLOUD_WRITE_GRANTS_ENABLED; delete process.env.FATTAL_CLOUD_SUPERVISED_ENABLED;
  assert.equal((await call('GET', null, {}, '?connectionId=' + id)).body.state, 'active'); assert.equal(f.writes.length, 1);
  assert.equal((await call('DELETE', null, {}, '?connectionId=' + id)).body.state, 'revoked');
  const fresh = 'c'.repeat(32); assert.equal((await call('DELETE', null, {}, '?connectionId=' + fresh)).body.state, 'revoked');
  assert.equal((await call('GET', null, {}, '?connectionId=' + fresh)).body.state, 'revoked'); assert.equal(f.writes.length, 3);
});
