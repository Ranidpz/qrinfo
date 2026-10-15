// Social Wall end-to-end: the real /api/socialwall/* routes on a local Next dev server, backed by the
// Firestore + RTDB emulators and a fake Vercel Blob store (scripts/tests/socialwall-fake-blob.mjs).
// Never touches a real project: every endpoint is 127.0.0.1 and the project id is demo-preview.
//
//   1. firebase emulators:start --only firestore,database --project demo-preview
//      (firestore on 8088, database on 9000)
//   2. node scripts/tests/socialwall-fake-blob.mjs
//   3. NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-preview \
//      NEXT_PUBLIC_FIREBASE_DATABASE_URL='http://127.0.0.1:9000/?ns=demo-preview-default-rtdb' \
//      FIRESTORE_EMULATOR_HOST=127.0.0.1:8088 FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 \
//      BLOB_READ_WRITE_TOKEN=vercel_blob_rw_teststore_fake VERCEL_BLOB_API_URL=http://127.0.0.1:4555 \
//      (+ any NEXT_PUBLIC_FIREBASE_* placeholders) npx next dev -p 3124
//   4. node scripts/tests/socialwall.e2e.mjs        (about 40s: it waits out the 8s posting gap)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');
const sharp = require('sharp');

const app = initializeApp({ projectId: 'demo-preview', databaseURL: 'http://127.0.0.1:9000/?ns=demo-preview-default-rtdb' }, 'test');
const db = getFirestore(app);
const rtdb = getDatabase(app);
const BASE = process.env.SW_E2E_BASE || 'http://localhost:3124';
const MOD = 'f'.repeat(32);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (name) => { passed++; console.log('  ✓', name); };

async function api(path, { method = 'GET', session, mod, body, form } = {}) {
  const headers = {};
  if (session) headers['x-sw-session'] = session;
  if (mod) headers['x-sw-mod'] = mod;
  let payload;
  if (form) payload = form;
  else if (body) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function seed(codeId, config) {
  await db.doc('users/owner1').set({ role: 'super_admin', storageUsed: 0, storageLimit: 0 });
  await db.doc(`codes/${codeId}`).set({
    ownerId: 'owner1', shortId: codeId.slice(0, 8), title: 'Test event',
    media: [{ id: 'm1', type: 'socialwall', url: '', socialWallConfig: config }],
  });
  await db.doc(`codes/${codeId}/private/secrets`).set({ media: { m1: { socialWallModeratorToken: MOD } } });
}

async function photo(withGps = true) {
  let img = sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg();
  if (withGps) img = img.withMetadata({ orientation: 6 }).withExifMerge({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '32/1 4/1 0/1' } });
  return img.toBuffer();
}

async function upload(codeId, session, { postId = crypto.randomUUID(), caption = '', buf } = {}) {
  const form = new FormData();
  form.append('codeId', codeId);
  form.append('postId', postId);
  form.append('caption', caption);
  form.append('file', new Blob([buf || (await photo())], { type: 'image/jpeg' }), 'p.jpg');
  return { postId, ...(await api('/api/socialwall/posts', { method: 'POST', session, form })) };
}

const blobCount = async () => Number(await (await fetch('http://127.0.0.1:4555/__count')).text());

// Start clean: wipe the emulators (refuses anything that is not the local emulator)
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8088');
await fetch('http://127.0.0.1:8088/emulator/v1/projects/demo-preview/databases/(default)/documents', { method: 'DELETE' });
await rtdb.ref('/').remove();

// ---------------------------------------------------------------- A: open access
console.log('A. open access');
const A = 'codeOpenAccess01';
await seed(A, { access: 'open', groups: [{ id: 'hr', label: 'HR' }, { id: 'rnd', label: 'R&D' }], maxPostsPerMember: 3, captionMax: 50 });

let r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: A, action: 'open', name: 'x', groupId: 'hr' } });
assert.equal(r.data.errorCode, 'INVALID_NAME'); ok('short name refused');
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: A, action: 'open', name: 'דני כהן', groupId: 'nope' } });
assert.equal(r.data.errorCode, 'INVALID_GROUP'); ok('unknown group refused');
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: A, action: 'phone', phone: '0501234567' } });
assert.equal(r.data.errorCode, 'WRONG_ACCESS'); ok('phone action refused in open mode');

const a = await api('/api/socialwall/join', { method: 'POST', body: { codeId: A, action: 'open', name: '  דני‮ כהן ', groupId: 'rnd' } });
assert.equal(a.status, 200); assert.equal(a.data.name, 'דני כהן'); assert.equal(a.data.needsProfile, false); ok('member A joined, name cleaned');
const b = await api('/api/socialwall/join', { method: 'POST', body: { codeId: A, action: 'open', name: 'שירה לוי', groupId: 'hr' } });
const SA = a.data.session, SB = b.data.session;

r = await api(`/api/socialwall/feed?codeId=${A}`);
assert.equal(r.status, 401); ok('feed without session = 401');
r = await api(`/api/socialwall/feed?codeId=${A}`, { session: SA.split('.')[0] + '.' + 'c'.repeat(48) });
assert.equal(r.status, 401); ok('forged token = 401');
r = await api(`/api/socialwall/me?codeId=${A}`, { session: SA });
assert.equal(r.data.postsLeft, 3); ok('me: 3 posts left');

const before = await blobCount();
const p1 = await upload(A, SA, { caption: 'יום מדהים!‮\u0007 😍' });
assert.equal(p1.status, 200, JSON.stringify(p1.data));
assert.equal(p1.data.post.caption, 'יום מדהים! 😍');
assert.equal(p1.data.post.width, 1067); assert.equal(p1.data.post.height, 1600); // EXIF orientation applied, 1600 edge
assert.equal(await blobCount(), before + 2); ok('upload: caption cleaned, rotated, 2 files stored');

const stored = Buffer.from(await (await fetch(p1.data.post.fullUrl)).arrayBuffer());
const meta = await sharp(stored).metadata();
assert.equal(meta.format, 'webp'); assert.equal(meta.exif, undefined); ok('stored file is webp with NO exif/GPS');

const retry = await upload(A, SA, { postId: p1.postId });
assert.equal(retry.status, 200); assert.equal(retry.data.post.id, p1.postId);
assert.equal(await blobCount(), before + 2); ok('retry with same postId = same post, no extra files');

const fast = await upload(A, SA);
assert.equal(fast.status, 429); assert.equal(fast.data.errorCode, 'TOO_FAST'); assert.ok(fast.data.retryAfterMs > 0);
assert.equal(await blobCount(), before + 2); ok('second post within 8s refused BEFORE any upload');

const steal = await upload(A, SB, { postId: p1.postId });
assert.equal(steal.status, 409); ok("another member cannot reuse someone's postId");

r = await api(`/api/socialwall/feed?codeId=${A}`, { session: SB });
assert.equal(r.data.posts.length, 1); assert.equal(r.data.posts[0].likedByMe, false); assert.equal(r.data.posts[0].mine, undefined);
const t0 = r.data.serverTime; ok('member B sees the post');
r = await api(`/api/socialwall/feed?codeId=${A}&group=rnd`, { session: SB });
assert.equal(r.data.posts.length, 1);
r = await api(`/api/socialwall/feed?codeId=${A}&group=hr`, { session: SB });
assert.equal(r.data.posts.length, 0); ok('department filter (index-free gfeed field)');

for (const on of [true, true]) {
  r = await api('/api/socialwall/like', { method: 'POST', session: SB, body: { codeId: A, postId: p1.postId, on } });
  assert.equal(r.data.likeCount, 1);
}
ok('double like counts once');
r = await api('/api/socialwall/like', { method: 'POST', session: SB, body: { codeId: A, postId: p1.postId, on: false } });
assert.equal(r.data.likeCount, 0);
r = await api('/api/socialwall/like', { method: 'POST', session: SB, body: { codeId: A, postId: p1.postId, on: true } });
assert.equal(r.data.likeCount, 1); ok('unlike/like round trip');

// parallel likes from 12 members on one post
const crowd = await Promise.all(Array.from({ length: 12 }, (_, i) => api('/api/socialwall/join', { method: 'POST', body: { codeId: A, action: 'open', name: `משתתף ${i}`, groupId: 'hr' } })));
await Promise.all(crowd.map((c) => api('/api/socialwall/like', { method: 'POST', session: c.data.session, body: { codeId: A, postId: p1.postId, on: true } })));
const postDoc = (await db.doc(`codes/${A}/swPosts/${p1.postId}`).get()).data();
assert.equal(postDoc.likeCount, 13); ok('13 concurrent likes = 13 (no lost updates)');
r = await api(`/api/socialwall/stats?codeId=${A}`, { session: SB });
assert.deepEqual(r.data.groups.find((g) => g.id === 'rnd'), { id: 'rnd', posts: 1, likes: 13 });
assert.deepEqual(r.data.groups.find((g) => g.id === 'hr'), { id: 'hr', posts: 0, likes: 0 });
r = await api(`/api/socialwall/stats?codeId=${A}`);
assert.equal(r.status, 401); ok('department stats: members only, photos + likes per department');

r = await api(`/api/socialwall/feed?codeId=${A}&since=${t0}`, { session: SB });
assert.equal(r.data.posts[0].likeCount, 13); assert.equal(r.data.posts[0].likedByMe, true); ok('delta carries new like count + likedByMe');
const t1 = r.data.serverTime;

r = await api('/api/socialwall/moderate', { method: 'POST', mod: 'a'.repeat(32), body: { codeId: A, action: 'hide', postId: p1.postId } });
assert.equal(r.status, 401); ok('wrong staff token = 401');
r = await api(`/api/socialwall/moderate?codeId=${A}`);
assert.equal(r.status, 401); ok('moderation without credentials = 401');
r = await api('/api/socialwall/moderate', { method: 'POST', mod: MOD, body: { codeId: A, action: 'hide', postId: p1.postId } });
assert.equal(r.status, 200);
r = await api(`/api/socialwall/feed?codeId=${A}&since=${t1}`, { session: SB });
assert.deepEqual(r.data.posts.map((p) => [p.id, p.removed]), [[p1.postId, true]]); ok('hide reaches other phones as {removed}');
r = await api(`/api/socialwall/feed?codeId=${A}`, { session: SB });
assert.equal(r.data.posts.length, 0); ok('hidden post gone from the feed');
r = await api('/api/socialwall/like', { method: 'POST', session: SB, body: { codeId: A, postId: p1.postId, on: false } });
assert.equal(r.status, 404); ok('cannot like a hidden post');

const rev = (await rtdb.ref(`socialwall/${A}/rev`).once('value')).val();
assert.ok(rev >= 2); ok(`RTDB pulse ticked (rev=${rev})`);

// own delete -> tombstone + files freed
await sleep(8200);
const p2 = await upload(A, SA);
assert.equal(p2.status, 200);
const files = await blobCount();
r = await api(`/api/socialwall/feed?codeId=${A}`, { session: SB });
const t2 = r.data.serverTime;
r = await api('/api/socialwall/posts', { method: 'DELETE', session: SB, body: { codeId: A, postId: p2.postId } });
assert.equal(r.status, 403); ok("cannot delete someone else's post");
r = await api('/api/socialwall/posts', { method: 'DELETE', session: SA, body: { codeId: A, postId: p2.postId } });
assert.equal(r.status, 200); assert.equal(await blobCount(), files - 2); ok('own delete removes both files');
r = await api(`/api/socialwall/feed?codeId=${A}&since=${t2}`, { session: SB });
assert.ok(r.data.posts.some((p) => p.id === p2.postId && p.removed)); ok('delete reaches other phones (tombstone)');
const re = await upload(A, SA, { postId: p2.postId });
assert.equal(re.status, 409); ok('deleted post id cannot be reused');

// post limit (3): p1, p2 used 2 -> one more allowed then POST_LIMIT
await sleep(8200);
assert.equal((await upload(A, SA)).status, 200);
await sleep(8200);
const lim = await upload(A, SA);
assert.equal(lim.data.errorCode, 'POST_LIMIT'); ok('post limit enforced (deletes do not refund)');

// uploads closed
await api('/api/socialwall/control', { method: 'POST', mod: MOD, body: { codeId: A, uploads: false } });
const closed = await upload(A, SB);
assert.equal(closed.data.errorCode, 'UPLOADS_CLOSED'); ok('uploads switch closes posting');
await api('/api/socialwall/control', { method: 'POST', mod: MOD, body: { codeId: A, uploads: true } });

// block A
r = await api('/api/socialwall/moderate', { method: 'POST', mod: MOD, body: { codeId: A, action: 'block', memberId: SA.split('.')[0] } });
assert.equal(r.status, 200);
r = await api(`/api/socialwall/me?codeId=${A}`, { session: SA });
assert.equal(r.status, 401); ok('blocked member is signed out (sessions revoked)');
r = await api(`/api/socialwall/feed?codeId=${A}`, { session: SB });
assert.ok(r.data.posts.every((p) => p.authorName !== 'דני כהן')); ok("blocked member's posts hidden");

r = await api(`/api/socialwall/members?codeId=${A}`, { mod: MOD });
assert.ok(r.data.members.length >= 14); ok('staff members list');

r = await api(`/api/socialwall/moderate?codeId=${A}&audit=1`, { mod: MOD });
assert.ok(r.data.entries.some((e) => e.action === 'member:block' && e.actor === 'mod-link')); ok('audit log records staff actions');

// ---------------------------------------------------------------- B: allowlist
console.log('B. allowlist access');
const B = 'codeAllowlist001';
await seed(B, { access: 'allowlist', groups: [{ id: 'hr', label: 'HR' }] });
await db.doc(`codes/${B}/swAllowlist/972501234567`).set({ phone: '+972501234567', name: 'דנה מה-HR', groupId: 'hr' });
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: B, action: 'phone', phone: '052-9999999', name: 'מישהו' } });
assert.equal(r.data.errorCode, 'NOT_ON_LIST'); ok('phone not on the list refused');
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: B, action: 'phone', phone: '050-1234567', name: 'שם מזויף' } });
assert.equal(r.status, 200); assert.equal(r.data.name, 'דנה מה-HR'); assert.equal(r.data.groupId, 'hr'); ok('on the list: HR name/group win');
const SL = r.data.session;
r = await api('/api/socialwall/me', { method: 'POST', session: SL, body: { codeId: B, name: 'שם אחר' } });
assert.equal(r.data.name, 'דנה מה-HR'); ok('HR name cannot be changed by the member');
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: B, action: 'phone', phone: '+972501234567' } });
assert.equal(r.data.memberId, SL.split('.')[0]); ok('same phone, second device = same member');
r = await api(`/api/socialwall/me?codeId=${B}`, { session: SL });
assert.equal(r.status, 200); ok('first device still signed in (multi-device sessions)');
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: B, action: 'open', name: 'פתוח' } });
assert.equal(r.data.errorCode, 'WRONG_ACCESS'); ok('open join refused on an allowlist event');
r = await api('/api/socialwall/join', { method: 'POST', body: { codeId: B, action: 'send', phone: '050-1234567' } });
assert.equal(r.data.errorCode, 'WRONG_ACCESS'); ok('no WhatsApp send on a list-only event');

// ---------------------------------------------------------------- C: pre-moderation
console.log('C. approve-before-feed');
const C = 'codePreModerate1';
await seed(C, { access: 'open', feedModeration: 'pre' });
const c1 = await api('/api/socialwall/join', { method: 'POST', body: { codeId: C, action: 'open', name: 'יוצר' } });
const c2 = await api('/api/socialwall/join', { method: 'POST', body: { codeId: C, action: 'open', name: 'צופה' } });
assert.equal(c1.data.needsProfile, false); ok('no groups = no group question');
const pc = await upload(C, c1.data.session);
assert.equal(pc.data.post.status, 'pending'); ok('post starts pending');
r = await api(`/api/socialwall/feed?codeId=${C}`, { session: c2.data.session });
assert.equal(r.data.posts.length, 0); ok('others do not see a pending post');
r = await api(`/api/socialwall/posts?codeId=${C}`, { session: c1.data.session });
assert.equal(r.data.posts[0].status, 'pending'); ok('author sees it as pending');
r = await api(`/api/socialwall/moderate?codeId=${C}&filter=pending`, { mod: MOD });
assert.equal(r.data.posts.length, 1);
await api('/api/socialwall/moderate', { method: 'POST', mod: MOD, body: { codeId: C, action: 'approve', postId: pc.postId } });
r = await api(`/api/socialwall/feed?codeId=${C}`, { session: c2.data.session });
assert.equal(r.data.posts.length, 1); ok('approved post appears');

console.log(`\nALL ${passed} CHECKS PASSED`);
process.exit(0);
