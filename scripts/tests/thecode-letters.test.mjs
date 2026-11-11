import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './load-ts.mjs';

const L = await loadTs('../../src/lib/thecode/letters.ts');

test('normalizeLetter: final forms, niqqud, English case, non-letters', () => {
  assert.equal(L.normalizeLetter('ף'), 'פ');
  assert.equal(L.normalizeLetter('ך'), 'כ');
  assert.equal(L.normalizeLetter('ם'), 'מ');
  assert.equal(L.normalizeLetter('ן'), 'נ');
  assert.equal(L.normalizeLetter('ץ'), 'צ');
  assert.equal(L.normalizeLetter('בּ'), 'ב'); // dagesh
  assert.equal(L.normalizeLetter('שׁ'), 'ש'); // shin dot
  assert.equal(L.normalizeLetter('a'), 'A');
  assert.equal(L.normalizeLetter('7'), '');
  assert.equal(L.normalizeLetter(' '), '');
  assert.equal(L.normalizeLetter(''), '');
});

test('phraseLetters drops spaces + niqqud and folds final forms', () => {
  assert.deepEqual(L.phraseLetters('נוף גנוסר'), ['נ', 'ו', 'פ', 'ג', 'נ', 'ו', 'ס', 'ר']);
  assert.deepEqual(L.phraseLetters('שָׁלוֹם'), ['ש', 'ל', 'ו', 'מ']);
  assert.deepEqual(L.phraseWordLengths('נוף גנוסר'), [3, 5]);
});

test('invalidPhraseChars flags digits, punctuation and the other alphabet', () => {
  assert.deepEqual(L.invalidPhraseChars('נוף גנוסר', 'he'), []);
  assert.deepEqual(L.invalidPhraseChars('חדר 7', 'he'), ['7']);
  assert.deepEqual(L.invalidPhraseChars('שלום!', 'he'), ['!']);
  assert.deepEqual(L.invalidPhraseChars('ים SEA', 'he'), ['S', 'E', 'A']);
  assert.deepEqual(L.invalidPhraseChars('SEA', 'en'), []);
});

test('letterOfAnswer = first letter, normalized', () => {
  assert.equal(L.letterOfAnswer('כּוֹבַע'), 'כ');
  assert.equal(L.letterOfAnswer(' piano'), 'P');
  assert.equal(L.letterOfAnswer(''), '');
});

test('matchLetter: exact, sound-alike only when allowed, wrong', () => {
  assert.equal(L.matchLetter('ף', 'פ', false), 'exact');
  assert.equal(L.matchLetter('ק', 'כ', true), 'soundAlike');
  assert.equal(L.matchLetter('ק', 'כ', false), 'wrong');
  assert.equal(L.matchLetter('ר', 'כ', true), 'wrong');
  assert.equal(L.matchLetter('', 'כ', true), 'wrong');
  assert.ok(L.isAmbiguousLetter('ט'));
  assert.ok(!L.isAmbiguousLetter('ר'));
  assert.deepEqual(L.soundAlikes('כ').sort(), ['ח', 'ק'].sort());
});

test('displayPhrase puts final forms back at word ends', () => {
  assert.equal(L.displayPhrase(L.phraseLetters('נוף גנוסר'), [3, 5]), 'נוף גנוסר');
  assert.equal(L.displayPhrase(['ש', 'ל', 'ו', 'מ'], [4]), 'שלום');
  assert.equal(L.displayPhrase(['כ'], [1]), 'כ'); // one-letter word keeps the base form
});
