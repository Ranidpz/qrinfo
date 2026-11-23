import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

// Free mode on the server (src/lib/thecode/server/freeMode.ts): snapshot + actions, wired like
// the other server tests — every TS file transpiled alone, imports swapped for siblings. The
// store (Firestore) is replaced by a stub that only records the registration.
async function urlOf(rel, map = {}) {
  let source = await readFile(new URL(rel, import.meta.url), 'utf8');
  for (const [spec, url] of Object.entries(map)) source = source.replaceAll(`'${spec}'`, JSON.stringify(url));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return stub(outputText);
}

const lettersUrl = await urlOf('../../src/lib/thecode/letters.ts');
const engineUrl = await urlOf('../../src/lib/thecode/engine.ts', { './letters': lettersUrl });
const freeUrl = await urlOf('../../src/lib/thecode/engineFree.ts', { './letters': lettersUrl, './engine': engineUrl });
const howToPlayUrl = await urlOf('../../src/lib/thecode/howToPlay.ts');
const selfieUrl = await urlOf('../../src/lib/thecode/selfie.ts');
const lobbyUrl = await urlOf('../../src/lib/thecode/server/lobby.ts', { '../selfie': selfieUrl });
const snapshotUrl = await urlOf('../../src/lib/thecode/server/snapshot.ts', {
  '../engine': engineUrl, '../letters': lettersUrl, '../howToPlay': howToPlayUrl, '../selfie': selfieUrl, './lobby': lobbyUrl,
});
const storeStub = stub(`
export const registered = {};
export function registerTheCodeMode(mode, ext) { registered[mode] = ext; }
export class TheCodeStoreError extends Error { constructor(code, status) { super(code); this.code = code; this.status = status; } }
`);
const E = await import(engineUrl);
const S = await import(snapshotUrl);
const M = await import(await urlOf('../../src/lib/thecode/server/freeMode.ts', {
  '../engine': engineUrl, '../engineFree': freeUrl, '../store': storeStub, './snapshot': snapshotUrl,
}));
const { registered } = await import(storeStub);

const NOON = Date.UTC(2026, 10, 24, 10, 0);
const L = await import(lettersUrl);
const riddle = (id, gnomeId, answerWord) => ({
  id, gnomeId, type: 'observe', text: `חידה ${id}`, answerWord, letter: L.letterOfAnswer(answerWord),
  acceptSoundAlike: true, hints: ['רמז סודי לחידה'], difficulty: 1, status: 'published',
});
const gnome = (id, number) => ({ id, number, code: `CODE${number}xxxxxxx`, manualCode: `M${number}`, spotId: 's1', bodyColor: 'red', hatColor: 'blue', isActive: true });

function adv(over = {}) {
  return {
    config: {
      status: 'published', title: 'אחוזה', language: 'he', mode: 'free',
      spots: [{ id: 's1', name: 'לובי', hints: ['בלובי ליד הפסנתר'], isActive: true }],
      gnomes: [gnome('g1', 1), gnome('g2', 2)],
      phrases: [{ id: 'p1', text: 'סוד גדול', isActive: true }],
      rules: { ...E.DEFAULT_THECODE_RULES }, requirePhoneVerification: false, retentionDays: 30,
      free: { refreshMinutes: 30, screenHint: 'בלובי מול הקבלה', introVideo: 'https://r2.example/v/intro.mp4' },
      ...over,
    },
    riddles: [riddle('r1', 'g1', 'אריה'), riddle('r1b', 'g1', 'בננה'), riddle('r2', 'g2', 'דג')],
  };
}
const ctx = (a, now = NOON) => ({ config: a.config, riddles: a.riddles, now, rng: () => 0.5 });
const newPlayer = () => E.createPlayer({ id: 'p1', familyName: 'הגמדים', emoji: '🍄', recoveryCode: 'ABC', now: NOON });
const snap = (a, p, now = NOON) => registered.free.snapshot(a, p, now, S.buildSnapshot(a, p, now));
const act = (a, before, action, scannedGnomeId = null, now = NOON) => registered.free.act({ before, action, ctx: ctx(a, now), scannedGnomeId });

test('free mode registers itself with the store', () => {
  assert.equal(typeof registered.free.snapshot, 'function');
  assert.equal(typeof registered.free.act, 'function');
});

test('snapshot without a player: mode + screen hint, no board, no run', () => {
  const s = snap(adv(), null);
  assert.equal(s.adventure.mode, 'free');
  assert.equal(s.adventure.screenHint, 'בלובי מול הקבלה');
  assert.equal(s.free, null);
  assert.equal(s.run, null);
});

test('scan → riddle in the snapshot; answer → correct event with the answer word, gnome asleep', () => {
  const a = adv();
  let r = act(a, newPlayer(), { type: 'scan', code: 'x' }, 'g1');
  assert.equal(r.event.type, 'freeScan');
  assert.equal(r.event.outcome.kind, 'riddle');
  assert.equal(r.gnomeScanned, 'g1');
  let s = snap(a, r.next);
  assert.deepEqual(s.free.riddle, { gnomeId: 'g1', riddleId: 'r1', text: 'חידה r1', wrongs: 0, attempts: 2 });
  assert.equal(s.free.introVideo, 'https://r2.example/v/intro.mp4');

  r = act(a, r.next, { type: 'freeAnswer', gnomeId: 'g1', riddleId: 'r1', letter: 'א' });
  assert.equal(r.event.outcome.kind, 'correct');
  assert.equal(r.event.outcome.answerWord, 'אריה');
  assert.deepEqual(r.riddleStat, { riddleId: 'r1', field: 'correct' });
  s = snap(a, r.next);
  assert.equal(s.free.riddle, null);
  assert.equal(s.free.solved, 1);
  const g1 = s.free.gnomes.find((g) => g.gnome.id === 'g1');
  assert.equal(g1.status, 'asleep');
  assert.equal(g1.wakesAt, NOON + 30 * 60_000, 'config.free.refreshMinutes is used');
  assert.equal(g1.last, 'full');
});

test('the snapshot never carries an answer, a letter, a riddle hint or another riddle', () => {
  const a = adv();
  const scanned = act(a, newPlayer(), { type: 'scan', code: 'x' }, 'g1').next;
  for (const p of [null, newPlayer(), scanned]) {
    const text = JSON.stringify(snap(a, p));
    for (const w of ['אריה', 'בננה', 'דג', 'רמז סודי לחידה', 'סוד גדול', 'חידה r1b', 'חידה r2']) {
      assert.ok(!text.includes(w), `leaked "${w}"`);
    }
  }
});

test('free hint: paid from points, shown on the board', () => {
  const a = adv();
  let p = act(a, newPlayer(), { type: 'scan', code: 'x' }, 'g2').next;
  p = act(a, p, { type: 'freeAnswer', gnomeId: 'g2', riddleId: 'r2', letter: 'ד' }).next; // 100 points
  const r = act(a, p, { type: 'freeHint', gnomeId: 'g1' });
  assert.equal(r.event.outcome.kind, 'hint');
  assert.equal(r.next.points, 80);
  assert.deepEqual(snap(a, r.next).free.gnomes.find((g) => g.gnome.id === 'g1').hints, ['בלובי ליד הפסנתר']);
});

test('malformed free actions are bad requests; guided actions do nothing; updateProfile falls through', () => {
  const a = adv();
  assert.throws(() => act(a, newPlayer(), { type: 'freeAnswer', gnomeId: '../x', riddleId: 'r1', letter: 'א' }), (e) => e.code === 'badRequest');
  assert.throws(() => act(a, newPlayer(), { type: 'freeHint', gnomeId: 42 }), (e) => e.code === 'badRequest');
  const before = newPlayer();
  for (const type of ['answer', 'hint', 'open', 'newSuitcase', 'arrangeHelp']) {
    const r = act(a, before, { type, slotIndex: 0, letter: 'א', hintKind: 'riddle', arrangement: [] });
    assert.equal(r.next.points, 0);
    assert.equal(r.next.run, null);
  }
  assert.equal(act(a, before, { type: 'updateProfile', familyName: 'x' }), null);
});

test('becoming hot pushes a lobby moment', () => {
  const gs = [1, 2, 3].map((n) => gnome(`h${n}`, n));
  const a = adv({ gnomes: gs });
  a.riddles = gs.map((g) => riddle(`r${g.id}`, g.id, 'אריה'));
  let p = newPlayer();
  let last;
  for (const g of gs) {
    p = act(a, p, { type: 'scan', code: 'x' }, g.id).next;
    last = act(a, p, { type: 'freeAnswer', gnomeId: g.id, riddleId: `r${g.id}`, letter: 'א' });
    p = last.next;
  }
  assert.deepEqual(last.lobbyKinds, ['hot']);
});
