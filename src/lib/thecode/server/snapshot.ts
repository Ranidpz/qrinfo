/**
 * הקוד — what a family is allowed to see. Pure.
 *
 * `buildSnapshot` is the ONLY way player-facing state leaves the server. It never
 * includes: an answer word, a riddle's letter, the phrase text before the suitcase
 * is open, the riddle of a slot whose gnome was not scanned as the target, or the
 * colours of gnomes the family has not found (the album shows found gnomes + a
 * count; the current target's gnome is shown because the family must find it).
 * Covered by scripts/tests/thecode-server.test.mjs (secrets never serialize).
 */

import type { TheCodeConfig, TheCodeGnome, TheCodePlayer, TheCodeRiddle, TheCodeRun } from '@/types/thecode';
import type {
  TheCodeArrangeView,
  TheCodeGnomeView,
  TheCodePlayerView,
  TheCodeRunView,
  TheCodeSnapshot,
  TheCodeTargetView,
} from '@/types/thecode-api';
import {
  arrangePool,
  hasFreshSuitcase,
  isAdventureOpen,
  resolveRules,
  runPhraseText,
  visibleLocationHints,
} from '../engine';
import { phraseLetters, phraseWordLengths } from '../letters';
import { resolveHowToPlay } from '../howToPlay';
import { resolveSelfie } from '../selfie';
import { visiblePhotoUrl } from './lobby';

export interface TheCodeAdventureData {
  config: TheCodeConfig;
  riddles: TheCodeRiddle[];
}

export function gnomeView(g: Pick<TheCodeGnome, 'id' | 'number' | 'bodyColor' | 'hatColor'>): TheCodeGnomeView {
  return { id: g.id, number: g.number, bodyColor: g.bodyColor, hatColor: g.hatColor };
}

function playerView(p: TheCodePlayer, hotStreakAt: number, photoUrl: string | undefined): TheCodePlayerView {
  return {
    id: p.id,
    familyName: p.familyName,
    emoji: p.emoji,
    ...(photoUrl ? { photoUrl } : {}),
    recoveryCode: p.recoveryCode,
    points: p.points,
    streak: p.streak,
    hot: p.streak >= hotStreakAt,
    suitcasesOpened: p.suitcasesOpened,
  };
}

function nextCost(used: number, total: number, cost: number, points: number): number | null {
  if (used >= total) return null;
  return used === 0 ? 0 : Math.min(points, cost);
}

function targetView(p: TheCodePlayer, run: TheCodeRun, adv: TheCodeAdventureData, now: number): TheCodeTargetView | null {
  if (run.targetSlotIndex === null) return null;
  const slot = run.slots[run.targetSlotIndex];
  if (!slot) return null;
  const { config, riddles } = adv;
  const rules = resolveRules(config.rules);
  const gnome = config.gnomes.find((g) => g.id === slot.gnomeId);
  if (!gnome) return null;
  const spot = config.spots.find((s) => s.id === gnome.spotId);
  const allLocation = (spot?.hints || []).filter(Boolean);
  const freeScans = Math.max(0, Math.floor(rules.freeWrongScans));

  let riddle: TheCodeTargetView['riddle'] = null;
  const rd = slot.scannedAt !== undefined ? riddles.find((r) => r.id === slot.riddleId) : undefined;
  if (rd) {
    const allHints = (rd.hints || []).filter(Boolean);
    const cooldownMs = rules.answerCooldownSeconds * 1000;
    const until = slot.lastWrongAnswerAt !== undefined ? slot.lastWrongAnswerAt + cooldownMs : 0;
    const cooling = slot.wrongAnswers > rules.freeWrongAnswers && now < until;
    riddle = {
      text: rd.text,
      hints: allHints.slice(0, slot.riddleHintsUsed),
      nextHintCost: nextCost(slot.riddleHintsUsed, allHints.length, rules.hintCost, p.points),
      wrongAnswers: slot.wrongAnswers,
      freeWrongAnswers: rules.freeWrongAnswers,
      cooldownUntil: cooling ? until : null,
    };
    if (rd.imageUrl) riddle.imageUrl = rd.imageUrl;
  }

  return {
    slotIndex: slot.index,
    gnome: gnomeView(gnome),
    locationHints: visibleLocationHints(p, config),
    nextLocationHintCost: nextCost(slot.locationHintsUsed, allLocation.length, rules.hintCost, p.points),
    freeWrongScansLeft: Math.max(0, freeScans - (run.wrongGnomeIdsOnTarget || []).length),
    riddle,
  };
}

function arrangeView(p: TheCodePlayer, run: TheCodeRun, config: TheCodeConfig): TheCodeArrangeView {
  // The phrase text is read here but only SHAPES leave: word lengths + paid-help letters.
  const phrase = runPhraseText(run, config);
  const letters = phraseLetters(phrase);
  const helped = new Set(run.helpedPositions || []);
  const rules = resolveRules(config.rules);
  const lengths = phraseWordLengths(phrase);
  return {
    pool: arrangePool(run),
    wordLengths: lengths.length ? lengths : [letters.length],
    fixed: letters.map((l, i) => (helped.has(i) ? l : null)),
    helpCost: Math.min(p.points, rules.arrangeHelpCost),
  };
}

function runView(p: TheCodePlayer, adv: TheCodeAdventureData, now: number): TheCodeRunView | null {
  const run = p.run;
  if (!run) return null;
  const rules = resolveRules(adv.config.rules);
  const collected = run.slots
    .filter((s) => s.status === 'solved' || s.status === 'gifted')
    .sort((a, b) => (a.solvedAt ?? 0) - (b.solvedAt ?? 0) || a.index - b.index)
    .map((s) => ({ letter: s.letter, gifted: s.status === 'gifted' }));
  return {
    state: run.state,
    totalLetters: run.slots.length,
    collected,
    target: run.state === 'collecting' ? targetView(p, run, adv, now) : null,
    arrange: run.state === 'arranging' ? arrangeView(p, run, adv.config) : null,
    suitcase: run.state === 'opened'
      ? { phraseText: runPhraseText(run, adv.config), bonus: rules.suitcaseBonus, suitcaseNumber: p.suitcasesOpened }
      : null,
  };
}

/**
 * @param player the (already repaired) player, or null for a visitor without a profile.
 */
export function buildSnapshot(
  adv: TheCodeAdventureData,
  player: TheCodePlayer | null,
  now: number,
  timeZone?: string
): TheCodeSnapshot {
  const { config } = adv;
  const rules = resolveRules(config.rules);
  const gnomesById = new Map(config.gnomes.map((g) => [g.id, g] as const));
  const found = (player?.foundGnomeIds || [])
    .map((id) => gnomesById.get(id))
    .filter((g): g is TheCodeGnome => !!g)
    .map(gnomeView);
  const empty = { openedPhraseIds: [], solvedRiddleIds: [], foundGnomeIds: [], run: null };
  return {
    adventure: {
      title: config.title,
      language: config.language,
      open: isAdventureOpen(config, now, timeZone),
      hotMultiplier: rules.hotMultiplier,
      ...(config.branding ? { branding: config.branding } : {}),
      howToPlay: resolveHowToPlay(config, rules),
      selfie: resolveSelfie(config),
      howToPlayTheme: config.howToPlayTheme ?? 'night',
    },
    player: player ? playerView(player, rules.hotStreakAt, visiblePhotoUrl(player, resolveSelfie(config), now)) : null,
    run: player ? runView(player, adv, now) : null,
    album: { found, total: config.gnomes.filter((g) => g.isActive).length },
    canStartNew: hasFreshSuitcase(player || empty, adv),
  };
}
