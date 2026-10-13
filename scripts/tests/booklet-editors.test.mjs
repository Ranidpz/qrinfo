import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs, stub } from './load-ts.mjs';

// Booklet editors: access checks, replacement history + kept previous file, restore, and
// the PDF route's editor restrictions. In-memory Firestore fake; no network or credentials.

function createFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, structuredClone(v)]));
  let autoId = 0;
  const isInc = (v) => v && typeof v === 'object' && '__inc' in v;
  const setPath = (obj, dotted, value) => {
    const parts = dotted.split('.');
    let cur = obj;
    for (const p of parts.slice(0, -1)) cur = cur[p] ??= {};
    const last = parts.at(-1);
    cur[last] = isInc(value) ? Number(cur[last] || 0) + value.__inc : value;
  };
  const getPath = (obj, dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const snap = (path) => {
    const data = store.get(path);
    return { id: path.split('/').at(-1), exists: data !== undefined, ref: docRef(path), data: () => (data === undefined ? undefined : structuredClone(data)), updateTime: { isEqual: () => true } };
  };
  const write = (path, kind, data) => {
    if (kind === 'set') { store.set(path, structuredClone(data)); return; }
    const current = structuredClone(store.get(path) ?? {});
    for (const [k, v] of Object.entries(data)) setPath(current, k, v);
    store.set(path, current);
  };
  function query(collPath, filters = [], order = null, max = Infinity) {
    return {
      __query: true,
      where: (f, op, v) => query(collPath, [...filters, [f, v]], order, max),
      orderBy: (f, dir) => query(collPath, filters, [f, dir], max),
      limit: (n) => query(collPath, filters, order, n),
      async get() {
        let docs = [...store.keys()]
          .filter((p) => p.startsWith(`${collPath}/`) && !p.slice(collPath.length + 1).includes('/'))
          .map(snap)
          .filter((s) => filters.every(([f, v]) => getPath(s.data(), f) === v));
        if (order) docs.sort((a, b) => (getPath(a.data(), order[0])?.ms ?? 0) - (getPath(b.data(), order[0])?.ms ?? 0));
        if (order?.[1] === 'desc') docs.reverse();
        docs = docs.slice(0, max);
        return { docs, empty: docs.length === 0 };
      },
    };
  }
  function collRef(path) {
    return {
      ...query(path),
      doc: (id) => docRef(`${path}/${id ?? `auto${++autoId}`}`),
      add: async (data) => { const ref = docRef(`${path}/auto${++autoId}`); write(ref.path, 'set', data); return ref; },
    };
  }
  function docRef(path) {
    return {
      path,
      id: path.split('/').at(-1),
      collection: (name) => collRef(`${path}/${name}`),
      get: async () => snap(path),
      set: async (data) => write(path, 'set', data),
      update: async (data) => write(path, 'update', data),
    };
  }
  return {
    store,
    collection: (name) => collRef(name),
    getAll: async (...refs) => refs.map((r) => snap(r.path)),
    async runTransaction(fn) {
      const writes = [];
      const result = await fn({
        get: async (target) => (target.__query ? target.get() : snap(target.path)),
        set: (ref, data) => writes.push([ref.path, 'set', data]),
        update: (ref, data) => writes.push([ref.path, 'update', data]),
      });
      for (const w of writes) write(...w);
      return result;
    },
  };
}

let clock = 1000;
const FIRESTORE_STUB = stub(`
  export class Timestamp { constructor(ms){this.ms=ms} static now(){return new Timestamp(globalThis.__tick())} toDate(){return new Date(this.ms)} }
  export const FieldValue = { serverTimestamp: () => 'SERVER_TS', increment: (n) => ({ __inc: n }) };
`);
globalThis.__tick = () => ++clock;

async function loadReplacement() {
  globalThis.__deleted = [];
  globalThis.__uploads = 0;
  return loadTs('../../src/lib/content-intake/pdf-replacement.ts', {
    'firebase-admin/firestore': FIRESTORE_STUB,
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__db;'),
    '@/lib/server-storage': stub('export const deleteStoredObjectByUrl=async(url)=>{globalThis.__deleted.push(url)};'),
    '@/lib/r2-storage': stub('export const buildStorageKey=()=>"key"; export const buildUniqueFilename=(n)=>n; export const R2_STORAGE_PROVIDER="cloudflare-r2"; export const uploadBufferToR2=async({key})=>{globalThis.__onUpload?.(); const n=++globalThis.__uploads; return {url:`https://media.test/v${n}.pdf`,size:100*n,key:`k${n}`,bucket:"b",provider:"cloudflare-r2",contentType:"application/pdf"}};'),
    'pdfjs-dist/legacy/build/pdf.mjs': stub('export const getDocument=()=>({promise:Promise.resolve({numPages:3,destroy:async()=>{}})});'),
  });
}

async function loadHistory(replacement) {
  globalThis.__pr = replacement;
  return loadTs('../../src/lib/booklets/pdf-history.ts', {
    'firebase-admin/firestore': FIRESTORE_STUB,
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__db;'),
    '@/lib/content-intake/pdf-replacement': stub('export const PDF_HISTORY_COLLECTION="pdfHistory"; export const snapshotPdfMedia=(m)=>globalThis.__pr.snapshotPdfMedia(m);'),
  });
}

const pdf = (name) => ({ buffer: Buffer.from('%PDF-1.7\nfixture'), filename: name, contentType: 'application/pdf' });
const editor = { uid: 'editor-1', via: 'editor', email: 'ed@playzone.test', name: 'Editor' };

function seedBooklet() {
  return createFakeDb({
    'codes/c1': { ownerId: 'owner-1', title: 'Hotel', media: [{ id: 'm1', type: 'pdf', url: 'https://media.test/original.pdf', size: 50, uploadedBy: 'owner-1', filename: 'original.pdf' }] },
    'users/owner-1': { storageUsed: 50, storageLimit: 100000, email: 'owner@client.test' },
  });
}

test('access: owner, super admin and active editor only; revoke and non-booklets refuse', async () => {
  globalThis.__db = createFakeDb({
    'codes/c1': { ownerId: 'owner-1', collaborators: ['collab-1'], media: [{ id: 'm1', type: 'pdf' }] },
    'codes/c2': { ownerId: 'owner-1', media: [{ id: 'x', type: 'image' }] },
    'users/owner-1': { role: 'free' },
    'users/admin-1': { role: 'super_admin' },
    'users/editor-1': { role: 'free', email: 'ed@playzone.test' },
    'users/other-1': { role: 'producer' },
    'users/collab-1': { role: 'free' },
    'bookletEditors/c1__editor-1': { codeId: 'c1', uid: 'editor-1', ownerId: 'owner-1', revokedAt: null },
    'bookletEditors/c2__editor-1': { codeId: 'c2', uid: 'editor-1', ownerId: 'owner-1', revokedAt: null },
  });
  const { requireBookletAccess } = await loadTs('../../src/lib/booklets/access.ts', {
    'next/server': stub('export const NextResponse={json:(v,i)=>({status:i?.status??200,body:v})};'),
    '@/lib/auth': stub('export const verifyAuthToken=async(r)=>r.uid?{uid:r.uid}:{error:{status:401}};'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__db;'),
  });
  const as = (uid, codeId = 'c1') => requireBookletAccess({ uid }, codeId);
  assert.equal((await as('owner-1')).actor.via, 'owner');
  assert.equal((await as('admin-1')).actor.via, 'super_admin');
  const ed = await as('editor-1');
  assert.equal(ed.actor.via, 'editor');
  assert.equal(ed.actor.email, 'ed@playzone.test');
  assert.equal((await as('collab-1')).actor.via, 'collaborator', 'existing collaborators keep working');
  assert.equal((await as('other-1')).response.status, 403);
  assert.equal((await as(undefined)).response.status, 401);
  assert.equal((await as('editor-1', 'c2')).response.status, 403, 'grant on a code without a PDF is useless');
  assert.equal((await as('editor-1', 'missing')).response.status, 404);
  globalThis.__db.store.get('codes/c1').ownerId = 'new-owner';
  assert.equal((await as('editor-1')).response.status, 403, 'ownership transfer ends the grant');
  globalThis.__db.store.get('codes/c1').ownerId = 'owner-1';
  assert.equal((await as('editor-1')).actor.via, 'editor');
  globalThis.__db.store.get('users/editor-1').status = 'rejected';
  assert.equal((await as('editor-1')).response.status, 403, 'a rejected account loses booklet access');
  globalThis.__db.store.get('users/editor-1').status = 'approved';
  assert.equal((await as('editor-1')).actor.via, 'editor');
  globalThis.__db.store.get('bookletEditors/c1__editor-1').revokedAt = 'SERVER_TS';
  assert.equal((await as('editor-1')).response.status, 403, 'revoke is immediate');
});

test('replace with history keeps the previous file, records the actor, purges on the next replace', async () => {
  globalThis.__db = seedBooklet();
  const { replaceCodePdfWithBuffer } = await loadReplacement();
  const options = { expectedOwnerId: 'owner-1', history: { actor: editor }, existingPdfOnly: true, targetOnlyConflictCheck: true };

  const first = await replaceCodePdfWithBuffer('c1', { ...pdf('new.pdf'), mediaId: 'm1', source: 'booklet-editor' }, options);
  assert.equal(first.url, 'https://media.test/v1.pdf');
  assert.deepEqual(globalThis.__deleted, [], 'previous file is kept, not deleted');
  const code = globalThis.__db.store.get('codes/c1');
  assert.equal(code.media[0].uploadedBy, 'owner-1', 'storage stays billed to the owner');
  assert.equal(code.ownerId, 'owner-1', 'ownership untouched');
  assert.equal(globalThis.__db.store.get('users/owner-1').storageUsed, 100, 'delta = new - old');

  const events = [...globalThis.__db.store.entries()].filter(([p]) => p.startsWith('codes/c1/pdfHistory/'));
  assert.equal(events.length, 1);
  const [, ev1] = events[0];
  assert.equal(ev1.action, 'replace');
  assert.deepEqual(ev1.actor, editor);
  assert.equal(ev1.previous.url, 'https://media.test/original.pdf');
  assert.equal(ev1.previous.retained, true);
  assert.equal(ev1.next.url, 'https://media.test/v1.pdf');

  await replaceCodePdfWithBuffer('c1', { ...pdf('newer.pdf'), mediaId: 'm1' }, options);
  assert.deepEqual(globalThis.__deleted, ['https://media.test/original.pdf'], 'only the superseded kept file is deleted');
  assert.equal(globalThis.__db.store.get(events[0][0]).previous.retained, false);
});

test('editors cannot add media or overwrite a non-PDF item', async () => {
  globalThis.__db = createFakeDb({
    'codes/c1': { ownerId: 'owner-1', media: [{ id: 'img', type: 'image', url: 'https://media.test/a.jpg', size: 1 }] },
    'users/owner-1': { storageUsed: 0, storageLimit: 0 },
  });
  const { replaceCodePdfWithBuffer } = await loadReplacement();
  const options = { expectedOwnerId: 'owner-1', history: { actor: editor }, existingPdfOnly: true, targetOnlyConflictCheck: true };
  await assert.rejects(replaceCodePdfWithBuffer('c1', { ...pdf('x.pdf'), mediaId: 'img', replaceNonPdf: true }, options), /not a PDF/);
  await assert.rejects(replaceCodePdfWithBuffer('c1', { ...pdf('x.pdf'), mediaId: 'nope' }, options), /not found/);
  assert.equal(globalThis.__db.store.get('codes/c1').media.length, 1);
  assert.equal(globalThis.__deleted.length, 2, 'uploaded objects are cleaned after a refused transaction');
});

test('restore puts the kept file back, keeps the displaced one, and refuses stale versions', async () => {
  globalThis.__db = seedBooklet();
  const replacement = await loadReplacement();
  const { restorePdfVersion, listPdfHistory } = await loadHistory(replacement);
  const options = { expectedOwnerId: 'owner-1', history: { actor: editor }, existingPdfOnly: true, targetOnlyConflictCheck: true };
  await replacement.replaceCodePdfWithBuffer('c1', { ...pdf('new.pdf'), mediaId: 'm1' }, options);

  let history = await listPdfHistory('c1');
  assert.equal(history.length, 1);
  assert.equal(history[0].canRestore, true);
  assert.equal(history[0].actor.name, 'Editor');

  await restorePdfVersion('c1', history[0].id, editor);
  const media = globalThis.__db.store.get('codes/c1').media[0];
  assert.equal(media.url, 'https://media.test/original.pdf');
  assert.equal(media.filename, 'original.pdf');
  assert.equal(globalThis.__db.store.get('users/owner-1').storageUsed, 50, 'storage back to the original size');
  assert.deepEqual(globalThis.__deleted, [], 'restore deletes nothing');

  history = await listPdfHistory('c1');
  const restoreEntry = history.find((e) => e.action === 'restore');
  const replaceEntry = history.find((e) => e.action === 'replace');
  assert.equal(replaceEntry.canRestore, false);
  assert.equal(restoreEntry.canRestore, true, 'a restore can itself be undone');
  await assert.rejects(restorePdfVersion('c1', replaceEntry.id, editor), /not_restorable/);

  // The booklet changed after the restore entry → its undo is refused.
  globalThis.__db.store.get('codes/c1').media[0].url = 'https://media.test/elsewhere.pdf';
  await assert.rejects(restorePdfVersion('c1', restoreEntry.id, editor), /conflict/);
});

test('PDF route: editors upload only over an existing item, with forced source and no title', async () => {
  globalThis.__routeCalls = [];
  globalThis.__db = createFakeDb({ 'codes/c1': { ownerId: 'owner-1', shortId: 'abc', media: [{ id: 'm1', type: 'pdf' }] } });
  globalThis.__access = { actor: editor, ownerId: 'owner-1' };
  const { POST } = await loadTs('../../src/app/api/codes/[codeId]/pdf/route.ts', {
    'next/server': stub('export const NextResponse={json:(v,i)=>new Response(JSON.stringify(v),{status:i?.status??200})};'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__db;'),
    '@/lib/content-intake/fattal-server': stub('export const authenticateIntakeKey=async()=>false; export const getFattalTargetConfig=()=>null; export const resolveFattalOwnerId=async()=>null;'),
    '@/lib/content-intake/pdf-replacement': stub('export const fetchPdfBuffer=async()=>{throw Error("no fetch")}; export const replaceCodePdfWithBuffer=async(codeId,input,options)=>{globalThis.__routeCalls.push({codeId,input,options}); return {url:"u"}};'),
    '@/lib/booklets/access': stub('export const requireBookletAccess=async()=>globalThis.__access;'),
    '@/lib/rateLimit': stub('export const checkRateLimit=()=>({success:true}); export const RATE_LIMITS={UPLOAD:{}};'),
  });
  const params = { params: Promise.resolve({ codeId: 'c1' }) };
  const json = new Request('https://x.test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceUrl: 'https://media.test/a.pdf' }) });
  assert.equal((await POST(json, params)).status, 400);

  const form = (withMedia) => {
    const fd = new FormData();
    fd.append('file', new File([Buffer.from('%PDF-1.7')], 'new.pdf', { type: 'application/pdf' }));
    if (withMedia) fd.append('mediaId', 'm1');
    fd.append('title', 'Hacked title');
    fd.append('source', 'fattal');
    fd.append('replaceNonPdf', 'true');
    fd.append('deleteOld', 'false');
    return new Request('https://x.test', { method: 'POST', body: fd });
  };
  assert.equal((await POST(form(false), params)).status, 400, 'mediaId required');
  assert.equal((await POST(form(true), params)).status, 200);
  const call = globalThis.__routeCalls.at(-1);
  assert.equal(call.input.title, undefined);
  assert.equal(call.input.source, 'booklet-editor');
  assert.equal(call.input.replaceNonPdf, undefined);
  assert.equal(call.input.deleteOld, true);
  assert.equal(call.options.existingPdfOnly, true);
  assert.deepEqual(call.options.history.actor, editor);

  globalThis.__access = { response: new Response('{}', { status: 403 }) };
  assert.equal((await POST(form(true), params)).status, 403);
  assert.equal(globalThis.__routeCalls.length, 1);
});

test('a stale save that puts the kept file back live never lets the next replace delete it', async () => {
  globalThis.__db = seedBooklet();
  const replacement = await loadReplacement();
  const { listPdfHistory, restorePdfVersion } = await loadHistory(replacement);
  const options = { expectedOwnerId: 'owner-1', history: { actor: editor }, existingPdfOnly: true, targetOnlyConflictCheck: true };
  await replacement.replaceCodePdfWithBuffer('c1', { ...pdf('c.pdf'), mediaId: 'm1' }, options); // original → v1, original kept
  // Owner's stale code page writes the old media array back: original is live again.
  globalThis.__db.store.get('codes/c1').media[0].url = 'https://media.test/original.pdf';
  await replacement.replaceCodePdfWithBuffer('c1', { ...pdf('d.pdf'), mediaId: 'm1' }, options); // original → v2
  assert.ok(!globalThis.__deleted.includes('https://media.test/original.pdf'), 'the file now kept for restore survives');
  const latest = (await listPdfHistory('c1'))[0];
  assert.equal(latest.canRestore, true);
  await restorePdfVersion('c1', latest.id, editor);
  assert.equal(globalThis.__db.store.get('codes/c1').media[0].url, 'https://media.test/original.pdf');
});

test('a non-PDF previous file is deleted, never offered for restore; editors see no emails', async () => {
  globalThis.__db = createFakeDb({
    'codes/c1': { ownerId: 'owner-1', media: [{ id: 'm1', type: 'image', url: 'https://media.test/a.jpg', size: 5, uploadedBy: 'owner-1' }] },
    'users/owner-1': { storageUsed: 5, storageLimit: 0 },
  });
  const replacement = await loadReplacement();
  const { listPdfHistory, restorePdfVersion } = await loadHistory(replacement);
  const owner = { uid: 'owner-1', via: 'owner', email: 'owner@client.test', name: 'Owner' };
  await replacement.replaceCodePdfWithBuffer('c1', { ...pdf('x.pdf'), mediaId: 'm1', replaceNonPdf: true }, { expectedOwnerId: 'owner-1', history: { actor: owner }, targetOnlyConflictCheck: true });
  assert.deepEqual(globalThis.__deleted, ['https://media.test/a.jpg']);
  const [entry] = await listPdfHistory('c1', { redactEmails: true });
  assert.equal(entry.canRestore, false);
  assert.equal(entry.actor.email, undefined);
  assert.equal(entry.actor.name, 'Owner');
  await assert.rejects(restorePdfVersion('c1', entry.id, editor), /not_restorable/);
});

test('double submit of the same file and a concurrent replacement are both refused', async () => {
  globalThis.__db = seedBooklet();
  const { replaceCodePdfWithBuffer } = await loadReplacement();
  const options = { expectedOwnerId: 'owner-1', history: { actor: editor }, existingPdfOnly: true, targetOnlyConflictCheck: true, rejectDuplicate: true };
  const same = { buffer: Buffer.from('%PDF-1.7\nsame bytes'), filename: 'a.pdf', contentType: 'application/pdf', mediaId: 'm1' };
  await replaceCodePdfWithBuffer('c1', same, options);
  await assert.rejects(replaceCodePdfWithBuffer('c1', { ...same, filename: 'a (1).pdf' }, options), /Duplicate PDF/);
  assert.ok(!globalThis.__deleted.includes('https://media.test/original.pdf'), 'restore point to the real previous file survives');
  assert.ok(globalThis.__deleted.includes('https://media.test/v2.pdf'), 'the refused upload is cleaned up');

  // Another user's replacement lands while this upload is in flight.
  globalThis.__onUpload = () => { globalThis.__db.store.get('codes/c1').media[0].url = 'https://media.test/other.pdf'; };
  try {
    await assert.rejects(replaceCodePdfWithBuffer('c1', { ...pdf('late.pdf'), mediaId: 'm1' }, options), /changed during upload/);
  } finally { delete globalThis.__onUpload; }
  assert.equal(globalThis.__db.store.get('codes/c1').media[0].url, 'https://media.test/other.pdf');
});

test('admin bulk grant: one email, many booklets — owner / non-booklet skipped, repeat is idempotent', async () => {
  globalThis.__db = createFakeDb({
    'codes/b1': { ownerId: 'fattal', shortId: 's1', title: 'B1', media: [{ id: 'm', type: 'pdf' }] },
    'codes/b2': { ownerId: 'fattal', shortId: 's2', title: 'B2', media: [{ id: 'm', type: 'pdf' }] },
    'codes/own': { ownerId: 'geva', shortId: 's3', title: 'Own', media: [{ id: 'm', type: 'pdf' }] },
    'codes/img': { ownerId: 'fattal', shortId: 's4', title: 'Img', media: [{ id: 'm', type: 'image' }] },
    'users/geva': { email: 'geva@e.playzones.app', displayName: 'Geva', role: 'free' },
    'users/boss': { email: 'boss@x.test', role: 'super_admin' },
    'users/fattal': { email: 'owner@fattal.test' },
  });
  globalThis.__audit = [];
  const { GET, POST } = await loadTs('../../src/app/api/admin/booklet-editors/route.ts', {
    'next/server': stub('export const NextResponse={json:(v,i)=>new Response(JSON.stringify(v),{status:i?.status??200})};'),
    'firebase-admin/firestore': FIRESTORE_STUB,
    '@/lib/auth': stub('export const requireSuperAdmin=async(r)=>r.headers.get("x-uid")==="boss"?{uid:"boss"}:{response:new Response("{}",{status:403})}; export const isAuthError=(r)=>"response" in r;'),
    '@/lib/firebase-admin': stub('export const getAdminDb=()=>globalThis.__db;'),
    '@/lib/booklets/access': stub('export const BOOKLET_EDITORS_COLLECTION="bookletEditors"; export const bookletGrantId=(c,u)=>`${c}__${u}`; export const hasPdfMedia=(m)=>Array.isArray(m)&&m.some(i=>i?.type==="pdf");'),
    '@/lib/booklets/pdf-history': stub('export const recordAccessChange=async(...a)=>{globalThis.__audit.push(a)};'),
  });
  globalThis.__db.collection = ((orig) => (name) => ({ ...orig(name), select: () => orig(name) }))(globalThis.__db.collection);
  const req = (method, body, uid = 'boss', url = 'https://x.test/api/admin/booklet-editors') => {
    const r = new Request(url, { method, headers: { 'x-uid': uid, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    r.nextUrl = new URL(url);
    return r;
  };
  const grant = (codeIds, email = 'geva@e.playzones.app', uid) => POST(req('POST', { codeIds, email }, uid));

  assert.equal((await grant(['b1'], undefined, 'geva')).status, 403, 'super admin only');
  assert.equal((await grant(['b1', '../x'])).status, 400);
  assert.equal((await grant(['b1'], 'boss@x.test')).status, 400, 'no grants to super admins');
  assert.equal((await grant(['b1'], 'nobody@x.test')).status, 404);
  globalThis.__db.store.set('users/new', { email: 'new@x.test', status: 'pending' });
  assert.equal((await (await grant(['b1'], 'new@x.test')).json()).error, 'not_approved');

  const res = await (await grant(['b1', 'b2', 'own', 'img', 'gone'])).json();
  assert.deepEqual(Object.fromEntries(res.results.map((r) => [r.codeId, r.status])),
    { b1: 'granted', b2: 'granted', own: 'owner', img: 'not_a_booklet', gone: 'not_found' });
  assert.equal(globalThis.__db.store.get('bookletEditors/b1__geva').ownerId, 'fattal');
  assert.equal(globalThis.__audit.length, 2, 'one audit line per real grant');

  const again = await (await grant(['b1', 'b2'])).json();
  assert.deepEqual(again.results.map((r) => r.status), ['already', 'already']);
  assert.equal(globalThis.__audit.length, 2);

  const list = await (await GET(req('GET'))).json();
  const b1 = list.booklets.find((b) => b.codeId === 'b1');
  assert.equal(b1.ownerEmail, 'owner@fattal.test');
  assert.deepEqual(b1.editors.map((e) => e.email), ['geva@e.playzones.app']);
  assert.ok(!list.booklets.some((b) => b.codeId === 'img'), 'only codes with a PDF are listed');
});
