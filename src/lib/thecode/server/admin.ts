/**
 * הקוד — operator save normalization. Pure.
 *
 * `normalizeAdventure` turns whatever the admin UI sent into a clean adventure:
 * unknown fields dropped, strings trimmed and capped, enums checked, rules clamped,
 * riddle `letter` re-derived from `answerWord`, ids kept. Gnome codes are NEVER taken
 * from the client: existing gnomes (by id) keep the stored `code` / `manualCode`, new
 * gnomes come back with empty codes + their ids in `newGnomeIds` — the store draws
 * crypto codes for them and creates the index docs.
 */

import type {
  TheCodeColor,
  TheCodeConfig,
  TheCodeGnome,
  TheCodePhrase,
  TheCodeBranding,
  TheCodePublicConfig,
  TheCodeRiddle,
  TheCodeRules,
  TheCodeSpot,
  TheCodeTrigger,
} from '@/types/thecode';
import { DEFAULT_THECODE_RULES, resolveRules } from '../engine';
import { letterOfAnswer } from '../letters';
import { HOW_TO_PLAY_LIMITS } from '../howToPlay';
import { resolveSelfie } from '../selfie';
import { normalizeLobby } from './lobby';

export const THECODE_LIMITS = {
  spots: 60,
  gnomes: 200,
  phrases: 40,
  riddles: 1500,
  title: 80,
  spotName: 80,
  hint: 200,
  hints: 3,
  safetyNote: 300,
  riddleText: 500,
  answerWord: 40,
  phraseText: 60,
  url: 1000,
  videosPerTrigger: 5,
  welcomeText: 140,
} as const;

/** Every colour a stored gnome may have (the choosable subset: THECODE_PALETTE in the engine). */
export const THECODE_COLORS: TheCodeColor[] = [
  'red', 'blue', 'green', 'yellow', 'black', 'white', 'purple', 'orange', 'grey', 'brown',
];
const TRIGGERS: TheCodeTrigger[] = [
  'WELCOME', 'START', 'NEW_CLUE', 'CORRECT', 'WRONG_ANSWER', 'HINT', 'WRONG_GNOME', 'HALFWAY',
  'CODE_READY', 'SUITCASE_OPEN', 'RETURN_PLAYER', 'ALL_DONE',
];
const DEFAULT_RETENTION_DAYS = 90;

/** A brand-new adventure (what GET returns with `version: 0`). */
export function defaultTheCodeConfig(title = 'קוד הגמדים'): TheCodeConfig {
  return {
    status: 'draft',
    title,
    language: 'he',
    spots: [],
    gnomes: [],
    phrases: [],
    rules: { ...DEFAULT_THECODE_RULES },
    requirePhoneVerification: false,
    retentionDays: DEFAULT_RETENTION_DAYS,
  };
}

/** The world-readable stub kept on the code doc's media item. */
export function toPublicConfig(
  config: Pick<TheCodeConfig, 'title' | 'status' | 'language' | 'branding'>
): TheCodePublicConfig {
  const out: TheCodePublicConfig = { title: config.title, status: config.status, language: config.language };
  if (config.branding) out.branding = config.branding;
  return out;
}

// ----------------------------------------------------------------- primitives

const CONTROL = new RegExp('[\\p{Cc}\\p{Cf}]', 'gu');

function text(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  // Keep newlines inside riddle texts; drop other control/format characters.
  return v.replace(/\r\n?/g, '\n').replace(CONTROL, (c) => (c === '\n' ? c : '')).trim().slice(0, max);
}

function line(v: unknown, max: number): string {
  return text(v, max * 2).replace(/\s+/g, ' ').trim().slice(0, max);
}

function url(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (s.length > THECODE_LIMITS.url || !/^https:\/\/[^\s"'<>]+$/i.test(s)) return undefined;
  return s;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
}

function hintList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((h) => line(h, THECODE_LIMITS.hint)).filter(Boolean).slice(0, THECODE_LIMITS.hints);
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return list.includes(v as T) ? (v as T) : fallback;
}

/** Operator rules → clamped, whole-number values (the multiplier may have one decimal). */
export function normalizeRules(v: unknown): TheCodeRules {
  const r = resolveRules(isObj(v) ? (v as Partial<TheCodeRules>) : null);
  const big = 100_000;
  return {
    pointsPerLetter: int(r.pointsPerLetter, 0, big, DEFAULT_THECODE_RULES.pointsPerLetter),
    suitcaseBonus: int(r.suitcaseBonus, 0, big, DEFAULT_THECODE_RULES.suitcaseBonus),
    hotStreakAt: int(r.hotStreakAt, 1, 20, DEFAULT_THECODE_RULES.hotStreakAt),
    hotMultiplier: Math.min(10, Math.max(1, Math.round(r.hotMultiplier * 10) / 10)),
    hintCost: int(r.hintCost, 0, big, DEFAULT_THECODE_RULES.hintCost),
    freeWrongScans: int(r.freeWrongScans, 1, 3, DEFAULT_THECODE_RULES.freeWrongScans),
    wrongScanPenalty: int(r.wrongScanPenalty, 0, big, DEFAULT_THECODE_RULES.wrongScanPenalty),
    freeWrongAnswers: int(r.freeWrongAnswers, 0, 10, DEFAULT_THECODE_RULES.freeWrongAnswers),
    wrongAnswerPenalty: int(r.wrongAnswerPenalty, 0, big, DEFAULT_THECODE_RULES.wrongAnswerPenalty),
    answerCooldownSeconds: int(r.answerCooldownSeconds, 0, 600, DEFAULT_THECODE_RULES.answerCooldownSeconds),
    arrangeHelpCost: int(r.arrangeHelpCost, 0, big, DEFAULT_THECODE_RULES.arrangeHelpCost),
  };
}

function hm(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

// ----------------------------------------------------------------- normalize

export type TheCodeNormalizeResult =
  | { ok: true; config: TheCodeConfig; riddles: TheCodeRiddle[]; newGnomeIds: string[]; droppedRiddles: number }
  | { ok: false; reason: string };

class Bad extends Error {}

function ids<T extends { id: string }>(list: T[], what: string): void {
  const seen = new Set<string>();
  for (const x of list) {
    if (!ID.test(x.id)) throw new Bad(`${what}: bad id`);
    if (seen.has(x.id)) throw new Bad(`${what}: duplicate id ${x.id}`);
    seen.add(x.id);
  }
}

function arr(v: unknown, max: number, what: string): unknown[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Bad(`${what}: not a list`);
  if (v.length > max) throw new Bad(`${what}: more than ${max}`);
  return v;
}

/**
 * @param stored the adventure as saved now (null = never saved) — the source of
 *   truth for existing gnomes' `code` / `manualCode`.
 */
export function normalizeAdventure(
  configIn: unknown,
  riddlesIn: unknown,
  stored: Pick<TheCodeConfig, 'gnomes'> | null,
  /** `videoBase` = our R2 public URL; big-screen videos must live there (absent = none accepted). */
  opts: { videoBase?: string | null } = {}
): TheCodeNormalizeResult {
  try {
    if (!isObj(configIn)) throw new Bad('config missing');
    const c = configIn;
    const storedGnomes = new Map((stored?.gnomes || []).map((g) => [g.id, g] as const));

    const spots: TheCodeSpot[] = arr(c.spots, THECODE_LIMITS.spots, 'spots').map((v) => {
      if (!isObj(v)) throw new Bad('spot');
      const s: TheCodeSpot = {
        id: String(v.id ?? ''),
        name: line(v.name, THECODE_LIMITS.spotName),
        hints: hintList(v.hints),
        isActive: bool(v.isActive, true),
      };
      const photo = url(v.photoUrl);
      if (photo) s.photoUrl = photo;
      const note = line(v.safetyNote, THECODE_LIMITS.safetyNote);
      if (note) s.safetyNote = note;
      if (v.outdoor === true) s.outdoor = true;
      return s;
    });
    ids(spots, 'spots');

    const newGnomeIds: string[] = [];
    const gnomes: TheCodeGnome[] = arr(c.gnomes, THECODE_LIMITS.gnomes, 'gnomes').map((v, i) => {
      if (!isObj(v)) throw new Bad('gnome');
      const id = String(v.id ?? '');
      const body = v.bodyColor as TheCodeColor;
      const hat = v.hatColor as TheCodeColor;
      if (!THECODE_COLORS.includes(body) || !THECODE_COLORS.includes(hat)) throw new Bad(`gnome ${id}: colour`);
      const old = storedGnomes.get(id);
      if (!old) newGnomeIds.push(id);
      const g: TheCodeGnome = {
        id,
        number: int(v.number, 1, 9999, i + 1),
        code: old?.code || '',
        manualCode: old?.manualCode || '',
        spotId: typeof v.spotId === 'string' ? v.spotId.slice(0, 64) : '',
        bodyColor: body,
        hatColor: hat,
        isActive: bool(v.isActive, true),
      };
      if (typeof v.verifiedOnSite === 'boolean') g.verifiedOnSite = v.verifiedOnSite;
      return g;
    });
    ids(gnomes, 'gnomes');

    const phrases: TheCodePhrase[] = arr(c.phrases, THECODE_LIMITS.phrases, 'phrases').map((v) => {
      if (!isObj(v)) throw new Bad('phrase');
      return { id: String(v.id ?? ''), text: line(v.text, THECODE_LIMITS.phraseText), isActive: bool(v.isActive, true) };
    });
    ids(phrases, 'phrases');

    const gnomeIds = new Set(gnomes.map((g) => g.id));
    let droppedRiddles = 0;
    const riddles: TheCodeRiddle[] = [];
    for (const v of arr(riddlesIn, THECODE_LIMITS.riddles, 'riddles')) {
      if (!isObj(v)) throw new Bad('riddle');
      const gnomeId = String(v.gnomeId ?? '');
      // A riddle of a deleted gnome has nowhere to be asked → dropped.
      if (!gnomeIds.has(gnomeId)) {
        droppedRiddles++;
        continue;
      }
      const answerWord = line(v.answerWord, THECODE_LIMITS.answerWord);
      const r: TheCodeRiddle = {
        id: String(v.id ?? ''),
        gnomeId,
        type: oneOf(v.type, ['observe', 'physicalLetter', 'find'] as const, 'observe'),
        text: text(v.text, THECODE_LIMITS.riddleText),
        answerWord,
        letter: letterOfAnswer(answerWord),
        acceptSoundAlike: bool(v.acceptSoundAlike, true),
        hints: hintList(v.hints),
        difficulty: oneOf(v.difficulty as never, [1, 2, 3] as never[], 1 as never),
        status: oneOf(v.status, ['draft', 'published', 'disabled'] as const, 'draft'),
      };
      const img = url(v.imageUrl);
      if (img) r.imageUrl = img;
      riddles.push(r);
    }
    ids(riddles, 'riddles');

    const config: TheCodeConfig = {
      status: oneOf(c.status, ['draft', 'published', 'paused'] as const, 'draft'),
      title: line(c.title, THECODE_LIMITS.title) || 'קוד הגמדים',
      language: oneOf(c.language, ['he', 'en'] as const, 'he'),
      spots,
      gnomes,
      phrases,
      rules: normalizeRules(c.rules),
      requirePhoneVerification: bool(c.requirePhoneVerification, false),
      retentionDays: int(c.retentionDays, 1, 365, DEFAULT_RETENTION_DAYS),
    };
    if (isObj(c.activeHours)) {
      const from = hm(c.activeHours.from);
      const to = hm(c.activeHours.to);
      if (from && to) config.activeHours = { from, to };
    }
    if (isObj(c.presenterVideos)) {
      const pv: Partial<Record<TheCodeTrigger, string[]>> = {};
      for (const t of TRIGGERS) {
        const list = c.presenterVideos[t];
        if (!Array.isArray(list)) continue;
        const urls = list.map(url).filter((u): u is string => !!u).slice(0, THECODE_LIMITS.videosPerTrigger);
        if (urls.length) pv[t] = urls;
      }
      if (Object.keys(pv).length) config.presenterVideos = pv;
    }
    if (Array.isArray(c.howToPlay)) {
      const lines = c.howToPlay
        .map((v) => line(v, HOW_TO_PLAY_LIMITS.line))
        .filter(Boolean)
        .slice(0, HOW_TO_PLAY_LIMITS.lines);
      if (lines.length) config.howToPlay = lines;
    }
    if (isObj(c.branding)) {
      const branding: TheCodeBranding = {};
      const background = url(c.branding.backgroundUrl);
      if (background) branding.backgroundUrl = background;
      const logo = url(c.branding.logoUrl);
      if (logo) branding.logoUrl = logo;
      const welcome = line(c.branding.welcomeText, THECODE_LIMITS.welcomeText);
      if (welcome) branding.welcomeText = welcome;
      if (Object.keys(branding).length) config.branding = branding;
    }
    // Selfies are always stored resolved (on/off + 1–90 days), so every reader agrees.
    config.selfie = resolveSelfie({ selfie: isObj(c.selfie) ? (c.selfie as unknown as TheCodeConfig['selfie']) : undefined });
    const lobby = normalizeLobby(c.lobby, opts.videoBase);
    if (lobby) config.lobby = lobby;
    return { ok: true, config, riddles, newGnomeIds, droppedRiddles };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, reason: e.message };
    throw e;
  }
}

/** Gnome ids whose index docs must go: stored gnomes missing from the new config. */
export function removedGnomes(stored: Pick<TheCodeConfig, 'gnomes'> | null, next: Pick<TheCodeConfig, 'gnomes'>): TheCodeGnome[] {
  const keep = new Set(next.gnomes.map((g) => g.id));
  return (stored?.gnomes || []).filter((g) => !keep.has(g.id));
}
