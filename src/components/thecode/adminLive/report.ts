// הקוד admin — builds the `AdventureReport` the screens render, from the REAL engine.
//
// The engine (src/lib/thecode/engine.ts, read-only here) decides WHICH issues exist and how
// many fresh suitcases a family gets — the same functions the server runs before it allows a
// publish, so the screen and the server can never disagree. This file only adds what the engine
// does not expose (see the bottom of each function):
//  - the per-letter board of a phrase (`ok` per position) and the "dormant" riddles behind a
//    missing letter (draft / disabled / gnome off / spot off) → the fastest fix;
//  - letter stock (demand vs supply per letter);
//  - operator wording: the screens say "משפט" (approved demo copy), the engine says "ביטוי",
//    so every issue message is re-worded here from the issue's own fields;
//  - free mode (`config.mode === 'free'`): the guided-only checks are dropped (FREE_IGNORED_ISSUES),
//    the free engine's checks added, and the shared ones worded for the free game.
// Pure — safe in the browser, used by both the demo and the live admin.

import type { TheCodeConfig, TheCodeGnome, TheCodeIssue, TheCodeRiddle } from '@/types/thecode';
import { analyzeAdventure, MIN_PHRASE_LETTERS, riddleLetter } from '@/lib/thecode/engine';
import { FREE_IGNORED_ISSUES, freeAdventureIssues, freeRiddlesOf, resolveFreeRules } from '@/lib/thecode/engineFree';
import { invalidPhraseChars, phraseLetters, phraseWordLengths, soundAlikes } from '@/lib/thecode/letters';
import { describeGnome } from '@/components/thecode/GnomeFigure';
import type { AdminState, AdventureReport, CoverageLetter, FreeReadiness, MissingLetter, PhraseCoverage } from '@/components/thecode/admin/model';
import { comboKey, confusableColors, durationLabel, letterLabel } from '@/components/thecode/admin/helpers';

interface Usable {
  /** letter → usable gnome ids (active gnome on an active spot with a published riddle for it). */
  byLetter: Map<string, string[]>;
  /** letter → number of usable riddles. */
  supply: Map<string, number>;
}

// Same usability rule as the engine (published + has a letter + gnome and spot active).
function usableSources(config: TheCodeConfig, riddles: TheCodeRiddle[]): Usable {
  const spots = new Map(config.spots.map((s) => [s.id, s]));
  const gnomes = new Map(config.gnomes.map((g) => [g.id, g]));
  const byLetter = new Map<string, string[]>();
  const supply = new Map<string, number>();
  for (const r of riddles) {
    const letter = riddleLetter(r);
    if (r.status !== 'published' || !letter) continue;
    const g = gnomes.get(r.gnomeId);
    if (!g || !g.isActive || !spots.get(g.spotId)?.isActive) continue;
    supply.set(letter, (supply.get(letter) || 0) + 1);
    const list = byLetter.get(letter) || [];
    if (!list.includes(g.id)) list.push(g.id);
    byLetter.set(letter, list);
  }
  return { byLetter, supply };
}

/** Max bipartite matching (Kuhn): phrase positions ↔ DISTINCT gnomes. Only drives the letter board. */
function matchSlots(letters: string[], candidates: (letter: string) => string[]): (string | null)[] {
  const slotOf = new Map<string, number>();
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

export function phraseCoverage(
  text: string,
  config: TheCodeConfig,
  riddles: TheCodeRiddle[],
  usable: Usable = usableSources(config, riddles)
): PhraseCoverage {
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
      if (riddleLetter(r) !== letter) continue;
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

  const tooShort = letters.length < MIN_PHRASE_LETTERS;
  return {
    letters: board,
    wordLengths,
    invalidChars,
    tooShort,
    missing,
    playable: !tooShort && invalidChars.length === 0 && missing.length === 0,
    hasFinalForms: /[ךםןףץ]/.test(text),
  };
}

// ------------------------------------------------------------------
// Operator wording
// ------------------------------------------------------------------

function missingLetterMessage(m: MissingLetter): string {
  const L = letterLabel(m.letter);
  const draft = m.dormant.find((d) => d.why === 'draft');
  const off = m.dormant.find((d) => d.why === 'gnomeOff' || d.why === 'spotOff');
  const disabled = m.dormant.find((d) => d.why === 'disabled');
  if (draft) return `חסרה חידה לאות ${L} — לגמד ${draft.gnomeNumber} יש חידה כזו שעוד לא במשחק. הוסיפו אותה למשחק.`;
  if (off) {
    return `חסרה חידה לאות ${L} — היא נמצאת אצל גמד ${off.gnomeNumber}, ש${off.why === 'gnomeOff' ? 'כבוי' : 'המקום שלו כבוי'}. הפעילו אותו או הוסיפו חידה לאות ${L} בגמד אחר.`;
  }
  if (disabled) return `חסרה חידה לאות ${L} — החידה של גמד ${disabled.gnomeNumber} מושבתת. הפעילו אותה או הוסיפו חידה חדשה.`;
  if (m.shared) return `לאות ${L} אין גמד פנוי — הגמדים שנותנים אותה כבר נותנים אות אחרת במשפט. הוסיפו חידה לאות ${L} בגמד נוסף.`;
  if (m.need > 1 && m.have > 0) {
    return `האות ${L} מופיעה ${m.need} פעמים, ויש רק ${m.have === 1 ? 'גמד אחד' : `${m.have} גמדים`} שנותנים אותה. הוסיפו חידה לאות ${L} בגמד נוסף.`;
  }
  return `חסרה חידה לאות ${L} — הוסיפו חידה שהתשובה שלה מתחילה ב־${m.letter}.`;
}

function reword(issue: TheCodeIssue, state: AdminState, phrases: Record<string, PhraseCoverage>): TheCodeIssue {
  const { config, riddles } = state;
  const phrase = config.phrases.find((p) => p.id === issue.phraseId);
  const gnome = config.gnomes.find((g) => g.id === issue.gnomeId);
  const spot = config.spots.find((s) => s.id === issue.spotId);
  const riddle = riddles.find((r) => r.id === issue.riddleId);
  const cov = issue.phraseId ? phrases[issue.phraseId] : undefined;
  const out = { ...issue };

  switch (issue.code) {
    case 'PHRASE_INVALID_CHARS':
      out.message = `במשפט "${phrase?.text}" יש תווים שאי אפשר לאסוף: ${(cov?.invalidChars || []).join(' ')}. השאירו רק אותיות ורווחים.`;
      break;
    case 'PHRASE_TOO_SHORT':
      out.message = `המשפט "${phrase?.text}" קצר מדי — צריך לפחות ${MIN_PHRASE_LETTERS} אותיות.`;
      break;
    case 'NO_ACTIVE_PHRASE':
      out.message = 'אין משפט פעיל. הוסיפו משפט סודי אחד לפחות.';
      break;
    case 'PHRASE_LETTER_MISSING': {
      const m = cov?.missing.find((x) => x.letter === issue.letter);
      if (m) {
        out.message = `"${phrase?.text}": ${missingLetterMessage(m)}`;
        // The fix link goes straight to the dormant draft when there is one.
        const draft = m.dormant.find((d) => d.why === 'draft') || m.dormant[0];
        if (draft && !out.riddleId) {
          out.riddleId = draft.riddleId;
          out.gnomeId = draft.gnomeId;
        }
        if (!out.dormantRiddleIds) out.dormantRiddleIds = m.dormant.map((d) => d.riddleId);
      } else {
        out.message = `"${phrase?.text}": חסרה חידה לאות ${letterLabel(issue.letter || '')}.`;
      }
      break;
    }
    case 'GNOME_SPOT_MISSING':
      out.message = `גמד ${gnome?.number} לא משויך למקום. בחרו לו מקום.`;
      break;
    case 'GNOME_WITHOUT_RIDDLE':
      out.message = `לגמד ${gnome?.number} אין חידה במשחק, ולכן אף קבוצה לא תגיע אליו.`;
      break;
    case 'GNOME_NOT_VERIFIED':
      out.message = `גמד ${gnome?.number} עוד לא נסרק במקום.`;
      break;
    case 'DUPLICATE_COLORS_AT_SPOT':
    case 'CONFUSABLE_COLORS_AT_SPOT': {
      if (!gnome || !spot) break;
      const dup = issue.code === 'DUPLICATE_COLORS_AT_SPOT';
      const twin: TheCodeGnome | undefined = config.gnomes.find(
        (g) => g.spotId === spot.id && g.id !== gnome.id && (dup ? comboKey(g) === comboKey(gnome) : confusableColors(g, gnome))
      );
      const pair = twin ? `${Math.min(twin.number, gnome.number)} ו־${Math.max(twin.number, gnome.number)}` : `${gnome.number}`;
      out.message = dup
        ? `ב"${spot.name}" גמדים ${pair} נראים אותו דבר (${describeGnome(gnome.bodyColor, gnome.hatColor)}). שנו צבעים או העבירו אחד מהם.`
        : `ב"${spot.name}" גמדים ${pair} נבדלים רק באדום וירוק — ילדים עיוורי צבעים יתבלבלו.`;
      break;
    }
    case 'SPOT_WITHOUT_HINT':
      out.message = `למקום "${spot?.name}" אין רמז. בלי רמז הקבוצות רואות רק את שם המקום — הוסיפו רמז אחד לפחות, מהכללי אל המדויק.`;
      break;
    case 'RIDDLE_AMBIGUOUS_LETTER':
      if (riddle && issue.letter) {
        const no = config.gnomes.find((g) => g.id === riddle.gnomeId)?.number;
        out.message = `התשובה "${riddle.answerWord}" (גמד ${no}) מתחילה ב־${letterLabel(issue.letter)}, וילדים עלולים ללחוץ ${soundAlikes(issue.letter).map(letterLabel).join(' או ')}. קבלו אות דומה בצליל או בחרו חפץ אחר.`;
      }
      break;
    case 'GNOMES_CLUSTERED':
      out.message = spot
        ? `כמעט כל הגמדים עומדים ב"${spot.name}". פזרו אותם בכמה מקומות, כדי שקבוצות יסתובבו בכל המתחם.`
        : 'כמעט כל הגמדים עומדים באותו מקום. פזרו אותם בכמה מקומות, כדי שקבוצות יסתובבו בכל המתחם.';
      break;
    case 'FEW_FRESH_ROUNDS':
      // Reworded in buildAdventureReport (needs the letter stock).
      break;
    default:
      break;
  }
  return out;
}

/** Free mode: what the overview shows instead of suitcases and phrases. */
export function freeReadiness(config: TheCodeConfig, riddles: TheCodeRiddle[]): FreeReadiness {
  const spots = new Map(config.spots.map((s) => [s.id, s]));
  const on = config.gnomes.filter((g) => g.isActive && spots.get(g.spotId)?.isActive);
  const counts = on.map((g) => freeRiddlesOf(g.id, riddles).length);
  const ready = counts.filter((n) => n > 0);
  const rules = resolveFreeRules(config.free);
  const minRiddles = counts.length ? Math.min(...counts) : 0;
  const poorest = ready.length ? Math.min(...ready) : 0;
  return {
    gnomesOn: on.length,
    gnomesReady: ready.length,
    minRiddles,
    riddlesInGame: counts.reduce((a, b) => a + b, 0),
    refreshMinutes: rules.refreshMinutes,
    wrapRiddles: rules.wrapRiddles,
    repeatAfterMinutes: poorest ? poorest * rules.refreshMinutes : null,
  };
}

/** Free mode wording of the issues whose meaning changes without a phrase and a suitcase. */
function rewordFree(issue: TheCodeIssue, state: AdminState): TheCodeIssue {
  const { config } = state;
  const gnome = config.gnomes.find((g) => g.id === issue.gnomeId);
  const spot = config.spots.find((s) => s.id === issue.spotId);
  const rules = resolveFreeRules(config.free);
  switch (issue.code) {
    case 'GNOME_WITHOUT_RIDDLE':
      return {
        ...issue,
        message: gnome
          ? `לגמד ${gnome.number} אין חידה, ולכן קבוצות יראו אותו כגמד שסיים. הוסיפו לו חידות.`
          : 'אף גמד עוד לא שואל חידה. הוסיפו חידות לגמדים כדי לפרסם.',
      };
    case 'FEW_FRESH_ROUNDS': {
      const have = issue.have ?? 0;
      return {
        ...issue,
        message: `לגמד ${gnome?.number} יש רק ${have === 1 ? 'חידה אחת' : `${have} חידות`}. קבוצה שתחזור אליו תקבל שוב חידה שכבר ענתה עליה אחרי ${durationLabel(have * rules.refreshMinutes)}.`,
      };
    }
    case 'SPOT_WITHOUT_HINT':
      return {
        ...issue,
        message: `למקום "${spot?.name}" אין רמז מיקום, וגם לגמדים שבו אין. קבוצה שלא מוצאת אותם לא תוכל לקנות רמז. הוסיפו רמז למקום או לגמד.`,
      };
    default:
      return reword(issue, state, {});
  }
}

/** Free mode: a spot without hints is fine when every gnome there carries its own. */
function freeSpotCovered(config: TheCodeConfig, spotId: string | undefined): boolean {
  const there = config.gnomes.filter((g) => g.spotId === spotId && g.isActive);
  return there.length > 0 && there.every((g) => (g.hints || []).some((h) => h.trim()));
}

/** The report every screen renders. Issues + fresh suitcases come from the engine. */
export function buildAdventureReport(state: AdminState): AdventureReport {
  const { config, riddles } = state;
  const engine = analyzeAdventure(config, riddles);
  const usable = usableSources(config, riddles);

  const phrases: Record<string, PhraseCoverage> = {};
  for (const p of config.phrases) phrases[p.id] = phraseCoverage(p.text, config, riddles, usable);

  // Letter stock over the phrases a family can actually play (engine's verdict).
  const playableIds = new Set(engine.phrases.filter((r) => r.isActive && r.playable).map((r) => r.phraseId));
  const demand = new Map<string, number>();
  for (const p of config.phrases) {
    if (!playableIds.has(p.id)) continue;
    for (const l of phraseLetters(p.text)) demand.set(l, (demand.get(l) || 0) + 1);
  }
  const letterStock = [...demand]
    .map(([letter, d]) => ({ letter, demand: d, supply: usable.supply.get(letter) || 0 }))
    .sort((a, b) => a.supply - a.demand - (b.supply - b.demand));

  // The board must agree with the engine: a phrase the engine calls unplayable is never "ready".
  for (const r of engine.phrases) {
    const cov = phrases[r.phraseId];
    if (cov && !r.playable) cov.playable = false;
  }

  // Free mode: no phrases, no suitcases, no colour hunt — their checks do not apply; the free
  // engine's own do, and the shared ones are worded for the free game.
  if (config.mode === 'free') {
    const freeIssues = [
      ...engine.issues.filter((i) => !FREE_IGNORED_ISSUES.has(i.code) && i.code !== 'GNOME_WITHOUT_RIDDLE' &&
        !(i.code === 'SPOT_WITHOUT_HINT' && freeSpotCovered(config, i.spotId))),
      ...freeAdventureIssues(config, riddles),
    ].map((i) => rewordFree(i, state));
    const freeErrors = freeIssues.filter((i) => i.severity === 'error').length;
    return {
      issues: freeIssues, errors: freeErrors, warnings: freeIssues.length - freeErrors,
      freshSuitcases: engine.freshSuitcases, phrases, letterStock, free: freeReadiness(config, riddles),
    };
  }
  const issues = engine.issues.map((i) => {
    if (i.code !== 'FEW_FRESH_ROUNDS') return reword(i, state, phrases);
    const n = engine.freshSuitcases;
    const short = letterStock.filter((l) => l.supply < l.demand).map((l) => letterLabel(l.letter));
    return {
      ...i,
      message: `קבוצה תוכל לפתוח רק ${n === 1 ? 'מזוודה אחת' : `${n} מזוודות`} ואז ייגמרו לה החידות.${short.length ? ` הוסיפו עוד חידות לאותיות ${short.join(', ')}.` : ' הוסיפו עוד חידות או משפטים.'}`,
    };
  });
  const errors = issues.filter((i) => i.severity === 'error').length;
  return { issues, errors, warnings: issues.length - errors, freshSuitcases: engine.freshSuitcases, phrases, letterStock };
}

