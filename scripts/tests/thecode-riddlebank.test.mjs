import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { loadTs, stub } from './load-ts.mjs';

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
const B = await loadTs('../../src/lib/thecode/riddleBank.ts', { './letters': lettersUrl });

const words = (s) => s.split(/[^א-ת׳']+/).filter(Boolean);

test('bank: every entry is well formed and never gives its answer away', () => {
  const ids = new Set();
  const answers = new Set();
  for (const r of B.RIDDLE_BANK) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.ok(!answers.has(r.answerWord), `answer used twice: ${r.answerWord}`);
    answers.add(r.answerWord);
    assert.equal(r.id, `${r.place}:${r.answerWord}`);
    assert.ok(B.RIDDLE_PLACES.some((p) => p.id === r.place), r.id);
    assert.ok(L.HEBREW_LETTERS.includes(B.bankLetter(r)), `${r.id}: letter`);
    assert.ok(r.text.length >= 15 && r.text.length <= 140, `${r.id}: text length`);
    assert.ok(/[?]$/.test(r.text), `${r.id}: ends with a question`);
    assert.ok(r.hints.length >= 1 && r.hints.length <= 3, `${r.id}: hints`);
    for (const piece of [r.text, ...r.hints]) {
      assert.ok(piece.trim() === piece && piece.length > 0, `${r.id}: blank`);
      // The answer itself, or the answer with a one-letter prefix (ה/ב/ל/מ/ו/כ/ש), is a giveaway.
      for (const w of words(piece)) {
        assert.ok(w !== r.answerWord && w.slice(1) !== r.answerWord, `${r.id}: "${piece}" contains the answer`);
      }
    }
  }
});

test('bank: every Hebrew letter has at least three riddles', () => {
  for (const letter of L.HEBREW_LETTERS) {
    const n = B.RIDDLE_BANK.filter((r) => B.bankLetter(r) === letter).length;
    assert.ok(n >= 3, `letter ${letter} has only ${n}`);
  }
});

test('bank: there are real hard riddles, and a hard one always has two hints', () => {
  const hard = B.RIDDLE_BANK.filter((r) => r.difficulty === 3);
  assert.ok(hard.length >= 20, `only ${hard.length} hard riddles`);
  for (const r of hard) assert.ok(r.hints.length >= 2, `${r.id}: a hard riddle needs two hints`);
  // Every level is actually reachable from the picker.
  for (const d of [1, 2, 3]) {
    const only = B.suggestFromBank({ difficulty: d });
    assert.ok(only.length > 0, `no riddles at level ${d}`);
    assert.ok(only.every((r) => r.difficulty === d), `level ${d} leaks other levels`);
  }
  // Filters combine: level + letter.
  const hardShin = B.suggestFromBank({ difficulty: 3, letter: 'ש' });
  assert.ok(hardShin.length > 0 && hardShin.every((r) => r.difficulty === 3 && B.bankLetter(r) === 'ש'));
});

test('bank: the one-click fill still prefers the easiest riddles', () => {
  const easiest = B.suggestFromBank({})[0];
  assert.equal(easiest.difficulty, 1);
});

test('bank: the spot name tells the kind of place', () => {
  assert.equal(B.placeOfSpotName('נקודת הפתיחה לובי'), 'lobby');
  assert.equal(B.placeOfSpotName('ליד הקבלה'), 'lobby');
  assert.equal(B.placeOfSpotName('בריכה'), 'pool');
  assert.equal(B.placeOfSpotName('בבריכת הילדים'), 'pool');
  assert.equal(B.placeOfSpotName('חוף הים'), 'pool');
  assert.equal(B.placeOfSpotName('חדר האוכל'), 'dining');
  assert.equal(B.placeOfSpotName('הגינה האחורית'), 'garden');
  assert.equal(B.placeOfSpotName('גן המשחקים'), 'garden');
  // Plural endings and lookalikes must not count.
  assert.equal(B.placeOfSpotName('חדרים'), 'any');
  assert.equal(B.placeOfSpotName('נוף גנוסר'), 'any');
  assert.equal(B.placeOfSpotName('הספרייה'), 'any');
});

test('bank: suggestions filter by letter, prefer the place, skip what is already used', () => {
  const forShin = B.suggestFromBank({ letter: 'ש', place: 'pool' });
  assert.ok(forShin.length >= 3);
  assert.ok(forShin.every((r) => B.bankLetter(r) === 'ש'));
  assert.equal(forShin[0].place, 'pool');
  const used = [{ text: forShin[0].text, answerWord: forShin[0].answerWord }];
  assert.ok(!B.suggestFromBank({ letter: 'ש', place: 'pool', riddles: used }).some((r) => r.id === forShin[0].id));
  // Same answer written by the operator in other words: still not offered again.
  assert.ok(!B.suggestFromBank({ riddles: [{ text: 'משהו אחר', answerWord: 'שעון' }] }).some((r) => r.answerWord === 'שעון'));
});

// ------------------------------------------------------------------ one-click fill

function adventure(phrases, { lobby = 6, pool = 2 } = {}) {
  const spots = [
    { id: 's1', name: 'נקודת הפתיחה לובי', hints: ['ליד הכניסה'], isActive: true },
    { id: 's2', name: 'בריכה', hints: ['ליד המים'], isActive: true, outdoor: true },
  ];
  const indoor = ['blue', 'yellow', 'red', 'purple', 'white', 'green', 'brown', 'black'];
  const gnomes = [];
  for (let i = 0; i < lobby; i++) {
    gnomes.push({ id: `g${i + 1}`, number: i + 1, code: `c${i}`, manualCode: `M${i}`, spotId: 's1', bodyColor: indoor[i % 8], hatColor: indoor[(i + 1) % 8], isActive: true, verifiedOnSite: true });
  }
  for (let i = 0; i < pool; i++) {
    const n = lobby + i + 1;
    gnomes.push({ id: `g${n}`, number: n, code: `c${n}`, manualCode: `M${n}`, spotId: 's2', bodyColor: i ? 'grey' : 'black', hatColor: i ? 'black' : 'grey', isActive: true, verifiedOnSite: true });
  }
  return {
    status: 'draft', title: 'בדיקה', language: 'he', spots, gnomes,
    phrases: phrases.map((text, i) => ({ id: `p${i + 1}`, text, isActive: true })),
    rules: E.DEFAULT_THECODE_RULES, requirePhoneVerification: false, retentionDays: 30,
  };
}

function apply(plan, riddles) {
  return [
    ...riddles,
    ...plan.add.map((a, i) => ({
      id: `new${i}`, gnomeId: a.gnomeId, type: 'find', text: a.bank.text, answerWord: a.bank.answerWord,
      letter: a.letter, acceptSoundAlike: true, hints: a.bank.hints, difficulty: a.bank.difficulty, status: 'published',
    })),
  ];
}

const blocking = (config, riddles) =>
  E.validateAdventure(config, riddles).filter((i) => ['PHRASE_LETTER_MISSING', 'GNOME_WITHOUT_RIDDLE', 'GNOME_COLOR_UNAVAILABLE'].includes(i.code));

test('fill: an empty 8-gnome demo with one phrase becomes playable in one go', () => {
  const config = adventure(['מלכת שבא']);
  assert.ok(blocking(config, []).length > 0);
  const plan = B.planBankFill(config, []);
  assert.deepEqual(plan.unfilled, []);
  assert.equal(plan.add.length, 8, '7 letters + one riddle so the 8th gnome is not empty');
  assert.equal(new Set(plan.add.map((a) => a.bank.id)).size, plan.add.length);
  assert.equal(new Set(plan.add.filter((a) => a.phraseId).map((a) => a.gnomeId)).size, 7);
  const riddles = apply(plan, []);
  assert.deepEqual(blocking(config, riddles), []);
  assert.ok(E.canPublish(E.validateAdventure(config, riddles)));
  // Pool gnomes got pool riddles when the bank has one for the letter.
  const atPool = plan.add.filter((a) => ['g7', 'g8'].includes(a.gnomeId));
  assert.ok(atPool.length >= 1);
  // Running it again adds nothing.
  assert.deepEqual(B.planBankFill(config, riddles).add, []);
});

test('fill: a second phrase reuses letters the gnomes already give and adds only what is missing', () => {
  const config = adventure(['מלכת שבא']);
  const first = apply(B.planBankFill(config, []), []);
  const two = adventure(['מלכת שבא', 'ים כחול']);
  const plan = B.planBankFill(two, first);
  assert.deepEqual(plan.unfilled, []);
  assert.ok(plan.add.length > 0 && plan.add.length <= 6);
  assert.ok(plan.add.every((a) => a.phraseId === 'p2'));
  const riddles = apply(plan, first);
  assert.deepEqual(blocking(two, riddles), []);
  // Never the same riddle or the same answer twice in one adventure.
  assert.equal(new Set(riddles.map((r) => r.answerWord)).size, riddles.length);
});

test('fill: a phrase with a repeated letter gets that letter from different gnomes', () => {
  const config = adventure(['אבא אמא']);
  const plan = B.planBankFill(config, []);
  assert.deepEqual(plan.unfilled, []);
  const alefs = plan.add.filter((a) => a.letter === 'א' && a.phraseId);
  assert.equal(alefs.length, 4);
  assert.equal(new Set(alefs.map((a) => a.gnomeId)).size, 4);
  assert.deepEqual(blocking(config, apply(plan, [])), []);
});

test('fill: says so when a phrase is longer than the number of gnomes', () => {
  const config = adventure(['ברוכים הבאים למלון'], { lobby: 3, pool: 1 });
  const plan = B.planBankFill(config, []);
  assert.deepEqual(plan.unfilled, [{ phraseId: 'p1', letter: '', why: 'notEnoughGnomes' }]);
  assert.equal(plan.add.length, 4, 'still no gnome is left empty');
});

test('fill: drafts and switched-off gnomes are not counted on', () => {
  const config = adventure(['גל ים']);
  config.gnomes[0].isActive = false;
  const draft = [{ id: 'r1', gnomeId: 'g2', type: 'find', text: 'טיוטה', answerWord: 'גמל', letter: 'ג', acceptSoundAlike: true, hints: [], difficulty: 1, status: 'draft' }];
  const plan = B.planBankFill(config, draft);
  assert.ok(plan.add.every((a) => a.gnomeId !== 'g1'));
  assert.ok(plan.add.some((a) => a.letter === 'ג'), 'the draft does not supply ג');
  assert.deepEqual(blocking(config, apply(plan, draft)).filter((i) => i.code === 'PHRASE_LETTER_MISSING'), []);
});
