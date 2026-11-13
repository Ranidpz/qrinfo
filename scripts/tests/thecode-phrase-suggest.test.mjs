import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { loadTs, stub } from './load-ts.mjs';

// "הצעות שאפשר להרכיב עכשיו" (src/components/thecode/admin/phraseSuggest.ts): pure.
async function transpiledUrl(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return stub(outputText);
}
const lettersUrl = await transpiledUrl('../../src/lib/thecode/letters.ts');
const S = await loadTs('../../src/components/thecode/admin/phraseSuggest.ts', { '@/lib/thecode/letters': lettersUrl });

const spot = (id, name, extra = {}) => ({ id, name, hints: [], isActive: true, ...extra });
const gnome = (id, n, spotId = 's1', extra = {}) => ({ id, number: n, code: '', manualCode: '', spotId, bodyColor: 'red', hatColor: 'blue', isActive: true, ...extra });
const riddle = (id, gnomeId, answerWord, status = 'published') => ({ id, gnomeId, type: 'observe', text: 'q', answerWord, letter: '', acceptSoundAlike: true, hints: [], difficulty: 1, status });
const cfg = (over) => ({ title: 'בדיקה', spots: [spot('s1', 'מקום')], gnomes: [], phrases: [], ...over });

test('a word is ready only when every letter comes from a DIFFERENT gnome', () => {
  // ס, ו, ד on three gnomes → "סוד" is possible.
  const config = cfg({ gnomes: [gnome('g1', 1), gnome('g2', 2), gnome('g3', 3)] });
  const riddles = [riddle('r1', 'g1', 'סוס'), riddle('r2', 'g2', 'ורד'), riddle('r3', 'g3', 'דבש')];
  const { ready } = S.suggestPhrases(config, riddles, { ready: 50, almost: 50 });
  assert.ok(ready.some((r) => r.text === 'סוד'));
  // "סוס" needs ס twice → only one ס gnome → not ready.
  assert.ok(!ready.some((r) => r.text === 'סוס'));
});

test('one gnome giving two letters still counts once (matching, not counting)', () => {
  const config = cfg({ gnomes: [gnome('g1', 1), gnome('g2', 2)] });
  // g1 gives ס and ו, g2 gives ד → "סוד" needs 3 distinct gnomes → only 2 exist.
  const riddles = [riddle('r1', 'g1', 'סוס'), riddle('r2', 'g1', 'ורד'), riddle('r3', 'g2', 'דבש')];
  const { ready, almost } = S.suggestPhrases(config, riddles, { ready: 50, almost: 50 });
  assert.ok(!ready.some((r) => r.text === 'סוד'));
  assert.ok(almost.some((r) => r.text === 'סוד'));
});

test('only in-game riddles on active gnomes and spots count', () => {
  const config = cfg({ spots: [spot('s1', 'מקום'), spot('s2', 'כבוי', { isActive: false })], gnomes: [gnome('g1', 1), gnome('g2', 2), gnome('g3', 3, 's2'), gnome('g4', 4, 's1', { isActive: false })] });
  const riddles = [riddle('r1', 'g1', 'סוס'), riddle('r2', 'g2', 'ורד', 'draft'), riddle('r3', 'g3', 'ורד'), riddle('r4', 'g4', 'ורד')];
  const src = S.sourcesByLetter(config, riddles);
  assert.deepEqual(src.get('ס'), ['g1']);
  assert.equal(src.get('ו'), undefined);
});

test('"almost" names the one missing letter', () => {
  const config = cfg({ gnomes: [gnome('g1', 1), gnome('g2', 2)] });
  const riddles = [riddle('r1', 'g1', 'סוס'), riddle('r2', 'g2', 'ורד')];
  const { almost } = S.suggestPhrases(config, riddles, { ready: 50, almost: 50 });
  const sod = almost.find((a) => a.text === 'סוד');
  assert.ok(sod);
  assert.equal(sod.missing, 'ד');
});

test('venue words come first, existing phrases are skipped', () => {
  const config = cfg({
    title: 'מלון שבא',
    gnomes: [gnome('g1', 1), gnome('g2', 2), gnome('g3', 3), gnome('g4', 4)],
    phrases: [{ id: 'p1', text: 'סוד', isActive: true }],
  });
  const riddles = [riddle('r1', 'g1', 'שמש'), riddle('r2', 'g2', 'בית'), riddle('r3', 'g3', 'אריה'), riddle('r4', 'g4', 'סוס')];
  const { ready } = S.suggestPhrases(config, riddles, { ready: 50, almost: 50 });
  assert.equal(ready[0].text, 'שבא');
  assert.equal(ready[0].local, true);
  assert.ok(!ready.some((r) => r.text === 'סוד'));
});

test('final forms match their letters (שלום needs ש ל ו מ)', () => {
  const config = cfg({ gnomes: [1, 2, 3, 4].map((n) => gnome(`g${n}`, n)) });
  const riddles = [riddle('r1', 'g1', 'שמש'), riddle('r2', 'g2', 'לימון'), riddle('r3', 'g3', 'ורד'), riddle('r4', 'g4', 'מים')];
  const { ready } = S.suggestPhrases(config, riddles, { ready: 50, almost: 50 });
  assert.ok(ready.some((r) => r.text === 'שלום'));
});

test('limit keeps the list short', () => {
  const config = cfg({ gnomes: Array.from({ length: 22 }, (_, i) => gnome(`g${i}`, i)) });
  const words = ['אריה', 'בית', 'גמד', 'דבש', 'הר', 'ורד', 'זית', 'חול', 'טוסט', 'ים', 'כלב', 'לב', 'מים', 'נהר', 'סוס', 'עץ', 'פרח', 'צב', 'קשת', 'ראש', 'שמש', 'תות'];
  const riddles = words.map((w, i) => riddle(`r${i}`, `g${i}`, w));
  const { ready, almost } = S.suggestPhrases(config, riddles);
  assert.ok(ready.length <= 8 && almost.length <= 4);
  assert.ok(ready.length > 0);
});

test('venue words lose the leading ה and fill at most half the list', () => {
  assert.deepEqual(S.localWords({ title: 'מלון הגפן', spots: [{ name: 'הבריכה — צד המגלשה' }] }), ['מלון', 'גפן', 'בריכה', 'מגלשה']);
  const config = cfg({
    title: 'שבא מלכה גפן נמר',
    gnomes: Array.from({ length: 12 }, (_, i) => gnome(`g${i}`, i)),
  });
  const words = ['שמש', 'בית', 'אריה', 'מים', 'לב', 'כלב', 'גמד', 'פרח', 'נהר', 'רוח', 'סוס', 'דבש'];
  const riddles = words.map((w, i) => riddle(`r${i}`, `g${i}`, w));
  const { ready } = S.suggestPhrases(config, riddles, { ready: 4, almost: 0 });
  assert.equal(ready.length, 4);
  assert.equal(ready.filter((r) => r.local).length, 2);
});

test('place-name glue words are not suggested', () => {
  assert.deepEqual(S.localWords({ title: 'מלון', spots: [{ name: 'פינת הפסנתר' }, { name: 'ליד הלובי' }] }), ['מלון', 'פסנתר', 'לובי']);
});
