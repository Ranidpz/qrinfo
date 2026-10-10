import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';

const fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
globalThis.cloudFixture = { fattal };
const exportsOf = (name, value) => stub(Object.keys(value).map(key => `export const ${key}=globalThis.cloudFixture.${name}.${key};`).join('\n'));
const fattalModule = exportsOf('fattal', fattal);
const policy = await loadTs('../../src/lib/content-intake/cloud-policy.ts', { './fattal': fattalModule });
globalThis.cloudFixture.policy = policy;
const policyModule = exportsOf('policy', policy);
const { createCloudService } = await loadTs('../../src/lib/content-intake/cloud-service.ts', { './fattal': fattalModule, './cloud-policy': policyModule });
const { sha256, activeVersion, manifestId, parseManifest, validateGrant } = policy;
const instant = Date.parse('2026-10-08T09:00:00Z');
const token = `tq_fc_${'a'.repeat(32)}.${'b'.repeat(64)}`; // Synthetic test fixture only.
const grantPath = `fattalCloudConnections/${'a'.repeat(32)}`;
const config = { enabled: true, writesEnabled: true, ownerId: 'fixture-owner', ownerEmail: 'fixture@example.invalid', projectId: 'fixture-project' };
const bytes = Buffer.from('%PDF-1.7\nfixture brochure');
const first = fattal.FATTAL_BOOKLET_TARGETS[0];
function grant() { return { workflow: 'fattal-cloud-v1', keyHash: sha256(token), ...config, ownerVerifiedAt: instant - 1000, ownerVerifiedBy: 'fixture-reviewer', scopes: ['read', 'write'], allowedTargets: [first.shortId], expiresAt: instant + 86400000 }; }
const old = { id: 'old', type: 'pdf', filename: 'same.pdf', size: 20, uploadedBy: config.ownerId, url: 'https://fixture.invalid/old.pdf', pageCount: 9 };
function manifest() { return { protocol: 1, ownerId: config.ownerId, projectId: config.projectId, shortId: first.shortId, hotel: first.key,
  period: { kind: 'weekend', startDate: '2026-10-08', endDate: '2026-10-10' }, filename: 'same.pdf', sha256: sha256(bytes), size: bytes.length,
  expectedVersion: activeVersion([old]), sourceGroupId: 'group', sources: [{ messageId: 'message-1', fileId: 'file-1', sha256: sha256(bytes) }], supersedes: [],
  review: { reviewer: 'reviewer', reviewedAt: instant, evidence: 'Explicit message and PDF identify this hotel and period; all context conflicts resolved.', contextResolved: true, replacementApproved: true } }; }

// Atomic in-memory Firestore fixture, with serialized concurrent transactions,
// rollback, immutable snapshots and the Firestore reads-before-writes invariant.
class MemoryDb {
  data = new Map(); writes = 0; queue = Promise.resolve(); loseResponse = false;
  collection(name) {
    return { doc: id => ({ path: `${name}/${id}`, id, get: () => this.snapshot(`${name}/${id}`) }),
      where: (field, op, values) => ({ query: { name, field, op, values }, get: () => this.query({ name, field, op, values }) }) };
  }
  async snapshot(path, state = this.data) {
    const data = structuredClone(state.get(path));
    return { exists: data !== undefined, id: path.split('/')[1], ref: { path }, data: () => structuredClone(data) };
  }
  async query(q, state = this.data) {
    assert.equal(q.op, 'in');
    const docs = await Promise.all([...state].filter(([path, d]) => path.startsWith(`${q.name}/`) && q.values.includes(d[q.field])).map(([path]) => this.snapshot(path, state)));
    return { docs };
  }
  async runTransaction(fn) {
    const previous = this.queue;
    let release;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    let state = structuredClone(this.data);
    let writes = 0;
    try {
      const transaction = {
        get: ref => { assert.equal(writes, 0, 'all transaction reads precede writes'); return ref.query ? this.query(ref.query, state) : this.snapshot(ref.path, state); },
        update: (ref, value) => { assert.ok(state.has(ref.path)); state.set(ref.path, { ...state.get(ref.path), ...structuredClone(value) }); writes++; },
        create: (ref, value) => { assert.ok(!state.has(ref.path)); state.set(ref.path, structuredClone(value)); writes++; },
      };
      let result = await fn(transaction);
      if (this.retryNext) { this.retryNext = false; state = structuredClone(this.data); writes = 0; result = await fn(transaction); }
      this.data = state;
      this.writes += writes;
      if (this.loseResponse && [...state].some(([path, d]) => path.startsWith('fattalCloudRuns/') && d.status === 'activated')) {
        this.loseResponse = false; throw Error('Simulated lost transaction response');
      }
      return result;
    } finally { release(); }
  }
}
function fixture(overrides = {}) {
  const db = new MemoryDb();
  db.data.set(grantPath, grant());
  db.data.set(`users/${config.ownerId}`, { email: config.ownerEmail, storageUsed: 20, storageLimit: 100000 });
  db.data.set('codes/target', { shortId: first.shortId, ownerId: config.ownerId, media: [structuredClone(old)] });
  const objects = new Map();
  let uploads = 0, verifies = 0;
  const storage = {
    async upload(key, body) { uploads++; const object = { url: `https://fixture.invalid/${key}`, size: body.length, storageProvider: 'cloudflare-r2', storageKey: key, storageBucket: 'fixture' }; objects.set(object.url, Buffer.from(body)); return object; },
    async verify(object, hash, size) { verifies++; const body = objects.get(object.url); return !!body && body.length === size && sha256(body) === hash; },
  };
  const initialManifest = manifest();
  db.data.set(`fattalCloudApprovals/${manifestId(initialManifest)}`, { manifest: initialManifest, connectionId: 'a'.repeat(32), approvedBy: initialManifest.review.reviewer, approvedAt: instant, expiresAt: instant + 3600000 });
  const api = createCloudService(db, { ...config, ...overrides }, token, storage, () => instant);
  return { db, storage, objects, api, counts: () => ({ uploads, verifies }), m: manifest() };
}
function approve(f, m) { f.db.data.set(`fattalCloudApprovals/${manifestId(m)}`, { manifest: structuredClone(m), connectionId: 'a'.repeat(32), approvedBy: m.review.reviewer, approvedAt: instant, expiresAt: instant + 3600000 }); }
const commit = (f, m = f.m, payload = bytes) => f.api.commit(m, manifestId(m), payload);
const rejects = (fn, pattern) => assert.rejects(fn, pattern);

test('exact 12 targets; health attests owner/project/bounds without key hash', async () => {
  assert.equal(fattal.FATTAL_BOOKLET_TARGETS.length, 12);
  const f = fixture();
  const h = await f.api.health();
  assert.equal(h.ownerId, config.ownerId); assert.equal(h.projectId, config.projectId);
  assert.deepEqual(h.targets.map(t => t.shortId), [first.shortId]);
  assert.equal(h.targets[0].expectedVersion, f.m.expectedVersion);
  assert.doesNotMatch(JSON.stringify(h), /keyHash|tq_fc_/);
});
test('legacy, malformed and absent keys never fall back', () => {
  for (const key of ['', 'legacy-key', `tq_ci_${'a'.repeat(32)}.${'b'.repeat(64)}`, token + 'x']) {
    assert.throws(() => createCloudService(new MemoryDb(), config, key, {}, () => instant), /dedicated cloud credential/);
  }
});
test('grant rejects wrong hash, expiry, revocation, disabled, scope, owner, project and invalid target bounds', () => {
  for (const change of [
    { keyHash: 'c'.repeat(64) }, { keyHash: 'wrong' }, { expiresAt: instant }, { expiresAt: 'tomorrow' },
    { revokedAt: instant }, { disabledAt: instant }, { revokedAt: 0 }, { scopes: ['write'] }, { scopes: ['read', 'admin'] },
    { ownerId: 'other' }, { ownerEmail: 'playzonest1@gmail.com' }, { projectId: 'other' }, { ownerVerifiedBy: '' },
    { ownerVerifiedAt: instant + 1 }, { allowedTargets: [] }, { allowedTargets: ['child'] }, { allowedTargets: [first.shortId, first.shortId] },
  ]) assert.throws(() => validateGrant({ ...grant(), ...change }, token, config, 'read', instant), undefined, JSON.stringify(change));
  assert.throws(() => validateGrant(grant(), token, { ...config, ownerId: '' }, 'read', instant));
});
test('owner account mismatch, foreign, duplicate and child targets fail closed', async () => {
  for (const mutate of [
    f => f.db.data.get(`users/${config.ownerId}`).email = 'other@example.invalid',
    f => f.db.data.get('codes/target').ownerId = 'other',
    f => f.db.data.get('codes/target').parentCodeShortId = 'parent',
    f => f.db.data.set('codes/duplicate', structuredClone(f.db.data.get('codes/target'))),
    f => f.db.data.delete('codes/target'),
  ]) { const f = fixture(); mutate(f); await rejects(() => f.api.health(), /mismatch|check failed/); assert.equal(f.db.writes, 0); }
});
test('read-only health, preview and recovery never persist runs, upload, notify or clean', async () => {
  const f = fixture(); f.db.data.get(grantPath).scopes = ['read'];
  await f.api.health(); const p = await f.api.preview(f.m);
  assert.equal(p.saved, false); assert.equal(p.manifestId, manifestId(f.m));
  await rejects(() => f.api.recovery(manifestId(f.m)), /not found/);
  await rejects(() => commit(f), /not permitted/);
  assert.equal(f.db.writes, 0); assert.equal(f.counts().uploads, 0);
});
test('writes require separate enabled switch', async () => {
  const f = fixture({ writesEnabled: false });
  await f.api.preview(f.m); await rejects(() => commit(f), /disabled/);
  assert.equal(f.db.writes, 0);
});
test('manifest rejects inferred/conflicting hotel, missing source, wrong hash, stale review, period and target', () => {
  for (const change of [
    { hotel: 'adjacent-hotel' }, { shortId: fattal.FATTAL_BOOKLET_TARGETS[1].shortId }, { ownerId: 'other' }, { projectId: 'other' },
    { expectedVersion: '' }, { sources: [] }, { sources: [{ messageId: 'm', fileId: 'f', sha256: 'c'.repeat(64) }] },
    { period: { kind: 'maybe', startDate: '2026-10-08', endDate: '2026-10-10' } },
    { period: { kind: 'weekday', startDate: '2026-02-30', endDate: '2026-03-02' } },
    { review: { ...manifest().review, contextResolved: false } },
    { review: { ...manifest().review, replacementApproved: false } },
    { review: { ...manifest().review, reviewedAt: instant - 3600001 } },
    { filename: '../file.pdf' },
  ]) assert.throws(() => parseManifest({ ...manifest(), ...change }, grant(), instant));
});
test('same filename is not identity; retransmissions share hash and corrections require explicit exclusion', () => {
  const m = manifest();
  m.sources.push({ messageId: 'retransmission', fileId: 'file-2', sha256: m.sha256 });
  m.supersedes.push({ messageId: 'old-message', fileId: 'old-file', sha256: sha256('old bytes') });
  assert.equal(parseManifest(m, grant(), instant).sources.length, 2);
  assert.equal(parseManifest(m, grant(), instant).supersedes.length, 1);
  m.sources[1].sha256 = sha256('changed bytes, same name');
  assert.throws(() => parseManifest(m, grant(), instant), /inconsistent/);
  m.sources[1].sha256 = m.sha256; m.supersedes[0].messageId = m.sources[0].messageId; m.supersedes[0].fileId = m.sources[0].fileId;
  assert.throws(() => parseManifest(m, grant(), instant), /source identity/);
});
test('digest binds period, source, replacement review, filename and expected active version', async () => {
  for (const modify of [m => m.filename = 'other.pdf', m => m.period.kind = 'weekday', m => m.sources[0].messageId = 'other', m => m.review.evidence = 'different evidence', m => m.expectedVersion = 'e'.repeat(64)]) {
    const f = fixture(); const id = manifestId(f.m); modify(f.m);
    await rejects(() => f.api.commit(f.m, id, bytes), /digest mismatch/); assert.equal(f.db.writes, 0);
  }
});
test('changed PDF bytes or stale active version never reach storage', async () => {
  const f = fixture(); await rejects(() => commit(f, f.m, Buffer.from('wrong')), /PDF bytes/);
  f.db.data.get('codes/target').media[0].url = 'https://fixture.invalid/new-current';
  await rejects(() => f.api.preview(f.m), /version changed/); await rejects(() => commit(f), /version changed/);
  assert.equal(f.counts().uploads, 0); assert.equal(f.db.writes, 0);
});
test('successful commit retains predecessor, reserves retained bytes, verifies active pointer and emits no effects', async () => {
  const f = fixture(); const result = await commit(f);
  assert.equal(result.status, 'verified'); assert.equal(result.notification, 'disabled'); assert.equal(result.cleanup, 'disabled');
  assert.equal(f.db.data.get(`users/${config.ownerId}`).storageUsed, 20 + bytes.length);
  const receipt = f.db.data.get(`fattalCloudRuns/${manifestId(f.m)}`);
  assert.equal(receipt.predecessor.url, old.url);
  assert.equal(f.db.data.get('codes/target').media[0].pageCount, undefined);
  assert.equal(f.counts().uploads, 1); assert.equal(f.counts().verifies, 2);
  const before = f.db.writes; assert.equal((await f.api.recovery(result.manifestId)).verified, true); assert.equal(f.db.writes, before);
});
test('same manifest and byte-identical new message are idempotent', async () => {
  const f = fixture(); await commit(f); const writes = f.db.writes;
  assert.equal((await commit(f)).verified, true);
  const retransmission = { ...f.m, sources: [{ ...f.m.sources[0], messageId: 'new-message' }] };
  assert.equal((await commit(f, retransmission)).verified, true);
  assert.equal(f.counts().uploads, 1); assert.equal(f.db.writes, writes);
});
test('concurrent same manifest uploads once; competing revisions cannot bypass target claim', async () => {
  const f = fixture();
  const results = await Promise.all([commit(f), commit(f)]);
  assert.ok(results.some(r => r.verified)); assert.equal(f.counts().uploads, 1);
  const g = fixture(); const otherBytes = Buffer.from('%PDF-1.7\ncorrected bytes');
  const m = { ...g.m, sha256: sha256(otherBytes), size: otherBytes.length, sources: [{ messageId: 'corrected', fileId: 'f2', sha256: sha256(otherBytes) }] };
  approve(g, m);
  const outcomes = await Promise.allSettled([commit(g), commit(g, m, otherBytes)]);
  assert.equal(outcomes.filter(r => r.status === 'rejected').length, 1); assert.equal(g.counts().uploads, 1);
});
test('uncertain upload retains old current, keeps claim, and prevents all retries', async () => {
  const f = fixture(); f.storage.upload = async () => { throw Error('ambiguous write'); };
  assert.equal((await commit(f)).status, 'uncertain');
  const writes = f.db.writes;
  assert.equal((await f.api.recovery(manifestId(f.m))).retryAllowed, false);
  assert.equal((await commit(f)).status, 'uncertain');
  assert.equal(f.db.data.get('codes/target').media[0].url, old.url); assert.equal(f.db.writes, writes);
});
test('lost activation response is recovered read-only and never deletes newly current file', async () => {
  const f = fixture(); f.db.loseResponse = true;
  assert.equal((await commit(f)).status, 'uncertain');
  const writes = f.db.writes;
  assert.equal((await f.api.recovery(manifestId(f.m))).verified, true);
  assert.equal(f.db.writes, writes); assert.equal(f.counts().uploads, 1);
});
test('revocation, expiry, target change or corrupt staging during upload prevents activation', async () => {
  for (const mutate of [
    f => f.db.data.get(grantPath).revokedAt = instant,
    f => f.db.data.get(grantPath).expiresAt = instant,
    f => f.db.data.get('codes/target').media[0].url = 'https://fixture.invalid/manual-replacement',
    f => f.db.data.get('codes/target').parentCodeShortId = 'parent',
    f => f.db.data.get(grantPath).allowedTargets = [fattal.FATTAL_BOOKLET_TARGETS[1].shortId],
  ]) { const f = fixture(); const upload = f.storage.upload; f.storage.upload = async (...args) => { const object = await upload(...args); mutate(f); return object; };
    assert.equal((await commit(f)).status, 'uncertain');
    assert.notEqual(f.db.data.get('codes/target').media[0].contentIntake?.sha256, f.m.sha256);
  }
  const f = fixture(); f.storage.verify = async () => false;
  assert.equal((await commit(f)).status, 'uncertain'); assert.equal(f.db.data.get('codes/target').media[0].url, old.url);
});
test('recovery cannot cross target bounds and superseded receipts cannot claim current verification', async () => {
  const f = fixture(); await commit(f);
  f.db.data.get('codes/target').media[0].url = 'https://fixture.invalid/manual-newer';
  assert.equal((await f.api.recovery(manifestId(f.m))).status, 'superseded');
  f.db.data.get(grantPath).allowedTargets = [fattal.FATTAL_BOOKLET_TARGETS[1].shortId];
  f.db.data.set('codes/second', { shortId: fattal.FATTAL_BOOKLET_TARGETS[1].shortId, ownerId: config.ownerId, media: [] });
  await rejects(() => f.api.recovery(manifestId(f.m)), /not found/);
});

// Exercise the actual Next route with mocked imports and transport; no SDK or
// credentials are loaded. The global fetch is a local object-store fixture.
globalThis.cloudFixture.createCloudService = createCloudService;
const route = await loadTs('../../src/app/api/content-intake/fattal/cloud/[operation]/route.ts', {
  'next/server': stub('export const NextResponse={json:(body, init)=>new Response(JSON.stringify(body), {...init, headers:{...init?.headers,"Content-Type":"application/json"}})};'),
  '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.cloudFixture.routeFixture.db; export const getAdminApp=()=>({options:{projectId:"fixture-project"}});'),
  '@/lib/media-storage': stub('export const uploadStoredObject=({key,body})=>globalThis.cloudFixture.routeFixture.storage.upload(key,body);'),
  '@/lib/r2-storage': stub('export const isR2Url=url=>url.startsWith("https://fixture.invalid/");'),
  '@/lib/content-intake/cloud-policy': policyModule,
  '@/lib/content-intake/cloud-service': stub('export const createCloudService=(db,config,token,storage)=>globalThis.cloudFixture.createCloudService(db,config,token,storage,()=>globalThis.cloudFixture.instant);'),
});
globalThis.cloudFixture.instant = instant;
function routeSetup() {
  const f = fixture(); globalThis.cloudFixture.routeFixture = f;
  Object.assign(process.env, { FATTAL_CLOUD_ENABLED: 'true', FATTAL_CLOUD_WRITES_ENABLED: 'true',
    FATTAL_CLOUD_OWNER_ID: config.ownerId, FATTAL_CLOUD_OWNER_EMAIL: config.ownerEmail, FATTAL_CLOUD_PROJECT_ID: config.projectId,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: config.projectId, FATTAL_BOOKLETS_OWNER_ID: config.ownerId, FATTAL_BOOKLETS_OWNER_EMAIL: config.ownerEmail });
  return f;
}
async function call(operation, body, key = token, method = body ? 'POST' : 'GET') {
  const url = new URL(`https://fixture.invalid/api/content-intake/fattal/cloud/${operation}`);
  const request = new Request(url, { method, headers: { 'x-fattal-cloud-key': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  request.nextUrl = url;
  return route[method](request, { params: Promise.resolve({ operation: operation.split('?')[0] }) });
}
test('route disabled by default and fails mismatched explicit config without fallback', async () => {
  const f = routeSetup(); delete process.env.FATTAL_CLOUD_ENABLED;
  assert.equal((await call('health')).status, 503);
  process.env.FATTAL_CLOUD_ENABLED = 'true'; process.env.FATTAL_CLOUD_OWNER_ID = '';
  assert.equal((await call('health')).status, 503);
  process.env.FATTAL_CLOUD_OWNER_ID = config.ownerId; process.env.FATTAL_BOOKLETS_OWNER_EMAIL = 'playzonest1@gmail.com';
  assert.equal((await call('health')).status, 403);
  process.env.FATTAL_BOOKLETS_OWNER_EMAIL = config.ownerEmail; process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'wrong-project';
  assert.equal((await call('health')).status, 403);
  assert.equal(f.db.writes, 0);
});
test('route enforces saveRun:false; no implicit legacy saving, messaging, cleanup or owner override', async () => {
  const f = routeSetup();
  assert.equal((await call('preview', { manifest: f.m })).status, 400);
  const response = await call('preview', { manifest: f.m, saveRun: false });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).saved, false);
  for (const field of ['sendEmail', 'notify', 'deleteOld', 'cleanup']) {
    assert.equal((await call('preview', { manifest: f.m, saveRun: false, [field]: true })).status, 403);
    assert.equal((await call('commit', { manifest: f.m, [field]: true })).status, 403);
  }
  assert.equal((await call('preview', { manifest: { ...f.m, ownerId: 'different-owner' }, saveRun: false })).status, 403);
  assert.equal((await call('health', undefined, 'legacy')).status, 401);
  assert.equal((await call('report', { sendEmail: true })).status, 404);
  assert.equal(f.db.writes, 0); assert.equal(f.counts().uploads, 0);
});
test('route rejects read keys, missing activation, noncanonical encoding and oversized bodies', async () => {
  const f = routeSetup();
  const body = { manifest: f.m, manifestId: manifestId(f.m), pdfBase64: bytes.toString('base64'), activate: true };
  f.db.data.get(grantPath).scopes = ['read']; assert.equal((await call('commit', body)).status, 403);
  f.db.data.get(grantPath).scopes = ['read', 'write'];
  assert.equal((await call('commit', { ...body, activate: false })).status, 400);
  assert.equal((await call('commit', { ...body, pdfBase64: body.pdfBase64 + '\n' })).status, 400);
  assert.equal((await call('commit', { ...body, pdfBase64: 'A'.repeat(4 * 1024 * 1024) })).status, 413);
  assert.equal(f.db.writes, 0);
});
test('real route commits through mocked storage and recovers with notifications/cleanup suppressed', async () => {
  const f = routeSetup(); const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { const body = f.objects.get(String(url)); assert.ok(body, 'only the uploaded fixture may be fetched'); return new Response(body); };
  try {
    const response = await call('commit', { manifest: f.m, manifestId: manifestId(f.m), pdfBase64: bytes.toString('base64'), activate: true });
    assert.equal(response.status, 200); assert.equal((await response.json()).verified, true);
    const before = f.db.writes;
    const recovered = await call(`recovery?manifestId=${manifestId(f.m)}`);
    assert.equal(recovered.status, 200); assert.equal((await recovered.json()).verified, true);
    assert.equal(f.db.writes, before); assert.equal(f.counts().uploads, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('legacy hashed-key authentication remains compatible and cannot consume cloud records', async () => {
  const legacyToken = `tq_ci_${'d'.repeat(32)}.${'e'.repeat(64)}`;
  globalThis.cloudFixture.legacyRecord = { workflow: 'fattal-booklets', ownerId: config.ownerId, ownerEmail: config.ownerEmail, keyHash: sha256(legacyToken) };
  const legacy = await loadTs('../../src/lib/content-intake/fattal-server.ts', {
    '@/lib/server-api-key': stub('export const hasValidServerApiKey=()=>false;'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>({collection:name=>{if(name!=="contentIntakeConnections") throw Error("wrong collection"); return {doc:()=>({get:async()=>({data:()=>globalThis.cloudFixture.legacyRecord})})};}});'),
    './fattal': fattalModule,
  });
  const request = key => ({ headers: new Headers({ 'x-content-intake-key': key }) });
  assert.deepEqual(await legacy.authenticateIntakeKey(request(legacyToken)), { ownerId: config.ownerId, ownerEmail: config.ownerEmail, connectionId: 'd'.repeat(32) });
  assert.equal(await legacy.authenticateIntakeKey(request(token)), false);
  assert.equal(await legacy.resolveFattalOwnerId({ ownerId: 'other', integrationAuth: { ownerId: config.ownerId, ownerEmail: config.ownerEmail, connectionId: 'id' } }), null);
});

test('unsupported media and insufficient quota are rejected before staging', async () => {
  for (const media of [[{ ...old, type: 'image' }], [old, old]]) {
    const f = fixture(); f.db.data.get('codes/target').media = media;
    await rejects(() => commit(f), /one PDF/); assert.equal(f.counts().uploads, 0);
  }
  const f = fixture(); f.db.data.get(`users/${config.ownerId}`).storageLimit = 21;
  await rejects(() => commit(f), /quota/); assert.equal(f.db.writes, 0);
});
test('old pointer survives staging and hash checks; recovery rechecks after public-byte fetch', async () => {
  const f = fixture(); const upload = f.storage.upload;
  f.storage.upload = async (...args) => { assert.equal(f.db.data.get('codes/target').media[0].url, old.url); return upload(...args); };
  const verify = f.storage.verify;
  let calls = 0;
  f.storage.verify = async (...args) => {
    if (++calls === 1) assert.equal(f.db.data.get('codes/target').media[0].url, old.url);
    return verify(...args);
  };
  assert.equal((await commit(f)).verified, true);
  f.storage.verify = async (...args) => {
    const result = await verify(...args);
    f.db.data.get('codes/target').media[0].url = 'https://fixture.invalid/concurrent-newer';
    return result;
  };
  assert.equal((await f.api.recovery(manifestId(f.m))).verified, false);
});

test('caller-computable digest cannot replace missing, revoked, expired, foreign or altered administrator approval', async () => {
  for (const mutate of [
    (f, path) => f.db.data.delete(path),
    (f, path) => f.db.data.get(path).revokedAt = instant,
    (f, path) => f.db.data.get(path).expiresAt = instant,
    (f, path) => f.db.data.get(path).connectionId = 'other-connection',
    (f, path) => f.db.data.get(path).approvedBy = 'other-reviewer',
    (f, path) => f.db.data.get(path).manifest.review.evidence = 'altered approval',
  ]) {
    const f = fixture(); mutate(f, `fattalCloudApprovals/${manifestId(f.m)}`);
    await rejects(() => commit(f), /administrator approval/); assert.equal(f.counts().uploads, 0); assert.equal(f.db.writes, 0);
  }
  const f = fixture(); f.m.review.reviewer = 'invented reviewer';
  await rejects(() => commit(f), /administrator approval/);
});
test('approval revocation during upload prevents activation while preserving predecessor', async () => {
  const f = fixture(); const upload = f.storage.upload;
  f.storage.upload = async (...args) => { const object = await upload(...args); f.db.data.get(`fattalCloudApprovals/${manifestId(f.m)}`).revokedAt = instant; return object; };
  assert.equal((await commit(f)).status, 'uncertain'); assert.equal(f.db.data.get('codes/target').media[0].url, old.url);
});
test('same-period corrections require known active source identities; new periods remain distinct', async () => {
  const f = fixture(); await commit(f);
  const revisedBytes = Buffer.from('%PDF-1.7\nreviewed correction');
  const revised = { ...f.m, expectedVersion: activeVersion(f.db.data.get('codes/target').media), sha256: sha256(revisedBytes), size: revisedBytes.length,
    sources: [{ messageId: 'correction-message', fileId: 'correction-file', sha256: sha256(revisedBytes) }] };
  approve(f, revised);
  await rejects(() => f.api.preview(revised), /explicitly supersede/);
  await rejects(() => commit(f, revised, revisedBytes), /explicitly supersede/);
  assert.equal(f.counts().uploads, 1);
  const nextPeriod = { ...revised, period: { kind: 'weekday', startDate: '2026-10-11', endDate: '2026-10-14' } };
  assert.equal((await f.api.preview(nextPeriod)).saved, false);
  revised.supersedes = f.m.sources; approve(f, revised);
  assert.equal((await commit(f, revised, revisedBytes)).verified, true);
});
test('receipt tampering cannot manufacture verified recovery evidence', async () => {
  const f = fixture(); await commit(f);
  f.db.data.get(`fattalCloudRuns/${manifestId(f.m)}`).manifest.review.evidence = 'changed receipt';
  await rejects(() => f.api.recovery(manifestId(f.m)), /digest/);
  const revisedHash = sha256('changed file');
  const revised = { ...f.m, sha256: revisedHash, expectedVersion: activeVersion(f.db.data.get('codes/target').media), sources: [{ messageId: 'changed', fileId: 'file-2', sha256: revisedHash }] };
  await rejects(() => f.api.preview(revised), /receipt is unavailable/);
});

test('transaction callback retry does not double-reserve quota or perform external writes inside the transaction', async () => {
  const f = fixture(); f.db.retryNext = true;
  assert.equal((await commit(f)).verified, true);
  assert.equal(f.db.data.get(`users/${config.ownerId}`).storageUsed, 20 + bytes.length);
  assert.equal(f.counts().uploads, 1);
  assert.equal([...f.db.data.keys()].filter(key => key.startsWith('fattalCloudRuns/')).length, 1);
});
test('legacy replacement fences cloud claims before upload and again before activation', async () => {
  const state = { pending: 'cloud-claim', uploads: 0, deleted: [], writes: 0 };
  globalThis.cloudFixture.legacyFence = state;
  const legacyPdf = await loadTs('../../src/lib/content-intake/pdf-replacement.ts', {
    'firebase-admin/firestore': stub('export const FieldValue={}; export class Timestamp {}'),
    '@/lib/firebase-admin': stub(`export const getAdminDb=()=>({
      collection:name=>({doc:id=>({name,id,get:async()=>({exists:true,data:()=>({ownerId:'owner',fattalCloudPending:globalThis.cloudFixture.legacyFence.pending}),updateTime:{isEqual:()=>true}})})}),
      runTransaction:async fn=>fn({get:async ref=>({exists:true,data:()=>ref.name==='codes'?{ownerId:'owner',fattalCloudPending:globalThis.cloudFixture.legacyFence.pending}:{}}),update:()=>{globalThis.cloudFixture.legacyFence.writes++}})
    });`),
    '@/lib/server-storage': stub('export const deleteStoredObjectByUrl=async url=>{globalThis.cloudFixture.legacyFence.deleted.push(url)};'),
    '@/lib/r2-storage': stub(`export const buildStorageKey=()=>"key"; export const buildUniqueFilename=()=>"file.pdf"; export const R2_STORAGE_PROVIDER="cloudflare-r2";
      export const uploadBufferToR2=async()=>{globalThis.cloudFixture.legacyFence.uploads++;globalThis.cloudFixture.legacyFence.pending='claim-arrived-during-upload';return {url:'https://fixture.invalid/legacy-staging',size:10}};`),
    'pdfjs-dist/legacy/build/pdf.mjs': stub('export const getDocument=()=>({promise:Promise.resolve({numPages:1,destroy:async()=>{}})});'),
  });
  const input = { buffer: bytes, filename: 'file.pdf', contentType: 'application/pdf' };
  await rejects(() => legacyPdf.replaceCodePdfWithBuffer('target', input), /pending cloud replacement/);
  assert.equal(state.uploads, 0); assert.equal(state.deleted.length, 0);
  state.pending = null;
  await rejects(() => legacyPdf.replaceCodePdfWithBuffer('target', input), /pending cloud replacement/);
  assert.equal(state.uploads, 1); assert.equal(state.writes, 0);
  assert.deepEqual(state.deleted, ['https://fixture.invalid/legacy-staging']);
});

test('server-only caller and real API route interoperate end-to-end through isolated fixture transport', async () => {
  const f = routeSetup();
  // Prepare one synthetic receipt with the existing mock storage, then use only read scope.
  assert.equal((await commit(f)).verified, true);
  f.db.data.get(grantPath).scopes = ['read'];
  const writes = f.db.writes;
  const uploads = f.counts().uploads;
  const { createFattalCloudClient, createFattalCloudReadTools } = await loadTs('../../src/lib/content-intake/cloud-client.ts', {
    'server-only': stub('export {};'), './fattal': fattalModule, './cloud-policy': policyModule,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { const object = f.objects.get(String(url)); assert.ok(object); return new Response(object); };
  try {
    const client = createFattalCloudClient({ enabled: true, baseUrl: 'https://fixture.invalid', ownerId: config.ownerId,
      ownerEmail: config.ownerEmail, projectId: config.projectId, allowedTargets: [first.shortId], credentialRef: 'env:FATTAL_CLOUD_CLIENT_KEY' }, {
      now: () => instant, resolveSecret: async () => token,
      fetch: async (url, init) => {
        const request = new Request(url, init); request.nextUrl = new URL(url);
        return route[init.method](request, { params: Promise.resolve({ operation: request.nextUrl.pathname.split('/').pop() }) });
      },
    });
    const dispatch = createFattalCloudReadTools(client);
    const health = await dispatch('fattal_cloud_health', {});
    assert.equal(health.ownerId, config.ownerId);
    const reviewed = { ...f.m, expectedVersion: health.targets[0].expectedVersion };
    assert.equal((await dispatch('fattal_cloud_preview', { manifest: reviewed })).saved, false);
    const receipt = await dispatch('fattal_cloud_recovery', { manifestId: manifestId(f.m), shortId: first.shortId, sha256: f.m.sha256 });
    assert.equal(receipt.verified, true);
    assert.equal(f.db.writes, writes); assert.equal(f.counts().uploads, uploads);
  } finally { globalThis.fetch = originalFetch; }
});

// Writer integration: actual caller, route, policy and journal with real private
// temporary files. Only Firestore/R2 and transport are simulated.
import { mkdtemp, readFile, rm, writeFile, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const journalModule = await loadTs('../../src/lib/content-intake/cloud-upload-journal.ts', { './cloud-policy': policyModule });
globalThis.cloudFixture.journal = journalModule;
const { createFattalCloudUploader } = await loadTs('../../src/lib/content-intake/cloud-uploader.ts', {
  './fattal': fattalModule, './cloud-policy': policyModule, './cloud-upload-journal': exportsOf('journal', journalModule),
});
async function writerFixture(t, overrides = {}) {
  const f = routeSetup();
  const directory = await mkdtemp(join(tmpdir(), 'fattal-writer-test-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => { const object = f.objects.get(String(url)); assert.ok(object); return new Response(object); };
  t.after(async () => { globalThis.fetch = originalFetch; await rm(directory, { recursive: true, force: true }); });
  const state = { calls: [], resolutions: 0, loseCommit: false, loseRecovery: false,
    beforeCommit: async () => {}, mutate: (r) => r };
  const settings = { enabled: true, writesEnabled: true, baseUrl: 'https://fixture.invalid', ...config,
    allowedTargets: [first.shortId], stateDirectory: directory, durableStateConfirmed: true, ...overrides };
  const runtime = { now: () => instant, resolveSecret: async () => { state.resolutions++; return token; },
    fetch: async (url, init) => {
      const operation = new URL(url).pathname.split('/').pop(); state.calls.push(operation);
      assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit');
      if (operation === 'commit') {
        const saved = JSON.parse(await readFile(join(directory, 'uploader.json'), 'utf8'));
        assert.equal(saved.attempts[manifestId(f.m)].status, 'pending', 'journal exists before network POST');
        await state.beforeCommit();
      }
      if (operation === 'recovery' && state.loseRecovery) throw Error(`Synthetic lost reply ${token}`);
      const request = new Request(url, init); request.nextUrl = new URL(url);
      const response = await route[init.method](request, { params: Promise.resolve({ operation }) });
      if (operation === 'commit' && state.loseCommit) throw Error(`Synthetic lost reply ${token}`);
      return state.mutate(response, operation);
    } };
  return { ...f, directory, state, settings, runtime, writer: createFattalCloudUploader(settings, runtime),
    journal: async () => JSON.parse(await readFile(join(directory, 'uploader.json'), 'utf8')) };
}
test('writer defaults deny all transport/secret resolution; separate write and durable-volume gates', async t => {
  for (const change of [{ enabled: false }, { writesEnabled: false }, { durableStateConfirmed: false }, { allowedTargets: ['foreign'] }, { baseUrl: 'http://fixture.invalid' }]) {
    const f = await writerFixture(t, change);
    await assert.rejects(() => f.writer.upload(f.m, bytes));
    assert.equal(f.state.calls.length, 0); assert.equal(f.state.resolutions, 0);
  }
  await assert.rejects(createFattalCloudUploader().health, /disabled/);
});
test('writer verifies exact PDF before network; malformed bytes/hash/size and changed active version never commit', async t => {
  const f = await writerFixture(t);
  for (const bad of [Buffer.from('wrong'), Buffer.from('%PDF-different')]) await assert.rejects(() => f.writer.upload(f.m, bad), /input/);
  assert.equal(f.state.calls.length, 0);
  f.db.data.get('codes/target').media[0].title = 'Concurrent edit';
  await assert.rejects(() => f.writer.upload(f.m, bytes), /input/);
  assert.equal(f.state.calls.includes('commit'), false); assert.equal(f.counts().uploads, 0);
});
test('writer uploads through actual route, persists receipt and re-verifies active bytes after POST', async t => {
  const f = await writerFixture(t);
  const result = await f.writer.upload(f.m, bytes);
  assert.equal(result.verified, true); assert.equal(result.retryAllowed, false);
  assert.equal(f.counts().uploads, 1); assert.equal((await f.journal()).attempts[manifestId(f.m)].status, 'verified');
  assert.equal(f.state.calls.at(-1), 'recovery');
  assert.doesNotMatch(JSON.stringify(await f.journal()), /tq_fc_|keyHash|pdfBase64/);
});
test('writer lost commit and recovery responses survive restart and rerun only recovers, even with expired review', async t => {
  const f = await writerFixture(t); f.state.loseCommit = true; f.state.loseRecovery = true;
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  assert.equal((await f.journal()).attempts[manifestId(f.m)].status, 'pending');
  f.state.loseRecovery = false;
  const restarted = createFattalCloudUploader(f.settings, { ...f.runtime, now: () => instant + 2 * 3600000 });
  assert.equal((await restarted.upload(f.m, bytes)).verified, true);
  assert.equal(f.state.calls.filter(c => c === 'commit').length, 1); assert.equal(f.counts().uploads, 1);
});
test('writer rerun success still recovers and detects superseded pointers without writing again', async t => {
  const f = await writerFixture(t); await f.writer.upload(f.m, bytes);
  f.db.data.get('codes/target').media[0].url = 'https://fixture.invalid/newer.pdf';
  const result = await f.writer.upload(f.m, bytes);
  assert.equal(result.status, 'superseded'); assert.equal(result.verified, false);
  assert.equal(f.state.calls.filter(c => c === 'commit').length, 1);
});
test('writer expired grant fails before commit; expiry during POST leaves durable pending and no blind retry', async t => {
  const f = await writerFixture(t); f.db.data.get(grantPath).expiresAt = instant;
  await assert.rejects(() => f.writer.upload(f.m, bytes), /transport/);
  assert.equal(f.state.calls.includes('commit'), false);
  f.db.data.get(grantPath).expiresAt = instant + 86400000;
  f.state.beforeCommit = async () => { f.db.data.get(grantPath).expiresAt = instant; };
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  f.db.data.get(grantPath).expiresAt = instant + 86400000;
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  assert.equal(f.state.calls.filter(c => c === 'commit').length, 1); assert.equal(f.counts().uploads, 0);
});
test('writer cannot create or bypass administrator approval; missing approval remains unresolved', async t => {
  const f = await writerFixture(t); f.db.data.delete(`fattalCloudApprovals/${manifestId(f.m)}`);
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  assert.equal(f.counts().uploads, 0); assert.equal(f.db.writes, 0);
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  assert.equal(f.state.calls.filter(c => c === 'commit').length, 1);
});
test('writer concurrent version change between preview and commit preserves pending and original PDF', async t => {
  const f = await writerFixture(t);
  f.state.beforeCommit = async () => { f.db.data.get('codes/target').media[0].title = 'Concurrent edit'; };
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  assert.equal(f.counts().uploads, 0); assert.equal(f.db.data.get('codes/target').media[0].url, old.url);
  assert.equal((await f.writer.upload(f.m, bytes)).status, 'uncertain');
  assert.equal(f.state.calls.filter(c => c === 'commit').length, 1);
});
test('writer rejects altered recovery identities and corrupt active bytes even after successful commit', async t => {
  const f = await writerFixture(t);
  f.state.mutate = async (response, operation) => {
    if (operation === 'recovery') { const data = await response.json(); return Response.json({ ...data, sha256: 'f'.repeat(64) }); }
    return response;
  };
  assert.equal((await f.writer.upload(f.m, bytes)).verified, false);
  f.state.mutate = r => r;
  for (const key of f.objects.keys()) f.objects.set(key, Buffer.from('corrupted'));
  assert.equal((await f.writer.recover(f.m)).verified, false);
  assert.equal(f.counts().uploads, 1);
});
test('writer blocks a different manifest on unresolved target and serializes concurrent invocations', async t => {
  const f = await writerFixture(t); f.state.loseRecovery = true;
  const outcomes = await Promise.allSettled([f.writer.upload(f.m, bytes), f.writer.upload(f.m, bytes)]);
  assert.equal(outcomes.filter(r => r.status === 'rejected').length, 1);
  assert.equal(f.counts().uploads, 1);
  const other = { ...f.m, filename: 'corrected.pdf' };
  await assert.rejects(() => f.writer.upload(other, bytes), /pending/);
  assert.equal(f.state.calls.filter(c => c === 'commit').length, 1);
});
test('writer rejects unavailable, permissive, symlinked, corrupt or differently-bound state before POST', async t => {
  const f = await writerFixture(t);
  await chmod(f.directory, 0o755);
  await assert.rejects(() => f.writer.upload(f.m, bytes), /state/);
  await chmod(f.directory, 0o700);
  await writeFile(join(f.directory, 'uploader.lock'), 'crashed process');
  await assert.rejects(() => f.writer.upload(f.m, bytes), /state/);
  await rm(join(f.directory, 'uploader.lock'));
  await writeFile(join(f.directory, 'uploader.json'), '{corrupt', { mode: 0o600 });
  await assert.rejects(() => f.writer.upload(f.m, bytes), /state/);
  await rm(join(f.directory, 'uploader.json'));
  await symlink('/does-not-exist', join(f.directory, 'uploader.json'));
  await assert.rejects(() => f.writer.upload(f.m, bytes), /state/);
  await rm(join(f.directory, 'uploader.json'));
  assert.equal(f.state.calls.length, 0);
  await f.writer.upload(f.m, bytes);
  const other = createFattalCloudUploader({ ...f.settings, baseUrl: 'https://other.invalid' }, f.runtime);
  await assert.rejects(() => other.recover(f.m), /state/);
});
test('writer accepts recovery while local write switch is off; never initializes missing recovery history', async t => {
  const f = await writerFixture(t);
  await assert.rejects(() => f.writer.recover(f.m), /state/); assert.equal(f.state.calls.length, 0);
  await f.writer.upload(f.m, bytes);
  const reader = createFattalCloudUploader({ ...f.settings, writesEnabled: false }, f.runtime);
  assert.equal((await reader.recover(f.m)).verified, true);
  await assert.rejects(() => reader.upload(f.m, bytes), /disabled/);
});

import { execFileSync } from 'node:child_process';
import { main as uploaderCli } from '../fattal-cloud-upload.mjs';
test('cloud CLI runs actual upload and recovery with injected runtime key; never prints secret', async t => {
  execFileSync(process.execPath, ['scripts/build-fattal-cloud-cli.mjs'], { cwd: new URL('../..', import.meta.url), stdio: 'pipe' });
  const f = await writerFixture(t);
  const path = join(f.directory, 'config.json'); const manifestPath = join(f.directory, 'manifest.json'); const pdfPath = join(f.directory, 'file.pdf');
  await writeFile(path, JSON.stringify(f.settings)); await writeFile(manifestPath, JSON.stringify(f.m)); await writeFile(pdfPath, bytes);
  const previous = process.env.FATTAL_CLOUD_CLIENT_KEY;
  process.env.FATTAL_CLOUD_CLIENT_KEY = token;
  t.after(() => { if (previous === undefined) delete process.env.FATTAL_CLOUD_CLIENT_KEY; else process.env.FATTAL_CLOUD_CLIENT_KEY = previous; });
  t.mock.method(Date, 'now', () => instant);
  const objectFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => new URL(url).pathname.startsWith('/api/') ? f.runtime.fetch(url, init) : objectFetch(url, init);
  const output = []; const env = { FATTAL_CLOUD_UPLOADER_CONFIG: path, FATTAL_CLOUD_CLIENT_KEY: token };
  assert.equal(await uploaderCli(['upload', '--manifest', manifestPath, '--pdf', pdfPath], env, text => output.push(text)), 0);
  assert.equal(await uploaderCli(['recover', '--manifest', manifestPath], env, text => output.push(text)), 0);
  assert.equal(f.counts().uploads, 1); assert.equal(f.state.calls.filter(c => c === 'commit').length, 1);
  const receipts = output.map(text => JSON.parse(text).telemetry);
  assert.equal(receipts[0].operations.commit.attempts, 1); assert.equal(receipts[1].operations.commit.attempts, 0);
  assert.equal(receipts[0].files, 1); assert.equal(receipts[0].bytes, bytes.length); assert.equal(receipts[0].billing.status, 'unknown');
  assert.ok(output.every(text => JSON.parse(text).verified)); assert.doesNotMatch(output.join(''), /tq_fc_|pdfBase64|keyHash/);
});
test('CLI rejects key arguments, missing/default-disabled configuration and credential-containing config without leaking', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'fattal-cli-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'config.json'); const output = [];
  const emit = text => output.push(text);
  assert.equal(await uploaderCli(['health'], {}, emit), 1);
  assert.equal(await uploaderCli(['health', '--key', token], {}, emit), 1);
  assert.equal(await uploaderCli(['upload', '--manifest', token, '--pdf', 'unused'], {}, emit), 1);
  await writeFile(path, JSON.stringify({ enabled: false }));
  assert.equal(await uploaderCli(['health'], { FATTAL_CLOUD_UPLOADER_CONFIG: path }, emit), 1);
  await writeFile(path, JSON.stringify({ enabled: true, key: token }));
  assert.equal(await uploaderCli(['health'], { FATTAL_CLOUD_UPLOADER_CONFIG: path }, emit), 1);
  assert.doesNotMatch(output.join(''), /tq_fc_|unused|config.json/);
});

test('uploader telemetry reports uncertain transport without secrets or automatic retries and cannot affect outcomes', async t => {
 const f = await writerFixture(t); const events=[]; f.runtime.onOperation=e=>events.push(e);f.state.loseCommit=true;f.state.loseRecovery=true;
 const writer=createFattalCloudUploader(f.settings,f.runtime);assert.equal((await writer.upload(f.m,bytes)).status,'uncertain');
 assert.equal(events.filter(e=>e.operation==='commit').length,1);assert.equal(events.find(e=>e.operation==='commit').outcome,'failed');
 assert.ok(events.every(e=>e.retry===false));assert.doesNotMatch(JSON.stringify(events),/tq_fc_|owner|manifest|same.pdf/);
 f.state.loseRecovery=false;f.runtime.onOperation=()=>{throw Error('collector failure');};
 assert.equal((await writer.recover(f.m)).status,'verified');assert.equal(f.counts().uploads,1);
});
