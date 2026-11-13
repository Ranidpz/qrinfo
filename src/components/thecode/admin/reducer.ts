// הקוד admin — the in-memory reducer behind every screen (pure, no server, no Firebase).
// The demo (src/components/thecode/demo/adminDemo.ts) and the live admin
// (src/components/thecode/adminLive/useTheCodeAdmin.ts) run THIS code, so the UI reacts
// instantly in both; the live hook only adds persistence around it.

import type { TheCodeBranding, TheCodeConfig, TheCodeGnome } from '@/types/thecode';
import { letterOfAnswer } from '@/lib/thecode/letters';
import type { AdminActions, AdminState } from './model';

function randomFrom(alphabet: string, len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
/** QR payload slug — crypto-random, permanent. (Demo only: the server assigns the real ones.) */
export const newGnomeCode = () => randomFrom('abcdefghijkmnpqrstuvwxyz23456789', 16);
/** Short code printed under the QR; no 0/O/1/I so it can be typed off a plate. */
export const newManualCode = () => randomFrom('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);
export const newEntityId = (p: string) => `${p}_${randomFrom('abcdefghijklmnopqrstuvwxyz0123456789', 10)}`;

export type AdminSetter = (fn: (s: AdminState) => AdminState) => void;

export interface ReducerOptions {
  /**
   * true (demo): new gnomes get a random code + manual code right away.
   * false (live): they stay '' until the server assigns them on save — the server alone
   * guarantees they are globally unique.
   */
  localCodes: boolean;
  /** What "reset" does (demo: back to the sample venue; live: reload from the server). */
  reset: () => void;
}

/**
 * Every mutation the screens may make, as pure state transitions. Player rename/hide/remove
 * only touch local state here; the live hook wraps them with the players API.
 */
export function createAdminActions(set: AdminSetter, opts: ReducerOptions): AdminActions {
  const cfg = (fn: (c: TheCodeConfig) => TheCodeConfig) => set((s) => ({ ...s, config: fn(s.config) }));
  /**
   * Riddles created in this session that join the game BY THEMSELVES as soon as they have a
   * question and an answer with a letter (Rani: "מה זה טיוטה?"). Choosing a state by hand takes
   * the riddle out of this set, so an explicit "לא במשחק" is never overridden. No model change:
   * the stored status is still draft/published.
   */
  const autoPublish = new Set<string>();
  return {
    setStatus: (status) => cfg((c) => ({ ...c, status })),
    updateConfig: (patch) => cfg((c) => ({ ...c, ...patch })),
    updateRules: (patch) => cfg((c) => ({ ...c, rules: { ...c.rules, ...patch } })),
    updateLobbyVideo: (slot, url) =>
      cfg((c) => {
        const videos = { ...c.lobby?.videos, [slot]: url || undefined };
        for (const k of Object.keys(videos) as (keyof typeof videos)[]) if (!videos[k]) delete videos[k];
        const lobby = { ...c.lobby, videos: Object.keys(videos).length ? videos : undefined };
        if (!lobby.videos) delete lobby.videos;
        return { ...c, lobby: Object.keys(lobby).length ? lobby : undefined };
      }),
    updateBranding: (patch) =>
      cfg((c) => {
        const next: TheCodeBranding = { ...c.branding, ...patch };
        for (const k of Object.keys(next) as (keyof TheCodeBranding)[]) if (!next[k]) delete next[k];
        return { ...c, branding: Object.keys(next).length ? next : undefined };
      }),

    addSpot: () => {
      const id = newEntityId('s');
      cfg((c) => ({ ...c, spots: [...c.spots, { id, name: 'מקום חדש', hints: [], isActive: true }] }));
      return id;
    },
    updateSpot: (id, patch) => cfg((c) => ({ ...c, spots: c.spots.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    deleteSpot: (id) => cfg((c) => ({ ...c, spots: c.spots.filter((s) => s.id !== id) })),

    addGnomes: (spotId, specs) => {
      const ids = specs.map(() => newEntityId('g'));
      set((s) => {
        let next = Math.max(0, ...s.config.gnomes.map((g) => g.number)) + 1;
        const fresh: TheCodeGnome[] = specs.map((spec, i) => ({
          id: ids[i],
          number: next++,
          code: opts.localCodes ? newGnomeCode() : '',
          manualCode: opts.localCodes ? newManualCode() : '',
          spotId,
          bodyColor: spec.bodyColor,
          hatColor: spec.hatColor,
          isActive: true,
          verifiedOnSite: false,
        }));
        const stats = { ...s.gnomeStats };
        for (const g of fresh) stats[g.id] = { scans: 0 };
        return { ...s, config: { ...s.config, gnomes: [...s.config.gnomes, ...fresh] }, gnomeStats: stats };
      });
      return ids;
    },
    updateGnome: (id, patch) => cfg((c) => ({ ...c, gnomes: c.gnomes.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
    deleteGnome: (id) =>
      set((s) => ({
        ...s,
        config: { ...s.config, gnomes: s.config.gnomes.filter((g) => g.id !== id) },
        riddles: s.riddles.filter((r) => r.gnomeId !== id),
      })),
    verifyGnome: (id) =>
      set((s) => {
        const now = Date.now();
        const prev = s.gnomeStats[id] || { scans: 0 };
        return {
          ...s,
          config: { ...s.config, gnomes: s.config.gnomes.map((g) => (g.id === id ? { ...g, verifiedOnSite: true } : g)) },
          gnomeStats: { ...s.gnomeStats, [id]: { ...prev, verifiedAt: now, lastScanAt: now } },
        };
      }),

    addRiddle: (gnomeId, answerWord = '') => {
      const id = newEntityId('r');
      autoPublish.add(id);
      set((s) => ({
        ...s,
        riddles: [
          ...s.riddles,
          { id, gnomeId, type: 'observe', text: '', answerWord, letter: letterOfAnswer(answerWord), acceptSoundAlike: true, hints: [], difficulty: 1, status: 'draft' },
        ],
      }));
      return id;
    },
    updateRiddle: (id, patch) =>
      set((s) => ({
        ...s,
        riddles: s.riddles.map((r) => {
          if (r.id !== id) return r;
          const next = { ...r, ...patch };
          next.letter = letterOfAnswer(next.answerWord);
          if (patch.status !== undefined) autoPublish.delete(id);
          else if (autoPublish.has(id) && next.status === 'draft' && next.text.trim() && next.letter) {
            next.status = 'published';
            autoPublish.delete(id);
          }
          return next;
        }),
      })),
    deleteRiddle: (id) => set((s) => ({ ...s, riddles: s.riddles.filter((r) => r.id !== id) })),

    addPhrase: (text) => {
      const id = newEntityId('p');
      cfg((c) => ({ ...c, phrases: [...c.phrases, { id, text: text.trim(), isActive: true }] }));
      return id;
    },
    updatePhrase: (id, patch) => cfg((c) => ({ ...c, phrases: c.phrases.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    deletePhrase: (id) => cfg((c) => ({ ...c, phrases: c.phrases.filter((p) => p.id !== id) })),

    updatePlayer: (id, patch) =>
      set((s) => ({
        ...s,
        players: s.players.map((p) => {
          if (p.id !== id) return p;
          const renamed = patch.familyName !== undefined && patch.familyName !== p.familyName;
          return { ...p, ...patch, originalName: renamed ? p.originalName || p.familyName : p.originalName };
        }),
      })),
    deletePlayer: (id) => set((s) => ({ ...s, players: s.players.filter((p) => p.id !== id) })),
    removePlayerPhoto: (id) => set((s) => ({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, photoUrl: undefined } : p)) })),

    reset: opts.reset,
  };
}
