// הקוד admin — pure rules + formatting shared by the screens and the demo data.
// No sample data and no state here (that lives in src/components/thecode/demo/adminDemo.ts).

import type { TheCodeColor, TheCodeConfig, TheCodeGnome } from '@/types/thecode';
import { SITE_URL } from '@/lib/landing/site';
import type { GnomeStats, NewGnomeSpec, RiddleStats } from './model';

/** "ס׳" for Hebrew, "S" for English. */
export function letterLabel(letter: string): string {
  return /[א-ת]/.test(letter) ? `${letter}׳` : letter;
}

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

/** "לפני 3 שעות" — short, operator-facing. */
export function timeAgo(ts: number | undefined, now = Date.now()): string {
  if (!ts) return 'עוד לא';
  const d = now - ts;
  if (d < 60_000) return 'עכשיו';
  if (d < HOUR) return `לפני ${Math.round(d / 60_000)} דק׳`;
  if (d < DAY) {
    const h = Math.round(d / HOUR);
    return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`;
  }
  const days = Math.round(d / DAY);
  return days === 1 ? 'אתמול' : days === 2 ? 'לפני יומיים' : `לפני ${days} ימים`;
}

/** No scans for this long while the adventure is live → "כנראה נעלם". */
export const SILENT_AFTER_DAYS = 4;

export function isProbablyMissing(
  gnome: TheCodeGnome,
  stats: GnomeStats | undefined,
  status: TheCodeConfig['status'],
  now = Date.now()
): boolean {
  // Never installed ≠ missing: only a gnome that was verified on site and then went quiet.
  if (!gnome.isActive || !gnome.verifiedOnSite || status === 'draft') return false;
  const last = stats?.lastScanAt;
  return !last || now - last > SILENT_AFTER_DAYS * DAY;
}

/** Many wrong answers or hints per solve → rewrite the riddle. */
export function isRiddleTooHard(s: RiddleStats | undefined): boolean {
  if (!s) return false;
  const attempts = s.correct + s.wrong;
  if (attempts < 10) return false;
  return s.wrong / attempts > 0.55 || s.hints > s.correct * 1.2;
}

/**
 * Public links ALWAYS use the production origin — a plate printed from dev, a preview deploy
 * or localhost must still open the real game (plan §8).
 */
export const PUBLIC_ORIGIN = SITE_URL;
/** QR payload of a gnome plate. */
export const plateUrl = (code: string) => `${PUBLIC_ORIGIN}/g/${encodeURIComponent(code)}`;
/** Game home for families. */
export const gameUrl = (shortId: string) => `${PUBLIC_ORIGIN}/v/${encodeURIComponent(shortId)}`;
/** Big-screen leaderboard for the venue's TV. */
export const lobbyUrl = (shortId: string) => `${PUBLIC_ORIGIN}/lobby/thecode/${encodeURIComponent(shortId)}`;

export const comboKey = (g: { bodyColor: TheCodeColor; hatColor: TheCodeColor }) => `${g.bodyColor}/${g.hatColor}`;

const redGreenBlind = (c: TheCodeColor) => (c === 'red' ? 'green' : c);

/** True when two different gnomes look alike to a red/green colour-blind child. */
export function confusableColors(a: NewGnomeSpec, b: NewGnomeSpec): boolean {
  if (comboKey(a) === comboKey(b)) return false;
  return redGreenBlind(a.bodyColor) === redGreenBlind(b.bodyColor) && redGreenBlind(a.hatColor) === redGreenBlind(b.hatColor);
}

/** Preferred order for suggestions (most distinct first); only colours in `allowed` are used. */
const SUGGEST_ORDER: TheCodeColor[] = ['blue', 'yellow', 'red', 'purple', 'white', 'black', 'green', 'brown', 'grey', 'orange'];

/**
 * Colour combos for a new batch: distinct from each other and from what already stands there,
 * using only the colours the supplier can print for this spot (`allowed`). Two-tone looks come
 * first; a one-colour gnome (body = hat) is the last resort, which matters outdoors where only
 * black and grey exist (4 distinct looks at most). May return fewer than `count` — that IS the
 * limit of what can stand at that spot.
 */
export function suggestCombos(count: number, taken: NewGnomeSpec[], shuffle = false, allowed?: TheCodeColor[]): NewGnomeSpec[] {
  const colors = SUGGEST_ORDER.filter((c) => (allowed ? allowed.includes(c) : c !== 'orange'));
  if (shuffle) {
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
  }
  const out: NewGnomeSpec[] = [];
  const all = [...taken];
  // Pass 1 spreads body colours (one per body), pass 2 fills two-tone leftovers, pass 3 one-colour.
  for (const pass of ['spread', 'fill', 'solid'] as const) {
    for (const body of colors) {
      for (const hat of colors) {
        if (out.length >= count) return out;
        if ((body === hat) !== (pass === 'solid')) continue;
        const spec = { bodyColor: body, hatColor: hat };
        if (all.some((t) => comboKey(t) === comboKey(spec) || confusableColors(t, spec))) continue;
        if (pass === 'spread' && out.some((o) => o.bodyColor === body || o.hatColor === hat)) continue;
        out.push(spec);
        all.push(spec);
      }
    }
  }
  return out;
}
