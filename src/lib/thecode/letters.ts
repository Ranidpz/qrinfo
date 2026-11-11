/**
 * הקוד (The Code) — letter rules. Pure, dependency-free, safe on client and server.
 *
 * One place decides what "the same letter" means, so the engine, the answer check
 * and both UIs can never disagree:
 *  - Hebrew final forms are the same letter as their base form (ף = פ). The
 *    collector stores base letters; the display puts the final form at a word end.
 *  - Niqqud, punctuation and spaces are not letters.
 *  - English is case-insensitive and stored upper-case.
 */

const FINAL_TO_BASE: Record<string, string> = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const BASE_TO_FINAL: Record<string, string> = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };

export const HEBREW_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת'.split('');
export const ENGLISH_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Letters that sound alike to a child. Typing one for the other is a near-miss. */
const SOUND_ALIKE_GROUPS: string[][] = [
  ['כ', 'ק'],
  ['כ', 'ח'],
  ['ט', 'ת'],
  ['א', 'ע'],
  ['א', 'ה'],
  ['ס', 'ש'],
  ['ב', 'ו'],
  ['C', 'K'],
];

/** Niqqud + cantillation marks. */
const HEBREW_MARKS = /[֑-ׇ]/g;

/** Normalize ONE character to a collector letter, or '' if it is not a letter. */
export function normalizeLetter(ch: string): string {
  if (!ch) return '';
  const c = ch.replace(HEBREW_MARKS, '').trim().charAt(0);
  if (!c) return '';
  if (FINAL_TO_BASE[c]) return FINAL_TO_BASE[c];
  if (c >= 'א' && c <= 'ת') return c;
  const up = c.toUpperCase();
  if (up >= 'A' && up <= 'Z') return up;
  return '';
}

/** The alphabet a family types on for this adventure language. */
export function alphabetFor(language: 'he' | 'en'): string[] {
  return language === 'en' ? ENGLISH_LETTERS : HEBREW_LETTERS;
}

/** The collector letters of a phrase, in order, spaces and marks dropped. */
export function phraseLetters(text: string): string[] {
  const out: string[] = [];
  for (const ch of (text || '').replace(HEBREW_MARKS, '')) {
    const l = normalizeLetter(ch);
    if (l) out.push(l);
  }
  return out;
}

/** Lengths of the phrase's words in letters — the shape of the answer board. */
export function phraseWordLengths(text: string): number[] {
  return (text || '')
    .split(/\s+/)
    .map((w) => phraseLetters(w).length)
    .filter((n) => n > 0);
}

/**
 * Characters in a phrase that are neither letters of the adventure language nor
 * spaces (digits, punctuation, the other alphabet). Empty array = valid phrase.
 */
export function invalidPhraseChars(text: string, language: 'he' | 'en'): string[] {
  const alphabet = new Set(alphabetFor(language));
  const bad: string[] = [];
  for (const ch of (text || '').replace(HEBREW_MARKS, '')) {
    if (/\s/.test(ch)) continue;
    const l = normalizeLetter(ch);
    if (!l || !alphabet.has(l)) bad.push(ch);
  }
  return bad;
}

/** The collector letter an answer word yields: its first letter. */
export function letterOfAnswer(answerWord: string): string {
  const letters = phraseLetters(answerWord);
  return letters[0] || '';
}

/** Every letter that sounds like `letter` (excluding itself). */
export function soundAlikes(letter: string): string[] {
  const l = normalizeLetter(letter);
  const out = new Set<string>();
  for (const group of SOUND_ALIKE_GROUPS) {
    if (group.includes(l)) for (const g of group) if (g !== l) out.add(g);
  }
  return [...out];
}

/** True when a child could plausibly type a different letter for this one. */
export function isAmbiguousLetter(letter: string): boolean {
  return soundAlikes(letter).length > 0;
}

export type LetterMatch = 'exact' | 'soundAlike' | 'wrong';

/** Compare a typed letter with the riddle's letter. */
export function matchLetter(
  typed: string,
  expected: string,
  acceptSoundAlike: boolean
): LetterMatch {
  const t = normalizeLetter(typed);
  const e = normalizeLetter(expected);
  if (!t || !e) return 'wrong';
  if (t === e) return 'exact';
  if (acceptSoundAlike && soundAlikes(e).includes(t)) return 'soundAlike';
  return 'wrong';
}

/**
 * Lay collector letters back into the phrase's words for display, using the
 * Hebrew final form at the end of each word ("נופ גנוסר" → "נוף גנוסר").
 */
export function displayPhrase(letters: string[], wordLengths: number[]): string {
  const words: string[] = [];
  let i = 0;
  for (const len of wordLengths) {
    const word = letters.slice(i, i + len);
    i += len;
    if (word.length === len && len > 1) {
      const last = word[len - 1];
      if (BASE_TO_FINAL[last]) word[len - 1] = BASE_TO_FINAL[last];
    }
    words.push(word.join(''));
  }
  return words.join(' ');
}
