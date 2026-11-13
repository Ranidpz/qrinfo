// הקוד admin — an in-memory stand-in for /api/thecode/admin that behaves like the contract:
// versions + 409 on a stale baseVersion, normalization (trim, letters re-derived), server-only
// gnome codes, refused publish while the engine reports errors. Used by
// `/play/the-code/admin?mock=1` (exercise the live hook with no server) and the merge tests.

import type { TheCodeAdminLoadResponse, TheCodeAdminSaveResponse } from '@/types/thecode-api';
import type { TheCodeConfig, TheCodeRiddle } from '@/types/thecode';
import { validateAdventure, canPublish } from '@/lib/thecode/engine';
import { letterOfAnswer } from '@/lib/thecode/letters';
import { resolveSelfie } from '@/lib/thecode/selfie';
import { newGnomeCode, newManualCode } from '@/components/thecode/admin/reducer';
import type { TheCodeAdminTransport } from './transport';

export interface MemoryServerControls {
  /** Fail the next N saves with a network error. */
  failNext(n: number): void;
  /** Simulate another tab saving (bumps the version). */
  bumpVersion(): void;
  latencyMs: number;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const trim = (s: string | undefined) => (typeof s === 'string' ? s.trim() : s);

function normalize(config: TheCodeConfig, riddles: TheCodeRiddle[]) {
  const c = clone(config);
  c.title = c.title.trim();
  c.spots = c.spots.map((s) => ({ ...s, name: s.name.trim(), hints: s.hints.map((h) => h.trim()).filter(Boolean), safetyNote: trim(s.safetyNote) || undefined, outdoor: s.outdoor === true ? true : undefined }));
  c.phrases = c.phrases.map((p) => ({ ...p, text: p.text.trim() }));
  c.gnomes = c.gnomes.map((g) => ({ ...g, code: g.code || newGnomeCode(), manualCode: g.manualCode || newManualCode() }));
  // Like the server: drop empty fields, one line of ≤140 chars, no branding when nothing is left.
  // (URLs are not forced to https here — the fake upload returns blob: URLs.)
  if (c.branding) {
    const b = {
      backgroundUrl: c.branding.backgroundUrl?.trim() || undefined,
      logoUrl: c.branding.logoUrl?.trim() || undefined,
      welcomeText: c.branding.welcomeText?.replace(/\s+/g, ' ').trim().slice(0, 140) || undefined,
    };
    c.branding = b.backgroundUrl || b.logoUrl || b.welcomeText ? JSON.parse(JSON.stringify(b)) : undefined;
  }
  // Like the server: one line each, ≤160 chars, ≤8 lines, empties dropped; nothing left → default.
  if (c.howToPlay) {
    const lines = c.howToPlay.map((l) => l.replace(/\s+/g, ' ').trim().slice(0, 160)).filter(Boolean).slice(0, 8);
    c.howToPlay = lines.length ? lines : undefined;
  }
  // Like the server: selfie clamped through resolveSelfie, lobby videos without empty slots.
  if (c.selfie) c.selfie = resolveSelfie(c);
  if (c.lobby) {
    const v = Object.fromEntries(Object.entries(c.lobby.videos || {}).filter(([, u]) => typeof u === 'string' && u.trim()));
    c.lobby = Object.keys(v).length ? { videos: v } : undefined;
  }
  const r = clone(riddles).map((x) => ({ ...x, text: x.text.trim(), answerWord: x.answerWord.trim(), letter: letterOfAnswer(x.answerWord), hints: x.hints.map((h) => h.trim()).filter(Boolean) }));
  return { config: c, riddles: r };
}

export function createMemoryTransport(initial: TheCodeAdminLoadResponse): { transport: TheCodeAdminTransport; controls: MemoryServerControls } {
  let db = clone(initial);
  let fail = 0;
  const controls: MemoryServerControls = {
    latencyMs: 600,
    failNext: (n) => void (fail = n),
    bumpVersion: () => void (db = { ...db, version: db.version + 1 }),
  };
  const wait = () => new Promise((r) => setTimeout(r, controls.latencyMs));

  const transport: TheCodeAdminTransport = {
    async load() {
      await wait();
      return { ok: true, data: clone(db) };
    },
    async save(req) {
      await wait();
      if (fail > 0) {
        fail--;
        return { ok: false, error: 'network' };
      }
      if (req.baseVersion !== db.version) return { ok: false, error: 'conflict', version: db.version } satisfies TheCodeAdminSaveResponse;
      const n = normalize(req.config, req.riddles);
      const issues = validateAdventure(n.config, n.riddles);
      if (n.config.status === 'published' && !canPublish(issues)) return { ok: false, error: 'invalid', issues };
      db = { ...db, version: db.version + 1, config: n.config, riddles: n.riddles };
      return { ok: true, version: db.version, config: clone(n.config), riddles: clone(n.riddles), issues };
    },
    async patchPlayer(req) {
      await wait();
      db.players = db.players.map((p) => (p.id === req.playerId ? { ...p, ...req.patch, originalName: req.patch.familyName ? p.originalName || p.familyName : p.originalName } : p));
      return { ok: true };
    },
    async deletePlayer(req) {
      await wait();
      db.players = db.players.filter((p) => p.id !== req.playerId);
      return { ok: true };
    },
    async removePhoto(req) {
      await wait();
      db.players = db.players.map((p) => (p.id === req.playerId ? { ...p, photoUrl: undefined } : p));
      return { ok: true };
    },
    uploadLobbyVideo: (_codeId, _slot, file, onProgress) =>
      new Promise((resolve) => {
        let f = 0;
        const t = setInterval(() => {
          f = Math.min(1, f + 0.1);
          onProgress(f);
          if (f >= 1) {
            clearInterval(t);
            resolve(URL.createObjectURL(file));
          }
        }, 150);
      }),
    uploadImage: (_codeId, file, onProgress) =>
      new Promise((resolve) => {
        let f = 0;
        const t = setInterval(() => {
          f = Math.min(1, f + 0.2);
          onProgress(f);
          if (f >= 1) {
            clearInterval(t);
            resolve(URL.createObjectURL(file));
          }
        }, 150);
      }),
  };
  return { transport, controls };
}
