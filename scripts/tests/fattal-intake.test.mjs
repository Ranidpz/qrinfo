import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadTs, stub } from './load-ts.mjs';
import { collectPdfFiles, previewBatch, commitWithPayloadFallback } from '../fattal-intake.mjs';

const { buildFattalPreview, FATTAL_BOOKLET_TARGETS } = await loadTs('../../src/lib/content-intake/fattal.ts');
const { selectBatchMatches } = await loadTs('../../src/lib/content-intake/batch-preview.ts');
const { collectBatchResults } = await loadTs('../../src/lib/content-intake/batch-results.ts');
const { buildCommitReply } = await loadTs('../../src/lib/content-intake/report.ts', {
  '@/lib/resend': stub('export const isResendConfigured=()=>false; export const sendEmail=()=>{throw Error("Must not send mail")};'),
});
const targets = FATTAL_BOOKLET_TARGETS.map((item) => ({
  codeId: item.key, shortId: item.shortId, title: item.title,
  aliases: item.aliases, ownerId: 'fattal-owner', currentMediaType: 'pdf',
  folderName: { eilat: 'פתאל אילת', 'dead-sea': 'פתאל ים המלח', tiberias: 'פתאל טבריה' }[item.area],
}));
const candidate = (name, id = name) => ({ name, id, size: 10, contentType: 'application/pdf' });
const preview = (files) => buildFattalPreview({ files, targets, receivedAt: '2026-09-20T10:00:00+03:00' });

test('same-hotel conflicting files remain blocked after transport splitting', () => {
  const files = [candidate('הרודס אילת 20.9.2026.pdf', 'one'), candidate('הרודס אילת 20.9.2026 תיקון.pdf', 'two')];
  const all = preview(files);
  assert.deepEqual(all.matches.map((m) => m.status), ['duplicate', 'duplicate']);
  assert.equal(selectBatchMatches(all, [files[0]]).matches[0].status, 'duplicate');
  assert.ok(all.missingTargets.some((m) => m.target.codeId === 'herods-eilat'));
});

test('stale filename requires review and does not count as received valid booklet', () => {
  const result = preview([candidate('הרודס אילת 31.5.2026.pdf')]);
  assert.equal(result.matches[0].status, 'needs_review');
  assert.ok(result.missingTargets.some((m) => m.target.codeId === 'herods-eilat'));
});

test('receipt date respects Israeli midnight', () => {
  const result = buildFattalPreview({ files: [candidate('הרודס אילת.pdf')], targets, receivedAt: '2026-09-19T22:30:00Z' });
  assert.equal(result.matches[0].detectedDate.value, '2026-09-20');
});

test('area-only filename never confidently identifies a hotel', () => {
  const result = buildFattalPreview({ files: [candidate('פתאל טבריה.pdf')], targets });
  assert.notEqual(result.matches[0].status, 'matched');
});

test('owner-confirmed unqualified hotel names use only the explicit Eilat targets', () => {
  const result = preview([
    candidate('הרודס אמצש 20.9.pdf'),
    candidate('תוכניית בידור אמצאש לאונרדו פלאזה 20.9.pdf'),
    candidate('תכניית בידור רויאל אמצש 22.9.pdf'),
  ]);
  assert.deepEqual(result.matches.map(m => [m.status, m.target?.shortId]), [
    ['matched', 'tnhKzx'], ['matched', 'FYvDZF'], ['matched', 'tDet2R'],
  ]);
});

test('explicit Dead Sea or Tiberias always prevents the Eilat default', () => {
  for (const name of ['הרודס ים המלח.pdf', 'לאונרדו פלאזה ים המלח.pdf', 'הרודס טבריה.pdf', 'רויאל טבריה.pdf', 'לאונרדו פלאזה טבריה.pdf']) {
    const match = preview([candidate(name)]).matches[0];
    assert.ok(match.status !== 'matched' || !['tnhKzx', 'FYvDZF', 'tDet2R'].includes(match.target?.shortId), name);
  }
  assert.equal(preview([candidate('הרודס ים המלח.pdf')]).matches[0].target?.shortId, 'N8bPqx');
  assert.equal(preview([candidate('לאונרדו פלאזה ים המלח.pdf')]).matches[0].target?.shortId, '7KRYAj');
});

test('a chunk cannot substitute file size, filename or an unknown ID', () => {
  const file = candidate('הרודס אילת.pdf', 'one');
  for (const changed of [{ ...file, size: 12 }, { ...file, name: 'other.pdf' }, { ...file, id: 'other' }]) {
    assert.throws(() => selectBatchMatches(preview([file]), [changed]));
  }
});

test('combined report retains successful update across duplicate retry and exposes unconfirmed files', () => {
  const all = preview([candidate('הרודס אילת.pdf', 'one'), candidate('יו קורל אילת.pdf', 'two')]);
  const result = { fileId: 'one', filename: 'הרודס אילת.pdf', codeId: 'herods-eilat', status: 'updated' };
  const merged = collectBatchResults(all, [{ ...result, status: 'skipped_duplicate' }, result]);
  assert.equal(merged[0].status, 'updated');
  assert.equal(merged[1].status, 'failed');
  assert.doesNotMatch(buildCommitReply(all, [{ ...result, status: 'failed' }]), /✅|תודה, עדכנתי/);
});

test('integration key cannot choose another owner when ID env is absent', async () => {
  const oldId = process.env.FATTAL_BOOKLETS_OWNER_ID;
  const oldEmail = process.env.FATTAL_BOOKLETS_OWNER_EMAIL;
  delete process.env.FATTAL_BOOKLETS_OWNER_ID;
  delete process.env.FATTAL_BOOKLETS_OWNER_EMAIL;
  try {
    const { resolveFattalOwnerId } = await loadTs('../../src/lib/content-intake/fattal-server.ts', {
      '@/lib/server-api-key': stub('export const hasValidServerApiKey=()=>false;'),
      './fattal': stub('export const FATTAL_DEFAULT_OWNER_EMAIL="playzonest1@gmail.com"; export const FATTAL_BOOKLET_TARGETS=[];'),
      '@/lib/firebase-admin': stub('export const getAdminDb=()=>({collection:()=>({where:()=>({limit:()=>({get:async()=>({empty:false,docs:[{id:"fattal-owner"}]})})})})});'),
    });
    assert.equal(await resolveFattalOwnerId({ integrationAuth: true, ownerId: 'other-owner' }), null);
    assert.equal(await resolveFattalOwnerId({ integrationAuth: true, ownerEmail: 'other@example.com' }), null);
    assert.equal(await resolveFattalOwnerId({ integrationAuth: true }), 'fattal-owner');
  } finally {
    if (oldId === undefined) delete process.env.FATTAL_BOOKLETS_OWNER_ID; else process.env.FATTAL_BOOKLETS_OWNER_ID = oldId;
    if (oldEmail === undefined) delete process.env.FATTAL_BOOKLETS_OWNER_EMAIL; else process.env.FATTAL_BOOKLETS_OWNER_EMAIL = oldEmail;
  }
});

test('413 fallback uploads only confident files and requests one server report', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fattal-test-'));
  const originalFetch = globalThis.fetch;
  try {
    for (const name of ['הרודס אילת.pdf', 'יו קורל אילת.pdf', 'יו קורל אילת תיקון.pdf']) await writeFile(path.join(dir, name), '%PDF-1.7\nfixture');
    const files = await collectPdfFiles(dir);
    let commits = 0; let reports = 0;
    globalThis.fetch = async (url, options) => {
      assert.equal(options.redirect, 'error');
      if (url.endsWith('/preview')) {
        const body = JSON.parse(options.body);
        const result = preview(body.files);
        return Response.json({ ...result, runId: 'parent-run', batchProtocolVersion: 1 });
      }
      if (url.endsWith('/commit')) {
        commits++;
        assert.equal(options.body.get('batchPreviewRunId'), 'parent-run');
        if (commits === 1) return Response.json({ error: 'too large' }, { status: 413 });
        assert.equal(options.body.getAll('files').length, 1);
        assert.equal(options.body.get('files').name, 'הרודס אילת.pdf');
        return Response.json({ results: [], reportEmail: { sent: false, deferred: true } });
      }
      if (url.endsWith('/report')) {
        reports++;
        return Response.json({ results: [], summary: {}, reportEmail: { sent: true } });
      }
      throw Error(`Unexpected URL: ${url}`);
    };
    await commitWithPayloadFallback({ files, baseUrl: 'https://example.test', apiKey: 'test-key', ownerEmail: 'playzonest1@gmail.com', receivedAt: '2026-09-20T07:00:00Z' });
    assert.equal(commits, 2);
    assert.equal(reports, 1);
  } finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
});

test('old API is rejected before any write request', async () => {
  const originalFetch = globalThis.fetch;
  const paths = [];
  try {
    globalThis.fetch = async (url) => { paths.push(url); return Response.json({ matches: [], runId: 'legacy' }); };
    await assert.rejects(commitWithPayloadFallback({ files: [], baseUrl: 'https://example.test', apiKey: 'test' }));
    assert.deepEqual(paths, ['https://example.test/api/content-intake/fattal/preview']);
  } finally { globalThis.fetch = originalFetch; }
});

test('preview mode requests no run writes', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).saveRun, false);
      return Response.json({ batchProtocolVersion: 1 });
    };
    await previewBatch({ files: [], baseUrl: 'https://example.test', apiKey: 'test' });
  } finally { globalThis.fetch = originalFetch; }
});

test('unapproved source URLs are rejected before fetch; streamed PDFs enforce size limit', async () => {
  const originalFetch = globalThis.fetch;
  const oldHosts = process.env.CONTENT_INTAKE_SOURCE_HOSTS;
  process.env.CONTENT_INTAKE_SOURCE_HOSTS = 'trusted.example.test';
  try {
    const { fetchPdfBuffer } = await loadTs('../../src/lib/content-intake/pdf-replacement.ts', {
      'firebase-admin/firestore': stub('export const FieldValue={}; export class Timestamp {}'),
      '@/lib/firebase-admin': stub('export const getAdminDb=()=>{throw Error("Unexpected DB access")};'),
      '@/lib/server-storage': stub('export const deleteStoredObjectByUrl=()=>{throw Error("Unexpected delete")};'),
      '@/lib/r2-storage': stub('export const buildStorageKey=()=>""; export const buildUniqueFilename=()=>""; export const R2_STORAGE_PROVIDER="cloudflare-r2"; export const uploadBufferToR2=()=>{throw Error("Unexpected upload")};'),
    });
    let fetched = 0;
    globalThis.fetch = async (_url, options) => {
      fetched++;
      assert.equal(options.redirect, 'error');
      let count = 0;
      return new Response(new ReadableStream({ pull(controller) {
        if (++count <= 26) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close();
      }}));
    };
    await assert.rejects(fetchPdfBuffer('http://127.0.0.1/private'));
    await assert.rejects(fetchPdfBuffer('https://evil.example.test/file.pdf'));
    await assert.rejects(fetchPdfBuffer('https://user:secret@trusted.example.test/file.pdf'));
    assert.equal(fetched, 0);
    await assert.rejects(fetchPdfBuffer('https://trusted.example.test/file.pdf'), /25MB/);
    assert.equal(fetched, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldHosts === undefined) delete process.env.CONTENT_INTAKE_SOURCE_HOSTS; else process.env.CONTENT_INTAKE_SOURCE_HOSTS = oldHosts;
  }
});

test('changing a PDF after preview prevents upload and finalization', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fattal-test-change-'));
  const originalFetch = globalThis.fetch;
  try {
    const filePath = path.join(dir, 'הרודס אילת.pdf');
    await writeFile(filePath, '%PDF-1.7\nfirst');
    const files = await collectPdfFiles(dir);
    let writes = 0;
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/preview')) {
        await writeFile(filePath, '%PDF-1.7\nother');
        return Response.json({ ...preview(JSON.parse(options.body).files), runId: 'parent', batchProtocolVersion: 1 });
      }
      writes++; throw Error('Unexpected write');
    };
    await assert.rejects(commitWithPayloadFallback({ files, baseUrl: 'https://example.test', apiKey: 'test' }), /השתנה/);
    assert.equal(writes, 0);
  } finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
});

test('batch audit locks active commits, closes after completion and sends one stable report', async () => {
  const records = new Map();
  let seq = 0; let mailCount = 0;
  const snapshot = (id) => ({ id, exists: records.has(id), data: () => records.get(id) });
  const ref = (id) => ({ id, async get() { return snapshot(id); }, async set(value) { records.set(id, value); } });
  const apply = (id, values) => {
    const old = records.get(id) || {};
    records.set(id, { ...old, ...Object.fromEntries(Object.entries(values).map(([key, value]) =>
      [key, value?.increment !== undefined ? (old[key] || 0) + value.increment : value])) });
  };
  const db = {
    collection: () => ({ doc: (id) => ref(id || `run-${++seq}`), where: (field, _op, value) => ({ field, value }) }),
    runTransaction: async (fn) => fn({
      get: async (target) => target.field
        ? { docs: [...records.keys()].filter((id) => records.get(id)[target.field] === target.value).map(snapshot) }
        : snapshot(target.id),
      set: (target, value) => apply(target.id, value), update: (target, value) => apply(target.id, value),
    }),
  };
  globalThis.fattalTestDb = db;
  const dbStub = stub('export const getAdminDb=()=>globalThis.fattalTestDb;');
  const firestoreStub = stub('export const FieldValue={serverTimestamp:()=>"timestamp",increment:(n)=>({increment:n})};');
  const runs = await loadTs('../../src/lib/content-intake/runs.ts', {
    '@/lib/firebase-admin': dbStub, 'firebase-admin/firestore': firestoreStub,
  });
  const file = candidate('הרודס אילת.pdf', 'one');
  const all = preview([file]);
  const parentId = await runs.createContentIntakeRun({ ownerId: 'fattal-owner', status: 'previewed', preview: all });
  const childId = await runs.createContentIntakeRun({ ownerId: 'fattal-owner', status: 'committing', preview: all, batchPreviewRunId: parentId });
  assert.equal(records.get(parentId).activeCommits, 1);
  const result = { fileId: 'one', filename: file.name, codeId: 'herods-eilat', status: 'updated' };
  globalThis.fattalTestFns = {
    collectBatchResults, updateContentIntakeRun: runs.updateContentIntakeRun,
    buildCommitReply,
    buildCommitSummary: (_p, results) => ({ updated: results.filter((r) => r.status === 'updated').length }),
    hasCommitIssues: () => true,
    sendFattalCommitReportEmail: async () => { mailCount++; return { sent: true }; },
  };
  const exportsStub = (names) => stub(names.map((name) => `export const ${name}=(...args)=>globalThis.fattalTestFns.${name}(...args);`).join('\n'));
  try {
    const route = await loadTs('../../src/app/api/content-intake/fattal/report/route.ts', {
      'next/server': stub('export const NextResponse=Response;'),
      'firebase-admin/firestore': firestoreStub,
      '@/lib/firebase-admin': dbStub,
      '@/lib/auth': stub('export const requireSuperAdmin=async()=>({response:new Response("unauthorized",{status:401})}); export const isAuthError=(v)=>!!v.response;'),
      '@/lib/server-api-key': stub('export const hasValidServerApiKey=(r)=>r.headers.get("x-content-intake-key")==="test";'),
      '@/lib/content-intake/fattal-server': stub('export const authenticateIntakeKey=(r)=>r.headers.get("x-content-intake-key")==="test"; export const resolveFattalOwnerId=async()=>"fattal-owner";'),
      '@/lib/content-intake/runs': stub('export const CONTENT_INTAKE_RUNS_COLLECTION="contentIntakeRuns"; export const updateContentIntakeRun=(...a)=>globalThis.fattalTestFns.updateContentIntakeRun(...a);'),
      '@/lib/content-intake/batch-results': exportsStub(['collectBatchResults']),
      '@/lib/content-intake/report': exportsStub(['buildCommitReply', 'buildCommitSummary', 'hasCommitIssues', 'sendFattalCommitReportEmail']),
    });
    const request = (id = parentId, key = 'test') => new Request('https://example.test/report', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-content-intake-key': key },
      body: JSON.stringify({ batchPreviewRunId: id }),
    });
    assert.equal((await route.POST(request(parentId, 'bad'))).status, 401);
    assert.equal((await route.POST(request())).status, 409);
    assert.equal(mailCount, 0);
    await runs.updateContentIntakeRun(childId, { status: 'completed', commitResults: [result] });
    await runs.updateContentIntakeRun(childId, { status: 'completed', commitResults: [result] });
    assert.equal(records.get(parentId).activeCommits, 0);
    assert.equal((await route.POST(request())).status, 200);
    assert.equal(mailCount, 1);
    assert.equal((await route.POST(request())).status, 200);
    assert.equal(mailCount, 1);
    await assert.rejects(runs.createContentIntakeRun({ ownerId: 'fattal-owner', status: 'committing', preview: all, batchPreviewRunId: parentId }), /closed/);
    const other = await runs.createContentIntakeRun({ ownerId: 'other-owner', status: 'previewed', preview: all });
    assert.equal((await route.POST(request(other))).status, 409);
    assert.equal(mailCount, 1);
  } finally { delete globalThis.fattalTestDb; delete globalThis.fattalTestFns; }
});

test('owner transfer or concurrent edit rolls back newly uploaded PDF', async () => {
  const state = { changedOwner: true, deleted: [], writes: 0 };
  globalThis.fattalPdfTest = state;
  const dbSource = `
    export const getAdminDb=()=>({
      collection:(collection)=>({doc:(id)=>({collection,id,get:async()=>({exists:true,data:()=>({ownerId:'original-owner'}),updateTime:{isEqual:()=>false}})})}),
      runTransaction:async(fn)=>fn({
        get:async(ref)=>ref.collection==='codes'
          ? {exists:true,data:()=>({ownerId:globalThis.fattalPdfTest.changedOwner?'new-owner':'original-owner'}),updateTime:{}}
          : {exists:true,data:()=>({})},
        update:()=>{globalThis.fattalPdfTest.writes++}
      })
    });`;
  try {
    const { replaceCodePdfWithBuffer } = await loadTs('../../src/lib/content-intake/pdf-replacement.ts', {
      'firebase-admin/firestore': stub('export const FieldValue={}; export class Timestamp {}'),
      '@/lib/firebase-admin': stub(dbSource),
      '@/lib/server-storage': stub('export const deleteStoredObjectByUrl=async(url)=>{globalThis.fattalPdfTest.deleted.push(url)};'),
      '@/lib/r2-storage': stub('export const buildStorageKey=()=>"key"; export const buildUniqueFilename=()=>"name.pdf"; export const R2_STORAGE_PROVIDER="cloudflare-r2"; export const uploadBufferToR2=async()=>({url:"https://storage.test/new.pdf",size:10});'),
      'pdfjs-dist/legacy/build/pdf.mjs': stub('export const getDocument=()=>({promise:Promise.resolve({numPages:1,destroy:async()=>{}})});'),
    });
    const input = { buffer: Buffer.from('%PDF-1.7\nfixture'), filename: 'file.pdf', contentType: 'application/pdf' };
    await assert.rejects(replaceCodePdfWithBuffer('code', input, { expectedOwnerId: 'original-owner' }), /owner/);
    state.changedOwner = false;
    await assert.rejects(replaceCodePdfWithBuffer('code', input, { expectedOwnerId: 'original-owner' }), /changed during upload/);
    assert.equal(state.writes, 0);
    assert.deepEqual(state.deleted, ['https://storage.test/new.pdf', 'https://storage.test/new.pdf']);
  } finally { delete globalThis.fattalPdfTest; }
});

test('per-computer key is hashed, revocable and cannot override its owner', async () => {
  const { createHash } = await import('node:crypto');
  const key = `tq_ci_${'a'.repeat(32)}.${'b'.repeat(64)}`;
  globalThis.__intakeKeyRecord = { ownerId: 'owner-a', ownerEmail: 'a@example.com', workflow: 'fattal-booklets', keyHash: createHash('sha256').update(key).digest('hex') };
  const { authenticateIntakeKey, resolveFattalOwnerId } = await loadTs('../../src/lib/content-intake/fattal-server.ts', {
    '@/lib/server-api-key': stub('export const hasValidServerApiKey=()=>false;'),
    './fattal': stub('export const FATTAL_DEFAULT_OWNER_EMAIL="legacy@example.com"; export const FATTAL_BOOKLET_TARGETS=[];'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>({collection:()=>({doc:()=>({get:async()=>({data:()=>globalThis.__intakeKeyRecord})})})});'),
  });
  const request = (value) => ({ headers: new Headers({ 'x-content-intake-key': value }) });
  const scope = await authenticateIntakeKey(request(key));
  assert.equal(await resolveFattalOwnerId({ integrationAuth: scope }), 'owner-a');
  assert.equal(await resolveFattalOwnerId({ integrationAuth: scope, ownerId: 'owner-b' }), null);
  assert.equal(await resolveFattalOwnerId({ integrationAuth: scope, ownerEmail: 'b@example.com' }), null);
  assert.equal(await authenticateIntakeKey(request(key.slice(0,-1)+'c')), false);
  globalThis.__intakeKeyRecord.revokedAt = new Date();
  assert.equal(await authenticateIntakeKey(request(key)), false);
  delete globalThis.__intakeKeyRecord;
});

test('connection management refuses non-admin access and returns a secret only at creation', async () => {
  const { createHash } = await import('node:crypto');
  const db = { collection(name) { return { doc(id) { return {
    get: async () => ({ data: () => name === 'users' ? { email: 'owner@example.com', role: globalThis.__connectionRole || 'producer' } : globalThis.__createdConnection }),
    create: async data => { globalThis.__createdConnection = data; },
    update: async data => { Object.assign(globalThis.__createdConnection, data); },
  }; } }; } };
  globalThis.__connectionDb = db;
  const { GET, POST, DELETE } = await loadTs('../../src/app/api/content-intake/connections/route.ts', {
    'next/server': stub('export const NextResponse={json:(value,init)=>new Response(JSON.stringify(value),init)};'),
    'firebase-admin/firestore': stub('export const FieldValue={serverTimestamp:()=>123};'),
    '@/lib/auth': stub('export const verifyAuthToken=async r=>r.headers.get("authorization")?{uid:"owner-a"}:{error:new Response("Unauthorized",{status:401})};'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__connectionDb;'),
    '@/lib/content-intake/fattal': stub('export const FATTAL_BOOKLET_TARGETS=[];'),
    '@/lib/content-intake/fattal-server': stub('export const loadMappedFattalTargets=async()=>[{codeId:"mapped"}];'),
  });
  const req = (body, auth = true) => new Request('https://example.com/api/content-intake/connections', { method:'POST', headers: auth ? {authorization:'Bearer fixture'} : {}, body:JSON.stringify(body) });
  assert.equal((await POST(req({ownerId:'owner-a',name:'Mac'},false))).status,401);
  assert.equal((await POST(req({ownerId:'owner-b',name:'Mac'}))).status,403);
  assert.equal((await POST(req({ownerId:'owner-a',name:'Mac'}))).status,403);
  assert.equal((await GET(req({}))).status,403);
  assert.equal((await DELETE(req({id:'a'.repeat(32)}))).status,403);
  globalThis.__connectionRole = 'super_admin';
  const response = await POST(req({ownerId:'owner-a',name:'Mac'}));
  assert.equal(response.status,200);
  const created = await response.json();
  assert.match(created.key,/^tq_ci_[a-f0-9]{32}\.[a-f0-9]{64}$/);
  assert.equal(globalThis.__createdConnection.keyHash,createHash('sha256').update(created.key).digest('hex'));
  assert.ok(!JSON.stringify(globalThis.__createdConnection).includes(created.key));
  globalThis.__createdConnection.ownerId='owner-b';
  globalThis.__connectionRole = 'free';
  assert.equal((await DELETE(req({id:created.id}))).status,403);
  globalThis.__connectionRole = 'super_admin';
  globalThis.__createdConnection.ownerId='owner-a';
  assert.equal((await DELETE(req({id:created.id}))).status,200);
  assert.equal(globalThis.__createdConnection.revokedAt,123);
  delete globalThis.__connectionDb; delete globalThis.__createdConnection; delete globalThis.__connectionRole;
});

test('report pairs the experience title with the exact filename and original Israel update time', async () => {
  const { buildFattalReportEmail, buildCommitSummary } = await loadTs('../../src/lib/content-intake/report.ts', {
    '@/lib/resend': stub('export const isResendConfigured=()=>false; export const sendEmail=()=>{throw Error("Must not send mail")};'),
  });
  const results = [
    { status: 'updated', title: 'חוויה <אילת>', filename: 'קובץ אחר & חדש.pdf', shortId: 'abc123', codeId: 'code-a', updatedAt: '2026-09-20T12:09:42.000Z', url: 'https://media.example.com/file.pdf' },
    { status: 'skipped_duplicate', title: 'ים המלח', filename: 'מקור.pdf', updatedAt: '2026-01-01T08:01:02.000Z' },
    { status: 'failed', title: 'טבריה', filename: 'לא עלה.pdf', url: 'javascript:alert(1)', error: 'Upload failed' },
  ];
  const all = preview([candidate('הרודס אילת.pdf')]);
  const report = buildFattalReportEmail({ runId: 'audit-run', preview: all, status: 'completed_with_issues', results, summary: buildCommitSummary(all, results), suggestedReplyAfterCommitHe: 'summary' });
  assert.match(report.text, /שם החוויה במערכת: חוויה <אילת>[\s\S]*שם הקובץ שהועלה: קובץ אחר & חדש.pdf/);
  assert.match(report.text, /מועד העדכון \(שעון ישראל\): 20\.09\.2026,? 15:09:42/);
  assert.match(report.text, /מועד העדכון המקורי \(שעון ישראל\): 01\.01\.2026,? 10:01:02/);
  assert.match(report.text, /שם הקובץ שהתקבל: לא עלה.pdf/);
  assert.match(report.text, /מזהה ריצה: audit-run/);
  assert.match(report.html, /חוויה &lt;אילת&gt;/);
  assert.match(report.html, /קובץ אחר &amp; חדש.pdf/);
  assert.match(report.html, /href="https:\/\/qr.playzones.app\/v\/abc123"/);
  assert.doesNotMatch(report.html, /javascript:|<אילת>/);
  const legacy = buildFattalReportEmail({runId:'old',preview:all,status:'completed',results:[{status:'updated',filename:'legacy.pdf'}],summary:buildCommitSummary(all,[]),suggestedReplyAfterCommitHe:''});
  assert.match(legacy.text, /מועד העדכון \(שעון ישראל\): לא תועד/);
});

test('file audit persists both names, hash and replacement time; duplicates preserve the recorded time', async () => {
  let record;
  globalThis.__auditDb = { collection: () => ({doc: () => ({ set: async data => { record=data; }, get: async () => ({exists:!!record,data:()=>record}) })}) };
  try {
    const { recordSuccessfulFileUpdate, getSuccessfulFileUpdate } = await loadTs('../../src/lib/content-intake/runs.ts', {
      '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__auditDb;'),
      'firebase-admin/firestore': stub('export const FieldValue={serverTimestamp:()=>({toDate:()=>new Date("2026-09-20T12:10:00Z")})};'),
    });
    await recordSuccessfulFileUpdate({dedupeId:'hash',runId:'run',ownerId:'owner',codeId:'code',shortId:'abc',filename:'uploaded.pdf',title:'Different experience name',replacedAt:'2026-09-20T12:09:42.000Z',fileHash:'sha256',url:'https://media.example.com/file.pdf',size:123});
    assert.equal(record.title,'Different experience name'); assert.equal(record.filename,'uploaded.pdf'); assert.equal(record.fileHash,'sha256');
    assert.equal((await getSuccessfulFileUpdate('hash')).updatedAt,'2026-09-20T12:09:42.000Z');
    delete record.replacedAt;
    assert.equal((await getSuccessfulFileUpdate('hash')).updatedAt,'2026-09-20T12:10:00.000Z');
    record.status='failed';assert.equal(await getSuccessfulFileUpdate('hash'),null);
  } finally { delete globalThis.__auditDb; }
});

test('replacement result uses the title and timestamp persisted in the successful code transaction', async () => {
  const time='2026-09-20T12:09:42.000Z';let written;
  globalThis.__replacementAuditDb = {
    collection:name=>({doc:id=>({name,id,get:async()=>({exists:true,data:()=>({ownerId:'owner',title:'Actual QR title'})})})}),
    runTransaction:async fn=>fn({get:async ref=>({exists:true,data:()=>ref.name==='codes'?{ownerId:'owner',title:'Actual QR title',media:[]}:{storageUsed:0,storageLimit:10000}}),update:(ref,value)=>{if(ref.name==='codes')written=value;}}),
  };
  try {
    const {replaceCodePdfWithBuffer}=await loadTs('../../src/lib/content-intake/pdf-replacement.ts',{
      'firebase-admin/firestore':stub(`export const FieldValue={serverTimestamp:()=>"server-time",increment:n=>n}; export class Timestamp {static now(){return new Timestamp()} toDate(){return new Date('${time}')}}`),
      '@/lib/firebase-admin':stub('export const getAdminDb=()=>globalThis.__replacementAuditDb;'),
      '@/lib/server-storage':stub('export const deleteStoredObjectByUrl=async()=>{};'),
      '@/lib/r2-storage':stub('export const buildStorageKey=()=>"key"; export const buildUniqueFilename=()=>"name.pdf"; export const R2_STORAGE_PROVIDER="cloudflare-r2"; export const uploadBufferToR2=async()=>({url:"https://storage.test/new.pdf",size:10,key:"key",bucket:"bucket",provider:"cloudflare-r2",contentType:"application/pdf"});'),
      'pdfjs-dist/legacy/build/pdf.mjs':stub('export const getDocument=()=>({promise:Promise.resolve({numPages:1,destroy:async()=>{}})});'),
    });
    const result=await replaceCodePdfWithBuffer('code',{buffer:Buffer.from('%PDF-1.7\nfixture'),filename:'Different file.pdf',contentType:'application/pdf'},{expectedOwnerId:'owner'});
    assert.equal(result.codeTitle,'Actual QR title');assert.equal(result.updatedAt,time);
    assert.equal(written.media[0].filename,'Different file.pdf');assert.equal(written.media[0].contentIntake.updatedAt.toDate().toISOString(),time);
  } finally {delete globalThis.__replacementAuditDb;}
});


test('the documented full hotel, area and full-date standard matches every explicit target', () => {
  for (const target of targets) {
    const match = preview([candidate(`${target.title} - 20.09.2026.pdf`)]).matches[0];
    assert.equal(match.status, 'matched', target.title);
    assert.equal(match.target.shortId, target.shortId, target.title);
  }
});
