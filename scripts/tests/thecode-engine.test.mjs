import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { loadTs, stub } from './load-ts.mjs';

// loadTs transpiles ONE file, so letters.ts is transpiled here and handed to the
// engine as the replacement for its './letters' import.
async function transpiledUrl(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return stub(outputText);
}
const lettersUrl = await transpiledUrl('../../src/lib/thecode/letters.ts');
const L = await import(lettersUrl);
const E = await loadTs('../../src/lib/thecode/engine.ts', { './letters': lettersUrl });

// 12:00 in Israel on 11.11.2026 (UTC+2).
const NOON = Date.UTC(2026, 10, 11, 10, 0);

// ------------------------------------------------------------------ helpers

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

function ctxOf(config, riddles, { seed = 7, now = NOON } = {}) {
  return { config, riddles, now, rng: E.createSeededRng(seed) };
}

function newPlayer(id = 'p1') {
  return E.createPlayer({ id, familyName: 'כהן', emoji: '🦊', recoveryCode: 'ABC123', now: NOON });
}

function riddle(id, gnomeId, answerWord, extra = {}) {
  return {
    id, gnomeId, type: 'observe', text: `חידה ${id}`, answerWord, letter: L.letterOfAnswer(answerWord),
    acceptSoundAlike: true, hints: ['רמז 1', 'רמז 2'], difficulty: 1, status: 'published', ...extra,
  };
}

function spot(id, extra = {}) {
  return { id, name: `נקודה ${id}`, hints: [`אזור ${id}`, `קרוב ${id}`, `מדויק ${id}`], isActive: true, ...extra };
}

function gnome(id, number, spotId, bodyColor, hatColor, extra = {}) {
  return {
    id, number, code: `code-${id}`, manualCode: `M${number}`, spotId, bodyColor, hatColor,
    isActive: true, verifiedOnSite: true, ...extra,
  };
}

function baseConfig(over = {}) {
  return {
    status: 'published', title: 'הקוד', language: 'he', spots: [], gnomes: [], phrases: [],
    rules: { ...E.DEFAULT_THECODE_RULES }, requirePhoneVerification: false, retentionDays: 90, ...over,
  };
}

/** Play the current run to the end: scan each target, answer it, open the suitcase. */
function playToEnd(player, ctx, { onStep } = {}) {
  let p = player;
  for (let i = 0; i < 200; i++) {
    const run = p.run;
    if (run.state === 'arranging') {
      const phrase = ctx.config.phrases.find((x) => x.id === run.phraseId);
      const r = E.openSuitcase(p, L.phraseLetters(phrase.text), ctx);
      assert.equal(r.outcome.kind, 'opened');
      return r.player;
    }
    assert.equal(run.state, 'collecting');
    const slot = run.slots[run.targetSlotIndex];
    assert.equal(slot.status, 'active');
    const s = E.scanGnome(p, slot.gnomeId, ctx);
    assert.equal(s.outcome.kind, 'riddle');
    p = s.player;
    const target = p.run.slots[p.run.targetSlotIndex];
    const a = E.answerRiddle(p, { letter: target.letter, slotIndex: target.index }, ctx);
    assert.equal(a.outcome.kind, 'correct');
    p = a.player;
    onStep?.(p);
  }
  throw new Error('run did not finish');
}

// ------------------------------------------------------------------ fixtures

/** 20 gnomes / 9 spots / 4 phrases, 3 riddles per gnome. */
function bigFixture() {
  const COLORS = ['red', 'blue', 'yellow', 'green', 'black', 'white', 'purple', 'orange'];
  const spots = Array.from({ length: 9 }, (_, i) => spot(`s${i + 1}`));
  const gnomes = Array.from({ length: 20 }, (_, i) => {
    const body = COLORS[i % 8];
    return gnome(`g${i + 1}`, i + 1, `s${(i % 9) + 1}`, body, body === 'orange' ? 'purple' : 'orange');
  });
  const phrases = [
    { id: 'ph1', text: 'נוף גנוסר', isActive: true },
    { id: 'ph2', text: 'ים כחול', isActive: true },
    { id: 'ph3', text: 'שמש חמה', isActive: true },
    { id: 'ph4', text: 'בית מלון', isActive: true },
  ];
  const pool = phrases.flatMap((p) => L.phraseLetters(p.text)); // 27 letters, weighted by demand
  const riddles = [];
  for (let g = 0; g < 20; g++) {
    for (let k = 0; k < 3; k++) {
      const letter = pool[(k * 20 + g) % pool.length];
      riddles.push(riddle(`r${g + 1}_${k}`, `g${g + 1}`, `${letter}ולה`));
    }
  }
  return { config: baseConfig({ spots, gnomes, phrases }), riddles };
}

/**
 * Small world for rule tests. Phrase "כלב".
 *  A: a1 (כ), a2 (ל — spare source)   B: b1 (ל), b2 (ר — not in phrase)   C: c1 (ב)
 */
function smallFixture(over = {}) {
  const config = baseConfig({
    spots: [spot('A'), spot('B'), spot('C')],
    gnomes: [
      gnome('a1', 1, 'A', 'red', 'blue'),
      gnome('a2', 2, 'A', 'yellow', 'blue'),
      gnome('b1', 3, 'B', 'black', 'white'),
      gnome('b2', 4, 'B', 'white', 'black'),
      gnome('c1', 5, 'C', 'purple', 'orange'),
    ],
    phrases: [{ id: 'kelev', text: 'כלב', isActive: true }],
    ...over,
  });
  const riddles = [
    riddle('rk', 'a1', 'כובע'),
    riddle('rl2', 'a2', 'לימון'),
    riddle('rl', 'b1', 'לול'),
    riddle('rr', 'b2', 'רכבת'),
    riddle('rb', 'c1', 'בית'),
  ];
  return { config, riddles };
}

/** Start at a1 (yields כ → slot 0, already the target). */
function startSmall(over = {}, seed = 3) {
  const { config, riddles } = smallFixture(over);
  const ctx = ctxOf(config, riddles, { seed });
  const r = E.scanGnome(newPlayer(), 'a1', ctx);
  assert.equal(r.outcome.kind, 'riddle');
  assert.equal(r.outcome.slotIndex, 0);
  return { ctx, player: r.player };
}

// ================================================================== rules

test('rules: defaults exported, operator values merged, junk falls back', () => {
  assert.equal(E.DEFAULT_THECODE_RULES.pointsPerLetter, 10);
  const r = E.resolveRules({ pointsPerLetter: 20, hintCost: -1, freeWrongScans: 'x' });
  assert.equal(r.pointsPerLetter, 20);
  assert.equal(r.hintCost, E.DEFAULT_THECODE_RULES.hintCost);
  assert.equal(r.freeWrongScans, E.DEFAULT_THECODE_RULES.freeWrongScans);
  assert.deepEqual(E.resolveRules(undefined), E.DEFAULT_THECODE_RULES);
});

// ================================================================== validation

test('validation: the 20-gnome fixture is clean and a new family gets 4 fresh suitcases', () => {
  const { config, riddles } = bigFixture();
  const report = E.analyzeAdventure(config, riddles);
  assert.deepEqual(report.issues, []);
  assert.equal(report.freshSuitcases, 4);
  assert.ok(report.phrases.every((p) => p.playable && p.missing.length === 0));
  const nof = report.phrases.find((p) => p.phraseId === 'ph1');
  assert.deepEqual(nof.coverage.find((c) => c.letter === 'נ').need, 2);
  assert.ok(E.canPublish(report.issues));
});

test('validation: every issue code is reachable', () => {
  const config = baseConfig({
    spots: [spot('A'), spot('B', { hints: [] }), spot('C')],
    gnomes: [
      gnome('a1', 1, 'A', 'red', 'blue'),
      gnome('a2', 2, 'A', 'red', 'blue'),          // duplicate of a1
      gnome('c1', 3, 'C', 'red', 'white'),
      gnome('c2', 4, 'C', 'green', 'white', { verifiedOnSite: false }), // red/green pair
      gnome('b1', 5, 'B', 'black', 'white'),       // no riddle
      gnome('x1', 6, 'NOPE', 'black', 'black'),    // spot missing
    ],
    phrases: [
      { id: 'digits', text: 'חדר 7', isActive: true },
      { id: 'short', text: 'א', isActive: true },
      { id: 'missing', text: 'זה', isActive: true },
    ],
  });
  const riddles = [
    riddle('r1', 'a1', 'הר'),
    riddle('r2', 'c1', 'טלה', { acceptSoundAlike: false }), // ט sounds like ת
  ];
  const issues = E.validateAdventure(config, riddles);
  const codes = new Set(issues.map((i) => i.code));
  for (const code of [
    'PHRASE_LETTER_MISSING', 'PHRASE_INVALID_CHARS', 'PHRASE_TOO_SHORT', 'GNOME_WITHOUT_RIDDLE',
    'GNOME_SPOT_MISSING', 'DUPLICATE_COLORS_AT_SPOT', 'CONFUSABLE_COLORS_AT_SPOT', 'SPOT_WITHOUT_HINT',
    'RIDDLE_AMBIGUOUS_LETTER', 'GNOME_NOT_VERIFIED', 'FEW_FRESH_ROUNDS',
  ]) assert.ok(codes.has(code), `missing ${code}`);
  assert.ok(!E.canPublish(issues));
  const z = issues.find((i) => i.code === 'PHRASE_LETTER_MISSING' && i.letter === 'ז');
  assert.deepEqual([z.need, z.have, z.phraseId, z.severity], [1, 0, 'missing', 'error']);
  assert.match(z.message, /ז/);
  assert.equal(issues.find((i) => i.code === 'DUPLICATE_COLORS_AT_SPOT').severity, 'error');
  assert.equal(issues.find((i) => i.code === 'CONFUSABLE_COLORS_AT_SPOT').severity, 'warning');

  const none = E.validateAdventure(baseConfig({ phrases: [{ id: 'off', text: 'שלום', isActive: false }] }), []);
  assert.ok(none.some((i) => i.code === 'NO_ACTIVE_PHRASE' && i.severity === 'error'));
});

test('validation: a letter shared by one gnome is missing (repeated letters need distinct gnomes)', () => {
  const config = baseConfig({
    spots: [spot('A')],
    gnomes: [gnome('a1', 1, 'A', 'red', 'blue'), gnome('a2', 2, 'A', 'blue', 'red')],
    phrases: [{ id: 'mm', text: 'ממ', isActive: true }, { id: 'no', text: 'נו', isActive: true }],
  });
  // a1 holds both מ and נ+ו riddles; a2 only ו. "ממ" needs 2 gnomes with מ → only 1.
  const riddles = [riddle('m1', 'a1', 'מים'), riddle('m2', 'a1', 'מגדל'), riddle('n1', 'a1', 'נר'), riddle('v1', 'a2', 'ורד')];
  const rep = E.analyzeAdventure(config, riddles);
  const mm = rep.phrases.find((p) => p.phraseId === 'mm');
  assert.equal(mm.playable, false);
  assert.deepEqual(mm.coverage, [{ letter: 'מ', need: 2, have: 1 }]);
  assert.deepEqual(mm.missing, [{ letter: 'מ', need: 2, have: 1 }]);
  assert.equal(rep.phrases.find((p) => p.phraseId === 'no').playable, true);
  // The unplayable phrase is never allocated, whatever the seed.
  for (let seed = 1; seed <= 30; seed++) {
    const b = E.buildRun(newPlayer(), ctxOf(config, riddles, { seed }));
    assert.equal(b.kind, 'run');
    assert.equal(b.run.phraseId, 'no');
  }
});

test('validation: a phrase with an uncovered letter is reported and never allocated', () => {
  const { config, riddles } = bigFixture();
  const cfg = { ...config, phrases: [...config.phrases, { id: 'zz', text: 'זה זה', isActive: true }] };
  const issues = E.validateAdventure(cfg, riddles);
  const z = issues.filter((i) => i.code === 'PHRASE_LETTER_MISSING');
  assert.equal(z.length, 1);
  assert.deepEqual([z[0].phraseId, z[0].letter, z[0].need, z[0].have], ['zz', 'ז', 2, 0]);
  for (let seed = 1; seed <= 25; seed++) {
    const b = E.buildRun(newPlayer(), ctxOf(cfg, riddles, { seed }));
    assert.notEqual(b.run.phraseId, 'zz');
  }
  const only = { ...cfg, phrases: [cfg.phrases[4]] };
  assert.deepEqual(E.buildRun(newPlayer(), ctxOf(only, riddles)), { kind: 'allDone' });
});

// ================================================================== run building

test('build: starting from EVERY gnome of the 20-gnome fixture gives a completable run', () => {
  const { config, riddles } = bigFixture();
  deepFreeze(config);
  deepFreeze(riddles);
  for (const g of config.gnomes) {
    const ctx = ctxOf(config, riddles, { seed: g.number });
    const start = E.scanGnome(newPlayer(), g.id, ctx);
    assert.equal(start.outcome.kind, 'riddle', `gnome ${g.id}`);
    const run = start.player.run;
    const target = run.slots[run.targetSlotIndex];
    assert.equal(target.gnomeId, g.id, 'the scanned gnome is slot one');
    assert.equal(target.status, 'active');
    // Distinct gnomes per slot (repeated letters too), distinct riddles, letters match riddles.
    assert.equal(new Set(run.slots.map((s) => s.gnomeId)).size, run.slots.length);
    assert.equal(new Set(run.slots.map((s) => s.riddleId)).size, run.slots.length);
    for (const s of run.slots) {
      const r = riddles.find((x) => x.id === s.riddleId);
      assert.equal(r.gnomeId, s.gnomeId);
      assert.equal(E.riddleLetter(r), s.letter);
    }
    const phrase = config.phrases.find((p) => p.id === run.phraseId);
    assert.deepEqual(run.slots.map((s) => s.letter), L.phraseLetters(phrase.text));
    const done = playToEnd(start.player, ctx);
    assert.equal(done.run.state, 'opened');
    assert.equal(done.suitcasesOpened, 1);
    assert.deepEqual(done.openedPhraseIds, [phrase.id]);
  }
});

test('build: repeated letters use distinct gnomes ("נוף גנוסר" has נ×2, ו×2)', () => {
  const { config, riddles } = bigFixture();
  const only = { ...config, phrases: [config.phrases[0]] };
  for (let seed = 1; seed <= 20; seed++) {
    const b = E.buildRun(newPlayer(), ctxOf(only, riddles, { seed }));
    const nun = b.run.slots.filter((s) => s.letter === 'נ').map((s) => s.gnomeId);
    const vav = b.run.slots.filter((s) => s.letter === 'ו').map((s) => s.gnomeId);
    assert.equal(nun.length, 2);
    assert.notEqual(nun[0], nun[1]);
    assert.notEqual(vav[0], vav[1]);
  }
});

test('build: prefers never-found gnomes and spreads over spots', () => {
  const config = baseConfig({
    spots: [spot('A'), spot('B'), spot('C')],
    gnomes: [
      gnome('a1', 1, 'A', 'red', 'blue'), gnome('a2', 2, 'A', 'blue', 'red'),
      gnome('b1', 3, 'B', 'red', 'blue'), gnome('c1', 4, 'C', 'red', 'blue'),
    ],
    phrases: [{ id: 'aa', text: 'אא', isActive: true }],
  });
  const riddles = ['a1', 'a2', 'b1', 'c1'].map((g) => riddle(`r-${g}`, g, 'אריה'));
  for (let seed = 1; seed <= 20; seed++) {
    const b = E.buildRun(newPlayer(), ctxOf(config, riddles, { seed }));
    const spots = b.run.slots.map((s) => config.gnomes.find((g) => g.id === s.gnomeId).spotId);
    assert.notEqual(spots[0], spots[1], 'two different spots when possible');
    const found = { ...newPlayer(), foundGnomeIds: ['b1', 'c1'] };
    const b2 = E.buildRun(found, ctxOf(config, riddles, { seed }));
    assert.deepEqual(b2.run.slots.map((s) => s.gnomeId).sort(), ['a1', 'a2'], 'never-found gnomes first');
  }
});

test('build: deterministic — same seed, same run; the inputs are never mutated', () => {
  const { config, riddles } = bigFixture();
  deepFreeze(config);
  deepFreeze(riddles);
  const p = deepFreeze(newPlayer());
  const a = E.buildRun(p, ctxOf(config, riddles, { seed: 42 }), { firstGnomeId: 'g5' });
  const b = E.buildRun(p, ctxOf(config, riddles, { seed: 42 }), { firstGnomeId: 'g5' });
  assert.deepEqual(a, b);
  const runs = new Set();
  for (let seed = 1; seed <= 10; seed++) runs.add(JSON.stringify(E.buildRun(p, ctxOf(config, riddles, { seed })).run.slots));
  assert.ok(runs.size > 1, 'different seeds give different runs');
  // Whole game on frozen inputs: any mutation would throw in strict mode.
  const ctx = ctxOf(config, riddles, { seed: 9 });
  const s = E.scanGnome(p, 'g1', ctx);
  playToEnd(deepFreeze(s.player), ctx, { onStep: deepFreeze });
});

test('build: a gnome with nothing to give starts the run elsewhere (runStarted)', () => {
  const { config, riddles } = smallFixture();
  const r = E.scanGnome(newPlayer(), 'b2', ctxOf(config, riddles)); // b2 only has ר
  assert.equal(r.outcome.kind, 'runStarted');
  assert.equal(r.outcome.targetSlotIndex, r.player.run.targetSlotIndex);
  assert.ok(!r.player.run.slots.some((s) => s.gnomeId === 'b2'));
});

// ================================================================== returning players

test('returning player: only unsolved riddles, then an honest "all done"', () => {
  const { config, riddles } = bigFixture();
  const ctx = ctxOf(config, riddles, { seed: 11 });
  let p = newPlayer();
  const seen = new Set();
  for (let round = 0; round < 10; round++) {
    const first = config.gnomes[round % config.gnomes.length].id;
    const s = E.scanGnome(p, first, ctx);
    if (s.outcome.kind === 'allDone') break;
    for (const slot of s.player.run.slots) {
      assert.ok(!seen.has(slot.riddleId), 'a solved riddle is never replayed');
      assert.ok(!p.solvedRiddleIds.includes(slot.riddleId));
    }
    p = playToEnd(s.player, ctx);
    for (const slot of p.run.slots) seen.add(slot.riddleId);
  }
  assert.equal(p.suitcasesOpened, 4);
  assert.equal(new Set(p.openedPhraseIds).size, 4);
  const end = E.scanGnome(p, 'g1', ctx);
  assert.equal(end.outcome.kind, 'allDone');
  assert.equal(end.player.run.state, 'opened');
});

test('returning player: riddles run out before phrases → allDone with phrases left unopened', () => {
  const { config, riddles } = smallFixture({
    phrases: [{ id: 'kelev', text: 'כלב', isActive: true }, { id: 'kal', text: 'כל', isActive: true }],
  });
  const ctx = ctxOf(config, riddles, { seed: 5 });
  let p = newPlayer();
  let opened = 0;
  for (let i = 0; i < 5; i++) {
    const s = E.scanGnome(p, 'a1', ctx);
    if (s.outcome.kind === 'allDone') break;
    p = playToEnd(s.player, ctx);
    opened++;
  }
  // Only one כ riddle exists → whichever phrase came first, the second can never be built.
  assert.equal(opened, 1);
  assert.equal(E.scanGnome(p, 'a1', ctx).outcome.kind, 'allDone');
  assert.equal(E.countFreshSuitcases(config, riddles), 1);
});

// ================================================================== scanning

test('scan: wrong gnomes — first N free per target, then penalty; the same one never twice', () => {
  const { ctx, player } = startSmall({ rules: { ...E.DEFAULT_THECODE_RULES, freeWrongScans: 2, wrongScanPenalty: 4 } });
  let p = { ...player, points: 10 };
  const wrong = p.run.slots.filter((s) => s.index !== p.run.targetSlotIndex).map((s) => s.gnomeId);
  wrong.push('b2');
  let r = E.scanGnome(p, wrong[0], ctx);
  assert.deepEqual(r.outcome, { kind: 'wrongGnome', penalty: 0, freeLeft: 1 });
  r = E.scanGnome(r.player, wrong[0], ctx); // same wrong gnome again
  assert.deepEqual(r.outcome, { kind: 'wrongGnome', penalty: 0, freeLeft: 1 });
  r = E.scanGnome(r.player, wrong[1], ctx);
  assert.deepEqual(r.outcome, { kind: 'wrongGnome', penalty: 0, freeLeft: 0 });
  r = E.scanGnome(r.player, wrong[2], ctx);
  assert.deepEqual(r.outcome, { kind: 'wrongGnome', penalty: 4, freeLeft: 0 });
  assert.equal(r.player.points, 6);
  r = E.scanGnome(r.player, wrong[2], ctx);
  assert.equal(r.outcome.penalty, 0);
  assert.equal(r.player.points, 6);
  assert.equal(r.player.run.targetSlotIndex, p.run.targetSlotIndex, 'only the target counts — nothing moved');
});

test('scan: penalties never push points below 0; free scans reset on a new target', () => {
  const { ctx, player } = startSmall();
  let p = { ...player, points: 2 };
  const others = ['b1', 'c1', 'b2', 'a2'];
  for (const g of others) p = E.scanGnome(p, g, ctx).player;
  assert.equal(p.points, 0);
  // Solve the target → new target → wrong-scan list starts empty.
  const t = p.run.slots[p.run.targetSlotIndex];
  p = E.answerRiddle(p, { letter: t.letter, slotIndex: t.index }, ctx).player;
  assert.deepEqual(p.run.wrongGnomeIdsOnTarget, []);
  const nextTarget = p.run.slots[p.run.targetSlotIndex].gnomeId;
  const wrong = ['b2', 'a2'].find((g) => g !== nextTarget);
  assert.equal(E.scanGnome(p, wrong, ctx).outcome.freeLeft, 0);
  assert.equal(E.scanGnome(p, wrong, ctx).outcome.penalty, 0);
});

test('scan: re-scanning the target is idempotent; a gnome solved this run is alreadySolved', () => {
  const { ctx, player } = startSmall();
  const again = E.scanGnome(player, 'a1', ctx);
  assert.deepEqual(again.outcome, { kind: 'riddle', slotIndex: 0 });
  assert.deepEqual({ ...again.player, lastSeenAt: 0 }, { ...player, lastSeenAt: 0 });
  const solved = E.answerRiddle(player, { letter: 'כ', slotIndex: 0 }, ctx).player;
  const r = E.scanGnome({ ...solved, points: 5 }, 'a1', ctx);
  assert.deepEqual(r.outcome, { kind: 'alreadySolved' });
  assert.equal(r.player.points, 5);
  assert.deepEqual(r.player.run.wrongGnomeIdsOnTarget, []);
});

test('scan: inactive gnome / spot → gnomeAsleep; paused or closed hours → paused, state untouched', () => {
  const { ctx, player } = startSmall();
  const cfgOff = { ...ctx.config, gnomes: ctx.config.gnomes.map((g) => (g.id === 'b2' ? { ...g, isActive: false } : g)) };
  assert.equal(E.scanGnome(player, 'b2', { ...ctx, config: cfgOff }).outcome.kind, 'gnomeAsleep');
  assert.equal(E.scanGnome(player, 'nope', ctx).outcome.kind, 'gnomeAsleep');
  const spotOff = { ...ctx.config, spots: ctx.config.spots.map((s) => (s.id === 'B' ? { ...s, isActive: false } : s)) };
  assert.equal(E.scanGnome(player, 'b2', { ...ctx, config: spotOff }).outcome.kind, 'gnomeAsleep');

  for (const config of [
    { ...ctx.config, status: 'paused' },
    { ...ctx.config, status: 'draft' },
    { ...ctx.config, activeHours: { from: '14:00', to: '21:00' } }, // it is 12:00 in Israel
  ]) {
    const c = { ...ctx, config };
    const s = E.scanGnome(player, 'b1', c);
    assert.deepEqual(s.outcome, { kind: 'paused' });
    assert.equal(s.player, player, 'same object back — untouched');
    assert.equal(E.answerRiddle(player, { letter: 'כ' }, c).outcome.kind, 'paused');
    assert.equal(E.requestHint(player, 'riddle', c).outcome.kind, 'paused');
  }
  assert.equal(E.scanGnome(player, 'a1', { ...ctx, config: { ...ctx.config, activeHours: { from: '08:00', to: '21:00' } } }).outcome.kind, 'riddle');
});

test('activeHours: venue time zone, overnight windows, malformed = always open', () => {
  assert.equal(E.isWithinActiveHours({ from: '11:30', to: '12:30' }, NOON), true);
  assert.equal(E.isWithinActiveHours({ from: '11:30', to: '12:30' }, NOON, 'UTC'), false); // 10:00 UTC
  assert.equal(E.isWithinActiveHours({ from: '20:00', to: '02:00' }, Date.UTC(2026, 10, 11, 23, 0)), true); // 01:00 IL
  assert.equal(E.isWithinActiveHours({ from: '20:00', to: '02:00' }, NOON), false);
  assert.equal(E.isWithinActiveHours({ from: 'x', to: '02:00' }, NOON), true);
  assert.equal(E.isWithinActiveHours(undefined, NOON), true);
});

// ================================================================== answering

test('answer: correct = pointsPerLetter, letter collected, next target at another spot', () => {
  const { ctx, player } = startSmall();
  const r = E.answerRiddle(player, { letter: 'כ', slotIndex: 0 }, ctx);
  assert.deepEqual(r.outcome, { kind: 'correct', letter: 'כ', points: 10, hot: false, runState: 'collecting' });
  assert.equal(r.player.points, 10);
  assert.equal(r.player.streak, 1);
  assert.equal(r.player.run.slots[0].status, 'solved');
  assert.deepEqual(E.collectedLetters(r.player.run), [{ index: 0, letter: 'כ', gifted: false }]);
  const next = r.player.run.slots[r.player.run.targetSlotIndex];
  const nextSpot = ctx.config.gnomes.find((g) => g.id === next.gnomeId).spotId;
  assert.notEqual(nextSpot, 'A', 'prefers a different spot from the previous one');
  assert.equal(next.status, 'active');
  assert.equal(next.locationHintsUsed, 1, 'zone hint comes free with the target');
});

test('answer: hot streak — × multiplier once the streak reached hotStreakAt', () => {
  const { ctx, player } = startSmall({ rules: { ...E.DEFAULT_THECODE_RULES, hotStreakAt: 2, hotMultiplier: 3 } });
  let p = { ...player, streak: 1 };
  let r = E.answerRiddle(p, { letter: 'כ', slotIndex: 0 }, ctx);
  assert.deepEqual([r.outcome.points, r.outcome.hot], [10, false]);
  p = r.player; // streak 2 → hot from the next answer
  let t = p.run.slots[p.run.targetSlotIndex];
  p = E.scanGnome(p, t.gnomeId, ctx).player;
  r = E.answerRiddle(p, { letter: t.letter, slotIndex: t.index }, ctx);
  assert.deepEqual([r.outcome.points, r.outcome.hot], [30, true]);
  // A mistake ends it.
  p = r.player;
  t = p.run.slots[p.run.targetSlotIndex];
  p = E.answerRiddle(p, { letter: 'ש', slotIndex: t.index }, ctx).player;
  assert.equal(p.streak, 0);
  r = E.answerRiddle(p, { letter: t.letter, slotIndex: t.index }, ctx);
  assert.deepEqual([r.outcome.points, r.outcome.hot, r.outcome.runState], [10, false, 'arranging']);
});

test('answer: sound-alike counts as correct, returns a spelling tip, stores the right letter', () => {
  const { ctx, player } = startSmall();
  const r = E.answerRiddle(player, { letter: 'ק', slotIndex: 0 }, ctx);
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.outcome.letter, 'כ');
  assert.match(r.outcome.spellingTip, /כ/);
  assert.equal(r.player.run.slots[0].letter, 'כ');
  // Not accepted when the riddle does not allow it.
  const strict = ctx.riddles.map((x) => (x.id === 'rk' ? { ...x, acceptSoundAlike: false } : x));
  assert.equal(E.answerRiddle(player, { letter: 'ק', slotIndex: 0 }, { ...ctx, riddles: strict }).outcome.kind, 'wrong');
});

test('answer: wrong — free ones, then penalty + cooldown; cooldown blocks; points ≥ 0', () => {
  const rules = { ...E.DEFAULT_THECODE_RULES, freeWrongAnswers: 2, wrongAnswerPenalty: 3, answerCooldownSeconds: 10 };
  const { ctx, player } = startSmall({ rules });
  let p = { ...player, points: 4, streak: 2 };
  let r = E.answerRiddle(p, { letter: 'ש', slotIndex: 0 }, ctx);
  assert.deepEqual(r.outcome, { kind: 'wrong', penalty: 0, hintAvailable: true });
  assert.equal(r.player.streak, 0);
  r = E.answerRiddle(r.player, { letter: 'ש', slotIndex: 0 }, ctx);
  assert.equal(r.outcome.penalty, 0);
  r = E.answerRiddle(r.player, { letter: 'ש', slotIndex: 0 }, ctx);
  assert.deepEqual(r.outcome, { kind: 'wrong', penalty: 3, cooldownUntil: NOON + 10000, hintAvailable: true });
  assert.equal(r.player.points, 1);
  p = r.player;
  const blocked = E.answerRiddle(p, { letter: 'כ', slotIndex: 0 }, { ...ctx, now: NOON + 5000 });
  assert.deepEqual(blocked.outcome, { kind: 'cooldown', cooldownUntil: NOON + 10000 });
  assert.equal(blocked.player.run.slots[0].status, 'active');
  r = E.answerRiddle(p, { letter: 'ש', slotIndex: 0 }, { ...ctx, now: NOON + 10000 });
  assert.equal(r.outcome.penalty, 1, 'only what is left — never below 0');
  assert.equal(r.player.points, 0);
  r = E.answerRiddle(r.player, { letter: 'כ', slotIndex: 0 }, { ...ctx, now: NOON + 20000 });
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.player.points, 10);
});

test('answer: double tap / retry never double-awards; collected letters are never removed', () => {
  const { ctx, player } = startSmall();
  const first = E.answerRiddle(player, { letter: 'כ', slotIndex: 0 }, ctx);
  const second = E.answerRiddle(first.player, { letter: 'כ', slotIndex: 0 }, ctx);
  assert.equal(second.replayed, true);
  assert.equal(second.outcome.kind, 'correct');
  assert.equal(second.player.points, first.player.points);
  assert.deepEqual(second.player.run, first.player.run);
  // A wrong tap that arrives late for a solved slot changes nothing either.
  const late = E.answerRiddle(first.player, { letter: 'ש', slotIndex: 0 }, ctx);
  assert.equal(late.replayed, true);
  assert.equal(late.player.run.slots[0].status, 'solved');
  // Answering a slot that is not the target → noRiddle.
  const notTarget = first.player.run.slots.find((s) => s.status === 'pending');
  assert.equal(E.answerRiddle(first.player, { letter: notTarget.letter, slotIndex: notTarget.index }, ctx).outcome.kind, 'noRiddle');
  // Wrong answers on the next slot never take the collected כ away.
  let p = first.player;
  const t = p.run.slots[p.run.targetSlotIndex];
  for (let i = 0; i < 5; i++) p = E.answerRiddle(p, { letter: 'ש', slotIndex: t.index }, { ...ctx, now: NOON + i * 60000 }).player;
  assert.deepEqual(E.collectedLetters(p.run).map((x) => x.letter), ['כ']);
});

// ================================================================== hints

test('hints: riddle hint free then hintCost; location hints cost (zone was free); both break the streak', () => {
  const { ctx, player } = startSmall({ rules: { ...E.DEFAULT_THECODE_RULES, hintCost: 4 } });
  let p = { ...player, points: 10, streak: 3 };
  assert.deepEqual(E.visibleLocationHints(p, ctx.config), ['אזור A']);
  let r = E.requestHint(p, 'riddle', ctx);
  assert.deepEqual(r.outcome, { kind: 'hint', hintKind: 'riddle', text: 'רמז 1', hintNumber: 1, cost: 0, remaining: 1 });
  assert.equal(r.player.streak, 0);
  r = E.requestHint(r.player, 'riddle', ctx);
  assert.deepEqual([r.outcome.text, r.outcome.cost, r.player.points], ['רמז 2', 4, 6]);
  assert.equal(E.requestHint(r.player, 'riddle', ctx).outcome.kind, 'noMoreHints');
  r = E.requestHint(r.player, 'location', ctx);
  assert.deepEqual([r.outcome.text, r.outcome.hintNumber, r.outcome.cost, r.player.points], ['קרוב A', 2, 4, 2]);
  r = E.requestHint(r.player, 'location', ctx);
  assert.deepEqual([r.outcome.text, r.outcome.cost, r.player.points], ['מדויק A', 2, 0]);
  assert.equal(E.requestHint(r.player, 'location', ctx).outcome.kind, 'noMoreHints');
  assert.deepEqual(E.visibleLocationHints(r.player, ctx.config), ['אזור A', 'קרוב A', 'מדויק A']);
  // A wrong answer reports whether a riddle hint is still available.
  assert.equal(E.answerRiddle(r.player, { letter: 'ש' }, ctx).outcome.hintAvailable, false);
});

// ================================================================== arrange + open

test('arrange + open: order checked, final forms / niqqud ignored, bonus once', () => {
  const { config } = smallFixture({ phrases: [{ id: 'nof', text: 'נוֹף', isActive: true }] });
  const cfg = {
    ...config,
    gnomes: [...config.gnomes, gnome('d1', 6, 'C', 'yellow', 'green')],
  };
  const rid = [riddle('n', 'a1', 'נֵר'), riddle('v', 'b1', 'וִילוֹן'), riddle('p', 'c1', 'פִּיל'), riddle('p2', 'd1', 'פרח')];
  const ctx = ctxOf(cfg, rid, { seed: 2 });
  let p = E.scanGnome(newPlayer(), 'c1', ctx).player;
  assert.deepEqual(p.run.slots.map((s) => s.letter), ['נ', 'ו', 'פ']);
  // Typing the final form ף for the פ riddle is exact.
  const t = p.run.slots[p.run.targetSlotIndex];
  assert.equal(t.letter, 'פ');
  const r = E.answerRiddle(p, { letter: 'ף', slotIndex: t.index }, ctx);
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.outcome.spellingTip, undefined);
  p = r.player;
  // Finish the rest.
  while (p.run.state === 'collecting') {
    const s = p.run.slots[p.run.targetSlotIndex];
    p = E.answerRiddle(E.scanGnome(p, s.gnomeId, ctx).player, { letter: s.letter, slotIndex: s.index }, ctx).player;
  }
  assert.equal(p.run.state, 'arranging');
  assert.equal(E.scanGnome(p, 'b2', ctx).outcome.kind, 'arranging');
  const bad = E.arrangeLetters(p, ['פ', 'ו', 'נ'], ctx);
  assert.deepEqual(bad, { kind: 'checked', result: { correct: false, positions: [false, true, false], expectedLength: 3 } });
  assert.equal(E.openSuitcase(p, ['פ', 'ו', 'נ'], ctx).outcome.kind, 'wrongOrder');
  assert.equal(E.arrangeLetters(p, ['נ', 'ו', 'ף'], ctx).result.correct, true);
  const before = p.points;
  const open = E.openSuitcase(p, ['נ', 'וֹ', 'ף'], ctx);
  assert.deepEqual(open.outcome, { kind: 'opened', bonus: 50, suitcasesOpened: 1, replayed: false });
  assert.equal(open.player.points, before + 50);
  assert.deepEqual(open.player.openedPhraseIds, ['nof']);
  assert.deepEqual([...open.player.solvedRiddleIds].sort(), open.player.run.slots.map((s) => s.riddleId).sort());
  assert.deepEqual([...open.player.foundGnomeIds].sort(), open.player.run.slots.map((s) => s.gnomeId).sort());
  const twice = E.openSuitcase(open.player, ['נ', 'ו', 'ף'], ctx);
  assert.equal(twice.outcome.replayed, true);
  assert.equal(twice.player.points, open.player.points);
  assert.equal(E.arrangeLetters(newPlayer(), ['נ'], ctx).kind, 'notReady');
});

// ================================================================== repair

test('repair: disabling the target gnome mid-run swaps to another source of the same letter', () => {
  const { ctx, player } = startSmall();
  let p = E.answerRiddle(player, { letter: 'כ', slotIndex: 0 }, ctx).player;
  // Force ל (slot 1) to be the target, sitting on b1 or a2.
  if (p.run.targetSlotIndex !== 1) {
    p = E.answerRiddle(p, { letter: 'ב', slotIndex: 2 }, ctx).player;
  }
  const lamed = p.run.slots[1];
  assert.equal(p.run.targetSlotIndex, 1);
  const spare = lamed.gnomeId === 'b1' ? 'a2' : 'b1';
  p = { ...p, run: { ...p.run, wrongGnomeIdsOnTarget: ['b2'] } };
  const cfg = { ...ctx.config, gnomes: ctx.config.gnomes.map((g) => (g.id === lamed.gnomeId ? { ...g, isActive: false } : g)) };
  const c2 = { ...ctx, config: cfg };
  const rep = E.repairRun(p, c2);
  assert.equal(rep.repairs.length, 1);
  assert.deepEqual([rep.repairs[0].action, rep.repairs[0].toGnomeId], ['swapped', spare]);
  assert.equal(rep.retargeted, true);
  assert.equal(rep.player.run.targetSlotIndex, 1);
  assert.equal(rep.player.run.slots[1].gnomeId, spare);
  assert.deepEqual(rep.player.run.wrongGnomeIdsOnTarget, [], 'a new hunt');
  // Scanning the dead gnome says it sleeps; scanning the new one opens the riddle.
  assert.equal(E.scanGnome(p, lamed.gnomeId, c2).outcome.kind, 'gnomeAsleep');
  assert.deepEqual(E.scanGnome(p, spare, c2).outcome, { kind: 'riddle', slotIndex: 1 });
  assert.equal(p.run.slots[1].gnomeId, lamed.gnomeId, 'input untouched');
});

test('repair: no other source → the letter is GIFTED (no points) and the run re-targets', () => {
  const { ctx, player } = startSmall();
  const p = E.answerRiddle(player, { letter: 'כ', slotIndex: 0 }, ctx).player;
  const bet = p.run.slots[2]; // ב only exists on c1
  const riddles = ctx.riddles.map((r) => (r.id === 'rb' ? { ...r, status: 'disabled' } : r));
  const c2 = { ...ctx, riddles };
  const rep = E.repairRun(p, c2);
  assert.deepEqual(rep.repairs.map((x) => [x.slotIndex, x.action]), [[2, 'gifted']]);
  assert.equal(rep.player.run.slots[2].status, 'gifted');
  assert.equal(rep.player.run.slots[2].pointsEarned, 0);
  assert.equal(rep.player.run.targetSlotIndex, 1);
  assert.equal(rep.player.points, p.points);
  // The run still completes; the gifted letter is in the collector and not "solved".
  let q = rep.player;
  const t = q.run.slots[1];
  q = E.answerRiddle(E.scanGnome(q, t.gnomeId, c2).player, { letter: 'ל', slotIndex: 1 }, c2).player;
  assert.equal(q.run.state, 'arranging');
  assert.deepEqual(E.collectedLetters(q.run).map((x) => [x.letter, x.gifted]), [['כ', false], ['ל', false], ['ב', true]]);
  const open = E.openSuitcase(q, ['כ', 'ל', 'ב'], c2).player;
  assert.ok(!open.solvedRiddleIds.includes(bet.riddleId));
  assert.ok(!open.foundGnomeIds.includes('c1'));
});

test('repair: a disabled TARGET with no source gifts and moves on; last slot gifted → arranging', () => {
  const { ctx, player } = startSmall();
  // Target is כ on a1 — the only כ. Turn a1 off.
  const cfg = { ...ctx.config, gnomes: ctx.config.gnomes.map((g) => (g.id === 'a1' ? { ...g, isActive: false } : g)) };
  const c2 = { ...ctx, config: cfg };
  const s = E.scanGnome(player, 'a1', c2);
  assert.equal(s.outcome.kind, 'gnomeAsleep');
  assert.equal(s.player.run.slots[0].status, 'gifted');
  assert.notEqual(s.player.run.targetSlotIndex, 0);
  // Every source gone → all gifted → arranging; the run can still be opened.
  const empty = { ...c2, riddles: [] };
  const all = E.repairRun(s.player, empty).player;
  assert.equal(all.run.state, 'arranging');
  assert.equal(all.run.targetSlotIndex, null);
  assert.equal(E.openSuitcase(all, ['כ', 'ל', 'ב'], empty).outcome.kind, 'opened');
});

test('repair: an edited riddle whose letter changed is repaired; a moved spot keeps working', () => {
  const { ctx, player } = startSmall();
  const p = E.answerRiddle(player, { letter: 'כ', slotIndex: 0 }, ctx).player;
  const lamed = p.run.slots[1];
  const riddles = ctx.riddles.map((r) => (r.id === lamed.riddleId ? { ...r, answerWord: 'שמש', letter: 'ש' } : r));
  const rep = E.repairRun(p, { ...ctx, riddles });
  assert.equal(rep.repairs[0].action, 'swapped');
  assert.notEqual(rep.player.run.slots[1].riddleId, lamed.riddleId);
  assert.equal(rep.player.run.slots[1].letter, 'ל');
  // Healthy run → the same object comes back.
  assert.equal(E.repairRun(p, ctx).player, p);
  // Gnome moved to another active spot: still usable, nothing repaired.
  const moved = { ...ctx.config, gnomes: ctx.config.gnomes.map((g) => (g.id === 'c1' ? { ...g, spotId: 'A' } : g)) };
  assert.deepEqual(E.repairRun(p, { ...ctx, config: moved }).repairs, []);
});

test('repair: a hidden pending slot is re-shuffled to free a gnome for a broken one', () => {
  // Phrase "אב": א only on g1 or g2; ב only on g2. If ב's riddle on g2 dies but g2 also
  // has a second ב riddle... instead: א on {g1,g2}, ב on {g2,g3}. Kill g3 while א holds g2.
  const config = baseConfig({
    spots: [spot('A'), spot('B'), spot('C')],
    gnomes: [gnome('g1', 1, 'A', 'red', 'blue'), gnome('g2', 2, 'B', 'red', 'blue'), gnome('g3', 3, 'C', 'red', 'blue'), gnome('g4', 4, 'C', 'blue', 'red')],
    phrases: [{ id: 'ab', text: 'אבד', isActive: true }],
  });
  const riddles = [
    riddle('a1', 'g1', 'אריה'), riddle('a2', 'g2', 'אגם'),
    riddle('b2', 'g2', 'בית'), riddle('b3', 'g3', 'בננה'),
    riddle('d4', 'g4', 'דג'),
  ];
  const ctx = ctxOf(config, riddles, { seed: 1 });
  // Start at g4 (ד) so both א and ב are hidden pending slots.
  let p = E.scanGnome(newPlayer(), 'g4', ctx).player;
  p = { ...p, run: { ...p.run, slots: p.run.slots.map((s) => (s.letter === 'א' ? { ...s, gnomeId: 'g2', riddleId: 'a2' } : s.letter === 'ב' ? { ...s, gnomeId: 'g3', riddleId: 'b3' } : s)) } };
  const c2 = { ...ctx, config: { ...config, gnomes: config.gnomes.map((g) => (g.id === 'g3' ? { ...g, isActive: false } : g)) } };
  const rep = E.repairRun(p, c2);
  const byLetter = Object.fromEntries(rep.player.run.slots.map((s) => [s.letter, s]));
  assert.equal(byLetter['ב'].gnomeId, 'g2');
  assert.equal(byLetter['ב'].status, 'pending');
  assert.equal(byLetter['א'].gnomeId, 'g1');
  assert.ok(rep.player.run.slots.every((s) => s.status !== 'gifted'), 'nothing gifted when a re-shuffle works');
});

test('stress: gnomes and riddles disabled at random mid-run — every run still finishes', () => {
  const { config, riddles } = bigFixture();
  let gifted = 0;
  let swapped = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const chaos = E.createSeededRng(seed * 977);
    let cfg = config;
    let rid = riddles;
    const ctx = () => ({ config: cfg, riddles: rid, now: NOON, rng: E.createSeededRng(seed) });
    let p = E.scanGnome(newPlayer(), config.gnomes[seed % 20].id, ctx()).player;
    for (let step = 0; step < 60 && p.run.state === 'collecting'; step++) {
      if (chaos() < 0.5) {
        const g = cfg.gnomes[Math.floor(chaos() * 20)].id;
        cfg = { ...cfg, gnomes: cfg.gnomes.map((x) => (x.id === g ? { ...x, isActive: false } : x)) };
      } else if (chaos() < 0.3) {
        const r = rid[Math.floor(chaos() * rid.length)].id;
        rid = rid.map((x) => (x.id === r ? { ...x, status: 'disabled' } : x));
      }
      const s = E.scanGnome(p, 'g1', ctx()); // any scan runs the repair first
      for (const r of s.repairs) {
        if (r.action === 'gifted') gifted++;
        else swapped++;
      }
      p = s.player;
      if (p.run.state !== 'collecting') break;
      const t = p.run.slots[p.run.targetSlotIndex];
      const at = E.scanGnome(p, t.gnomeId, ctx());
      assert.equal(at.outcome.kind, 'riddle', `seed ${seed}: the target is always a live gnome`);
      p = E.answerRiddle(at.player, { letter: t.letter, slotIndex: t.index }, ctx()).player;
      // Invariant: open slots always hold distinct, usable sources.
      const open = p.run.slots.filter((x) => x.status === 'pending' || x.status === 'active');
      assert.equal(new Set(open.map((x) => x.gnomeId)).size, open.length);
    }
    assert.equal(p.run.state, 'arranging', `seed ${seed}`);
    const phrase = config.phrases.find((x) => x.id === p.run.phraseId);
    assert.equal(E.openSuitcase(p, L.phraseLetters(phrase.text), ctx()).outcome.kind, 'opened');
  }
  assert.ok(swapped > 0 && gifted > 0, `exercised both paths (swapped ${swapped}, gifted ${gifted})`);
});
