// הקוד — operator demo: a sample venue, nothing else. NO server, NO Firebase.
// The state transitions (admin/reducer.ts) and the readiness report (adminLive/report.ts,
// built on the real engine) are shared with the live admin, so the demo behaves exactly
// like the real thing — it just never saves.
//
// Sample data is deliberately imperfect so every warning is visible on first open:
//  - phrase "סוד הגמדים" needs ס׳ — the only ס׳ riddle (gnome 16) is still a draft → error
//  - spot "מגרש המשחקים": gnomes 14 + 15 look identical → error
//  - spot "הבריכה": red/white next to green/white → colour-blind warning
//  - gnome 13 has no riddle, gnome 17 is switched off, gnome 20 went silent
//  - spot "חניון האופניים" has no hints; ל׳ and ו׳ have too few riddles → few fresh suitcases

import type { TheCodeColor, TheCodeGnome, TheCodePhrase, TheCodeRiddle, TheCodeRules, TheCodeSpot } from '@/types/thecode';
import { letterOfAnswer } from '@/lib/thecode/letters';
import type { AdminActions, AdminPlayer, AdminState, GnomeStats, ImageUploader, RiddleStats } from '@/components/thecode/admin/model';
import { DAY, HOUR } from '@/components/thecode/admin/helpers';
import { createAdminActions, type AdminSetter } from '@/components/thecode/admin/reducer';
import { buildAdventureReport, phraseCoverage } from '@/components/thecode/adminLive/report';

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
  arrangeHelpCost: 10,
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
  [5, 's2', 'brown', 'green', 'e9b4mu7pk3vx2qd6', 'E9B4M'],
  [6, 's3', 'red', 'white', 'r2c8zf5nh9wt4ya3', 'R2C8Z'],
  [7, 's3', 'green', 'white', 'v7q3dx6mb2ke9pu4', 'V7Q3D'],
  [8, 's3', 'blue', 'yellow', 'y5u2kc8tr4hn7wf9', 'Y5U2K'],
  [9, 's4', 'purple', 'yellow', 'm3x9pe6qa2vd8bz5', 'M3X9P'],
  [10, 's4', 'yellow', 'green', 'f6w4nh3ry9tk2ec8', 'F6W4N'],
  [11, 's5', 'white', 'blue', 'c8k5vb2xm7pq4dy3', 'C8K5V'],
  [12, 's5', 'black', 'brown', 'u4r7ze9fn3wh6ta2', 'U4R7Z', true, false],
  [13, 's5', 'red', 'blue', 'd2y6qm8kc5xb3vp9', 'D2Y6Q', true, false],
  [14, 's6', 'blue', 'yellow', 't9h3wa5ue2rf7nk4', 'T9H3W'],
  [15, 's6', 'blue', 'yellow', 'b5p8cx3dv6mq9ky2', 'B5P8C', true, false],
  [16, 's7', 'green', 'purple', 'n7e2rk4yt8hw3fa6', 'N7E2R'],
  [17, 's7', 'brown', 'black', 'q3v6bm9pd2xc5uz8', 'Q3V6B', false],
  [18, 's8', 'yellow', 'red', 'a8z4fn7hw3ry6tk2', 'A8Z4F'],
  [19, 's8', 'white', 'green', 'x2d9kq5mc8vb4pe7', 'X2D9K', true, false],
  [20, 's9', 'purple', 'brown', 'g6t3uy8re2fn5wh9', 'G6T3U'],
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
// Report + actions — the SAME code the live admin runs
// ------------------------------------------------------------------

/** Readiness report from the real engine (adminLive/report.ts). */
export const validateAdventure = buildAdventureReport;
export { phraseCoverage };

/** In-memory actions (admin/reducer.ts). New gnomes get local codes; reset = the sample venue. */
export function createDemoActions(set: AdminSetter): AdminActions {
  return createAdminActions(set, { localCodes: true, reset: () => set(() => createDemoState()) });
}

/** Demo image "upload": a local object URL after a short fake progress. */
export const demoUploadImage: ImageUploader = (file, onProgress) =>
  new Promise((resolve) => {
    let f = 0;
    const t = window.setInterval(() => {
      f = Math.min(1, f + 0.25);
      onProgress(f);
      if (f >= 1) {
        window.clearInterval(t);
        resolve(URL.createObjectURL(file));
      }
    }, 120);
  });
