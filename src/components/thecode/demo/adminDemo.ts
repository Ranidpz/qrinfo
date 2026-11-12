// הקוד — operator demo: a sample venue + in-memory state + a local validator.
// NO server, NO Firebase. Everything fake lives in this one file; the screens only see
// the shapes in src/components/thecode/admin/model.ts.
//
// `validateAdventure` here is a stand-in for the engine's (src/lib/thecode/engine.ts,
// wave 1 session A). It returns the same TheCodeIssue[] so it can be swapped 1:1; the
// letter board / fresh-suitcase count around it are admin-only extras.
//
// Sample data is deliberately imperfect so every warning is visible on first open:
//  - phrase "סוד הגמדים" needs ס׳ — the only ס׳ riddle (gnome 16) is still a draft → error
//  - spot "מגרש המשחקים": gnomes 14 + 15 look identical → error
//  - spot "הבריכה": red/white next to green/white → colour-blind warning
//  - gnome 13 has no riddle, gnome 17 is switched off, gnome 20 went silent
//  - spot "חניון האופניים" has no hints; ל׳ and ו׳ have too few riddles → few fresh suitcases

import type {
  TheCodeColor,
  TheCodeConfig,
  TheCodeGnome,
  TheCodeIssue,
  TheCodePhrase,
  TheCodeRiddle,
  TheCodeRules,
  TheCodeSpot,
} from '@/types/thecode';
import {
  alphabetFor,
  invalidPhraseChars,
  isAmbiguousLetter,
  letterOfAnswer,
  phraseLetters,
  phraseWordLengths,
  soundAlikes,
} from '@/lib/thecode/letters';
import { describeGnome } from '@/components/thecode/GnomeFigure';
import type {
  AdminActions,
  AdminPlayer,
  AdminState,
  AdventureReport,
  CoverageLetter,
  GnomeStats,
  MissingLetter,
  PhraseCoverage,
  RiddleStats,
} from '@/components/thecode/admin/model';
import { comboKey, confusableColors, DAY, HOUR, letterLabel } from '@/components/thecode/admin/helpers';

// ------------------------------------------------------------------
// Small helpers the screens also use
// ------------------------------------------------------------------

function randomFrom(alphabet: string, len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
/** QR payload slug — crypto-random, permanent. */
const newCode = () => randomFrom('abcdefghijkmnpqrstuvwxyz23456789', 16);
/** Short code printed under the QR; no 0/O/1/I so it can be typed off a plate. */
const newManualCode = () => randomFrom('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);
const newId = (p: string) => `${p}_${randomFrom('abcdefghijklmnopqrstuvwxyz0123456789', 8)}`;

// ------------------------------------------------------------------
// Sample venue
// ------------------------------------------------------------------

export const DEFAULT_RULES: TheCodeRules = {
  pointsPerLetter: 10,
  suitcaseBonus: 50,
  hotStreakAt: 3,
  hotMultiplier: 2,
  hintCost: 3,
  freeWrongScans: 1,
  wrongScanPenalty: 2,
  freeWrongAnswers: 2,
  wrongAnswerPenalty: 2,
  answerCooldownSeconds: 20,
};

const SPOTS: TheCodeSpot[] = [
  { id: 's1', name: 'לובי — דלפק הקבלה', hints: ['בכניסה למלון', 'ליד המקום שבו מקבלים מפתחות', 'על המדף מתחת לשעון הגדול'], isActive: true },
  { id: 's2', name: 'פינת הפסנתר', hints: ['בלובי, בצד של הספות', 'ליד כלי נגינה גדול', 'מאחורי הכורסה הירוקה'], isActive: true },
  { id: 's3', name: 'הבריכה — צד המגלשה', hints: ['ליד המים', 'איפה שמחליקים', 'על הגדר הלבנה ליד המגלשה'], safetyNote: 'קרוב למים — לגשת רק עם מבוגר', isActive: true },
  { id: 's4', name: 'גינת התבלינים', hints: ['בחוץ, מאחורי חדר האוכל', 'במקום שמריח טוב', 'בין עציץ הנענע לעץ הלימון'], isActive: true },
  { id: 's5', name: 'חדר האוכל — פינת הקפה', hints: ['איפה שאוכלים ארוחת בוקר', 'ליד מכונת הקפה'], isActive: true },
  { id: 's6', name: 'מגרש המשחקים', hints: ['בחוץ, איפה שיש נדנדות', 'ליד ארגז החול', 'על הספסל הכחול'], isActive: true },
  { id: 's7', name: 'הספרייה', hints: ['בקומה הראשונה, בשקט', 'בין מדפי הספרים', 'ליד הגלובוס'], isActive: true },
  { id: 's8', name: 'מרפסת הנוף', hints: ['איפה שרואים את האגם', 'ליד המעקה', 'מתחת לעציץ הגדול בפינה'], isActive: true },
  { id: 's9', name: 'חניון האופניים', hints: [], safetyNote: 'מכוניות עוברות בכביש הגישה', isActive: true },
];

type G = [number, string, TheCodeColor, TheCodeColor, string, string, boolean?, boolean?];
// number, spot, body, hat, code, manualCode, active (default true), verified (default true)
const GNOMES_RAW: G[] = [
  [1, 's1', 'blue', 'red', 'k3m9q2xa7bv4pn8d', 'K3M9Q'],
  [2, 's1', 'yellow', 'blue', 'w8f2hz5rt6cy3ue9', 'W8F2H'],
  [3, 's2', 'black', 'white', 'p4n7sv2kd9qm6xe3', 'P4N7S'],
  [4, 's2', 'white', 'purple', 'h6t3ya8wn2fr5cz7', 'H6T3Y'],
  [5, 's2', 'orange', 'green', 'e9b4mu7pk3vx2qd6', 'E9B4M'],
  [6, 's3', 'red', 'white', 'r2c8zf5nh9wt4ya3', 'R2C8Z'],
  [7, 's3', 'green', 'white', 'v7q3dx6mb2ke9pu4', 'V7Q3D'],
  [8, 's3', 'blue', 'yellow', 'y5u2kc8tr4hn7wf9', 'Y5U2K'],
  [9, 's4', 'purple', 'yellow', 'm3x9pe6qa2vd8bz5', 'M3X9P'],
  [10, 's4', 'yellow', 'green', 'f6w4nh3ry9tk2ec8', 'F6W4N'],
  [11, 's5', 'white', 'blue', 'c8k5vb2xm7pq4dy3', 'C8K5V'],
  [12, 's5', 'black', 'orange', 'u4r7ze9fn3wh6ta2', 'U4R7Z', true, false],
  [13, 's5', 'red', 'blue', 'd2y6qm8kc5xb3vp9', 'D2Y6Q', true, false],
  [14, 's6', 'blue', 'yellow', 't9h3wa5ue2rf7nk4', 'T9H3W'],
  [15, 's6', 'blue', 'yellow', 'b5p8cx3dv6mq9ky2', 'B5P8C', true, false],
  [16, 's7', 'green', 'purple', 'n7e2rk4yt8hw3fa6', 'N7E2R'],
  [17, 's7', 'orange', 'black', 'q3v6bm9pd2xc5uz8', 'Q3V6B', false],
  [18, 's8', 'yellow', 'red', 'a8z4fn7hw3ry6tk2', 'A8Z4F'],
  [19, 's8', 'white', 'green', 'x2d9kq5mc8vb4pe7', 'X2D9K', true, false],
  [20, 's9', 'purple', 'orange', 'g6t3uy8re2fn5wh9', 'G6T3U'],
];

type R = [string, number, string, string, (TheCodeRiddle['status'])?, boolean?, (1 | 2 | 3)?, string[]?];
// id, gnome number, text, answer, status (published), acceptSoundAlike (true), difficulty (1), hints
const RIDDLES_RAW: R[] = [
  ['r1', 1, 'מה תלוי על הקיר מעל הדלפק ומראה לכם מתי ארוחת הבוקר?', 'שעון', 'published', true, 1, ['יש לו מחוגים', 'הוא מתקתק']],
  ['r2', 1, 'במה אורזים בגדים כשנוסעים לחופשה? חפשו אחת ליד הדלפק.', 'מזוודה', 'published', true, 1, ['יש לה גלגלים וידית']],
  ['r3', 2, 'מה מעלה אתכם לקומות בלי לטפס במדרגות?', 'מעלית', 'published', true, 1, []],
  ['r4', 2, 'ליד מה עומדים כשמקבלים את המפתח לחדר?', 'דלפק', 'published', true, 2, ['פקידת הקבלה עומדת מאחוריו']],
  ['r5', 3, 'לכלי הנגינה הגדול שלידינו יש קלידים לבנים ושחורים. איך קוראים לו?', 'פסנתר', 'published', true, 1, []],
  ['r6', 4, 'איזה פרח אדום עומד באגרטל על הפסנתר?', 'ורד', 'published', true, 1, ['יש לו קוצים']],
  ['r7', 4, 'מה דולק על השולחן הקטן ליד הפסנתר?', 'נר', 'published', true, 1, []],
  ['r8', 4, 'מה רואים בציור שעל הקיר — גבוה, ירוק ומכוסה עצים?', 'הר', 'published', true, 2, ['מטפסים עליו']],
  ['r9', 5, 'על מה יושבים ליד הפסנתר — רך, עם משענות לידיים?', 'כורסה', 'published', true, 1, []],
  ['r10', 6, 'מה יש בצד הזה של הבריכה שמחליקים עליו למים?', 'מגלשה', 'published', true, 1, []],
  ['r11', 7, 'מה עגול, תלוי על הגדר ומציל שחיינים?', 'גלגל', 'published', true, 2, ['הוא כתום-לבן']],
  ['r12', 8, 'מה פותחים מעל כיסא הנוח כדי שיהיה צל?', 'שמשייה', 'published', true, 1, []],
  ['r13', 8, 'מה מתנופף מעל עמדת המציל?', 'דגל', 'published', true, 2, []],
  ['r14', 9, 'איזה צמח בגינה מריח כמו יער, ושמים אותו על תפוחי אדמה?', 'רוזמרין', 'published', true, 3, ['העלים שלו דקים כמו מחטים', 'מתחיל כמו "רוני"']],
  ['r15', 9, 'איזה עלה ירוק ומרענן שמים בתה?', 'נענע', 'published', true, 1, []],
  ['r16', 10, 'איזה עץ קטן בגינה נותן פרי צהוב וחמוץ?', 'לימון', 'published', true, 1, []],
  ['r17', 10, 'איזה עץ עתיק עומד באמצע הגינה ונותן פרי קטן ושחור?', 'זית', 'published', true, 2, []],
  ['r18', 11, 'איזו עוגייה דקה עם משבצות מונחת ליד מכונת הקפה?', 'ופל', 'published', true, 1, []],
  ['r19', 11, 'מה שותים חם בכוס עם שקית?', 'תה', 'published', false, 1, []],
  ['r20', 12, 'מה מוזגים לקפה מהכד הלבן?', 'חלב', 'published', true, 1, []],
  ['r21', 12, 'במה שותים קפה?', 'כוס', 'published', true, 1, []],
  ['r22', 14, 'על מה מתנדנדים במגרש?', 'נדנדה', 'published', true, 1, []],
  ['r23', 14, 'איזו ציפור אפורה מסתובבת ליד המתקנים?', 'יונה', 'published', true, 2, []],
  ['r24', 15, 'איך קוראים למתקן הגבוה עם הסולם?', 'מגדל', 'published', true, 2, []],
  ['r25', 15, 'על מה עוברים מצד אחד של המתקן לצד השני?', 'גשר', 'published', true, 2, []],
  ['r26', 16, 'מה יש על כל המדפים כאן, ויש לו דפים וכריכה?', 'ספר', 'draft', true, 1, []],
  ['r27', 16, 'איזו בובה פרוותית יושבת על המדף העליון?', 'דובי', 'published', true, 1, []],
  ['r28', 17, 'מה עגול, מסתובב ויש עליו את כל הארצות?', 'גלובוס', 'published', true, 1, []],
  ['r29', 17, 'מה תלוי על החלון ואפשר לסגור אותו כשיש שמש?', 'וילון', 'published', true, 1, []],
  ['r30', 18, 'איך קוראים לאגם שרואים מהמרפסת?', 'כנרת', 'published', true, 1, []],
  ['r31', 18, 'מה רואים מעבר לאגם, רחוק באופק?', 'הרים', 'published', true, 2, []],
  ['r32', 19, 'מי יושב בסירה הקטנה עם חכה?', 'דייג', 'published', true, 2, []],
  ['r33', 19, 'מה קורה לשמש בערב מעל האגם?', 'שקיעה', 'published', true, 3, []],
  ['r34', 20, 'על מה רוכבים בשביל לאורך האגם?', 'אופניים', 'published', true, 1, []],
  ['r35', 20, 'מה סוגר את האופניים לעמוד?', 'מנעול', 'published', true, 1, []],
];

const PHRASES: TheCodePhrase[] = [
  { id: 'p1', text: 'שלום כנרת', isActive: true },
  { id: 'p2', text: 'חופש גדול', isActive: true },
  { id: 'p3', text: 'מזוודה', isActive: true },
  { id: 'p4', text: 'סוד הגמדים', isActive: true },
];

const RIDDLE_STATS: Record<string, RiddleStats> = {
  r1: { correct: 41, wrong: 6, hints: 4 },
  r2: { correct: 33, wrong: 4, hints: 2 },
  r3: { correct: 38, wrong: 3, hints: 1 },
  r5: { correct: 44, wrong: 2, hints: 0 },
  r6: { correct: 29, wrong: 9, hints: 7 },
  r10: { correct: 36, wrong: 4, hints: 3 },
  r11: { correct: 18, wrong: 12, hints: 9 },
  r14: { correct: 6, wrong: 19, hints: 14 },
  r16: { correct: 31, wrong: 2, hints: 1 },
  r18: { correct: 22, wrong: 8, hints: 5 },
  r19: { correct: 27, wrong: 11, hints: 2 },
  r20: { correct: 25, wrong: 5, hints: 3 },
  r22: { correct: 40, wrong: 1, hints: 0 },
  r30: { correct: 35, wrong: 3, hints: 2 },
  r33: { correct: 9, wrong: 14, hints: 12 },
  r34: { correct: 3, wrong: 0, hints: 0 },
};

const PLAYERS_RAW: [string, string, number, number, number, number, number][] = [
  // name, emoji, points, weekPoints, suitcases, weekSuitcases, hours since last seen
  ['משפחת לוי', '🦊', 412, 188, 4, 2, 2],
  ['הנינג׳ות', '🐼', 356, 356, 3, 3, 5],
  ['משפחת כהן', '🐳', 298, 0, 3, 0, 240],
  ['צוות שוקו', '🦄', 245, 120, 2, 1, 26],
  ['משפחת אברהם', '🐸', 190, 190, 2, 2, 1],
  ['הגמדים המהירים', '🚀', 160, 60, 1, 1, 50],
  ['משפחת חדד', '🐯', 130, 130, 1, 1, 3],
  ['טוסיק טוסיק', '🐙', 95, 95, 1, 1, 7],
  ['משפחת ביטון', '🦁', 60, 0, 0, 0, 400],
  ['בני דודים', '🐢', 40, 40, 0, 0, 0.3],
];

export function createDemoState(now = Date.now()): AdminState {
  const gnomes: TheCodeGnome[] = GNOMES_RAW.map(([number, spotId, bodyColor, hatColor, code, manualCode, active, verified]) => ({
    id: `g${number}`,
    number,
    code,
    manualCode,
    spotId,
    bodyColor,
    hatColor,
    isActive: active ?? true,
    verifiedOnSite: verified ?? true,
  }));

  const riddles: TheCodeRiddle[] = RIDDLES_RAW.map(([id, n, text, answer, status, sound, difficulty, hints]) => ({
    id,
    gnomeId: `g${n}`,
    type: 'observe',
    text,
    answerWord: answer,
    letter: letterOfAnswer(answer),
    acceptSoundAlike: sound ?? true,
    hints: hints ?? [],
    difficulty: difficulty ?? 1,
    status: status ?? 'published',
  }));

  const gnomeStats: Record<string, GnomeStats> = {};
  for (const g of gnomes) {
    const seed = (g.number * 37) % 23;
    gnomeStats[g.id] = {
      scans: g.isActive ? 20 + seed * 3 : 0,
      lastScanAt: g.isActive ? now - (0.3 + (seed % 7) * 2.5) * HOUR : now - 12 * DAY,
      verifiedAt: g.verifiedOnSite ? now - 9 * DAY : undefined,
    };
  }
  // Gnome 20 stopped answering a week ago → "כנראה נעלם".
  gnomeStats.g20 = { scans: 3, lastScanAt: now - 7 * DAY, verifiedAt: now - 9 * DAY };
  gnomeStats.g13 = { scans: 0, lastScanAt: undefined };

  const players: AdminPlayer[] = PLAYERS_RAW.map(([familyName, emoji, points, weekPoints, suitcases, weekSuitcases, hours], i) => ({
    id: `pl${i + 1}`,
    familyName,
    emoji,
    hidden: false,
    points,
    weekPoints,
    suitcases,
    weekSuitcases,
    lastSeenAt: now - hours * HOUR,
  }));

  return {
    config: {
      status: 'paused',
      title: 'מלון הגפן',
      language: 'he',
      spots: SPOTS.map((s) => ({ ...s, hints: [...s.hints] })),
      gnomes,
      phrases: PHRASES.map((p) => ({ ...p })),
      rules: { ...DEFAULT_RULES },
      requirePhoneVerification: false,
      activeHours: { from: '08:00', to: '21:00' },
      retentionDays: 30,
    },
    riddles,
    gnomeStats,
    riddleStats: { ...RIDDLE_STATS },
    players,
  };
}

// ------------------------------------------------------------------
// Validation (stand-in for engine.validateAdventure)
// ------------------------------------------------------------------

interface Usable {
  /** letter → gnome ids that can yield it (active gnome, active spot, published riddle). */
  byLetter: Map<string, string[]>;
  /** `${gnomeId}|${letter}` → number of published riddles (fresh-suitcase budget). */
  budget: Map<string, number>;
}

function usableSources(config: TheCodeConfig, riddles: TheCodeRiddle[]): Usable {
  const spots = new Map(config.spots.map((s) => [s.id, s]));
  const gnomes = new Map(config.gnomes.map((g) => [g.id, g]));
  const alphabet = new Set(alphabetFor(config.language));
  const byLetter = new Map<string, string[]>();
  const budget = new Map<string, number>();
  for (const r of riddles) {
    if (r.status !== 'published' || !r.letter || !r.text.trim() || !alphabet.has(r.letter)) continue;
    const g = gnomes.get(r.gnomeId);
    if (!g || !g.isActive || !spots.get(g.spotId)?.isActive) continue;
    const key = `${g.id}|${r.letter}`;
    budget.set(key, (budget.get(key) || 0) + 1);
    const list = byLetter.get(r.letter) || [];
    if (!list.includes(g.id)) list.push(g.id);
    byLetter.set(r.letter, list);
  }
  return { byLetter, budget };
}

/**
 * Max bipartite matching (Kuhn): phrase slots ↔ DISTINCT gnomes.
 * Returns the gnome per slot, or null for slots that could not be covered.
 */
function matchSlots(letters: string[], candidates: (letter: string) => string[]): (string | null)[] {
  const slotOf = new Map<string, number>(); // gnome → slot
  const tryAssign = (slot: number, seen: Set<string>): boolean => {
    for (const g of candidates(letters[slot])) {
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
  for (let i = 0; i < letters.length; i++) tryAssign(i, new Set());
  const out: (string | null)[] = letters.map(() => null);
  for (const [g, slot] of slotOf) out[slot] = g;
  return out;
}

export function phraseCoverage(text: string, config: TheCodeConfig, riddles: TheCodeRiddle[], usable = usableSources(config, riddles)): PhraseCoverage {
  const letters = phraseLetters(text);
  const wordLengths = phraseWordLengths(text);
  const invalidChars = [...new Set(invalidPhraseChars(text, config.language))];
  const assigned = matchSlots(letters, (l) => usable.byLetter.get(l) || []);

  const board: CoverageLetter[] = [];
  let w = 0;
  let inWord = 0;
  letters.forEach((letter, i) => {
    while (wordLengths[w] !== undefined && inWord >= wordLengths[w]) {
      w++;
      inWord = 0;
    }
    board.push({ letter, wordIndex: w, ok: assigned[i] !== null, have: (usable.byLetter.get(letter) || []).length });
    inWord++;
  });

  const gnomes = new Map(config.gnomes.map((g) => [g.id, g]));
  const spots = new Map(config.spots.map((s) => [s.id, s]));
  const missing: MissingLetter[] = [];
  for (const letter of [...new Set(letters)]) {
    if (!board.some((b) => b.letter === letter && !b.ok)) continue;
    const need = letters.filter((l) => l === letter).length;
    const have = (usable.byLetter.get(letter) || []).length;
    const dormant: MissingLetter['dormant'] = [];
    for (const r of riddles) {
      if (r.letter !== letter) continue;
      const g = gnomes.get(r.gnomeId);
      if (!g) continue;
      const why =
        r.status === 'draft' ? 'draft'
        : r.status === 'disabled' ? 'disabled'
        : !g.isActive ? 'gnomeOff'
        : !spots.get(g.spotId)?.isActive ? 'spotOff'
        : null;
      if (why) dormant.push({ riddleId: r.id, gnomeId: g.id, gnomeNumber: g.number, why });
    }
    missing.push({ letter, need, have, shared: have >= need, dormant });
  }

  return {
    letters: board,
    wordLengths,
    invalidChars,
    tooShort: letters.length < 3,
    missing,
    playable: letters.length >= 3 && invalidChars.length === 0 && missing.length === 0,
    hasFinalForms: /[ךםןףץ]/.test(text),
  };
}

/** How many of these phrases ONE family can open in a row with no riddle repeated. */
function countFreshSuitcases(phrases: string[][], usable: Usable): number {
  const simulate = (order: string[][]): number => {
    const left = new Map(usable.budget);
    let opened = 0;
    for (const letters of order) {
      const assigned = matchSlots(letters, (l) =>
        (usable.byLetter.get(l) || []).filter((g) => (left.get(`${g}|${l}`) || 0) > 0)
      );
      if (assigned.some((g) => g === null)) continue;
      assigned.forEach((g, i) => {
        const key = `${g}|${letters[i]}`;
        left.set(key, (left.get(key) || 0) - 1);
      });
      opened++;
    }
    return opened;
  };
  if (phrases.length > 7) return simulate(phrases);
  let best = 0;
  const permute = (rest: string[][], acc: string[][]) => {
    if (best === phrases.length) return;
    if (!rest.length) {
      best = Math.max(best, simulate(acc));
      return;
    }
    rest.forEach((p, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, p]));
  };
  permute(phrases, []);
  return best;
}

export const MIN_FRESH_SUITCASES = 2;

export function validateAdventure(state: AdminState): AdventureReport {
  const { config, riddles } = state;
  const issues: TheCodeIssue[] = [];
  const usable = usableSources(config, riddles);
  const spotIds = new Set(config.spots.map((s) => s.id));
  const phrases: Record<string, PhraseCoverage> = {};

  // Phrases
  const playableLetters: string[][] = [];
  for (const p of config.phrases) {
    const cov = phraseCoverage(p.text, config, riddles, usable);
    phrases[p.id] = cov;
    if (!p.isActive) continue;
    if (cov.invalidChars.length) {
      issues.push({
        severity: 'error', code: 'PHRASE_INVALID_CHARS', phraseId: p.id,
        message: `במשפט "${p.text}" יש תווים שאי אפשר לאסוף: ${cov.invalidChars.join(' ')}. השאירו רק אותיות ורווחים.`,
      });
    }
    if (cov.tooShort) {
      issues.push({ severity: 'error', code: 'PHRASE_TOO_SHORT', phraseId: p.id, message: `המשפט "${p.text}" קצר מדי — צריך לפחות 3 אותיות.` });
    }
    for (const m of cov.missing) {
      const L = letterLabel(m.letter);
      const draft = m.dormant.find((d) => d.why === 'draft');
      const off = m.dormant.find((d) => d.why === 'gnomeOff' || d.why === 'spotOff');
      let message: string;
      if (draft) {
        message = `חסרה חידה לאות ${L} — לגמד ${draft.gnomeNumber} יש חידה כזו בטיוטה. פרסמו אותה.`;
      } else if (off) {
        message = `חסרה חידה לאות ${L} — היא נמצאת אצל גמד ${off.gnomeNumber}, ש${off.why === 'gnomeOff' ? 'כבוי' : 'המקום שלו כבוי'}. הפעילו אותו או הוסיפו חידה לאות ${L} בגמד אחר.`;
      } else if (m.shared) {
        message = `לאות ${L} אין גמד פנוי — הגמדים שנותנים אותה כבר נותנים אות אחרת במשפט. הוסיפו חידה לאות ${L} בגמד נוסף.`;
      } else if (m.need > 1 && m.have > 0) {
        message = `האות ${L} מופיעה ${m.need} פעמים, ויש רק ${m.have === 1 ? 'גמד אחד' : `${m.have} גמדים`} שנותנים אותה. הוסיפו חידה לאות ${L} בגמד נוסף.`;
      } else {
        message = `חסרה חידה לאות ${L} — הוסיפו חידה שהתשובה שלה מתחילה ב־${m.letter}.`;
      }
      issues.push({ severity: 'error', code: 'PHRASE_LETTER_MISSING', phraseId: p.id, letter: m.letter, need: m.need, have: m.have, riddleId: draft?.riddleId, gnomeId: draft?.gnomeId, message: `"${p.text}": ${message}` });
    }
    if (cov.playable) playableLetters.push(phraseLetters(p.text));
  }
  if (!config.phrases.some((p) => p.isActive)) {
    issues.push({ severity: 'error', code: 'NO_ACTIVE_PHRASE', message: 'אין משפט פעיל. הוסיפו משפט סודי אחד לפחות.' });
  }

  // Gnomes
  for (const g of config.gnomes) {
    if (!spotIds.has(g.spotId)) {
      issues.push({ severity: 'error', code: 'GNOME_SPOT_MISSING', gnomeId: g.id, message: `גמד ${g.number} לא משויך למקום. בחרו לו מקום.` });
    }
    if (!g.isActive) continue;
    if (!riddles.some((r) => r.gnomeId === g.id && r.status === 'published')) {
      issues.push({ severity: 'warning', code: 'GNOME_WITHOUT_RIDDLE', gnomeId: g.id, message: `לגמד ${g.number} אין חידה מפורסמת, ולכן אף משפחה לא תגיע אליו.` });
    }
    if (!g.verifiedOnSite) {
      issues.push({ severity: 'warning', code: 'GNOME_NOT_VERIFIED', gnomeId: g.id, message: `גמד ${g.number} עוד לא נסרק במקום.` });
    }
  }

  // Spots
  for (const s of config.spots) {
    const here = config.gnomes.filter((g) => g.spotId === s.id && g.isActive);
    if (s.isActive && here.length && !s.hints.some((h) => h.trim())) {
      issues.push({ severity: 'warning', code: 'SPOT_WITHOUT_HINT', spotId: s.id, message: `למקום "${s.name}" אין רמזים, ומשפחות לא ימצאו אותו.` });
    }
    const seen = new Map<string, TheCodeGnome>();
    for (const g of here) {
      const twin = seen.get(comboKey(g));
      if (twin) {
        issues.push({
          severity: 'error', code: 'DUPLICATE_COLORS_AT_SPOT', spotId: s.id, gnomeId: g.id,
          message: `ב"${s.name}" גמדים ${twin.number} ו־${g.number} נראים אותו דבר (${describeGnome(g.bodyColor, g.hatColor)}). שנו צבעים או העבירו אחד מהם.`,
        });
      } else {
        seen.set(comboKey(g), g);
      }
    }
    for (let i = 0; i < here.length; i++) {
      for (let j = i + 1; j < here.length; j++) {
        if (confusableColors(here[i], here[j])) {
          issues.push({
            severity: 'warning', code: 'CONFUSABLE_COLORS_AT_SPOT', spotId: s.id, gnomeId: here[j].id,
            message: `ב"${s.name}" גמדים ${here[i].number} ו־${here[j].number} נבדלים רק באדום וירוק — ילדים עיוורי צבעים יתבלבלו.`,
          });
        }
      }
    }
  }

  // Riddles
  const gnomeNo = new Map(config.gnomes.map((g) => [g.id, g.number]));
  for (const r of riddles) {
    if (r.status !== 'published') continue;
    if (r.letter && isAmbiguousLetter(r.letter) && !r.acceptSoundAlike) {
      issues.push({
        severity: 'warning', code: 'RIDDLE_AMBIGUOUS_LETTER', riddleId: r.id, gnomeId: r.gnomeId, letter: r.letter,
        message: `התשובה "${r.answerWord}" (גמד ${gnomeNo.get(r.gnomeId)}) מתחילה ב־${letterLabel(r.letter)}, וילדים עלולים ללחוץ ${soundAlikes(r.letter).map(letterLabel).join(' או ')}. קבלו אות דומה בצליל או בחרו חפץ אחר.`,
      });
    }
  }

  // Fresh content for one family
  const freshSuitcases = countFreshSuitcases(playableLetters, usable);
  const demand = new Map<string, number>();
  for (const letters of playableLetters) for (const l of letters) demand.set(l, (demand.get(l) || 0) + 1);
  const supply = new Map<string, number>();
  for (const [key, n] of usable.budget) {
    const l = key.split('|')[1];
    supply.set(l, (supply.get(l) || 0) + n);
  }
  const letterStock = [...demand]
    .map(([letter, d]) => ({ letter, demand: d, supply: supply.get(letter) || 0 }))
    .sort((a, b) => a.supply - a.demand - (b.supply - b.demand));
  if (playableLetters.length && freshSuitcases < MIN_FRESH_SUITCASES) {
    const short = [...demand].filter(([l, n]) => (supply.get(l) || 0) < n).map(([l]) => letterLabel(l));
    issues.push({
      severity: 'warning', code: 'FEW_FRESH_ROUNDS', have: freshSuitcases, need: MIN_FRESH_SUITCASES,
      message: `משפחה תוכל לפתוח רק ${freshSuitcases === 1 ? 'מזוודה אחת' : `${freshSuitcases} מזוודות`} ואז ייגמרו לה החידות.${short.length ? ` הוסיפו עוד חידות לאותיות ${short.join(', ')}.` : ' הוסיפו עוד חידות או משפטים.'}`,
    });
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  return { issues, errors, warnings: issues.length - errors, freshSuitcases, phrases, letterStock };
}

// ------------------------------------------------------------------
// In-memory actions
// ------------------------------------------------------------------

type Setter = (fn: (s: AdminState) => AdminState) => void;

export function createDemoActions(set: Setter): AdminActions {
  const cfg = (fn: (c: TheCodeConfig) => TheCodeConfig) => set((s) => ({ ...s, config: fn(s.config) }));
  return {
    setStatus: (status) => cfg((c) => ({ ...c, status })),
    updateConfig: (patch) => cfg((c) => ({ ...c, ...patch })),
    updateRules: (patch) => cfg((c) => ({ ...c, rules: { ...c.rules, ...patch } })),

    addSpot: () => {
      const id = newId('s');
      cfg((c) => ({ ...c, spots: [...c.spots, { id, name: 'מקום חדש', hints: [], isActive: true }] }));
      return id;
    },
    updateSpot: (id, patch) => cfg((c) => ({ ...c, spots: c.spots.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    deleteSpot: (id) => cfg((c) => ({ ...c, spots: c.spots.filter((s) => s.id !== id) })),

    addGnomes: (spotId, specs) => {
      const ids = specs.map(() => newId('g'));
      set((s) => {
        let next = Math.max(0, ...s.config.gnomes.map((g) => g.number)) + 1;
        const fresh: TheCodeGnome[] = specs.map((spec, i) => ({
          id: ids[i],
          number: next++,
          code: newCode(),
          manualCode: newManualCode(),
          spotId,
          bodyColor: spec.bodyColor,
          hatColor: spec.hatColor,
          isActive: true,
          verifiedOnSite: false,
        }));
        const stats = { ...s.gnomeStats };
        for (const g of fresh) stats[g.id] = { scans: 0 };
        return { ...s, config: { ...s.config, gnomes: [...s.config.gnomes, ...fresh] }, gnomeStats: stats };
      });
      return ids;
    },
    updateGnome: (id, patch) => cfg((c) => ({ ...c, gnomes: c.gnomes.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    deleteGnome: (id) =>
      set((s) => ({
        ...s,
        config: { ...s.config, gnomes: s.config.gnomes.filter((g) => g.id !== id) },
        riddles: s.riddles.filter((r) => r.gnomeId !== id),
      })),
    verifyGnome: (id) =>
      set((s) => {
        const now = Date.now();
        const prev = s.gnomeStats[id] || { scans: 0 };
        return {
          ...s,
          config: { ...s.config, gnomes: s.config.gnomes.map((g) => (g.id === id ? { ...g, verifiedOnSite: true } : g)) },
          gnomeStats: { ...s.gnomeStats, [id]: { ...prev, verifiedAt: now, lastScanAt: now } },
        };
      }),

    addRiddle: (gnomeId, answerWord = '') => {
      const id = newId('r');
      set((s) => ({
        ...s,
        riddles: [
          ...s.riddles,
          { id, gnomeId, type: 'observe', text: '', answerWord, letter: letterOfAnswer(answerWord), acceptSoundAlike: true, hints: [], difficulty: 1, status: 'draft' },
        ],
      }));
      return id;
    },
    updateRiddle: (id, patch) =>
      set((s) => ({
        ...s,
        riddles: s.riddles.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          next.letter = letterOfAnswer(next.answerWord);
          return next;
        }),
      })),
    deleteRiddle: (id) => set((s) => ({ ...s, riddles: s.riddles.filter((r) => r.id !== id) })),

    addPhrase: (text) => {
      const id = newId('p');
      cfg((c) => ({ ...c, phrases: [...c.phrases, { id, text: text.trim(), isActive: true }] }));
      return id;
    },
    updatePhrase: (id, patch) => cfg((c) => ({ ...c, phrases: c.phrases.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    deletePhrase: (id) => cfg((c) => ({ ...c, phrases: c.phrases.filter((p) => p.id !== id) })),

    updatePlayer: (id, patch) =>
      set((s) => ({
        ...s,
        players: s.players.map((p) => {
          if (p.id !== id) return p;
          const renamed = patch.familyName !== undefined && patch.familyName !== p.familyName;
          return { ...p, ...patch, originalName: renamed ? p.originalName || p.familyName : p.originalName };
        }),
      })),

    reset: () => set(() => createDemoState()),
  };
}

