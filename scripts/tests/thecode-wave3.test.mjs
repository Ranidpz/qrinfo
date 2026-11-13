import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

async function urlOf(relativePath, replacements = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  for (const [specifier, replacement] of Object.entries(replacements)) {
    source = source.replaceAll(`'${specifier}'`, JSON.stringify(replacement));
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return stub(outputText);
}
const selfieUrl = await urlOf('../../src/lib/thecode/selfie.ts');
const SF = await import(selfieUrl);
const LB = await import(await urlOf('../../src/lib/thecode/server/lobby.ts', { '../selfie': selfieUrl }));
const P = await import(await urlOf('../../src/lib/thecode/server/presign.ts'));
const PH = await import(await urlOf('../../src/lib/thecode/server/photo.ts', { '../selfie': selfieUrl }));

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 13, 10, 0);
const ON = { enabled: true, retentionDays: 14 };
const R2 = 'https://media.example.com';

test('presign: matches the AWS SigV4 reference vector', () => {
  const url = P.presignUrl({
    method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region: 'us-east-1', expiresSeconds: 86400, now: new Date('2013-05-24T00:00:00Z'),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test('presign: a PUT pins content-type and content-length', () => {
  const url = P.presignUrl({
    method: 'PUT', host: 'acc.r2.cloudflarestorage.com', path: '/bucket/u1/thecode-ab/lobby/idle 1.mp4',
    accessKeyId: 'k', secretAccessKey: 's', region: 'auto', expiresSeconds: 600, now: new Date(NOW),
    headers: { 'content-type': 'video/mp4', 'content-length': '1234' },
  });
  assert.ok(url.startsWith('https://acc.r2.cloudflarestorage.com/bucket/u1/thecode-ab/lobby/idle%201.mp4?'));
  assert.match(url, /X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost/);
  assert.match(url, /X-Amz-Expires=600/);
});

test('selfie: resolve defaults + clamp; expiry', () => {
  assert.deepEqual(SF.resolveSelfie({}), { enabled: true, retentionDays: 14 });
  assert.deepEqual(SF.resolveSelfie({ selfie: { enabled: false, retentionDays: 500 } }), { enabled: false, retentionDays: 90 });
  assert.equal(SF.selfieExpired(NOW - 14 * DAY, ON, NOW), false);
  assert.equal(SF.selfieExpired(NOW - 14 * DAY - 1, ON, NOW), true);
});

test('lobby: visible photo only when on and fresh; events skip hidden groups', () => {
  const photo = { url: `${R2}/o/thecode-x/selfies/p-1.webp`, key: 'o/thecode-x/selfies/p-1.webp', takenAt: NOW - DAY };
  const g = { familyName: 'הגמדים', emoji: '🦊', photo };
  assert.equal(LB.visiblePhotoUrl(g, ON, NOW), photo.url);
  assert.equal(LB.visiblePhotoUrl(g, { ...ON, enabled: false }, NOW), undefined);
  assert.equal(LB.visiblePhotoUrl(g, { ...ON, retentionDays: 1 }, NOW + 1), undefined, 'expired before the sweep');
  assert.equal(LB.visiblePhotoUrl({}, ON, NOW), undefined);
  assert.deepEqual(LB.lobbyEventFor(g, 'joined', { id: 'e1', now: NOW, selfie: ON }),
    { id: 'e1', kind: 'joined', familyName: 'הגמדים', emoji: '🦊', at: NOW, photoUrl: photo.url });
  assert.deepEqual(Object.keys(LB.lobbyEventFor({ familyName: 'a', emoji: '🐻' }, 'hot', { id: 'e2', now: NOW, selfie: ON })).sort(),
    ['at', 'emoji', 'familyName', 'id', 'kind']);
  assert.equal(LB.lobbyEventFor({ ...g, hidden: true }, 'suitcase', { id: 'e3', now: NOW, selfie: ON }), null);
});

test('lobby: at most 20 events, newest last, no duplicates; photos stripped from past events', () => {
  let events = [];
  for (let i = 0; i < 25; i++) events = LB.appendLobbyEvents(events, [{ id: `e${i}`, kind: 'joined', familyName: 'x', emoji: '🦊', at: i }]);
  assert.equal(events.length, 20);
  assert.equal(events[0].id, 'e5');
  assert.equal(events[19].id, 'e24');
  assert.equal(LB.appendLobbyEvents(events, [{ id: 'e24', kind: 'hot', familyName: 'x', emoji: '🦊', at: 99 }]).length, 20);
  assert.deepEqual(LB.appendLobbyEvents('junk', []), []);
  const withPhoto = [{ id: 'a', kind: 'joined', familyName: 'x', emoji: '🦊', at: 1, photoUrl: 'u1' }, { id: 'b', kind: 'hot', familyName: 'y', emoji: '🐻', at: 2, photoUrl: 'u2' }];
  const out = LB.stripPhotoFromEvents(withPhoto, (u) => u === 'u1');
  assert.deepEqual(out.map((e) => e.photoUrl), [undefined, 'u2']);
  assert.ok(!('photoUrl' in out[0]));
  assert.equal(LB.stripPhotoFromEvents(withPhoto, () => false), null, 'nothing to change');
});

test('lobby videos: only our R2, https, mp4/webm, known slots', () => {
  assert.equal(LB.isAllowedLobbyVideoUrl(`${R2}/o/thecode-x/lobby/idle.mp4`, R2), true);
  assert.equal(LB.isAllowedLobbyVideoUrl(`${R2}/o/a.webm`, R2), true);
  for (const bad of ['http://media.example.com/a.mp4', 'https://evil.com/a.mp4', `${R2}/a.mov`, `${R2}/a.mp4?x=1`, `${R2}.evil.com/a.mp4`, 7, null]) {
    assert.equal(LB.isAllowedLobbyVideoUrl(bad, R2), false, String(bad));
  }
  assert.equal(LB.isAllowedLobbyVideoUrl(`${R2}/a.mp4`, null), false, 'no R2 → nothing accepted');
  assert.equal(LB.isAllowedLobbyVideoUrl('https://cdn.x.com/other/a.mp4', 'https://cdn.x.com/media'), false, 'outside the base path');
  assert.deepEqual(LB.normalizeLobby({ videos: { idle: `${R2}/i.mp4`, explain: 'https://evil.com/e.mp4', after: `${R2}/a.webm`, extra: `${R2}/x.mp4` } }, R2),
    { videos: { idle: `${R2}/i.mp4`, after: `${R2}/a.webm` } });
  assert.equal(LB.normalizeLobby({ videos: { idle: 'nope' } }, R2), undefined);
  assert.equal(LB.normalizeLobby(null, R2), undefined);
  assert.deepEqual(LB.lobbyVideosOf({}), {});
});

test('photo check: by bytes, ≤ 400 KB, webp / jpeg only', () => {
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  assert.deepEqual(PH.checkPhoto(webp), { ok: true, type: 'image/webp' });
  assert.deepEqual(PH.checkPhoto(jpeg), { ok: true, type: 'image/jpeg' });
  assert.deepEqual(PH.checkPhoto(Buffer.from('<svg onload=alert(1)>')), { ok: false, error: 'badType' });
  assert.deepEqual(PH.checkPhoto(Buffer.from([0x89, 0x50, 0x4e, 0x47])), { ok: false, error: 'badType' }, 'png refused');
  assert.deepEqual(PH.checkPhoto(Buffer.alloc(0)), { ok: false, error: 'empty' });
  assert.deepEqual(PH.checkPhoto(Buffer.concat([jpeg, Buffer.alloc(400 * 1024)])), { ok: false, error: 'tooLarge' });
});

test('rules, framing and cron are wired', async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const at = rules.indexOf('match /thecodeLobby/{docId}');
  assert.ok(at > 0);
  assert.match(rules.slice(at, at + 120), /allow read: if true;\s*allow write: if false;/);
  const sel = rules.indexOf('match /thecodeSelfies/{selfieId}');
  assert.match(rules.slice(sel, sel + 100), /allow read, write: if false;/);
  const next = await readFile(new URL('../../next.config.ts', import.meta.url), 'utf8');
  assert.match(next, /\['\/v\/:path\*', '\/lobby\/:path\*'\]\.map/);
  assert.match(next, /source: '\/\(\(\?!v\/\|lobby\/\)\.\*\)'/);
  const vercel = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.crons.some((c) => c.path === '/api/cron/thecode-selfies'));
});
