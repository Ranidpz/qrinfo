import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { stub } from './load-ts.mjs';

// Each TS file is transpiled on its own; relative imports are swapped for the
// transpiled siblings (type-only imports disappear in the transpile).
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
const lettersUrl = await urlOf('../../src/lib/thecode/letters.ts');
const engineUrl = await urlOf('../../src/lib/thecode/engine.ts', { './letters': lettersUrl });
const howToPlayUrl = await urlOf('../../src/lib/thecode/howToPlay.ts');
const selfieUrl = await urlOf('../../src/lib/thecode/selfie.ts');
const lobbyUrl = await urlOf('../../src/lib/thecode/server/lobby.ts', { '../selfie': selfieUrl });
const dep = { '../engine': engineUrl, '../letters': lettersUrl, '../howToPlay': howToPlayUrl, '../selfie': selfieUrl, './lobby': lobbyUrl };
const H = await import(howToPlayUrl);
const L = await import(lettersUrl);
const E = await import(engineUrl);
const S = await import(await urlOf('../../src/lib/thecode/server/snapshot.ts', dep));
const A = await import(await urlOf('../../src/lib/thecode/server/admin.ts', dep));
const N = await import(await urlOf('../../src/lib/thecode/server/names.ts'));
const W = await import(await urlOf('../../src/lib/thecode/server/week.ts'));
const R = await import(await urlOf('../../src/lib/thecode/server/rate.ts'));
const C = await import(await urlOf('../../src/lib/thecode/server/codes.ts'));

const NOON = Date.UTC(2026, 10, 11, 10, 0);

// ------------------------------------------------------------------ fixture
// Distinctive answer words / texts so a leak is a plain substring search.
function fixture() {
  const spot = (id) => ({ id, name: `SPOTNAME-${id}`, hints: [`HINTZONE-${id}`, `HINTNEAR-${id}`], isActive: true, safetyNote: `SAFETY-${id}` });
  const gnome = (id, n, spotId, bodyColor, hatColor) => ({
    id, number: n, code: `QRSLUG${id}xyz`, manualCode: `MAN${n}`, spotId, bodyColor, hatColor, isActive: true, verifiedOnSite: true,
  });
  const riddle = (id, gnomeId, answerWord) => ({
    id, gnomeId, type: 'observe', text: `RIDDLETEXT[${id}]`, answerWord, letter: L.letterOfAnswer(answerWord),
    acceptSoundAlike: true, hints: [`RHINT1[${id}]`, `RHINT2[${id}]`], difficulty: 1, status: 'published',
  });
  const config = {
    status: 'published', title: 'הקוד', language: 'he',
    spots: [spot('A'), spot('B'), spot('C'), spot('D')],
    gnomes: [
      gnome('a1', 1, 'A', 'red', 'blue'), gnome('a2', 2, 'A', 'yellow', 'blue'),
      gnome('b1', 3, 'B', 'black', 'white'), gnome('b2', 4, 'B', 'white', 'black'),
      gnome('c1', 5, 'C', 'purple', 'orange'), gnome('d1', 6, 'D', 'green', 'yellow'),
      gnome('e1', 7, 'D', 'orange', 'red'),
    ],
    phrases: [{ id: 'kelev', text: 'כלבזהבי', isActive: true }],
    rules: { ...E.DEFAULT_THECODE_RULES }, requirePhoneVerification: false, retentionDays: 90,
  };
  // phrase letters: כ ל ב ז ה ב י  → 7 slots, two ב on distinct gnomes
  const riddles = [
    riddle('rk', 'a1', 'כובעאאא'), riddle('rl', 'a2', 'לולבבב'), riddle('rb', 'b1', 'בייגלגגג'),
    riddle('rz', 'b2', 'זברהדדד'), riddle('rh', 'c1', 'הרהההה'), riddle('rb2', 'd1', 'בננהווו'),
    riddle('ry', 'e1', 'ינשוףזזז'), riddle('rx', 'd1', 'שמשחחח'),
  ];
  return { config, riddles };
}

function secretsOf(adv) {
  return [
    ...adv.riddles.map((r) => r.answerWord),
    ...adv.config.phrases.map((p) => p.text),
    ...adv.config.spots.flatMap((s) => [s.name, s.safetyNote]),
    ...adv.config.gnomes.flatMap((g) => [g.code, g.manualCode]),
  ];
}

function assertNoLeak(snap, adv, { allowRiddleIds = [], phraseOpen = false } = {}) {
  const json = JSON.stringify(snap);
  for (const s of secretsOf(adv)) {
    if (phraseOpen && adv.config.phrases.some((p) => p.text === s)) continue;
    assert.ok(!json.includes(s), `leaked "${s}"`);
  }
  for (const r of adv.riddles) {
    if (allowRiddleIds.includes(r.id)) continue;
    assert.ok(!json.includes(`RIDDLETEXT[${r.id}]`), `riddle text of unscanned ${r.id}`);
    assert.ok(!json.includes(`RHINT1[${r.id}]`), `riddle hint of unscanned ${r.id}`);
  }
  assert.ok(!/"answerWord"|"riddleId"|"gnomeId"|"phraseId"|"tokenHashes"|"phone"/.test(json), 'no internal keys');
  // A riddle view never carries a letter.
  const riddle = snap.run?.target?.riddle;
  if (riddle) assert.ok(!('letter' in riddle));
  return json;
}

// ------------------------------------------------------------------ venue branding

test('branding: only https urls and a short text survive; it is mirrored to the public stub and the snapshot', () => {
  const base = { status: 'draft', title: 'מלון', language: 'he', spots: [], gnomes: [], phrases: [], rules: {} };
  const none = A.normalizeAdventure(base, [], null);
  assert.equal(none.config.branding, undefined);
  assert.deepEqual(Object.keys(A.toPublicConfig(none.config)).sort(), ['language', 'status', 'title']);

  const dirty = A.normalizeAdventure({
    ...base,
    branding: {
      backgroundUrl: ' https://cdn.example.com/a b.jpg',
      logoUrl: 'https://cdn.example.com/logo.png',
      welcomeText: `  ברוכים   הבאים\nלמלון ${'x'.repeat(300)}`,
      secret: 'nope',
    },
  }, [], null);
  assert.equal(dirty.ok, true);
  assert.deepEqual(Object.keys(dirty.config.branding).sort(), ['logoUrl', 'welcomeText']);
  assert.equal(dirty.config.branding.logoUrl, 'https://cdn.example.com/logo.png');
  assert.ok(dirty.config.branding.welcomeText.startsWith('ברוכים הבאים למלון'));
  assert.ok(dirty.config.branding.welcomeText.length <= 140);

  for (const bad of ['http://cdn.example.com/x.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//cdn/x.png', 42]) {
    const r = A.normalizeAdventure({ ...base, branding: { logoUrl: bad } }, [], null);
    assert.equal(r.config.branding, undefined, String(bad));
  }

  const adv = fixture();
  adv.config.branding = { backgroundUrl: 'https://cdn.example.com/bg.webp', logoUrl: 'https://cdn.example.com/logo.png' };
  assert.deepEqual(A.toPublicConfig(adv.config).branding, adv.config.branding);
  assert.deepEqual(S.buildSnapshot(adv, null, NOON).adventure.branding, adv.config.branding);
  delete adv.config.branding;
  assert.ok(!('branding' in S.buildSnapshot(adv, null, NOON).adventure));
});

// ------------------------------------------------------------------ how to play

test('how to play: default from the real rules, operator lines win, cleaned and capped', () => {
  const rules = { ...E.DEFAULT_THECODE_RULES, pointsPerLetter: 70, hintCost: 15, suitcaseBonus: 400 };
  const he = H.defaultHowToPlay(rules, 'he');
  assert.ok(he.length >= 5 && he.length <= H.HOW_TO_PLAY_LIMITS.lines);
  const all = he.join(' ');
  for (const n of ['70', '15', '400']) assert.ok(all.includes(n), `default mentions ${n}`);
  assert.ok(he.every((l) => l.length <= H.HOW_TO_PLAY_LIMITS.line));
  assert.ok(H.defaultHowToPlay(rules, 'en').join(' ').includes('70 points'));

  const adv = fixture();
  assert.deepEqual(S.buildSnapshot(adv, null, NOON).adventure.howToPlay, H.defaultHowToPlay(E.resolveRules(adv.config.rules), adv.config.language));

  const base = { status: 'draft', title: 'מלון', language: 'he', spots: [], gnomes: [], phrases: [], rules: {} };
  assert.equal(A.normalizeAdventure({ ...base, howToPlay: ['', '   '] }, [], null).config.howToPlay, undefined);
  const own = A.normalizeAdventure({ ...base, howToPlay: ['  מחפשים   גמדים ', 42, '', ...Array.from({ length: 12 }, (_, i) => `שורה ${i} ${'א'.repeat(300)}`)] }, [], null);
  assert.equal(own.config.howToPlay.length, H.HOW_TO_PLAY_LIMITS.lines);
  assert.equal(own.config.howToPlay[0], 'מחפשים גמדים');
  assert.ok(own.config.howToPlay.every((l) => typeof l === 'string' && l.length <= H.HOW_TO_PLAY_LIMITS.line));
  adv.config.howToPlay = ['שורה אחת שלנו'];
  assert.deepEqual(S.buildSnapshot(adv, null, NOON).adventure.howToPlay, ['שורה אחת שלנו']);
  // Not on the public stub: it is served with the snapshot / lookup.
  assert.ok(!('howToPlay' in A.toPublicConfig(adv.config)));
});

// ------------------------------------------------------------------ snapshot

test('snapshot: no secrets at any stage of a whole run; riddle only after the scan', () => {
  const adv = fixture();
  const ctx = { config: adv.config, riddles: adv.riddles, now: NOON, rng: E.createSeededRng(5) };
  // Visitor without a profile.
  const visitor = S.buildSnapshot(adv, null, NOON);
  assert.equal(visitor.player, null);
  assert.equal(visitor.run, null);
  assert.deepEqual(visitor.album, { found: [], total: 7 });
  assert.equal(visitor.canStartNew, true);
  assert.equal(visitor.adventure.open, true);
  assertNoLeak(visitor, adv);

  let p = E.createPlayer({ id: 'p1', familyName: 'כהן', emoji: '🦊', recoveryCode: 'ABC234', now: NOON });
  assertNoLeak(S.buildSnapshot(adv, p, NOON), adv);
  // New suitcase from the summary screen: a target, no riddle yet.
  p = E.startNewRun(p, ctx, { runId: 'run-1' }).player;
  let snap = S.buildSnapshot(adv, p, NOON);
  assert.equal(snap.run.state, 'collecting');
  assert.equal(snap.run.totalLetters, 7);
  assert.equal(snap.run.target.riddle, null);
  assert.equal(snap.run.target.locationHints.length, 1, 'zone hint free');
  assert.equal(snap.run.target.nextLocationHintCost, 0, 'player has 0 points → next costs 0');
  assertNoLeak(snap, adv);

  let steps = 0;
  while (p.run.state === 'collecting') {
    const t = p.run.slots[p.run.targetSlotIndex];
    // Before scanning: no riddle text anywhere.
    assertNoLeak(S.buildSnapshot(adv, p, NOON), adv);
    // A wrong gnome first.
    const wrong = adv.config.gnomes.find((g) => !p.run.slots.some((s) => s.gnomeId === g.id))?.id;
    if (wrong) p = E.scanGnome(p, wrong, ctx).player;
    p = E.scanGnome(p, t.gnomeId, ctx).player;
    snap = S.buildSnapshot(adv, p, NOON);
    assert.equal(snap.run.target.riddle.text, `RIDDLETEXT[${t.riddleId}]`);
    assert.deepEqual(snap.run.target.riddle.hints, []);
    assert.equal(snap.run.target.riddle.nextHintCost, 0);
    assertNoLeak(snap, adv, { allowRiddleIds: [t.riddleId] });
    // A hint and two wrong answers → cooldown on the third.
    p = E.requestHint(p, 'riddle', ctx).player;
    for (let i = 0; i < 3; i++) p = E.answerRiddle(p, { letter: 'ת', slotIndex: t.index }, { ...ctx, now: NOON + i }).player;
    snap = S.buildSnapshot(adv, p, NOON + 5);
    assert.equal(snap.run.target.riddle.wrongAnswers, 3);
    assert.equal(snap.run.target.riddle.cooldownUntil, NOON + 2 + 12000);
    assert.deepEqual(snap.run.target.riddle.hints, [`RHINT1[${t.riddleId}]`]);
    assertNoLeak(snap, adv, { allowRiddleIds: [t.riddleId] });
    p = E.answerRiddle(p, { letter: t.letter, slotIndex: t.index }, { ...ctx, now: NOON + 60_000 + steps }).player;
    steps++;
    snap = S.buildSnapshot(adv, p, NOON + 60_000);
    assertNoLeak(snap, adv);
  }
  assert.equal(snap.run.state, 'arranging');
  assert.equal(snap.run.target, null);
  assert.deepEqual(snap.run.arrange.wordLengths, [7]);
  assert.deepEqual(snap.run.arrange.fixed, [null, null, null, null, null, null, null]);
  assert.deepEqual([...snap.run.arrange.pool].sort(), [...L.phraseLetters('כלבזהבי')].sort());
  assert.notDeepEqual(snap.run.arrange.pool, L.phraseLetters('כלבזהבי'));
  assert.deepEqual(snap.run.arrange.pool, S.buildSnapshot(adv, p, NOON + 99).run.arrange.pool, 'stable tray');
  assertNoLeak(snap, adv);
  p = E.arrangeHelp(p, ctx).player;
  snap = S.buildSnapshot(adv, p, NOON);
  assert.deepEqual(snap.run.arrange.fixed.slice(0, 2), ['כ', null]);
  assertNoLeak(snap, adv);
  // Collector = the order letters were won, not phrase order.
  const bySolved = p.run.slots.slice().sort((a, b) => a.solvedAt - b.solvedAt).map((s) => s.letter);
  assert.deepEqual(snap.run.collected.map((c) => c.letter), bySolved);
  // Album: exactly the found gnomes.
  assert.deepEqual(snap.album.found.map((g) => g.id).sort(), p.run.slots.map((s) => s.gnomeId).sort());
  assert.ok(snap.album.found.every((g) => Object.keys(g).sort().join() === 'bodyColor,hatColor,id,number'));

  // Opened: the phrase is finally revealed.
  p = E.openSuitcase(p, L.phraseLetters('כלבזהבי'), ctx).player;
  snap = S.buildSnapshot(adv, p, NOON);
  assert.deepEqual(snap.run.suitcase, { phraseText: 'כלבזהבי', bonus: 500, suitcaseNumber: 1 });
  assertNoLeak(snap, adv, { phraseOpen: true });
  assert.equal(snap.canStartNew, false, 'one phrase only');
});

test('snapshot: unfound gnomes stay silhouettes; paused / draft → open false; hot flag', () => {
  const adv = fixture();
  const p = { ...E.createPlayer({ id: 'p', familyName: 'x', emoji: '🐻', recoveryCode: 'ABC234', now: NOON }), foundGnomeIds: ['b1', 'ghost'], streak: 3 };
  const snap = S.buildSnapshot(adv, p, NOON);
  assert.deepEqual(snap.album, { found: [{ id: 'b1', number: 3, bodyColor: 'black', hatColor: 'white' }], total: 7 });
  assert.equal(snap.player.hot, true);
  assert.equal(snap.adventure.hotMultiplier, 2);
  assert.ok(!JSON.stringify(snap).includes('purple'), 'colour of an unfound gnome');
  for (const status of ['draft', 'paused']) {
    assert.equal(S.buildSnapshot({ ...adv, config: { ...adv.config, status } }, p, NOON).adventure.open, false);
  }
  const off = { ...adv, config: { ...adv.config, gnomes: adv.config.gnomes.map((g) => (g.id === 'a1' ? { ...g, isActive: false } : g)) } };
  assert.equal(S.buildSnapshot(off, null, NOON).album.total, 6);
});

// ------------------------------------------------------------------ names

test('names: trimmed, collapsed, ≤ 20, control + HTML stripped, blocklist', () => {
  assert.deepEqual(N.normalizeFamilyName('   משפחת   כהן  '), { ok: true, name: 'משפחת כהן' });
  assert.deepEqual(N.normalizeFamilyName('<b>Levi</b>‮'), { ok: true, name: 'bLevi/b' });
  assert.deepEqual(N.normalizeFamilyName('a\u0000b​c'), { ok: true, name: 'abc' });
  assert.equal(N.normalizeFamilyName('').ok, false);
  assert.equal(N.normalizeFamilyName('   ').ok, false);
  assert.equal(N.normalizeFamilyName('!!!').ok, false, 'needs a letter or digit');
  assert.equal(N.normalizeFamilyName(42).ok, false);
  assert.equal(N.normalizeFamilyName('א'.repeat(20)).ok, true);
  assert.equal(N.normalizeFamilyName('א'.repeat(21)).ok, false);
  for (const bad of ['זונה', 'משפחת הזונה', 'FUCK you', 'xXshitXx', 'שרמוטות', 'Hitler fans', 'בן זונה']) {
    assert.equal(N.normalizeFamilyName(bad).ok, false, bad);
  }
  for (const fine of ['משפחת כוכבי', 'Dickens', 'הכוסות', 'Scott', 'משפחת מזון']) {
    assert.equal(N.normalizeFamilyName(fine).ok, true, fine);
  }
});

test('emoji: exactly one emoji grapheme, no letters / digits', () => {
  for (const ok of ['🦊', '👨‍👩‍👧‍👦', '👍🏽', '🇮🇱', '❤️']) assert.equal(N.normalizeEmoji(ok), ok, ok);
  assert.equal(N.normalizeEmoji(' 🦊 '), '🦊');
  for (const bad of ['', 'a', '1', '1️⃣', '🦊🦊', 'ש', '🦊a', null, '<img>']) assert.equal(N.normalizeEmoji(bad), null, String(bad));
});

// ------------------------------------------------------------------ week

test('week key: venue zone, Sunday start, stable across the week and New Year', () => {
  const il = (y, m, d, h = 12) => Date.UTC(y, m - 1, d, h - 2); // Israel winter time = UTC+2
  assert.equal(W.weekKey(il(2026, 11, 12)), '2026-W46'); // Thursday
  assert.equal(W.weekKey(il(2026, 11, 8)), '2026-W46');  // Sunday opens it
  assert.equal(W.weekKey(il(2026, 11, 14, 23)), '2026-W46'); // Saturday night
  assert.equal(W.weekKey(il(2026, 11, 15, 0)), '2026-W47'); // Sunday 00:00
  // Saturday 23:30 Israel = 21:30 UTC — a UTC clock would already… stay; Sunday 00:30 IL is Saturday UTC.
  assert.equal(W.weekKey(Date.UTC(2026, 10, 14, 22, 30)), '2026-W47', 'Sunday 00:30 in Israel');
  assert.equal(W.weekKey(Date.UTC(2026, 10, 14, 22, 30), 'UTC'), '2026-W46', 'still Saturday in UTC');
  // Sun 27.12.2026 – Sat 2.1.2027 is one week.
  const k = W.weekKey(il(2026, 12, 27));
  for (const d of [il(2026, 12, 29), il(2026, 12, 31), il(2027, 1, 1), il(2027, 1, 2)]) assert.equal(W.weekKey(d), k);
  assert.notEqual(W.weekKey(il(2027, 1, 3)), k);
  assert.equal(W.weekKey(NOON, 'Not/AZone'), W.weekKey(NOON, 'UTC'), 'bad zone falls back to UTC');
});

test('week delta: never below 0, keeps the latest 8 weeks', () => {
  let w = W.addWeekDelta(undefined, '2026-W46', 100, 0);
  assert.deepEqual(w, { '2026-W46': { points: 100, suitcases: 0 } });
  w = W.addWeekDelta(w, '2026-W46', -250, 1);
  assert.deepEqual(w['2026-W46'], { points: 0, suitcases: 1 });
  assert.deepEqual(W.addWeekDelta({}, '2026-W46', 0, 0), {}, 'no empty entry for a no-op');
  let many = {};
  for (let i = 30; i <= 45; i++) many[`2026-W${i}`] = { points: i, suitcases: 0 };
  many = W.addWeekDelta(many, '2026-W46', 5, 0);
  assert.deepEqual(Object.keys(many).sort(), ['2026-W39', '2026-W40', '2026-W41', '2026-W42', '2026-W43', '2026-W44', '2026-W45', '2026-W46']);
});

// ------------------------------------------------------------------ rate + codes

test('rate window: 60 per minute, retry-after, new window after a minute', () => {
  let rate;
  for (let i = 0; i < 60; i++) {
    const r = R.takeRate(rate, NOON + i);
    assert.equal(r.ok, true);
    rate = r.rate;
  }
  const blocked = R.takeRate(rate, NOON + 30_000);
  assert.deepEqual(blocked, { ok: false, retryAfterSeconds: 30 });
  assert.deepEqual(R.takeRate(rate, NOON + 60_000), { ok: true, rate: { windowStart: NOON + 60_000, count: 1 } });
  assert.equal(R.takeRate({ windowStart: NOON + 999_999, count: 99 }, NOON).ok, true, 'future start = reset');
});

test('codes: unbiased draw, lengths, cleaning of scanned / typed codes', () => {
  assert.equal(C.codeFromBytes(new Uint8Array([0, 1, 2]), C.UNAMBIGUOUS, 3), 'ABC');
  assert.equal(C.codeFromBytes(new Uint8Array([255, 255]), C.BASE62, 1), null, '255 ≥ 248 is skipped');
  let i = 0;
  const bytes = (n) => Uint8Array.from({ length: n }, () => (i++ * 37) % 256);
  const slug = C.drawCode(bytes, C.BASE62, C.QR_SLUG_LENGTH);
  assert.match(slug, /^[0-9A-Za-z]{12}$/);
  assert.match(C.drawCode(bytes, C.UNAMBIGUOUS, 6), /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(C.cleanScanCode(' Ab3-dE9 '), 'Ab3dE9');
  assert.equal(C.cleanScanCode('https://qr.playzones.app/g/Xy12Ab34Cd56?x=1'), 'Xy12Ab34Cd56');
  assert.equal(C.cleanScanCode('../etc'), null);
  assert.equal(C.cleanScanCode('ab'), null);
  assert.equal(C.cleanScanCode(7), null);
  assert.equal(C.cleanRecoveryCode('abc-234'), 'ABC234');
  assert.equal(C.cleanRecoveryCode('ABC10O'), null, 'ambiguous chars are not in the alphabet');
  assert.equal(C.cleanRecoveryCode('ABC23'), null);
});

// ------------------------------------------------------------------ admin normalization

test('admin: normalize strips junk, re-derives letters, keeps stored codes, flags new gnomes', () => {
  const stored = { gnomes: [{ id: 'g1', number: 1, code: 'STOREDSLUG01', manualCode: 'STORED', spotId: 's1', bodyColor: 'red', hatColor: 'blue', isActive: true }] };
  const cfg = {
    status: 'published', title: '  הקוד\u0000 נוף  ', language: 'xx', evil: 'drop me',
    spots: [{ id: 's1', name: ' לובי ', hints: ['  ליד  הקבלה ', '', 7], isActive: 'yes', photoUrl: 'javascript:alert(1)', extra: 1 }],
    gnomes: [
      { id: 'g1', number: 1, code: 'HACKED', manualCode: 'HACKED', spotId: 's1', bodyColor: 'red', hatColor: 'blue', isActive: true },
      { id: 'g2', number: 2.6, code: 'CLIENTMADE', spotId: 's1', bodyColor: 'green', hatColor: 'yellow' },
    ],
    phrases: [{ id: 'p1', text: '  נוף   גנוסר ', isActive: true }],
    rules: { pointsPerLetter: 150, freeWrongScans: 9, hotMultiplier: 1.55, hintCost: -3 },
    activeHours: { from: '8:00', to: '25:00' },
    presenterVideos: { WELCOME: ['https://r2.example/a.mp4', 'http://bad'], NOPE: ['https://x'] },
    retentionDays: 5000,
  };
  const riddles = [
    { id: 'r1', gnomeId: 'g1', text: 'מה על הראש?', answerWord: ' כּוֹבַע ', letter: 'ת', hints: ['a', 'b', 'c', 'd'], difficulty: 7, status: 'published', secret: 1 },
    { id: 'r2', gnomeId: 'gone', text: 'x', answerWord: 'y' },
  ];
  const r = A.normalizeAdventure(cfg, riddles, stored);
  assert.equal(r.ok, true);
  const c = r.config;
  assert.equal(c.title, 'הקוד נוף');
  assert.equal(c.language, 'he');
  assert.equal(c.evil, undefined);
  assert.deepEqual(c.spots[0], { id: 's1', name: 'לובי', hints: ['ליד הקבלה'], isActive: true });
  assert.deepEqual([c.gnomes[0].code, c.gnomes[0].manualCode], ['STOREDSLUG01', 'STORED'], 'stored codes win');
  assert.deepEqual([c.gnomes[1].code, c.gnomes[1].manualCode, c.gnomes[1].number, c.gnomes[1].isActive], ['', '', 3, true]);
  assert.deepEqual(r.newGnomeIds, ['g2']);
  assert.equal(c.phrases[0].text, 'נוף גנוסר');
  assert.equal(c.rules.pointsPerLetter, 150);
  assert.equal(c.rules.freeWrongScans, 3);
  assert.equal(c.rules.hotMultiplier, 1.6);
  assert.equal(c.rules.hintCost, E.DEFAULT_THECODE_RULES.hintCost);
  assert.equal(c.activeHours, undefined);
  assert.deepEqual(c.presenterVideos, { WELCOME: ['https://r2.example/a.mp4'] });
  assert.equal(c.retentionDays, 365);
  assert.equal(r.riddles.length, 1);
  assert.equal(r.droppedRiddles, 1);
  assert.equal(r.riddles[0].letter, 'כ', 'letter re-derived from the answer');
  assert.equal(r.riddles[0].answerWord, 'כּוֹבַע');
  assert.equal(r.riddles[0].hints.length, 3);
  assert.equal(r.riddles[0].difficulty, 1);
  assert.equal(r.riddles[0].secret, undefined);
  assert.equal(r.riddles[0].acceptSoundAlike, true);
  assert.deepEqual(A.removedGnomes({ gnomes: [...stored.gnomes, { id: 'old', code: 'OLDSLUG', manualCode: 'OLD' }] }, c).map((g) => g.id), ['old']);
});

test('admin: caps, bad ids, duplicate ids and bad colours are refused', () => {
  const base = { status: 'draft', title: 't', language: 'he', spots: [], gnomes: [], phrases: [], rules: {} };
  const tooMany = { ...base, spots: Array.from({ length: 61 }, (_, i) => ({ id: `s${i}`, name: 'x', hints: [] })) };
  assert.equal(A.normalizeAdventure(tooMany, [], null).ok, false);
  assert.equal(A.normalizeAdventure(base, Array.from({ length: 1501 }, () => ({})), null).ok, false);
  assert.equal(A.normalizeAdventure({ ...base, phrases: [{ id: 'a b', text: 'x' }] }, [], null).ok, false);
  assert.equal(A.normalizeAdventure({ ...base, phrases: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }, [], null).ok, false);
  assert.equal(A.normalizeAdventure({ ...base, gnomes: [{ id: 'g', spotId: 's', bodyColor: 'pink', hatColor: 'red' }] }, [], null).ok, false);
  assert.equal(A.normalizeAdventure(null, [], null).ok, false);
  const ok = A.normalizeAdventure(base, [], null);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.config.rules, E.DEFAULT_THECODE_RULES);
  assert.deepEqual(A.toPublicConfig(ok.config), { title: 't', status: 'draft', language: 'he' });
  const d = A.defaultTheCodeConfig();
  assert.equal(d.status, 'draft');
  assert.deepEqual(d.rules, E.DEFAULT_THECODE_RULES);
});
