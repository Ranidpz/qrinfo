import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs, stub } from './load-ts.mjs';

assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:[1-9]\d{0,4}$/);
for (const name of Object.keys(process.env)) {
  assert.ok(!/^(GOOGLE_|GCLOUD_|FIREBASE_|FATTAL_CLOUD_|CLOUDFLARE_|R2_|HTTP_PROXY|HTTPS_PROXY|http_proxy|https_proxy|NODE_OPTIONS)/.test(name),
    `Unexpected inherited environment variable: ${name}`);
}
const projectId = 'demo-fattal-acceptance';
const root = fileURLToPath(new URL('../..', import.meta.url));
const dependencies = createRequire(join(resolve(process.env.FATTAL_TEST_DEPENDENCY_ROOT), 'package.json'));
const { initializeApp, deleteApp } = dependencies('firebase-admin/app');
const { getFirestore } = dependencies('firebase-admin/firestore');
const app = initializeApp({ projectId }, 'fattal-emulator-acceptance');
const db = getFirestore(app);
after(async () => { await db.terminate(); await deleteApp(app); });

// Actual production source, with only framework/bootstrap and object-storage seams.
globalThis.fattalEmulator = {};
const expose = name => stub(Object.keys(globalThis.fattalEmulator[name]).map(key =>
  `export const ${key}=globalThis.fattalEmulator.${name}.${key};`).join('\n'));
async function source(name, path, replacements = {}) {
  globalThis.fattalEmulator[name] = await loadTs(path, replacements);
  return globalThis.fattalEmulator[name];
}
const fattal = await source('fattal', '../../src/lib/content-intake/fattal.ts');
const policy = await source('policy', '../../src/lib/content-intake/cloud-policy.ts', { './fattal': expose('fattal') });
await source('service', '../../src/lib/content-intake/cloud-service.ts', { './fattal': expose('fattal'), './cloud-policy': expose('policy') });
await source('setup', '../../src/lib/content-intake/setup-review.ts', { './fattal': expose('fattal') });
const approval = await source('approval', '../../src/lib/content-intake/cloud-approval.ts', {
  './fattal': expose('fattal'), './cloud-policy': expose('policy'), './setup-review': expose('setup'),
});
const pdfReader = await source('pdfReader', '../../src/lib/content-intake/cloud-review-pdf.ts', { './cloud-policy': expose('policy') });
const route = await loadTs('../../src/app/api/content-intake/fattal/cloud/[operation]/route.ts', {
  'next/server': stub('export const NextResponse={json:(body,init)=>Response.json(body,init)};'),
  '@/lib/firebase-admin': stub(`export const getAdminDb=()=>globalThis.fattalEmulator.fixture.database;
    export const getAdminApp=()=>({options:{projectId:${JSON.stringify(projectId)}}});`),
  '@/lib/media-storage': stub('export const uploadStoredObject=({key,body})=>globalThis.fattalEmulator.fixture.uploadObject(key,body);'),
  '@/lib/r2-storage': stub('export const isR2Url=url=>new URL(url).origin==="https://fattal-objects.invalid";'),
  '@/lib/content-intake/cloud-policy': expose('policy'),
  '@/lib/content-intake/cloud-service': expose('service'),
});
const { sha256, manifestId, fileLedgerId } = policy;
const writerId = 'a'.repeat(32), token = `tq_fc_${writerId}.${'b'.repeat(64)}`; // Synthetic only.
const targets = fattal.FATTAL_BOOKLET_TARGETS;
const target = targets.find(t => t.shortId !== '5ubXFS');
const ownerId = 'synthetic-owner', ownerEmail = 'synthetic-owner@example.invalid';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => globalThis.fattalEmulator.fixture.readObject(input, init);
after(() => { globalThis.fetch = originalFetch; });

function pdf(text) {
  const stream = `BT /F1 12 Tf 40 100 Td (${text}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 160] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let result = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(result)); result += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  return Buffer.from(result + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
const oldBytes = pdf('SYNTHETIC predecessor'), newBytes = pdf('SYNTHETIC reviewed replacement');

async function fixture(t) {
  // Clear only this dedicated emulator project. No inherited project can be used.
  const cleared = await originalFetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  assert.equal(cleared.status, 200);
  const directory = await mkdtemp(join(tmpdir(), 'fattal-emulator-case-'));
  const stateDirectory = join(directory, 'journal'), objects = join(directory, 'objects');
  await mkdir(stateDirectory, { mode: 0o700 }); await mkdir(objects, { mode: 0o700 });
  const counts = { puts: 0, gets: 0, deleteAttempts: 0, commitRequests: 0, txCalls: 0, txCallbacks: 0, activeTransactions: 0, maxConcurrentTransactions: 0 };
  const f = { directory, stateDirectory, objects, counts, calls: [], dropCommit: false, blockRecovery: false,
    beforeCommit: async () => {}, afterPersist: async () => {}, errors: [] };
  f.database = {
    collection: db.collection.bind(db),
    runTransaction: (callback, options) => {
      counts.txCalls++;
      return db.runTransaction(async tx => {
        counts.txCallbacks++; counts.activeTransactions++;
        counts.maxConcurrentTransactions = Math.max(counts.maxConcurrentTransactions, counts.activeTransactions);
        try { return await callback(tx); } finally { counts.activeTransactions--; }
      }, options);
    },
  };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, f.origin);
      if (url.pathname.startsWith('/objects/')) {
        const key = url.pathname.slice('/objects/'.length);
        assert.match(key, /^[A-Za-z0-9_./-]+$/); assert.ok(!key.split('/').includes('..'));
        const path = join(objects, key);
        if (request.method === 'PUT') {
          const chunks = []; for await (const chunk of request) chunks.push(chunk);
          const bytes = Buffer.concat(chunks); assert.ok(bytes.length <= 3 * 1024 * 1024);
          await mkdir(dirname(path), { recursive: true, mode: 0o700 });
          counts.puts++;
          await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
          response.writeHead(201); response.end(); return;
        }
        if (request.method === 'GET') {
          counts.gets++; const bytes = await readFile(path);
          response.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': bytes.length }); response.end(bytes); return;
        }
        if (request.method === 'DELETE') counts.deleteAttempts++;
        response.writeHead(405); response.end(); return;
      }
      assert.match(url.pathname, /^\/api\/content-intake\/fattal\/cloud\/(health|preview|commit|recovery)$/);
      const operation = url.pathname.split('/').at(-1);
      f.calls.push({ method: request.method, operation });
      if (operation === 'commit') { counts.commitRequests++; await f.beforeCommit(); }
      if (operation === 'recovery' && f.blockRecovery) { response.writeHead(503); response.end(); return; }
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const apiUrl = new URL(url.pathname + url.search, 'https://fattal-api.invalid');
      const req = new Request(apiUrl, { method: request.method, headers: request.headers,
        ...(body.length ? { body } : {}) }); req.nextUrl = apiUrl;
      const result = await route[request.method](req, { params: Promise.resolve({ operation }) });
      if (operation === 'commit' && f.dropCommit) { response.destroy(); return; }
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) { f.errors.push(error.message); response.writeHead(500); response.end('Fixture failure'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  f.origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolveClose => server.close(resolveClose));
    await rm(directory, { recursive: true, force: true });
  });
  f.readObject = async (input, init = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://fattal-objects.invalid');
    assert.equal(init.method || 'GET', 'GET');
    const response = await originalFetch(new URL(url.pathname, f.origin), { ...init, redirect: 'error' });
    return new Response(response.body, { status: response.status, headers: response.headers });
  };
  f.uploadObject = async (key, bytes) => {
    const response = await originalFetch(`${f.origin}/objects/${key}`, { method: 'PUT', body: bytes, redirect: 'error' });
    assert.equal(response.status, 201);
    await f.afterPersist();
    return { url: `https://fattal-objects.invalid/objects/${key}`, size: bytes.length,
      storageProvider: 'cloudflare-r2', storageKey: key, storageBucket: 'synthetic-disk-bucket' };
  };
  globalThis.fattalEmulator.fixture = f;
  Object.assign(process.env, { FATTAL_CLOUD_ENABLED: 'true', FATTAL_CLOUD_WRITES_ENABLED: 'true',
    FATTAL_CLOUD_OWNER_ID: ownerId, FATTAL_CLOUD_OWNER_EMAIL: ownerEmail, FATTAL_CLOUD_PROJECT_ID: projectId,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId });
  const old = { id: 'old', type: 'pdf', filename: 'synthetic-old.pdf', size: oldBytes.length,
    url: 'https://fattal-objects.invalid/objects/predecessor.pdf', pageCount: 1 };
  await writeFile(join(objects, 'predecessor.pdf'), oldBytes);
  const batch = db.batch();
  batch.set(db.doc(`users/${ownerId}`), { email: ownerEmail, storageUsed: oldBytes.length, storageLimit: 1000000 });
  batch.set(db.doc('users/synthetic-admin'), { role: 'super_admin' });
  for (const item of targets) batch.set(db.doc(`codes/${item.shortId}`), {
    shortId: item.shortId, ownerId, media: item.shortId === target.shortId ? [old] : [],
  });
  batch.set(db.doc(`fattalCloudConnections/${writerId}`), { workflow: 'fattal-cloud-v1', keyHash: sha256(token), ownerId, ownerEmail,
    projectId, ownerVerifiedBy: 'synthetic-admin', ownerVerifiedAt: Date.now() - 1000,
    scopes: ['read', 'write'], allowedTargets: targets.map(t => t.shortId), expiresAt: Date.now() + 3600000 });
  await batch.commit();
  f.approvals = approval.createManifestApprovals(f.database, { projectId, publicProjectId: projectId,
    cloudProjectId: projectId, cloudOwnerId: ownerId, cloudOwnerEmail: ownerEmail },
  pdfReader.createReviewPdfReader(['https://fattal-objects.invalid'], f.readObject));
  f.request = async (operation, body) => {
    const response = await originalFetch(`${f.origin}/api/content-intake/fattal/cloud/${operation}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', headers: { 'x-fattal-cloud-key': token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  f.makeManifest = async (bytes = newBytes, chosen = target, label = 'new') => {
    const health = await f.request('health'); assert.equal(health.status, 200);
    return { protocol: 1, ownerId, projectId, shortId: chosen.shortId, hotel: chosen.key,
      filename: `synthetic-${label}.pdf`, sha256: sha256(bytes), size: bytes.length,
      expectedVersion: health.body.targets.find(t => t.shortId === chosen.shortId).expectedVersion,
      period: { kind: 'weekday', startDate: '2026-10-11', endDate: '2026-10-14' }, sourceGroupId: 'synthetic-group',
      sources: [{ messageId: `synthetic-${label}`, fileId: `synthetic-file-${label}`, sha256: sha256(bytes) }], supersedes: [],
      review: { reviewer: 'synthetic-admin', reviewedAt: Date.now(), contextResolved: true, replacementApproved: true,
        evidence: 'Synthetic fixture only: explicit generated PDF, target and period.' } };
  };
  f.approve = async (manifest) => {
    const review = await f.approvals.preview('synthetic-admin', writerId, manifest);
    assert.equal(review.persisted, false);
    const result = await f.approvals.approve('synthetic-admin', writerId, review.manifest, review.manifestId);
    assert.equal(result.state, 'approved');
    return review.manifest;
  };
  f.commit = (manifest, bytes = newBytes) => f.request('commit', { activate: true, manifest, manifestId: manifestId(manifest),
    pdfBase64: bytes.toString('base64'), sendEmail: false, notify: false, cleanup: false, deleteOld: false });
  f.config = { enabled: true, writesEnabled: true, baseUrl: 'https://fattal-api.invalid', ownerId, ownerEmail, projectId,
    allowedTargets: targets.map(t => t.shortId), stateDirectory, durableStateConfirmed: true };
  f.worker = async (command, manifest, bytes = newBytes, overrides = {}) => {
    const configPath = join(directory, 'worker-config.json'), manifestPath = join(directory, 'manifest.json'), pdfPath = join(directory, 'synthetic.pdf');
    await writeFile(configPath, JSON.stringify({ ...f.config, ...overrides }), { mode: 0o600 });
    if (manifest) await writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
    if (command === 'upload') await writeFile(pdfPath, bytes, { mode: 0o600 });
    const args = ['scripts/tests/fixtures/fattal-emulator-worker.mjs', command];
    if (manifest) args.push('--manifest', manifestPath);
    if (command === 'upload') args.push('--pdf', pdfPath);
    const child = spawn(process.execPath, args, { cwd: root,
      env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, FATTAL_TEST_HTTP_ORIGIN: f.origin, FATTAL_CLOUD_UPLOADER_CONFIG: configPath },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
    const [code, signal] = await once(child, 'exit');
    assert.equal(signal, null); assert.equal(errors, '');
    assert.doesNotMatch(output, /tq_fc_|keyHash|pdfBase64/);
    return { code, pid: child.pid, result: JSON.parse(output) };
  };
  f.journal = async () => JSON.parse(await readFile(join(stateDirectory, 'uploader.json'), 'utf8'));
  f.assertUntouched = async () => {
    assert.equal(counts.puts, 0); assert.equal(counts.deleteAttempts, 0);
    assert.equal((await db.doc(`users/${ownerId}`).get()).data().storageUsed, oldBytes.length);
    assert.equal((await db.collection('fattalCloudRuns').get()).size, 0);
    assert.deepEqual(await readFile(join(objects, 'predecessor.pdf')), oldBytes);
  };
  f.assertActivated = async (manifest, bytes = newBytes) => {
    const id = manifestId(manifest), record = (await db.doc(`fattalCloudRuns/${id}`).get()).data();
    const code = (await db.doc(`codes/${manifest.shortId}`).get()).data();
    assert.equal(record.status, 'activated'); assert.equal(code.fattalCloudPending, null);
    assert.equal(code.media[0].url, record.object.url); assert.equal(code.media[0].contentIntake.cloudManifestId, id);
    assert.equal(record.predecessor.url, old.url); assert.equal(code.media[0].pageCount, undefined);
    assert.equal((await db.doc(`fattalCloudFiles/${fileLedgerId(manifest)}`).get()).data().manifestId, id);
    assert.equal((await db.doc(`users/${ownerId}`).get()).data().storageUsed, oldBytes.length + bytes.length);
    const persisted = await readFile(join(objects, record.object.storageKey));
    assert.deepEqual(persisted, bytes); assert.equal(sha256(persisted), manifest.sha256);
    assert.deepEqual(await readFile(join(objects, 'predecessor.pdf')), oldBytes);
    assert.equal(counts.puts, 1); assert.equal(counts.deleteAttempts, 0); assert.deepEqual(f.errors, []);
    const recovered = await f.request(`recovery?manifestId=${id}`);
    assert.equal(recovered.status, 200); assert.equal(recovered.body.verified, true);
    assert.equal(recovered.body.notification, 'disabled'); assert.equal(recovered.body.cleanup, 'disabled');
    return record;
  };
  assert.equal((await f.worker('initialize-state')).code, 0);
  return f;
}

test('one approved replacement persists bytes, pointer, receipt and quota; repeat request does not upload/delete twice', { timeout: 45000 }, async t => {
  const f = await fixture(t), m = await f.approve(await f.makeManifest());
  assert.equal(f.counts.puts, 0);
  const first = await f.worker('upload', m); assert.equal(first.code, 0); assert.equal(first.result.verified, true);
  await f.assertActivated(m); assert.equal((await f.journal()).attempts[manifestId(m)].status, 'verified');
  const repeated = await f.worker('upload', m); assert.equal(repeated.code, 0); assert.notEqual(first.pid, repeated.pid);
  assert.equal(f.counts.commitRequests, 1);
  const repeatedDirect = await f.commit(m); assert.equal(repeatedDirect.status, 200); assert.equal(repeatedDirect.body.verified, true);
  await f.assertActivated(m);
  t.diagnostic(JSON.stringify({ persistedBytes: newBytes.length, sha256: m.sha256,
    objectWrites: f.counts.puts, objectDeletes: f.counts.deleteAttempts,
    quotaBefore: oldBytes.length, quotaAfter: oldBytes.length + newBytes.length,
    clientRepeatCommits: 0, directDuplicateCommitVerified: true }));
});

test('lost commit and recovery responses: fresh OS process recovers same pending journal using GET only', { timeout: 45000 }, async t => {
  const f = await fixture(t), m = await f.approve(await f.makeManifest());
  f.dropCommit = true; f.blockRecovery = true;
  const first = await f.worker('upload', m); assert.equal(first.code, 2); assert.equal(first.result.status, 'uncertain');
  assert.equal((await f.journal()).attempts[manifestId(m)].status, 'pending');
  assert.equal((await db.doc(`fattalCloudRuns/${manifestId(m)}`).get()).data().status, 'activated');
  f.dropCommit = false; f.blockRecovery = false; f.calls.length = 0;
  const restarted = await f.worker('recover-pending', undefined, undefined, { writesEnabled: false });
  assert.notEqual(first.pid, restarted.pid); assert.equal(restarted.code, 0); assert.equal(restarted.result.pending, 0);
  assert.equal(restarted.result.results[0].verified, true);
  assert.deepEqual(f.calls, [{ method: 'GET', operation: 'health' }, { method: 'GET', operation: 'recovery' }]);
  assert.equal(f.counts.commitRequests, 1); await f.assertActivated(m);
  assert.equal((await f.journal()).attempts[manifestId(m)].status, 'verified');
  t.diagnostic(JSON.stringify({ firstProcess: first.pid, recoveryProcess: restarted.pid,
    recoveryMethods: ['GET health', 'GET recovery'], commitRequests: f.counts.commitRequests,
    objectWrites: f.counts.puts, objectDeletes: f.counts.deleteAttempts, journal: 'verified' }));
});

test('competing real Firestore transactions activate one revision and reserve quota once', { timeout: 60000 }, async t => {
  const f = await fixture(t), secondBytes = pdf('SYNTHETIC competing replacement');
  const a = await f.approve(await f.makeManifest()), b = await f.approve(await f.makeManifest(secondBytes, target, 'competing'));
  f.counts.maxConcurrentTransactions = 0;
  const results = await Promise.all([f.commit(a), f.commit(b, secondBytes)]);
  assert.equal(results.filter(r => r.status === 200 && r.body.verified).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 1);
  assert.ok(f.counts.maxConcurrentTransactions >= 2, 'Real SDK transaction callbacks overlapped');
  const winner = results[0].body.verified ? a : b, bytes = winner === a ? newBytes : secondBytes;
  assert.equal((await db.collection('fattalCloudRuns').get()).size, 1);
  await f.assertActivated(winner, bytes);
  t.diagnostic(JSON.stringify({ httpStatuses: results.map(r => r.status),
    overlappingTransactionCallbacks: f.counts.maxConcurrentTransactions,
    transactionCalls: f.counts.txCalls, transactionCallbacks: f.counts.txCallbacks,
    objectWrites: f.counts.puts, activatedReceipts: 1 }));
});

test('stale expected version is rejected by uploader and server without storage or quota changes', { timeout: 45000 }, async t => {
  const f = await fixture(t), m = await f.approve(await f.makeManifest());
  const ref = db.doc(`codes/${target.shortId}`), media = (await ref.get()).data().media;
  media[0].title = 'Synthetic concurrent edit'; await ref.update({ media });
  assert.equal((await f.worker('upload', m)).code, 1); assert.equal(f.counts.commitRequests, 0);
  assert.equal((await f.commit(m)).status, 409); await f.assertUntouched();
});

test('approval compares actual current bytes and rejects renamed duplicates', { timeout: 45000 }, async t => {
  const f = await fixture(t), same = await f.makeManifest(oldBytes, target, 'renamed');
  await assert.rejects(f.approve(same), /already active/);
  assert.equal((await db.collection('fattalCloudApprovals').get()).size, 0); await f.assertUntouched();
});

test('expired/revoked grants, missing/expired/revoked approvals and read-only grants fail closed', { timeout: 60000 }, async t => {
  for (const scenario of ['grant-expired', 'grant-revoked', 'grant-read-only', 'approval-missing', 'approval-expired', 'approval-revoked']) {
    await t.test(scenario, async sub => {
      const f = await fixture(sub), m = await f.approve(await f.makeManifest());
      const grant = db.doc(`fattalCloudConnections/${writerId}`), approved = db.doc(`fattalCloudApprovals/${manifestId(m)}`);
      if (scenario === 'grant-expired') await grant.update({ expiresAt: Date.now() - 1 });
      if (scenario === 'grant-revoked') await grant.update({ revokedAt: Date.now() });
      if (scenario === 'grant-read-only') await grant.update({ scopes: ['read'] });
      if (scenario === 'approval-missing') await approved.delete();
      if (scenario === 'approval-expired') await approved.update({ expiresAt: Date.now() - 1 });
      if (scenario === 'approval-revoked') await approved.update({ revokedAt: Date.now() });
      const result = await f.commit(m); assert.ok([401, 403].includes(result.status)); await f.assertUntouched();
    });
  }
});

test('mismatched owner/project/target and foreign or child records reject before upload', { timeout: 60000 }, async t => {
  for (const scenario of ['manifest-owner', 'manifest-project', 'manifest-target', 'target-owner', 'child-target', 'owner-email']) {
    await t.test(scenario, async sub => {
      const f = await fixture(sub), m = await f.approve(await f.makeManifest());
      if (scenario === 'manifest-owner') m.ownerId = 'foreign';
      if (scenario === 'manifest-project') m.projectId = 'demo-other';
      if (scenario === 'manifest-target') m.shortId = 'foreign';
      if (scenario === 'target-owner') await db.doc(`codes/${target.shortId}`).update({ ownerId: 'foreign' });
      if (scenario === 'child-target') await db.doc(`codes/${target.shortId}`).update({ parentCodeShortId: 'synthetic-parent' });
      if (scenario === 'owner-email') await db.doc(`users/${ownerId}`).update({ email: 'foreign@example.invalid' });
      assert.equal((await f.commit(m)).status, 403); await f.assertUntouched();
    });
  }
});

test('paused Splash rejects approval, uploader and direct server commit while health remains readable', { timeout: 45000 }, async t => {
  const f = await fixture(t), splash = targets.find(t => t.shortId === '5ubXFS'), m = await f.makeManifest(newBytes, splash);
  await assert.rejects(f.approve(m), /paused/);
  assert.equal((await f.worker('upload', m)).code, 1); assert.equal(f.counts.commitRequests, 0);
  const direct = await f.commit(m); assert.equal(direct.status, 409); assert.match(direct.body.error, /paused/);
  assert.equal((await f.request('health')).status, 200); await f.assertUntouched();
});

test('revocation or expiry during storage prevents activation and preserves pending claim/predecessor', { timeout: 60000 }, async t => {
  for (const scenario of ['grant-revoked', 'grant-expired', 'approval-revoked']) {
    await t.test(scenario, async sub => {
      const f = await fixture(sub), m = await f.approve(await f.makeManifest());
      f.afterPersist = async () => {
        if (scenario === 'approval-revoked') await db.doc(`fattalCloudApprovals/${manifestId(m)}`).update({ revokedAt: Date.now() });
        else await db.doc(`fattalCloudConnections/${writerId}`).update(scenario === 'grant-revoked' ? { revokedAt: Date.now() } : { expiresAt: Date.now() - 1 });
      };
      const result = await f.worker('upload', m); assert.equal(result.code, 2); assert.equal(result.result.status, 'uncertain');
      const receipt = (await db.doc(`fattalCloudRuns/${manifestId(m)}`).get()).data();
      assert.equal(receipt.status, 'pending');
      const code = (await db.doc(`codes/${target.shortId}`).get()).data();
      assert.equal(code.media[0].url, 'https://fattal-objects.invalid/objects/predecessor.pdf');
      assert.equal(code.fattalCloudPending, manifestId(m));
      assert.equal((await db.doc(`users/${ownerId}`).get()).data().storageUsed, oldBytes.length + newBytes.length);
      assert.equal((await f.journal()).attempts[manifestId(m)].status, 'pending');
      await f.worker('upload', m); assert.equal(f.counts.puts, 1); assert.equal(f.counts.commitRequests, 1);
      assert.equal(f.counts.deleteAttempts, 0); assert.deepEqual(await readFile(join(f.objects, 'predecessor.pdf')), oldBytes);
    });
  }
});

test('corrupt or missing journal/identity and stale lock block a new process before HTTP; no silent reset', { timeout: 60000 }, async t => {
  for (const scenario of ['corrupt-journal', 'missing-journal', 'missing-identity', 'stale-lock']) {
    await t.test(scenario, async sub => {
      const f = await fixture(sub), m = await f.approve(await f.makeManifest());
      f.blockRecovery = true; assert.equal((await f.worker('upload', m)).code, 2); f.blockRecovery = false;
      const journalPath = join(f.stateDirectory, 'uploader.json');
      if (scenario === 'corrupt-journal') await writeFile(journalPath, '{broken', { mode: 0o600 });
      if (scenario === 'missing-journal') await rm(journalPath);
      if (scenario === 'missing-identity') await rm(join(f.stateDirectory, 'uploader.identity'));
      if (scenario === 'stale-lock') await writeFile(join(f.stateDirectory, 'uploader.lock'), 'Synthetic stopped worker lock', { mode: 0o600 });
      f.calls.length = 0;
      assert.equal((await f.worker('recover-pending', undefined, undefined, { writesEnabled: false })).result.error, 'state');
      assert.equal((await f.worker('upload', m)).result.error, 'state');
      assert.equal((await f.worker('initialize-state')).result.error, 'state');
      assert.deepEqual(f.calls, []); assert.equal(f.counts.puts, 1); assert.equal(f.counts.commitRequests, 1);
      assert.equal(f.counts.deleteAttempts, 0);
      if (scenario === 'stale-lock') {
        const inspected = await f.worker('state'); assert.equal(inspected.result.lockPresent, true);
        assert.equal(inspected.result.currentServerStateVerified, false);
        assert.ok((await readdir(f.stateDirectory)).includes('uploader.lock'));
      }
    });
  }
});
