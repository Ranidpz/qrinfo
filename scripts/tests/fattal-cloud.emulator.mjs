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
await source('readGrant', '../../src/lib/content-intake/read-grant.ts', {
  './fattal': expose('fattal'), './cloud-policy': expose('policy'), './setup-review': expose('setup'),
});
const writerGrant = await source('writerGrant', '../../src/lib/content-intake/write-grant.ts', {
  './fattal': expose('fattal'), './cloud-policy': expose('policy'), './setup-review': expose('setup'), './read-grant': expose('readGrant'),
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
    beforeCommit: async () => {}, afterPersist: async () => {}, afterCommit: async () => {}, errors: [] };
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
      if (operation === 'commit') await f.afterCommit(result);
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
    const response = await originalFetch(`${f.apiOrigin || f.origin}/api/content-intake/fattal/cloud/${operation}`, {
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
  f.worker = async (command, manifest, bytes = newBytes, overrides = {}, observeChild = () => {}) => {
    const configPath = join(directory, 'worker-config.json'), manifestPath = join(directory, 'manifest.json'), pdfPath = join(directory, 'synthetic.pdf');
    await writeFile(configPath, JSON.stringify({ ...f.config, ...overrides }), { mode: 0o600 });
    if (manifest) await writeFile(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
    if (command === 'upload') await writeFile(pdfPath, bytes, { mode: 0o600 });
    const args = ['scripts/tests/fixtures/fattal-emulator-worker.mjs', command];
    if (manifest) args.push('--manifest', manifestPath);
    if (command === 'upload') args.push('--pdf', pdfPath);
    const child = spawn(process.execPath, args, { cwd: root,
      env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, FATTAL_TEST_HTTP_ORIGIN: f.apiOrigin || f.origin, FATTAL_CLOUD_UPLOADER_CONFIG: configPath },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { errors += b; });
    observeChild(child);
    const [code, signal] = await once(child, 'close');
    assert.equal(errors, '');
    if (signal) return { code, signal, pid: child.pid, output };
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

test('SIGKILL after activation retains lock and pending journal; explicit proven-dead reconciliation precedes GET-only recovery', { timeout: 45000 }, async t => {
  const f = await fixture(t), m = await f.approve(await f.makeManifest());
  let reached, release, child;
  const activated = new Promise(resolveReached => { reached = resolveReached; });
  const heldResponse = new Promise(resolveRelease => { release = resolveRelease; });
  f.afterCommit = async response => { assert.equal(response.status, 200); reached(); await heldResponse; };
  const running = f.worker('upload', m, newBytes, {}, process => { child = process; });
  await activated;
  assert.equal((await f.journal()).attempts[manifestId(m)].status, 'pending');
  assert.equal((await db.doc(`fattalCloudRuns/${manifestId(m)}`).get()).data().status, 'activated');
  assert.ok(child.kill('SIGKILL'));
  const killed = await running; assert.equal(killed.signal, 'SIGKILL'); release();
  assert.throws(() => process.kill(killed.pid, 0), error => error.code === 'ESRCH', 'Exact fixture process has exited');
  const lock = join(f.stateDirectory, 'uploader.lock');
  const retainedLock = await readFile(lock, 'utf8'), retainedJournal = await readFile(join(f.stateDirectory, 'uploader.json'), 'utf8');
  f.calls.length = 0;
  const blocked = await f.worker('recover-pending', undefined, undefined, { writesEnabled: false });
  assert.equal(blocked.result.error, 'state'); assert.deepEqual(f.calls, []);
  const snapshot = await f.worker('state'); assert.equal(snapshot.result.lockPresent, true);
  assert.equal(snapshot.result.attempts[0].lastKnownStatus, 'pending');
  assert.equal(await readFile(lock, 'utf8'), retainedLock);
  assert.equal(await readFile(join(f.stateDirectory, 'uploader.json'), 'utf8'), retainedJournal);
  // Test-only operator reconciliation, never an automatic uploader takeover:
  // the exact child is dead, this private directory has one caller, and GET
  // independently confirms the bound receipt/pointer/bytes before lock removal.
  await f.assertActivated(m);
  const artifact = process.env.FATTAL_TEST_ARTIFACTS;
  if (artifact) await writeFile(join(artifact, 'sigkill-reconciliation.json'), JSON.stringify({
    killedPid: killed.pid, signal: killed.signal, exactProcessExited: true, automaticRecoveryBlocked: true,
    retainedPendingManifest: manifestId(m), receiptIndependentlyVerified: true,
    lockRemovedBy: 'explicit isolated test operator after reconciliation', journalReset: false,
  }, null, 2) + '\n');
  await rm(lock); f.calls.length = 0;
  const recovered = await f.worker('recover-pending', undefined, undefined, { writesEnabled: false });
  assert.equal(recovered.result.pending, 0); assert.equal(recovered.result.results[0].verified, true);
  assert.deepEqual(f.calls, [{ method: 'GET', operation: 'health' }, { method: 'GET', operation: 'recovery' }]);
  assert.equal(f.counts.commitRequests, 1); assert.equal(f.counts.puts, 1); assert.equal(f.counts.deleteAttempts, 0);
  t.diagnostic(JSON.stringify({ signal: killed.signal, automaticTakeover: false,
    operatorReconciled: true, recoveryProcess: recovered.pid, objectWrites: 1, objectDeletes: 0 }));
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

test('real SDK writer issuance/cancellation race always leaves a revoked grant or permanent cancellation fence', async t => {
  const f = await fixture(t);
  const bindings = { projectId, publicProjectId: projectId, cloudProjectId: projectId, cloudOwnerId: ownerId, cloudOwnerEmail: ownerEmail };
  for (const id of ['c'.repeat(32), 'd'.repeat(32)]) {
    const input = writerGrant.parseWriteGrant({ connectionId: id, keyHash: 'e'.repeat(64), ownerId, ownerEmail, projectId, shortId: target.shortId, durationMinutes: 15 });
    const operations = [() => writerGrant.issueWriteGrant(f.database, 'synthetic-admin', bindings, input),
      () => writerGrant.inspectWriteGrant(f.database, 'synthetic-admin', bindings, id, true)];
    if (id[0] === 'd') operations.reverse();
    const results = await Promise.allSettled(operations.map(fn => fn()));
    assert.ok(results.some(r => r.status === 'fulfilled' && r.value.state === 'revoked'));
    const record = (await db.doc(`fattalCloudConnections/${id}`).get()).data();
    assert.ok(record.revokedAt); assert.equal(record.writeMode, 'supervised');
    await assert.rejects(writerGrant.issueWriteGrant(f.database, 'synthetic-admin', bindings, input));
  }
  assert.equal(f.counts.puts, 0);
});

test('running Next HTTP routes and real approval UI authorize, approve, upload, recover and revoke synthetic review', {
  timeout: 180000, skip: process.env.FATTAL_TEST_NEXT !== 'true' ? 'Enable FATTAL_TEST_NEXT for the separately installed Next/browser acceptance' : false,
}, async t => {
  const f = await fixture(t);
  const fixtureRoot = join(root, 'scripts/fattal-emulator/next-fixture');
  const { emulatorToken } = await import('../fattal-emulator/next-fixture/emulator-token.mjs');
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolveClose => probe.close(resolveClose));
  const origin = `http://127.0.0.1:${port}`;
  const { createApp } = dependencies('firebase-tools/lib/emulator/auth/server');
  const authApp = await createApp(projectId, 2); // SingleProjectMode.ERROR
  const authServer = authApp.listen(0, '127.0.0.1'); await once(authServer, 'listening');
  t.after(async () => { authServer.closeAllConnections(); await new Promise(resolveClose => authServer.close(resolveClose)); });
  const authHost = `127.0.0.1:${authServer.address().port}`;
  const seededAuth = await originalFetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchCreate`, {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: ['synthetic-admin', ownerId].map(localId => ({ localId, email: `${localId}@example.invalid`, validSince: '0' })) }),
  });
  assert.equal(seededAuth.status, 200); assert.deepEqual((await seededAuth.json()).error || [], []);
  const nextEnv = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, TMPDIR: tmpdir(),
    METADATA_SERVER_DETECTION: 'none', XDG_CONFIG_HOME: join(f.directory, 'empty-cli-config'),
    NEXT_TELEMETRY_DISABLED: '1', FATTAL_TEST_NEXT: 'true', FATTAL_TEST_OBJECT_ORIGIN: f.origin,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: authHost,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId, FATTAL_CLOUD_PROJECT_ID: projectId,
    FATTAL_CLOUD_OWNER_ID: ownerId, FATTAL_CLOUD_OWNER_EMAIL: ownerEmail,
    FATTAL_CLOUD_ENABLED: 'true', FATTAL_CLOUD_WRITES_ENABLED: 'true', FATTAL_CLOUD_APPROVALS_ENABLED: 'true',
    FATTAL_CLOUD_WRITE_GRANTS_ENABLED: 'true', FATTAL_CLOUD_SUPERVISED_ENABLED: 'true',
    FATTAL_CLOUD_REVIEW_STORAGE_ORIGINS: '["https://fattal-objects.invalid"]',
  };
  const next = spawn(process.execPath, [dependencies.resolve('next/dist/bin/next'), 'dev', fixtureRoot, '-H', '127.0.0.1', '-p', String(port)],
    { cwd: root, env: nextEnv, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let nextLog = '';
  next.stdout.on('data', b => { nextLog += b; }); next.stderr.on('data', b => { nextLog += b; });
  const nextClosed = once(next, 'close');
  t.after(async () => {
    if (next.exitCode === null) {
      try { process.kill(-next.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await nextClosed;
    if (process.env.FATTAL_TEST_ARTIFACTS) await writeFile(join(process.env.FATTAL_TEST_ARTIFACTS, 'next-server.log'), nextLog);
  });
  const deadline = Date.now() + 45000;
  while (!nextLog.includes('Ready in')) {
    assert.equal(next.exitCode, null, nextLog); assert.ok(Date.now() < deadline, nextLog);
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  f.apiOrigin = origin;
  const firstHealth = await f.request('health'); assert.equal(firstHealth.status, 200, JSON.stringify(firstHealth.body));
  const adminRequest = async (method, body, uid = 'synthetic-admin', requestOrigin = origin, suffix = '') => {
    const response = await originalFetch(`${origin}/api/content-intake/dot/approvals${suffix}`, {
      method, headers: { 'Content-Type': 'application/json', Origin: requestOrigin,
        ...(uid ? { Authorization: `Bearer ${emulatorToken(uid)}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await adminRequest('GET', undefined, '')).status, 401);
  assert.equal((await adminRequest('GET', undefined, ownerId)).status, 403);
  const capability = await adminRequest('GET'); assert.equal(capability.status, 200); assert.equal(capability.body.approvalEnabled, true);
  const candidate = await f.makeManifest();
  assert.equal((await adminRequest('POST', { action: 'preview', connectionId: writerId, manifest: candidate }, 'synthetic-admin', 'https://foreign.invalid')).status, 403);

  const browserDeps = process.env.FATTAL_TEST_PLAYWRIGHT_ROOT
    ? createRequire(join(process.env.FATTAL_TEST_PLAYWRIGHT_ROOT, 'package.json')) : dependencies;
  const { chromium } = browserDeps('playwright');
  const browser = await chromium.launch({ headless: true, ...(process.env.FATTAL_TEST_CHROMIUM ? { executablePath: process.env.FATTAL_TEST_CHROMIUM } : {}),
    args: ['--disable-background-networking', '--disable-dev-shm-usage'],
    env: { PATH: nextEnv.PATH, TMPDIR: tmpdir() } });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // NextURL normalizes numeric loopback to localhost; use that browser Origin
  // so the actual same-origin guard remains unchanged. CLI sockets stay numeric.
  const browserOrigin = `http://localhost:${port}`;
  const externalRequests = [], consoleErrors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === browserOrigin) return route.continue();
    externalRequests.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => consoleErrors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  const labels = JSON.parse(await readFile(join(root, 'src/i18n/locales/en.json'), 'utf8')).contentIntake;
  await page.goto(browserOrigin, { waitUntil: 'networkidle' });
  assert.equal(page.url(), `${browserOrigin}/`); assert.equal(await page.title(), 'Isolated Fattal approval acceptance');
  await page.getByRole('heading', { name: labels.approvalTitle }).waitFor().catch(async error => {
    throw new Error(`${error.message}; browser errors: ${JSON.stringify(consoleErrors)}; page: ${await page.locator('body').innerText()}`);
  });
  await page.locator('#approval-writer').fill(writerId);
  await page.locator('#approval-file').setInputFiles({ name: 'synthetic-manifest.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(candidate)) });
  const previewResponse = page.waitForResponse(r => r.url() === `${browserOrigin}/api/content-intake/dot/approvals` && r.request().method() === 'POST');
  await page.getByRole('button', { name: labels.approvalPreview, exact: true }).click();
  const previewReply = await previewResponse;
  const preview = await previewReply.json(); assert.equal(previewReply.status(), 200, JSON.stringify(preview));
  assert.equal(preview.persisted, false);
  assert.equal(preview.manifest.review.reviewer, 'synthetic-admin'); assert.equal(preview.predecessor.sha256, sha256(oldBytes));
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: labels.approvalExport, exact: true }).click();
  const download = await downloaded;
  const manifestPath = join(f.directory, 'browser-export.json'); await download.saveAs(manifestPath);
  const reviewed = JSON.parse(await readFile(manifestPath, 'utf8')); assert.equal(manifestId(reviewed), preview.manifestId);
  await page.locator('section[aria-labelledby=manifest-approval-title]').getByRole('checkbox').check();
  const approveResponse = page.waitForResponse(r => r.url() === `${browserOrigin}/api/content-intake/dot/approvals` && r.request().method() === 'POST');
  await page.getByRole('button', { name: labels.approvalApprove, exact: true }).click();
  const approved = await (await approveResponse).json(); assert.equal(approved.state, 'approved');
  await page.getByRole('status').filter({ hasText: labels.approvalState_approved }).waitFor();
  assert.equal(f.counts.puts, 0, 'Approval UI must not upload');
  const artifacts = process.env.FATTAL_TEST_ARTIFACTS;
  if (artifacts) await page.screenshot({ path: join(artifacts, 'approval-desktop.png'), fullPage: true });
  const uploaded = await f.worker('upload', reviewed); assert.equal(uploaded.code, 0); assert.equal(uploaded.result.verified, true);
  await f.assertActivated(reviewed);
  const revokedResponse = page.waitForResponse(r => r.request().method() === 'DELETE');
  await page.getByRole('button', { name: labels.approvalRevoke, exact: true }).click();
  assert.equal((await (await revokedResponse).json()).state, 'revoked');
  await page.getByRole('status').filter({ hasText: labels.approvalState_revoked }).waitFor();
  const recovered = await f.worker('recover', reviewed, undefined, { writesEnabled: false });
  assert.equal(recovered.code, 0); assert.equal(recovered.result.verified, true);
  await page.setViewportSize({ width: 390, height: 844 });
  if (artifacts) await page.screenshot({ path: join(artifacts, 'approval-mobile-revoked.png'), fullPage: true });
  await page.goto(`${browserOrigin}/?locale=he`, { waitUntil: 'networkidle' });
  const he = JSON.parse(await readFile(join(root, 'src/i18n/locales/he.json'), 'utf8')).contentIntake;
  await page.getByRole('heading', { name: he.writerTitle }).waitFor();
  const writerPanel = page.locator('section[aria-labelledby=writer-grant-title]');
  await page.locator('#writer-target').selectOption(target.shortId);
  await writerPanel.getByRole('checkbox').check();
  const writerReply = page.waitForResponse(r => r.url().endsWith('/dot/write-grant') && r.request().method() === 'POST');
  await writerPanel.getByRole('button', { name: he.writerIssue, exact: true }).click();
  const writerResponse = await writerReply; assert.equal(writerResponse.status(), 201);
  const writerResult = await writerResponse.json();
  const writerRecord = (await db.doc(`fattalCloudConnections/${writerResult.connectionId}`).get()).data();
  assert.deepEqual(writerRecord.allowedTargets, [target.shortId]); assert.deepEqual(writerRecord.scopes, ['read', 'write']);
  assert.equal(writerRecord.writeMode, 'supervised'); assert.equal(writerRecord.expiresAt - writerRecord.ownerVerifiedAt, 900000);
  assert.match(writerRecord.keyHash, /^[a-f0-9]{64}$/);
  assert.equal(await page.evaluate(() => /tq_fc_/.test(document.documentElement.outerHTML + JSON.stringify(localStorage))), false);
  await writerPanel.getByRole('button', { name: he.writerCopy, exact: true }).waitFor();
  if (artifacts) await page.screenshot({ path: join(artifacts, 'writer-hebrew-active.png'), fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: he.writerTitle }).waitFor();
  assert.equal(await page.locator('#writer-attempt-id').inputValue(), writerResult.connectionId);
  assert.equal(await writerPanel.getByRole('button', { name: he.writerCopy, exact: true }).count(), 0);
  await writerPanel.getByRole('button', { name: he.writerInspect, exact: true }).click();
  await writerPanel.getByRole('status').filter({ hasText: he.writerState_active }).waitFor();
  await writerPanel.getByRole('button', { name: he.writerRevoke, exact: true }).click();
  await writerPanel.getByRole('status').filter({ hasText: he.writerState_revoked }).waitFor();
  assert.ok((await db.doc(`fattalCloudConnections/${writerResult.connectionId}`).get()).data().revokedAt);
  // A manually recovered missing attempt can be cancelled after page loss too.
  await page.locator('#writer-attempt-id').fill('f'.repeat(32));
  await writerPanel.getByRole('button', { name: he.writerRevoke, exact: true }).click();
  await writerPanel.getByRole('status').filter({ hasText: he.writerState_revoked }).waitFor();
  assert.equal((await db.doc(`fattalCloudConnections/${'f'.repeat(32)}`).get()).data().recordType, 'revocation_tombstone');
  assert.deepEqual(externalRequests, []); assert.deepEqual(consoleErrors, []);
  assert.equal(await page.locator('nextjs-portal [data-nextjs-dialog-overlay]').count(), 0, 'No framework error overlay');
  assert.equal(f.counts.puts, 1); assert.equal(f.counts.deleteAttempts, 0);
  t.diagnostic(JSON.stringify({ nextVersion: dependencies('next/package.json').version,
    actualNextRequestResponse: true, realServerAuthGuard: true, authMode: 'synthetic unsigned Firebase Auth emulator token',
    browserPlugin: 'absent; installed Playwright used', ui: ['preview', 'export', 'approve', 'revoke'],
    uploadVerified: true, recoveryAfterRevocation: true, externalBrowserRequests: 0, consoleErrors: 0,
    liveTLSOrProxyProven: false, realR2Proven: false }));
});
