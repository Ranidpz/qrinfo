// הקוד admin — folding a save response back into the editor without losing what the operator
// typed while the request was in flight. Pure (types-only imports) so it can be tested standalone.
//
// Three snapshots meet here:
//   sent    — what the PUT carried,
//   server  — what the server stored (normalized: trimmed text, re-derived letters, and the
//             gnome codes / manual codes / numbers only IT assigns),
//   local   — the editor now (= sent + every edit made since).
// Rules, per entity (merged by id) and per top-level config field:
//   unchanged since sent  → take the server's version;
//   edited since sent     → keep the local edit, but take the server-assigned fields;
//   added since sent      → keep; deleted since sent → stays deleted.
// Text the server only trimmed keeps the operator's whitespace, so a pause after typing a
// space never eats the space.

import type { TheCodeConfig, TheCodeGnome, TheCodeRiddle } from '@/types/thecode';

export interface Content {
  config: TheCodeConfig;
  riddles: TheCodeRiddle[];
}

/** Stable JSON (sorted keys, undefined dropped) for equality + dirty checks. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v)
        .sort()
        .reduce<Record<string, unknown>>((o, k) => {
          if ((v as Record<string, unknown>)[k] !== undefined) o[k] = (v as Record<string, unknown>)[k];
          return o;
        }, {});
    }
    return v;
  });
}

export const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** The part of the editor that the PUT carries. */
export const contentOf = (c: Content): Content => ({ config: c.config, riddles: c.riddles });

/** Server value, but where it only differs by surrounding whitespace keep the local string. */
export function keepWhitespace<T>(server: T, local: unknown): T {
  if (typeof server === 'string' && typeof local === 'string') {
    return (server === local.trim() ? local : server) as T;
  }
  if (Array.isArray(server) && Array.isArray(local)) {
    // Arrays of strings may lose trailing empties on the server (hints) — compare item by item.
    return server.map((v, i) => keepWhitespace(v, local[i])) as T;
  }
  if (server && local && typeof server === 'object' && typeof local === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(server as Record<string, unknown>)) out[k] = keepWhitespace(v, (local as Record<string, unknown>)[k]);
    return out as T;
  }
  return server;
}

type Entity = { id: string };

function mergeList<T extends Entity>(
  server: T[],
  sent: T[],
  local: T[],
  assigned: (serverItem: T, localItem: T) => T
): T[] {
  const serverById = new Map(server.map((x) => [x.id, x]));
  const sentById = new Map(sent.map((x) => [x.id, x]));
  const out: T[] = [];
  for (const item of local) {
    const sv = serverById.get(item.id);
    const st = sentById.get(item.id);
    if (!st) {
      out.push(item); // added while the save was in flight
    } else if (!sv) {
      // The server dropped it (e.g. normalized away). Keep it only if the operator kept editing it.
      if (!same(item, st)) out.push(item);
    } else if (same(item, st)) {
      out.push(keepWhitespace(sv, item));
    } else {
      out.push(assigned(sv, item));
    }
  }
  // Anything the server created that we never had (not expected, but never lose it).
  for (const sv of server) {
    if (!sentById.has(sv.id) && !local.some((l) => l.id === sv.id)) out.push(sv);
  }
  return out;
}

const gnomeAssigned = (sv: TheCodeGnome, item: TheCodeGnome): TheCodeGnome => ({
  ...item,
  code: sv.code,
  manualCode: sv.manualCode,
  number: sv.number,
});

const riddleAssigned = (sv: TheCodeRiddle, item: TheCodeRiddle): TheCodeRiddle => ({
  ...item,
  // The letter is re-derived from answerWord; if the word changed since, the local reducer
  // already derived the new one — only adopt the server's when the word is the same.
  letter: item.answerWord === sv.answerWord ? sv.letter : item.letter,
});

const LISTS = ['spots', 'gnomes', 'phrases'] as const;

/**
 * Merge a successful save into the editor.
 * Returns the new editor content and the new BASELINE (what the server now holds, in the
 * operator's whitespace) — the editor is dirty while it differs from the baseline.
 */
export function mergeSaved(server: Content, sent: Content, local: Content): { next: Content; baseline: Content } {
  const baseline: Content = keepWhitespace(server, sent);

  const config = { ...local.config } as TheCodeConfig;
  const writable = config as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(server.config), ...Object.keys(local.config)]) as Set<keyof TheCodeConfig>;
  for (const key of keys) {
    if ((LISTS as readonly string[]).includes(key)) continue;
    const lv = local.config[key];
    if (same(lv, sent.config[key])) writable[key] = keepWhitespace(server.config[key], lv);
  }
  config.spots = mergeList(server.config.spots, sent.config.spots, local.config.spots, (sv, item) => ({ ...item, id: sv.id }));
  config.gnomes = mergeList(server.config.gnomes, sent.config.gnomes, local.config.gnomes, gnomeAssigned);
  config.phrases = mergeList(server.config.phrases, sent.config.phrases, local.config.phrases, (sv, item) => ({ ...item, id: sv.id }));
  const riddles = mergeList(server.riddles, sent.riddles, local.riddles, riddleAssigned);

  return { next: { config, riddles }, baseline };
}

/**
 * A refused publish ('invalid'): nothing was saved. Put the status back to what the server
 * has, keep every other edit (they go out again with the next save).
 */
export function revertStatus(local: Content, baseline: Content): Content {
  return { ...local, config: { ...local.config, status: baseline.config.status } };
}
