import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

// קוד הגמדים — the operator admin in FREE mode (docs/THE_CODE_FREE_ADMIN_PLAN.md):
// the report (adminLive/report.ts) drops the guided-only checks, words the rest for the free game
// and summarises readiness; the bank fill tops every gnome up; the guided report is unchanged.
// Each TS file is transpiled alone and wired by URL (type-only imports vanish in the transpile).

async function urlOf(relativePath, map = {}) {
  let source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  for (const [spec, url] of Object.entries(map)) source = source.replaceAll(`'${spec}'`, JSON.stringify(url));
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  return stub(outputText);
}

const lettersUrl = await urlOf('../../src/lib/thecode/letters.ts');
const engineUrl = await urlOf('../../src/lib/thecode/engine.ts', { './letters': lettersUrl });
const freeUrl = await urlOf('../../src/lib/thecode/engineFree.ts', { './letters': lettersUrl, './engine': engineUrl });
const helpersUrl = await urlOf('../../src/components/thecode/admin/helpers.ts', { '@/lib/landing/site': stub('export const SITE_URL = "https://example.test";') });
const figureStub = stub('export function describeGnome(b, h) { return `גמד ${b} עם מצנפת ${h}`; }');
const reportUrl = await urlOf('../../src/components/thecode/adminLive/report.ts', {
  '@/lib/thecode/engine': engineUrl,
  '@/lib/thecode/engineFree': freeUrl,
  '@/lib/thecode/letters': lettersUrl,
  '@/components/thecode/GnomeFigure': figureStub,
  '@/components/thecode/admin/helpers': helpersUrl,
});
const E = await import(engineUrl);
const F = await import(freeUrl);
const L = await import(lettersUrl);
const H = await import(helpersUrl);
const R = await import(reportUrl);
const B = await import(await urlOf('../../src/lib/thecode/riddleBank.ts', { './letters': lettersUrl }));

const riddle = (id, gnomeId, answerWord, extra = {}) => ({
  id, gnomeId, type: 'observe', text: `חידה ${id}`, answerWord, letter: L.letterOfAnswer(answerWord),
  acceptSoundAlike: true, hints: [], difficulty: 1, status: 'published', ...extra,
});
const gnome = (id, number, spotId, extra = {}) => ({
  id, number, code: `code-${id}`, manualCode: `M${number}`, spotId, bodyColor: 'red', hatColor: 'blue',
  isActive: true, verifiedOnSite: true, ...extra,
});

// Gnomes 1 and 2 stand at the lobby in IDENTICAL colours (a guided error), gnome 3 at the pool
// has no riddle, gnome 4 has one riddle; the garden has no location hint.
function state(over = {}, riddles) {
  const config = {
    status: 'draft', title: 'מלכת שבא', language: 'he',
    spots: [
      { id: 's1', name: 'לובי', hints: ['בלובי'], isActive: true },
      { id: 's2', name: 'בריכה', hints: ['ליד הבריכה'], isActive: true },
      { id: 's3', name: 'גינה', hints: [], isActive: true },
    ],
    gnomes: [gnome('g1', 1, 's1'), gnome('g2', 2, 's1'), gnome('g3', 3, 's2', { bodyColor: 'yellow' }), gnome('g4', 4, 's3', { bodyColor: 'green' })],
    phrases: [{ id: 'p1', text: 'סוד גדול', isActive: true }],
    rules: { ...E.DEFAULT_THECODE_RULES }, requirePhoneVerification: false, retentionDays: 30,
    ...over,
  };
  return {
    config,
    riddles: riddles ?? [
      riddle('a1', 'g1', 'אריה'), riddle('a2', 'g1', 'בננה'), riddle('a3', 'g1', 'גזר'),
      riddle('b1', 'g2', 'דג'), riddle('b2', 'g2', 'הר'), riddle('b3', 'g2', 'ורד'),
      riddle('d1', 'g4', 'זברה'),
    ],
    gnomeStats: {}, riddleStats: {}, players: [],
  };
}

const codes = (report) => report.issues.map((i) => i.code);

test('free report: no colour hunt, no phrases; a gnome without a riddle only warns', () => {
  const r = R.buildAdventureReport(state({ mode: 'free' }));
  for (const c of ['DUPLICATE_COLORS_AT_SPOT', 'CONFUSABLE_COLORS_AT_SPOT', 'PHRASE_LETTER_MISSING', 'NO_ACTIVE_PHRASE']) {
    assert.ok(!codes(r).includes(c), `free report still has ${c}`);
  }
  assert.equal(r.errors, 0, 'look-alike gnomes and an empty gnome never block a free publish');
  const empty = r.issues.find((i) => i.code === 'GNOME_WITHOUT_RIDDLE');
  assert.equal(empty.severity, 'warning');
  assert.match(empty.message, /לגמד 3 אין חידה/);
  assert.doesNotMatch(empty.message, /אף קבוצה לא תגיע/);
});

test('free report: operator wording (Hebrew even for an English adventure), fix links to the gnome', () => {
  for (const language of ['he', 'en']) {
    const r = R.buildAdventureReport(state({ mode: 'free', language }));
    const few = r.issues.find((i) => i.code === 'FEW_FRESH_ROUNDS');
    assert.equal(few.gnomeId, 'g4');
    assert.match(few.message, /לגמד 4 יש רק חידה אחת/);
    assert.match(few.message, /שעה/, 'says when the group meets the riddle again (1 riddle × 60 minutes)');
    const spot = r.issues.find((i) => i.code === 'SPOT_WITHOUT_HINT');
    assert.match(spot.message, /לא תוכל לקנות רמז/);
  }
});

test('free report: a spot without hints is fine when every gnome there has its own', () => {
  const s = state({ mode: 'free' });
  s.config.gnomes = s.config.gnomes.map((g) => (g.id === 'g4' ? { ...g, hints: ['מאחורי העץ'] } : g));
  assert.ok(!codes(R.buildAdventureReport(s)).includes('SPOT_WITHOUT_HINT'));
});

test('free report: blocked only when no gnome asks anything', () => {
  const r = R.buildAdventureReport(state({ mode: 'free' }, []));
  assert.equal(r.errors, 1);
  assert.match(r.issues.find((i) => i.severity === 'error').message, /אף גמד עוד לא שואל חידה/);
});

test('free readiness: ready gnomes, riddles in the game, when a riddle comes back', () => {
  const r = R.buildAdventureReport(state({ mode: 'free', free: { refreshMinutes: 180 } }));
  assert.deepEqual(r.free, {
    gnomesOn: 4, gnomesReady: 3, minRiddles: 0, riddlesInGame: 7, refreshMinutes: 180, wrapRiddles: true,
    repeatAfterMinutes: 180, // the poorest gnome WITH riddles (g4: 1) × 3 hours
  });
  assert.equal(H.durationLabel(r.free.repeatAfterMinutes), '3 שעות');
  assert.equal(R.buildAdventureReport(state({ mode: 'free' }, [])).free.repeatAfterMinutes, null);
});

test('guided report is untouched by the free changes', () => {
  const r = R.buildAdventureReport(state());
  assert.ok(codes(r).includes('DUPLICATE_COLORS_AT_SPOT'), 'guided still flags identical gnomes');
  assert.ok(r.errors > 0);
  assert.equal(r.free, undefined);
  assert.match(r.issues.find((i) => i.code === 'DUPLICATE_COLORS_AT_SPOT').message, /נראים אותו דבר/);
});

test('the server-side free filter list matches the engine list', async () => {
  const store = await readFile(new URL('../../src/lib/thecode/store.ts', import.meta.url), 'utf8');
  const block = store.slice(store.indexOf('const FREE_IGNORED = new Set(['), store.indexOf(']);', store.indexOf('const FREE_IGNORED = new Set([')));
  const inStore = [...block.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(inStore, [...F.FREE_IGNORED_ISSUES].sort());
});

test('durationLabel speaks plain Hebrew', () => {
  assert.equal(H.durationLabel(45), '45 דקות');
  assert.equal(H.durationLabel(60), 'שעה');
  assert.equal(H.durationLabel(120), 'שעתיים');
  assert.equal(H.durationLabel(1440), 'יום');
  assert.equal(H.durationLabel(2 * 1440 + 3 * 60), 'יומיים ו־3 שעות');
  assert.equal(H.durationLabel(1440 + 60 + 30), 'יום, שעה ו־30 דקות');
});

test('free bank fill: every switched-on gnome up to the target, nothing existing touched', () => {
  const s = state({ mode: 'free', gnomes: [...state().config.gnomes, gnome('g5', 5, 's1', { isActive: false })] });
  const plan = B.planFreeBankFill(s.config, s.riddles, F.TARGET_RIDDLES_PER_GNOME);
  const per = (id) => plan.add.filter((i) => i.gnomeId === id).length;
  assert.equal(per('g1'), 2);
  assert.equal(per('g3'), 5);
  assert.equal(per('g4'), 4);
  assert.equal(per('g5'), 0, 'a switched-off gnome is left alone');
  assert.deepEqual(plan.short, []);
  // Unique answers across the adventure, never one already used.
  const answers = [...s.riddles.map((r) => r.answerWord), ...plan.add.map((i) => i.bank.answerWord)];
  assert.equal(new Set(answers).size, answers.length);
  // Two riddles in a row of one gnome start with different letters (existing last riddle included).
  for (const g of s.config.gnomes) {
    const seq = [...s.riddles.filter((r) => r.gnomeId === g.id).map((r) => r.letter), ...plan.add.filter((i) => i.gnomeId === g.id).map((i) => i.letter)];
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `gnome ${g.number}: ${seq.join(',')}`);
  }
  // Applying the plan clears every few-riddles warning.
  const after = [...s.riddles, ...plan.add.map((i, n) => riddle(`n${n}`, i.gnomeId, i.bank.answerWord))];
  const r = R.buildAdventureReport({ ...s, riddles: after });
  assert.ok(!codes(r).includes('FEW_FRESH_ROUNDS') && !codes(r).includes('GNOME_WITHOUT_RIDDLE'), codes(r).join(','));
});

test('free bank fill: a place-matched riddle first, and nothing to add once every gnome is full', () => {
  const s = state({ mode: 'free' });
  const plan = B.planFreeBankFill(s.config, s.riddles, F.TARGET_RIDDLES_PER_GNOME);
  const pool = plan.add.filter((i) => i.gnomeId === 'g3');
  assert.ok(pool.some((i) => i.bank.place === 'pool'), 'the pool gnome gets pool riddles');
  const full = [...s.riddles, ...plan.add.map((i, n) => riddle(`n${n}`, i.gnomeId, i.bank.answerWord))];
  assert.deepEqual(B.planFreeBankFill(s.config, full, F.TARGET_RIDDLES_PER_GNOME), { add: [], short: [] });
});

test('free bank fill: says which gnomes the bank cannot fill', () => {
  const many = Array.from({ length: 60 }, (_, i) => gnome(`x${i}`, i + 1, 's1', { bodyColor: 'yellow' }));
  const plan = B.planFreeBankFill({ spots: state().config.spots, gnomes: many }, [], F.TARGET_RIDDLES_PER_GNOME);
  assert.ok(plan.short.length > 0);
  assert.equal(plan.add.length, B.RIDDLE_BANK.length, 'the whole bank is used before giving up');
});
