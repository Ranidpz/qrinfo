/**
 * הקוד — weekly leaderboard keys. Pure.
 *
 * A week runs Sunday → Saturday in the VENUE's time zone (Israel by default) and is
 * keyed like `2026-W46`. The number is the ISO week of the Monday after the Sunday
 * that opens the week, so every day of one Sunday-week shares one key, also across
 * New Year.
 */

export const DEFAULT_WEEK_TIME_ZONE = 'Asia/Jerusalem';
/** Weekly entries kept on a player doc (older ones are dropped on the next write). */
export const WEEKS_KEPT = 8;

const DAY = 86_400_000;

function localDateUtc(now: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(now));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'));
  } catch {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
}

/** `YYYY-Www` for the Sunday-week that contains `now` in `timeZone`. */
export function weekKey(now: number, timeZone: string = DEFAULT_WEEK_TIME_ZONE): string {
  // Sunday → Monday, then ISO week (Monday-based) of that day.
  const d = new Date(localDateUtc(now, timeZone) + DAY);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow); // Thursday of the ISO week
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export interface TheCodeWeekEntry {
  points: number;
  suitcases: number;
}

export type TheCodeWeeks = Record<string, TheCodeWeekEntry>;

/**
 * Add an action's points / suitcases delta to this week's entry (never below 0)
 * and keep only the latest `WEEKS_KEPT` weeks. Returns a new map.
 */
export function addWeekDelta(
  weeks: TheCodeWeeks | undefined | null,
  key: string,
  pointsDelta: number,
  suitcasesDelta: number
): TheCodeWeeks {
  const out: TheCodeWeeks = {};
  for (const [k, v] of Object.entries(weeks || {})) {
    if (v && typeof v === 'object') out[k] = { points: Number(v.points) || 0, suitcases: Number(v.suitcases) || 0 };
  }
  const cur = out[key] || { points: 0, suitcases: 0 };
  if (pointsDelta || suitcasesDelta || out[key]) {
    out[key] = {
      points: Math.max(0, cur.points + (pointsDelta || 0)),
      suitcases: Math.max(0, cur.suitcases + (suitcasesDelta || 0)),
    };
  }
  const keys = Object.keys(out).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - WEEKS_KEPT))) delete out[k];
  return out;
}
