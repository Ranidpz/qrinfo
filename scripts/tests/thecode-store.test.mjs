// src/lib/thecode/store.ts against an IN-MEMORY fake of the Admin Firestore API.
// This checks the store's own logic (auth, tokens, flows, index docs, locking, weekly
// points, stats) — NOT real Firestore semantics (indexes, contention, TTL, rules).
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

// ------------------------------------------------------------------ fake Firestore
const fake = `
const docs = new Map();
export const __docs = docs;
const INC = Symbol('inc'); const TS = Symbol('ts');
export const FieldValue = { increment: (n) => ({ [INC]: n }), serverTimestamp: () => ({ [TS]: true }) };
export class FieldPath { constructor(...s) { this.segments = s; } }
export const Timestamp = { fromMillis: (ms) => ({ ms }) };
const segs = (f) => (f instanceof FieldPath ? f.segments : String(f).split('.'));
const getField = (d, f) => segs(f).reduce((o, k) => (o == null ? undefined : o[k]), d);
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
function apply(base, patch) {
  const out = base && typeof base === 'object' ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && INC in v) out[k] = (Number(out[k]) || 0) + v[INC];
    else if (v && typeof v === 'object' && TS in v) out[k] = Date.now();
    else if (v && typeof v === 'object' && !Array.isArray(v) && !('ms' in v)) out[k] = apply(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}
const strip = (v) => apply({}, v);
function snap(path) {
  const d = docs.get(path);
  return { id: path.split('/').pop(), ref: ref(path), exists: d !== undefined, data: () => clone(d) };
}
function ref(path) {
  return {
    id: path.split('/').pop(), path,
    collection: (n) => col(path + '/' + n),
    get: async () => snap(path),
    create: async (d) => { if (docs.has(path)) throw new Error('ALREADY_EXISTS'); docs.set(path, strip(d)); },
    set: async (d, o) => { docs.set(path, o?.merge ? apply(docs.get(path), d) : strip(d)); },
    update: async (d) => { if (!docs.has(path)) throw new Error('NOT_FOUND'); docs.set(path, apply(docs.get(path), d)); },
    delete: async () => { docs.delete(path); },
  };
}
function col(path, q = { where: [], order: null, limit: Infinity }) {
  const run = () => {
    let list = [...docs.keys()].filter((k) => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/')).map(snap);
    for (const [f, op, v] of q.where) list = list.filter((s) => { const x = getField(s.data(), f); return op === '==' ? x === v : op === '>' ? x > v : false; });
    if (q.order) list = list.filter((s) => getField(s.data(), q.order[0]) !== undefined)
      .sort((a, b) => (getField(b.data(), q.order[0]) - getField(a.data(), q.order[0])) * (q.order[1] === 'desc' ? 1 : -1));
    return list.slice(0, q.limit);
  };
  return {
    doc: (id) => ref(path + '/' + id),
    where: (f, op, v) => col(path, { ...q, where: [...q.where, [f, op, v]] }),
    orderBy: (f, dir = 'asc') => col(path, { ...q, order: [f, dir] }),
    limit: (n) => col(path, { ...q, limit: n }),
    get: async () => { const d = run(); return { empty: !d.length, docs: d }; },
    count: () => ({ get: async () => ({ data: () => ({ count: run().length }) }) }),
  };
}
const db = {
  collection: (n) => col(n),
  getAll: async (...refs) => refs.map((r) => snap(r.path)),
  runTransaction: async (fn) => {
    const writes = [];
    let wrote = false;
    const tx = {
      get: async (r) => { if (wrote) throw new Error('read after write'); return snap(r.path); },
      getAll: async (...rs) => { if (wrote) throw new Error('read after write'); return rs.map((r) => snap(r.path)); },
      set: (r, d, o) => { wrote = true; writes.push(() => r.set(d, o)); },
      create: (r, d) => { wrote = true; writes.push(() => r.create(d)); },
      update: (r, d) => { wrote = true; writes.push(() => r.update(d)); },
      delete: (r) => { wrote = true; writes.push(() => r.delete()); },
    };
    const out = await fn(tx);
    for (const w of writes) await w();
    return out;
  },
};
export const getAdminDb = () => db;
`;
const fakeUrl = stub(fake);
const lettersUrl = await urlOf('../../src/lib/thecode/letters.ts');
const engineUrl = await urlOf('../../src/lib/thecode/engine.ts', { './letters': lettersUrl });
const howToPlayUrl = await urlOf('../../src/lib/thecode/howToPlay.ts');
const dep = { '../engine': engineUrl, '../letters': lettersUrl, '../howToPlay': howToPlayUrl };
const store = await import(await urlOf('../../src/lib/thecode/store.ts', {
  './howToPlay': howToPlayUrl,
  'firebase-admin/firestore': fakeUrl,
  '@/lib/firebase-admin': fakeUrl,
  './engine': engineUrl,
  './server/admin': await urlOf('../../src/lib/thecode/server/admin.ts', dep),
  './server/codes': await urlOf('../../src/lib/thecode/server/codes.ts'),
  './server/names': await urlOf('../../src/lib/thecode/server/names.ts'),
  './server/rate': await urlOf('../../src/lib/thecode/server/rate.ts'),
  './server/snapshot': await urlOf('../../src/lib/thecode/server/snapshot.ts', dep),
  './server/week': await urlOf('../../src/lib/thecode/server/week.ts'),
}));
const { __docs: docs } = await import(fakeUrl);
const L = await import(lettersUrl);

// ------------------------------------------------------------------ fixture
const CODE = 'codeAAAAAAAAAAAAAAAA';
function seedCode() {
  docs.clear();
  docs.set(`codes/${CODE}`, { ownerId: 'owner', shortId: 'sh0rt1', media: [{ id: 'm1', type: 'thecode', url: '' }, { id: 'm2', type: 'link' }] });
}
const spot = (id) => ({ id, name: `נקודה ${id}`, hints: [`אזור ${id}`, `קרוב ${id}`], isActive: true });
const gnome = (id, n, spotId, bodyColor, hatColor) => ({ id, number: n, spotId, bodyColor, hatColor, isActive: true, verifiedOnSite: true });
const riddle = (id, gnomeId, answerWord, status = 'published') => ({ id, gnomeId, type: 'observe', text: `חידה ${id}`, answerWord, hints: ['רמז'], difficulty: 1, status, acceptSoundAlike: true });
function adventure(status = 'published') {
  return {
    config: {
      status, title: 'הקוד — מלון', language: 'he',
      spots: [spot('A'), spot('B'), spot('C')],
      gnomes: [gnome('a1', 1, 'A', 'red', 'blue'), gnome('a2', 2, 'A', 'yellow', 'blue'), gnome('b1', 3, 'B', 'black', 'white'), gnome('c1', 4, 'C', 'purple', 'orange')],
      phrases: [{ id: 'kelev', text: 'כלב', isActive: true }],
      rules: {}, requirePhoneVerification: false, retentionDays: 30,
    },
    riddles: [riddle('rk', 'a1', 'כובע'), riddle('rl', 'b1', 'לול'), riddle('rb', 'c1', 'בית'), riddle('rx', 'a2', 'רכבת')],
  };
}
async function save(base, adv = adventure()) {
  return store.saveAdventure(CODE, { codeId: CODE, baseVersion: base, ...adv });
}
const play = (auth, action) => store.playAction(CODE, auth, action, '1.2.3.4');

// ------------------------------------------------------------------ admin
test('admin save: version locking, server-made gnome codes + index docs, public stub, publish gate', async () => {
  seedCode();
  const fresh = await store.loadAdmin(CODE);
  assert.equal(fresh.version, 0);
  assert.equal(fresh.config.status, 'draft');
  assert.deepEqual(fresh.riddles, []);

  // Publishing a broken adventure is refused, nothing saved.
  const broken = adventure();
  broken.riddles = broken.riddles.filter((r) => r.id !== 'rb');
  const bad = await save(0, broken);
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'invalid');
  assert.ok(bad.issues.some((i) => i.code === 'PHRASE_LETTER_MISSING'));
  assert.equal(docs.has(`codes/${CODE}/thecode/adventure`), false);

  const withClientCodes = adventure();
  withClientCodes.config.gnomes[0].code = 'CLIENTPICK';
  const r = await save(0, withClientCodes);
  assert.equal(r.ok, true);
  assert.equal(r.version, 1);
  for (const g of r.config.gnomes) {
    assert.match(g.code, /^[0-9A-Za-z]{12}$/);
    assert.match(g.manualCode, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.deepEqual(docs.get(`thecodeGnomeCodes/${g.code}`).gnomeId, g.id);
    assert.deepEqual(docs.get(`thecodeGnomeCodes/${g.manualCode}`).codeId, CODE);
  }
  assert.notEqual(r.config.gnomes[0].code, 'CLIENTPICK');
  assert.equal(r.riddles.find((x) => x.id === 'rk').letter, 'כ');
  assert.deepEqual(docs.get(`codes/${CODE}`).media[0].thecodeConfig, { title: 'הקוד — מלון', status: 'published', language: 'he' });
  assert.deepEqual(docs.get(`codes/${CODE}`).media[1], { id: 'm2', type: 'link' });

  // Stale tab → conflict.
  assert.deepEqual(await save(0), { ok: false, error: 'conflict', version: 1 });
  // Existing gnome codes are immutable whatever the client sends; a removed gnome loses its index docs.
  const again = adventure();
  again.config.gnomes = r.config.gnomes.filter((g) => g.id !== 'a2').map((g) => ({ ...g, code: 'HACK', manualCode: 'HACK' }));
  again.riddles = again.riddles.filter((x) => x.gnomeId !== 'a2');
  const a2 = r.config.gnomes.find((g) => g.id === 'a2');
  const r2 = await save(1, again);
  assert.equal(r2.ok, true);
  assert.deepEqual(r2.config.gnomes.map((g) => g.code), r.config.gnomes.filter((g) => g.id !== 'a2').map((g) => g.code));
  assert.equal(docs.has(`thecodeGnomeCodes/${a2.code}`), false);
  assert.equal(docs.has(`thecodeGnomeCodes/${a2.manualCode}`), false);
  assert.equal((await store.loadAdmin(CODE)).version, 2);
  assert.deepEqual(await store.saveAdventure(CODE, { codeId: CODE, baseVersion: 'x' }), { ok: false, error: 'badRequest' });
});

// ------------------------------------------------------------------ play
test('play: register → scan by QR and manual code → answer → arrange help → open; tokens + weekly points', async () => {
  seedCode();
  const saved = await save(0);
  const codeOf = (id) => saved.config.gnomes.find((g) => g.id === id);

  const visitor = await play(undefined, { type: 'state' });
  assert.equal(visitor.snapshot.player, null);
  await assert.rejects(play(undefined, { type: 'scan', code: 'x' }), (e) => e.code === 'needRegister');
  await assert.rejects(play(undefined, { type: 'register', familyName: 'זונה', emoji: '🦊' }), (e) => e.code === 'invalidName');
  await assert.rejects(play(undefined, { type: 'register', familyName: 'כהן', emoji: 'ab' }), (e) => e.code === 'badRequest');

  const reg = await play(undefined, { type: 'register', familyName: '  משפחת  כהן ', emoji: '🦊' });
  const auth = reg.auth;
  assert.ok(auth.token.length >= 40);
  const stored = docs.get(`codes/${CODE}/thecodePlayers/${auth.playerId}`);
  assert.equal(stored.familyName, 'משפחת כהן');
  assert.equal(stored.tokenHashes.length, 1);
  assert.notEqual(stored.tokenHashes[0], auth.token, 'only the hash is stored');
  assert.match(stored.recoveryCode, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(stored.expireAt.ms, stored.lastSeenAt + 30 * 86_400_000);
  assert.equal(reg.snapshot.player.recoveryCode, stored.recoveryCode);

  await assert.rejects(play({ playerId: auth.playerId, token: 'x'.repeat(43) }, { type: 'state' }), (e) => e.code === 'unauthorized');

  // Foreign / unknown codes.
  docs.set('thecodeGnomeCodes/FOREIGNSLUG1', { codeId: 'otherCodeBBBBBBBBBBB', gnomeId: 'a1' });
  for (const code of ['FOREIGNSLUG1', 'nosuchcode12', '../x']) {
    const r = await play(auth, { type: 'scan', code });
    assert.equal(r.event.outcome.kind, 'unknownGnome', code);
    assert.equal(r.event.gnome, undefined);
  }

  // Scan a1 by its manual code typed in lower case → the run starts there with the riddle open.
  let r = await play(auth, { type: 'scan', code: codeOf('a1').manualCode.toLowerCase() });
  assert.equal(r.event.outcome.kind, 'riddle');
  assert.deepEqual(r.event.gnome, { id: 'a1', number: 1, bodyColor: 'red', hatColor: 'blue' });
  assert.equal(r.snapshot.run.target.riddle.text, 'חידה rk');
  assert.ok(!JSON.stringify(r.snapshot).includes('כובע'));

  r = await play(auth, { type: 'answer', slotIndex: 0, letter: 'כ' });
  assert.deepEqual([r.event.outcome.kind, r.event.outcome.points], ['correct', 100]);
  const replay = await play(auth, { type: 'answer', slotIndex: 0, letter: 'כ' });
  assert.equal(replay.snapshot.player.points, 100, 'retry never double-awards');

  // Finish the run by QR slugs.
  while (r.snapshot.run.state === 'collecting') {
    const t = r.snapshot.run.target;
    const couch = await play(auth, { type: 'answer', slotIndex: t.slotIndex, letter: 'ל' });
    assert.equal(couch.event.outcome.kind, 'noRiddle', 'not scanned yet');
    r = await play(auth, { type: 'scan', code: codeOf(t.gnome.id).code });
    assert.equal(r.event.outcome.kind, 'riddle');
    const letter = { b1: 'ל', c1: 'ב' }[t.gnome.id];
    r = await play(auth, { type: 'answer', slotIndex: t.slotIndex, letter });
    assert.equal(r.event.outcome.kind, 'correct');
  }
  assert.equal(r.snapshot.run.state, 'arranging');
  assert.equal(r.snapshot.player.points, 300);
  r = await play(auth, { type: 'arrangeHelp' });
  assert.deepEqual(r.event, { type: 'arrangeHelp', given: true, cost: 50, position: 0, letter: 'כ' });
  assert.deepEqual(r.snapshot.run.arrange.fixed, ['כ', null, null]);
  r = await play(auth, { type: 'open', arrangement: ['ב', 'ל', 'כ'] });
  assert.deepEqual(r.event, { type: 'open', opened: false, bonus: 0 });
  assert.equal(r.snapshot.run.suitcase, null);
  r = await play(auth, { type: 'open', arrangement: L.phraseLetters('כלב') });
  assert.deepEqual(r.event, { type: 'open', opened: true, bonus: 500 });
  assert.equal(r.snapshot.run.suitcase.phraseText, 'כלב');
  assert.equal(r.snapshot.player.points, 750);
  assert.equal(r.snapshot.canStartNew, false);
  r = await play(auth, { type: 'newSuitcase' });
  assert.deepEqual(r.event, { type: 'newSuitcase', started: false });

  const p = docs.get(`codes/${CODE}/thecodePlayers/${auth.playerId}`);
  const [week] = Object.values(p.week);
  assert.deepEqual(week, { points: 750, suitcases: 1 });
  // Stats counters.
  const stats = docs.get(`codes/${CODE}/thecode/stats`);
  assert.equal(stats.riddles.rk.correct, 1);
  assert.equal(stats.gnomes.a1.scans, 1);
  assert.ok(stats.riddles.rl.wrong === undefined, 'a noRiddle tap is not a wrong answer');

  // Recovery: a second device, the first keeps working; at most 5 tokens kept.
  const rec = await play(undefined, { type: 'recover', recoveryCode: p.recoveryCode.toLowerCase() });
  assert.equal(rec.auth.playerId, auth.playerId);
  assert.notEqual(rec.auth.token, auth.token);
  await play(auth, { type: 'state' });
  await play(rec.auth, { type: 'state' });
  for (let i = 0; i < 6; i++) await play(undefined, { type: 'recover', recoveryCode: p.recoveryCode });
  assert.equal(docs.get(`codes/${CODE}/thecodePlayers/${auth.playerId}`).tokenHashes.length, 5);
  await assert.rejects(play(auth, { type: 'state' }), (e) => e.code === 'unauthorized', 'oldest device dropped');
  await assert.rejects(play(undefined, { type: 'recover', recoveryCode: 'ZZZZZZ' }), (e) => e.code === 'recoveryNotFound');

  // Leaderboard + admin view.
  const board = await store.leaderboard(CODE, 'week', auth.playerId);
  assert.deepEqual(board.rows.map((x) => [x.familyName, x.points, x.suitcases]), [['משפחת כהן', 750, 1]]);
  assert.equal(board.me, undefined, 'already in the rows');
  const all = await store.leaderboard(CODE, 'all');
  assert.equal(all.rows[0].points, 750);
  const admin = await store.loadAdmin(CODE);
  assert.deepEqual([admin.players[0].weekPoints, admin.players[0].suitcases], [750, 1]);
  assert.equal(admin.gnomeStats.a1.scans, 1);
  assert.equal(admin.riddleStats.rk.correct, 1);
});

test('play: rate limit per player, paused draft, gnome lookup, hide / rename / delete', async () => {
  seedCode();
  const saved = await save(0);
  const reg = await play(undefined, { type: 'register', familyName: 'לוי', emoji: '🐻' });
  const auth = reg.auth;
  for (let i = 0; i < 60; i++) await play(auth, { type: "state" });
  await assert.rejects(play(auth, { type: 'state' }), (e) => e.code === 'rateLimited' && e.retryAfterSeconds > 0);
  docs.get(`codes/${CODE}/thecodePlayers/${auth.playerId}`).rate = { windowStart: 0, count: 0 };

  // A draft adventure behaves as paused.
  const draft = adventure('draft');
  draft.config.gnomes = saved.config.gnomes;
  const d = await save(1, draft);
  assert.equal(d.ok, true);
  const paused = await play(auth, { type: 'scan', code: saved.config.gnomes[0].code });
  assert.equal(paused.event.outcome.kind, 'paused');
  assert.equal(paused.snapshot.adventure.open, false);
  assert.equal(paused.snapshot.run, null);

  const look = await store.lookupGnome(saved.config.gnomes[2].manualCode.toLowerCase());
  const { howToPlay, ...rest } = look;
  assert.deepEqual(rest, { ok: true, codeId: CODE, shortId: 'sh0rt1', title: 'הקוד — מלון', language: 'he', gnome: { id: 'b1', number: 3, bodyColor: 'black', hatColor: 'white' } });
  assert.ok(Array.isArray(howToPlay) && howToPlay.length >= 5, 'lookup carries the rules text');
  assert.deepEqual(await store.lookupGnome('nope1234'), { ok: false, error: 'notFound' });

  assert.deepEqual(await store.patchPlayer(CODE, auth.playerId, { familyName: 'שרמוטה' }), { ok: false, error: 'invalidName' });
  const ren = await store.patchPlayer(CODE, auth.playerId, { familyName: 'משפחת לוי', hidden: true });
  assert.equal(ren.ok, true);
  assert.deepEqual([ren.player.familyName, ren.player.originalName, ren.player.hidden], ['משפחת לוי', 'לוי', true]);
  assert.deepEqual(await store.patchPlayer(CODE, 'missingPlayer12345', { hidden: true }), { ok: false, error: 'notFound' });
  assert.deepEqual(await store.deletePlayer(CODE, auth.playerId), { ok: true });
  await assert.rejects(play(auth, { type: 'state' }), (e) => e.code === 'unauthorized');
});

test('rules: the thecode paths are locked', async () => {
  const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
  for (const m of ['match /thecode/{docId}', 'match /thecodePlayers/{playerId}', 'match /thecodeGnomeCodes/{code}']) {
    const at = rules.indexOf(m);
    assert.ok(at > 0, m);
    assert.match(rules.slice(at, at + 120), /allow read, write: if false;/);
  }
  assert.ok(!/\{document=\*\*\}|\{path=\*\*\}/.test(rules), 'no recursive wildcard opens them');
});
