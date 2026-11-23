import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

// engineFree.ts imports ./engine and ./letters; each is transpiled alone and wired by URL.
async function transpiledUrl(relativePath, replacements = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  for (const [spec, url] of Object.entries(replacements)) source = source.replaceAll(`'${spec}'`, JSON.stringify(url));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return stub(outputText);
}
const lettersUrl = await transpiledUrl('../../src/lib/thecode/letters.ts');
const engineUrl = await transpiledUrl('../../src/lib/thecode/engine.ts', { './letters': lettersUrl });
const L = await import(lettersUrl);
const E = await import(engineUrl);
const F = await import(await transpiledUrl('../../src/lib/thecode/engineFree.ts', { './letters': lettersUrl, './engine': engineUrl }));

const NOON = Date.UTC(2026, 10, 24, 10, 0);
const MIN = 60_000;

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const riddle = (id, gnomeId, answerWord, extra = {}) => ({
  id, gnomeId, type: 'observe', text: `חידה ${id}`, answerWord, letter: L.letterOfAnswer(answerWord),
  acceptSoundAlike: true, hints: [], difficulty: 1, status: 'published', ...extra,
});
const gnome = (id, number, spotId, extra = {}) => ({
  id, number, code: `code-${id}`, manualCode: `M${number}`, spotId, bodyColor: 'red', hatColor: 'blue',
  isActive: true, verifiedOnSite: true, ...extra,
});

function config(over = {}) {
  return {
    status: 'published', title: 'בדיקה', language: 'he',
    spots: [
      { id: 's1', name: 'לובי', hints: ['בלובי', 'ליד הפסנתר'], isActive: true },
      { id: 's2', name: 'גינה', hints: ['בגינה'], isActive: true },
    ],
    gnomes: [gnome('g1', 1, 's1'), gnome('g2', 2, 's2')],
    phrases: [], rules: { ...E.DEFAULT_THECODE_RULES }, requirePhoneVerification: false, retentionDays: 30,
    ...over,
  };
}

const RIDDLES = [
  riddle('r1a', 'g1', 'אריה'), riddle('r1b', 'g1', 'בננה'), riddle('r1c', 'g1', 'גזר'),
  riddle('r2a', 'g2', 'דג'), riddle('r2b', 'g2', 'הר'),
];

const ctx = (now = NOON, over = {}) => ({ config: config(), riddles: RIDDLES, now, rng: E.createSeededRng(1), ...over });
const newPlayer = () => E.createPlayer({ id: 'p1', familyName: 'הגמדים', emoji: '🍄', recoveryCode: 'ABC', now: NOON });

/** Scan + answer in one go. */
function play(p, gnomeId, letter, c = ctx()) {
  const s = F.freeScan(p, gnomeId, c);
  assert.equal(s.outcome.kind, 'riddle', `scan ${gnomeId}: ${s.outcome.kind}`);
  return F.freeAnswer(s.player, { gnomeId, letter, riddleId: s.outcome.riddleId }, c);
}

test('defaults + rules are clamped, refresh in days/hours/minutes', () => {
  assert.deepEqual(F.resolveFreeRules(null), F.DEFAULT_FREE_RULES);
  const r = F.resolveFreeRules({ refreshMinutes: -5, attemptsPerRiddle: 9, secondAttemptFactor: 2, wrapRiddles: false });
  assert.equal(r.refreshMinutes, 60);
  assert.equal(r.attemptsPerRiddle, 2);
  assert.equal(r.secondAttemptFactor, 0.5);
  assert.equal(r.wrapRiddles, false);
  assert.equal(F.resolveFreeRules({ refreshMinutes: 99_999_999 }).refreshMinutes, 60);
  assert.equal(F.joinRefresh({ hours: 2, minutes: 30 }), 150);
  assert.equal(F.joinRefresh({ days: 30 }), F.MAX_REFRESH_MINUTES);
  assert.equal(F.joinRefresh({}), 1);
  assert.deepEqual(F.splitRefresh(1 * 1440 + 3 * 60 + 5), { days: 1, hours: 3, minutes: 5 });
});

test('fresh group: every gnome awake, any gnome can be scanned', () => {
  const p = deepFreeze(newPlayer());
  const b = F.freeBoard(p, ctx());
  assert.deepEqual(b.gnomes.map((g) => g.status), ['awake', 'awake']);
  assert.equal(b.allAsleep, false);
  const s = F.freeScan(p, 'g2', ctx());
  assert.deepEqual(s.outcome, { kind: 'riddle', gnomeId: 'g2', riddleId: 'r2a', attemptsLeft: 2 });
});

test('correct first try: full points, gnome sleeps for the refresh, no letter collection', () => {
  const r = play(deepFreeze(newPlayer()), 'g1', 'א');
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.outcome.points, 100);
  assert.equal(r.outcome.answerWord, 'אריה');
  assert.equal(r.outcome.secondTry, false);
  assert.equal(r.outcome.wakesAt, NOON + 60 * MIN);
  assert.equal(r.player.points, 100);
  assert.deepEqual(r.player.solvedRiddleIds, ['r1a']);
  assert.deepEqual(r.player.foundGnomeIds, ['g1']);
  assert.equal(r.player.free.letters, undefined);
  assert.equal('letters' in F.freeBoard(r.player, ctx()), false);
  const again = F.freeScan(r.player, 'g1', ctx(NOON + 10 * MIN));
  assert.equal(again.outcome.kind, 'asleep');
  assert.equal(again.outcome.last, 'full');
});

test('wrong then right = half points; two wrong = asleep, no points, never negative', () => {
  const c = ctx();
  let s = F.freeScan(newPlayer(), 'g1', c);
  let a = F.freeAnswer(s.player, { gnomeId: 'g1', letter: 'ב', riddleId: 'r1a' }, c);
  assert.deepEqual(a.outcome, { kind: 'wrong', attemptsLeft: 1 });
  a = F.freeAnswer(a.player, { gnomeId: 'g1', letter: 'א', riddleId: 'r1a' }, c);
  assert.equal(a.outcome.kind, 'correct');
  assert.equal(a.outcome.points, 50);
  assert.equal(a.outcome.secondTry, true);

  s = F.freeScan(a.player, 'g2', c);
  let b = F.freeAnswer(s.player, { gnomeId: 'g2', letter: 'ת', riddleId: 'r2a' }, c);
  b = F.freeAnswer(b.player, { gnomeId: 'g2', letter: 'ש', riddleId: 'r2a' }, c);
  assert.equal(b.outcome.kind, 'failed');
  assert.equal(b.player.points, 50);
  assert.equal(b.player.streak, 0);
  assert.equal(b.outcome.allAsleep, true);
  assert.equal(F.freeBoard(b.player, c).gnomes.find((g) => g.gnomeId === 'g2').last.result, 'failed');
});

test('after the refresh the gnome wakes with its NEXT riddle, and wraps after the last', () => {
  let p = play(newPlayer(), 'g2', 'ד').player;
  const later = NOON + 61 * MIN;
  assert.equal(F.freeBoard(p, ctx(later)).gnomes.find((g) => g.gnomeId === 'g2').status, 'awake');
  const s = F.freeScan(p, 'g2', ctx(later));
  assert.equal(s.outcome.riddleId, 'r2b');
  p = F.freeAnswer(s.player, { gnomeId: 'g2', letter: 'ה', riddleId: 'r2b' }, ctx(later)).player;
  const third = F.freeScan(p, 'g2', ctx(later + 61 * MIN));
  assert.equal(third.outcome.riddleId, 'r2a', 'wraps to the first riddle');
  const noWrap = F.freeScan(p, 'g2', ctx(later + 61 * MIN, { freeRules: { wrapRiddles: false } }));
  assert.equal(noWrap.outcome.kind, 'noRiddles');
});

test('same riddles in the same order for every group', () => {
  const a = F.freeScan(newPlayer(), 'g1', ctx());
  const b = F.freeScan({ ...newPlayer(), id: 'p2' }, 'g1', ctx());
  assert.equal(a.outcome.riddleId, b.outcome.riddleId);
});

test('hot streak as the guided game: the answer AFTER hotStreakAt is doubled', () => {
  const many = Array.from({ length: 5 }, (_, i) => gnome(`h${i}`, i + 1, 's1'));
  const rs = many.map((g) => riddle(`rh${i(g)}`, g.id, 'אריה'));
  function i(g) { return g.id.slice(1); }
  const c = { config: config({ gnomes: many }), riddles: rs, now: NOON, rng: E.createSeededRng(1) };
  let p = newPlayer();
  const got = [];
  for (const g of many) {
    const r = play(p, g.id, 'א', c);
    got.push([r.outcome.points, r.outcome.becameHot]);
    p = r.player;
  }
  assert.deepEqual(got, [[100, false], [100, false], [100, true], [200, false], [200, false]]);
  // A wrong letter cools the group down.
  const s = F.freeScan(p, 'h0', { ...c, now: NOON + 61 * MIN });
  const w = F.freeAnswer(s.player, { gnomeId: 'h0', letter: 'ת', riddleId: s.outcome.riddleId }, { ...c, now: NOON + 61 * MIN });
  assert.equal(w.player.streak, 0);
});

test('double tap / retry is never scored twice', () => {
  const c = ctx();
  const s = F.freeScan(newPlayer(), 'g1', c);
  const first = F.freeAnswer(s.player, { gnomeId: 'g1', letter: 'א', riddleId: 'r1a' }, c);
  const again = F.freeAnswer(first.player, { gnomeId: 'g1', letter: 'א', riddleId: 'r1a' }, c);
  assert.equal(again.replayed, true);
  assert.equal(again.outcome.points, 100);
  assert.equal(again.player.points, 100);
});

test('no answer without a scan; a re-scan keeps the same riddle and its wrong count', () => {
  const c = ctx();
  assert.equal(F.freeAnswer(newPlayer(), { gnomeId: 'g1', letter: 'א' }, c).outcome.kind, 'noRiddle');
  let s = F.freeScan(newPlayer(), 'g1', c);
  const w = F.freeAnswer(s.player, { gnomeId: 'g1', letter: 'ב', riddleId: 'r1a' }, c);
  s = F.freeScan(w.player, 'g1', c);
  assert.deepEqual(s.outcome, { kind: 'riddle', gnomeId: 'g1', riddleId: 'r1a', attemptsLeft: 1 });
  assert.equal(F.freeAnswer(s.player, { gnomeId: 'g1', letter: 'א', riddleId: 'r9' }, c).outcome.kind, 'noRiddle');
});

test('sound-alike letter counts with a spelling tip', () => {
  const rs = [riddle('t1', 'g1', 'תות')];
  const c = { ...ctx(), riddles: rs };
  const r = play(newPlayer(), 'g1', 'ט', c);
  assert.equal(r.outcome.kind, 'correct');
  assert.match(r.outcome.spellingTip, /תות/);
});

test('location hints: paid, only when affordable, only for an awake gnome', () => {
  const c = ctx();
  assert.deepEqual(F.freeBuyHint(newPlayer(), 'g1', c).outcome, { kind: 'notEnoughPoints', cost: 20 });
  let p = play(newPlayer(), 'g2', 'ד').player; // 100 points, g2 asleep
  assert.equal(F.freeBuyHint(p, 'g2', c).outcome.kind, 'notAwake');
  let h = F.freeBuyHint(p, 'g1', c);
  assert.deepEqual(h.outcome, { kind: 'hint', gnomeId: 'g1', text: 'בלובי', cost: 20, remaining: 1 });
  assert.equal(h.player.points, 80);
  assert.equal(h.player.streak, 1, 'a hint does not break the streak in free mode');
  h = F.freeBuyHint(h.player, 'g1', c);
  assert.equal(h.outcome.text, 'ליד הפסנתר');
  assert.equal(F.freeBuyHint(h.player, 'g1', c).outcome.kind, 'noMoreHints');
  const row = F.freeBoard(h.player, c).gnomes.find((g) => g.gnomeId === 'g1');
  assert.deepEqual(row.hintsShown, ['בלובי', 'ליד הפסנתר']);
  assert.equal(row.nextHintCost, null);
});

test('paused / unknown / switched-off gnomes', () => {
  assert.equal(F.freeScan(newPlayer(), 'g1', ctx(NOON, { config: config({ status: 'paused' }) })).outcome.kind, 'paused');
  assert.equal(F.freeScan(newPlayer(), 'nope', ctx()).outcome.kind, 'unknownGnome');
  const off = config({ gnomes: [gnome('g1', 1, 's1', { isActive: false }), gnome('g2', 2, 's2')] });
  assert.equal(F.freeScan(newPlayer(), 'g1', ctx(NOON, { config: off })).outcome.kind, 'gnomeOff');
  assert.deepEqual(F.freeBoard(newPlayer(), ctx(NOON, { config: off })).gnomes.map((g) => g.gnomeId), ['g2']);
});

test('the board never carries an answer', () => {
  const p = play(newPlayer(), 'g1', 'א').player;
  const text = JSON.stringify(F.freeBoard(p, ctx()));
  for (const r of RIDDLES) assert.ok(!text.includes(r.answerWord), `leaked ${r.answerWord}`);
});

test('round reset drops the free state; operator issues', () => {
  const p = play(newPlayer(), 'g1', 'א').player;
  assert.equal(F.resetFreeState(p).free, undefined);
  const issues = F.freeAdventureIssues(config({ gnomes: [...config().gnomes, gnome('g3', 3, 's1')] }), RIDDLES);
  assert.deepEqual(issues.map((x) => [x.code, x.gnomeId, x.severity]), [
    ['FEW_FRESH_ROUNDS', 'g2', 'warning'],
    ['GNOME_WITHOUT_RIDDLE', 'g3', 'error'],
  ]);
});
