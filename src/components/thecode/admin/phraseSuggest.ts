// קוד הגמדים admin — "הצעות שאפשר להרכיב עכשיו": secret-phrase ideas built from the riddles the
// organizer ALREADY has. PURE (types + letters only) so it is unit-tested standalone
// (scripts/tests/thecode-phrase-suggest.test.mjs).
//
// A word is possible when every one of its letters can come from a DIFFERENT gnome (the engine's
// rule): a full bipartite matching letters ↔ active gnomes on active spots that have an IN-GAME
// riddle for that letter. A word that is one letter short is offered as "almost", with the
// letter to add a riddle for.

import type { TheCodeConfig, TheCodeRiddle } from '@/types/thecode';
import { letterOfAnswer, phraseLetters } from '@/lib/thecode/letters';

/** Common, child-friendly Hebrew words of 3–6 letters (final forms are normalized by phraseLetters). */
export const SUGGEST_WORDS: string[] = [
  'אוצר', 'אור', 'אריה', 'אבן', 'אגם', 'ארמון', 'בית', 'בלון', 'בננה', 'גמד', 'גמדים', 'גלידה', 'גשר', 'דבש', 'דובי',
  'הרים', 'ורד', 'זהב', 'זית', 'חבר', 'חברים', 'חול', 'חלום', 'חתול', 'טבע', 'טוסט', 'ירח', 'יער', 'כוכב',
  'כוכבים', 'כדור', 'כתר', 'כלב', 'לבבות', 'לימון', 'מזוודה', 'מים', 'מפתח', 'מפה', 'מלך', 'מלכה', 'משחק', 'נהר', 'נמר',
  'סוד', 'סודות', 'סוס', 'ספר', 'סירה', 'עוגה', 'ענן', 'פרח', 'פרחים', 'פיל', 'ציפור', 'קסם', 'קשת', 'קוסם',
  'ראש', 'רוח', 'שמש', 'שלום', 'שמחה', 'שיר', 'שוקו', 'תות', 'תפוח', 'תיק', 'תוכי', 'חופש', 'כיף', 'הרפתקה', 'אושר', 'מתנה',
];

export interface PhraseSuggestion {
  text: string;
  /** From the adventure's own title / spot names (shown first). */
  local: boolean;
}

export interface AlmostSuggestion extends PhraseSuggestion {
  /** The one letter a new riddle (on another gnome) would unlock. */
  missing: string;
}

export interface SuggestResult {
  ready: PhraseSuggestion[];
  almost: AlmostSuggestion[];
}

/** letter → distinct gnome ids that can give it right now (in-game riddle, gnome + spot on). */
export function sourcesByLetter(config: Pick<TheCodeConfig, 'spots' | 'gnomes'>, riddles: TheCodeRiddle[]): Map<string, string[]> {
  const spots = new Map(config.spots.map((s) => [s.id, s]));
  const gnomes = new Map(config.gnomes.map((g) => [g.id, g]));
  const out = new Map<string, string[]>();
  for (const r of riddles) {
    if (r.status !== 'published') continue;
    const letter = letterOfAnswer(r.answerWord) || r.letter;
    const g = gnomes.get(r.gnomeId);
    if (!letter || !g || !g.isActive || !spots.get(g.spotId)?.isActive) continue;
    const list = out.get(letter) || [];
    if (!list.includes(g.id)) list.push(g.id);
    out.set(letter, list);
  }
  return out;
}

/** How many letters of `letters` can get a distinct gnome (Kuhn's maximum matching). */
export function matchedCount(letters: string[], sources: Map<string, string[]>): number {
  const slotOf = new Map<string, number>();
  const tryAssign = (slot: number, seen: Set<string>): boolean => {
    for (const g of sources.get(letters[slot]) || []) {
      if (seen.has(g)) continue;
      seen.add(g);
      const other = slotOf.get(g);
      if (other === undefined || tryAssign(other, seen)) {
        slotOf.set(g, slot);
        return true;
      }
    }
    return false;
  };
  let n = 0;
  for (let i = 0; i < letters.length; i++) if (tryAssign(i, new Set())) n++;
  return n;
}

/** Place-name glue that is not a word on its own ("פינת הפסנתר", "צד המגלשה", "ליד הלובי"). */
const PLACE_GLUE = new Set(['פינת', 'פינה', 'צד', 'ליד', 'מול', 'חדר', 'שער', 'רחבת', 'קומת', 'קומה', 'מתחם', 'אזור', 'כניסה', 'יציאה', 'מעל', 'מתחת', 'בין', 'דרך', 'שביל']);

/** Words from the adventure's own names ("מלון הגפן", "פינת הפסנתר") — the most personal ideas. */
export function localWords(config: Pick<TheCodeConfig, 'title' | 'spots'>): string[] {
  const names = [config.title, ...config.spots.map((s) => s.name)];
  const out: string[] = [];
  for (const name of names) {
    for (const raw of (name || '').split(/[^א-ת׳"']+/)) {
      let w = raw.replace(/[׳"']/g, '');
      // "הבריכה" → "בריכה", "הגפן" → "גפן": the definite article reads badly as a secret word.
      if (w.startsWith('ה') && phraseLetters(w).length > 3) w = w.slice(1);
      const n = phraseLetters(w).length;
      if (n >= 3 && n <= 8 && !PLACE_GLUE.has(w)) out.push(w);
    }
  }
  return out;
}

/**
 * Ideas the organizer can add with one tap. `limit` keeps the screen calm (ready + almost).
 * Phrases already in the adventure are left out.
 */
export function suggestPhrases(
  config: Pick<TheCodeConfig, 'title' | 'spots' | 'gnomes' | 'phrases'>,
  riddles: TheCodeRiddle[],
  limit = { ready: 8, almost: 4 }
): SuggestResult {
  const sources = sourcesByLetter(config, riddles);
  const taken = new Set(config.phrases.map((p) => phraseLetters(p.text).join('')));
  const seen = new Set<string>();
  const candidates: PhraseSuggestion[] = [];
  const push = (text: string, local: boolean) => {
    const key = phraseLetters(text).join('');
    if (!key || seen.has(key) || taken.has(key)) return;
    seen.add(key);
    candidates.push({ text, local });
  };
  for (const w of localWords(config)) push(w, true);
  for (const w of SUGGEST_WORDS) push(w, false);

  const ready: PhraseSuggestion[] = [];
  const almost: AlmostSuggestion[] = [];
  for (const c of candidates) {
    const letters = phraseLetters(c.text);
    const got = matchedCount(letters, sources);
    if (got === letters.length) {
      ready.push(c);
    } else if (got === letters.length - 1) {
      // The letter to add: try each letter as "one more source" and keep the first that completes it.
      const missing = [...new Set(letters)].find((l) => {
        const extra = new Map(sources);
        extra.set(l, [...(sources.get(l) || []), `__new_${l}`]);
        return matchedCount(letters, extra) === letters.length;
      });
      if (missing) almost.push({ ...c, missing });
    }
  }
  // Personal words first, then longer words (they make better phrases).
  // Personal words first but at most half the list, so everyday words show up too; longer first.
  const pick = <T extends PhraseSuggestion>(list: T[], max: number): T[] => {
    const byLen = (a: T, b: T) => phraseLetters(b.text).length - phraseLetters(a.text).length;
    const local = list.filter((c) => c.local).sort(byLen).slice(0, Math.ceil(max / 2));
    const rest = list.filter((c) => !c.local).sort(byLen).slice(0, max - local.length);
    const more = list.filter((c) => c.local && !local.includes(c)).sort(byLen);
    return [...local, ...rest, ...more].slice(0, max);
  };
  return { ready: pick(ready, limit.ready), almost: pick(almost, limit.almost) };
}
