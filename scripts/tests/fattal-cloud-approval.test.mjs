import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';

const fattal = await loadTs('../../src/lib/content-intake/fattal.ts');
globalThis.approvalFixture = { fattal };
const expose = name => stub(Object.keys(globalThis.approvalFixture[name]).map(key => `export const ${key}=globalThis.approvalFixture.${name}.${key};`).join('\n'));
const policy = await loadTs('../../src/lib/content-intake/cloud-policy.ts', { './fattal': expose('fattal') });
globalThis.approvalFixture.policy = policy;
const setup = await loadTs('../../src/lib/content-intake/setup-review.ts', { './fattal': expose('fattal') });
globalThis.approvalFixture.setup = setup;
const approval = await loadTs('../../src/lib/content-intake/cloud-approval.ts', { './fattal': expose('fattal'), './cloud-policy': expose('policy'), './setup-review': expose('setup') });
globalThis.approvalFixture.approval = approval;
const pdf = await loadTs('../../src/lib/content-intake/cloud-review-pdf.ts', { './cloud-policy': expose('policy') });
const { createCloudService } = await loadTs('../../src/lib/content-intake/cloud-service.ts', { './fattal': expose('fattal'), './cloud-policy': expose('policy') });
const { sha256, manifestId, activeVersion } = policy;
const now = Date.parse('2026-10-11T15:00:00Z'), writerId = 'a'.repeat(32), token = `tq_fc_${writerId}.${'b'.repeat(64)}`;
const target = fattal.FATTAL_BOOKLET_TARGETS.find(item => item.shortId !== '5ubXFS');
const oldBytes = Buffer.from('%PDF-1.7\nalready uploaded manually'), newBytes = Buffer.from('%PDF-1.7\nnew reviewed correction');
const bounds = { projectId: 'fixture', publicProjectId: 'fixture', cloudProjectId: 'fixture', cloudOwnerId: 'owner', cloudOwnerEmail: 'owner@example.invalid' };
class MemoryDb {
  docs = new Map(); writes = []; queue = Promise.resolve(); loseResponse = false;
  collection(name) {
    return { doc: id => ({ path: `${name}/${id}`, id, get: () => this.snapshot(`${name}/${id}`) }),
      where: (field, op, values) => ({ query: { name, field, op, values } }) };
  }
  snapshot(path, docs = this.docs) {
    const value = structuredClone(docs.get(path));
    return { exists: value !== undefined, id: path.split('/')[1], ref: { path }, data: () => structuredClone(value) };
  }
  runTransaction(fn) {
    const run = this.queue.then(async () => {
      const data = structuredClone(this.docs), writes = [];
      const result = await fn({ get: async ref => {
        assert.equal(writes.length, 0, 'all reads precede writes');
        if (!ref.query) return this.snapshot(ref.path, data);
        const q = ref.query; assert.equal(q.op, 'in');
        return { docs: [...data].filter(([path, value]) => path.startsWith(q.name + '/') && q.values.includes(value[q.field])).map(([path]) => this.snapshot(path, data)) };
      }, create: (ref, value) => { assert.ok(!data.has(ref.path)); data.set(ref.path, structuredClone(value)); writes.push(ref.path); },
      update: (ref, value) => { assert.ok(data.has(ref.path)); data.set(ref.path, { ...data.get(ref.path), ...structuredClone(value) }); writes.push(ref.path); } });
      this.docs = data; this.writes.push(...writes);
      if (writes.length && this.loseResponse) { this.loseResponse = false; throw Error('lost response'); }
      return result;
    });
    this.queue = run.catch(() => {}); return run;
  }
}
function fixture() {
  const db = new MemoryDb(), media = { type: 'pdf', filename: 'same.pdf', size: oldBytes.length, url: 'https://storage.example.invalid/old.pdf' };
  db.docs.set('users/admin', { role: 'super_admin' });
  db.docs.set('users/owner', { email: bounds.cloudOwnerEmail, storageUsed: oldBytes.length, storageLimit: 100000 });
  for (const item of fattal.FATTAL_BOOKLET_TARGETS) db.docs.set(`codes/${item.shortId}`, { shortId: item.shortId, ownerId: 'owner', media: [structuredClone(media)] });
  db.docs.set(`fattalCloudConnections/${writerId}`, { workflow: 'fattal-cloud-v1', keyHash: sha256(token), ownerId: 'owner', ownerEmail: bounds.cloudOwnerEmail,
    projectId: 'fixture', ownerVerifiedBy: 'admin', ownerVerifiedAt: now - 1000, expiresAt: now + 3600000, scopes: ['read', 'write'], allowedTargets: [target.shortId] });
  const manifest = { protocol: 1, ownerId: 'owner', projectId: 'fixture', shortId: target.shortId, hotel: target.key,
    filename: 'same.pdf', sha256: sha256(newBytes), size: newBytes.length, expectedVersion: activeVersion([media]),
    period: { kind: 'weekday', startDate: '2026-10-11', endDate: '2026-10-14' }, sourceGroupId: 'exact-group',
    sources: [{ messageId: 'message-new', fileId: 'file-new', sha256: sha256(newBytes) }], supersedes: [],
    review: { reviewer: 'untrusted-attribution', reviewedAt: now - 1000, contextResolved: true, replacementApproved: true, evidence: 'Actual PDF and exact group/message identify the corrected hotel and weekday period.' } };
  let reads = 0, uploads = 0;
  const objects = new Map([[media.url, oldBytes]]);
  const readPdf = async current => { reads++; const bytes = objects.get(current.url); assert.ok(bytes); return { sha256: sha256(bytes), size: bytes.length }; };
  const api = approval.createManifestApprovals(db, bounds, readPdf, () => now);
  const storage = { upload: async (key, bytes) => { uploads++; const url = `https://storage.example.invalid/${key}`; objects.set(url, Buffer.from(bytes)); return { url, size: bytes.length, storageProvider: 'cloudflare-r2', storageKey: key, storageBucket: 'fixture' }; },
    verify: async (object, hash, size) => objects.has(object.url) && objects.get(object.url).length === size && sha256(objects.get(object.url)) === hash };
  return { db, manifest, api, readPdf, objects, storage, counts: () => ({ reads, uploads }) };
}
const preview = f => f.api.preview('admin', writerId, f.manifest);
const approve = (f, review) => f.api.approve('admin', writerId, review.manifest, review.manifestId);

test('preview is read-only, binds authenticated reviewer and hashes actual manually uploaded predecessor bytes', async () => {
  const f = fixture(), result = await preview(f);
  assert.equal(result.manifest.review.reviewer, 'admin'); assert.equal(result.manifest.review.reviewedAt, now);
  assert.equal(result.manifestId, manifestId(result.manifest)); assert.equal(result.predecessor.sha256, sha256(oldBytes));
  assert.equal(result.persisted, false); assert.equal(result.uploadAllowed, false); assert.deepEqual(f.db.writes, []);
  assert.equal(f.counts().uploads, 0); assert.doesNotMatch(JSON.stringify(result), /tq_fc_|keyHash/);
});
test('one exact approval is persisted without credentials/media/quota writes and interoperates with the real commit/recovery service', async () => {
  const f = fixture(), review = await preview(f), result = await approve(f, review);
  assert.equal(result.state, 'approved'); assert.equal(result.expiresAt, now + 15 * 60000); assert.equal(result.uploadPerformed, false);
  assert.deepEqual(f.db.writes, [`fattalCloudApprovals/${review.manifestId}`]); assert.equal(f.counts().uploads, 0);
  const config = { enabled: true, writesEnabled: true, ownerId: 'owner', ownerEmail: bounds.cloudOwnerEmail, projectId: 'fixture' };
  // Add read-query support for the existing cloud service's non-transactional context.
  const collection = f.db.collection.bind(f.db);
  f.db.collection = name => { const c = collection(name), where = c.where; return { ...c, where: (...args) => {
    const q = where(...args); return { ...q, get: async () => ({ docs: [...f.db.docs].filter(([path, d]) => path.startsWith(name + '/') && args[2].includes(d[args[0]])).map(([path]) => f.db.snapshot(path)) }) };
  } }; };
  const api = createCloudService(f.db, config, token, f.storage, () => now);
  assert.equal((await api.commit(review.manifest, review.manifestId, newBytes)).verified, true); assert.equal(f.counts().uploads, 1);
});
test('same bytes are rejected regardless of filename; the eleven manual updates are never inferred to be pending uploads', async () => {
  const f = fixture(); f.manifest.filename = 'renamed.pdf'; f.manifest.sha256 = sha256(oldBytes); f.manifest.size = oldBytes.length;
  f.manifest.sources[0].sha256 = f.manifest.sha256;
  await assert.rejects(preview(f), /already active/); assert.deepEqual(f.db.writes, []); assert.equal(f.counts().uploads, 0);
});
test('review rejects read-only/expired/revoked/foreign grants, actor/owner/project/target/child and paused-hotel violations', async () => {
  const mutations = [
    f => f.db.docs.get(`fattalCloudConnections/${writerId}`).scopes = ['read'],
    f => f.db.docs.get(`fattalCloudConnections/${writerId}`).expiresAt = now,
    f => f.db.docs.get(`fattalCloudConnections/${writerId}`).revokedAt = now,
    f => f.db.docs.get(`fattalCloudConnections/${writerId}`).ownerId = 'other',
    f => f.db.docs.get('users/admin').role = 'free', f => f.db.docs.get('users/owner').email = 'foreign',
    f => f.db.docs.get(`codes/${target.shortId}`).parentCodeShortId = 'parent',
    f => f.db.docs.get(`codes/${target.shortId}`).ownerId = 'other', f => f.db.docs.delete('codes/5ubXFS'),
    f => f.db.docs.set('codes/duplicate', structuredClone(f.db.docs.get(`codes/${target.shortId}`))),
    f => f.manifest.projectId = 'foreign', f => f.manifest.hotel = 'adjacent hotel',
    f => f.manifest.sources = [], f => f.manifest.review.contextResolved = false,
    f => { f.manifest.shortId = '5ubXFS'; f.manifest.hotel = 'u-splash-eilat'; f.db.docs.get(`fattalCloudConnections/${writerId}`).allowedTargets = ['5ubXFS']; },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); await assert.rejects(preview(f)); assert.deepEqual(f.db.writes, []); assert.equal(f.counts().uploads, 0); }
  for (const change of [{ cloudOwnerId: undefined }, { cloudOwnerEmail: 'foreign' }, { cloudProjectId: 'foreign' }, { publicProjectId: 'foreign' }, { legacyOwnerId: 'foreign' }]) {
    const f = fixture(), api = approval.createManifestApprovals(f.db, { ...bounds, ...change }, f.readPdf, () => now);
    await assert.rejects(api.preview('admin', writerId, f.manifest)); assert.deepEqual(f.db.writes, []);
  }
});
test('approve rejects changed digest, impersonated reviewer, stale review and pointers/permissions changed while PDF was read', async () => {
  let f = fixture(), review = await preview(f);
  await assert.rejects(f.api.approve('admin', writerId, { ...review.manifest, filename: 'changed.pdf' }, review.manifestId), /digest/);
  await assert.rejects(f.api.approve('admin', writerId, { ...review.manifest, review: { ...review.manifest.review, reviewer: 'other' } }, review.manifestId), /authenticated/);
  await assert.rejects(f.api.approve('admin', writerId, { ...review.manifest, review: { ...review.manifest.review, reviewedAt: now - 3600001 } }, review.manifestId), /fresh/);
  for (const mutate of [f => f.db.docs.get(`codes/${target.shortId}`).media[0].title = 'changed',
    f => f.db.docs.get(`fattalCloudConnections/${writerId}`).revokedAt = now, f => f.db.docs.get('users/admin').role = 'free']) {
    f = fixture(); review = await preview(f);
    const api = approval.createManifestApprovals(f.db, bounds, async media => { const digest = await f.readPdf(media); mutate(f); return digest; }, () => now);
    await assert.rejects(api.approve('admin', writerId, review.manifest, review.manifestId)); assert.deepEqual(f.db.writes, []);
  }
});
test('concurrent approval is create-once, lost response recovers read-only, and revocation never renews approval', async () => {
  const f = fixture(), review = await preview(f);
  await Promise.all([approve(f, review), approve(f, review)]); assert.equal(f.db.writes.length, 1);
  const before = structuredClone(f.db.docs.get(`fattalCloudApprovals/${review.manifestId}`)); await approve(f, review);
  assert.deepEqual(f.db.docs.get(`fattalCloudApprovals/${review.manifestId}`), before);
  assert.equal((await f.api.status('admin', review.manifestId)).state, 'approved'); assert.equal(f.db.writes.length, 1);
  assert.equal((await f.api.revoke('admin', review.manifestId)).state, 'revoked'); await f.api.revoke('admin', review.manifestId); assert.equal(f.db.writes.length, 2);
  await assert.rejects(approve(f, review), /already exists/);
  f.db.docs.set('users/other', { role: 'super_admin' }); await assert.rejects(f.api.status('other', review.manifestId), /scope/);
  const lost = fixture(), second = await preview(lost); lost.db.loseResponse = true; await assert.rejects(approve(lost, second), /lost response/);
  assert.equal((await lost.api.status('admin', second.manifestId)).state, 'approved'); assert.equal(lost.db.writes.length, 1);
  await assert.rejects(lost.api.revoke('admin', 'f'.repeat(64)), /missing/); assert.equal(lost.db.writes.length, 1);
});
test('pending server claims and existing duplicate ledgers prevent approval before any PDF fetch', async () => {
  for (const mutate of [f => f.db.docs.get(`codes/${target.shortId}`).fattalCloudPending = 'pending',
    f => f.db.docs.set(`fattalCloudFiles/${policy.fileLedgerId(f.manifest)}`, { manifestId: 'f'.repeat(64) })]) {
    const f = fixture(); mutate(f); await assert.rejects(preview(f), /recover/); assert.equal(f.counts().reads, 0); assert.deepEqual(f.db.writes, []);
  }
});
test('current PDF reader allows only exact explicit HTTPS storage origins and bounded valid PDF bytes, with no credentials/retry/redirect', async () => {
  let calls = 0; const fetcher = async (url, init) => { calls++; assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit'); assert.equal(init.headers, undefined); return new Response(oldBytes); };
  const reader = pdf.createReviewPdfReader(['https://storage.example.invalid'], fetcher);
  for (const url of ['http://storage.example.invalid/x', 'https://storage.example.invalid.evil/x', 'https://user:pass@storage.example.invalid/x', 'https://storage.example.invalid:444/x', 'https://storage.example.invalid/x?token=bad', 'https://127.0.0.1/x']) await assert.rejects(reader({ type: 'pdf', url }));
  assert.equal(calls, 0);
  assert.equal((await reader({ type: 'pdf', url: 'https://storage.example.invalid/x', size: oldBytes.length })).sha256, sha256(oldBytes)); assert.equal(calls, 1);
  for (const body of [Buffer.alloc(3 * 1024 * 1024 + 1), Buffer.from('<html>not PDF')]) {
    const invalid = pdf.createReviewPdfReader(['https://storage.example.invalid'], async () => new Response(body)); await assert.rejects(invalid({ type: 'pdf', url: 'https://storage.example.invalid/x' }));
  }
});

const next = stub('export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};');
const auth = await loadTs('../../src/lib/auth.ts', { 'next/server': next,
  'firebase-admin/auth': stub('export const getAuth=()=>({verifyIdToken:async()=>{if(globalThis.approvalFixture.invalid)throw Error();return {uid:"admin"};}});'),
  '@/lib/firebase-admin': stub('export const getAdminApp=()=>({});export const getAdminDb=()=>globalThis.approvalFixture.f.db;') });
globalThis.approvalFixture.auth = auth;
const route = await loadTs('../../src/app/api/content-intake/dot/approvals/route.ts', { 'next/server': next, '@/lib/auth': expose('auth'),
  '@/lib/content-intake/cloud-policy': expose('policy'), '@/lib/content-intake/setup-review': expose('setup'),
  '@/lib/content-intake/cloud-approval': expose('approval'),
  '@/lib/content-intake/cloud-review-pdf': stub('export const createReviewPdfReader=()=>globalThis.approvalFixture.f.readPdf;'),
  '@/lib/firebase-admin': stub('export const getAdminApp=()=>({options:{projectId:"fixture"}});export const getAdminDb=()=>globalThis.approvalFixture.f.db;') });
function routeFixture() {
  const f = fixture(); globalThis.approvalFixture.f = f; globalThis.approvalFixture.invalid = false;
  for (const key of Object.keys(process.env)) if (key.startsWith('FATTAL_')) delete process.env[key];
  Object.assign(process.env, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'fixture', FATTAL_CLOUD_PROJECT_ID: 'fixture', FATTAL_CLOUD_OWNER_ID: 'owner', FATTAL_CLOUD_OWNER_EMAIL: bounds.cloudOwnerEmail });
  return f;
}
async function call(method = 'GET', body, headers = {}, query = '') {
  const url = new URL('https://fixture.invalid/api/content-intake/dot/approvals' + query);
  const request = new Request(url, { method, headers: { Authorization: 'Bearer fixture', Origin: url.origin, 'Content-Type': 'application/json', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }); request.nextUrl = url;
  const response = await route[method](request); assert.equal(response.headers.get('Cache-Control'), 'no-store'); return { status: response.status, body: await response.json() };
}
test('actual approval route authenticates administrator/origin, defaults off and rejects credentials/extra fields/oversize bodies before persistence', async t => {
  t.mock.method(Date, 'now', () => now);
  for (const scenario of ['missing', 'invalid', 'ordinary', 'origin', 'disabled', 'key', 'extra', 'oversize']) {
    const f = routeFixture(); if (scenario !== 'disabled') Object.assign(process.env, { FATTAL_CLOUD_ENABLED: 'true', FATTAL_CLOUD_APPROVALS_ENABLED: 'true' });
    if (scenario === 'invalid') globalThis.approvalFixture.invalid = true;
    if (scenario === 'ordinary') f.db.docs.get('users/admin').role = 'free';
    const review = { ...f.manifest, review: { ...f.manifest.review, reviewer: 'admin', reviewedAt: now } };
    let body = { action: 'approve', connectionId: writerId, manifest: review, manifestId: manifestId(review) };
    if (scenario === 'key') body.token = token; if (scenario === 'extra') body.notify = true; if (scenario === 'oversize') body = 'x'.repeat(65537);
    const response = await call('POST', body, scenario === 'missing' ? { Authorization: '' } : scenario === 'origin' ? { Origin: 'https://foreign.invalid' } : {});
    assert.ok([400, 401, 403, 413, 503].includes(response.status), scenario); assert.deepEqual(f.db.writes, []); assert.equal(f.counts().reads, 0);
    assert.doesNotMatch(JSON.stringify(response.body), /tq_fc_|keyHash/);
  }
});
test('actual route supports read-only preview, exact approval, GET recovery and cancellation after the creation gate is disabled', async t => {
  t.mock.method(Date, 'now', () => now); const f = routeFixture();
  assert.equal((await call()).body.approvalEnabled, false);
  const review = (await call('POST', { action: 'preview', connectionId: writerId, manifest: f.manifest })).body;
  assert.equal(review.persisted, false); assert.deepEqual(f.db.writes, []);
  Object.assign(process.env, { FATTAL_CLOUD_ENABLED: 'true', FATTAL_CLOUD_APPROVALS_ENABLED: 'true' });
  assert.equal((await call('POST', { action: 'approve', connectionId: writerId, manifest: review.manifest, manifestId: review.manifestId })).body.state, 'approved');
  delete process.env.FATTAL_CLOUD_APPROVALS_ENABLED; process.env.FATTAL_CLOUD_REVIEW_STORAGE_ORIGINS = '{invalid';
  assert.equal((await call('GET', undefined, {}, '?manifestId=' + review.manifestId)).body.state, 'approved'); assert.equal(f.db.writes.length, 1);
  assert.equal((await call('DELETE', undefined, {}, '?manifestId=' + review.manifestId)).body.state, 'revoked'); assert.equal(f.db.writes.length, 2);
});
