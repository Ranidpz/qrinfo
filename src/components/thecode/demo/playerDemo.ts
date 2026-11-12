// הקוד — LOCAL FAKE for the clickable player demo (/play/the-code).
//
// Everything fake lives in this one file: a sample hotel (9 spots, 20 gnomes, 3 phrases,
// one riddle per gnome) and a tiny in-memory state machine that imitates what the server
// + engine will answer. The screens never import this file — they take a PlayerState and
// report PlayerCallbacks (src/components/thecode/player/types.ts). When the real engine
// and API are wired, delete this file and the demo control bar; the screens stay.
//
// It deliberately keeps the server's shape (TheCodePlayer / TheCodeRun / TheCodeSlot from
// the shared contract) so the demo behaves like the real thing, but it is NOT the engine:
// routing, matching and repair are simplified.

import type {
  TheCodeConfig,
  TheCodeGnome,
  TheCodePlayer,
  TheCodeRiddle,
  TheCodeRun,
  TheCodeSpot,
} from '@/types/thecode';
import {
  HEBREW_LETTERS,
  matchLetter,
  phraseLetters,
  phraseWordLengths,
  soundAlikes,
} from '@/lib/thecode/letters';
import type {
  ArrangeView,
  CorrectView,
  LeaderRowView,
  PlayerGnomeView,
  PlayerProfileView,
  PlayerScreen,
  PlayerState,
  SuitcaseView,
} from '@/components/thecode/player/types';

// =================================================================
// Sample venue
// =================================================================

const spot = (id: string, name: string, hints: string[]): TheCodeSpot => ({ id, name, hints, isActive: true });

const SPOTS: TheCodeSpot[] = [
  spot('piano', 'הפסנתר בלובי', ['בלובי, איפה שמנגנים בערב', 'ליד הכלי עם הקלידים השחורים והלבנים', 'מתחת לכנף של הפסנתר, על השטיח']),
  spot('pond', 'בריכת הדגים', ['בגינה, איפה שיש מים שזזים', 'ליד הבריכה עם הדגים הכתומים', 'על האבן הגדולה ליד המזרקה']),
  spot('dining', 'הכניסה לחדר האוכל', ['איפה שכל המלון אוכל ארוחת בוקר', 'ליד הדלתות הגדולות של חדר האוכל', 'על אדן החלון מימין לדלת']),
  spot('library', 'פינת הספרייה', ['בפינה השקטה עם הכורסאות', 'ליד המדפים המלאים בספרים', 'על המדף התחתון, ליד ספרי הילדים']),
  spot('elevator', 'המעליות', ['איפה שעולים לחדרים', 'ליד הדלתות שנפתחות לבד', 'על השולחן הקטן בין שתי המעליות']),
  spot('terrace', 'מרפסת התצפית', ['בחוץ, איפה שרואים רחוק', 'ליד המעקה שמול הים', 'בתוך העציץ הגדול בקצה המרפסת']),
  spot('reception', 'דלפק הקבלה', ['איפה שמקבלים את המפתחות', 'ליד הדלפק הארוך בכניסה', 'ליד הפעמון שעל הדלפק']),
  spot('herbs', 'גינת התבלינים', ['בגינה שמריחה טוב', 'ליד הערוגות עם השלטים הקטנים', 'בין הנענע לבזיליקום']),
  spot('minigolf', 'המיני גולף', ['איפה שמגלגלים כדורים קטנים', 'ליד המסלול עם הגשר', 'ליד החור האחרון']),
];

type G = [number, string, TheCodeGnome['bodyColor'], TheCodeGnome['hatColor']];
const GNOME_ROWS: G[] = [
  [1, 'piano', 'blue', 'yellow'], [2, 'piano', 'green', 'red'], [3, 'piano', 'purple', 'white'],
  [4, 'pond', 'blue', 'yellow'], [5, 'pond', 'brown', 'green'],
  [6, 'dining', 'purple', 'brown'], [7, 'dining', 'white', 'red'],
  [8, 'library', 'black', 'yellow'], [9, 'library', 'red', 'white'], [10, 'library', 'blue', 'green'],
  [11, 'elevator', 'yellow', 'black'], [12, 'elevator', 'green', 'blue'],
  [13, 'terrace', 'white', 'blue'], [14, 'terrace', 'brown', 'purple'], [19, 'terrace', 'red', 'yellow'],
  [15, 'reception', 'purple', 'white'], [16, 'reception', 'blue', 'red'],
  [17, 'herbs', 'yellow', 'green'], [18, 'herbs', 'black', 'brown'],
  [20, 'minigolf', 'green', 'purple'],
];

const GNOMES: TheCodeGnome[] = GNOME_ROWS.map(([n, spotId, bodyColor, hatColor]) => ({
  id: `g${n}`,
  number: n,
  code: `demo-${n}`,
  manualCode: `${100 + n}`,
  spotId,
  bodyColor,
  hatColor,
  // Gnome 20 is "asleep" (broken / taken in) — it powers the sleeping-gnome screen.
  isActive: n !== 20,
}));

type R = [number, string, string, boolean, string[]];
const RIDDLE_ROWS: R[] = [
  [1, 'על מה יושבים כשמנגנים בפסנתר?', 'כיסא', true, ['יש לו ארבע רגליים', 'גם אתם יושבים עליו בארוחה']],
  [2, 'מה עומד על הפסנתר ומחזיק את דפי התווים?', 'מעמד', false, ['הוא עשוי עץ', 'מתחיל כמו מים']],
  [3, 'מה תלוי על הקיר מעל הפסנתר ומראה מה השעה?', 'שעון', true, ['יש לו מחוגים', 'תיק־תק']],
  [4, 'מי שוחים בבריכה ופותחים ופוסקים את הפה?', 'דגים', false, ['הם כתומים', 'יש להם סנפירים']],
  [5, 'מה זורם מהמזרקה כל הזמן?', 'מים', false, ['שותים אותם', 'רטוב!']],
  [6, 'מה מונח ליד המזלג ובעזרתו חותכים?', 'סכין', true, ['יש לו להב', 'לא נוגעים בלי מבוגר']],
  [7, 'מה תלוי על החלון ליד הכניסה, ואפשר להסיט אותו הצידה?', 'וילון', false, ['הוא עשוי בד', 'סוגרים אותו כשיש שמש חזקה']],
  [8, 'מה הופכים כשקוראים ספר?', 'דף', false, ['יש לו שני צדדים', 'בספר יש הרבה כאלה']],
  [9, 'מה עומד ליד הכורסה ומאיר כשקוראים בערב?', 'מנורה', false, ['יש לה נורה', 'מדליקים אותה בלחיצה']],
  [10, 'מה עושים עם ספר כשפותחים אותו?', 'קוראים', true, ['עושים את זה עם העיניים', 'גם עכשיו אתם עושים את זה']],
  [11, 'מה מופיע מעל דלת המעלית ומשתנה בכל קומה?', 'מספר', false, ['אפשר לספור איתו', 'אחת, שתיים, שלוש…']],
  [12, 'מה נפתח ונסגר במעלית?', 'דלת', false, ['גם לחדר שלכם יש אחת', 'יש לה ידית']],
  [13, 'מה כחול וגדול רואים מהמרפסת?', 'ים', false, ['יש בו גלים', 'שוחים בו בקיץ']],
  [14, 'מה מאיר את המרפסת באמצע היום?', 'שמש', true, ['היא צהובה וחמה', 'שמים כובע בגללה']],
  [19, 'על מה תולים את המגבות במרפסת?', 'ווים', false, ['הם מעוקלים', 'מתחיל באות שמופיעה פעמיים']],
  [15, 'מה פורח באגרטל שעל דלפק הקבלה?', 'ורדים', false, ['הם אדומים ומריחים טוב', 'יש להם קוצים']],
  [16, 'מה מזמינים בקבלה כדי לישון במלון?', 'חדר', true, ['יש בו מיטה', 'יש לו מספר על הדלת']],
  [17, 'איך קוראים למקום שבו גדלים התבלינים?', 'גינה', false, ['אתם עומדים בתוכה', 'משקים אותה כל בוקר']],
  [18, 'באיזה צבע העלים של הנענע?', 'ירוק', false, ['כמו דשא', 'גם הגמד הזה קצת כזה']],
  [20, 'מה כותבים על הכרטיס אחרי כל מסלול?', 'תוצאה', true, ['זה מספר', 'מי שיש לו הכי פחות מנצח']],
];

const RIDDLES: TheCodeRiddle[] = RIDDLE_ROWS.map(([n, text, answerWord, acceptSoundAlike, hints]) => ({
  id: `r${n}`,
  gnomeId: `g${n}`,
  type: 'observe',
  text,
  answerWord,
  letter: phraseLetters(answerWord)[0],
  acceptSoundAlike,
  hints,
  difficulty: 1,
  status: 'published',
}));

export const DEMO_CONFIG: TheCodeConfig = {
  status: 'published',
  title: 'קוד הגמדים — מלון חוף הצוק',
  language: 'he',
  spots: SPOTS,
  gnomes: GNOMES,
  phrases: [
    { id: 'p1', text: 'גמד חכם', isActive: true },
    { id: 'p2', text: 'שמש וים', isActive: true },
    { id: 'p3', text: 'קוד סודי', isActive: true },
  ],
  rules: {
    pointsPerLetter: 100,
    suitcaseBonus: 500,
    hotStreakAt: 3,
    hotMultiplier: 2,
    hintCost: 20,
    freeWrongScans: 1,
    wrongScanPenalty: 30,
    freeWrongAnswers: 2,
    wrongAnswerPenalty: 20,
    answerCooldownSeconds: 12,
    arrangeHelpCost: 50,
  },
  requirePhoneVerification: false,
  retentionDays: 90,
};

const ARRANGE_HELP_COST = 50;
const VENUE_NAME = 'מלון חוף הצוק';

/** Other families on this week's board. Fixed numbers so the screen-recording repeats. */
const BOARD_OTHERS: { id: string; familyName: string; emoji: string; points: number }[] = [
  { id: 'o1', familyName: 'האריות מקומה 4', emoji: '🦁', points: 2140 },
  { id: 'o2', familyName: 'הצוללים', emoji: '🤿', points: 1560 },
  { id: 'o3', familyName: 'הנמרים המהירים', emoji: '🐯', points: 1180 },
  { id: 'o4', familyName: 'צוות פיצה', emoji: '🍕', points: 940 },
  { id: 'o5', familyName: 'גמדי הים', emoji: '🌊', points: 610 },
  { id: 'o6', familyName: 'הפרפרים', emoji: '🦋', points: 380 },
];

// =================================================================
// Fake state
// =================================================================

interface DemoArrange {
  pool: string[];
  placed: (number | null)[];
  locked: boolean[];
  wrongTick: number;
  solved: boolean;
}

interface DemoProfile {
  player: TheCodePlayer;
  screen: PlayerScreen;
  lastCorrect: CorrectView | null;
  pendingLetter: string | null;
  riddleWrongTick: number;
  arrange: DemoArrange | null;
  /** Slot indexes in the order their letters were collected (the bag order). */
  collected: number[];
  lastSuitcase: SuitcaseView | null;
  /** Board ranks when the current run started — the summary animates from these. */
  ranksAtRunStart: Record<string, number>;
}

export interface DemoState {
  profiles: DemoProfile[];
  activeId: string | null;
  /** Registration in progress (first scan, or "add family" from the switcher). */
  registering: { mode: 'new' | 'recover'; firstGnomeId?: string; error?: string } | null;
  overlay: 'paused' | 'inAppBrowser' | 'networkError' | null;
  /** Message on the scanner screen after a typed code that is no gnome. */
  scannerError: string | null;
  muted: boolean;
  seq: number;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const gnomeById = (id: string) => GNOMES.find((g) => g.id === id)!;
const riddleById = (id: string) => RIDDLES.find((r) => r.id === id)!;
const spotById = (id: string) => SPOTS.find((s) => s.id === id)!;
const toGnomeView = (g: TheCodeGnome): PlayerGnomeView => ({
  id: g.id, number: g.number, bodyColor: g.bodyColor, hatColor: g.hatColor,
});

function active(s: DemoState): DemoProfile | null {
  return s.profiles.find((p) => p.player.id === s.activeId) || null;
}

/** The family the demo starts on: they scanned gnome 2 (green, red hat, piano). */
export function createDemoState(): DemoState {
  return {
    profiles: [],
    activeId: null,
    registering: { mode: 'new', firstGnomeId: 'g2' },
    overlay: null,
    scannerError: null,
    muted: false,
    seq: 1,
  };
}

function recoveryCodeFor(seq: number): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let x = 7919 * (seq + 3);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += abc[x % abc.length];
    x = Math.floor(x / abc.length) + 977 * (i + seq);
  }
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

function newPlayer(s: DemoState, familyName: string, emoji: string): TheCodePlayer {
  const seq = s.seq++;
  const now = Date.now();
  return {
    id: `me${seq}`,
    familyName,
    emoji,
    recoveryCode: recoveryCodeFor(seq),
    points: 0,
    streak: 0,
    suitcasesOpened: 0,
    openedPhraseIds: [],
    solvedRiddleIds: [],
    foundGnomeIds: [],
    run: null,
    createdAt: now,
    lastSeenAt: now,
  };
}

// ------------------------------------------------ board

function boardRows(s: DemoState): { id: string; familyName: string; emoji: string; points: number }[] {
  const mine = s.profiles.map((p) => ({
    id: p.player.id, familyName: p.player.familyName, emoji: p.player.emoji, points: p.player.points,
  }));
  return [...BOARD_OTHERS, ...mine].sort((a, b) => b.points - a.points);
}

function rankSnapshot(s: DemoState): Record<string, number> {
  const out: Record<string, number> = {};
  boardRows(s).forEach((r, i) => { out[r.id] = i; });
  return out;
}

// ------------------------------------------------ run building (simplified engine)

function buildRun(s: DemoState, p: DemoProfile, firstGnomeId?: string): TheCodeRun | null {
  const player = p.player;
  const phrase = DEMO_CONFIG.phrases.find((ph) => ph.isActive && !player.openedPhraseIds.includes(ph.id));
  if (!phrase) return null;
  const letters = phraseLetters(phrase.text);
  const used = new Set<string>();
  const usedSpots = new Set<string>();
  const slotGnome: (string | null)[] = letters.map(() => null);

  // The gnome the family is standing at becomes slot one if it can supply a letter.
  if (firstGnomeId) {
    const r = RIDDLES.find((x) => x.gnomeId === firstGnomeId && !player.solvedRiddleIds.includes(x.id));
    const i = r ? letters.indexOf(r.letter) : -1;
    if (r && i >= 0 && gnomeById(firstGnomeId).isActive) {
      slotGnome[i] = firstGnomeId;
      used.add(firstGnomeId);
      usedSpots.add(gnomeById(firstGnomeId).spotId);
    }
  }
  for (let i = 0; i < letters.length; i++) {
    if (slotGnome[i]) continue;
    const candidates = RIDDLES.filter((r) => {
      const g = gnomeById(r.gnomeId);
      return r.letter === letters[i] && g.isActive && !used.has(g.id) && !player.solvedRiddleIds.includes(r.id);
    }).sort((a, b) => {
      const ga = gnomeById(a.gnomeId);
      const gb = gnomeById(b.gnomeId);
      const score = (g: TheCodeGnome) =>
        (player.foundGnomeIds.includes(g.id) ? 2 : 0) + (usedSpots.has(g.spotId) ? 1 : 0);
      return score(ga) - score(gb) || ga.number - gb.number;
    });
    if (!candidates.length) return null; // never start a run that cannot finish
    const g = gnomeById(candidates[0].gnomeId);
    slotGnome[i] = g.id;
    used.add(g.id);
    usedSpots.add(g.spotId);
  }
  p.ranksAtRunStart = rankSnapshot(s);
  p.collected = [];
  return {
    id: `run${s.seq++}`,
    phraseId: phrase.id,
    slots: letters.map((letter, index) => {
      const gnomeId = slotGnome[index]!;
      const riddle = RIDDLES.find((r) => r.gnomeId === gnomeId)!;
      return {
        index, letter, gnomeId, riddleId: riddle.id, status: 'pending' as const,
        riddleHintsUsed: 0, locationHintsUsed: 0, wrongAnswers: 0, pointsEarned: 0,
      };
    }),
    targetSlotIndex: null,
    wrongGnomeIdsOnTarget: [],
    state: 'collecting',
    startedAt: Date.now(),
  };
}

function setTarget(run: TheCodeRun, index: number) {
  run.targetSlotIndex = index;
  run.wrongGnomeIdsOnTarget = [];
  const slot = run.slots[index];
  slot.status = 'active';
  slot.locationHintsUsed = Math.max(1, slot.locationHintsUsed); // the zone hint is free
}

/** Next pending slot, preferring a different spot from the one just solved. */
function nextTarget(run: TheCodeRun, lastSpotId?: string) {
  const pending = run.slots.filter((x) => x.status === 'pending');
  if (!pending.length) {
    run.targetSlotIndex = null;
    return;
  }
  const away = pending.find((x) => gnomeById(x.gnomeId).spotId !== lastSpotId);
  setTarget(run, (away || pending[0]).index);
}

function phraseOf(run: TheCodeRun) {
  return DEMO_CONFIG.phrases.find((ph) => ph.id === run.phraseId)!;
}

function shuffledPool(letters: string[], seed: number): string[] {
  const out = [...letters];
  let x = seed * 9301 + 49297;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.join('') === letters.join('') && out.length > 1) out.reverse();
  return out;
}

function startArranging(s: DemoState, p: DemoProfile) {
  const run = p.player.run!;
  run.state = 'arranging';
  run.targetSlotIndex = null;
  const letters = phraseLetters(phraseOf(run).text);
  p.arrange = {
    pool: shuffledPool(letters, s.seq++),
    placed: letters.map(() => null),
    locked: letters.map(() => false),
    wrongTick: 0,
    solved: false,
  };
}

function addPoints(player: TheCodePlayer, delta: number) {
  player.points = Math.max(0, player.points + delta);
}

/** Where a family goes back to after a warning screen. */
function homeScreen(p: DemoProfile): PlayerScreen {
  const run = p.player.run;
  if (!run) return { kind: 'summary' };
  if (run.state === 'arranging') return { kind: 'arrange' };
  if (run.state === 'opened') return { kind: 'summary' };
  return { kind: 'target' };
}

// =================================================================
// Player actions (what the real API will answer)
// =================================================================

export function demoRegister(s0: DemoState, familyName: string, emoji: string): DemoState {
  const s = clone(s0);
  const firstGnomeId = s.registering?.firstGnomeId;
  const player = newPlayer(s, familyName.trim() || 'הקבוצה שלנו', emoji);
  const p: DemoProfile = {
    player, screen: { kind: 'target' }, lastCorrect: null, pendingLetter: null,
    riddleWrongTick: 0, arrange: null, collected: [], lastSuitcase: null, ranksAtRunStart: {},
  };
  s.profiles.push(p);
  s.activeId = player.id;
  s.registering = null;
  p.ranksAtRunStart = rankSnapshot(s);
  player.run = buildRun(s, p, firstGnomeId);
  const run = player.run;
  if (!run) {
    p.screen = { kind: 'allDone' };
    return s;
  }
  const first = firstGnomeId ? run.slots.find((x) => x.gnomeId === firstGnomeId) : undefined;
  if (first) {
    setTarget(run, first.index);
    if (!player.foundGnomeIds.includes(first.gnomeId)) player.foundGnomeIds.push(first.gnomeId);
    p.screen = { kind: 'riddle' };
  } else {
    nextTarget(run);
    p.screen = { kind: 'target' };
  }
  return s;
}

export function demoRegisterMode(s0: DemoState, mode: 'new' | 'recover'): DemoState {
  const s = clone(s0);
  if (s.registering) s.registering = { ...s.registering, mode, error: undefined };
  return s;
}

/** Any code of 6+ characters restores a sample returning family with one suitcase open. */
export function demoRecover(s0: DemoState, code: string): DemoState {
  const clean = code.replace(/[^A-Za-z0-9]/g, '');
  if (clean.length < 6) {
    const s = clone(s0);
    if (s.registering) s.registering.error = 'הקוד לא נמצא. בדקו את האותיות ונסו שוב';
    return s;
  }
  let s = demoRegister(s0, 'הדולפינים', '🐬');
  s = clone(s);
  const p = active(s)!;
  const player = p.player;
  player.recoveryCode = `${clean.slice(0, 3)}-${clean.slice(3, 6)}`.toUpperCase();
  // History: they opened "גמד חכם" yesterday.
  const firstRun = player.run;
  if (firstRun) {
    firstRun.slots.forEach((x) => {
      player.solvedRiddleIds.push(x.riddleId);
      if (!player.foundGnomeIds.includes(x.gnomeId)) player.foundGnomeIds.push(x.gnomeId);
    });
    player.openedPhraseIds.push(firstRun.phraseId);
  }
  player.points = 1240;
  player.suitcasesOpened = 1;
  player.run = buildRun(s, p);
  if (!player.run) {
    p.screen = { kind: 'allDone' };
    return s;
  }
  nextTarget(player.run);
  p.screen = { kind: 'target' };
  return s;
}

/** A camera scan of gnome `gnomeId` by the active family. */
export function demoScan(s0: DemoState, gnomeId: string): DemoState {
  const s = clone(s0);
  s.scannerError = null;
  if (s.overlay === 'paused') return s;
  const p = active(s);
  if (!p) {
    s.registering = { mode: 'new', firstGnomeId: gnomeId };
    return s;
  }
  const gnome = gnomeById(gnomeId);
  const player = p.player;
  if (!gnome.isActive) {
    p.screen = { kind: 'gnomeAsleep', gnome: toGnomeView(gnome) };
    return s;
  }
  let run = player.run;
  if (!run || run.state === 'opened') {
    // A scan after a finished suitcase starts the next one around this gnome.
    run = player.run = buildRun(s, p, gnomeId);
    if (!run) {
      p.screen = { kind: 'allDone' };
      return s;
    }
    const first = run.slots.find((x) => x.gnomeId === gnomeId);
    if (first) {
      setTarget(run, first.index);
      if (!player.foundGnomeIds.includes(gnomeId)) player.foundGnomeIds.push(gnomeId);
      p.screen = { kind: 'riddle' };
    } else {
      nextTarget(run);
      p.screen = { kind: 'target' };
    }
    return s;
  }
  const inRun = run.slots.find((x) => x.gnomeId === gnomeId);
  if (inRun && (inRun.status === 'solved' || inRun.status === 'gifted')) {
    p.screen = { kind: 'alreadySolved', gnome: toGnomeView(gnome) };
    return s;
  }
  if (run.state === 'arranging') {
    p.screen = { kind: 'arrange' };
    return s;
  }
  const target = run.targetSlotIndex !== null ? run.slots[run.targetSlotIndex] : null;
  if (target && target.gnomeId === gnomeId) {
    if (!player.foundGnomeIds.includes(gnomeId)) player.foundGnomeIds.push(gnomeId);
    p.screen = { kind: 'riddle' };
    return s;
  }
  // Wrong gnome. The same wrong gnome never costs twice.
  const { freeWrongScans, wrongScanPenalty } = DEMO_CONFIG.rules;
  const seen = run.wrongGnomeIdsOnTarget.includes(gnomeId);
  if (!seen) run.wrongGnomeIdsOnTarget.push(gnomeId);
  const count = run.wrongGnomeIdsOnTarget.length;
  let penalty = 0;
  if (!seen && count > freeWrongScans) {
    penalty = Math.min(player.points, wrongScanPenalty);
    addPoints(player, -wrongScanPenalty);
    player.streak = 0;
  }
  p.screen = {
    kind: 'wrongGnome',
    gnome: toGnomeView(gnome),
    penalty,
    freeLeft: Math.max(0, freeWrongScans - count),
  };
  return s;
}

export function demoLocationHint(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  const run = p?.player.run;
  if (!p || !run || run.targetSlotIndex === null) return s;
  const slot = run.slots[run.targetSlotIndex];
  const hints = spotById(gnomeById(slot.gnomeId).spotId).hints;
  if (slot.locationHintsUsed >= hints.length) return s;
  slot.locationHintsUsed++;
  addPoints(p.player, -DEMO_CONFIG.rules.hintCost);
  p.player.streak = 0;
  return s;
}

export function demoRiddleHint(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  const run = p?.player.run;
  if (!p || !run || run.targetSlotIndex === null) return s;
  const slot = run.slots[run.targetSlotIndex];
  const riddle = riddleById(slot.riddleId);
  if (slot.riddleHintsUsed >= riddle.hints.length) return s;
  if (slot.riddleHintsUsed > 0) addPoints(p.player, -DEMO_CONFIG.rules.hintCost);
  slot.riddleHintsUsed++;
  p.player.streak = 0;
  return s;
}

export function demoPickLetter(s0: DemoState, letter: string): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (p) p.pendingLetter = letter;
  return s;
}

export function demoSubmitLetter(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  const run = p?.player.run;
  if (!p || !run || run.targetSlotIndex === null || !p.pendingLetter) return s;
  const player = p.player;
  const rules = DEMO_CONFIG.rules;
  const slot = run.slots[run.targetSlotIndex];
  const riddle = riddleById(slot.riddleId);
  const now = Date.now();
  if (slot.lastWrongAnswerAt && slot.wrongAnswers > rules.freeWrongAnswers
    && now < slot.lastWrongAnswerAt + rules.answerCooldownSeconds * 1000) {
    return s;
  }
  const match = matchLetter(p.pendingLetter, riddle.letter, riddle.acceptSoundAlike);
  if (match === 'wrong') {
    slot.wrongAnswers++;
    slot.lastWrongAnswerAt = now;
    player.streak = 0;
    p.riddleWrongTick++;
    p.pendingLetter = null;
    if (slot.wrongAnswers > rules.freeWrongAnswers) addPoints(player, -rules.wrongAnswerPenalty);
    return s;
  }
  const streak = player.streak + 1;
  const hot = streak >= rules.hotStreakAt;
  const points = rules.pointsPerLetter * (hot ? rules.hotMultiplier : 1);
  player.streak = streak;
  addPoints(player, points);
  slot.status = 'solved';
  slot.pointsEarned = points;
  p.collected.push(slot.index);
  player.solvedRiddleIds.push(riddle.id);
  if (!player.foundGnomeIds.includes(slot.gnomeId)) player.foundGnomeIds.push(slot.gnomeId);
  p.pendingLetter = null;
  const lastSpot = gnomeById(slot.gnomeId).spotId;
  const lastLetter = run.slots.every((x) => x.status === 'solved' || x.status === 'gifted');
  p.lastCorrect = {
    letter: riddle.letter,
    points,
    hot,
    becameHot: streak === rules.hotStreakAt,
    spellingTip: match === 'soundAlike' ? `כמעט! ${riddle.answerWord} כותבים ב־${riddle.letter}׳` : undefined,
    lastLetter,
  };
  if (lastLetter) startArranging(s, p);
  else nextTarget(run, lastSpot);
  p.screen = { kind: 'correct' };
  return s;
}

export function demoContinue(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (p) p.screen = homeScreen(p);
  return s;
}

function checkArrangement(p: DemoProfile) {
  const a = p.arrange!;
  if (a.placed.some((x) => x === null)) return;
  const want = phraseLetters(phraseOf(p.player.run!).text);
  const got = a.placed.map((i) => a.pool[i!]);
  if (got.join('') === want.join('')) a.solved = true;
  else a.wrongTick++;
}

export function demoArrangePlace(s0: DemoState, poolIndex: number): DemoState {
  const s = clone(s0);
  const p = active(s);
  const a = p?.arrange;
  if (!p || !a || a.solved || a.placed.includes(poolIndex)) return s;
  const cell = a.placed.findIndex((x, i) => x === null && !a.locked[i]);
  if (cell < 0) return s;
  a.placed[cell] = poolIndex;
  checkArrangement(p);
  return s;
}

export function demoArrangeRemove(s0: DemoState, cellIndex: number): DemoState {
  const s = clone(s0);
  const a = active(s)?.arrange;
  if (!a || a.solved || a.locked[cellIndex]) return s;
  a.placed[cellIndex] = null;
  return s;
}

/** "מקמו לי אות": fixes the first wrong/empty cell with the right letter, for points. */
export function demoArrangeHelp(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  const a = p?.arrange;
  if (!p || !a || a.solved) return s;
  const want = phraseLetters(phraseOf(p.player.run!).text);
  const cell = want.findIndex((l, i) => !a.locked[i] && (a.placed[i] === null || a.pool[a.placed[i]!] !== l));
  if (cell < 0) return s;
  // Free a pool tile with the needed letter that isn't already correctly locked.
  const lockedPool = new Set(a.placed.filter((x, i) => x !== null && a.locked[i]) as number[]);
  const candidates = a.pool.map((l, i) => i).filter((i) => a.pool[i] === want[cell] && !lockedPool.has(i));
  const pick = candidates.find((i) => !a.placed.includes(i)) ?? candidates[0];
  if (pick === undefined) return s;
  const from = a.placed.indexOf(pick);
  if (from >= 0) a.placed[from] = null;
  a.placed[cell] = pick;
  a.locked[cell] = true;
  addPoints(p.player, -ARRANGE_HELP_COST);
  checkArrangement(p);
  return s;
}

export function demoOpenSuitcase(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  const run = p?.player.run;
  if (!p || !run || !p.arrange?.solved) return s;
  const player = p.player;
  addPoints(player, DEMO_CONFIG.rules.suitcaseBonus);
  player.suitcasesOpened++;
  player.openedPhraseIds.push(run.phraseId);
  run.state = 'opened';
  run.openedAt = Date.now();
  p.lastSuitcase = {
    phraseText: phraseOf(run).text,
    bonus: DEMO_CONFIG.rules.suitcaseBonus,
    suitcaseNumber: player.suitcasesOpened,
  };
  p.arrange = null;
  p.screen = { kind: 'suitcase' };
  return s;
}

export function demoShowSummary(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (p) p.screen = { kind: 'summary' };
  return s;
}

export function demoNewSuitcase(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (!p) return s;
  const run = buildRun(s, p);
  p.player.run = run;
  if (!run) {
    p.screen = { kind: 'allDone' };
    return s;
  }
  nextTarget(run);
  p.player.streak = p.player.streak; // streak carries over between suitcases
  p.screen = { kind: 'target' };
  return s;
}

export function demoSwitchProfile(s0: DemoState, id: string): DemoState {
  const s = clone(s0);
  if (s.profiles.some((p) => p.player.id === id)) {
    s.activeId = id;
    s.registering = null;
  }
  return s;
}

export function demoAddProfile(s0: DemoState): DemoState {
  const s = clone(s0);
  s.registering = { mode: 'new' };
  return s;
}

export function demoToggleMute(s0: DemoState): DemoState {
  return { ...s0, muted: !s0.muted };
}

/** "סרקו גמד" on the target screen → the scanner (a simulated viewfinder in the demo). */
export function demoOpenScanner(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (p) p.screen = { kind: 'scanner' };
  s.scannerError = null;
  return s;
}

export function demoCloseScanner(s0: DemoState): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (p) p.screen = homeScreen(p);
  s.scannerError = null;
  return s;
}

/** A code typed under the viewfinder (or a /g/{code} slug): the demo's gnomes are `demo-N` / `1NN`. */
export function demoScanCode(s0: DemoState, code: string): DemoState {
  const c = code.trim().toLowerCase();
  const g = GNOMES.find((x) => x.code.toLowerCase() === c || x.manualCode.toLowerCase() === c);
  if (!g) return { ...s0, scannerError: 'לא מצאנו גמד עם הקוד הזה. בדקו אותו ונסו שוב.' };
  return demoScan({ ...s0, scannerError: null }, g.id);
}

export function demoSetOverlay(s0: DemoState, overlay: DemoState['overlay']): DemoState {
  return { ...s0, overlay };
}

// =================================================================
// View (what the screens receive)
// =================================================================

function profileView(p: DemoProfile): PlayerProfileView {
  const pl = p.player;
  return {
    id: pl.id,
    familyName: pl.familyName,
    emoji: pl.emoji,
    recoveryCode: pl.recoveryCode,
    points: pl.points,
    streak: pl.streak,
    hot: pl.streak >= DEMO_CONFIG.rules.hotStreakAt,
    suitcasesOpened: pl.suitcasesOpened,
  };
}

export function demoView(s: DemoState): PlayerState {
  const p = active(s);
  const base: PlayerState = {
    screen: { kind: 'register', mode: 'new' },
    venueName: VENUE_NAME,
    profile: p ? profileView(p) : null,
    profiles: s.profiles.map(profileView),
    collector: null,
    target: null,
    riddle: null,
    correct: null,
    arrange: null,
    suitcase: null,
    summary: null,
    scanner: { camera: false, error: s.scannerError, busy: false },
    alphabet: HEBREW_LETTERS,
    muted: s.muted,
  };

  if (s.overlay) return { ...base, screen: { kind: s.overlay } };
  if (s.registering || !p) {
    const first = s.registering?.firstGnomeId;
    return {
      ...base,
      screen: {
        kind: 'register',
        mode: s.registering?.mode || 'new',
        recoverError: s.registering?.error,
        firstGnome: first ? toGnomeView(gnomeById(first)) : undefined,
      },
    };
  }

  const player = p.player;
  const run = player.run;
  const rules = DEMO_CONFIG.rules;
  const view: PlayerState = { ...base, screen: p.screen, correct: p.lastCorrect, suitcase: p.lastSuitcase };

  if (run) {
    const phrase = phraseOf(run);
    view.collector = {
      letters: p.collected.map((i) => ({ letter: run.slots[i].letter, gifted: run.slots[i].status === 'gifted' })),
      total: run.slots.length,
    };
    if (run.targetSlotIndex !== null) {
      const slot = run.slots[run.targetSlotIndex];
      const gnome = gnomeById(slot.gnomeId);
      const hints = spotById(gnome.spotId).hints;
      const riddle = riddleById(slot.riddleId);
      const done = run.slots.filter((x) => x.status === 'solved' || x.status === 'gifted').length;
      view.target = {
        gnome: toGnomeView(gnome),
        hintsShown: hints.slice(0, Math.max(1, slot.locationHintsUsed)),
        nextHintCost: slot.locationHintsUsed < hints.length ? rules.hintCost : null,
        slotNumber: done + 1,
      };
      const inCooldown = slot.wrongAnswers > rules.freeWrongAnswers && slot.lastWrongAnswerAt;
      view.riddle = {
        gnome: toGnomeView(gnome),
        text: riddle.text,
        imageUrl: riddle.imageUrl,
        hintsShown: riddle.hints.slice(0, slot.riddleHintsUsed),
        nextHintCost: slot.riddleHintsUsed < riddle.hints.length ? (slot.riddleHintsUsed === 0 ? 0 : rules.hintCost) : null,
        wrongTick: p.riddleWrongTick,
        wrongCount: slot.wrongAnswers,
        freeWrongAnswers: rules.freeWrongAnswers,
        cooldownUntil: inCooldown ? slot.lastWrongAnswerAt! + rules.answerCooldownSeconds * 1000 : null,
        pendingLetter: p.pendingLetter,
        submitting: false,
      };
    }
    if (p.arrange) {
      const a = p.arrange;
      const arrange: ArrangeView = {
        pool: a.pool,
        placed: a.placed,
        locked: a.locked,
        wordLengths: phraseWordLengths(phrase.text),
        helpCost: ARRANGE_HELP_COST,
        wrongTick: a.wrongTick,
        solved: a.solved,
      };
      view.arrange = arrange;
    }
  }

  const ranks = p.ranksAtRunStart;
  const rows = boardRows(s);
  const leaderboard: LeaderRowView[] = rows.map((r) => ({
    ...r,
    prevRank: ranks[r.id] ?? rows.length - 1,
    isMe: r.id === player.id,
  }));
  view.summary = {
    album: GNOMES.map((g) => ({
      gnome: toGnomeView(g),
      found: player.foundGnomeIds.includes(g.id),
    })),
    leaderboard,
    canStartNew: DEMO_CONFIG.phrases.some((ph) => ph.isActive && !player.openedPhraseIds.includes(ph.id)),
  };
  return view;
}

// =================================================================
// Demo control bar (simulated camera + shortcuts for screen-recording)
// =================================================================

function targetGnomeId(s: DemoState): string | null {
  const run = active(s)?.player.run;
  if (!run || run.targetSlotIndex === null) return null;
  return run.slots[run.targetSlotIndex].gnomeId;
}

export function demoScanTarget(s: DemoState): DemoState {
  const id = targetGnomeId(s);
  if (id) return demoScan(s, id);
  const p = active(s);
  if (!p) return s;
  // No target (arranging / finished): scan a fresh gnome to show what happens.
  const fresh = GNOMES.find((g) => g.isActive && !p.player.foundGnomeIds.includes(g.id));
  return fresh ? demoScan(s, fresh.id) : s;
}

/** A gnome that isn't the target, preferring one standing NEXT to it (the realistic mistake). */
export function demoScanWrong(s: DemoState): DemoState {
  const p = active(s);
  const run = p?.player.run;
  const targetId = targetGnomeId(s);
  if (!p || !run || !targetId) return s;
  const inRun = new Set(run.slots.filter((x) => x.status !== 'pending' && x.status !== 'active').map((x) => x.gnomeId));
  const targetSpot = gnomeById(targetId).spotId;
  const ok = GNOMES.filter((g) => g.isActive && g.id !== targetId && !inRun.has(g.id));
  const fresh = ok.filter((g) => !run.wrongGnomeIdsOnTarget.includes(g.id));
  const pool = fresh.length ? fresh : ok;
  const pick = pool.find((g) => g.spotId === targetSpot) || pool[0];
  return pick ? demoScan(s, pick.id) : s;
}

export function demoScanSolved(s0: DemoState): DemoState {
  let s = s0;
  const p = active(s);
  if (!p?.player.run) return s;
  let solved = p.player.run.slots.find((x) => x.status === 'solved');
  if (!solved && p.player.run.state === 'collecting') {
    s = demoAnswerRight(demoScanTarget(s));
    solved = active(s)!.player.run!.slots.find((x) => x.status === 'solved');
  }
  return solved ? demoScan(s, solved.gnomeId) : s;
}

export function demoScanSleeping(s: DemoState): DemoState {
  if (!active(s)) return s;
  const sleeping = GNOMES.find((g) => !g.isActive);
  return sleeping ? demoScan(s, sleeping.id) : s;
}

function currentRiddle(s: DemoState): TheCodeRiddle | null {
  const run = active(s)?.player.run;
  if (!run || run.targetSlotIndex === null) return null;
  return riddleById(run.slots[run.targetSlotIndex].riddleId);
}

export function demoAnswerRight(s0: DemoState): DemoState {
  const r = currentRiddle(s0);
  if (!r || active(s0)?.screen.kind !== 'riddle') return s0;
  // The shortcut always lands, even mid-cooldown (it is the presenter's remote, not a player).
  const s = clone(s0);
  const run = active(s)!.player.run!;
  delete run.slots[run.targetSlotIndex!].lastWrongAnswerAt;
  return demoSubmitLetter(demoPickLetter(s, r.letter));
}

export function demoAnswerWrong(s: DemoState): DemoState {
  const r = currentRiddle(s);
  if (!r || active(s)?.screen.kind !== 'riddle') return s;
  const avoid = new Set([r.letter, ...soundAlikes(r.letter)]);
  const wrong = HEBREW_LETTERS.find((l) => !avoid.has(l))!;
  return demoSubmitLetter(demoPickLetter(s, wrong));
}

function ensureProfile(s: DemoState): DemoState {
  if (active(s)) return { ...s, registering: null, overlay: null };
  return demoRegister({ ...s, registering: { mode: 'new' }, overlay: null }, 'הינשופים', '🦉');
}

function ensureCollecting(s0: DemoState): DemoState {
  let s = ensureProfile(s0);
  const run = active(s)!.player.run;
  if (run && run.state === 'collecting') return s;
  s = demoNewSuitcase(s);
  if (!active(s)!.player.run) {
    // Demo only: every suitcase is open, so forget the history ("a new week") and go again.
    s = clone(s);
    const pl = active(s)!.player;
    pl.openedPhraseIds = [];
    pl.solvedRiddleIds = [];
    s = demoNewSuitcase(s);
  }
  return s;
}

function solveAllSlots(s0: DemoState): DemoState {
  let s = ensureCollecting(s0);
  for (let guard = 0; guard < 12; guard++) {
    const run = active(s)?.player.run;
    if (!run || run.state !== 'collecting') break;
    s = demoAnswerRight(demoScanTarget(s));
  }
  return s;
}

export type DemoJump =
  | 'register' | 'recover' | 'target' | 'scanner' | 'riddle' | 'correct' | 'soundAlike' | 'hot' | 'wrongLetters'
  | 'wrongGnomeFree' | 'wrongGnomePenalty' | 'alreadySolved' | 'gnomeAsleep' | 'arrange'
  | 'suitcase' | 'summary' | 'allDone' | 'paused' | 'inAppBrowser' | 'networkError';

export function demoJump(s0: DemoState, to: DemoJump): DemoState {
  const s = { ...s0, overlay: null };
  switch (to) {
    case 'register':
      return { ...createDemoState(), muted: s0.muted };
    case 'recover':
      return { ...createDemoState(), muted: s0.muted, registering: { mode: 'recover' } };
    case 'target': {
      const t = ensureCollecting(s);
      return withScreen(t, { kind: 'target' });
    }
    case 'scanner':
      return demoOpenScanner(withScreen(ensureCollecting(s), { kind: 'target' }));
    case 'riddle':
      return demoScanTarget(withScreen(ensureCollecting(s), { kind: 'target' }));
    case 'correct':
      return demoAnswerRight(demoJump(s, 'riddle'));
    case 'hot': {
      let t = ensureCollecting(s);
      for (let i = 0; i < 3; i++) {
        t = ensureCollecting(t);
        t = demoAnswerRight(demoScanTarget(withScreen(t, { kind: 'target' })));
        if (active(t)!.lastCorrect?.becameHot) break;
      }
      return t;
    }
    case 'soundAlike': {
      // Steer the target to a riddle that accepts a sound-alike letter, then type it.
      let t = ensureCollecting(s);
      for (let guard = 0; guard < 3; guard++) {
        t = ensureCollecting(t);
        const run = active(t)!.player.run!;
        const slot = run.slots.find((x) => (x.status === 'pending' || x.status === 'active')
          && riddleById(x.riddleId).acceptSoundAlike && soundAlikes(x.letter).length > 0);
        if (slot) {
          t = clone(t);
          const r2 = active(t)!.player.run!;
          r2.slots.forEach((x) => { if (x.status === 'active') x.status = 'pending'; });
          setTarget(r2, slot.index);
          t = demoScanTarget(withScreen(t, { kind: 'target' }));
          const near = soundAlikes(slot.letter)[0];
          return demoSubmitLetter(demoPickLetter(t, near));
        }
        t = demoNewSuitcase(t);
      }
      return demoJump(s, 'correct');
    }
    case 'wrongLetters': {
      let t = demoJump(s, 'riddle');
      for (let i = 0; i <= DEMO_CONFIG.rules.freeWrongAnswers; i++) t = demoAnswerWrong(t);
      return t;
    }
    case 'wrongGnomeFree': {
      const t = clone(withScreen(ensureCollecting(s), { kind: 'target' }));
      active(t)!.player.run!.wrongGnomeIdsOnTarget = [];
      return demoScanWrong(t);
    }
    case 'wrongGnomePenalty': {
      let t = demoJump(s, 'wrongGnomeFree');
      const p = active(t)!;
      if (p.player.points < 60) {
        t = clone(t);
        active(t)!.player.points += 200; // so the −N has something to fall from
      }
      return demoScanWrong(t);
    }
    case 'alreadySolved':
      return demoScanSolved(withScreen(ensureCollecting(s), { kind: 'target' }));
    case 'gnomeAsleep':
      return demoScanSleeping(ensureProfile(s));
    case 'arrange': {
      const t = active(s)?.player.run?.state === 'arranging' ? s : solveAllSlots(s);
      return withScreen(t, { kind: 'arrange' });
    }
    case 'suitcase': {
      let t = demoJump(s, 'arrange');
      t = clone(t);
      const p = active(t)!;
      const want = phraseLetters(phraseOf(p.player.run!).text);
      const a = p.arrange!;
      const usedPool = new Set<number>();
      a.placed = want.map((l) => {
        const i = a.pool.findIndex((x, k) => x === l && !usedPool.has(k));
        usedPool.add(i);
        return i;
      });
      a.solved = true;
      return demoOpenSuitcase(t);
    }
    case 'summary':
      return demoShowSummary(active(s)?.player.run?.state === 'opened' ? s : demoJump(s, 'suitcase'));
    case 'allDone': {
      let t = ensureProfile(s);
      for (let guard = 0; guard < 4; guard++) {
        const p = active(t)!;
        if (!DEMO_CONFIG.phrases.some((ph) => !p.player.openedPhraseIds.includes(ph.id))) break;
        t = demoJump(t, 'suitcase');
      }
      return withScreen(t, { kind: 'allDone' });
    }
    case 'paused':
    case 'inAppBrowser':
    case 'networkError':
      return demoSetOverlay(ensureProfile(s0), to);
  }
}

function withScreen(s0: DemoState, screen: PlayerScreen): DemoState {
  const s = clone(s0);
  const p = active(s);
  if (p) p.screen = screen;
  return s;
}

/** Info for the control bar's caption ("the target is gnome 4 at the fish pond"). */
export function demoCaption(s: DemoState): string {
  const id = targetGnomeId(s);
  if (!id) return '';
  const g = gnomeById(id);
  return `המטרה: גמד ${g.number} — ${spotById(g.spotId).name}`;
}

// =================================================================
// Venue branding samples (/play/the-code?brand=1 bright, ?brand=2 dark)
// Drawn SVG data URIs — no external URLs, no files in /public.
// =================================================================

const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** A bright midday pool — the hardest case for white text. */
const BRIGHT_PHOTO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7EC8FF"/><stop offset="1" stop-color="#E6F6FF"/></linearGradient>
<linearGradient id="pool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FD6F0"/><stop offset="1" stop-color="#14A3D6"/></linearGradient></defs>
<rect width="390" height="844" fill="url(#sky)"/><circle cx="310" cy="110" r="46" fill="#FFF6B0"/>
<rect x="0" y="300" width="390" height="190" fill="#F4E9D8"/>
<g fill="#FFFFFF" stroke="#D9CBB4" stroke-width="2">${Array.from({ length: 6 }, (_, i) => `<rect x="${20 + i * 62}" y="${320 + (i % 2) * 6}" width="46" height="54" rx="4"/>`).join('')}</g>
<rect x="0" y="490" width="390" height="354" fill="url(#pool)"/>
<g stroke="#FFFFFF" stroke-opacity=".55" stroke-width="3" fill="none">${Array.from({ length: 8 }, (_, i) => `<path d="M0 ${540 + i * 38} q 48 -14 97 0 t 97 0 t 97 0 t 99 0"/>`).join('')}</g>
<g fill="#2E7D32"><path d="M40 300 q 10 -110 4 -150 q 30 30 20 150z"/><path d="M350 300 q -6 -120 2 -170 q -34 40 -22 170z"/></g>
</svg>`);

/** A dark evening lobby with warm lamps. */
const DARK_PHOTO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
<defs><radialGradient id="lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFC56B" stop-opacity=".9"/><stop offset="1" stop-color="#FFC56B" stop-opacity="0"/></radialGradient></defs>
<rect width="390" height="844" fill="#1A120C"/><rect y="560" width="390" height="284" fill="#2B1C12"/>
<g fill="#3A2718">${Array.from({ length: 4 }, (_, i) => `<rect x="${20 + i * 95}" y="140" width="70" height="300" rx="35"/>`).join('')}</g>
<circle cx="90" cy="230" r="120" fill="url(#lamp)"/><circle cx="300" cy="300" r="110" fill="url(#lamp)"/>
<rect x="110" y="600" width="170" height="60" rx="18" fill="#5A3A22"/><rect x="120" y="580" width="150" height="34" rx="14" fill="#6E4A2C"/>
</svg>`);

const DEMO_LOGO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 96">
<g fill="none" stroke="#1F3A5F" stroke-width="5" stroke-linecap="round"><path d="M20 70 q 30 -30 60 0 t 60 0 t 60 0"/></g>
<circle cx="110" cy="30" r="16" fill="#F2A23A"/>
<text x="110" y="92" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#1F3A5F" letter-spacing="3">CLIFF BEACH</text>
</svg>`);

export const DEMO_BRANDINGS = {
  '1': { backgroundUrl: BRIGHT_PHOTO, logoUrl: DEMO_LOGO, welcomeText: 'ברוכים הבאים למלון חוף הצוק!\nהגמדים שלנו מחכים לכם בכל פינה.' },
  '2': { backgroundUrl: DARK_PHOTO, logoUrl: DEMO_LOGO },
} as const;
