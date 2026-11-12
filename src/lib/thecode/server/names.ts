/**
 * הקוד — family names and emoji shown on public boards. Pure.
 *
 * Name: control / format / HTML-ish characters stripped, spaces collapsed, trimmed,
 * 1–20 characters, and a small Hebrew + English blocklist. Emoji: exactly one short
 * emoji grapheme, no letters or digits.
 */

export const FAMILY_NAME_MAX = 20;

const CONTROL = new RegExp('[\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}]', 'gu');
const HTMLISH = /[<>&"'`\\{}[\]]/g;
const NIQQUD = new RegExp('[\\u0591-\\u05C7]', 'g');
const LETTER_OR_DIGIT = new RegExp('[\\p{L}\\p{N}]', 'u');
const NON_WORD = new RegExp('[^\\p{L}\\p{N}]+', 'u');
const PICTOGRAPHIC = new RegExp('\\p{Extended_Pictographic}|\\p{Regional_Indicator}', 'u');

/** Whole words (after stripping one Hebrew prefix letter). */
const BLOCKED_WORDS = new Set([
  // Hebrew
  'זונה', 'זונות', 'שרמוטה', 'שרמוטות', 'כוס', 'כוסית', 'זין', 'זיין', 'זיון', 'חרא', 'מניאק', 'מניאקים',
  'מזדיין', 'לזיין', 'קוקסינל', 'מפגר', 'מפגרים', 'דביל', 'מטומטם', 'אידיוט', 'נאצי', 'נאצים', 'היטלר', 'מוות',
  'ערס', 'בהמה', 'סקס', 'פורנו',
  // English
  'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'porn',
  'sex', 'nazi', 'hitler', 'asshole', 'bastard', 'retard', 'fag', 'faggot', 'rape', 'kill',
]);
/** Fragments blocked anywhere in the squashed name (long enough not to hit real names). */
const BLOCKED_FRAGMENTS = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'whore', 'porn', 'hitler', 'שרמוט', 'מזדיינ', 'קוקסינל', 'היטלר'];
const HEBREW_PREFIXES = 'הובכלמש';

export type TheCodeNameResult = { ok: true; name: string } | { ok: false };

/** Clean text for display: no control/format chars, no HTML-ish chars, single spaces. */
export function cleanDisplayText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFC').replace(CONTROL, '').replace(HTMLISH, '').replace(/\s+/g, ' ').trim();
}

function isBlocked(name: string): boolean {
  const lower = name.toLowerCase().replace(NIQQUD, '');
  const tokens = lower.split(NON_WORD).filter(Boolean);
  for (const t of tokens) {
    if (BLOCKED_WORDS.has(t)) return true;
    if (t.length > 2 && HEBREW_PREFIXES.includes(t[0]) && BLOCKED_WORDS.has(t.slice(1))) return true;
  }
  const squashed = tokens.join('');
  return BLOCKED_FRAGMENTS.some((f) => squashed.includes(f));
}

/** Registration / operator rename. */
export function normalizeFamilyName(raw: unknown): TheCodeNameResult {
  const name = cleanDisplayText(raw);
  if (!name || [...name].length > FAMILY_NAME_MAX) return { ok: false };
  if (!LETTER_OR_DIGIT.test(name)) return { ok: false };
  if (isBlocked(name)) return { ok: false };
  return { ok: true, name };
}

/** One emoji grapheme (flags, ZWJ families and skin tones included), else null. */
export function normalizeEmoji(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > 16) return null;
  if (LETTER_OR_DIGIT.test(s) || !PICTOGRAPHIC.test(s)) return null;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    if ([...seg.segment(s)].length !== 1) return null;
  } catch {
    if ([...s].length > 2) return null;
  }
  return s;
}
