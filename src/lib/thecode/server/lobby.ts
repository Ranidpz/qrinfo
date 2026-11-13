/**
 * קוד הגמדים — the big screen's public live doc (`codes/{id}/thecodeLobby/live`). Pure.
 *
 * Everything here ends up WORLD-READABLE (rules: read true). An event carries only what
 * the board shows anyway: the group's name, emoji and (unexpired) selfie. Never answers,
 * phrases, phones, recovery codes or ids of anything secret.
 */

import type { TheCodeConfig, TheCodeLobbySettings, TheCodePlayer, TheCodeSelfieSettings } from '@/types/thecode';
import type { TheCodeLobbyEvent } from '@/types/thecode-api';
import { selfieExpired } from '../selfie';

export const LOBBY_EVENTS_MAX = 20;
export const LOBBY_VIDEO_SLOTS = ['idle', 'explain', 'after'] as const;
export type TheCodeLobbySlot = (typeof LOBBY_VIDEO_SLOTS)[number];
export const LOBBY_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
/** Slots the presigned upload accepts: the big screen's three + the opening-screen background. */
export const VIDEO_UPLOAD_SLOTS = [...LOBBY_VIDEO_SLOTS, 'opening'] as const;
/** The opening screen plays muted on phones — keep it small. */
export const OPENING_VIDEO_MAX_BYTES = 30 * 1024 * 1024;
export function videoUploadMaxBytes(slot: string): number {
  return slot === 'opening' ? OPENING_VIDEO_MAX_BYTES : LOBBY_VIDEO_MAX_BYTES;
}
export const LOBBY_VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm' };

/** The group's selfie URL when it may be shown right now (selfies on, not expired). */
export function visiblePhotoUrl(
  player: Pick<TheCodePlayer, 'photo'>,
  selfie: TheCodeSelfieSettings,
  now: number
): string | undefined {
  const p = player.photo;
  if (!p || !p.url || !selfie.enabled) return undefined;
  if (!Number.isFinite(p.takenAt) || selfieExpired(p.takenAt, selfie, now)) return undefined;
  return p.url;
}

/** One banner for the big screen, or null when the group must not appear (hidden). */
export function lobbyEventFor(
  player: Pick<TheCodePlayer, 'familyName' | 'emoji' | 'hidden' | 'photo'>,
  kind: TheCodeLobbyEvent['kind'],
  ctx: { id: string; now: number; selfie: TheCodeSelfieSettings }
): TheCodeLobbyEvent | null {
  if (player.hidden) return null;
  const ev: TheCodeLobbyEvent = {
    id: ctx.id,
    kind,
    familyName: String(player.familyName || ''),
    emoji: String(player.emoji || ''),
    at: ctx.now,
  };
  const photoUrl = visiblePhotoUrl(player, ctx.selfie, ctx.now);
  if (photoUrl) ev.photoUrl = photoUrl;
  return ev;
}

function cleanEvents(events: unknown): TheCodeLobbyEvent[] {
  return Array.isArray(events) ? events.filter((e): e is TheCodeLobbyEvent => !!e && typeof e === 'object' && typeof e.id === 'string') : [];
}

/** Append (newest last) and keep the latest `LOBBY_EVENTS_MAX`. A repeated id is not added twice. */
export function appendLobbyEvents(events: unknown, add: TheCodeLobbyEvent[]): TheCodeLobbyEvent[] {
  const list = cleanEvents(events);
  const seen = new Set(list.map((e) => e.id));
  for (const e of add) if (!seen.has(e.id)) list.push(e);
  return list.slice(-LOBBY_EVENTS_MAX);
}

/** Drop a removed / expired selfie from past banners (the doc is public). Null = no change. */
export function stripPhotoFromEvents(events: unknown, isGone: (url: string) => boolean): TheCodeLobbyEvent[] | null {
  const list = cleanEvents(events);
  let changed = false;
  const out = list.map((e) => {
    if (!e.photoUrl || !isGone(e.photoUrl)) return e;
    changed = true;
    const { photoUrl: _drop, ...rest } = e;
    void _drop;
    return rest;
  });
  return changed ? out : null;
}

/**
 * Only https URLs on OUR R2 public base, mp4/webm. `videoBase` = the R2 public URL
 * (no trailing slash); without one no video is accepted.
 */
export function isAllowedLobbyVideoUrl(url: unknown, videoBase: string | null | undefined): url is string {
  if (typeof url !== 'string' || !videoBase || url.length > 1000) return false;
  let u: URL;
  let base: URL;
  try {
    u = new URL(url);
    base = new URL(videoBase);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.hostname !== base.hostname || u.search || u.hash || u.username || u.password) return false;
  const basePath = base.pathname.replace(/\/+$/, '');
  if (basePath && !u.pathname.startsWith(basePath + '/')) return false;
  return /\.(mp4|webm)$/i.test(u.pathname);
}

export function normalizeLobby(v: unknown, videoBase: string | null | undefined): TheCodeLobbySettings | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raw = (v as { videos?: unknown }).videos;
  if (!raw || typeof raw !== 'object') return undefined;
  const videos: NonNullable<TheCodeLobbySettings['videos']> = {};
  for (const slot of LOBBY_VIDEO_SLOTS) {
    const url = (raw as Record<string, unknown>)[slot];
    if (isAllowedLobbyVideoUrl(url, videoBase)) videos[slot] = url;
  }
  return Object.keys(videos).length ? { videos } : undefined;
}

/** What the live doc mirrors from the adventure. */
export function lobbyVideosOf(config: Pick<TheCodeConfig, 'lobby'>): NonNullable<TheCodeLobbySettings['videos']> {
  return { ...(config.lobby?.videos || {}) };
}
