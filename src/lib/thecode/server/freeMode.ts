/**
 * קוד הגמדים — free mode on the server (23.11.2026). Registers itself with the store
 * (registerTheCodeMode) when imported; the play route imports it. Everything the phone sees
 * goes through `freeSnapshotPart` — never an answer word (except in the `correct` event, after
 * the group got it right) and never another riddle than the one the group scanned.
 */

import type { TheCodeConfig, TheCodePlayer, TheCodeRiddle } from '@/types/thecode';
import type { TheCodeFreeView, TheCodePlayAction, TheCodeSnapshot } from '@/types/thecode-api';
import { resolveRules, type TheCodeContext } from '../engine';
import { freeAnswer, freeBoard, freeBuyHint, freeScan, resolveFreeRules, type TheCodeFreeContext } from '../engineFree';
import { registerTheCodeMode, TheCodeStoreError, type TheCodeModeActResult } from '../store';
import { gnomeView, type TheCodeAdventureData } from './snapshot';

/** The riddle the group scanned last and has not answered yet (one at a time on the phone). */
function openRiddle(player: TheCodePlayer, config: TheCodeConfig, riddles: TheCodeRiddle[], now: number): TheCodeFreeView['riddle'] {
  const rules = resolveFreeRules(config.free);
  let best: { gnomeId: string; riddleId: string; at: number; wrongs: number } | null = null;
  for (const [gnomeId, g] of Object.entries(player.free?.gnomes || {})) {
    if (!g.riddleId || g.scannedAt === undefined) continue;
    if (g.asleepUntil !== undefined && g.asleepUntil > now) continue;
    if (!best || g.scannedAt > best.at) best = { gnomeId, riddleId: g.riddleId, at: g.scannedAt, wrongs: g.wrongs };
  }
  if (!best) return null;
  const r = riddles.find((x) => x.id === best!.riddleId && x.gnomeId === best!.gnomeId && x.status === 'published');
  if (!r) return null;
  const view: NonNullable<TheCodeFreeView['riddle']> = {
    gnomeId: best.gnomeId, riddleId: r.id, text: r.text, wrongs: best.wrongs, attempts: rules.attemptsPerRiddle,
  };
  if (r.imageUrl) view.imageUrl = r.imageUrl;
  return view;
}

/** The free-mode snapshot: the guided one + mode, screen hint and the group's gnome board. Pure. */
export function freeSnapshot(adv: TheCodeAdventureData, player: TheCodePlayer | null, now: number, base: TheCodeSnapshot): TheCodeSnapshot {
  const { config, riddles } = adv;
  const adventure: TheCodeSnapshot['adventure'] = {
    ...base.adventure,
    mode: 'free',
    ...(config.free?.screenHint ? { screenHint: config.free.screenHint } : {}),
  };
  // No run, no suitcase in free mode.
  const out: TheCodeSnapshot = { ...base, adventure, run: null, canStartNew: false, free: null };
  if (!player) return out;
  const ctx: TheCodeFreeContext = { config, riddles, now, rng: () => 0 };
  const board = freeBoard(player, ctx);
  const byId = new Map(config.gnomes.map((g) => [g.id, g] as const));
  const rules = resolveFreeRules(config.free);
  const free: TheCodeFreeView = {
    gnomes: board.gnomes.map((b) => {
      const g = byId.get(b.gnomeId)!;
      const row: TheCodeFreeView['gnomes'][number] = { gnome: gnomeView(g), status: b.status, hints: b.hintsShown, nextHintCost: b.nextHintCost };
      if (b.wakesAt !== undefined) row.wakesAt = b.wakesAt;
      if (b.last) row.last = b.last.result;
      return row;
    }),
    allAsleep: board.allAsleep,
    riddle: openRiddle(player, config, riddles, now),
    solved: player.free?.solved ?? 0,
    attemptsPerRiddle: rules.attemptsPerRiddle,
    secondAttemptFactor: rules.secondAttemptFactor,
    hintCost: resolveRules(config.rules).hintCost,
  };
  if (board.nextWakeAt !== undefined) free.nextWakeAt = board.nextWakeAt;
  if (config.free?.introVideo) free.introVideo = config.free.introVideo;
  if (config.free?.wellDoneVideo) free.wellDoneVideo = config.free.wellDoneVideo;
  return { ...out, free };
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;

/** A free-mode action inside the play transaction. null = let the guided path handle it. */
export function freeAct(input: {
  before: TheCodePlayer;
  action: TheCodePlayAction;
  ctx: TheCodeContext;
  scannedGnomeId: string | null;
}): TheCodeModeActResult | null {
  const { before, action, ctx, scannedGnomeId } = input;
  const now = ctx.now;
  const gnomes = new Map(ctx.config.gnomes.map((g) => [g.id, g] as const));
  switch (action.type) {
    case 'state':
      return { next: { ...before, lastSeenAt: now } };
    case 'scan': {
      const r = freeScan(before, scannedGnomeId || '', ctx);
      const g = scannedGnomeId ? gnomes.get(scannedGnomeId) : undefined;
      return {
        next: r.player,
        event: { type: 'freeScan', outcome: r.outcome, ...(g && r.outcome.kind !== 'unknownGnome' ? { gnome: gnomeView(g) } : {}) },
        ...(g && r.outcome.kind !== 'paused' ? { gnomeScanned: g.id } : {}),
      };
    }
    case 'freeAnswer': {
      const { gnomeId, riddleId, letter } = action;
      if (typeof gnomeId !== 'string' || !ID.test(gnomeId) || typeof riddleId !== 'string' || !ID.test(riddleId) ||
          typeof letter !== 'string' || !letter || letter.length > 4) {
        throw new TheCodeStoreError('badRequest', 400);
      }
      const r = freeAnswer(before, { gnomeId, riddleId, letter }, ctx);
      const out: TheCodeModeActResult = { next: r.player, event: { type: 'freeAnswer', outcome: r.outcome } };
      if (!r.replayed && r.outcome.kind === 'correct') {
        out.riddleStat = { riddleId, field: 'correct' };
        if (r.outcome.becameHot) out.lobbyKinds = ['hot'];
      }
      if (!r.replayed && (r.outcome.kind === 'wrong' || r.outcome.kind === 'failed')) out.riddleStat = { riddleId, field: 'wrong' };
      return out;
    }
    case 'freeHint': {
      if (typeof action.gnomeId !== 'string' || !ID.test(action.gnomeId)) throw new TheCodeStoreError('badRequest', 400);
      const r = freeBuyHint(before, action.gnomeId, ctx);
      return { next: r.player, event: { type: 'freeHint', outcome: r.outcome } };
    }
    // Guided-only actions do nothing in free mode (there is no run, no suitcase).
    case 'answer':
    case 'hint':
    case 'arrangeHelp':
    case 'open':
    case 'newSuitcase':
      return { next: { ...before, lastSeenAt: now } };
    default:
      return null; // updateProfile → the shared path
  }
}

registerTheCodeMode('free', { snapshot: freeSnapshot, act: freeAct });
